/**
 * Media utilities — format detection, conversion, reference image loading.
 */

import fs from 'node:fs'
import path from 'node:path'

// ---- MIME / format detection ----

export function detectImageMimeType(contentType: string | undefined, buffer: Buffer): string {
  if (contentType && contentType.startsWith('image/')) return contentType
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  return 'image/png'
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function mimeToExt(mimeType: string, fallback = 'png'): string {
  return MIME_TO_EXT[mimeType] || fallback
}

export function audioMimeToExt(mimeType: string): string {
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'mp3'
}

// ---- PCM → WAV conversion ----

export function pcmToWav(rawBuffer: Buffer, mimeType: string): Buffer {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim())
  const [, format] = fileType.split('/')
  let sampleRate = 24000
  let bitsPerSample = 16
  if (format?.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10)
    if (!isNaN(bits)) bitsPerSample = bits
  }
  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim())
    if (key === 'rate') sampleRate = parseInt(value, 10)
  }
  const byteRate = sampleRate * 1 * bitsPerSample / 8
  const blockAlign = 1 * bitsPerSample / 8
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + rawBuffer.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(rawBuffer.length, 40)
  return Buffer.concat([header, rawBuffer])
}

// ---- Reference image loading ----

export function loadReferenceImages(projectDir: string, images?: string): { data: Buffer; mimeType: string }[] {
  if (!images) return []
  return images.split(',').map(s => s.trim()).filter(Boolean).map(fileId => {
    const filePath = path.join(projectDir, fileId)
    if (!fs.existsSync(filePath)) return null
    const data = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    return { data, mimeType: mime }
  }).filter(Boolean) as { data: Buffer; mimeType: string }[]
}
