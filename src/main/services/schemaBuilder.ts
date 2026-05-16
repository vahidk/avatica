import fs from 'node:fs'
import path from 'node:path'
import { getRootDir } from '../projects'

// ---- Tool definitions ----

export const SCHEMA_TOOLS = [
  {
    name: 'schema__create_schema',
    description: 'Create a custom asset type (schema) that defines a structured data format for project files.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique ID, lowercase with underscores' },
        name: { type: 'string', description: 'Display name' },
        extension: { type: 'string', description: 'File extension including dot (e.g. ".char")' },
        icon: { type: 'string', description: 'FontAwesome class' },
        properties: { type: 'object', description: 'JSON Schema properties object' },
        required: { type: 'array', items: { type: 'string' }, description: 'Required property names' },
      },
      required: ['id', 'name', 'extension', 'properties'],
    },
  },
]

// ---- Tool execution ----

export function isSchemaTool(name: string): boolean {
  return name.startsWith('schema__')
}

export function executeSchemaTool(
  name: string,
  args: Record<string, any>,
): { resultText: string; schemasUpdated?: boolean } {
  switch (name) {
    case 'schema__create_schema': {
      const schemaContent = {
        id: args.id,
        name: args.name,
        extension: args.extension,
        icon: args.icon || 'fa-solid fa-file',
        thumbnail: null,
        type: 'object',
        properties: args.properties || {},
        ...(args.required?.length ? { required: args.required } : {}),
      }
      const fileName = `${args.id}.schema`
      const schemasDir = path.join(getRootDir(), '.schemas')
      if (!fs.existsSync(schemasDir)) fs.mkdirSync(schemasDir, { recursive: true })
      fs.writeFileSync(path.join(schemasDir, fileName), JSON.stringify(schemaContent, null, 2), 'utf-8')
      return { resultText: `Created schema "${args.name}" (custom:${args.id}) with extension ${args.extension}`, schemasUpdated: true }
    }
    default:
      throw new Error(`Unknown schema tool: ${name}`)
  }
}
