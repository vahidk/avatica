import { useRef, useCallback } from 'react';
import './hw.css';

interface HwSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  vertical?: boolean;
  onChange: (value: number) => void;
}

export default function HwSlider({ value, min, max, step = 1, vertical, onChange }: HwSliderProps) {
  const channelRef = useRef<HTMLDivElement>(null);
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const handlePointer = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const update = (clientX: number, clientY: number) => {
      const rect = channelRef.current!.getBoundingClientRect();
      const ratio = vertical
        ? Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
        : Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, snapped)));
    };
    update(e.clientX, e.clientY);
    const onMove = (e: MouseEvent) => update(e.clientX, e.clientY);
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [min, max, step, vertical, onChange]);

  if (vertical) {
    return (
      <div className="hw-slider hw-slider--vertical" onMouseDown={handlePointer}>
        <div className="hw-slider__channel-wrap">
          <div ref={channelRef} className="hw-slider__channel">
            <div className="hw-slider__fill" style={{ height: `${pct}%` }} />
          </div>
        </div>
        <div className="hw-slider__cap" style={{ bottom: `${pct}%` }}>
          <div className="hw-slider__cap-face" />
        </div>
      </div>
    );
  }

  return (
    <div className="hw-slider" onMouseDown={handlePointer}>
      <div className="hw-slider__channel-wrap">
        <div ref={channelRef} className="hw-slider__channel">
          <div className="hw-slider__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="hw-slider__cap" style={{ left: `${pct}%` }}>
        <div className="hw-slider__cap-face" />
      </div>
    </div>
  );
}
