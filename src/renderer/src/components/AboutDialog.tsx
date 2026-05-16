interface AboutDialogProps {
  onClose: () => void
}

export default function AboutDialog({ onClose }: AboutDialogProps): React.JSX.Element {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__title-bar">
          <button className="panel-close" onClick={onClose} />
          <span className="dialog__title-text">About</span>
        </div>
        <div className="dialog__title-line" />
        <div className="about-dialog__body">
          <img className="about-dialog__icon" src="../../resources/icon.png" alt="Avatica" />
          <div className="about-dialog__name">Avatica</div>
          <div className="about-dialog__version">Version 0.1.0</div>
          <div className="about-dialog__desc">AI-powered creative studio for media production</div>
          <div className="about-dialog__copyright">By Vahid Kazemi</div>
          <div className="about-dialog__copyright">&copy; {new Date().getFullYear()} Avatica</div>
          <a className="about-dialog__link" href="https://avatica.com" target="_blank" rel="noreferrer">avatica.com</a>
        </div>
        <div className="dialog__actions">
          <button className="hw-btn" onClick={onClose}>
            <span className="hw-btn__face hw-btn__face--default">Close</span>
          </button>
        </div>
      </div>
    </div>
  )
}
