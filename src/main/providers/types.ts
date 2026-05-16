export interface OptionEntry {
  value: string
  label: string
  requires?: Record<string, string[]>
}

export interface CapabilityConfig {
  options?: Record<string, OptionEntry[]>
  defaults?: Record<string, any>
}

export interface Provider {
  id: string
  vendor: 'google' | 'xai' | 'openai'
  name: string
  capabilities: Record<string, CapabilityConfig>
  model: string
  pricing:
    | { type: 'token'; token: { inputPer1M: number; outputPer1M: number; imageOutputPer1M?: number } }
    | { type: 'video'; video: { perSecond: Record<string, number> } }
    | { type: 'per_image'; perImage: number }
    | { type: 'per_request'; perRequest: number }
  enabled?: boolean
}
