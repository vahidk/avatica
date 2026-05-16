interface TitleBarProps {
  title: string
  onClose: () => void
  children?: React.ReactNode
}

export default function TitleBar({ title, onClose, children }: TitleBarProps): React.JSX.Element {
  return (
    <>
      <div className="app-title">
        <div className="app-traffic">
          <button className="app-close" onClick={onClose} />
        </div>
        <span className="app-title-text">{title}</span>
        {children && <><span style={{ flex: 1 }} />{children}</>}
      </div>
      <div className="app-title-line" />
    </>
  )
}
