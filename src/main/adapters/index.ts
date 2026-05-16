import type { Provider } from '../providers'
import type { TextAdapter, ImageAdapter, VideoAdapter, AudioAdapter, SpeechAdapter } from './types'
import { googleText, googleImage, googleVideo, googleAudio, googleSpeech } from './google'
import { xaiText, xaiImage, xaiVideo, xaiSpeech } from './xai'
import { openaiImage } from './openai'

export type { TextRequest, TextResult } from './types'
export type { ImageRequest, ImageResult, ReferenceImage } from './types'
export type { VideoRequest, VideoResult } from './types'
export type { AudioRequest, AudioResult } from './types'
export type { SpeechRequest, SpeechResult } from './types'
export type { TokenUsage } from './types'

export function getTextAdapter(provider: Provider): TextAdapter {
  if (provider.vendor === 'xai') return xaiText
  return googleText
}

export function getImageAdapter(provider: Provider): ImageAdapter {
  if (provider.vendor === 'xai') return xaiImage
  if (provider.vendor === 'openai') return openaiImage
  return googleImage
}

export function getVideoAdapter(provider: Provider): VideoAdapter {
  if (provider.vendor === 'xai') return xaiVideo
  return googleVideo
}

export function getAudioAdapter(_provider: Provider): AudioAdapter {
  return googleAudio
}

export function getSpeechAdapter(provider: Provider): SpeechAdapter {
  if (provider.vendor === 'xai') return xaiSpeech
  return googleSpeech
}
