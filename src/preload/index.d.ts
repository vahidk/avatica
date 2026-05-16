import { ElectronAPI } from '@electron-toolkit/preload'

interface Project {
  id: string
  name: string
  created_at: number
  updated_at: number
}

interface FileEntry {
  name: string
  isDirectory: boolean
  size: number
  mimeType: string | null
  modifiedAt: number
}

interface AvaticaAPI {
  config: {
    get(): Promise<Record<string, unknown>>
    set(key: string, value: unknown): Promise<void>
    getRootDir(): Promise<string>
    setRootDir(dir: string): Promise<string>
    chooseRootDir(): Promise<string | null>
    isFirstLaunch(): Promise<boolean>
    markLaunched(): Promise<void>
  }
  projects: {
    list(): Promise<Project[]>
    create(name: string): Promise<Project>
    get(id: string): Promise<Project | null>
    rename(id: string, name: string): Promise<Project | null>
    delete(id: string): Promise<void>
  }
  files: {
    list(pid: string, sub: string): Promise<FileEntry[]>
    createFolder(pid: string, sub: string, name: string): Promise<FileEntry>
    delete(pid: string, sub: string, name: string): Promise<void>
    rename(pid: string, sub: string, old: string, name: string): Promise<FileEntry>
    move(pid: string, src: string, name: string, dest: string): Promise<void>
    copy(pid: string, sources: { path: string; name: string }[], dest: string): Promise<void>
    import(pid: string, sub: string, paths: string[]): Promise<FileEntry[]>
    openInExplorer(pid: string, sub: string): Promise<void>
    getLocalPath(pid: string, sub: string, name: string): Promise<string>
    readText(pid: string, sub: string, name: string): Promise<string>
    writeText(pid: string, sub: string, name: string, content: string): Promise<void>
    thumbnail(pid: string, sub: string, name: string, size?: number): Promise<string | null>
    pickNative(accept: string, multiple: boolean): Promise<string[]>
    watch(pid: string): Promise<void>
    unwatch(pid: string): Promise<void>
    onChanged(callback: (event: { projectId: string }) => void): () => void
  }
  providers: {
    list(capability: string): Promise<{
      id: string; name: string; vendor: string;
      options: Record<string, { value: string; label: string }[]>;
      defaults: Record<string, string>
    }[]>
    estimate(providerId: string, params: Record<string, unknown>): Promise<number>
  }
  schemas: {
    list(): Promise<{ id: string; name: string; extension: string; icon: string; thumbnail?: string }[]>
  }
  apps: {
    list(pid: string): Promise<{
      id: string; name: string; menu: string[]; order?: number; icon: string
    }[]>
    viewHtml(appId: string, pid?: string): Promise<string | null>
    estimate(appId: string, input: Record<string, unknown>, pid?: string): Promise<number | null>
    run(pid: string, appId: string, input: Record<string, unknown>): Promise<{
      files: { id: string; name: string; path: string }[]
      totalCostUsd: number
      error?: string
    }>
  }
  usage: {
    total(): Promise<number>
    stats(): Promise<{ total: number; count: number; byApp: Record<string, { count: number; cost: number }>; byProvider: Record<string, { count: number; cost: number }> }>
    reset(): Promise<void>
  }
  chat: {
    getMessages(pid: string): Promise<{ role: string; content: string; toolCalls?: { name: string; args: any }[] }[]>
    send(pid: string, projectName: string, message: string): Promise<void>
    clear(pid: string): Promise<void>
    onEvent(callback: (event: { type: string; content?: string; name?: string; args?: any; result?: string; message?: string; appId?: string; fileIds?: string[] }) => void): () => void
  }
  customApps: {
    listFolders(pid: string): Promise<{ id: string; name: string }[]>
    listFiles(pid: string, appSlug: string): Promise<{ id: string; name: string; isDirectory: boolean }[]>
    readFile(pid: string, appSlug: string, filename: string): Promise<string>
    writeFile(pid: string, appSlug: string, filename: string, content: string): Promise<void>
    scaffold(pid: string, name: string): Promise<string>
    delete(pid: string, appSlug: string): Promise<void>
  }
  customSchemas: {
    list(): Promise<{ id: string; name: string }[]>
    read(schemaId: string): Promise<string>
    write(schemaId: string, content: string): Promise<void>
    scaffold(): Promise<string>
    delete(schemaId: string): Promise<void>
  }
  onShowAbout(callback: () => void): () => void
  onOpenSeqFile(callback: (filePath: string) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    avatica: AvaticaAPI
  }
}
