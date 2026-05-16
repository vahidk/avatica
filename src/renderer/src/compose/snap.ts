import type { Sequence, Clip } from './types';

const SNAP_THRESHOLD_PX = 8;

/** Collect all snap points: clip edges + playhead + time 0. */
function getSnapPoints(sequence: Sequence, playheadMs: number, excludeClipId?: string): number[] {
  const points = [0, playheadMs];
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      points.push(clip.start, clip.start + clip.duration);
    }
  }
  return points;
}

/**
 * Snap a position to the nearest snap point within threshold.
 * If `duration` is provided, also considers the end edge (start + duration).
 */
export function snapToGrid(
  ms: number,
  sequence: Sequence,
  playheadMs: number,
  msPerPixel: number,
  opts?: { excludeClipId?: string; duration?: number; disabled?: boolean },
): number {
  if (opts?.disabled) return ms;

  const thresholdMs = SNAP_THRESHOLD_PX * msPerPixel;
  const points = getSnapPoints(sequence, playheadMs, opts?.excludeClipId);
  let best = ms;
  let bestDist = thresholdMs;

  for (const p of points) {
    // Snap start edge
    const distStart = Math.abs(ms - p);
    if (distStart < bestDist) { best = p; bestDist = distStart; }

    // Snap end edge if duration provided
    if (opts?.duration != null) {
      const distEnd = Math.abs(ms + opts.duration - p);
      if (distEnd < bestDist) { best = p - opts.duration; bestDist = distEnd; }
    }
  }

  return Math.max(0, best);
}

/** Clamp a clip move to prevent overlap with other clips. */
export function clampMove(clips: Clip[], clipId: string, newStart: number, duration: number): number {
  const others = clips.filter(c => c.id !== clipId).sort((a, b) => a.start - b.start);
  let start = Math.max(0, newStart);
  for (const o of others) {
    if (start < o.start + o.duration && start + duration > o.start) {
      start = start < o.start ? o.start - duration : o.start + o.duration;
    }
  }
  return Math.max(0, start);
}

/** Clamp a clip resize to prevent overlap. Returns adjusted start + duration. */
export function clampResize(clips: Clip[], clipId: string, start: number, duration: number): { start: number; duration: number } {
  const others = clips.filter(c => c.id !== clipId).sort((a, b) => a.start - b.start);
  let s = Math.max(0, start);
  let d = duration;
  const prev = others.filter(o => o.start + o.duration <= s + d && o.start < s).pop();
  if (prev && s < prev.start + prev.duration) { const diff = prev.start + prev.duration - s; s += diff; d -= diff; }
  const next = others.find(o => o.start >= s);
  if (next && s + d > next.start) d = next.start - s;
  return { start: Math.max(0, s), duration: Math.max(100, d) };
}

/** Find the next non-overlapping position for a drop. */
export function findDropPosition(clips: Clip[], startMs: number, duration: number): number {
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  let s = Math.max(0, startMs);
  for (;;) {
    const overlap = sorted.find(c => s < c.start + c.duration && s + duration > c.start);
    if (!overlap) return s;
    s = overlap.start + overlap.duration;
  }
}
