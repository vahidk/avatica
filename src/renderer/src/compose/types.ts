export type TrackType = 'video' | 'audio';

interface ClipBase {
  id: string;
  start: number;      // ms
  duration: number;    // ms
}

export interface MediaClip extends ClipBase {
  kind: 'media';
  fileId: string;
  fileName?: string;
  mimeType?: string;
  trimIn?: number;     // ms
  trimOut?: number;    // ms
}

export interface OverlayClip extends ClipBase {
  kind: 'overlay';
  templateId: string;
  vars: Record<string, string | number>;
}

export type Clip = MediaClip | OverlayClip;

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  disabled: boolean;
  muted: boolean;
  volume: number;
  clips: Clip[];
}

export interface SequenceSettings {
  width: number;
  height: number;
  fps: number;
  durationMs?: number;
}

export interface Sequence {
  settings: SequenceSettings;
  tracks: Track[];
}

export function createDefaultSequence(): Sequence {
  return {
    settings: { width: 1920, height: 1080, fps: 30 },
    tracks: [
      { id: crypto.randomUUID(), type: 'video', name: 'Video 1', disabled: false, muted: false, volume: 1, clips: [] },
      { id: crypto.randomUUID(), type: 'audio', name: 'Audio 1', disabled: false, muted: false, volume: 1, clips: [] },
    ],
  };
}
