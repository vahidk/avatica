import { useRef, useEffect } from 'react'

export interface LogEntry {
  appName: string
  message: string
}

interface LogPanelProps {
  logs: LogEntry[]
  onClear: () => void
  onClose: () => void
}

export default function LogPanel({ logs, onClear, onClose }: LogPanelProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [logs])

  return (
    <div className="log-panel">
      <div className="log-panel__title">
        <button className="log-panel__close" onClick={onClose} />
        <span className="log-panel__title-text">Log</span>
        <span className="log-panel__spacer" />
        {logs.length > 0 && (
          <button className="log-panel__btn" onClick={onClear} title="Clear logs">
            <i className="fa-solid fa-trash" />
          </button>
        )}
      </div>
      <div ref={scrollRef} className="log-panel__entries">
        {logs.length === 0 ? (
          <div className="log-panel__empty">No logs</div>
        ) : logs.map((entry, i) => (
          <div key={i} className="log-panel__entry">
            <span className="log-panel__entry-app">[{entry.appName}]</span>{' '}
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  )
}
