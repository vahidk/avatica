import { useEffect, useState } from 'react'
import { useAppSelector, useAppDispatch } from './store'
import { setCurrentProject, setAppMode, setSchemaIcons } from './store/uiSlice'
import { setSchemaMap } from './helpers'
import ProjectsPage from './components/ProjectsPage'
import Workspace from './components/Workspace'
import AboutDialog from './components/AboutDialog'
import SettingsDialog from './components/SettingsDialog'

function App(): React.JSX.Element {
  const dispatch = useAppDispatch()
  const project = useAppSelector((s) => s.ui.currentProject)
  const theme = useAppSelector((s) => s.ui.theme)

  // Load schema map on startup (extension → { icon, thumbnailPath, schemaId })
  useEffect(() => {
    window.avatica.schemas.list().then((schemas) => {
      const map = new Map<string, { icon: string; thumbnailPath?: string; schemaId: string }>()
      const iconRecord: Record<string, string> = {}
      for (const s of schemas) {
        if (s.extension && s.icon) {
          map.set(s.extension, { icon: s.icon, thumbnailPath: s.thumbnail, schemaId: s.id })
          iconRecord[s.extension] = s.icon
        }
      }
      setSchemaMap(map)
      dispatch(setSchemaIcons(iconRecord))
    })
  }, [])
  const [showAbout, setShowAbout] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [externalSeqFile, setExternalSeqFile] = useState<string | null>(null)

  // Auto-open settings if no API key configured
  useEffect(() => {
    window.avatica.config.get().then((cfg) => {
      if (!cfg.geminiApiKey && !cfg.xaiApiKey && !cfg.openaiApiKey) setShowSettings(true)
    })
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const unsubAbout = window.avatica.onShowAbout(() => setShowAbout(true))

    // Handle .seq file opened from Finder
    const unsubSeq = window.avatica.onOpenSeqFile(async (filePath: string) => {
      // Find which project this file belongs to by checking the path
      const rootDir = await window.avatica.config.getRootDir()
      if (!filePath.startsWith(rootDir)) return

      const relative = filePath.slice(rootDir.length + 1) // e.g. "my-project/Sequence.seq"
      const slashIdx = relative.indexOf('/')
      if (slashIdx < 0) return

      const projectId = relative.slice(0, slashIdx)
      const fileName = relative.slice(slashIdx + 1)

      // Open the project
      const proj = await window.avatica.projects.get(projectId)
      if (!proj) return

      dispatch(setCurrentProject(proj))
      dispatch(setAppMode('compose'))
      setExternalSeqFile(fileName)
    })

    return () => {
      unsubAbout()
      unsubSeq()
    }
  }, [dispatch])

  return (
    <>
      {project ? <Workspace externalSeqFile={externalSeqFile} onExternalSeqHandled={() => setExternalSeqFile(null)} /> : <ProjectsPage />}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showSettings && <SettingsDialog initialTab="general" onClose={() => setShowSettings(false)} />}
    </>
  )
}

export default App
