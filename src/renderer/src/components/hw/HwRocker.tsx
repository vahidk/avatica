import './hw.css';

interface HwRockerProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function HwRocker({ checked, onChange, disabled }: HwRockerProps) {
  return (
    <div
      className={`hw-rocker ${checked ? 'hw-rocker--on' : ''} ${disabled ? 'hw-rocker--disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className="hw-rocker__channel">
        <span className="hw-rocker__label hw-rocker__label--on">On</span>
        <span className="hw-rocker__label hw-rocker__label--off">Off</span>
        <div className="hw-rocker__knob" />
      </div>
    </div>
  );
}
