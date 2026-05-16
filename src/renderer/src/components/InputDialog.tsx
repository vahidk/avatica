import { useState, useRef, useEffect } from 'react'

interface InputDialogProps {
  title: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export default function InputDialog({
  title,
  defaultValue = '',
  placeholder = '',
  confirmLabel = 'OK',
  onConfirm,
  onCancel
}: InputDialogProps): React.JSX.Element {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = (): void => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__title-bar">
          <button className="panel-close" onClick={onCancel} />
          <span className="dialog__title-text">{title}</span>
        </div>
        <div className="dialog__title-line" />
        <div className="dialog__body">
          <div className="dialog__input-pit">
            <input
              ref={inputRef}
              className="dialog__input"
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') onCancel()
              }}
            />
          </div>
        </div>
        <div className="dialog__actions">
          <button className="hw-btn" onClick={onCancel}>
            <span className="hw-btn__face hw-btn__face--default">Cancel</span>
          </button>
          <button className="hw-btn" onClick={handleSubmit}>
            <span className="hw-btn__face hw-btn__face--active">{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
