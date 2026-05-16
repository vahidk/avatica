/**
 * Schema registry — loads system schemas from bundled JSON files
 * and custom schemas from the user's .schemas directory.
 */

import fs from 'node:fs'
import path from 'node:path'
import { getRootDir } from './projects'

export interface SchemaInfo {
  id: string
  name: string
  extension: string
  icon: string
  /** Dotted path within the asset JSON whose value is the file ID of the thumbnail image (e.g. "references.front", "references.frame"). */
  thumbnail?: string
}

function getSystemSchemasDir(): string {
  const devPath = path.join(__dirname, '../../src/main/schemas')
  if (fs.existsSync(devPath)) return devPath
  return path.join(process.resourcesPath, 'schemas')
}

export function listSchemas(): SchemaInfo[] {
  const schemas: SchemaInfo[] = []

  // System schemas
  const sysDir = getSystemSchemasDir()
  if (fs.existsSync(sysDir)) {
    for (const f of fs.readdirSync(sysDir).filter(f => f.endsWith('.json'))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(sysDir, f), 'utf-8'))
        schemas.push({ id: data.id, name: data.name, extension: data.extension, icon: data.icon, thumbnail: data.thumbnail })
      } catch { /* skip malformed */ }
    }
  }

  // Custom schemas
  const customDir = path.join(getRootDir(), '.schemas')
  if (fs.existsSync(customDir)) {
    for (const f of fs.readdirSync(customDir).filter(f => f.endsWith('.schema'))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(customDir, f), 'utf-8'))
        schemas.push({ id: `custom:${data.id}`, name: data.name, extension: data.extension, icon: data.icon, thumbnail: data.thumbnail })
      } catch { /* skip */ }
    }
  }

  return schemas
}

/** Check if a file extension belongs to a known schema (i.e. the file is JSON text). */
export function isSchemaExtension(ext: string): boolean {
  return listSchemas().some(s => s.extension === ext)
}

/** Look up a schema's JSON schema definition by ID. Used by app runner's schema.get() syscall. */
export function lookupSchema(schemaId: string): Record<string, unknown> | null {
  // System schemas
  const sysDir = getSystemSchemasDir()
  if (fs.existsSync(sysDir)) {
    for (const f of fs.readdirSync(sysDir).filter(f => f.endsWith('.json'))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(sysDir, f), 'utf-8'))
        if (data.id === schemaId) return data.jsonSchema || null
      } catch { /* skip */ }
    }
  }

  // Custom schemas
  const customDir = path.join(getRootDir(), '.schemas')
  if (fs.existsSync(customDir)) {
    for (const f of fs.readdirSync(customDir).filter(f => f.endsWith('.schema'))) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(customDir, f), 'utf-8'))
        if (`custom:${data.id}` === schemaId || data.id === schemaId) {
          return { type: data.type, properties: data.properties, ...(data.required ? { required: data.required } : {}) }
        }
      } catch { /* skip */ }
    }
  }

  return null
}
