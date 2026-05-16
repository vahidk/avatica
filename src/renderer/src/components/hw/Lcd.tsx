// Hardware-styled LCD display with optional LED indicator.

interface LcdProps {
  text: string;
  active?: boolean; // LED blinks when active
  children?: React.ReactNode; // custom content instead of text
}

export default function Lcd({ text, active, children }: LcdProps) {
  return (
    <div className={`app-lcd ${active ? 'app-lcd--active' : ''}`}>
      <div className="app-lcd-screen">
        <span className={`app-lcd-led ${active ? 'app-lcd-led--active' : ''}`} />
        {children || <span className="app-lcd-text">{text}</span>}
      </div>
    </div>
  );
}
