import CircleButton from './hw/CircleButton'
import TitleBar from './ui/TitleBar'
import CodeEditor, { type EditorLanguage } from './CodeEditor'
import ManifestEditor from './ManifestEditor'
import AssetTypeEditor from './AssetTypeEditor'

function getEditorLanguage(filename: string): EditorLanguage {
  if (filename.endsWith('.json')) return 'json'
  if (filename.endsWith('.html')) return 'html'
  return 'javascript'
}

export interface OpenFile {
  id: string
  name: string
  content: string
  dirty: boolean
}

type DevMode = 'app-builder' | 'asset-types'

interface DevPanelProps {
  activeMode: DevMode
  openFiles: OpenFile[]
  activeTabId: string | null
  openAppId: string | null
  onTabSelect: (id: string) => void
  onClose: () => void
  onNavigateHome: () => void
  onSaveAll: () => void
  onRunApp: () => void
  onContentChange: (content: string) => void
  onNewApp: () => void
  onNewSchema: () => void
}

export default function DevPanel({
  activeMode, openFiles, activeTabId, openAppId,
  onTabSelect, onClose, onNavigateHome, onSaveAll, onRunApp, onContentChange,
  onNewApp, onNewSchema,
}: DevPanelProps): React.JSX.Element {
  const activeTab = openFiles.find((f) => f.id === activeTabId) || null

  if (openFiles.length === 0) {
    return (
      <div className="hw-panel code-editor-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <TitleBar title={activeMode === 'app-builder' ? 'App Builder' : 'Asset Types'} onClose={onNavigateHome} />
        <div className="code-editor-panel__empty">
          {activeMode === 'app-builder' ? (
            <button className="code-editor-panel__new-app" onClick={onNewApp}>
              + New App
            </button>
          ) : (
            <button className="code-editor-panel__new-app" onClick={onNewSchema}>
              + New Asset Type
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="hw-panel code-editor-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="code-editor-panel__titlebar">
        <div className="app-traffic">
          <button className="app-close" onClick={onClose} />
        </div>
        {openFiles.map((tab) => (
          <button
            key={tab.id}
            className={`code-editor-panel__tab ${tab.id === activeTabId ? 'code-editor-panel__tab--active' : ''}`}
            onClick={() => onTabSelect(tab.id)}
          >
            {tab.name}{tab.dirty ? ' \u2022' : ''}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <CircleButton icon="fa-solid fa-floppy-disk" title="Save all" onClick={onSaveAll} disabled={!openFiles.some((f) => f.dirty)} />
        {activeMode === 'app-builder' && openAppId && (
          <CircleButton icon="fa-solid fa-play" title="Run app" onClick={onRunApp} />
        )}
      </div>
      <div className="app-title-line" />
      {activeTab && (
        activeMode === 'asset-types' ? (
          <AssetTypeEditor key={activeTab.id} value={activeTab.content} onChange={onContentChange} />
        ) : activeTab.name === 'manifest.json' ? (
          <ManifestEditor key={activeTab.id} value={activeTab.content} onChange={onContentChange} />
        ) : (
          <CodeEditor key={activeTab.id} value={activeTab.content} language={getEditorLanguage(activeTab.name)} onChange={onContentChange} />
        )
      )}
    </div>
  )
}
