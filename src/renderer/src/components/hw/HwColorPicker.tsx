import { useRef } from 'react';
import './hw.css';

interface HwColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function HwColorPicker({ value, onChange, label }: HwColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="hw-color">
      {label && <span className="hw-input__label">{label}</span>}
      <div className="hw-color__pit" onClick={() => inputRef.current?.click()}>
        <div className="hw-color__swatch" style={{ background: value }} />
        <span className="hw-color__value">{value}</span>
        <input
          ref={inputRef}
          type="color"
          className="hw-color__input"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
