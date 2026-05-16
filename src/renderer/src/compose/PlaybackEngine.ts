import type { Sequence, MediaClip } from './types';
import { renderOverlay } from './overlays/renderer';
// Desktop: resolve file URLs via IPC instead of API

const UI_UPDATE_INTERVAL = 50;

export interface MediaEntry {
  url: string;
  element: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
  type: 'video' | 'audio' | 'image';
  duration?: number;
}

export type MediaType = 'video' | 'audio' | 'image';

export function detectMediaType(mimeType: string | undefined, trackType: string, url?: string): MediaType {
  const prefix = mimeType?.split('/')[0];
  if (prefix === 'image') return 'image';
  if (prefix === 'audio') return 'audio';
  if (prefix === 'video') return 'video';
  if (url) {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
    if (ext && ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) return 'audio';
  }
  return trackType === 'audio' ? 'audio' : 'video';
}

export function loadMediaElement(url: string, type: MediaType): Promise<MediaEntry> {
  return new Promise((resolve, reject) => {
    if (type === 'video') {
      const el = document.createElement('video');
      // No crossOrigin for file:// URLs
      el.preload = 'auto';
      el.muted = true;
      el.src = url;
      el.onloadedmetadata = () => resolve({ url, element: el, type, duration: el.duration * 1000 });
      el.onerror = () => reject(new Error('Failed to load video'));
    } else if (type === 'audio') {
      const el = document.createElement('audio');
      // No crossOrigin for file:// URLs
      el.preload = 'auto';
      el.src = url;
      el.onloadedmetadata = () => resolve({ url, element: el, type, duration: el.duration * 1000 });
      el.onerror = () => reject(new Error('Failed to load audio'));
    } else {
      const el = new Image();
      // No crossOrigin for file:// URLs
      el.src = url;
      el.onload = () => resolve({ url, element: el, type });
      el.onerror = () => reject(new Error('Failed to load image'));
    }
  });
}

export async function preloadMedia(projectId: string, sequence: Sequence, cache: Record<string, MediaEntry>): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      if (clip.kind !== 'media') continue;
      if (cache[clip.fileId]) continue;
      const mediaClip = clip;
      promises.push(
        (async () => {
          const filePath = await window.avatica.files.getLocalPath(projectId, '', mediaClip.fileId);
          const url = `file://${filePath}`;
          const mediaType = detectMediaType(mediaClip.mimeType, track.type, url);
          cache[mediaClip.fileId] = await loadMediaElement(url, mediaType);
        })().catch(() => {})
      );
    }
  }
  await Promise.all(promises);
}

function drawMedia(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  media: MediaEntry, width: number, height: number,
) {
  if (media.type === 'video') {
    const v = media.element as HTMLVideoElement;
    try {
      const vw = v.videoWidth || width;
      const vh = v.videoHeight || height;
      const s = Math.min(width / vw, height / vh);
      ctx.drawImage(v, (width - vw * s) / 2, (height - vh * s) / 2, vw * s, vh * s);
    } catch { /* frame not ready */ }
  } else if (media.type === 'image') {
    const img = media.element as HTMLImageElement;
    const iw = img.naturalWidth || width;
    const ih = img.naturalHeight || height;
    const s = Math.min(width / iw, height / ih);
    ctx.drawImage(img, (width - iw * s) / 2, (height - ih * s) / 2, iw * s, ih * s);
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sequence: Sequence,
  cache: Record<string, MediaEntry>,
  timeMs: number,
  width: number,
  height: number,
) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Render bottom-to-top so the topmost track in the UI renders last (on top)
  for (let i = sequence.tracks.length - 1; i >= 0; i--) {
    const track = sequence.tracks[i];
    if (track.disabled || track.type === 'audio') continue;
    for (const clip of track.clips) {
      if (timeMs < clip.start || timeMs >= clip.start + clip.duration) continue;
      if (clip.kind === 'media') {
        const media = cache[clip.fileId];
        if (media) drawMedia(ctx, media, width, height);
      } else if (clip.kind === 'overlay') {
        renderOverlay(ctx as CanvasRenderingContext2D, clip, timeMs, width, height);
      }
    }
  }
}

function forEachMediaClip(sequence: Sequence, fn: (clip: MediaClip, track: typeof sequence.tracks[0]) => void) {
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      if (clip.kind === 'media') fn(clip, track);
    }
  }
}

export class PlaybackEngine {
  canvas: HTMLCanvasElement | null = null;
  mediaCache: Record<string, MediaEntry> = {};
  sequence: Sequence;
  currentTimeMs = 0;
  playing = false;
  animFrame = 0;
  private lastFrameTime = 0;
  private lastUiUpdate = 0;
  private seekCounter = 0;
  private playGeneration = 0;

  onTimeUpdate: (ms: number) => void = () => {};
  onPlayingChange: (p: boolean) => void = () => {};

  constructor(sequence: Sequence) {
    this.sequence = sequence;
  }

