/**
 * Syscalls — implementations of the `ai.*` and `file.*` calls available to a
 * sandbox app's run.js. Mirrors the structure of `backend/src/sandbox/syscalls.ts`
 * (the webapp counterpart). Unlike the webapp, there is no QuickJS marshalling
 * boundary on the desktop — these are just plain function calls.
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

import { PROVIDERS, CAPABILITY_DEFAULTS, capabilityDefaults, validateCapabilityParams } from './providers'
import { getTextAdapter, getImageAdapter, getVideoAdapter, getAudioAdapter, getSpeechAdapter } from './adapters'
import { generateAssetName } from './utils/naming'
import { mimeToExt, audioMimeToExt, loadReferenceImages } from './utils/media'
import { isSchemaExtension } from './schemas'

export interface SyscallContext {
  /** Absolute path to the project's directory on disk. */
  projectDir: string
  /** Tracker called whenever a paid provider call completes. */
  track(providerId: string, usage: { promptTokens?: number; completionTokens?: number } | null, params?: Record<string, any>): void
  /** Persist a generated buffer with a stem (no extension) and ext. Returns the final on-disk filename. */
  save(buffer: Buffer, assetName: string, ext: string): string
  /** Append a record to the run's generated-files list — used by fileSave for explicit-name writes. */
  recordGenerated(name: string, filePath: string): void
}

// ---- AI syscalls ----

export interface TextParams {
  prompt: string
  schema?: string | Record<string, unknown>
  provider?: string
  history?: { role: string; text: string }[]
}

