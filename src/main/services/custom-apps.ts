/**
 * Custom apps & schemas — local filesystem operations for the dev panel.
 * Apps live in <rootDir>/<projectId>/.apps/<appSlug>/
 * Schemas live in <rootDir>/.schemas/
 */

import fs from 'node:fs'
import path from 'node:path'
import { getRootDir } from '../projects'

interface FileEntry {
  id: string
  name: string
  isDirectory: boolean
  content?: string
}

// ---- Custom Apps ----

function appsDir(projectId: string): string {
  return path.join(getRootDir(), projectId, '.apps')
}

export function listCustomAppFolders(projectId: string): { id: string; name: string }[] {
  const dir = appsDir(projectId)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifestPath = path.join(dir, d.name, 'manifest.json')
      let name = d.name
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        if (manifest.name) name = manifest.name
      } catch { /* use folder name */ }
      return { id: d.name, name }
    })
}

export function listCustomAppFiles(projectId: string, appSlug: string): FileEntry[] {
  const dir = path.join(appsDir(projectId), appSlug)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => !d.name.startsWith('.'))
    .map((d) => ({
      id: d.name,
      name: d.name,
      isDirectory: d.isDirectory(),
    }))
}

export function readCustomAppFile(projectId: string, appSlug: string, filename: string): string {
  const filePath = path.join(appsDir(projectId), appSlug, filename)
  return fs.readFileSync(filePath, 'utf-8')
}

export function writeCustomAppFile(projectId: string, appSlug: string, filename: string, content: string): void {
  const dir = path.join(appsDir(projectId), appSlug)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, filename), content, 'utf-8')
}

export function scaffoldCustomApp(projectId: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'my_app'
  const dir = path.join(appsDir(projectId), slug)
  fs.mkdirSync(dir, { recursive: true })

  const manifest = JSON.stringify({
    id: slug,
    name,
    menu: ['Custom'],
    icon: 'wand-magic-sparkles',
    function: {
      description: '',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Prompt' },
        },
        required: ['prompt'],
      },
    },
  }, null, 2)

  fs.writeFileSync(path.join(dir, 'manifest.json'), manifest, 'utf-8')
  fs.writeFileSync(path.join(dir, 'run.js'), '// App logic here\nconst result = await ai.text({ prompt: context.input.prompt });\nlog(result);\n', 'utf-8')
  fs.writeFileSync(path.join(dir, 'view.html'), '<app-view>\n  <app-row>\n    <app-input name="prompt" label="Prompt"></app-input>\n    <app-submit></app-submit>\n  </app-row>\n</app-view>\n', 'utf-8')

  return slug
}

export function deleteCustomApp(projectId: string, appSlug: string): void {
  const dir = path.join(appsDir(projectId), appSlug)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true })
}

// ---- Custom Schemas ----

function schemasDir(): string {
  return path.join(getRootDir(), '.schemas')
}

export function listCustomSchemas(): { id: string; name: string }[] {
  const dir = schemasDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.schema'))
    .map((f) => {
      const filePath = path.join(dir, f)
      let name = f.replace('.schema', '')
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        if (data.name) name = data.name
      } catch { /* use filename */ }
      return { id: f.replace('.schema', ''), name }
    })
}

export function readCustomSchema(schemaId: string): string {
  const filePath = path.join(schemasDir(), `${schemaId}.schema`)
  return fs.readFileSync(filePath, 'utf-8')
}

export function writeCustomSchema(schemaId: string, content: string): void {
  const dir = schemasDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${schemaId}.schema`), content, 'utf-8')
}

export function scaffoldCustomSchema(): string {
  const id = `type-${Date.now()}`
  const content = JSON.stringify({
    id,
    name: 'New Type',
    extension: '.custom',
    icon: 'fa-solid fa-file',
    thumbnail: null,
    type: 'object',
    properties: {},
  }, null, 2)
  writeCustomSchema(id, content)
  return id
}

export function deleteCustomSchema(schemaId: string): void {
  const filePath = path.join(schemasDir(), `${schemaId}.schema`)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}
