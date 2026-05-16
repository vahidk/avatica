import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const avatica = {
  config: {
    get: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('config:get'),
    set: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke('config:set', key, value),
    getRootDir: (): Promise<string> => ipcRenderer.invoke('config:getRootDir'),
    setRootDir: (dir: string): Promise<string> => ipcRenderer.invoke('config:setRootDir', dir),
    chooseRootDir: (): Promise<string | null> => ipcRenderer.invoke('config:chooseRootDir'),
    isFirstLaunch: (): Promise<boolean> => ipcRenderer.invoke('config:isFirstLaunch'),
    markLaunched: (): Promise<void> => ipcRenderer.invoke('config:markLaunched'),
  },
  projects: {
    list: (): Promise<unknown[]> => ipcRenderer.invoke('projects:list'),
    create: (name: string): Promise<unknown> => ipcRenderer.invoke('projects:create', name),
    get: (id: string): Promise<unknown> => ipcRenderer.invoke('projects:get', id),
    rename: (id: string, name: string): Promise<unknown> => ipcRenderer.invoke('projects:rename', id, name),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('projects:delete', id)
  },
  files: {
    list: (pid: string, sub: string): Promise<unknown[]> => ipcRenderer.invoke('files:list', pid, sub),
    createFolder: (pid: string, sub: string, name: string): Promise<unknown> => ipcRenderer.invoke('files:createFolder', pid, sub, name),
    delete: (pid: string, sub: string, name: string): Promise<void> => ipcRenderer.invoke('files:delete', pid, sub, name),
    rename: (pid: string, sub: string, old: string, name: string): Promise<unknown> => ipcRenderer.invoke('files:rename', pid, sub, old, name),
    move: (pid: string, src: string, name: string, dest: string): Promise<void> => ipcRenderer.invoke('files:move', pid, src, name, dest),
    copy: (pid: string, sources: { path: string; name: string }[], dest: string): Promise<void> => ipcRenderer.invoke('files:copy', pid, sources, dest),
    import: (pid: string, sub: string, paths: string[]): Promise<unknown[]> => ipcRenderer.invoke('files:import', pid, sub, paths),
    openInExplorer: (pid: string, sub: string): Promise<void> => ipcRenderer.invoke('files:openInExplorer', pid, sub),
    getLocalPath: (pid: string, sub: string, name: string): Promise<string> => ipcRenderer.invoke('files:getLocalPath', pid, sub, name),
    readText: (pid: string, sub: string, name: string): Promise<string> => ipcRenderer.invoke('files:readText', pid, sub, name),
    writeText: (pid: string, sub: string, name: string, content: string): Promise<void> => ipcRenderer.invoke('files:writeText', pid, sub, name, content),
    thumbnail: (pid: string, sub: string, name: string, size?: number): Promise<string | null> => ipcRenderer.invoke('files:thumbnail', pid, sub, name, size || 200),
    pickNative: (accept: string, multiple: boolean): Promise<string[]> => ipcRenderer.invoke('files:pickNative', accept, multiple),
    watch: (pid: string): Promise<void> => ipcRenderer.invoke('files:watch', pid),
    unwatch: (pid: string): Promise<void> => ipcRenderer.invoke('files:unwatch', pid),
    onChanged: (callback: (event: { projectId: string }) => void): (() => void) => {
      const handler = (_e: any, event: { projectId: string }): void => callback(event)
      ipcRenderer.on('files:changed', handler)
      return () => ipcRenderer.removeListener('files:changed', handler)
    },
  },
  providers: {
    list: (capability: string): Promise<unknown[]> => ipcRenderer.invoke('providers:list', capability),
    estimate: (providerId: string, params: Record<string, unknown>): Promise<number> => ipcRenderer.invoke('providers:estimate', providerId, params)
  },
  schemas: {
    list: (): Promise<{ id: string; name: string; extension: string; icon: string }[]> => ipcRenderer.invoke('schemas:list'),
  },
  apps: {
    list: (pid: string): Promise<unknown[]> => ipcRenderer.invoke('apps:list', pid),
    viewHtml: (appId: string, pid?: string): Promise<string | null> => ipcRenderer.invoke('apps:viewHtml', appId, pid),
    run: (pid: string, appId: string, input: Record<string, unknown>): Promise<unknown> => ipcRenderer.invoke('apps:run', pid, appId, input),
    estimate: (appId: string, input: Record<string, unknown>, pid?: string): Promise<number | null> => ipcRenderer.invoke('apps:estimate', appId, input, pid)
  },
  usage: {
    total: (): Promise<number> => ipcRenderer.invoke('usage:total'),
    stats: (): Promise<{ total: number; count: number; byApp: Record<string, { count: number; cost: number }>; byProvider: Record<string, { count: number; cost: number }> }> => ipcRenderer.invoke('usage:stats'),
    reset: (): Promise<void> => ipcRenderer.invoke('usage:reset')
  },
  chat: {
    getMessages: (pid: string): Promise<unknown[]> => ipcRenderer.invoke('chat:getMessages', pid),
    send: (pid: string, projectName: string, message: string): Promise<void> => ipcRenderer.invoke('chat:send', pid, projectName, message),
    clear: (pid: string): Promise<void> => ipcRenderer.invoke('chat:clear', pid),
    onEvent: (callback: (event: unknown) => void): (() => void) => {
      const handler = (_e: any, event: unknown): void => callback(event)
      ipcRenderer.on('chat:event', handler)
      return () => ipcRenderer.removeListener('chat:event', handler)
    }
  },
  customApps: {
    listFolders: (pid: string): Promise<{ id: string; name: string }[]> => ipcRenderer.invoke('customApps:listFolders', pid),
    listFiles: (pid: string, appSlug: string): Promise<{ id: string; name: string; isDirectory: boolean }[]> => ipcRenderer.invoke('customApps:listFiles', pid, appSlug),
    readFile: (pid: string, appSlug: string, filename: string): Promise<string> => ipcRenderer.invoke('customApps:readFile', pid, appSlug, filename),
    writeFile: (pid: string, appSlug: string, filename: string, content: string): Promise<void> => ipcRenderer.invoke('customApps:writeFile', pid, appSlug, filename, content),
    scaffold: (pid: string, name: string): Promise<string> => ipcRenderer.invoke('customApps:scaffold', pid, name),
    delete: (pid: string, appSlug: string): Promise<void> => ipcRenderer.invoke('customApps:delete', pid, appSlug),
  },
  customSchemas: {
    list: (): Promise<{ id: string; name: string }[]> => ipcRenderer.invoke('customSchemas:list'),
    read: (schemaId: string): Promise<string> => ipcRenderer.invoke('customSchemas:read', schemaId),
    write: (schemaId: string, content: string): Promise<void> => ipcRenderer.invoke('customSchemas:write', schemaId, content),
    scaffold: (): Promise<string> => ipcRenderer.invoke('customSchemas:scaffold'),
    delete: (schemaId: string): Promise<void> => ipcRenderer.invoke('customSchemas:delete', schemaId),
  },
  onShowAbout: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('show-about', handler)
    return () => ipcRenderer.removeListener('show-about', handler)
  },
  onOpenSeqFile: (callback: (filePath: string) => void): (() => void) => {
    const handler = (_e: any, filePath: string): void => callback(filePath)
    ipcRenderer.on('open-seq-file', handler)
    return () => ipcRenderer.removeListener('open-seq-file', handler)
  },
}

// Listen for drop events to extract real file paths via webUtils (must run in preload context)
window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('drop', (e) => {
    e.preventDefault()
    if (!e.dataTransfer?.files.length) return
    const paths: string[] = []
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const p = webUtils.getPathForFile(e.dataTransfer.files[i])
      if (p) paths.push(p)
    }
    if (paths.length) {
      window.dispatchEvent(new CustomEvent('avatica:file-drop', { detail: { paths } }))
    }
  })
})

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('avatica', avatica)
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.avatica = avatica
}
