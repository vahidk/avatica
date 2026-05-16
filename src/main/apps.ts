import fs from 'node:fs'
import path from 'node:path'
import { getRootDir } from './projects'

export interface AppManifest {
  id: string
  name: string
  menu: string[]
  order?: number
  icon: string
  type: 'system' | 'custom'
  function: {
    description: string
    inputSchema: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

// In dev, apps are in the source tree. In production, they're in resources/apps.
export function getSystemAppsDir(): string {
  const devPath = path.join(__dirname, '../../src/renderer/src/apps/system')
  if (fs.existsSync(devPath)) return devPath
  return path.join(process.resourcesPath, 'apps')
}

function getCustomAppsDir(projectId: string): string {
  return path.join(getRootDir(), projectId, '.apps')
}

/** Resolve the directory for an app — checks system first, then project custom apps. */
function resolveAppDir(appId: string, projectId?: string): string | null {
  const sysPath = path.join(getSystemAppsDir(), appId)
  if (fs.existsSync(sysPath)) return sysPath
  if (projectId) {
    const customPath = path.join(getCustomAppsDir(projectId), appId)
    if (fs.existsSync(customPath)) return customPath
  }
  return null
}

let cachedManifests: AppManifest[] | null = null

export function listSystemApps(): AppManifest[] {
  if (cachedManifests) return cachedManifests
  const dir = getSystemAppsDir()
  if (!fs.existsSync(dir)) return []
  cachedManifests = fs.readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, 'manifest.json')))
    .map((d) => JSON.parse(fs.readFileSync(path.join(dir, d, 'manifest.json'), 'utf-8')))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
  return cachedManifests
}

export function listAllApps(projectId: string): AppManifest[] {
  const apps = [...listSystemApps()]
  const customDir = getCustomAppsDir(projectId)
  if (fs.existsSync(customDir)) {
    for (const d of fs.readdirSync(customDir)) {
      const manifestPath = path.join(customDir, d, 'manifest.json')
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
          manifest.type = 'custom'
          apps.push(manifest)
        } catch { /* skip malformed */ }
      }
    }
  }
  return apps
}

export function getAppViewHtml(appId: string, projectId?: string): string | null {
  const dir = resolveAppDir(appId, projectId)
  if (!dir) return null
  const viewPath = path.join(dir, 'view.html')
  if (!fs.existsSync(viewPath)) return null
  return fs.readFileSync(viewPath, 'utf-8')
}

export function getAppRunJs(appId: string, projectId?: string): string | null {
  const dir = resolveAppDir(appId, projectId)
  if (!dir) return null
  const runPath = path.join(dir, 'run.js')
  if (!fs.existsSync(runPath)) return null
  return fs.readFileSync(runPath, 'utf-8')
}

export function getAppEstimateJs(appId: string, projectId?: string): string | null {
  const dir = resolveAppDir(appId, projectId)
  if (!dir) return null
  const estimatePath = path.join(dir, 'estimate.js')
  if (!fs.existsSync(estimatePath)) return null
  return fs.readFileSync(estimatePath, 'utf-8')
}
