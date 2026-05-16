import type { Provider } from './types'
export type { Provider, OptionEntry, CapabilityConfig } from './types'

import googleProviders from './google'
import xaiProviders from './xai'
import openaiProviders from './openai'

export const PROVIDERS: Record<string, Provider> = {
  ...googleProviders,
  ...xaiProviders,
  ...openaiProviders,
}

export const CAPABILITY_DEFAULTS: Record<string, string> = {
  'text/generate': 'gemini-3.1-flash-lite',
  'audio/generate': 'lyria-3-pro',
  'speech/generate': 'gemini-3.1-flash-tts',
  'image/generate': 'gemini-3.1-flash-image',
  'image/edit': 'gemini-3.1-flash-image',
  'video/generate': 'veo-3.1-lite',
  'video/image_to_video': 'veo-3.1-lite',
  'video/interpolate': 'veo-3.1-fast',
  'video/extend': 'veo-3.1-fast',
}

export const IMAGE_OUTPUT_TOKENS: Record<string, number> = {
  '512': 750,
  '1K': 1117,
  '2K': 1683,
  '4K': 2517,
}

const COST_ESTIMATION_HEURISTICS = {
  tokenInputEstimate: 2000,
  tokenOutputEstimate: 4000,
}

/** Check if a provider supports a capability. */
export function hasCapability(provider: Provider, capability: string): boolean {
  return capability in provider.capabilities
}

/** Get the list of capability strings a provider supports. */
export function capabilityList(provider: Provider): string[] {
  return Object.keys(provider.capabilities)
}

/** Get defaults for a specific capability, or empty object. */
export function capabilityDefaults(provider: Provider, capability: string): Record<string, any> {
  return provider.capabilities[capability]?.defaults || {}
}

/** Get first defaults object found across all capabilities (for cost estimation fallbacks). */
function firstDefaults(provider: Provider): Record<string, any> {
  for (const cap of Object.values(provider.capabilities)) {
    if (cap.defaults) return cap.defaults
  }
  return {}
}

export function buildPricingContext() {
  return {
    usdToCredits: 1,
    capabilityDefaults: CAPABILITY_DEFAULTS,
    heuristics: COST_ESTIMATION_HEURISTICS,
    imageOutputTokens: IMAGE_OUTPUT_TOKENS,
    providers: PROVIDERS,
  }
}

export function estimateCostUsd(providerId: string, params: Record<string, any> = {}): number {
  const provider = PROVIDERS[providerId]
  if (!provider) return 0
  const p = provider.pricing
  const defaults = firstDefaults(provider)

  if (p.type === 'token') {
    const inputCost = (COST_ESTIMATION_HEURISTICS.tokenInputEstimate / 1_000_000) * p.token.inputPer1M
    if (p.token.imageOutputPer1M) {
      const imageSize = params.imageSize || defaults.imageSize || '1K'
      const outputTokens = IMAGE_OUTPUT_TOKENS[imageSize] || IMAGE_OUTPUT_TOKENS['1K']
      return inputCost + (outputTokens / 1_000_000) * p.token.imageOutputPer1M
    }
    return inputCost + (COST_ESTIMATION_HEURISTICS.tokenOutputEstimate / 1_000_000) * p.token.outputPer1M
  }
  if (p.type === 'video') {
    const seconds = params.durationSeconds || defaults.durationSeconds || 8
    const resolution = params.resolution || defaults.resolution || '1080p'
    return (p.video.perSecond[resolution] || Object.values(p.video.perSecond)[0] || 0) * seconds
  }
  if (p.type === 'per_image') {
    return p.perImage * (params.sampleCount || 1)
  }
  if (p.type === 'per_request') {
    return p.perRequest
  }
  return 0
}

export function actualCostUsd(
  providerId: string,
  usage: { promptTokens?: number; completionTokens?: number } | null,
  params?: Record<string, any>,
): number {
  const provider = PROVIDERS[providerId]
  if (!provider) return 0
  const p = provider.pricing
  const defaults = firstDefaults(provider)

  if (p.type === 'token' && usage) {
    const inputTokens = usage.promptTokens || 0
    const outputTokens = usage.completionTokens || 0
    const inputCost = (inputTokens / 1_000_000) * p.token.inputPer1M
    const outputRate = p.token.imageOutputPer1M || p.token.outputPer1M
    return inputCost + (outputTokens / 1_000_000) * outputRate
  }
  if (p.type === 'video' && params) {
    const seconds = params.durationSeconds || defaults.durationSeconds || 8
    const resolution = params.resolution || defaults.resolution || '1080p'
    return (p.video.perSecond[resolution] || Object.values(p.video.perSecond)[0] || 0) * seconds
  }
  if (p.type === 'per_image') {
    return p.perImage * (params?.sampleCount || 1)
  }
  if (p.type === 'per_request') {
    return p.perRequest
  }
  return estimateCostUsd(providerId, params || {})
}

/** Returns provider entries with options/defaults resolved for a specific capability. */
export function getProvidersForCapability(capability: string) {
  return Object.values(PROVIDERS)
    .filter(p => p.enabled !== false && hasCapability(p, capability))
    .map(p => {
      const config = p.capabilities[capability] || {}
      return {
        id: p.id,
        name: p.name,
        vendor: p.vendor,
        capabilities: p.capabilities,
        options: config.options || {},
        defaults: config.defaults || {},
        isDefault: CAPABILITY_DEFAULTS[capabilityList(p)[0]] === p.id,
      }
    })
}

export function getDefaultProvider(capability: string): Provider | undefined {
  return PROVIDERS[CAPABILITY_DEFAULTS[capability]]
}

/**
 * Validate params against the provider's capability constraints.
 * Throws a detailed error listing violations and valid alternatives.
 */
export function validateCapabilityParams(
  provider: Provider,
  capability: string,
  params: Record<string, unknown>,
): void {
  const config = provider.capabilities[capability]
  if (!config?.options) return

  const errors: string[] = []

  for (const [field, options] of Object.entries(config.options)) {
    const raw = params[field]
    if (raw === undefined || raw === null || raw === '') continue
    const value = String(raw)

    const option = options.find(o => o.value === value)
    if (!option) {
      const allowed = options.map(o => o.value).join(', ')
      errors.push(`${field}="${value}" is not a valid option for ${provider.id}. Allowed values: ${allowed}.`)
      continue
    }

    if (!option.requires) continue

    for (const [reqField, reqValues] of Object.entries(option.requires)) {
      const actual = String(params[reqField] ?? '')
      if (reqValues.includes(actual)) continue

      const alternatives = options
        .filter(o => !o.requires || !o.requires[reqField] || o.requires[reqField].includes(actual))
        .map(o => o.value)

      errors.push(
        `${field}="${value}" requires ${reqField} ∈ [${reqValues.join(', ')}], but ${reqField}="${actual}". ` +
        `Either set ${reqField} to one of [${reqValues.join(', ')}], ` +
        `or keep ${reqField}="${actual}" and use ${field} ∈ [${alternatives.join(', ') || '(no compatible options)'}].`,
      )
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid parameters for ${provider.id} (${capability}):\n${errors.join('\n')}`)
  }
}
