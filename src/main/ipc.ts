import { join } from 'path'
import fs from 'node:fs'
import { ipcMain, dialog, shell, nativeImage, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { loadConfig, saveConfig, isFirstLaunch, markLaunched } from './config'
import { getRootDir, setRootDir, listProjects, createProject, getProject, renameProject, deleteProject } from './projects'
import { listFiles, createFolder, deleteItem, renameItem, moveItem, copyFiles, importFiles } from './files'
import { watchProject, unwatchProject } from './file-watcher'
import { estimateCostUsd, getProvidersForCapability } from './providers'
import { getTotalUsageUsd, getUsageStats, resetUsage } from './usage'
import { listAllApps, getAppViewHtml, getAppEstimateJs } from './apps'
import { buildPricingContext } from './providers'
import { runApp } from './runner'
import { streamChat, getConversationMessages, clearConversation } from './services/chat'
import { listSchemas } from './schemas'
import {
  listCustomAppFolders, listCustomAppFiles, readCustomAppFile, writeCustomAppFile,
  scaffoldCustomApp, deleteCustomApp,
  listCustomSchemas, readCustomSchema, writeCustomSchema, scaffoldCustomSchema, deleteCustomSchema,
} from './services/custom-apps'

/**
 * Wrapper around ipcMain.handle that logs failures with channel + args context.
 * Re-throws so Electron surfaces the error to the renderer as a rejection.
 */
function handle<T>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: any[]) => T | Promise<T>,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...args)
    } catch (err: any) {
      console.error(`[ipc:${channel}] failed`, { args, error: err?.message, stack: err?.stack })
      throw err
    }
  })
}

