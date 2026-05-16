export default function Panel({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`hw-panel${className ? ' ' + className : ''}`} style={{
      borderRadius: 'var(--radius-lg)',
      ...style,
    }}>
      {children}
    </div>
  );
}
