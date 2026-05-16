export interface AssetTypeField {
  key: string
  type: 'text' | 'number' | 'boolean' | 'text-list' | 'file-reference' | 'key-value'
  required: boolean
}

export interface AssetTypeDefinition {
  id: string
  name: string
  extension: string
  icon: string
  thumbnail: string | null
  fields: AssetTypeField[]
}

function inferFieldType(prop: Record<string, unknown>): AssetTypeField['type'] {
  const type = prop.type as string
  if (type === 'number' || type === 'integer') return 'number'
  if (type === 'boolean') return 'boolean'
  if (type === 'array' && (prop.items as Record<string, unknown>)?.type === 'string') return 'text-list'
  if (type === 'object' && prop.additionalProperties) return 'key-value'
  if (type === 'string' && (prop.description as string)?.toLowerCase().includes('file')) return 'file-reference'
  return 'text'
}

function fieldTypeToSchema(type: AssetTypeField['type']): Record<string, unknown> {
  switch (type) {
    case 'text': return { type: 'string' }
    case 'number': return { type: 'number' }
    case 'boolean': return { type: 'boolean' }
    case 'text-list': return { type: 'array', items: { type: 'string' } }
    case 'file-reference': return { type: 'string', description: 'File reference ID' }
    case 'key-value': return { type: 'object', additionalProperties: true }
  }
}

export function schemaJsonToAssetType(json: string): AssetTypeDefinition {
  const data = JSON.parse(json)
  const properties = (data.properties || {}) as Record<string, Record<string, unknown>>
  const required = new Set<string>((data.required || []) as string[])

  const fields: AssetTypeField[] = Object.entries(properties).map(([key, prop]) => ({
    key,
    type: inferFieldType(prop),
    required: required.has(key),
  }))

  return {
    id: data.id || '',
    name: data.name || '',
    extension: data.extension || '',
    icon: data.icon || 'fa-solid fa-file',
    thumbnail: data.thumbnail || null,
    fields,
  }
}

export function assetTypeToSchemaJson(def: AssetTypeDefinition): string {
  const properties: Record<string, Record<string, unknown>> = {}
  const required: string[] = []

  for (const field of def.fields) {
    properties[field.key] = fieldTypeToSchema(field.type)
    if (field.required) required.push(field.key)
  }

  return JSON.stringify({
    id: def.id,
    name: def.name,
    extension: def.extension,
    icon: def.icon,
    thumbnail: def.thumbnail,
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }, null, 2)
}
