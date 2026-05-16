import fs from 'node:fs'
import path from 'node:path'
import { getRootDir } from './projects'

export interface FileEntry {
  name: string
  isDirectory: boolean
  size: number
  mimeType: string | null
  modifiedAt: number
}

function projectPath(projectId: string, ...parts: string[]): string {
  return path.join(getRootDir(), projectId, ...parts.filter(Boolean))
}

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.flac': 'audio/flac', '.aac': 'audio/aac',
  '.json': 'application/json', '.pdf': 'application/pdf',
  '.txt': 'text/plain', '.md': 'text/markdown',
  '.seq': 'application/x-avatica-sequence',
  '.char': 'application/x-avatica-character',
  '.scene': 'application/x-avatica-scene',
  '.obj': 'application/x-avatica-object',
  '.shot': 'application/x-avatica-shot',
  '.style': 'application/x-avatica-style',
  '.schema': 'application/x-avatica-schema'
}

function toEntry(fullPath: string, name: string): FileEntry {
  const stat = fs.statSync(fullPath)
  const isDir = stat.isDirectory()
  return {
    name,
    isDirectory: isDir,
    size: isDir ? 0 : stat.size,
    mimeType: isDir ? null : (MIME_MAP[path.extname(name).toLowerCase()] || 'application/octet-stream'),
    modifiedAt: stat.mtimeMs
  }
}

export function listFiles(projectId: string, subPath: string): FileEntry[] {
  const dir = projectPath(projectId, subPath)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((n) => !n.startsWith('.'))
    .map((n) => toEntry(path.join(dir, n), n))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export function createFolder(projectId: string, subPath: string, name: string): FileEntry {
  const dir = projectPath(projectId, subPath, name)
  fs.mkdirSync(dir, { recursive: true })
  return toEntry(dir, name)
}

export function deleteItem(projectId: string, subPath: string, name: string): void {
  fs.rmSync(projectPath(projectId, subPath, name), { recursive: true, force: true })
}

export function renameItem(projectId: string, subPath: string, oldName: string, newName: string): FileEntry {
  const src = projectPath(projectId, subPath, oldName)
  const dst = projectPath(projectId, subPath, newName)
  if (fs.existsSync(dst)) throw new Error('Name already exists')
  fs.renameSync(src, dst)
  return toEntry(dst, newName)
}

export function moveItem(projectId: string, srcPath: string, name: string, destPath: string): void {
  const src = projectPath(projectId, srcPath, name)
  const dst = projectPath(projectId, destPath, name)
  if (fs.existsSync(dst)) throw new Error('Name already exists at destination')
  const destDir = path.dirname(dst)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  fs.renameSync(src, dst)
}

export function copyFiles(projectId: string, sources: { path: string; name: string }[], destPath: string): void {
  for (const { path: srcPath, name } of sources) {
    fs.cpSync(projectPath(projectId, srcPath, name), projectPath(projectId, destPath, name), { recursive: true })
  }
}

export function importFiles(projectId: string, subPath: string, filePaths: string[]): FileEntry[] {
  return filePaths.map((fp) => {
    const name = path.basename(fp)
    const dst = projectPath(projectId, subPath, name)
    fs.cpSync(fp, dst, { recursive: true })
    return toEntry(dst, name)
  })
}
