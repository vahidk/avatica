import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

function getPromptsDir(): string {
  // In dev: src/main/prompts. In prod: resources/prompts.
  const devPath = join(__dirname, '../../src/main/prompts')
  if (existsSync(devPath)) return devPath
  return join(process.resourcesPath, 'prompts')
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content.trim() }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { meta, body: match[2].trim() }
}

export interface SkillMeta {
  id: string
  name: string
  description: string
}

export function getSkillDirectory(): SkillMeta[] {
  const skillsDir = join(getPromptsDir(), 'skills')
  if (!existsSync(skillsDir)) return []
  return readdirSync(skillsDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => {
      const content = readFileSync(join(skillsDir, f), 'utf-8')
      const { meta } = parseFrontmatter(content)
      return {
        id: f.replace('.md', ''),
        name: meta.name || f.replace('.md', ''),
        description: meta.description || '',
      }
    })
}

export function buildSkillDirectory(): string {
  const skills = getSkillDirectory()
  if (skills.length === 0) return ''
  const lines = skills.map(s => `- ${s.name}: ${s.description}`)
  return `## Available Skills\nUse the \`load_skill\` tool to load a skill's full documentation before performing a task that matches it.\n${lines.join('\n')}`
}

export function loadSkill(skillId: string): string | null {
  const filePath = join(getPromptsDir(), 'skills', `${skillId}.md`)
  if (!existsSync(filePath)) return null
  const { body } = parseFrontmatter(readFileSync(filePath, 'utf-8'))
  return body
}

export function loadPrompt(name: string, vars: Record<string, string> = {}): string {
  const filePath = join(getPromptsDir(), `${name}.md`)
  let content = readFileSync(filePath, 'utf-8')
  for (const [key, value] of Object.entries(vars)) {
    content = content.split(`{{${key}}}`).join(value)
  }
  content = content.replace(/\{\{[^}]+\}\}/g, '')
  return content.trim()
}

export function buildSystemPrompt(vars: Record<string, string> = {}): string {
  const skillDirectory = buildSkillDirectory()
  return loadPrompt('system', { ...vars, skills: skillDirectory })
}
