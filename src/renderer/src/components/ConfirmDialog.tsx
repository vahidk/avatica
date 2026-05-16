interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  danger = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__title-bar">
          <button className="panel-close" onClick={onCancel} />
          <span className="dialog__title-text">{title}</span>
        </div>
        <div className="dialog__title-line" />
        <div className="dialog__body">
          <p className="dialog__message">{message}</p>
        </div>
        <div className="dialog__actions">
          <button className="hw-btn" onClick={onCancel}>
            <span className="hw-btn__face hw-btn__face--default">Cancel</span>
          </button>
          <button className="hw-btn" onClick={onConfirm}>
            <span className={`hw-btn__face ${danger ? 'hw-btn__face--danger' : 'hw-btn__face--active'}`}>
              {confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
