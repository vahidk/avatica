export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  completionTokensDetails?: { modality: string; tokenCount: number }[]
}

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export interface TextRequest {
  model: string
  prompt: string
  history?: ChatMessage[]
  config?: Record<string, unknown>
}

export interface TextResult {
  text: string
  usage: TokenUsage | null
}

export interface ReferenceImage {
  data: Buffer
  mimeType: string
}

export interface ImageRequest {
  model: string
  prompt: string
  referenceImages?: ReferenceImage[]
  sourceImage?: ReferenceImage
  mode?: 'generate' | 'edit'
  aspectRatio?: string
  imageSize?: string
}

export interface ImageResult {
  buffer: Buffer
  mimeType: string
  usage: TokenUsage | null
}

export interface VideoRequest {
  model: string
  prompt: string
  referenceImages?: ReferenceImage[]
  startImage?: ReferenceImage
  endImage?: ReferenceImage
  sourceVideo?: Buffer
  mode?: 'generate' | 'image_to_video' | 'interpolate' | 'extend' | 'edit'
  aspectRatio?: string
  resolution?: string
  durationSeconds?: number
}

export interface VideoResult {
  buffer: Buffer
  mimeType: string
  durationSeconds: number
  resolution: string
}

export interface AudioRequest {
  model: string
  prompt: string
  format?: 'mp3' | 'wav'
}

export interface AudioResult {
  buffer: Buffer
  mimeType: string
  lyrics?: string
  usage: TokenUsage | null
}

export interface SpeechRequest {
  model: string
  text: string
  voice?: string
  languageCode?: string
  multiSpeaker?: { speaker: string; voice: string }[]
}

export interface SpeechResult {
  buffer: Buffer
  mimeType: string
  usage: TokenUsage | null
}

export interface TextAdapter {
  (req: TextRequest): Promise<TextResult>
}

export interface ImageAdapter {
  (req: ImageRequest): Promise<ImageResult>
}

export interface VideoAdapter {
  (req: VideoRequest): Promise<VideoResult>
}

export interface AudioAdapter {
  (req: AudioRequest): Promise<AudioResult>
}

export interface SpeechAdapter {
  (req: SpeechRequest): Promise<SpeechResult>
}
