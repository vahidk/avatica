import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'))
  } catch {
    return {}
  }
}

export function saveConfig(cfg: Record<string, unknown>): void {
  const dir = path.dirname(getConfigPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2))
}

export function isFirstLaunch(): boolean {
  const cfg = loadConfig()
  return !cfg.hasLaunched
}

export function markLaunched(): void {
  const cfg = loadConfig()
  cfg.hasLaunched = true
  saveConfig(cfg)
}
