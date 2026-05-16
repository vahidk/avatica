import type { Provider, CapabilityConfig, OptionEntry } from './types'

const opt = (v: string): OptionEntry => ({ value: v, label: v })

const grokImageOptions: CapabilityConfig = {
  options: {
    imageSize: [opt('1k'), opt('2k')],
    aspectRatio: [opt('1:1'), opt('16:9'), opt('9:16'), opt('4:3'), opt('3:4'), opt('3:2'), opt('2:3'), opt('2:1'), opt('1:2')],
  },
}

const grokVideoGenerate: CapabilityConfig = {
  options: {
    resolution: [opt('480p'), opt('720p')],
    aspectRatio: [opt('1:1'), opt('16:9'), opt('9:16'), opt('4:3'), opt('3:4'), opt('3:2'), opt('2:3')],
    durationSeconds: [
      { value: '1', label: '1s' }, { value: '2', label: '2s' }, { value: '4', label: '4s' },
      { value: '6', label: '6s' }, { value: '8', label: '8s' }, { value: '10', label: '10s' },
      { value: '12', label: '12s' }, { value: '15', label: '15s' },
    ],
  },
  defaults: { aspectRatio: '16:9', resolution: '480p', durationSeconds: 4 },
}

const grokVideoExtend: CapabilityConfig = {
  options: {
    durationSeconds: [
      { value: '2', label: '2s' }, { value: '4', label: '4s' },
      { value: '6', label: '6s' }, { value: '8', label: '8s' }, { value: '10', label: '10s' },
    ],
  },
  defaults: { durationSeconds: 4 },
}

const providers: Record<string, Provider> = {
  'grok-4.2': {
    vendor: 'xai',
    enabled: true,
    id: 'grok-4.2',
    name: 'Grok 4.2',
    capabilities: { 'text/generate': {} },
    model: 'grok-4.20-0309-non-reasoning',
    pricing: {
      type: 'token',
      token: { inputPer1M: 2.00, outputPer1M: 6.00 },
    },
  },
  'grok-image': {
    vendor: 'xai',
    enabled: true,
    id: 'grok-image',
    name: 'Grok Imagine',
    capabilities: { 'image/generate': grokImageOptions, 'image/edit': grokImageOptions },
    model: 'grok-imagine-image',
    pricing: {
      type: 'per_image',
      perImage: 0.02,
    },
  },
  'grok-image-pro': {
    vendor: 'xai',
    enabled: true,
    id: 'grok-image-pro',
    name: 'Grok Imagine Pro',
    capabilities: { 'image/generate': grokImageOptions, 'image/edit': grokImageOptions },
    model: 'grok-imagine-image-pro',
    pricing: {
      type: 'per_image',
      perImage: 0.07,
    },
  },
  'grok-tts': {
    vendor: 'xai',
    enabled: true,
    id: 'grok-tts',
    name: 'Grok TTS',
    capabilities: {
      'speech/generate': {
        options: {
          voice: [
            { value: 'eve', label: 'Eve' },
            { value: 'ara', label: 'Ara' },
            { value: 'rex', label: 'Rex' },
            { value: 'sal', label: 'Sal' },
            { value: 'leo', label: 'Leo' },
          ],
          language: [
            { value: 'auto', label: 'Auto' }, { value: 'en', label: 'English' },
            { value: 'es-ES', label: 'Spanish (Spain)' }, { value: 'es-MX', label: 'Spanish (Mexico)' },
            { value: 'fr', label: 'French' }, { value: 'de', label: 'German' },
            { value: 'it', label: 'Italian' }, { value: 'pt-BR', label: 'Portuguese (BR)' },
            { value: 'pt-PT', label: 'Portuguese (PT)' }, { value: 'ja', label: 'Japanese' },
            { value: 'ko', label: 'Korean' }, { value: 'zh', label: 'Chinese' },
            { value: 'hi', label: 'Hindi' }, { value: 'ru', label: 'Russian' },
            { value: 'tr', label: 'Turkish' }, { value: 'vi', label: 'Vietnamese' },
          ],
        },
        defaults: { voice: 'eve' },
      },
    },
    model: 'grok-tts',
    pricing: {
      type: 'token',
      token: { inputPer1M: 16.80, outputPer1M: 0 },
    },
  },
  'grok-video': {
    vendor: 'xai',
    enabled: true,
    id: 'grok-video',
    name: 'Grok Imagine',
    capabilities: {
      'video/generate': grokVideoGenerate,
      'video/image_to_video': grokVideoGenerate,
      'video/extend': grokVideoExtend,
      'video/edit': {},
    },
    model: 'grok-imagine-video',
    pricing: {
      type: 'video',
      video: { perSecond: { '480p': 0.05, '720p': 0.05 } },
    },
  },
}

export default providers