  renderCurrentFrame(timeMs: number) {
    const canvas = this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.sequence.settings;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    renderFrame(ctx, this.sequence, this.mediaCache, timeMs, width, height);
  }

  /**
   * Start/stop media elements and keep them in sync.
   * Chrome: re-seek when drift exceeds threshold (smooth, hardware-accelerated).
   * Safari/other: let elements play freely to avoid choppiness.
   */
  private static _isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  syncMedia(timeMs: number, isPlaying: boolean) {
    forEachMediaClip(this.sequence, (clip, track) => {
      const media = this.mediaCache[clip.fileId];
      if (!media || (media.type !== 'audio' && media.type !== 'video')) return;
      const el = media.element as HTMLMediaElement;
      const isActive = timeMs >= clip.start && timeMs < clip.start + clip.duration;
      if (isActive && !track.disabled && isPlaying) {
        const trimIn = clip.trimIn ?? 0;
        const targetTime = (trimIn + (timeMs - clip.start)) / 1000;
        el.volume = track.muted ? 0 : (track.volume ?? 1);
        el.muted = false;
        if (el.paused) {
          el.currentTime = targetTime;
          el.play().catch(() => {});
        } else if (!PlaybackEngine._isSafari && Math.abs(el.currentTime - targetTime) > 0.15) {
          el.currentTime = targetTime;
        }
      } else {
        if (!el.paused) el.pause();
      }
    });
  }

  pauseAllMedia() {
    for (const entry of Object.values(this.mediaCache)) {
      if (entry.type === 'audio' || entry.type === 'video') {
        (entry.element as HTMLMediaElement).pause();
        (entry.element as HTMLMediaElement).muted = true;
      }
    }
  }

  seek(ms: number) {
    this.currentTimeMs = ms;
    this.onTimeUpdate(ms);
    const mySeek = ++this.seekCounter;

    let hasVideoSeek = false;
    forEachMediaClip(this.sequence, (clip) => {
      const media = this.mediaCache[clip.fileId];
      if (!media || media.type === 'image') return;
      const el = media.element as HTMLMediaElement;
      if (ms >= clip.start && ms < clip.start + clip.duration) {
        el.currentTime = ((clip.trimIn ?? 0) + (ms - clip.start)) / 1000;
        if (media.type === 'video') {
          hasVideoSeek = true;
          el.onseeked = () => {
            el.onseeked = null;
            if (this.seekCounter === mySeek) this.renderCurrentFrame(this.currentTimeMs);
          };
        }
      }
    });

    this.renderCurrentFrame(ms);
    if (hasVideoSeek) {
      setTimeout(() => {
        if (this.seekCounter === mySeek) this.renderCurrentFrame(this.currentTimeMs);
      }, 100);
    }
  }

  private tick = () => {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    const newTime = this.currentTimeMs + delta;
    const totalDuration = Math.max(...this.sequence.tracks.flatMap(t => t.clips.map(c => c.start + c.duration)), 0);

    if (newTime >= totalDuration) {
      this.currentTimeMs = totalDuration;
      this.syncMedia(totalDuration, false);
      this.onTimeUpdate(totalDuration);
      this.stop();
      return;
    }

    this.currentTimeMs = newTime;
    this.renderCurrentFrame(newTime);
    this.syncMedia(newTime, true);

    if (now - this.lastUiUpdate > UI_UPDATE_INTERVAL) {
      this.lastUiUpdate = now;
      this.onTimeUpdate(newTime);
    }

    this.animFrame = requestAnimationFrame(this.tick);
  };

  async play(): Promise<void> {
    const gen = ++this.playGeneration;
    this.playing = true;

    // Start all active media elements and collect their play promises
    const playPromises: Promise<void>[] = [];
    forEachMediaClip(this.sequence, (clip, track) => {
      const media = this.mediaCache[clip.fileId];
      if (!media || (media.type !== 'audio' && media.type !== 'video')) return;
      if (track.disabled) return;
      const el = media.element as HTMLMediaElement;
      const isActive = this.currentTimeMs >= clip.start && this.currentTimeMs < clip.start + clip.duration;
      if (isActive) {
        const trimIn = clip.trimIn ?? 0;
        el.currentTime = (trimIn + (this.currentTimeMs - clip.start)) / 1000;
        el.volume = track.muted ? 0 : (track.volume ?? 1);
        el.muted = false;
        playPromises.push(el.play().catch(() => {}));
      }
    });

    // Wait for all media to actually start
    await Promise.all(playPromises);

    // If stop() was called during the await, bail out
    if (gen !== this.playGeneration || !this.playing) return;

    this.renderCurrentFrame(this.currentTimeMs);
    this.lastFrameTime = performance.now();
    this.lastUiUpdate = performance.now();
    this.animFrame = requestAnimationFrame(this.tick);
  }

  stop() {
    this.playGeneration++;
    this.playing = false;
    cancelAnimationFrame(this.animFrame);
    this.pauseAllMedia();
    this.onPlayingChange(false);
  }
}
