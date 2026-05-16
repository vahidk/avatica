import { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import { useAppSelector } from '../store'
import { formatSize, isSchemaFile, getSchemaThumbnailPathForFile } from '../helpers'
import HwAudioPlayer from './hw/HwAudioPlayer'
import TitleBar from './ui/TitleBar'

interface FilePreviewProps {
  name: string
  mimeType: string | null
  size: number
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

export default function FilePreview({ name, mimeType, size, onClose, onPrev, onNext }: FilePreviewProps): React.JSX.Element {
  const { currentProject, currentPath } = useAppSelector((s) => s.ui)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { ref.current?.focus() }, [name])

  useEffect(() => {
    if (!currentProject) return
    window.avatica.files.getLocalPath(currentProject.id, currentPath, name).then(setFilePath)
  }, [currentProject, currentPath, name])

  // Load text content for text/json/schema files
  const isSchema = isSchemaFile(name)
  const isText = isSchema || mimeType?.startsWith('text/') || mimeType === 'application/json' || name.endsWith('.md') || name.endsWith('.txt')
  useEffect(() => {
    if (!isText || !currentProject) return
    window.avatica.files.readText(currentProject.id, currentPath, name).then(setTextContent).catch(() => setTextContent('Failed to load.'))
  }, [currentProject, currentPath, name, isText])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft' && onPrev) onPrev()
    if (e.key === 'ArrowRight' && onNext) onNext()
  }

  const fileUrl = filePath ? `file://${filePath}` : ''

  return (
    <div
      className="file-preview"
      tabIndex={0}
      ref={ref}
      onKeyDown={handleKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="file-preview__content"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {!filePath ? (
          <div className="file-preview__status">Loading...</div>
        ) : isSchema && textContent !== null ? (
          <AssetViewer content={textContent} name={name} projectDir={currentProject ? `${currentProject.id}` : ''} currentPath={currentPath} onClose={onClose} />
        ) : mimeType?.startsWith('image/') ? (
          <ImageViewer url={fileUrl} name={name} onClose={onClose} />
        ) : mimeType?.startsWith('video/') ? (
          <VideoViewer url={fileUrl} />
        ) : mimeType?.startsWith('audio/') ? (
          <AudioViewer url={fileUrl} name={name} mimeType={mimeType} onClose={onClose} />
        ) : (name.endsWith('.md') || mimeType === 'text/markdown') && textContent !== null ? (
          <MarkdownViewer content={textContent} name={name} onClose={onClose} />
        ) : isText && textContent !== null ? (
          <TextView content={textContent} name={name} onClose={onClose} />
        ) : (
          <GenericViewer name={name} mimeType={mimeType} size={size} />
        )}
      </div>
    </div>
  )
}

function ImageViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div className="image-viewer">
      <img src={url} alt={name} className="image-viewer__img" />
      <div className="image-viewer__title">{name}</div>
      <div className="image-viewer__actions">
        <button className="image-viewer__action-btn" onClick={onClose}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
    </div>
  )
}

function VideoViewer({ url }: { url: string }) {
  return <video src={url} controls autoPlay className="video-viewer" />
}

function AudioViewer({ url, name, mimeType, onClose }: { url: string; name: string; mimeType: string; onClose: () => void }) {
  const displayName = name.replace(/\.[^.]+$/, '')

  return (
    <div className="audio-viewer">
      <div className="audio-viewer__title-bar">
        <button className="panel-close" onClick={onClose} />
        <span className="audio-viewer__title-text">Audio Player</span>
      </div>
      <div className="audio-viewer__title-line" />
      <div className="audio-viewer__body">
        <HwAudioPlayer url={url} name={displayName} meta={mimeType} />
      </div>
    </div>
  )
}

function MarkdownViewer({ content, onClose }: { content: string; name: string; onClose: () => void }) {
  return (
    <div className="markdown-viewer" onClick={(e) => e.stopPropagation()}>
      <div className="markdown-viewer__close">
        <button className="panel-close" onClick={onClose} />
      </div>
      <div className="markdown-viewer__content"><Markdown>{content}</Markdown></div>
    </div>
  )
}

