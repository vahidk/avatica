import { googleClient } from '../clients'
import { loadConfig } from '../config'
import { pcmToWav } from '../utils/media'
import type {
  TextRequest, TextResult,
  ImageRequest, ImageResult,
  VideoRequest, VideoResult,
  AudioRequest, AudioResult,
  SpeechRequest, SpeechResult,
  TokenUsage,
} from './types'

function extractUsage(meta: any): TokenUsage | null {
  if (!meta) return null
  return {
    promptTokens: meta.promptTokenCount || 0,
    completionTokens: meta.candidatesTokenCount || 0,
    completionTokensDetails: meta.candidatesTokensDetails || undefined,
  }
}

/** Strip JSON Schema keywords that Gemini structured output doesn't support. */
function cleanSchemaForGemini(schema: unknown): unknown {
  return JSON.parse(JSON.stringify(schema, (key, value) => {
    if (key === 'default' || key === 'additionalProperties') return undefined
    return value
  }))
}

export async function googleText(req: TextRequest): Promise<TextResult> {
  const contents: { role: string; parts: { text: string }[] }[] = []
  for (const msg of req.history || []) {
    contents.push({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] })
  }
  contents.push({ role: 'user', parts: [{ text: req.prompt }] })

  const config = req.config ? { ...req.config } : undefined
  if (config?.responseSchema) {
    config.responseSchema = cleanSchemaForGemini(config.responseSchema)
  }

  const response = await googleClient.models.generateContent({
    model: req.model,
    config,
    contents,
  })

  return {
    text: response.candidates?.[0]?.content?.parts?.[0]?.text || '',
    usage: extractUsage(response.usageMetadata),
  }
}

export async function googleImage(req: ImageRequest): Promise<ImageResult> {
  const parts: any[] = [{ text: req.prompt }]

  // Source image for edit mode
  if (req.sourceImage) {
    parts.push({
      inlineData: {
        data: req.sourceImage.data.toString('base64'),
        mimeType: req.sourceImage.mimeType,
      },
    })
  }

  // Reference images for style guidance
  for (const img of req.referenceImages || []) {
    parts.push({
      inlineData: {
        data: img.data.toString('base64'),
        mimeType: img.mimeType,
      },
    })
  }

  const response = await googleClient.models.generateContent({
    model: req.model,
    config: {
      imageConfig: {
        aspectRatio: req.aspectRatio || undefined,
        imageSize: req.imageSize || '1K',
      },
      responseModalities: ['IMAGE', 'TEXT'],
    },
    contents: [{ role: 'user', parts }],
  })

  const resParts = response.candidates?.[0]?.content?.parts || []
  for (const part of resParts) {
    if (part.inlineData?.data) {
      return {
        buffer: Buffer.from(part.inlineData.data, 'base64'),
        mimeType: part.inlineData.mimeType || 'image/png',
        usage: extractUsage(response.usageMetadata),
      }
    }
  }
  throw new Error('No image generated')
}

function encodeImage(ref: { data: Buffer; mimeType: string }) {
  return { imageBytes: ref.data.toString('base64'), mimeType: ref.mimeType }
}

async function pollAndDownload(operation: any, durationSeconds: number, resolution: string): Promise<VideoResult> {
  const maxAttempts = 36
  for (let i = 0; i < maxAttempts && !operation.done; i++) {
    await new Promise(r => setTimeout(r, 10000))
    operation = await googleClient.operations.getVideosOperation({ operation })
  }
  if (!operation.done) throw new Error('Video generation timed out')

  const response = operation.response
  if (response?.raiMediaFilteredCount) {
    throw new Error(`Video blocked by safety filter (${response.raiMediaFilteredCount} filtered${response.raiMediaFilteredReasons?.length ? ': ' + response.raiMediaFilteredReasons.join(', ') : ''})`)
  }
  for (const generated of response?.generatedVideos || []) {
    if (!generated.video?.uri) continue
    const uri = generated.video.uri
    const sep = uri.includes('?') ? '&' : '?'
    const apiKey = (loadConfig().geminiApiKey as string) || ''
    const videoResponse = await fetch(`${uri}${sep}key=${apiKey}`)
    if (!videoResponse.ok) throw new Error(`Video download failed: ${videoResponse.status}`)
    const buffer = Buffer.from(await videoResponse.arrayBuffer())
    return { buffer, mimeType: 'video/mp4', durationSeconds, resolution }
  }
  throw new Error('No video generated')
}

