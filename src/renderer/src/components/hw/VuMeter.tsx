import { useEffect, useRef, useState } from 'react';
import './hw.css';

interface VuMeterProps {
  audioElement: HTMLAudioElement | null;
  bars?: number;
}

// Shared AudioContext — createMediaElementSource can only be called once per element,
// and the source must connect back to destination for audio to play.
const audioContexts = new WeakMap<HTMLAudioElement, { ctx: AudioContext; analyser: AnalyserNode }>();

function getOrCreateAnalyser(el: HTMLAudioElement) {
  if (audioContexts.has(el)) return audioContexts.get(el)!;

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.6;

  const source = ctx.createMediaElementSource(el);
  source.connect(analyser);
  analyser.connect(ctx.destination); // pass audio through to speakers

  audioContexts.set(el, { ctx, analyser });
  return { ctx, analyser };
}

export default function VuMeter({ audioElement, bars = 24 }: VuMeterProps) {
  const [levels, setLevels] = useState<number[]>(() => new Array(bars).fill(0));
  const rafRef = useRef(0);

  useEffect(() => {
    if (!audioElement) return;

    let cancelled = false;

    function start() {
      if (cancelled) return;
      const { ctx, analyser } = getOrCreateAnalyser(audioElement!);
      if (ctx.state === 'suspended') ctx.resume();

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        if (cancelled) return;
        analyser.getByteFrequencyData(dataArray);
        const binCount = dataArray.length;
        const newLevels = new Array(bars).fill(0);
        for (let i = 0; i < bars; i++) {
          const binIdx = Math.floor((i / bars) * binCount);
          newLevels[i] = dataArray[binIdx] / 255;
        }
        setLevels(newLevels);
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    // Connect on play (user gesture ensures AudioContext is allowed)
    const onPlay = () => start();
    audioElement.addEventListener('play', onPlay);
    if (!audioElement.paused) start();

    return () => {
      cancelled = true;
      audioElement.removeEventListener('play', onPlay);
      cancelAnimationFrame(rafRef.current);
    };
  }, [audioElement, bars]);

  return (
    <div className="hw-vu">
      <div className="hw-vu__pit">
        <div className="hw-vu__bars">
          {levels.map((level, i) => (
            <div key={i} className="hw-vu__bar-col">
              {Array.from({ length: 8 }, (_, j) => {
                const threshold = (7 - j) / 8;
                const lit = level > threshold;
                const color = j <= 1 ? 'red' : j <= 3 ? 'yellow' : 'green';
                return (
                  <div
                    key={j}
                    className={`hw-vu__dot ${lit ? `hw-vu__dot--${color}` : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