export async function aiText(params: TextParams, ctx: SyscallContext): Promise<string> {
  const providerId = params.provider || CAPABILITY_DEFAULTS['text/generate']
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error(`Unknown provider: ${providerId}`)

  const config: Record<string, unknown> = {}
  if (params.schema) {
    config.responseMimeType = 'application/json'
    config.responseSchema = typeof params.schema === 'string' ? JSON.parse(params.schema) : params.schema
  }

  const result = await getTextAdapter(provider)({
    model: provider.model,
    prompt: params.prompt,
    history: params.history?.map(m => ({
      role: (m.role === 'model' || m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      text: m.text,
    })),
    config: Object.keys(config).length > 0 ? config : undefined,
  })

  if (result.usage) ctx.track(providerId, result.usage)
  return result.text
}

export interface ImageParams {
  prompt: string
  image?: string
  images?: string
  sourceImage?: string
  mode?: string
  aspectRatio?: string
  imageSize?: string
  provider?: string
}

export async function aiImage(params: ImageParams, ctx: SyscallContext): Promise<string> {
  const mode = params.mode === 'edit' ? 'edit' as const : 'generate' as const
  const capability = mode === 'edit' ? 'image/edit' : 'image/generate'
  const providerId = params.provider || CAPABILITY_DEFAULTS[capability] || CAPABILITY_DEFAULTS['image/generate']
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error(`Unknown provider: ${providerId}`)

  validateCapabilityParams(provider, capability, { aspectRatio: params.aspectRatio, imageSize: params.imageSize })

  const namePromise = generateAssetName(params.prompt, 'image')

  const sourceImage = (mode === 'edit' && (params.sourceImage || params.image))
    ? loadReferenceImages(ctx.projectDir, params.sourceImage || params.image)[0]
    : undefined

  const referenceImages = mode === 'generate'
    ? loadReferenceImages(ctx.projectDir, params.images || (params.image ? params.image : undefined))
    : undefined

  const result = await getImageAdapter(provider)({
    model: provider.model,
    prompt: params.prompt,
    referenceImages: referenceImages?.length ? referenceImages : undefined,
    sourceImage,
    mode,
    aspectRatio: params.aspectRatio,
    imageSize: params.imageSize || capabilityDefaults(provider, capability).imageSize,
  })

  ctx.track(providerId, result.usage)
  return ctx.save(result.buffer, await namePromise, mimeToExt(result.mimeType))
}

export async function aiVideo(p: any, ctx: SyscallContext): Promise<string> {
  const validModes = ['generate', 'image_to_video', 'interpolate', 'extend', 'edit'] as const
  const mode = validModes.includes(p.mode) ? p.mode : 'generate'
  const capabilityMap: Record<string, string> = {
    generate: 'video/generate',
    image_to_video: 'video/image_to_video',
    interpolate: 'video/interpolate',
    extend: 'video/extend',
    edit: 'video/edit',
  }
  const capability = capabilityMap[mode] || 'video/generate'
  // If the caller passed a provider hint, it must exist — don't silently fall back to the default.
  if (p.provider && !PROVIDERS[p.provider]) {
    throw new Error(`Unknown video provider: "${p.provider}"`)
  }
  const providerId = p.provider || CAPABILITY_DEFAULTS[capability] || CAPABILITY_DEFAULTS['video/generate']
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error(`Unknown video provider: ${providerId}`)

  validateCapabilityParams(provider, capability, {
    aspectRatio: p.aspectRatio,
    resolution: p.resolution,
    durationSeconds: p.duration,
  })

  const namePromise = generateAssetName(p.prompt, 'video')

  const referenceImages = (mode !== 'extend' && mode !== 'edit')
    ? loadReferenceImages(ctx.projectDir, p.images || (mode === 'generate' ? p.image : undefined))
    : undefined

  const startImage = (mode === 'image_to_video' || mode === 'interpolate')
    ? loadReferenceImages(ctx.projectDir, p.startImage || (mode === 'image_to_video' ? p.image : undefined))[0]
    : undefined
  const endImage = mode === 'interpolate'
    ? loadReferenceImages(ctx.projectDir, p.endImage)[0]
    : undefined

  let sourceVideo: Buffer | undefined
  if ((mode === 'extend' || mode === 'edit') && p.sourceVideo) {
    const videoPath = path.join(ctx.projectDir, p.sourceVideo)
    if (fs.existsSync(videoPath)) sourceVideo = fs.readFileSync(videoPath)
  }

  const result = await getVideoAdapter(provider)({
    model: provider.model,
    prompt: p.prompt,
    referenceImages: referenceImages?.length ? referenceImages : undefined,
    startImage,
    endImage,
    sourceVideo,
    mode,
    aspectRatio: p.aspectRatio,
    resolution: p.resolution,
    durationSeconds: p.duration,
  })

  ctx.track(providerId, null, { durationSeconds: result.durationSeconds, resolution: result.resolution })
  return ctx.save(result.buffer, await namePromise, 'mp4')
}

export async function aiAudio(p: any, ctx: SyscallContext): Promise<string> {
  const providerId = p.provider || CAPABILITY_DEFAULTS['audio/generate']
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error(`Unknown audio provider: ${providerId}`)

  validateCapabilityParams(provider, 'audio/generate', { format: p.format })

  const namePromise = generateAssetName(p.prompt, 'audio')
  const format = (p.format === 'wav' ? 'wav' : 'mp3') as 'mp3' | 'wav'
  const result = await getAudioAdapter(provider)({ model: provider.model, prompt: p.prompt, format })

  ctx.track(providerId, result.usage)
  const assetName = await namePromise
  const audioFileId = ctx.save(result.buffer, assetName, audioMimeToExt(result.mimeType))

  // Save lyrics as a separate file if present.
  if (result.lyrics) {
    ctx.save(Buffer.from(result.lyrics, 'utf-8'), `${assetName} - lyrics`, 'md')
  }

  return audioFileId
}

export async function aiSpeech(p: any, ctx: SyscallContext): Promise<string> {
  const providerId = p.provider || CAPABILITY_DEFAULTS['speech/generate']
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error(`Unknown speech provider: ${providerId}`)

  validateCapabilityParams(provider, 'speech/generate', { voice: p.voice, language: p.languageCode })

  const namePromise = generateAssetName(p.prompt, 'speech')
  const result = await getSpeechAdapter(provider)({
    model: provider.model,
    text: p.prompt,
    voice: p.voice,
    languageCode: p.languageCode,
  })

  ctx.track(providerId, result.usage)
  return ctx.save(result.buffer, await namePromise, result.mimeType === 'audio/wav' ? 'wav' : 'mp3')
}

// ---- File syscalls ----

export async function fileRead(fileId: string, ctx: SyscallContext): Promise<{ id: string; name: string; type: string; content?: string }> {
  const filePath = path.join(ctx.projectDir, fileId)
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${fileId}`)
  const ext = path.extname(fileId).toLowerCase()
  const isText = ['.json', '.txt', '.md', '.csv', '.seq', '.schema'].includes(ext) || isSchemaExtension(ext)
  return {
    id: fileId, name: fileId,
    type: isText ? 'text/plain' : 'application/octet-stream',
    content: isText ? fs.readFileSync(filePath, 'utf-8') : undefined,
  }
}

export async function fileList(ctx: SyscallContext): Promise<{ id: string; name: string; type: string }[]> {
  if (!fs.existsSync(ctx.projectDir)) return []
  return fs.readdirSync(ctx.projectDir)
    .filter(n => !n.startsWith('.'))
    .map(n => ({ id: n, name: n, type: 'application/octet-stream' }))
}

export function fileSave(data: string, params: { name: string; type?: string; schema?: string }, ctx: SyscallContext): string {
  let name = params.name
  // Disambiguate on collision so a duplicate name doesn't overwrite an existing file.
  if (fs.existsSync(path.join(ctx.projectDir, name))) {
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    name = `${stem}-${randomBytes(3).toString('hex')}${ext}`
  }
  const filePath = path.join(ctx.projectDir, name)
  fs.writeFileSync(filePath, Buffer.from(data, 'utf-8'))
  ctx.recordGenerated(name, filePath)
  return name
}
