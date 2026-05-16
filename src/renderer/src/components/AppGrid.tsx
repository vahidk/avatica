import { useEffect, useState } from 'react'
import { useAppSelector } from '../store'

const CATEGORY_COLORS: Record<string, string> = {
  'Image': '#3b82f6',
  'Video': '#8b5cf6',
  'Audio': '#ec4899',
  'Speech': '#f59e0b',
  'Script': '#f97316',
  'Other': '#666'
}

interface AppDef {
  id: string
  name: string
  menu: string[]
  order?: number
  icon: string
}

interface AppGridProps {
  onSelectApp: (appId: string) => void
  onClose: () => void
}

function resolveIconClass(icon: string): string {
  if (icon.startsWith('fa-')) return `fa-solid ${icon}`
  return `fa-solid fa-${icon}`
}

export default function AppGrid({ onSelectApp, onClose }: AppGridProps): React.JSX.Element {
  const { currentProject } = useAppSelector((s) => s.ui)
  const [apps, setApps] = useState<AppDef[]>([])

  useEffect(() => {
    if (currentProject) window.avatica.apps.list(currentProject.id).then(setApps)
  }, [currentProject])

  const categories = new Map<string, AppDef[]>()
  for (const app of apps) {
    const cat = app.menu?.[0] || 'Other'
    const list = categories.get(cat) || []
    list.push(app)
    categories.set(cat, list)
  }

  return (
    <div className="hw-panel app-grid">
      <div className="app-grid__tabs">
        <button className="panel-close app-grid__close" onClick={onClose} />
        <span className="app-grid__tab app-grid__tab--active">General</span>
      </div>
      <div className="app-grid__tab-line" />
      <div className="app-grid__body">
        {Array.from(categories).map(([category, catApps]) => {
          const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other']
          return (
            <div key={category} className="app-grid__category">
              <div className="app-grid__category-header">
                <span className="app-grid__category-dot" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
                <span className="app-grid__category-name">{category}</span>
              </div>
              <div className="app-grid__cards">
                {catApps.map((app) => (
                  <button key={app.id} className="app-card" onClick={() => onSelectApp(app.id)}>
                    <div className="app-card__inner">
                      <i className={`${resolveIconClass(app.icon)} app-card__icon`} style={{ color }} />
                      <span className="app-card__name">{app.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
