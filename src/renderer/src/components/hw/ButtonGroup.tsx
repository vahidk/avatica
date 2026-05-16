import './hw.css';

interface ButtonGroupProps {
  children: React.ReactNode;
}

export default function ButtonGroup({ children }: ButtonGroupProps) {
  return (
    <div className="hw-btn-group">
      {children}
    </div>
  );
}
