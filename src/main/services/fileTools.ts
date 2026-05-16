import { listProjectFiles, readProjectFile } from './composeBuilder'

// ---- Tool declarations ----

export const FILE_TOOLS = [
  {
    name: 'file__read',
    description: 'Read the text content of a project file by file ID. Works with .md, .txt, .json, .char, .scene, .obj, .seq, and other text files.',
    parameters: {
      type: 'object',
      properties: { fileId: { type: 'string', description: 'File ID to read' } },
      required: ['fileId'],
    },
  },
  {
    name: 'file__list',
    description: 'List files in the current project. Returns file IDs, names, types, and durations.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by MIME type prefix (e.g. "video", "audio", "image"). Omit for all files.' },
      },
    },
  },
]

// ---- Tool execution ----

export function isFileTool(name: string): boolean {
  return name.startsWith('file__')
}

export function executeFileTool(
  name: string,
  args: Record<string, any>,
  ctx: { projectId: string },
): { resultText: string } {
  switch (name) {
    case 'file__read':
      return readProjectFile(args, ctx)
    case 'file__list':
      return listProjectFiles(args, ctx)
    default:
      throw new Error(`Unknown file tool: ${name}`)
  }
}