export async function googleVideo(req: VideoRequest): Promise<VideoResult> {
  const resolution = req.resolution || '1080p'
  const durationSeconds = req.durationSeconds || 8

  const config: Record<string, unknown> = {
    numberOfVideos: 1,
    aspectRatio: req.aspectRatio || '16:9',
    resolution,
    durationSeconds,
  }

  const params: Record<string, unknown> = {
    model: req.model,
    prompt: req.prompt,
    config,
  }

  if (req.mode === 'interpolate') {
    if (req.startImage) params.image = encodeImage(req.startImage)
    if (req.endImage) config.lastFrame = encodeImage(req.endImage)
  } else if (req.mode === 'image_to_video') {
    if (req.startImage) params.image = encodeImage(req.startImage)
  } else if (req.mode === 'extend') {
    if (req.sourceVideo) {
      params.video = { videoBytes: req.sourceVideo.toString('base64'), mimeType: 'video/mp4' }
      config.resolution = '720p'
    }
  }

  // Reference images are supported by veo-3.1 and veo-3.1-fast, but not veo-3.1-lite
  // Also not supported with extend mode
  if (req.referenceImages && req.referenceImages.length > 0 && req.mode !== 'extend') {
    if (req.model.includes('lite')) {
      throw new Error('Reference images are not supported by veo-3.1-lite. Use veo-3.1-fast or veo-3.1 instead.')
    }
    config.referenceImages = req.referenceImages.map(img => ({
      referenceType: 'asset',
      image: encodeImage(img),
    }))
  }

  const operation = await googleClient.models.generateVideos(params as any)
  return pollAndDownload(operation, durationSeconds, resolution)
}

export async function googleAudio(req: AudioRequest): Promise<AudioResult> {
  const config: Record<string, unknown> = { responseModalities: ['audio'] }
  if (req.format === 'wav') config.responseMimeType = 'audio/wav'

  const response = await googleClient.models.generateContent({
    model: req.model,
    config,
    contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
  })

  const parts = response.candidates?.[0]?.content?.parts || []
  let audioBuffer: Buffer | null = null
  let mimeType = 'audio/mpeg'
  let lyrics = ''

  for (const part of parts) {
    if (part.inlineData?.data && !audioBuffer) {
      audioBuffer = Buffer.from(part.inlineData.data, 'base64')
      mimeType = part.inlineData.mimeType || 'audio/mpeg'
    } else if (part.text) {
      lyrics += (lyrics ? '\n' : '') + part.text
    }
  }

  if (!audioBuffer) throw new Error('No audio generated')

  return {
    buffer: audioBuffer,
    mimeType,
    lyrics: lyrics || undefined,
    usage: extractUsage(response.usageMetadata),
  }
}

const DEFAULT_SPEECH_VOICE = 'Zephyr'

export async function googleSpeech(req: SpeechRequest): Promise<SpeechResult> {
  let speechConfig: Record<string, unknown>
  if (req.multiSpeaker && req.multiSpeaker.length > 0) {
    speechConfig = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: req.multiSpeaker.map(s => ({
          speaker: s.speaker,
          voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } },
        })),
      },
    }
  } else {
    speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: req.voice || DEFAULT_SPEECH_VOICE },
      },
    }
  }

  const response = await googleClient.models.generateContent({
    model: req.model,
    config: {
      responseModalities: ['audio'],
      speechConfig,
      ...(req.languageCode ? { languageCode: req.languageCode } : {}),
    } as any,
    contents: [{ role: 'user', parts: [{ text: req.text }] }],
  })

  const resParts = response.candidates?.[0]?.content?.parts || []
  const audioParts: string[] = []
  let mimeType = ''
  for (const part of resParts) {
    if (part.inlineData?.data) {
      audioParts.push(part.inlineData.data)
      if (!mimeType) mimeType = part.inlineData.mimeType || ''
    }
  }

  if (audioParts.length === 0) throw new Error('No speech generated')

  const rawBuffer = Buffer.concat(audioParts.map(d => Buffer.from(d, 'base64')))
  const wavBuffer = pcmToWav(rawBuffer, mimeType)

  return {
    buffer: wavBuffer,
    mimeType: 'audio/wav',
    usage: extractUsage(response.usageMetadata),
  }
}
