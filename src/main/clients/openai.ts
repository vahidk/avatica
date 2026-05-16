import { loadConfig } from '../config'

const OPENAI_BASE = 'https://api.openai.com/v1'

function authHeader(): string {
  const cfg = loadConfig()
  const key = (cfg.openaiApiKey as string) || ''
  if (!key) throw new Error('OpenAI API key not configured. Open Settings to add it.')
  return `Bearer ${key}`
}

export async function openaiPostJson(path: string, body: Record<string, any>): Promise<any> {
  const response = await fetch(`${OPENAI_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI ${path} failed: ${response.status} ${err}`)
  }
  return response.json()
}

export async function openaiPostForm(path: string, form: FormData): Promise<any> {
  // Don't set Content-Type — fetch sets it with the multipart boundary automatically.
  const response = await fetch(`${OPENAI_BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': authHeader() },
    body: form,
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI ${path} failed: ${response.status} ${err}`)
  }
  return response.json()
}
