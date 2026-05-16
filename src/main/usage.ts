import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

interface UsageEntry {
  timestamp: number
  appId: string
  providerId: string
  costUsd: number
}

function getUsagePath(): string {
  return path.join(app.getPath('userData'), 'usage.json')
}

function loadUsage(): UsageEntry[] {
  try {
    return JSON.parse(fs.readFileSync(getUsagePath(), 'utf-8'))
  } catch {
    return []
  }
}

function saveUsage(entries: UsageEntry[]): void {
  fs.writeFileSync(getUsagePath(), JSON.stringify(entries))
}

export function recordUsage(appId: string, providerId: string, costUsd: number): void {
  const entries = loadUsage()
  entries.push({ timestamp: Date.now(), appId, providerId, costUsd })
  saveUsage(entries)
}

export function getTotalUsageUsd(): number {
  return loadUsage().reduce((sum, e) => sum + e.costUsd, 0)
}

export function getUsageEntries(): UsageEntry[] {
  return loadUsage()
}

export function getUsageStats(): { total: number; count: number; byApp: Record<string, { count: number; cost: number }>; byProvider: Record<string, { count: number; cost: number }> } {
  const entries = loadUsage()
  const byApp: Record<string, { count: number; cost: number }> = {}
  const byProvider: Record<string, { count: number; cost: number }> = {}
  for (const e of entries) {
    byApp[e.appId] = byApp[e.appId] || { count: 0, cost: 0 }
    byApp[e.appId].count++
    byApp[e.appId].cost += e.costUsd
    byProvider[e.providerId] = byProvider[e.providerId] || { count: 0, cost: 0 }
    byProvider[e.providerId].count++
    byProvider[e.providerId].cost += e.costUsd
  }
  return { total: entries.reduce((s, e) => s + e.costUsd, 0), count: entries.length, byApp, byProvider }
}

export function resetUsage(): void {
  saveUsage([])
}
