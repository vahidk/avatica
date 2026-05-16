import { useEffect, useState, useCallback, useRef, DragEvent, MouseEvent, KeyboardEvent } from 'react'
import { useAppSelector, useAppDispatch } from '../store'
import { setCurrentPath, setViewMode, setSearchQuery, toggleAssets } from '../store/uiSlice'
import { fileIcon, formatSize } from '../helpers'
import ContextMenu, { DIVIDER } from './ContextMenu'
import ConfirmDialog from './ConfirmDialog'
import Thumbnail from './Thumbnail'
import FilePreview from './FilePreview'

interface FileEntry {
  name: string
  isDirectory: boolean
  size: number
  mimeType: string | null
  modifiedAt: number
}

interface MenuState {
  x: number
  y: number
  items: { icon: string; label: string; onClick: () => void; danger?: boolean }[]
}

interface AssetBrowserProps {
  onOpenFile?: (fileName: string, mimeType: string | null) => void
  title?: string
  overrideFiles?: FileEntry[]
  onFileClick?: (f: FileEntry) => void
  onDeleteItem?: (name: string) => void
}

export default function AssetBrowser({ onOpenFile, title: titleOverride, overrideFiles, onFileClick, onDeleteItem }: AssetBrowserProps = {}): React.JSX.Element {
  const dispatch = useAppDispatch()
  // schemaIcons subscription ensures re-render when schema icon map loads
  const { currentProject, currentPath, viewMode, searchQuery, fileRefreshCounter, schemaIcons: _ } = useAppSelector((s) => s.ui)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<FileEntry | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (overrideFiles) { setFiles(overrideFiles); return }
    if (!currentProject) return
    let result = await window.avatica.files.list(currentProject.id, currentPath)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((f) => f.name.toLowerCase().includes(q))
    }
    setFiles(result)
  }, [currentProject, currentPath, searchQuery, fileRefreshCounter, overrideFiles])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      const dotIdx = renaming.lastIndexOf('.')
      renameRef.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : renaming.length)
    }
  }, [renaming])

  const navigateUp = (): void => {
    const parts = currentPath.split('/')
    parts.pop()
    dispatch(setCurrentPath(parts.join('/')))
  }

  const openFolder = (name: string): void => {
    dispatch(setCurrentPath(currentPath ? currentPath + '/' + name : name))
  }

  // File drop via custom event from preload
  useEffect(() => {
    const handler = async (e: Event): Promise<void> => {
      const paths = (e as CustomEvent).detail?.paths as string[]
      if (!paths?.length || !currentProject) return
      await window.avatica.files.import(currentProject.id, currentPath, paths)
      await load()
    }
    window.addEventListener('avatica:file-drop', handler)
    return () => window.removeEventListener('avatica:file-drop', handler)
  }, [currentProject, currentPath, load])

  const handleDragOver = (e: DragEvent): void => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent): void => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver(false)
  }

  const handleDragStart = (e: DragEvent, f: FileEntry): void => {
    // Set data for both internal moves and timeline drops
    e.dataTransfer.setData('text/x-avatica-name', f.name)
    e.dataTransfer.setData('text/x-avatica-path', currentPath)
    e.dataTransfer.setData('text/x-avatica-file-id', f.name)
    e.dataTransfer.setData('text/x-avatica-file-name', f.name)
    e.dataTransfer.setData('text/x-avatica-file-type', f.mimeType || '')
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  const handleDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleInternalDrop = async (e: DragEvent, destFolder: string): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    const dragName = e.dataTransfer.getData('text/x-avatica-name')
    const dragPath = e.dataTransfer.getData('text/x-avatica-path')
    if (dragName && currentProject) {
      const dest = currentPath ? currentPath + '/' + destFolder : destFolder
      await window.avatica.files.move(currentProject.id, dragPath, dragName, dest)
      load()
    }
  }

  // ---- Actions ----

  const handleNewFolder = async (): Promise<void> => {
    if (!currentProject) return
    let name = 'New Folder'
    let i = 2
    const existing = new Set(files.filter((f) => f.isDirectory).map((f) => f.name))
    while (existing.has(name)) { name = `New Folder ${i++}` }
    await window.avatica.files.createFolder(currentProject.id, currentPath, name)
    await load()
    setRenaming(name)
  }

  const handleDelete = (name: string): void => {
    setDeleting(name)
  }

  const confirmDelete = async (): Promise<void> => {
    if (!currentProject || !deleting) return
    const localPath = await window.avatica.files.getLocalPath(currentProject.id, currentPath, deleting)
    await window.avatica.files.delete(currentProject.id, currentPath, deleting)
    window.dispatchEvent(new CustomEvent('avatica:file-deleted', { detail: { name: deleting, path: localPath } }))
    setDeleting(null)
    load()
  }

  const openPreview = (f: FileEntry): void => {
    if (onFileClick) { onFileClick(f); return }
    if (f.isDirectory) return
    if (f.name.endsWith('.seq') && onOpenFile) {
      onOpenFile(f.name, f.mimeType)
      return
    }
    setPreviewing(f)
  }

  const previewableFiles = files.filter((f) => !f.isDirectory)

  const previewNav = (dir: -1 | 1): void => {
    if (!previewing) return
    const idx = previewableFiles.findIndex((f) => f.name === previewing.name)
    const next = previewableFiles[idx + dir]
    if (next) setPreviewing(next)
  }

  const startRename = (name: string): void => {
    setRenaming(name)
  }

  const commitRename = async (oldName: string, newName: string): Promise<void> => {
    setRenaming(null)
    if (!currentProject || !newName || newName === oldName) return
    await window.avatica.files.rename(currentProject.id, currentPath, oldName, newName)
    await load()
  }

  const handleRenameKeyDown = (e: KeyboardEvent, oldName: string): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename(oldName, (e.target as HTMLInputElement).value.trim())
    } else if (e.key === 'Escape') {
      setRenaming(null)
    }
  }

  const revealInFinder = (subPath?: string): void => {
    if (!currentProject) return
    const fullSub = subPath ? (currentPath ? currentPath + '/' + subPath : subPath) : currentPath
    window.avatica.files.openInExplorer(currentProject.id, fullSub)
  }

  // ---- Context menus ----

  const showFileMenu = (e: MouseEvent, f: FileEntry): void => {
    e.preventDefault()
    e.stopPropagation()
    const items: MenuState['items'] = []
    if (f.isDirectory) {
      items.push({ icon: 'fa-folder-open', label: 'Open', onClick: () => openFolder(f.name) })
    } else {
      items.push({ icon: 'fa-eye', label: 'Open', onClick: () => openPreview(f) })
    }
    items.push({ icon: 'fa-pen', label: 'Rename', onClick: () => startRename(f.name) })
    items.push({ icon: 'fa-arrow-up-right-from-square', label: 'Reveal in Finder', onClick: () => revealInFinder(f.isDirectory ? f.name : undefined) })
    items.push(DIVIDER)
    items.push({ icon: 'fa-trash', label: 'Delete', onClick: () => onDeleteItem ? onDeleteItem(f.name) : handleDelete(f.name), danger: true })
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  const showBackgroundMenu = (e: MouseEvent): void => {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { icon: 'fa-folder-plus', label: 'New Folder', onClick: handleNewFolder },
        { icon: 'fa-arrow-up-right-from-square', label: 'Reveal in Finder', onClick: () => revealInFinder() }
      ]
    })
  }

  // ---- Breadcrumbs ----

  const pathParts = currentPath ? currentPath.split('/') : []
  const breadcrumbs: { label: string; path: string }[] = [{ label: 'Root', path: '' }]
  let acc = ''
  for (const part of pathParts) {
    acc += (acc ? '/' : '') + part
    breadcrumbs.push({ label: part, path: acc })
  }

  // ---- Render items ----

  const renderItem = (f: FileEntry): React.JSX.Element => {
    const icon = f.isDirectory ? 'fa-solid fa-folder' : fileIcon(f.mimeType, f.name)
    const isRenaming = renaming === f.name

    if (viewMode === 'grid') {
      return (
        <div
          key={f.name}
          className="grid-tile"
          draggable={!isRenaming}
          onDragStart={!isRenaming ? (e) => handleDragStart(e, f) : undefined}
          onClick={() => !isRenaming && (onFileClick ? onFileClick(f) : f.isDirectory ? openFolder(f.name) : openPreview(f))}
          onContextMenu={(e) => showFileMenu(e, f)}
          onDragOver={f.isDirectory && !onFileClick ? (e) => e.preventDefault() : undefined}
          onDrop={f.isDirectory && !onFileClick ? (e) => handleInternalDrop(e, f.name) : undefined}
        >
          <Thumbnail name={f.name} mimeType={f.mimeType} isDirectory={f.isDirectory} />
          {isRenaming ? (
            <input
              ref={renameRef}
              className="grid-tile__rename"
              defaultValue={f.name}
              onKeyDown={(e) => handleRenameKeyDown(e, f.name)}
              onBlur={(e) => commitRename(f.name, e.target.value.trim())}
            />
          ) : (
            <span className="grid-tile__name">{f.name}</span>
          )}
        </div>
      )
    }

    return (
      <div
        key={f.name}
        className="file-row"
        draggable={!isRenaming}
        onDragStart={!isRenaming ? (e) => handleDragStart(e, f) : undefined}
        onClick={() => !isRenaming && (onFileClick ? onFileClick(f) : f.isDirectory ? openFolder(f.name) : openPreview(f))}
        onContextMenu={(e) => showFileMenu(e, f)}
        onDragOver={f.isDirectory ? (e) => e.preventDefault() : undefined}
        onDrop={f.isDirectory ? (e) => handleInternalDrop(e, f.name) : undefined}
      >
        <i className={`${icon} file-row__icon${f.isDirectory ? ' file-row__icon--folder' : ''}`} />
        {isRenaming ? (
          <input
            ref={renameRef}
            className="file-row__rename"
            defaultValue={f.name}
            onKeyDown={(e) => handleRenameKeyDown(e, f.name)}
            onBlur={(e) => commitRename(f.name, e.target.value.trim())}
          />
        ) : (
          <>
            <span className="file-row__name">{f.name}</span>
            {!f.isDirectory && <span className="file-row__size">{formatSize(f.size)}</span>}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="hw-panel panel--left">
      <div className="hw-panel__title">
        <button className="panel-close" onClick={() => dispatch(toggleAssets())} />
        <span className="hw-panel__title-text">{titleOverride || 'Assets'}</span>
        <span className="hw-panel__title-spacer" />
        <button
          className={`hw-panel__title-btn${viewMode === 'list' ? ' hw-panel__title-btn--active' : ''}`}
          onClick={() => dispatch(setViewMode('list'))}
        >
          <i className="fa-solid fa-list" />
        </button>
        <button
          className={`hw-panel__title-btn${viewMode === 'grid' ? ' hw-panel__title-btn--active' : ''}`}
          onClick={() => dispatch(setViewMode('grid'))}
        >
          <i className="fa-solid fa-grip" />
        </button>
      </div>
      <div className="hw-panel__line" />
      <div className="asset-browser__controls">
        <div className="hw-breadcrumbs">
          {breadcrumbs.map((bc, i) => (
            <span key={bc.path}>
              {i > 0 && <i className="fa-solid fa-chevron-right hw-breadcrumbs__sep" />}
              <span
                className={`hw-breadcrumbs__crumb ${i === breadcrumbs.length - 1 ? 'hw-breadcrumbs__crumb--current' : 'hw-breadcrumbs__crumb--parent'}`}
                onClick={() => dispatch(setCurrentPath(bc.path))}
              >
                {bc.label}
              </span>
            </span>
          ))}
        </div>
        <div className="asset-browser__search">
          <i className="fa-solid fa-magnifying-glass asset-browser__search-icon" />
          <input
            type="text"
            className="asset-browser__search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
          />
        </div>
      </div>
      <div
        className={`hw-panel__content asset-browser__file-area${dragOver ? ' drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={showBackgroundMenu}
      >
        {files.length === 0 && !currentPath && !searchQuery && (
          <div className="asset-browser__empty">No assets yet<br />Drop files here to upload</div>
        )}
        {files.length === 0 && searchQuery && (
          <div className="asset-browser__empty">No results</div>
        )}
        {(files.length > 0 || currentPath) && (
          <div className={viewMode === 'grid' ? 'file-grid' : 'file-list'}>
            {currentPath && viewMode === 'grid' && (
              <div className="up-tile" onClick={navigateUp}>
                <div className="up-tile__icon"><i className="fa-solid fa-arrow-up" /></div>
                <span className="up-tile__label">..</span>
              </div>
            )}
            {currentPath && viewMode === 'list' && (
              <div className="up-row" onClick={navigateUp}>
                <i className="fa-solid fa-arrow-up file-row__icon" />
                <span className="file-row__name">..</span>
              </div>
            )}
            {files.map(renderItem)}
          </div>
        )}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {previewing && (
        <FilePreview
          name={previewing.name}
          mimeType={previewing.mimeType}
          size={previewing.size}
          onClose={() => setPreviewing(null)}
          onPrev={previewableFiles.indexOf(previewing) > 0 ? () => previewNav(-1) : undefined}
          onNext={previewableFiles.indexOf(previewing) < previewableFiles.length - 1 ? () => previewNav(1) : undefined}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete"
          message={`Are you sure you want to delete "${deleting}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
