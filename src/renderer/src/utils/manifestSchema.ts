export interface ManifestParam {
  key: string
  type: 'text' | 'number' | 'boolean' | 'text-list'
  required: boolean
  description: string
}

export interface ManifestDefinition {
  id: string
  name: string
  menu: string[]
  icon: string
  description: string
  params: ManifestParam[]
}

const MENU_CATEGORIES = ['Image', 'Video', 'Audio', 'Character', 'Custom']

export { MENU_CATEGORIES }

function inferParamType(prop: Record<string, unknown>): ManifestParam['type'] {
  const type = prop.type as string
  if (type === 'number' || type === 'integer') return 'number'
  if (type === 'boolean') return 'boolean'
  if (type === 'array') return 'text-list'
  return 'text'
}

function paramTypeToSchema(type: ManifestParam['type']): Record<string, unknown> {
  switch (type) {
    case 'text': return { type: 'string' }
    case 'number': return { type: 'number' }
    case 'boolean': return { type: 'boolean' }
    case 'text-list': return { type: 'array', items: { type: 'string' } }
  }
}

export function manifestJsonToDefinition(json: string): ManifestDefinition {
  const data = JSON.parse(json)

  const fn = data.function || (data.functions?.[0]) || {}
  const inputSchema = fn.inputSchema as Record<string, unknown> | undefined
  const properties = (inputSchema?.properties || {}) as Record<string, Record<string, unknown>>
  const required = new Set<string>((inputSchema?.required || []) as string[])

  const params: ManifestParam[] = Object.entries(properties).map(([key, prop]) => ({
    key,
    type: inferParamType(prop),
    required: required.has(key),
    description: (prop.description as string) || '',
  }))

  return {
    id: data.id || '',
    name: data.name || '',
    menu: data.menu || ['Custom'],
    icon: data.icon || 'file',
    description: (fn.description as string) || '',
    params,
  }
}

export function manifestDefinitionToJson(def: ManifestDefinition): string {
  const properties: Record<string, Record<string, unknown>> = {}
  const required: string[] = []

  for (const param of def.params) {
    const schema = paramTypeToSchema(param.type)
    if (param.description) schema.description = param.description
    properties[param.key] = schema
    if (param.required) required.push(param.key)
  }

  return JSON.stringify({
    id: def.id,
    name: def.name,
    menu: def.menu,
    icon: def.icon,
    function: {
      description: def.description,
      inputSchema: {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    },
  }, null, 2)
}
