import './hw.css';

interface CircleButtonProps {
  icon: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  size?: number;
}

export default function CircleButton({ icon, title, active, disabled, onClick, size = 28 }: CircleButtonProps) {
  return (
    <button
      className="hw-circle-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ width: size, height: size }}
    >
      <div className="hw-circle-btn__face">
        <i className={`${icon} hw-circle-btn__icon${active ? ' hw-circle-btn__icon--active' : ''}`} style={{ fontSize: size * 0.36 }} />
      </div>
    </button>
  );
}