export function registerIpcHandlers(): void {
  handle('config:get', () => loadConfig())
  handle('config:set', (_e, key: string, value: unknown) => {
    const cfg = loadConfig()
    cfg[key] = value
    saveConfig(cfg)
  })
  handle('config:isFirstLaunch', () => isFirstLaunch())
  handle('config:markLaunched', () => markLaunched())
  handle('config:resetOnboarding', () => {
    const cfg = loadConfig()
    delete cfg.hasLaunched
    saveConfig(cfg)
  })
  handle('config:getRootDir', () => getRootDir())
  handle('config:setRootDir', (_e, dir: string) => { setRootDir(dir); return dir })
  handle('config:chooseRootDir', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths.length) return null
    setRootDir(result.filePaths[0])
    return result.filePaths[0]
  })

  handle('projects:list', () => listProjects())
  handle('projects:create', (_e, name: string) => createProject(name))
  handle('projects:get', (_e, id: string) => getProject(id))
  handle('projects:rename', (_e, id: string, name: string) => renameProject(id, name))
  handle('projects:delete', (_e, id: string) => deleteProject(id))

  handle('files:list', (_e, pid: string, sub: string) => listFiles(pid, sub || ''))
  handle('files:createFolder', (_e, pid: string, sub: string, name: string) => createFolder(pid, sub || '', name))
  handle('files:delete', (_e, pid: string, sub: string, name: string) => deleteItem(pid, sub || '', name))
  handle('files:rename', (_e, pid: string, sub: string, old: string, name: string) => renameItem(pid, sub || '', old, name))
  handle('files:move', (_e, pid: string, src: string, name: string, dest: string) => moveItem(pid, src || '', name, dest || ''))
  handle('files:copy', (_e, pid: string, sources: { path: string; name: string }[], dest: string) => copyFiles(pid, sources, dest || ''))
  handle('files:import', (_e, pid: string, sub: string, paths: string[]) => importFiles(pid, sub || '', paths))
  handle('files:openInExplorer', (_e, pid: string, sub: string) => {
    shell.openPath(join(getRootDir(), pid, sub || ''))
  })
  handle('files:watch', (_e, pid: string) => watchProject(pid))
  handle('files:unwatch', (_e, pid: string) => unwatchProject(pid))

  // Providers
  handle('providers:list', (_e, capability: string) => getProvidersForCapability(capability))
  handle('providers:estimate', (_e, providerId: string, params: { imageSize?: string }) => estimateCostUsd(providerId, params))

  // Schemas
  handle('schemas:list', () => listSchemas())

  // Apps
  handle('apps:estimate', (_e, appId: string, input: Record<string, unknown>, pid?: string) => {
    const code = getAppEstimateJs(appId, pid)
    if (!code) return null
    try {
      const context = { input, pricing: buildPricingContext() }
      const fn = new Function('context', code)
      const result = fn(context)
      return typeof result === 'number' && Number.isFinite(result) ? result : null
    } catch {
      return null
    }
  })
  handle('apps:list', (_e, pid: string) => {
    const apps = listAllApps(pid)
    return apps
  })
  handle('apps:viewHtml', (_e, appId: string, pid?: string) => {
    return getAppViewHtml(appId, pid)
  })
  handle('apps:run', (_e, pid: string, appId: string, input: Record<string, unknown>) =>
    runApp({ projectId: pid, appId, input }),
  )

  // Usage
  handle('usage:total', () => getTotalUsageUsd())
  handle('usage:stats', () => getUsageStats())
  handle('usage:reset', () => resetUsage())

  // Chat
  handle('chat:getMessages', (_e, pid: string) => getConversationMessages(pid))
  handle('chat:clear', (_e, pid: string) => clearConversation(pid))
  handle('chat:send', async (e, pid: string, projectName: string, message: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    await streamChat(pid, projectName, message, (event) => {
      win?.webContents.send('chat:event', event)
    })
  })

  // Custom Apps
  handle('customApps:listFolders', (_e, pid: string) => listCustomAppFolders(pid))
  handle('customApps:listFiles', (_e, pid: string, appSlug: string) => listCustomAppFiles(pid, appSlug))
  handle('customApps:readFile', (_e, pid: string, appSlug: string, filename: string) => readCustomAppFile(pid, appSlug, filename))
  handle('customApps:writeFile', (_e, pid: string, appSlug: string, filename: string, content: string) => writeCustomAppFile(pid, appSlug, filename, content))
  handle('customApps:scaffold', (_e, pid: string, name: string) => scaffoldCustomApp(pid, name))
  handle('customApps:delete', (_e, pid: string, appSlug: string) => deleteCustomApp(pid, appSlug))

  // Custom Schemas
  handle('customSchemas:list', () => listCustomSchemas())
  handle('customSchemas:read', (_e, schemaId: string) => readCustomSchema(schemaId))
  handle('customSchemas:write', (_e, schemaId: string, content: string) => writeCustomSchema(schemaId, content))
  handle('customSchemas:scaffold', () => scaffoldCustomSchema())
  handle('customSchemas:delete', (_e, schemaId: string) => deleteCustomSchema(schemaId))

  handle('files:getLocalPath', (_e, pid: string, sub: string, name: string) => {
    return join(getRootDir(), pid, sub || '', name)
  })

  handle('files:getUrl', (_e, pid: string, sub: string, name: string) => {
    const relativePath = sub ? `${sub}/${name}` : name
    return `project://${pid}/${encodeURIComponent(relativePath)}`
  })

  handle('files:pickNative', async (_e, accept: string, multiple: boolean) => {
    const filters: { name: string; extensions: string[] }[] = []
    if (accept.includes('image')) filters.push({ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] })
    else if (accept.includes('video')) filters.push({ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] })
    else if (accept.includes('audio')) filters.push({ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac'] })
    else filters.push({ name: 'All Files', extensions: ['*'] })

    const result = await dialog.showOpenDialog({
      properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters,
    })
    if (result.canceled) return []
    return result.filePaths
  })

  handle('files:readText', (_e, pid: string, sub: string, name: string) => {
    const filePath = join(getRootDir(), pid, sub || '', name)
    return fs.readFileSync(filePath, 'utf-8')
  })

  handle('files:writeText', (_e, pid: string, sub: string, name: string, content: string) => {
    const dir = join(getRootDir(), pid, sub || '')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(join(dir, name), content, 'utf-8')
  })

  handle('files:thumbnail', async (_e, pid: string, sub: string, name: string, size: number) => {
    const filePath = join(getRootDir(), pid, sub || '', name)
    try {
      const image = await nativeImage.createThumbnailFromPath(filePath, { width: size, height: size })
      if (!image.isEmpty()) return image.toDataURL()
    } catch { /* no thumbnail available */ }
    return null
  })
}
