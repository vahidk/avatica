import { useState, useEffect, useMemo } from 'react'
import { useAppSelector } from '../store'
import { fileIcon, getExtensionForSchemaId } from '../helpers'
import TitleBar from './ui/TitleBar'
import Thumbnail from './Thumbnail'

interface FilePickerProps {
  multiple: boolean
  max: number
  accept: string
  /** Only show files of this schema id (e.g. "character.v1"). Empty string disables filtering. */
  schema?: string
  onSelect: (files: { id: string; name: string }[]) => void
  onClose: () => void
}

interface FileEntry {
  name: string
  isDirectory: boolean
  size: number
  mimeType: string | null
}

function matchesAccept(mimeType: string | null, accept: string): boolean {
  if (!accept || !mimeType) return true
  return accept.split(',').some(p => {
    const pat = p.trim()
    if (pat.endsWith('/*')) return mimeType.startsWith(pat.slice(0, -1))
    return mimeType === pat
  })
}

function ThumbnailTile({ file, subPath, isSelected, onClick }: {
  file: FileEntry; projectId: string; subPath: string; isSelected: boolean; onClick: () => void
}): React.JSX.Element {
  return (
    <div onClick={onClick} className="file-picker__tile">
      <div className={`file-picker__tile-thumb ${isSelected ? 'file-picker__tile-thumb--selected' : 'file-picker__tile-thumb--unselected'}`}>
        <Thumbnail name={file.name} mimeType={file.mimeType} isDirectory={false} path={subPath} />
        {isSelected && (
          <div className="file-picker__tile-check">
            <i className="fa-solid fa-check" style={{ fontSize: 8, color: '#fff' }} />
          </div>
        )}
      </div>
      <span className="file-picker__tile-name">{file.name}</span>
    </div>
  )
}

