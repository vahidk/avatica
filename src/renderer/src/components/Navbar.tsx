import { useRef, useEffect, useState } from 'react'
import { useAppSelector, useAppDispatch } from '../store'
import { setCurrentProject, setAppMode, toggleAssets, toggleLog, toggleChat } from '../store/uiSlice'
import ThemeToggle from './ThemeToggle'
import SettingsButton from './SettingsButton'
import UsageBadge from './UsageBadge'

interface AppDef {
  id: string
  name: string
  menu: string[]
  icon: string
  order?: number
}

function resolveIconClass(icon: string): string {
  if (icon.startsWith('fa-')) return `fa-solid ${icon}`
  return `fa-solid fa-${icon}`
}

interface NavbarProps {
  activeAppId?: string | null
  onAppSelect?: (appId: string) => void
  onClearApp?: () => void
}

export default function Navbar({ activeAppId, onAppSelect, onClearApp }: NavbarProps): React.JSX.Element {
  const dispatch = useAppDispatch()
  const { currentProject, appMode, showAssets, showLog, showChat } = useAppSelector((s) => s.ui)
  const pillRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const createBtnRef = useRef<HTMLButtonElement>(null)
  const developBtnRef = useRef<HTMLButtonElement>(null)
  const [apps, setApps] = useState<AppDef[]>([])
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Derive effective active mode: activeAppId means "create" visually
  const effectiveMode = activeAppId ? 'create' : appMode
  const isDevMode = effectiveMode === 'app-builder' || effectiveMode === 'asset-types'

  const updatePill = (): void => {
    if (!pillRef.current || !trackRef.current) return
    const active = trackRef.current.querySelector('.mode-control__btn--active') as HTMLElement
    if (!active) {
      pillRef.current.style.width = '0px'
      return
    }
    pillRef.current.style.left = active.offsetLeft + 'px'
    pillRef.current.style.width = active.offsetWidth + 'px'
  }

  useEffect(() => { requestAnimationFrame(updatePill) }, [effectiveMode])


  useEffect(() => {
    if (currentProject) window.avatica.apps.list(currentProject.id).then(setApps)
  }, [currentProject])

  const handleBack = (): void => { dispatch(setCurrentProject(null)) }

  const handleModeClick = (modeId: string, hasMenu: boolean): void => {
    if (hasMenu) {
      setOpenMenu(openMenu === modeId ? null : modeId)
    } else {
      setOpenMenu(null)
      // Toggle: if already active, go to null (app grid)
      onClearApp?.()  // clear active app when switching modes
      dispatch(setAppMode(effectiveMode === modeId ? null : modeId as any))
    }
  }

  // Group apps by category
  const appGroups: Record<string, AppDef[]> = {}
  for (const app of apps) {
    const cat = app.menu?.[0] || 'Other'
    ;(appGroups[cat] ||= []).push(app)
  }

  return (
    <div className="navbar">
      <div className="navbar__left">
        <button className="navbar__back" onClick={handleBack} title="Back to projects">
          <i className="fa-solid fa-grip" />
        </button>
        <span className="navbar__project-name">{currentProject?.name}</span>
      </div>
      <div className="navbar__center">
        <div className="mode-control" ref={trackRef}>
          <div className="mode-control__pill" ref={pillRef} />

          <button
            ref={createBtnRef}
            className={`mode-control__btn${effectiveMode === 'create' ? ' mode-control__btn--active' : ''}`}
            onClick={() => handleModeClick('create', true)}
          >
            <i className="fa-solid fa-plus" /> Create
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mode-control__chevron"><polyline points="6 9 12 15 18 9" /></svg>
          </button>

          <button
            className={`mode-control__btn${effectiveMode === 'compose' ? ' mode-control__btn--active' : ''}`}
            onClick={() => handleModeClick('compose', false)}
          >
            <i className="fa-solid fa-film" /> Compose
          </button>

          <button
            ref={developBtnRef}
            className={`mode-control__btn${isDevMode ? ' mode-control__btn--active' : ''}`}
            onClick={() => handleModeClick('develop', true)}
          >
            <i className="fa-solid fa-code" /> Develop
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mode-control__chevron"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {openMenu && (
            <>
              <div className="create-dropdown__backdrop" onClick={() => setOpenMenu(null)} />
              {openMenu === 'create' && (
                <div className="create-dropdown" style={{
                  left: createBtnRef.current ? createBtnRef.current.offsetLeft : 0
                }}>
                  {Object.entries(appGroups).sort(([, a], [, b]) => (a[0]?.order ?? 999) - (b[0]?.order ?? 999)).map(([category, groupApps], gi) => (
                    <div key={category}>
                      {gi > 0 && <div className="create-dropdown__divider" />}
                      <div className="create-dropdown__category-label">{category}</div>
                      {groupApps.map(app => (
                        <button key={app.id} className="create-dropdown__item" onClick={() => {
                          dispatch(setAppMode(null))
                          onAppSelect?.(app.id)
                          setOpenMenu(null)
                        }}>
                          <i className={`${resolveIconClass(app.icon)} create-dropdown__item-icon`} />
                          {app.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {openMenu === 'develop' && (
                <div className="create-dropdown" style={{
                  left: developBtnRef.current ? developBtnRef.current.offsetLeft : 0
                }}>
                  <button className="create-dropdown__item" onClick={() => {
                    onClearApp?.()
                    dispatch(setAppMode('app-builder'))
                    setOpenMenu(null)
                  }}>
                    <i className="fa-solid fa-puzzle-piece create-dropdown__item-icon" />
                    App Builder
                  </button>
                  <button className="create-dropdown__item" onClick={() => {
                    onClearApp?.()
                    dispatch(setAppMode('asset-types'))
                    setOpenMenu(null)
                  }}>
                    <i className="fa-solid fa-database create-dropdown__item-icon" />
                    Asset Types
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="navbar__right">
        <UsageBadge />
        <SettingsButton />
        <ThemeToggle />
        <button
          className={`navbar__toggle${showAssets ? ' navbar__toggle--active' : ''}`}
          onClick={() => dispatch(toggleAssets())}
          title="Assets"
        >
          <i className="codicon codicon-layout-sidebar-left" />
        </button>
        <button
          className={`navbar__toggle${showLog ? ' navbar__toggle--active' : ''}`}
          onClick={() => dispatch(toggleLog())}
          title="Log"
        >
          <i className="codicon codicon-layout-panel" />
        </button>
        <button
          className={`navbar__toggle${showChat ? ' navbar__toggle--active' : ''}`}
          onClick={() => dispatch(toggleChat())}
          title="Chat"
        >
          <i className="codicon codicon-layout-sidebar-right" />
        </button>
      </div>
    </div>
  )
}
