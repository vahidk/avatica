import fs from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { getRootDir } from './projects'

const DEBOUNCE_MS = 150

interface Watch {
  watcher: fs.FSWatcher
  flushTimer: NodeJS.Timeout | null
}

const watches = new Map<string, Watch>()

function broadcast(projectId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('files:changed', { projectId })
  }
}

export function watchProject(projectId: string): void {
  if (watches.has(projectId)) return
  const dir = join(getRootDir(), projectId)
  if (!fs.existsSync(dir)) return

  let watcher: fs.FSWatcher
  try {
    watcher = fs.watch(dir, { recursive: true })
  } catch (err) {
    console.warn(`[file-watcher] failed to watch ${dir}:`, (err as Error).message)
    return
  }

  const entry: Watch = { watcher, flushTimer: null }
  watches.set(projectId, entry)

  watcher.on('change', () => {
    if (entry.flushTimer) return
    entry.flushTimer = setTimeout(() => {
      entry.flushTimer = null
      broadcast(projectId)
    }, DEBOUNCE_MS)
  })

  watcher.on('error', (err) => {
    console.warn(`[file-watcher] error for ${projectId}:`, err.message)
  })
}

export function unwatchProject(projectId: string): void {
  const entry = watches.get(projectId)
  if (!entry) return
  if (entry.flushTimer) clearTimeout(entry.flushTimer)
  try { entry.watcher.close() } catch { /* ignore */ }
  watches.delete(projectId)
}