export default function FilePicker({ multiple, max, accept, schema, onSelect, onClose }: FilePickerProps): React.JSX.Element {
  const { currentProject } = useAppSelector((s) => s.ui)
  const [path, setPath] = useState('')
  const [allFiles, setAllFiles] = useState<FileEntry[]>([])
  const [selected, setSelected] = useState<Map<string, { id: string; name: string }>>(new Map())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (!currentProject) return
    window.avatica.files.list(currentProject.id, path).then(setAllFiles)
  }, [currentProject, path])

  const schemaExt = schema ? getExtensionForSchemaId(schema) : undefined

  const files = useMemo(() => {
    return allFiles
      .filter(f => {
        if (f.isDirectory) return true
        if (schemaExt) return f.name.endsWith(schemaExt)
        if (accept && !matchesAccept(f.mimeType, accept)) return false
        return true
      })
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
  }, [allFiles, accept, schemaExt])

  const toggle = (f: FileEntry): void => {
    if (f.isDirectory) {
      setPath(path ? path + '/' + f.name : f.name)
      return
    }
    if (multiple) {
      setSelected(prev => {
        const next = new Map(prev)
        if (next.has(f.name)) next.delete(f.name)
        else if (max <= 0 || next.size < max) next.set(f.name, { id: f.name, name: f.name })
        return next
      })
    } else {
      onSelect([{ id: f.name, name: f.name }])
    }
  }

  const navigateUp = (): void => {
    const parts = path.split('/')
    parts.pop()
    setPath(parts.join('/'))
  }

  const pathParts = path ? path.split('/') : []
  const breadcrumbs: { label: string; path: string }[] = [{ label: 'Root', path: '' }]
  let acc = ''
  for (const part of pathParts) {
    acc += (acc ? '/' : '') + part
    breadcrumbs.push({ label: part, path: acc })
  }

  return (
    <div className="file-picker__overlay" onClick={onClose}>
      <div className="hw-panel file-picker__dialog" onClick={(e) => e.stopPropagation()}>
        <TitleBar title={`Select File${multiple ? 's' : ''}`} onClose={onClose}>
          <button onClick={() => setViewMode('list')} className={`file-picker__view-btn ${viewMode === 'list' ? 'file-picker__view-btn--active' : 'file-picker__view-btn--inactive'}`}>
            <i className="fa-solid fa-list" />
          </button>
          <button onClick={() => setViewMode('grid')} className={`file-picker__view-btn ${viewMode === 'grid' ? 'file-picker__view-btn--active' : 'file-picker__view-btn--inactive'}`}>
            <i className="fa-solid fa-grip" />
          </button>
        </TitleBar>

        {/* Breadcrumbs */}
        <div className="file-picker__breadcrumbs">
          <div className="hw-breadcrumbs">
            {breadcrumbs.map((bc, i) => (
              <span key={bc.path}>
                {i > 0 && <i className="fa-solid fa-chevron-right hw-breadcrumbs__sep" />}
                <span
                  className={`hw-breadcrumbs__crumb ${i === breadcrumbs.length - 1 ? 'hw-breadcrumbs__crumb--current' : 'hw-breadcrumbs__crumb--parent'}`}
                  onClick={() => setPath(bc.path)}
                >{bc.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="file-picker__content">
          {viewMode === 'grid' ? (
            <div className="file-picker__grid">
              {path && (
                <div className="file-picker__grid-item" onClick={navigateUp}>
                  <div className="file-picker__grid-icon-wrap">
                    <i className="fa-solid fa-level-up" style={{ fontSize: 24, color: 'var(--hw-text-dim)' }} />
                  </div>
                  <span className="file-picker__grid-label">..</span>
                </div>
              )}
              {files.map(f => f.isDirectory ? (
                <div key={f.name} className="file-picker__grid-item" onClick={() => toggle(f)}>
                  <div className="file-picker__grid-folder-icon-wrap">
                    <i className="fa-solid fa-folder" style={{ fontSize: 48, color: 'var(--accent)' }} />
                  </div>
                  <span className="file-picker__grid-label">{f.name}</span>
                </div>
              ) : (
                <ThumbnailTile
                  key={f.name}
                  file={f}
                  projectId={currentProject?.id || ''}
                  subPath={path}
                  isSelected={selected.has(f.name)}
                  onClick={() => toggle(f)}
                />
              ))}
            </div>
          ) : (
            <div className="file-picker__list">
              {path && (
                <div className="file-picker__list-item file-picker__list-item--up" onClick={navigateUp}>
                  <i className="fa-solid fa-level-up" style={{ fontSize: 11 }} />
                  <span>..</span>
                </div>
              )}
              {files.map(f => (
                <div key={f.name}
                  className={`file-picker__list-item ${selected.has(f.name) ? 'file-picker__list-item--selected' : ''}`}
                  onClick={() => toggle(f)}
                >
                  <i className={`${f.isDirectory ? 'fa-solid fa-folder' : fileIcon(f.mimeType)} ${f.isDirectory ? 'file-picker__list-icon--folder' : ''}`} style={{ fontSize: 11, color: f.isDirectory ? 'var(--accent)' : 'var(--hw-text-dim)', width: 14 }} />
                  <span className="file-picker__list-file-name">{f.name}</span>
                  {selected.has(f.name) && <i className="fa-solid fa-check" style={{ fontSize: 10, color: 'var(--accent)' }} />}
                </div>
              ))}
            </div>
          )}
          {files.length === 0 && <div className="file-picker__empty">Empty</div>}
        </div>

        {/* Footer */}
        <div className="file-picker__footer">
          <button className="hw-btn" onClick={onClose}>
            <span className="hw-btn__face hw-btn__face--default">Cancel</span>
          </button>
          <span style={{ flex: 1 }} />
          {multiple && (
            <button className="hw-btn" onClick={() => onSelect(Array.from(selected.values()))} disabled={selected.size === 0}>
              <span className={`hw-btn__face ${selected.size > 0 ? 'hw-btn__face--active' : 'hw-btn__face--default'}`}>
                Select{selected.size > 0 ? ` (${selected.size})` : ''}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
