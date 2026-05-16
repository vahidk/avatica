import { useState, useRef, useCallback, useEffect } from 'react';
// Desktop: no i18n
import { Output, BufferTarget, Mp4OutputFormat, WebMOutputFormat, CanvasSource, AudioBufferSource, QUALITY_HIGH, canEncodeVideo, type VideoCodec } from 'mediabunny';
import { loadMediaElement, detectMediaType, renderFrame, type MediaEntry } from './PlaybackEngine';
import type { Sequence } from './types';

// Desktop: no API_URL
// Desktop: no toast

export interface ExportFormat {
  codec: VideoCodec;
  label: string;
  hint: string;
  ext: string;
  mime: string;
}

const ALL_FORMATS: ExportFormat[] = [
  { codec: 'avc', label: 'H.264', hint: 'Fast, universal', ext: 'mp4', mime: 'video/mp4' },
  { codec: 'hevc', label: 'HEVC', hint: 'Better quality, slower', ext: 'mp4', mime: 'video/mp4' },
  { codec: 'av1', label: 'AV1', hint: 'Best quality, slowest', ext: 'mp4', mime: 'video/mp4' },
  { codec: 'vp9', label: 'VP9', hint: 'Good quality', ext: 'webm', mime: 'video/webm' },
];

export function useExport(projectId: string, sequence: Sequence) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [availableFormats, setAvailableFormats] = useState<ExportFormat[]>([]);
  const cancelRef = useRef(false);

  // Detect available codecs on mount
  useEffect(() => {
    (async () => {
      const { width, height } = sequence.settings;
      const supported: ExportFormat[] = [];
      for (const fmt of ALL_FORMATS) {
        try {
          if (await canEncodeVideo(fmt.codec, { width, height })) {
            supported.push(fmt);
          }
        } catch { /* codec not available */ }
      }
      setAvailableFormats(supported);
    })();
  }, [sequence.settings]);

  const doExport = useCallback(async (format?: ExportFormat) => {
    const fmt = format || availableFormats[0];
    if (!fmt) return;

    setExporting(true);
    setProgress(0);
    cancelRef.current = false;

    const { width, height, fps } = sequence.settings;
    const totalDurationMs = Math.max(...sequence.tracks.flatMap(t => t.clips.map(c => c.start + c.duration)), 0);
    if (totalDurationMs <= 0) { setExporting(false); return; }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    // Load all media
    const mediaCache: Record<string, MediaEntry> = {};
    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        if (clip.kind !== 'media') continue;
        if (mediaCache[clip.fileId]) continue;
        try {
          const filePath = await window.avatica.files.getLocalPath(projectId, '', clip.fileId);
          const url = `file://${filePath}`;
          const mediaType = detectMediaType(clip.mimeType, track.type, url);
          mediaCache[clip.fileId] = await loadMediaElement(url, mediaType);
        } catch {
          // Skip clips whose source media cannot be resolved for export.
        }
      }
    }

    try {
      const isWebM = fmt.codec === 'vp9' || fmt.codec === 'vp8';
      const outputFormat = isWebM ? new WebMOutputFormat() : new Mp4OutputFormat();

      const output = new Output({
        format: outputFormat,
        target: new BufferTarget(),
      });

      const videoSource = new CanvasSource(canvas, {
        codec: fmt.codec,
        bitrate: QUALITY_HIGH,
      });
      output.addVideoTrack(videoSource);

      // Mix audio
      const sampleRate = 48000;
      const totalSamples = Math.ceil((totalDurationMs / 1000) * sampleRate);
      const audioCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

      for (const track of sequence.tracks) {
        if (track.disabled || track.muted) continue;
        for (const clip of track.clips) {
          if (clip.kind !== 'media') continue;
          const media = mediaCache[clip.fileId];
          if (!media || media.type === 'image') continue;
          try {
            const res = await fetch(media.element.src);
            const arrayBuf = await res.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            const gain = audioCtx.createGain();
            gain.gain.value = track.volume ?? 1;
            source.connect(gain).connect(audioCtx.destination);
            const trimIn = (clip.trimIn ?? 0) / 1000;
            source.start(clip.start / 1000, trimIn, clip.duration / 1000);
          } catch {
            // Continue exporting even if one audio clip fails to decode.
          }
        }
      }

      let mixedAudio: AudioBuffer | null = null;
      try { mixedAudio = await audioCtx.startRendering(); } catch { /* no audio */ }

      const audioCodec = isWebM ? 'opus' : 'aac';
      let audioSource: AudioBufferSource | null = null;
      if (mixedAudio) {
        audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: 128000 });
        output.addAudioTrack(audioSource);
      }

      await output.start();

      // Encode frame by frame
      const frameDuration = 1 / fps;
      const totalFrames = Math.ceil(totalDurationMs / 1000 * fps);

      for (let i = 0; i < totalFrames; i++) {
        if (cancelRef.current) break;

        const timeMs = i * (1000 / fps);

        // Seek video elements to correct position
        for (const track of sequence.tracks) {
          for (const clip of track.clips) {
            if (clip.kind !== 'media') continue;
            const media = mediaCache[clip.fileId];
            if (!media || media.type !== 'video') continue;
            const el = media.element as HTMLVideoElement;
            if (timeMs >= clip.start && timeMs < clip.start + clip.duration) {
              const trimIn = clip.trimIn ?? 0;
              const targetTime = (trimIn + (timeMs - clip.start)) / 1000;
              if (Math.abs(el.currentTime - targetTime) > 0.01) {
                el.currentTime = targetTime;
                await new Promise<void>(r => { el.onseeked = () => { el.onseeked = null; r(); }; setTimeout(r, 200); });
              }
            }
          }
        }

        renderFrame(ctx, sequence, mediaCache, timeMs, width, height);
        await videoSource.add(i / fps, frameDuration);

        setProgress((i + 1) / totalFrames);
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
      }

      if (audioSource && mixedAudio) {
        await audioSource.add(mixedAudio);
      }

      await output.finalize();

      if (!cancelRef.current) {
        const buffer = (output.target as BufferTarget).buffer;
        if (buffer) {
          const blob = new Blob([buffer], { type: fmt.mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `sequence-${Date.now()}.${fmt.ext}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch {
      console.error('Export failed');
    }

    setExporting(false);
    setProgress(0);
  }, [projectId, sequence, availableFormats]);

  const cancelExport = useCallback(() => { cancelRef.current = true; }, []);

  return { exporting, progress, doExport, cancelExport, availableFormats };
}