function TextView({ content, name, onClose }: { content: string; name: string; onClose: () => void }) {
  const isJson = name.endsWith('.json')
  let displayContent = content
  if (isJson) {
    try { displayContent = JSON.stringify(JSON.parse(content), null, 2) } catch { /* use raw */ }
  }

  return (
    <div className="text-viewer" onClick={(e) => e.stopPropagation()}>
      <div className="text-viewer__header">
        <button className="panel-close" onClick={onClose} />
        <span className="text-viewer__title">{name}</span>
      </div>
      <div className="text-viewer__line" />
      <pre className="text-viewer__content">{displayContent}</pre>
    </div>
  )
}

function GenericViewer({ name, mimeType, size }: { name: string; mimeType: string | null; size: number }) {
  return (
    <div className="generic-viewer">
      <i className="fa-solid fa-file generic-viewer__icon" />
      <div className="generic-viewer__name">{name}</div>
      <div className="generic-viewer__meta">
        {mimeType || 'Unknown type'} {size ? `· ${formatSize(size)}` : ''}
      </div>
    </div>
  )
}

const ASSET_SKIP_KEYS = new Set(['name', 'references', 'tags'])

function AssetViewer({ content, name, projectDir, currentPath, onClose }: {
  content: string; name: string; projectDir: string; currentPath: string; onClose: () => void
}): React.JSX.Element {
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null)

  let data: Record<string, any>
  try { data = JSON.parse(content) } catch { data = {} }

  // Resolve the portrait via the schema-declared thumbnail path (e.g. character.v1
  // → "references.front", shot.v1 → "references.frame"). Falls back to references.front.
  const thumbField = getSchemaThumbnailPathForFile(name) || 'references.front'
  const refImage = thumbField.split('.').reduce<any>((acc, key) => acc?.[key], data)
  const portraitFile = typeof refImage === 'string' && refImage ? refImage : undefined
  const isLandscape = name.endsWith('.scene') || name.endsWith('.shot')

  useEffect(() => {
    if (!portraitFile || !projectDir) return
    window.avatica.files.getLocalPath(projectDir, currentPath, portraitFile).then((p) => {
      setPortraitUrl(`file://${p}`)
    }).catch(() => {})
  }, [portraitFile, projectDir, currentPath])

  const displayName = String(data.name || name)
  const tags = Array.isArray(data.tags) ? data.tags as string[] : []

  const textFields: { key: string; value: string }[] = []
  const groups: { key: string; entries: [string, string][] }[] = []

  for (const [key, value] of Object.entries(data)) {
    if (ASSET_SKIP_KEYS.has(key)) continue
    if (typeof value === 'string' && value) {
      textFields.push({ key, value })
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string' && v)
        .map(([k, v]) => [k, String(v)] as [string, string])
      if (entries.length > 0) groups.push({ key, entries })
    }
  }

  return (
    <div className={`character-viewer ${isLandscape ? 'character-viewer--landscape' : ''}`} onClick={(e) => e.stopPropagation()}>
      <TitleBar title={displayName} onClose={onClose} />
      <div className="character-viewer__body">
        <div className={`character-viewer__portrait ${isLandscape ? 'character-viewer__portrait--landscape' : ''}`}>
          {portraitUrl ? (
            <img src={portraitUrl} alt={displayName} className="character-viewer__portrait-img" />
          ) : (
            <div className={`character-viewer__portrait-placeholder ${isLandscape ? 'character-viewer__portrait-placeholder--landscape' : ''}`}>
              <i className={`fa-solid ${isLandscape ? 'fa-mountain-sun' : 'fa-user'}`} />
            </div>
          )}
        </div>
        <div className="character-viewer__info">
          <div className="character-viewer__name">{displayName}</div>
          {textFields.map((f) => (
            <div key={f.key} className="character-viewer__description">{f.value}</div>
          ))}
          {groups.map((g) => (
            <div key={g.key} className="character-viewer__attributes">
              {g.entries.map(([key, value]) => (
                <div key={key} className="character-viewer__attr">
                  <span className="character-viewer__attr-key">{key}</span>
                  <span className="character-viewer__attr-value">{value}</span>
                </div>
              ))}
            </div>
          ))}
          {tags.length > 0 && (
            <div className="character-viewer__tags">
              {tags.map((tag) => (
                <span key={tag} className="character-viewer__tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
