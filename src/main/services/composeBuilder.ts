import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'crypto'
import { getRootDir } from '../projects'
import { listFiles } from '../files'

// ---- Tool definitions ----

export const COMPOSE_TOOLS = [
  {
    name: 'compose__write_sequence',
    description: 'Write a sequence (.seq) file in the project with tracks and clips. Creates or overwrites. Clips reference existing project files by filename.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Sequence name (e.g. "My Movie")' },
        width: { type: 'number', description: 'Video width in pixels (default: 1920)' },
        height: { type: 'number', description: 'Video height in pixels (default: 1080)' },
        fps: { type: 'number', description: 'Frames per second (default: 30)' },
        tracks: {
          type: 'array',
          description: 'Array of tracks. Each track has type, name, and clips.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Track type: "video" or "audio"' },
              name: { type: 'string', description: 'Track name (e.g. "Video 1")' },
              clips: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', description: 'Clip kind: "media" for files, "overlay" for text' },
                    fileId: { type: 'string', description: 'Filename (media clips only)' },
                    templateId: { type: 'string', description: 'Overlay template (overlay clips only)' },
                    vars: { type: 'object', description: 'Template variables (overlay clips only)' },
                    start: { type: 'number', description: 'Start time in milliseconds' },
                    duration: { type: 'number', description: 'Duration in milliseconds' },
                  },
                  required: ['kind', 'start', 'duration'],
                },
              },
            },
            required: ['type', 'name', 'clips'],
          },
        },
      },
      required: ['name', 'tracks'],
    },
  },
]

// ---- Tool execution ----

export function isComposeTool(name: string): boolean {
  return name.startsWith('compose__')
}

export function executeComposeTool(
  name: string,
  args: Record<string, any>,
  ctx: { projectId: string },
): { resultText: string; sequenceId?: string; fileIds?: string[] } {
  const projectDir = path.join(getRootDir(), ctx.projectId)

  switch (name) {
    case 'compose__write_sequence': {
      const sequence = {
        $schema: 'sequence.v1',
        settings: { width: args.width || 1920, height: args.height || 1080, fps: args.fps || 30 },
        tracks: (args.tracks || []).map((t: any) => ({
          id: randomUUID(),
          type: t.type,
          name: t.name,
          disabled: false,
          muted: false,
          volume: 1,
          clips: (t.clips || []).map((c: any) => {
            if (c.kind === 'overlay') {
              return { kind: 'overlay', id: randomUUID(), templateId: c.templateId, vars: c.vars || {}, start: c.start, duration: c.duration }
            }
            return { kind: 'media', id: randomUUID(), fileId: c.fileId, fileName: c.fileId, mimeType: '', start: c.start, duration: c.duration, trimIn: 0, trimOut: c.duration }
          }),
        })),
      }
      const rawName = args.name || 'Sequence'
      const fileName = rawName.endsWith('.seq') ? rawName : `${rawName}.seq`
      fs.writeFileSync(path.join(projectDir, fileName), JSON.stringify(sequence, null, 2), 'utf-8')
      return { resultText: `Created sequence "${fileName}" (${sequence.tracks.length} tracks)`, sequenceId: fileName, fileIds: [fileName] }
    }
    default:
      throw new Error(`Unknown compose tool: ${name}`)
  }
}

export function listProjectFiles(args: Record<string, any>, ctx: { projectId: string }): { resultText: string } {
  const files = listFiles(ctx.projectId, '')
    .filter(f => !f.isDirectory && f.name !== '.avatica.json')
    .filter(f => !args.type || (f.mimeType || '').startsWith(args.type))
    .slice(0, 100)
  if (files.length === 0) return { resultText: 'No files found in this project.' }
  const lines = files.map(f => `- "${f.name}" — fileId: "${f.name}" (${f.mimeType || 'unknown'})`)
  return { resultText: `Found ${files.length} file(s):\n${lines.join('\n')}` }
}

export function readProjectFile(args: Record<string, any>, ctx: { projectId: string }): { resultText: string } {
  const fileId = args.fileId
  if (!fileId) return { resultText: 'Error: fileId is required' }
  const projectDir = path.join(getRootDir(), ctx.projectId)
  const filePath = path.join(projectDir, fileId)
  if (!fs.existsSync(filePath)) return { resultText: `Error: file "${fileId}" not found` }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { resultText: content }
  } catch {
    return { resultText: `Error: could not read file "${fileId}"` }
  }
}
