import { useState, useEffect, useRef } from 'react'
import type { Sequence } from './types'

export interface ClipPreview {
  thumbnailUrl?: string
  waveform?: number[]
}

export function useClipPreviews(projectId: string, sequence: Sequence, _files?: any[]) {
  const [previews, setPreviews] = useState<Record<string, ClipPreview>>({})
  const loadingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        if (clip.kind !== 'media') continue
        if (loadingRef.current.has(clip.fileId)) continue
        loadingRef.current.add(clip.fileId)

        const mimePrefix = clip.mimeType?.split('/')[0]
        const isAudio = mimePrefix === 'audio' || (track.type === 'audio' && !mimePrefix)
        const isVideo = mimePrefix === 'video' || (track.type === 'video' && !mimePrefix)

        // Load thumbnail. nativeImage.createThumbnailFromPath (used by the IPC) works
        // reliably for images via QuickLook but is flaky for videos on macOS, so fall
        // back to client-side frame extraction when it returns nothing.
        if (isVideo || mimePrefix === 'image') {
          loadThumbnail(projectId, clip.fileId, isVideo).then(url => {
            if (url) setPreviews(prev => ({ ...prev, [clip.fileId]: { ...prev[clip.fileId], thumbnailUrl: url } }))
          })
        }

        // Load waveform for audio/video
        if (isAudio || isVideo) {
          loadWaveform(projectId, clip.fileId).then(waveform => {
            if (waveform) setPreviews(prev => ({ ...prev, [clip.fileId]: { ...prev[clip.fileId], waveform } }))
          })
        }
      }
    }
  }, [sequence, projectId])

  return previews
}

async function loadThumbnail(projectId: string, fileId: string, isVideo: boolean): Promise<string | null> {
  const native = await window.avatica.files.thumbnail(projectId, '', fileId)
  if (native) return native
  if (!isVideo) return null
  const filePath = await window.avatica.files.getLocalPath(projectId, '', fileId)
  return extractVideoFrame(`file://${filePath}`)
}

function extractVideoFrame(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'auto'
    video.src = url
    let settled = false
    const finish = (result: string | null): void => {
      if (settled) return
      settled = true
      video.src = ''
      resolve(result)
    }
    video.onloadeddata = () => { video.currentTime = 0.1 }
    video.onseeked = () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) return finish(null)
        const scale = Math.min(200 / w, 200 / h, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/webp', 0.9))
      } catch { finish(null) }
    }
    video.onerror = () => finish(null)
    setTimeout(() => finish(null), 5000)
  })
}

async function loadWaveform(projectId: string, fileId: string): Promise<number[] | null> {
  try {
    const filePath = await window.avatica.files.getLocalPath(projectId, '', fileId)
    const url = `file://${filePath}`

    const audioRes = await fetch(url)
    const buffer = await audioRes.arrayBuffer()

    const audioCtx = new AudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(buffer)
    audioCtx.close()

    const channelData = audioBuffer.getChannelData(0)
    const numPeaks = 1000
    const blockSize = Math.floor(channelData.length / numPeaks)
    const peaks: number[] = []

    for (let i = 0; i < numPeaks; i++) {
      let max = 0
      const start = i * blockSize
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(channelData[start + j] || 0)
        if (val > max) max = val
      }
      peaks.push(max)
    }

    const maxPeak = Math.max(...peaks, 0.01)
    return peaks.map(p => p / maxPeak)
  } catch {
    return null
  }
}
