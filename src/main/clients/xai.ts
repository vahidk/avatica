import { loadConfig } from '../config'

const XAI_BASE = 'https://api.x.ai/v1'

function headers(): Record<string, string> {
  const cfg = loadConfig()
  const key = (cfg.xaiApiKey as string) || ''
  if (!key) throw new Error('xAI API key not configured. Open Settings to add it.')
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

export async function xaiPost(path: string, body: Record<string, any>): Promise<Response> {
  const response = await fetch(`${XAI_BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`xAI ${path} failed: ${response.status} ${err}`)
  }
  return response
}

export async function xaiPostJson(path: string, body: Record<string, any>): Promise<any> {
  return (await xaiPost(path, body)).json()
}

export async function xaiGet(path: string): Promise<any> {
  const response = await fetch(`${XAI_BASE}${path}`, {
    method: 'GET',
    headers: headers(),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`xAI ${path} failed: ${response.status} ${err}`)
  }
  return response.json()
}
