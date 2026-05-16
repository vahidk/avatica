/**
 * Chat service for desktop — streams LLM responses with tool calling.
 * Mirrors the webapp's chat.ts but uses local filesystem and IPC events.
 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { ThinkingLevel } from '@google/genai'
import { googleClient as ai } from '../clients'
import { listFiles } from '../files'
import { buildSystemPrompt, loadPrompt, getSkillDirectory, loadSkill } from '../prompts'
import { listSystemApps } from '../apps'
import { runApp } from '../runner'
import { PROVIDERS, CAPABILITY_DEFAULTS, actualCostUsd } from '../providers'
import { recordUsage } from '../usage'
import { BUILDER_TOOLS, isBuilderTool, executeBuilderTool } from './appBuilder'
import { COMPOSE_TOOLS, isComposeTool, executeComposeTool } from './composeBuilder'
import { FILE_TOOLS, isFileTool, executeFileTool } from './fileTools'
import { SCHEMA_TOOLS, isSchemaTool, executeSchemaTool } from './schemaBuilder'

const CHAT_MODEL = PROVIDERS[CAPABILITY_DEFAULTS['text/generate']].model
const MAX_TOOL_ITERATIONS = 5
const CHAT_TOKEN_LIMIT = 16000
const CHAT_KEEP_RECENT = 6

type ContentPart = Record<string, any>
type Content = { role: string; parts: ContentPart[] }

export type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; result: string }
  | { type: 'files_generated'; appId: string; fileIds: string[] }
  | { type: 'schemas_updated' }
  | { type: 'done' }
  | { type: 'error'; message: string }

// ---- Conversation persistence (local JSON) ----

function getConversationPath(projectId: string): string {
  return path.join(app.getPath('userData'), 'conversations', `${projectId}.json`)
}

function loadConversation(projectId: string): Content[] {
  const filePath = getConversationPath(projectId)
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return []
  }
}

function saveConversation(projectId: string, contents: Content[]): void {
  const dir = path.dirname(getConversationPath(projectId))
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getConversationPath(projectId), JSON.stringify(contents))
}

export function clearConversation(projectId: string): void {
  const filePath = getConversationPath(projectId)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

export function getConversationMessages(projectId: string): { role: string; content: string; toolCalls?: { name: string; args: any }[] }[] {
  const contents = loadConversation(projectId)
  const messages: { role: string; content: string; toolCalls?: { name: string; args: any }[] }[] = []

  for (const c of contents) {
    const role = c.role === 'model' ? 'assistant' : 'user'
    const textParts = (c.parts || []).filter((p: any) => typeof p.text === 'string')
    const fnCalls = (c.parts || []).filter((p: any) => p.functionCall)
    const fnResponses = (c.parts || []).filter((p: any) => p.functionResponse)

    if (fnResponses.length > 0 && textParts.length === 0) continue

    const text = textParts.map((p: any) => p.text).join('')
    if (!text && fnCalls.length === 0) continue

    const toolCalls = fnCalls.map((p: any) => ({
      name: p.functionCall.name,
      args: p.functionCall.args,
    }))

    messages.push({
      role,
      content: text,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    })
  }

  return messages
}

// ---- Token estimation ----

function estimateContentTokens(contents: Content[]): number {
  let total = 0
  for (const c of contents) {
    for (const part of c.parts) {
      if (typeof part.text === 'string') total += Math.ceil(part.text.length / 4)
      if (part.functionCall) total += Math.ceil(JSON.stringify(part.functionCall).length / 4)
      if (part.functionResponse) total += Math.ceil(JSON.stringify(part.functionResponse).length / 4)
    }
  }
  return total
}

function contentsToText(contents: Content[]): string {
  const lines: string[] = []
  for (const c of contents) {
    const role = c.role === 'model' ? 'assistant' : 'user'
    for (const part of c.parts) {
      if (typeof part.text === 'string') lines.push(`${role}: ${part.text.slice(0, 2000)}`)
      if (part.functionCall) lines.push(`assistant: [called ${part.functionCall.name}]`)
      if (part.functionResponse) lines.push(`tool: [${part.functionResponse.name}: ${String(part.functionResponse.response?.result || '').slice(0, 2000)}]`)
    }
  }
  return lines.join('\n')
}

async function compactContents(contents: Content[]): Promise<Content[] | null> {
  if (estimateContentTokens(contents) <= CHAT_TOKEN_LIMIT || contents.length <= CHAT_KEEP_RECENT + 2) {
    return null
  }

  const toSummarize = contents.slice(0, contents.length - CHAT_KEEP_RECENT)
  const recent = contents.slice(contents.length - CHAT_KEEP_RECENT)

  const summaryText = contentsToText(toSummarize)
  const summaryResponse = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [{ role: 'user', parts: [{ text: loadPrompt('summary', { conversation: summaryText }) }] }],
    config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  })
  const summary = summaryResponse.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return [
    { role: 'user', parts: [{ text: `[Previous conversation summary: ${summary}]` }] },
    { role: 'model', parts: [{ text: 'I have the context from our earlier conversation.' }] },
    ...recent,
  ]
}

// ---- Tool declarations & execution ----

function sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result = { ...schema }
  if (result.properties && typeof result.properties === 'object') {
    const props: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(result.properties as Record<string, any>)) {
      const prop = { ...val }
      if (Array.isArray(prop.enum)) {
        if (prop.type === 'string') {
          prop.enum = prop.enum.map((v: unknown) => String(v))
        } else {
          prop.description = `${prop.description || ''} (allowed values: ${prop.enum.join(', ')})`.trim()
          delete prop.enum
        }
      }
      props[key] = prop
    }
    result.properties = props
  }
  return result
}

function buildToolDeclarations(): { name: string; description: string; parameters: Record<string, unknown> }[] {
  const tools: { name: string; description: string; parameters: Record<string, unknown> }[] = []

  for (const app of listSystemApps()) {
    if (app.function) {
      tools.push({
        name: app.id,
        description: `${app.name}: ${app.function.description}`,
        parameters: sanitizeSchema(app.function.inputSchema),
      })
    }
  }

  tools.push(...FILE_TOOLS)
  tools.push(...BUILDER_TOOLS)
  tools.push(...COMPOSE_TOOLS)
  tools.push(...SCHEMA_TOOLS)

  const skillIds = getSkillDirectory().map(s => s.id)
  if (skillIds.length > 0) {
    tools.push({
      name: 'load_skill',
      description: "Load a skill's full documentation before performing a task that requires it.",
      parameters: {
        type: 'object',
        properties: { skill_id: { type: 'string', enum: skillIds, description: 'The skill to load' } },
        required: ['skill_id'],
      },
    })
  }

  return tools
}

interface ToolResult {
  resultText: string
  fileIds?: string[]
  appId?: string
  schemasUpdated?: boolean
}

async function executeTool(
  name: string,
  args: Record<string, any>,
  ctx: { projectId: string },
): Promise<ToolResult> {
  if (name === 'load_skill') {
    const content = loadSkill(args?.skill_id)
    return { resultText: content || `Skill "${args?.skill_id}" not found.` }
  }

  if (isFileTool(name)) return executeFileTool(name, args, ctx)

  if (isBuilderTool(name)) return executeBuilderTool(name, args, ctx)
  if (isComposeTool(name)) return executeComposeTool(name, args, ctx)
  if (isSchemaTool(name)) return executeSchemaTool(name, args)

  try {
    const result = await runApp({ projectId: ctx.projectId, appId: name, input: args })
    const fileNames = result.files.map(f => f.name)
    return {
      resultText: result.error
        ? `Error: ${result.error}`
        : `Generated ${fileNames.length} file(s): ${fileNames.join(', ')}`,
      fileIds: fileNames,
      appId: name,
    }
  } catch (err: any) {
    return { resultText: `Error: ${err.message || 'Tool execution failed'}` }
  }
}

// ---- Main streaming chat ----

export async function streamChat(
  projectId: string,
  projectName: string,
  message: string,
  send: (event: ChatEvent) => void,
): Promise<void> {
  const tools = buildToolDeclarations()
  const providerId = CAPABILITY_DEFAULTS['text/generate']

  // Build context
  const projectFiles = listFiles(projectId, '')
    .filter(f => !f.isDirectory)
    .map(f => `- ${f.name} (${f.mimeType || 'unknown'})`)
    .join('\n')

  const systemPrompt = buildSystemPrompt({
    projectName,
    projectFiles: projectFiles || 'No files yet.',
  })

  // Load conversation
  let contents = loadConversation(projectId)
  contents.push({ role: 'user', parts: [{ text: message }] })

  // Compact if needed
  const compacted = await compactContents(contents)
  if (compacted) contents = compacted

  const functionDeclarations = tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }))

  const geminiConfig = {
    systemInstruction: systemPrompt,
    tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  }

  async function streamResponse(): Promise<any[]> {
    const stream = await ai.models.generateContentStream({
      model: CHAT_MODEL,
      contents,
      config: geminiConfig,
    })

    const collectedParts: any[] = []
    let usage: any = null

    for await (const chunk of stream) {
      if (chunk.usageMetadata) usage = chunk.usageMetadata
      for (const part of chunk.candidates?.[0]?.content?.parts || []) {
        collectedParts.push(part)
        if (part.text) send({ type: 'text', content: part.text })
      }
    }

    // Record usage
    if (usage && providerId) {
      const cost = actualCostUsd(providerId, {
        promptTokens: usage.promptTokenCount,
        completionTokens: usage.candidatesTokenCount,
      })
      if (cost > 0) recordUsage('chat', providerId, cost)
    }

    return collectedParts
  }

  try {
    let parts = await streamResponse()

    // Tool call loop
    let iterations = MAX_TOOL_ITERATIONS
    while (iterations-- > 0) {
      const toolCalls = parts.filter((p: any) => p.functionCall)
      if (toolCalls.length === 0) break

      const functionResponses: any[] = []
      for (const toolCall of toolCalls) {
        const name = toolCall.functionCall.name!
        const args = toolCall.functionCall.args
        send({ type: 'tool_call', name, args })

        let resultText = ''
        try {
          const result = await executeTool(name, args || {}, { projectId })
          resultText = result.resultText
          if (result.fileIds?.length) send({ type: 'files_generated', appId: result.appId || name, fileIds: result.fileIds })
          if (result.schemasUpdated) send({ type: 'schemas_updated' })
        } catch (err: any) {
          resultText = `Error: ${err.message || 'Tool execution failed'}`
        }

        send({ type: 'tool_result', result: resultText })
        functionResponses.push({ functionResponse: { name, response: { result: resultText } } })
      }

      contents.push({ role: 'model', parts })
      contents.push({ role: 'user', parts: functionResponses })

      parts = await streamResponse()
    }

    // Save final response
    contents.push({ role: 'model', parts })
    saveConversation(projectId, contents)

    send({ type: 'done' })
  } catch (err: any) {
    send({ type: 'error', message: err.message || 'Chat failed' })
  }
}
