import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadConfig, saveConfig } from './config'

let ROOT_DIR = ''

function defaultRootDir(): string {
  // os.userInfo().homedir queries the OS user database (getpwuid) directly,
  // so it returns the real /Users/<name> even inside the MAS sandbox where
  // os.homedir() / $HOME would resolve to the app container.
  return path.join(os.userInfo().homedir, 'Movies', 'Avatica')
}

export function getRootDir(): string {
  if (ROOT_DIR) return ROOT_DIR
  const cfg = loadConfig()
  return (cfg.rootDir as string) || defaultRootDir()
}

/**
 * Resolve a root dir from config (or the sensible default) and verify the app
 * can create/read/write it. Returns false if creation or access fails — caller
 * should prompt the user to pick a different folder.
 */
export function initRootDir(): boolean {
  const cfg = loadConfig()
  const target = (cfg.rootDir as string) || defaultRootDir()
  try {
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true })
    fs.accessSync(target, fs.constants.R_OK | fs.constants.W_OK)
    ROOT_DIR = target
    return true
  } catch {
    return false
  }
}

export function setRootDir(dir: string): void {
  const cfg = loadConfig()
  cfg.rootDir = dir
  saveConfig(cfg)
  ROOT_DIR = dir
}

export interface Project {
  id: string
  name: string
  created_at: number
  updated_at: number
}

function readMeta(dir: string): Omit<Project, 'id'> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, dir, '.avatica.json'), 'utf-8'))
  } catch {
    return null
  }
}

export function listProjects(): Project[] {
  if (!fs.existsSync(ROOT_DIR)) return []
  return fs
    .readdirSync(ROOT_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      const meta = readMeta(e.name)
      if (!meta) return null
      const stat = fs.statSync(path.join(ROOT_DIR, e.name))
      return {
        id: e.name,
        name: meta.name || e.name,
        created_at: meta.created_at || stat.birthtimeMs,
        updated_at: meta.updated_at || stat.mtimeMs
      }
    })
    .filter((p): p is Project => p !== null)
    .sort((a, b) => b.updated_at - a.updated_at)
}

export function createProject(name: string): Project {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
  let dir = slug
  let i = 2
  while (fs.existsSync(path.join(ROOT_DIR, dir))) dir = `${slug}-${i++}`
  fs.mkdirSync(path.join(ROOT_DIR, dir), { recursive: true })
  const now = Date.now()
  const meta = { name, created_at: now, updated_at: now }
  fs.writeFileSync(path.join(ROOT_DIR, dir, '.avatica.json'), JSON.stringify(meta, null, 2))
  return { id: dir, ...meta }
}

export function getProject(id: string): Project | null {
  const meta = readMeta(id)
  return meta ? { id, ...meta } : null
}

export function renameProject(id: string, newName: string): Project | null {
  const metaPath = path.join(ROOT_DIR, id, '.avatica.json')
  const meta = readMeta(id)
  if (!meta) return null
  meta.name = newName
  meta.updated_at = Date.now()
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

  const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
  let newDir = newSlug
  let i = 2
  while (newDir !== id && fs.existsSync(path.join(ROOT_DIR, newDir))) newDir = `${newSlug}-${i++}`
  if (newDir !== id) fs.renameSync(path.join(ROOT_DIR, id), path.join(ROOT_DIR, newDir))
  return { id: newDir, ...meta }
}

export function deleteProject(id: string): void {
  const dir = path.join(ROOT_DIR, id)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}
