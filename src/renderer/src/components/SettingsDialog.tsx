import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../store'
import { toggleTheme } from '../store/uiSlice'

type Tab = 'general' | 'usage'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'codicon codicon-settings-gear' },
  { id: 'usage', label: 'Usage', icon: 'codicon codicon-graph' },
]

interface UsageStats {
  total: number
  count: number
  byApp: Record<string, { count: number; cost: number }>
  byProvider: Record<string, { count: number; cost: number }>
}

interface SettingsDialogProps {
  onClose: () => void
  initialTab?: Tab
}

export default function SettingsDialog({ onClose, initialTab = 'general' }: SettingsDialogProps): React.JSX.Element {
  const dispatch = useAppDispatch()
  const theme = useAppSelector((s) => s.ui.theme)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  // General
  const [rootDir, setRootDir] = useState('')

  // API Keys
  const [geminiKey, setGeminiKey] = useState('')
  const [xaiKey, setXaiKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [saved, setSaved] = useState(false)

  // Usage
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)

  useEffect(() => {
    window.avatica.config.get().then((cfg) => {
      setGeminiKey((cfg.geminiApiKey as string) || '')
      setXaiKey((cfg.xaiApiKey as string) || '')
      setOpenaiKey((cfg.openaiApiKey as string) || '')
    })
    window.avatica.config.getRootDir().then(setRootDir)
    window.avatica.usage.stats().then(setUsageStats)
  }, [])

  const handleSaveKeys = async (): Promise<void> => {
    await window.avatica.config.set('geminiApiKey', geminiKey)
    await window.avatica.config.set('xaiApiKey', xaiKey)
    await window.avatica.config.set('openaiApiKey', openaiKey)
    window.dispatchEvent(new CustomEvent('avatica:keys-changed'))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleChooseDir = async (): Promise<void> => {
    const dir = await window.avatica.config.chooseRootDir()
    if (dir) setRootDir(dir)
  }

  const handleResetUsage = async (): Promise<void> => {
    await window.avatica.usage.reset()
    window.avatica.usage.stats().then(setUsageStats)
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__title-bar">
          <button className="panel-close" onClick={onClose} />
          <span className="dialog__title-text">Settings</span>
        </div>
        <div className="dialog__title-line" />
        <div className="settings-dialog__body">
          {/* Sidebar */}
          <div className="settings-dialog__sidebar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-dialog__tab ${activeTab === tab.id ? 'settings-dialog__tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="settings-dialog__content">
            {activeTab === 'general' && (
              <div className="settings-dialog__section">
                <label className="settings-dialog__label">Theme</label>
                <div className="settings-dialog__toggle-row">
                  <button className={`settings-dialog__toggle-btn ${theme === 'dark' ? 'settings-dialog__toggle-btn--active' : ''}`} onClick={() => theme !== 'dark' && dispatch(toggleTheme())}>Dark</button>
                  <button className={`settings-dialog__toggle-btn ${theme === 'light' ? 'settings-dialog__toggle-btn--active' : ''}`} onClick={() => theme !== 'light' && dispatch(toggleTheme())}>Light</button>
                </div>
                <label className="settings-dialog__label">Data Directory</label>
                <div className="settings-dialog__dir-row">
                  <span className="settings-dialog__dir-path">{rootDir}</span>
                  <button className="hw-btn" onClick={handleChooseDir}>
                    <span className="hw-btn__face hw-btn__face--default">Change</span>
                  </button>
                </div>
                <label className="settings-dialog__label">Gemini API Key</label>
                <div className="settings-dialog__pit">
                  <input type="password" className="settings-dialog__input" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Enter your Gemini API key..." />
                </div>
                <a className="settings-dialog__key-link" href="#" onClick={(e) => { e.preventDefault(); window.open('https://aistudio.google.com/apikey', '_blank') }}>Get a Gemini API key</a>
                <label className="settings-dialog__label">xAI API Key</label>
                <div className="settings-dialog__pit">
                  <input type="password" className="settings-dialog__input" value={xaiKey} onChange={(e) => setXaiKey(e.target.value)} placeholder="Enter your xAI API key..." />
                </div>
                <a className="settings-dialog__key-link" href="#" onClick={(e) => { e.preventDefault(); window.open('https://console.x.ai', '_blank') }}>Get an xAI API key</a>
                <label className="settings-dialog__label">OpenAI API Key</label>
                <div className="settings-dialog__pit">
                  <input type="password" className="settings-dialog__input" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="Enter your OpenAI API key..." />
                </div>
                <a className="settings-dialog__key-link" href="#" onClick={(e) => { e.preventDefault(); window.open('https://platform.openai.com/api-keys', '_blank') }}>Get an OpenAI API key</a>
                <div className="settings-dialog__actions">
                  {saved && <span className="settings-dialog__saved">Saved</span>}
                  <button className="hw-btn" onClick={handleSaveKeys}>
                    <span className="hw-btn__face hw-btn__face--active">Save</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'usage' && (
              <div className="settings-dialog__section">
                {usageStats && (
                  <>
                    <div className="settings-dialog__stat-row">
                      <span className="settings-dialog__stat-label">Total Spent</span>
                      <span className="settings-dialog__stat-value">${usageStats.total.toFixed(4)}</span>
                    </div>
                    <div className="settings-dialog__stat-row">
                      <span className="settings-dialog__stat-label">Total Runs</span>
                      <span className="settings-dialog__stat-value">{usageStats.count}</span>
                    </div>

                    {Object.keys(usageStats.byApp).length > 0 && (
                      <table className="settings-dialog__table">
                        <thead>
                          <tr>
                            <th className="settings-dialog__th">App</th>
                            <th className="settings-dialog__th settings-dialog__th--right">Runs</th>
                            <th className="settings-dialog__th settings-dialog__th--right">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(usageStats.byApp).sort((a, b) => b[1].cost - a[1].cost).map(([app, data]) => (
                            <tr key={app}>
                              <td className="settings-dialog__td">{app}</td>
                              <td className="settings-dialog__td settings-dialog__td--right">{data.count}</td>
                              <td className="settings-dialog__td settings-dialog__td--right">${data.cost.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {Object.keys(usageStats.byProvider).length > 0 && (
                      <table className="settings-dialog__table">
                        <thead>
                          <tr>
                            <th className="settings-dialog__th">Provider</th>
                            <th className="settings-dialog__th settings-dialog__th--right">Runs</th>
                            <th className="settings-dialog__th settings-dialog__th--right">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(usageStats.byProvider).sort((a, b) => b[1].cost - a[1].cost).map(([provider, data]) => (
                            <tr key={provider}>
                              <td className="settings-dialog__td">{provider}</td>
                              <td className="settings-dialog__td settings-dialog__td--right">{data.count}</td>
                              <td className="settings-dialog__td settings-dialog__td--right">${data.cost.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div className="settings-dialog__actions">
                      <button className="hw-btn" onClick={handleResetUsage}>
                        <span className="hw-btn__face hw-btn__face--danger">Reset</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
