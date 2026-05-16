/**
 * App runner — loads a sandbox app's run.js and executes it with the syscalls
 * defined in `./syscalls`. Mirrors the layout of `backend/src/sandbox/runner.ts`,
 * minus the QuickJS sandbox: on the desktop, run.js is trusted code that
 * executes in the host V8 via `new Function`.
 */

import fs from 'node:fs'
import path from 'node:path'

import { getRootDir } from './projects'
import { actualCostUsd } from './providers'
import { recordUsage } from './usage'
import { getAppRunJs, getSystemAppsDir } from './apps'
import { generateAssetName } from './utils/naming'
import { lookupSchema } from './schemas'
import {
  type SyscallContext,
  aiText, aiImage, aiVideo, aiAudio, aiSpeech,
  fileRead, fileList, fileSave,
} from './syscalls'

interface RunContext {
  projectId: string
  appId: string
  input: Record<string, unknown>
}

interface RunResult {
  files: { id: string; name: string; path: string }[]
  totalCostUsd: number
  error?: string
}

export async function runApp(ctx: RunContext): Promise<RunResult> {
  const code = getAppRunJs(ctx.appId, ctx.projectId)
  if (!code) throw new Error(`No run.js found for app: ${ctx.appId}`)

  const projectDir = path.join(getRootDir(), ctx.projectId)
  const generatedFiles: RunResult['files'] = []
  let totalCostUsd = 0

  // Per-run state passed to every syscall.
  const sysCtx: SyscallContext = {
    projectDir,
    track(providerId, usage, params) {
      const cost = actualCostUsd(providerId, usage, params)
      totalCostUsd += cost
      if (cost > 0) recordUsage(ctx.appId, providerId, cost)
    },
    save(buffer, assetName, ext) {
      const fileName = `${assetName}.${ext}`
      const filePath = path.join(projectDir, fileName)
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true })
      fs.writeFileSync(filePath, buffer)
      generatedFiles.push({ id: fileName, name: fileName, path: filePath })
      return fileName
    },
    recordGenerated(name, filePath) {
      generatedFiles.push({ id: name, name, path: filePath })
    },
  }

  // ---- JS-facing API exposed to run.js ----

  const ai = {
    text: (p: any) => aiText(typeof p === 'string' ? { prompt: p } : p, sysCtx),
    image: (p: any) => aiImage(p, sysCtx),
    video: (p: any) => aiVideo(p, sysCtx),
    audio: (p: any) => aiAudio(p, sysCtx),
    speech: (p: any) => aiSpeech(p, sysCtx),
    chat: (opts: any) => {
      // Thin wrapper around aiText that maintains conversation history across send() calls.
      const history: { role: string; text: string }[] = []
      return {
        send: async (p: any) => {
          const params = typeof p === 'string' ? { prompt: p } : p
          if (opts?.provider && !params.provider) params.provider = opts.provider
          params.history = history
          const response = await aiText(params, sysCtx)
          history.push({ role: 'user', text: params.prompt })
          history.push({ role: 'model', text: response })
          return response
        },
      }
    },
  }

  const file = {
    read: (id: string) => fileRead(id, sysCtx),
    list: () => fileList(sysCtx),
    save: (data: string, p: any) => fileSave(data, p, sysCtx),
  }

  const log = (msg: string): void => { console.log(`[${ctx.appId}]`, msg) }

  const appDir = path.join(getSystemAppsDir(), ctx.appId)
  const app = {
    prompt: async (filename: string, vars?: Record<string, unknown>): Promise<string> => {
      const resolved = path.resolve(appDir, filename)
      if (!resolved.startsWith(path.resolve(appDir))) throw new Error('Invalid file path')
      if (!fs.existsSync(resolved)) throw new Error('File not found: ' + filename)
      const template = fs.readFileSync(resolved, 'utf-8')
      if (!vars || Object.keys(vars).length === 0) return template
      const Handlebars = await import('handlebars')
      return Handlebars.default.compile(template)(vars)
    },
    assetName: (prompt: string, fallback?: string) => generateAssetName(prompt, fallback),
  }

  const runCtx = { projectId: ctx.projectId, appId: ctx.appId, userId: 'local', input: ctx.input }

  try {
    const asyncFn = new Function('context', 'ai', 'file', 'log', 'schema', 'app',
      `return (async () => { ${code} })()`
    )
    await asyncFn(runCtx, ai, file, log, { get: async (id: string) => lookupSchema(id) || {} }, app)
  } catch (err: any) {
    return { files: generatedFiles, totalCostUsd, error: err.message || String(err) }
  }

  return { files: generatedFiles, totalCostUsd }
}
