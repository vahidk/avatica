import fs from 'node:fs'
import path from 'node:path'
import { getRootDir } from '../projects'

// ---- Tool definitions ----

export const BUILDER_TOOLS = [
  {
    name: 'builder__create_app',
    description: 'Create a new custom app folder. Returns the folder path to use with write_app_file and publish_app.',
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'Display name for the app' } }, required: ['name'] },
  },
  {
    name: 'builder__write_app_file',
    description: 'Write a file into an app folder. Use this to create manifest.json, run.js, estimate.js, and view.html.',
    parameters: { type: 'object', properties: { folderPath: { type: 'string', description: 'App folder path from create_app' }, filename: { type: 'string', description: 'File name (manifest.json, run.js, estimate.js, or view.html)' }, content: { type: 'string', description: 'File content' } }, required: ['folderPath', 'filename', 'content'] },
  },
  {
    name: 'builder__publish_app',
    description: 'Publish an app so it appears in the app grid and can be used.',
    parameters: { type: 'object', properties: { folderPath: { type: 'string', description: 'App folder path from create_app' } }, required: ['folderPath'] },
  },
]

// ---- Tool execution ----

export function isBuilderTool(name: string): boolean {
  return name.startsWith('builder__')
}

export function executeBuilderTool(
  name: string,
  args: Record<string, any>,
  ctx: { projectId: string },
): { resultText: string; appId?: string } {
  const appsDir = path.join(getRootDir(), ctx.projectId, '.apps')
  if (!fs.existsSync(appsDir)) fs.mkdirSync(appsDir, { recursive: true })

  switch (name) {
    case 'builder__create_app': {
      const appName = args?.name || 'Untitled'
      const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const folderPath = path.join(appsDir, slug)
      fs.mkdirSync(folderPath, { recursive: true })
      return { resultText: `Created app folder: ${folderPath}` }
    }
    case 'builder__write_app_file': {
      const folderPath = args.folderPath
      if (!fs.existsSync(folderPath)) throw new Error('App folder not found')
      fs.writeFileSync(path.join(folderPath, args.filename), args.content, 'utf-8')
      return { resultText: `Wrote ${args.filename}` }
    }
    case 'builder__publish_app': {
      const folderPath = args.folderPath
      const manifestPath = path.join(folderPath, 'manifest.json')
      if (!fs.existsSync(manifestPath)) throw new Error('manifest.json not found')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      return { resultText: `Published app: ${manifest.id || 'unknown'}`, appId: manifest.id }
    }
    default:
      throw new Error(`Unknown builder tool: ${name}`)
  }
}
