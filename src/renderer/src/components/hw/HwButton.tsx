import './hw.css';

interface HwButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

export default function HwButton({ children, onClick, disabled, active }: HwButtonProps) {
  return (
    <button className="hw-btn" onClick={onClick} disabled={disabled}>
      <div className={`hw-btn__face ${active ? 'hw-btn__face--active' : 'hw-btn__face--default'}`}>
        {children}
      </div>
    </button>
  );
}
