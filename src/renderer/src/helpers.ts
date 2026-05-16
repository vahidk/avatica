export function nameToGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const h1 = ((hash & 0xff) / 255) * 360
  const h2 = h1 + 40 + (((hash >> 8) & 0xff) / 255) * 30
  return `linear-gradient(135deg, hsl(${h1}, 70%, 55%), hsl(${h2}, 70%, 55%))`
}

export function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(1) + ' GB'
}

// Schema metadata keyed by file extension (with leading dot), populated from schemas:list IPC.
interface SchemaMeta { icon: string; thumbnailPath?: string; schemaId: string }
let schemaMap: Map<string, SchemaMeta> | null = null

export function setSchemaMap(map: Map<string, SchemaMeta>): void {
  schemaMap = map
}

function getSchemaMetaForFile(name: string): SchemaMeta | undefined {
  if (!schemaMap) return undefined
  const dot = name.lastIndexOf('.')
  if (dot < 0) return undefined
  return schemaMap.get(name.slice(dot))
}

export function getSchemaIconForFile(name: string): string | undefined {
  return getSchemaMetaForFile(name)?.icon
}

export function getSchemaThumbnailPathForFile(name: string): string | undefined {
  return getSchemaMetaForFile(name)?.thumbnailPath
}

export function isSchemaFile(name: string): boolean {
  return !!getSchemaMetaForFile(name)
}

/** Extension (with leading dot) for a given schema id, e.g. "character.v1" -> ".char". */
export function getExtensionForSchemaId(schemaId: string): string | undefined {
  if (!schemaMap) return undefined
  for (const [ext, meta] of schemaMap.entries()) {
    if (meta.schemaId === schemaId) return ext
  }
  return undefined
}

export function fileIcon(mime: string | null, name?: string): string {
  if (name) {
    const schemaIcon = getSchemaIconForFile(name)
    if (schemaIcon) return schemaIcon
  }
  if (name?.endsWith('.seq')) return 'fa-solid fa-film'
  if (!mime) return 'fa-solid fa-file'
  if (mime.startsWith('image/')) return 'fa-solid fa-image'
  if (mime.startsWith('video/')) return 'fa-solid fa-video'
  if (mime.startsWith('audio/')) return 'fa-solid fa-music'
  if (mime === 'application/json') return 'fa-solid fa-code'
  if (mime === 'application/pdf') return 'fa-solid fa-file-pdf'
  if (mime.startsWith('text/')) return 'fa-solid fa-file-lines'
  return 'fa-solid fa-file'
}
