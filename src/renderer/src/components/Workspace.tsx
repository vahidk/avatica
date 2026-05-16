import { useState, useEffect, useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store'
import { setCurrentProject, setAppMode, bumpFileRefresh, toggleLog } from '../store/uiSlice'
import Navbar from './Navbar'
import AssetBrowser from './AssetBrowser'
import ChatPanel from './ChatPanel'
import AppGrid from './AppGrid'
import AppContainer from './AppContainer'
import OutputGrid from './OutputGrid'
import LogPanel, { type LogEntry } from './LogPanel'
import DevPanel, { type OpenFile } from './DevPanel'
import SettingsDialog from './SettingsDialog'
import Compose from '../compose/Compose'

interface GeneratedFile {
  filePath: string
  fileName: string
  mimeType: string
}

interface WorkspaceProps {
  externalSeqFile?: string | null
  onExternalSeqHandled?: () => void
}

/** If `message` contains the phrase "Open Settings", render that phrase as a clickable button. */
function renderErrorWithSettingsLink(message: string, onClick: () => void): React.ReactNode {
  const marker = 'Open Settings'
  const idx = message.indexOf(marker)
  if (idx === -1) return message
  return (
    <>
      {message.slice(0, idx)}
      <button className="inline-link" onClick={onClick}>{marker}</button>
      {message.slice(idx + marker.length)}
    </>
  )
}

export default function Workspace({ externalSeqFile, onExternalSeqHandled }: WorkspaceProps = {}): React.JSX.Element {
  const dispatch = useAppDispatch()
  const { currentProject, showAssets, showLog, showChat, appMode } = useAppSelector((s) => s.ui)
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const [activeAppName, setActiveAppName] = useState('')
  const [activeTaskCount, setActiveTaskCount] = useState(0)
  const [outputs, setOutputs] = useState<GeneratedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [hasKeys, setHasKeys] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  const checkKeys = useCallback(async () => {
    const cfg = await window.avatica.config.get()
    setHasKeys(!!cfg.geminiApiKey || !!cfg.xaiApiKey || !!cfg.openaiApiKey)
  }, [])

  useEffect(() => {
    checkKeys()
    const handler = (): void => { checkKeys() }
    window.addEventListener('avatica:keys-changed', handler)
    return () => window.removeEventListener('avatica:keys-changed', handler)
  }, [checkKeys])

  // Prune output grid entries when a file is deleted from the asset browser
  useEffect(() => {
    const handler = (e: Event): void => {
      const { path } = (e as CustomEvent).detail || {}
      if (!path) return
      setOutputs((prev) => prev.filter((o) => o.filePath !== path))
    }
    window.addEventListener('avatica:file-deleted', handler)
    return () => window.removeEventListener('avatica:file-deleted', handler)
  }, [])

  // Watch the active project's directory for external file changes (Finder edits,
  // CLI moves, etc.) and refresh the asset browser when something changes.
  useEffect(() => {
    if (!currentProject) return
    window.avatica.files.watch(currentProject.id)
    const unsub = window.avatica.files.onChanged(({ projectId }) => {
      if (projectId === currentProject.id) dispatch(bumpFileRefresh())
    })
    return () => {
      unsub()
      window.avatica.files.unwatch(currentProject.id)
    }
  }, [currentProject, dispatch])

  // Dev panel state
  const [devOpenFiles, setDevOpenFiles] = useState<OpenFile[]>([])
  const [devActiveTabId, setDevActiveTabId] = useState<string | null>(null)
  const [devOpenAppSlug, setDevOpenAppSlug] = useState<string | null>(null)
  const [devBrowserItems, setDevBrowserItems] = useState<{ id: string; name: string }[]>([])

  const isDevMode = appMode === 'app-builder' || appMode === 'asset-types'

  // Convert dev items to FileEntry format for AssetBrowser
  // When an app is open (devOpenAppSlug set), show its internal files
  // Otherwise show the top-level folder/schema listing
  const devBrowserFiles = isDevMode ? devBrowserItems.map((item) => ({
    name: item.name,
    isDirectory: !devOpenAppSlug && appMode === 'app-builder',
    size: 0,
    mimeType: null as string | null,
    modifiedAt: 0,
  })) : undefined

  const loadDevRootListing = useCallback(() => {
    if (appMode === 'app-builder' && currentProject) {
      window.avatica.customApps.listFolders(currentProject.id).then(setDevBrowserItems)
    } else if (appMode === 'asset-types') {
      window.avatica.customSchemas.list().then(setDevBrowserItems)
    } else {
      setDevBrowserItems([])
    }
  }, [appMode, currentProject])

  // Load dev browser items when mode changes
  useEffect(() => { loadDevRootListing() }, [loadDevRootListing])

  // Clear dev state when switching modes
  useEffect(() => {
    if (!isDevMode) return
    setDevOpenFiles([])
    setDevActiveTabId(null)
    setDevOpenAppSlug(null)
  }, [appMode])

  const goToProjects = (): void => { dispatch(setCurrentProject(null)) }

  const [pendingSequence, setPendingSequence] = useState<string | null>(externalSeqFile || null)

  // Handle external .seq file opened from Finder
  useEffect(() => {
    if (externalSeqFile) {
      setPendingSequence(externalSeqFile)
      onExternalSeqHandled?.()
    }
  }, [externalSeqFile, onExternalSeqHandled])

  const handleOpenFile = (fileName: string): void => {
    if (fileName.endsWith('.seq')) {
      setActiveAppId(null)
      setPendingSequence(fileName)
      dispatch(setAppMode('compose'))
    }
  }

  const addLog = (message: string): void => {
    setLogs((prev) => [...prev, { appName: activeAppName || 'System', message }])
  }

  const handleSelectApp = (appId: string): void => {
    setActiveAppId(appId)
    window.avatica.apps.list(currentProject?.id || '').then((apps) => {
      const app = apps.find((a) => a.id === appId)
      setActiveAppName(app?.name || appId)
    })
    setOutputs([])
    setError(null)
  }

  const handleInvoke = async (appId: string, input: Record<string, unknown>): Promise<void> => {
    if (!currentProject) return
    setActiveTaskCount((n) => n + 1)
    setError(null)
    addLog(`Running ${appId}...`)
    try {
      const result = await window.avatica.apps.run(currentProject.id, appId, input)
      if (result.error) {
        setError(result.error)
        addLog(`Error: ${result.error}`)
      } else {
        addLog(`Done — ${result.files.length} file(s), $${result.totalCostUsd.toFixed(4)}`)
      }
      for (const f of result.files) {
        const ext = f.name.split('.').pop()?.toLowerCase() || ''
        const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', md: 'text/markdown', txt: 'text/plain', json: 'application/json' }
        const mimeType = mimeMap[ext] || 'application/octet-stream'
        setOutputs((prev) => [{ filePath: f.path, fileName: f.name, mimeType }, ...prev])
      }
      dispatch(bumpFileRefresh())
    } catch (err: any) {
      const msg = err.message || 'Failed'
      setError(msg)
      addLog(`Error: ${msg}`)
    } finally {
      setActiveTaskCount((n) => Math.max(0, n - 1))
    }
  }

  // ---- Dev panel helpers ----

  const openAppFiles = useCallback(async (appSlug: string): Promise<void> => {
    if (!currentProject) return
    const files = await window.avatica.customApps.listFiles(currentProject.id, appSlug)
    const codeFiles = files.filter((f) => !f.isDirectory)

    // Load file contents into editor tabs
    const tabs: OpenFile[] = []
    for (const f of codeFiles) {
      const content = await window.avatica.customApps.readFile(currentProject.id, appSlug, f.name)
      tabs.push({ id: f.name, name: f.name, content, dirty: false })
    }
    // Sort: manifest.json first, then view.html, run.js, estimate.js
    const order = ['manifest.json', 'view.html', 'run.js', 'estimate.js']
    tabs.sort((a, b) => {
      const ai = order.indexOf(a.name)
      const bi = order.indexOf(b.name)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    setDevOpenFiles(tabs)
    setDevActiveTabId(tabs[0]?.id || null)
    setDevOpenAppSlug(appSlug)

    // Show app's files in the browser
    setDevBrowserItems(codeFiles.map((f) => ({ id: f.name, name: f.name })))
  }, [currentProject])

  const openSchemaFile = useCallback(async (schemaId: string): Promise<void> => {
    const content = await window.avatica.customSchemas.read(schemaId)
    setDevOpenFiles([{ id: schemaId, name: `${schemaId}.schema`, content, dirty: false }])
    setDevActiveTabId(schemaId)
    setDevOpenAppSlug(null)
  }, [])

  const handleDevFileClick = useCallback((f: { name: string }) => {
    // If inside an open app, clicking a file switches to its tab
    if (devOpenAppSlug) {
      const tab = devOpenFiles.find((t) => t.name === f.name)
      if (tab) setDevActiveTabId(tab.id)
      return
    }
    // At root level, clicking opens the app/schema
    const item = devBrowserItems.find((i) => i.name === f.name)
    if (!item) return
    if (appMode === 'app-builder') openAppFiles(item.id)
    else if (appMode === 'asset-types') openSchemaFile(item.id)
  }, [appMode, devBrowserItems, devOpenAppSlug, devOpenFiles, openAppFiles, openSchemaFile])

  const reloadDevBrowser = useCallback(() => {
    loadDevRootListing()
  }, [loadDevRootListing])

  const handleDevContentChange = useCallback((content: string): void => {
    setDevOpenFiles((prev) => prev.map((f) =>
      f.id === devActiveTabId ? { ...f, content, dirty: true } : f
    ))
  }, [devActiveTabId])

  const handleDevSaveAll = useCallback(async (): Promise<void> => {
    if (!currentProject) return
    for (const f of devOpenFiles.filter((f) => f.dirty)) {
      if (appMode === 'app-builder' && devOpenAppSlug) {
        await window.avatica.customApps.writeFile(currentProject.id, devOpenAppSlug, f.name, f.content)
      } else if (appMode === 'asset-types') {
        await window.avatica.customSchemas.write(f.id, f.content)
      }
    }
    setDevOpenFiles((prev) => prev.map((f) => ({ ...f, dirty: false })))
  }, [currentProject, devOpenFiles, appMode, devOpenAppSlug])

  const handleNewApp = useCallback(async (): Promise<void> => {
    if (!currentProject) return
    const slug = await window.avatica.customApps.scaffold(currentProject.id, 'My App')
    reloadDevBrowser()
    await openAppFiles(slug)
  }, [currentProject, openAppFiles, reloadDevBrowser])

  const handleNewSchema = useCallback(async (): Promise<void> => {
    const schemaId = await window.avatica.customSchemas.scaffold()
    reloadDevBrowser()
    await openSchemaFile(schemaId)
  }, [openSchemaFile, reloadDevBrowser])

  const handleDevRunApp = useCallback(async (): Promise<void> => {
    if (!currentProject || !devOpenAppSlug) return
    // Save first
    await handleDevSaveAll()
    // Run via the app runner
    handleSelectApp(devOpenAppSlug)
  }, [currentProject, devOpenAppSlug, handleDevSaveAll])

  const handleDevClose = useCallback((): void => {
    setDevOpenFiles([])
    setDevActiveTabId(null)
    setDevOpenAppSlug(null)
    loadDevRootListing()
  }, [loadDevRootListing])

  const handleDevDelete = useCallback(async (name: string): Promise<void> => {
    if (!currentProject) return
    if (appMode === 'app-builder') {
      const item = devBrowserItems.find((i) => i.name === name)
      if (item) {
        await window.avatica.customApps.delete(currentProject.id, item.id)
        // Close if the deleted app was open
        if (devOpenAppSlug === item.id) {
          setDevOpenFiles([])
          setDevActiveTabId(null)
          setDevOpenAppSlug(null)
        }
        loadDevRootListing()
      }
    } else if (appMode === 'asset-types') {
      const item = devBrowserItems.find((i) => i.name === name)
      if (item) {
        await window.avatica.customSchemas.delete(item.id)
        // Close if the deleted schema was open
        if (devActiveTabId === item.id) {
          setDevOpenFiles([])
          setDevActiveTabId(null)
        }
        loadDevRootListing()
      }
    }
  }, [currentProject, appMode, devBrowserItems, devOpenAppSlug, devActiveTabId, loadDevRootListing])

  // ---- Center stage rendering ----

  const renderCenterStage = (): React.JSX.Element => {
    // Active app view
    if (activeAppId) {
      return (
        <div className="center-stage">
          <AppContainer
            appId={activeAppId}
            appName={activeAppName}
            activeTaskCount={activeTaskCount}
            onClose={() => { setActiveAppId(null); dispatch(setAppMode(null)) }}
            onInvoke={handleInvoke}
          />
          {error && (
            <div className="center-stage__error">
              <i className="fa-solid fa-triangle-exclamation" />
              {' '}
              {renderErrorWithSettingsLink(error, () => setShowSettings(true))}
            </div>
          )}
          <OutputGrid outputs={outputs} pendingCount={activeTaskCount} />
        </div>
      )
    }

    // Compose
    if (appMode === 'compose') {
      return (
        <div className="center-stage">
          <Compose onClose={() => dispatch(setAppMode(null))} initialSequenceFile={pendingSequence} onSequenceLoaded={() => setPendingSequence(null)} />
        </div>
      )
    }

    // App Builder / Asset Types
    if (appMode === 'app-builder' || appMode === 'asset-types') {
      return (
        <div className="center-stage">
          <DevPanel
            activeMode={appMode}
            openFiles={devOpenFiles}
            activeTabId={devActiveTabId}
            openAppId={devOpenAppSlug}
            onTabSelect={setDevActiveTabId}
            onClose={handleDevClose}
            onNavigateHome={() => { setDevOpenFiles([]); setDevActiveTabId(null); setDevOpenAppSlug(null); dispatch(setAppMode(null)) }}
            onSaveAll={handleDevSaveAll}
            onRunApp={handleDevRunApp}
            onContentChange={handleDevContentChange}
            onNewApp={handleNewApp}
            onNewSchema={handleNewSchema}
          />
        </div>
      )
    }

    // Default: app grid
    return (
      <div className="center-stage">
        <AppGrid onSelectApp={handleSelectApp} onClose={goToProjects} />
      </div>
    )
  }

  return (
    <div className="workspace">
      <Navbar activeAppId={activeAppId} onAppSelect={handleSelectApp} onClearApp={() => setActiveAppId(null)} />
      <div className="workspace__body">
        {showAssets && (
          <AssetBrowser
            onOpenFile={handleOpenFile}
            title={appMode === 'app-builder' ? (devOpenAppSlug || 'App Builder') : appMode === 'asset-types' ? 'Asset Types' : undefined}
            overrideFiles={devBrowserFiles}
            onFileClick={isDevMode ? handleDevFileClick : undefined}
            onDeleteItem={isDevMode ? handleDevDelete : undefined}
          />
        )}
        {renderCenterStage()}
        {showChat && <ChatPanel />}
      </div>
      {showLog && (
        <LogPanel logs={logs} onClear={() => setLogs([])} onClose={() => dispatch(toggleLog())} />
      )}
      <footer className="status-bar">
        {activeTaskCount === 0 && !hasKeys ? (
          <button
            className="status-bar__status-btn status-bar__status-btn--warn"
            onClick={() => setShowSettings(true)}
            title="No API keys configured — click to open settings"
          >
            <span className="status-bar__dot status-bar__dot--warn" />
            <span className="status-bar__label status-bar__label--warn">No keys</span>
          </button>
        ) : (
          <>
            <span className={`status-bar__dot ${activeTaskCount > 0 ? 'status-bar__dot--active' : 'status-bar__dot--idle'}`} />
            <span className="status-bar__label" style={activeTaskCount > 0 ? { color: 'var(--accent)' } : undefined}>
              {activeTaskCount > 0 ? `${activeTaskCount} running` : 'Ready'}
            </span>
          </>
        )}
        <span className="status-bar__spacer" />
        <button
          className={`status-bar__log-btn ${showLog ? 'status-bar__log-btn--active' : ''}`}
          onClick={() => dispatch(toggleLog())}
        >
          <i className="fa-solid fa-terminal" />
          {' '}Log
          {logs.length > 0 && <span className="status-bar__log-badge">{logs.length}</span>}
        </button>
      </footer>

      {showSettings && (
        <SettingsDialog initialTab="general" onClose={() => { setShowSettings(false); checkKeys() }} />
      )}
    </div>
  )
}
