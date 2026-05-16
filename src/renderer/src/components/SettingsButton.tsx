import { useState } from 'react'
import SettingsDialog from './SettingsDialog'

export default function SettingsButton({ className }: { className?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className={`navbar__icon-btn ${className || ''}`}
        onClick={() => setOpen(true)}
        title="Settings"
      >
        <i className="codicon codicon-settings-gear" />
      </button>
      {open && <SettingsDialog initialTab="general" onClose={() => setOpen(false)} />}
    </>
  )
}
