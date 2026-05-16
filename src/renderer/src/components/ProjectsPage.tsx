import { useEffect, useState, MouseEvent } from 'react'
import { useAppDispatch } from '../store'
import { setCurrentProject } from '../store/uiSlice'
import ThemeToggle from './ThemeToggle'
import SettingsButton from './SettingsButton'
import SettingsDialog from './SettingsDialog'
import UsageBadge from './UsageBadge'
import ContextMenu, { DIVIDER } from './ContextMenu'
import InputDialog from './InputDialog'
import ConfirmDialog from './ConfirmDialog'
import { nameToGradient, timeAgo } from '../helpers'

interface Project {
  id: string
  name: string
  created_at: number
  updated_at: number
}

interface MenuState {
  x: number
  y: number
  project: Project
}

export default function ProjectsPage(): React.JSX.Element {
  const dispatch = useAppDispatch()
  const [projects, setProjects] = useState<Project[]>([])
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renaming, setRenaming] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [hasKeys, setHasKeys] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  const load = async (): Promise<void> => setProjects(await window.avatica.projects.list())
  const checkKeys = async (): Promise<void> => {
    const cfg = await window.avatica.config.get()
    setHasKeys(!!cfg.geminiApiKey || !!cfg.xaiApiKey || !!cfg.openaiApiKey)
  }

  useEffect(() => {
    load()
    checkKeys()
    const handler = (): void => { checkKeys() }
    window.addEventListener('avatica:keys-changed', handler)
    return () => window.removeEventListener('avatica:keys-changed', handler)
  }, [])

  const handleNewProject = async (name: string): Promise<void> => {
    setShowNewProject(false)
    const project = await window.avatica.projects.create(name)
    dispatch(setCurrentProject(project))
  }

  const handleContextMenu = (e: MouseEvent, p: Project): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, project: p })
  }

  const handleRename = async (newName: string): Promise<void> => {
    if (!renaming) return
    await window.avatica.projects.rename(renaming.id, newName)
    setRenaming(null)
    load()
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return
    await window.avatica.projects.delete(deleting.id)
    setDeleting(null)
    load()
  }

  return (
    <div className="projects-page">
      <div className="drag-region">
        <span className="drag-region__title">Avatica</span>
        <div className="drag-region__right">
          <UsageBadge />
          <SettingsButton />
          <ThemeToggle />
        </div>
      </div>
      <div className="projects-page__inner">
        <div className="projects-header">
          <h1 className="projects-header__title">Projects</h1>
          <p className="projects-header__subtitle">Your creative workspace</p>
        </div>
        {!hasKeys && (
          <div className="projects-empty-state">
            <i className="codicon codicon-key projects-empty-state__icon" />
            <h2 className="projects-empty-state__title">No API keys configured</h2>
            <p className="projects-empty-state__body">
              You need a Gemini, xAI, or OpenAI API key to generate images, video, and audio.
            </p>
            <button className="hw-btn" onClick={() => setShowSettings(true)}>
              <span className="hw-btn__face hw-btn__face--active">Open settings</span>
            </button>
          </div>
        )}
        <div className="projects-grid">
          <button className="project-new" onClick={() => setShowNewProject(true)}>
            <span className="project-new__icon">+</span>
            <span className="project-new__label">New Project</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              className="project-card"
              onClick={() => dispatch(setCurrentProject(p))}
              onContextMenu={(e) => handleContextMenu(e, p)}
            >
              <div className="project-card__gradient" style={{ background: nameToGradient(p.name) }} />
              <div className="project-card__body">
                <span className="project-card__time">{timeAgo(p.updated_at)}</span>
                <span className="project-card__name">{p.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {showNewProject && (
        <InputDialog
          title="New Project"
          defaultValue="Untitled Project"
          placeholder="Project name"
          confirmLabel="Create"
          onConfirm={handleNewProject}
          onCancel={() => setShowNewProject(false)}
        />
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            { icon: 'fa-pen', label: 'Rename', onClick: () => { setRenaming(menu.project); setMenu(null) } },
            DIVIDER,
            { icon: 'fa-trash', label: 'Delete', onClick: () => { setDeleting(menu.project); setMenu(null) }, danger: true }
          ]}
          onClose={() => setMenu(null)}
        />
      )}

      {renaming && (
        <InputDialog
          title="Rename Project"
          defaultValue={renaming.name}
          confirmLabel="Rename"
          onConfirm={handleRename}
          onCancel={() => setRenaming(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete Project"
          message={`Are you sure you want to delete "${deleting.name}"? All files will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {showSettings && (
        <SettingsDialog initialTab="general" onClose={() => { setShowSettings(false); checkKeys() }} />
      )}
    </div>
  )
}
