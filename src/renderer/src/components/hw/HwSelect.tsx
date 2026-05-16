import { useState, useRef, useEffect } from 'react';
import './hw.css';

interface HwSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface HwSelectProps {
  value: string;
  options: HwSelectOption[];
  onChange: (value: string) => void;
  label?: string;
}

export default function HwSelect({ value, options, onChange, label }: HwSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="hw-select">
      {label && <span className="hw-select__label">{label}</span>}
      <div className="hw-select__pit">
        <button
          ref={triggerRef}
          type="button"
          className="hw-select__trigger"
          onClick={() => {
            if (!open && triggerRef.current) {
              const rect = triggerRef.current.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 6, left: rect.left, minWidth: rect.width });
            }
            setOpen(!open);
          }}
        >
          <span className="hw-select__label-group">
            {selected?.icon && <span className="hw-select__icon">{selected.icon}</span>}
            <span className="hw-select__value">{selected?.label || value}</span>
          </span>
          <i className={`fa-solid fa-chevron-down hw-select__arrow ${open ? 'hw-select__arrow--open' : ''}`} />
        </button>
      </div>
      {open && (() => {
        const hasIcons = options.some(o => o.icon);
        return (
        <div className="hw-select__menu" style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.minWidth }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`hw-select__option ${opt.value === value ? 'hw-select__option--active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {hasIcons && <span className="hw-select__icon">{opt.icon ?? <span className="hw-select__icon-spacer" />}</span>}
              {opt.label}
            </button>
          ))}
        </div>
        );
      })()}
    </div>
  );
}
