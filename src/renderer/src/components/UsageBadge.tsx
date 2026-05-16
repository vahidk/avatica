import { useState, useEffect } from 'react'
import SettingsDialog from './SettingsDialog'

export default function UsageBadge({ className }: { className?: string }): React.JSX.Element | null {
  const [totalUsage, setTotalUsage] = useState(0)
  const [showPrefs, setShowPrefs] = useState(false)

  useEffect(() => {
    const refresh = (): void => { window.avatica.usage.total().then(setTotalUsage) }
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

  if (totalUsage <= 0) return null

  return (
    <>
      <button className={`navbar__usage ${className || ''}`} onClick={() => setShowPrefs(true)}>
        <i className="fa-solid fa-dollar-sign" /> {totalUsage.toFixed(2)}
      </button>
      {showPrefs && <SettingsDialog initialTab="usage" onClose={() => setShowPrefs(false)} />}
    </>
  )
}
