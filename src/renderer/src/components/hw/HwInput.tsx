import './hw.css';

interface HwInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function HwInput({ value, onChange, onCommit, placeholder, label, className }: HwInputProps) {
  return (
    <div className={`hw-input ${className || ''}`}>
      {label && <span className="hw-input__label">{label}</span>}
      <div className="hw-input__pit">
        <input
          type="text"
          className="hw-input__control"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onCommit ? e => onCommit(e.target.value) : undefined}
          onKeyDown={onCommit ? e => { if (e.key === 'Enter') { onCommit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); } } : undefined}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
