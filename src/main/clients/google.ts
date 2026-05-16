import { GoogleGenAI } from '@google/genai'
import { loadConfig } from '../config'

let cachedClient: GoogleGenAI | null = null
let cachedKey = ''

/** Lazy proxy — re-creates client when API key changes in settings. */
export const googleClient = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    const cfg = loadConfig()
    const key = (cfg.geminiApiKey as string) || ''
    if (!key) throw new Error('Gemini API key not configured. Open Settings to add it.')
    if (!cachedClient || cachedKey !== key) {
      cachedClient = new GoogleGenAI({ apiKey: key })
      cachedKey = key
    }
    const value = (cachedClient as any)[prop]
    return typeof value === 'function' ? value.bind(cachedClient) : value
  },
})
