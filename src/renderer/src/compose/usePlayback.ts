import { useState, useRef, useCallback, useEffect } from 'react';
import { PlaybackEngine, preloadMedia } from './PlaybackEngine';
import type { Sequence } from './types';

export function usePlayback(projectId: string, sequence: Sequence) {
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [displayTimeMs, setDisplayTimeMs] = useState(0);
  const engineRef = useRef<PlaybackEngine>(new PlaybackEngine(sequence));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actionGenRef = useRef(0);

  // Keep engine in sync with sequence and callbacks
  useEffect(() => {
    const engine = engineRef.current;
    engine.sequence = sequence;
    engine.onTimeUpdate = setDisplayTimeMs;
    engine.onPlayingChange = (p: boolean) => {
      setPlaying(p);
      if (!p) setBuffering(false);
    };
  }, [sequence]);

  // Sync canvas ref
  const prevCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (canvasRef.current !== prevCanvasRef.current) {
      prevCanvasRef.current = canvasRef.current;
      engineRef.current.canvas = canvasRef.current;
    }
  });

  // Clean up stale media cache entries when sequence changes
  useEffect(() => {
    const cache = engineRef.current.mediaCache;
    const activeFileIds = new Set<string>();
    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        if (clip.kind === 'media') activeFileIds.add(clip.fileId);
      }
    }
    for (const key of Object.keys(cache)) {
      if (!activeFileIds.has(key)) {
        const entry = cache[key];
        if (entry.type === 'video' || entry.type === 'audio') {
          (entry.element as HTMLMediaElement).pause();
          (entry.element as HTMLMediaElement).src = '';
        }
        delete cache[key];
      }
    }
  }, [sequence]);

  const preload = useCallback(async () => {
    await preloadMedia(projectId, sequence, engineRef.current.mediaCache);
  }, [sequence, projectId]);

  // Preload media when sequence changes (not during playback)
  useEffect(() => {
    if (playing) return;
    let cancelled = false;
    const run = async () => {
      setBuffering(true);
      try {
        await preload();
        if (!cancelled) engineRef.current.seek(engineRef.current.currentTimeMs);
      } finally {
        if (!cancelled) setBuffering(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [sequence, playing, preload]);  

  // Cleanup on unmount
  useEffect(() => {
    const gen = actionGenRef;
    const engine = engineRef;
    return () => {
      gen.current++;
      engine.current.stop();
    };
  }, []);

  const stopPlayback = useCallback(() => {
    actionGenRef.current++;
    engineRef.current.stop();
    setPlaying(false);
    setBuffering(false);
  }, []);

  const startPlayback = useCallback(async () => {
    const gen = ++actionGenRef.current;
    const engine = engineRef.current;

    // Reset to start if at end
    const totalDuration = Math.max(
      0,
      ...engine.sequence.tracks.flatMap(t => t.clips.map(c => c.start + c.duration)),
    );
    if (engine.currentTimeMs >= totalDuration && totalDuration > 0) {
      engine.seek(0);
    }

    setBuffering(true);

    try {
      await preload();
    } catch {
      if (gen === actionGenRef.current) setBuffering(false);
      return;
    }

    if (gen !== actionGenRef.current) return;

    setPlaying(true);
    await engine.play();

    if (gen !== actionGenRef.current) return;
    setBuffering(false);
  }, [preload]);

  const togglePlayback = useCallback(() => {
    if (playing) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [playing, startPlayback, stopPlayback]);

  const seek = useCallback((ms: number) => engineRef.current.seek(ms), []);
  const pause = useCallback(() => stopPlayback(), [stopPlayback]);
  const play = useCallback(() => startPlayback(), [startPlayback]);

  return { canvasRef, playing, buffering, currentTimeMs: displayTimeMs, play, pause, togglePlayback, seek, preload };
}
