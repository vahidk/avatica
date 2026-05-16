import { useState, useCallback } from 'react';

interface WaveformProps {
  bars: number[];         // array of 0–1 values
  progress: number;       // 0–1, how far through
  onSeek: (pct: number) => void;
  height?: number;
  activeColor?: string;
  inactiveColor?: string;
  gap?: number;
  style?: React.CSSProperties;
}

export default function Waveform({
  bars,
  progress,
  onSeek,
  height = 48,
  activeColor = 'var(--accent)',
  inactiveColor = 'var(--bg-4)',
  gap = 2,
  style,
}: WaveformProps) {
  const [dragPct, setDragPct] = useState<number | null>(null);
  const displayProgress = dragPct ?? progress;

  const startDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const update = (ev: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      setDragPct(pct);
      onSeek(pct);
    };
    update(e.nativeEvent);
    const onMove = (ev: MouseEvent) => update(ev);
    const onUp = () => {
      setDragPct(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [onSeek]);

  return (
    <div
      onMouseDown={startDrag}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        height,
        cursor: 'pointer',
        ...style,
      }}
    >
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1,
          minWidth: 1,
          borderRadius: 1,
          height: `${h * 100}%`,
          backgroundColor: i / bars.length < displayProgress ? activeColor : inactiveColor,
          transition: 'background-color 0.05s',
        }} />
      ))}
    </div>
  );
}
