import { xaiPost, xaiPostJson, xaiGet } from '../clients'
import { detectImageMimeType } from '../utils/media'
import type {
  TextRequest, TextResult,
  ImageRequest, ImageResult,
  VideoRequest, VideoResult,
  SpeechRequest, SpeechResult,
  TokenUsage,
} from './types'

// --- Text (OpenAI-compatible chat completions) ---

export async function xaiText(req: TextRequest): Promise<TextResult> {
  const messages: { role: string; content: string }[] = []
  for (const msg of req.history || []) {
    messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.text })
  }
  messages.push({ role: 'user', content: req.prompt })

  const body: any = {
    model: req.model,
    messages,
  }

  if (req.config?.responseMimeType === 'application/json' && req.config?.responseSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: req.config.responseSchema,
      },
    }
  }

  const data = await xaiPostJson('/chat/completions', body)

  const usage: TokenUsage | null = data.usage ? {
    promptTokens: data.usage.prompt_tokens || 0,
    completionTokens: data.usage.completion_tokens || 0,
  } : null

  return {
    text: data.choices?.[0]?.message?.content || '',
    usage,
  }
}

// --- Image ---

export async function xaiImage(req: ImageRequest): Promise<ImageResult> {
  // Collect any input images: a source image (edit mode) plus any reference
  // images (generate-with-references). xAI takes both via /images/edits — the
  // `image` field is a single object for one image or an array for multiple
  // (per the "Editing with Multiple Images" section, up to 5).
  const inputImages: { data: Uint8Array; mimeType: string }[] = []
  if (req.mode === 'edit' && req.sourceImage) inputImages.push(req.sourceImage)
  if (req.referenceImages?.length) inputImages.push(...req.referenceImages)

  if (inputImages.length > 0) {
    const wrap = (img: { data: Uint8Array; mimeType: string }) =>
      ({ url: encodeAsDataUri({ data: Buffer.from(img.data), mimeType: img.mimeType }), type: 'image_url' })

    const body: any = {
      model: req.model,
      prompt: req.prompt,
      image: inputImages.length === 1 ? wrap(inputImages[0]) : inputImages.map(wrap),
      response_format: 'b64_json',
    }
    if (req.aspectRatio) body.aspect_ratio = req.aspectRatio

    const data = await xaiPostJson('/images/edits', body)
    const entry = data.data?.[0]
    const imageData = entry?.b64_json
    if (!imageData) throw new Error('No image generated')
    const buffer = Buffer.from(imageData, 'base64')

    return { buffer, mimeType: detectImageMimeType(entry?.content_type, buffer), usage: null }
  }

  // Pure text-to-image (no inputs)
  const body: any = {
    model: req.model,
    prompt: req.prompt,
    n: 1,
    response_format: 'b64_json',
  }
  if (req.aspectRatio) body.aspect_ratio = req.aspectRatio
  if (req.imageSize) body.resolution = req.imageSize?.toLowerCase()

  const data = await xaiPostJson('/images/generations', body)
  const entry = data.data?.[0]
  const imageData = entry?.b64_json
  if (!imageData) throw new Error('No image generated')
  const buffer = Buffer.from(imageData, 'base64')

  return { buffer, mimeType: detectImageMimeType(entry?.content_type, buffer), usage: null }
}

// --- Video (async with polling) ---

function encodeAsDataUri(ref: { data: Buffer; mimeType: string }): string {
  return `data:${ref.mimeType};base64,${ref.data.toString('base64')}`
}

async function xaiPollVideo(requestId: string, durationSeconds: number, resolution: string): Promise<VideoResult> {
  const maxAttempts = 60
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 10000))

    const pollData = await xaiGet(`/videos/${requestId}`)

    if (pollData.status === 'failed') throw new Error('Video generation failed')
    if (pollData.status === 'expired') throw new Error('Video generation expired')
    if (pollData.status !== 'done') continue

    const videoUrl = pollData.video?.url
    if (!videoUrl) throw new Error('No video URL in response')

    const dl = await fetch(videoUrl)
    if (!dl.ok) throw new Error(`Video download failed: ${dl.status}`)
    const actualDuration = pollData.video?.duration || durationSeconds
    return { buffer: Buffer.from(await dl.arrayBuffer()), mimeType: 'video/mp4', durationSeconds: actualDuration, resolution }
  }
  throw new Error('Video generation timed out')
}

export async function xaiVideo(req: VideoRequest): Promise<VideoResult> {
  if (req.mode === 'interpolate') {
    throw new Error('Video interpolation is not supported by this provider. Please select a Google model.')
  }

  const durationSeconds = req.durationSeconds || 8
  const resolution = req.resolution || '480p'

  // Video editing — separate endpoint
  if (req.mode === 'edit') {
    if (!req.sourceVideo) throw new Error('Video editing requires a source video.')
    const body: any = {
      model: req.model,
      prompt: req.prompt,
      video: { url: encodeAsDataUri({ data: req.sourceVideo, mimeType: 'video/mp4' }) },
    }
    const submitData = await xaiPostJson('/videos/edits', body)
    const requestId = submitData.request_id
    if (!requestId) throw new Error('No video request_id returned')
    return xaiPollVideo(requestId, durationSeconds, resolution)
  }

  // Video extension — separate endpoint
  if (req.mode === 'extend') {
    if (!req.sourceVideo) throw new Error('Video extension requires a source video.')
    const body: any = {
      model: req.model,
      prompt: req.prompt,
      duration: durationSeconds,
      video: { url: encodeAsDataUri({ data: req.sourceVideo, mimeType: 'video/mp4' }) },
    }
    const submitData = await xaiPostJson('/videos/extensions', body)
    const requestId = submitData.request_id
    if (!requestId) throw new Error('No video request_id returned')
    return xaiPollVideo(requestId, durationSeconds, resolution)
  }

  // Standard generation (text-to-video, image-to-video, reference-to-video)
  const body: any = {
    model: req.model,
    prompt: req.prompt,
    duration: durationSeconds,
    resolution,
    aspect_ratio: req.aspectRatio || '16:9',
  }

  // Image-to-video: start frame becomes the first frame
  if (req.mode === 'image_to_video' && req.startImage) {
    body.image = { url: encodeAsDataUri(req.startImage), type: 'image_url' }
  }

  // Reference images: style guide without locking the first frame
  if (req.referenceImages && req.referenceImages.length > 0 && req.mode !== 'image_to_video') {
    body.reference_images = req.referenceImages.map(img => ({ url: encodeAsDataUri(img) }))
  }

  const submitData = await xaiPostJson('/videos/generations', body)
  const requestId = submitData.request_id
  if (!requestId) throw new Error('No video request_id returned')
  return xaiPollVideo(requestId, durationSeconds, resolution)
}

// --- Speech / TTS ---

export async function xaiSpeech(req: SpeechRequest): Promise<SpeechResult> {
  const response = await xaiPost('/tts', {
    text: req.text,
    voice_id: req.voice || 'eve',
    language: req.languageCode || 'auto',
  })

  const buffer = Buffer.from(await response.arrayBuffer())

  const usage: TokenUsage = {
    promptTokens: Math.ceil(req.text.length / 4),
    completionTokens: 0,
  }

  return { buffer, mimeType: 'audio/mp3', usage }
}
