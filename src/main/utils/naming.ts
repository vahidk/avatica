/**
 * Asset naming — uses a lightweight LLM call to generate descriptive filenames.
 * Copied from webapp's utils/naming.ts.
 */

import { randomBytes } from 'node:crypto'
import { googleClient } from '../clients'
import { PROVIDERS, CAPABILITY_DEFAULTS } from '../providers'
import { loadPrompt } from '../prompts'

const NAMING_MODEL = PROVIDERS[CAPABILITY_DEFAULTS['text/generate']].model

/**
 * Generate a unique, descriptive asset name from a prompt using a lightweight LLM.
 * Always appends a 6-char random suffix so two generations from the same prompt
 * produce distinct filenames (e.g. "dragon-over-mountains-a3f4kx"). On LLM
 * failure or empty output, falls back to "${fallback}-${suffix}".
 */
export async function generateAssetName(prompt: string, fallback: string = 'asset'): Promise<string> {
  let stem = fallback
  try {
    const systemPrompt = loadPrompt('naming')
    const response = await googleClient.models.generateContent({
      model: NAMING_MODEL,
      config: { temperature: 0.3, maxOutputTokens: 20 },
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nContent: ${prompt}` }] },
      ],
    })

    const raw = response.text?.trim()
    if (raw) {
      const cleaned = raw
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 60)
      if (cleaned) stem = cleaned
    }
  } catch { /* fall through to fallback */ }

  return `${stem}-${randomBytes(3).toString('hex')}`
}
