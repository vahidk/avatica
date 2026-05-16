import type { Provider, CapabilityConfig, OptionEntry } from './types'

const opt = (v: string): OptionEntry => ({ value: v, label: v })
const dur = (v: string, req?: Record<string, string[]>): OptionEntry => ({ value: v, label: `${v}s`, ...(req ? { requires: req } : {}) })

const veoGenerate = (resolutions: OptionEntry[], defaultRes: string, defaultDur: number): CapabilityConfig => ({
  options: {
    resolution: resolutions,
    aspectRatio: [opt('16:9'), opt('9:16')],
    durationSeconds: [dur('4', { resolution: ['720p'] }), dur('6', { resolution: ['720p'] }), dur('8')],
  },
  defaults: { aspectRatio: '16:9', resolution: defaultRes, durationSeconds: defaultDur },
})

const veoExtend: CapabilityConfig = {
  options: {
    resolution: [opt('720p')],
    aspectRatio: [opt('16:9'), opt('9:16')],
    durationSeconds: [dur('8')],
  },
  defaults: { aspectRatio: '16:9', resolution: '720p', durationSeconds: 8 },
}

const providers: Record<string, Provider> = {
  'gemini-3.1-pro': {
    vendor: 'google',
    enabled: true,
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    capabilities: { 'text/generate': {} },
    model: 'gemini-3.1-pro-preview',
    pricing: {
      type: 'token',
      token: { inputPer1M: 2.00, outputPer1M: 12.00 },
    },
  },
  'gemini-3.1-flash-lite': {
    vendor: 'google',
    enabled: true,
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    capabilities: { 'text/generate': {} },
    model: 'gemini-3.1-flash-lite-preview',
    pricing: {
      type: 'token',
      token: { inputPer1M: 0.25, outputPer1M: 1.50 },
    },
  },
  'gemini-3.1-flash-image': {
    vendor: 'google',
    enabled: true,
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    capabilities: {
      'image/generate': {
        options: {
          imageSize: [opt('512'), opt('1K'), opt('2K'), opt('4K')],
          aspectRatio: [opt('1:1'), opt('1:4'), opt('1:8'), opt('2:3'), opt('3:2'), opt('3:4'), opt('4:1'), opt('4:3'), opt('4:5'), opt('5:4'), opt('8:1'), opt('9:16'), opt('16:9'), opt('21:9')],
        },
        defaults: { imageSize: '1K' },
      },
      'image/edit': {
        options: {
          imageSize: [opt('512'), opt('1K'), opt('2K'), opt('4K')],
          aspectRatio: [opt('1:1'), opt('1:4'), opt('1:8'), opt('2:3'), opt('3:2'), opt('3:4'), opt('4:1'), opt('4:3'), opt('4:5'), opt('5:4'), opt('8:1'), opt('9:16'), opt('16:9'), opt('21:9')],
        },
        defaults: { imageSize: '1K' },
      },
    },
    model: 'gemini-3.1-flash-image-preview',
    pricing: {
      type: 'token',
      token: { inputPer1M: 0.50, outputPer1M: 3.00, imageOutputPer1M: 60.00 },
    },
  },
  'lyria-3-clip': {
    vendor: 'google',
    enabled: true,
    id: 'lyria-3-clip',
    name: 'Lyria 3 Clip',
    capabilities: {
      'audio/generate': {
        options: { format: [opt('mp3'), opt('wav')] },
        defaults: { format: 'mp3' },
      },
    },
    model: 'lyria-3-clip-preview',
    pricing: {
      type: 'per_request',
      perRequest: 0.04,
    },
  },
  'lyria-3-pro': {
    vendor: 'google',
    enabled: true,
    id: 'lyria-3-pro',
    name: 'Lyria 3 Pro',
    capabilities: {
      'audio/generate': {
        options: { format: [opt('mp3'), opt('wav')] },
        defaults: { format: 'mp3' },
      },
    },
    model: 'lyria-3-pro-preview',
    pricing: {
      type: 'per_request',
      perRequest: 0.08,
    },
  },
  'gemini-3.1-flash-tts': {
    vendor: 'google',
    enabled: true,
    id: 'gemini-3.1-flash-tts',
    name: 'Gemini 3.1 TTS',
    capabilities: {
      'speech/generate': {
        options: {
          voice: [
            opt('Zephyr'), opt('Puck'), opt('Charon'), opt('Kore'), opt('Fenrir'),
            opt('Aoede'), opt('Leda'), opt('Orus'), opt('Callirrhoe'), opt('Autonoe'),
            opt('Enceladus'), opt('Iapetus'), opt('Umbriel'), opt('Algieba'), opt('Despina'),
            opt('Erinome'), opt('Algenib'), opt('Rasalgethi'), opt('Laomedeia'), opt('Achernar'),
            opt('Alnilam'), opt('Schedar'), opt('Gacrux'), opt('Pulcherrima'), opt('Achird'),
            opt('Zubenelgenubi'), opt('Vindemiatrix'), opt('Sadachbia'), opt('Sadaltager'), opt('Sulafat'),
          ],
          language: [
            { value: 'en', label: 'English' }, { value: 'fr', label: 'French' },
            { value: 'de', label: 'German' }, { value: 'es', label: 'Spanish' },
            { value: 'it', label: 'Italian' }, { value: 'pt', label: 'Portuguese' },
            { value: 'nl', label: 'Dutch' }, { value: 'ja', label: 'Japanese' },
            { value: 'ko', label: 'Korean' }, { value: 'zh', label: 'Chinese' },
            { value: 'hi', label: 'Hindi' }, { value: 'ar', label: 'Arabic' },
            { value: 'id', label: 'Indonesian' }, { value: 'pl', label: 'Polish' },
            { value: 'ro', label: 'Romanian' }, { value: 'el', label: 'Greek' },
            { value: 'fi', label: 'Finnish' }, { value: 'hu', label: 'Hungarian' },
          ],
        },
        defaults: { voice: 'Zephyr' },
      },
    },
    model: 'gemini-3.1-flash-tts-preview',
    pricing: {
      type: 'token',
      token: { inputPer1M: 1.00, outputPer1M: 20.00 },
    },
  },
  'veo-3.1-lite': {
    vendor: 'google',
    enabled: true,
    id: 'veo-3.1-lite',
    name: 'Veo 3.1 Lite',
    capabilities: {
      'video/generate': veoGenerate([opt('720p'), opt('1080p')], '720p', 4),
      'video/image_to_video': veoGenerate([opt('720p'), opt('1080p')], '720p', 4),
    },
    model: 'veo-3.1-lite-generate-preview',
    pricing: {
      type: 'video',
      video: { perSecond: { '720p': 0.05, '1080p': 0.08 } },
    },
  },
  'veo-3.1-fast': {
    vendor: 'google',
    enabled: true,
    id: 'veo-3.1-fast',
    name: 'Veo 3.1 Fast',
    capabilities: {
      'video/generate': veoGenerate([opt('720p'), opt('1080p'), opt('4k')], '720p', 8),
      'video/image_to_video': veoGenerate([opt('720p'), opt('1080p'), opt('4k')], '720p', 8),
      'video/interpolate': veoGenerate([opt('720p'), opt('1080p'), opt('4k')], '720p', 8),
      'video/extend': veoExtend,
    },
    model: 'veo-3.1-fast-generate-preview',
    pricing: {
      type: 'video',
      video: { perSecond: { '720p': 0.10, '1080p': 0.12, '4k': 0.30 } },
    },
  },
  'veo-3.1': {
    vendor: 'google',
    enabled: true,
    id: 'veo-3.1',
    name: 'Veo 3.1',
    capabilities: {
      'video/generate': veoGenerate([opt('720p'), opt('1080p'), opt('4k')], '720p', 8),
      'video/image_to_video': veoGenerate([opt('720p'), opt('1080p'), opt('4k')], '720p', 8),
      'video/interpolate': veoGenerate([opt('720p'), opt('1080p'), opt('4k')], '1080p', 8),
      'video/extend': veoExtend,
    },
    model: 'veo-3.1-generate-preview',
    pricing: {
      type: 'video',
      video: { perSecond: { '720p': 0.40, '1080p': 0.40, '4k': 0.60 } },
    },
  },
}

export default providers
