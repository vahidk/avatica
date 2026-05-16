import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppSelector } from '../store'
import { initApp } from '../apps/sdk'
import type { AppFilePickDetail, AppFilePickerElement } from '../apps/types'
import FilePicker from './FilePicker'
import '../apps/sdk.css'

// Register web components (side-effect imports)
import '../apps/components/app-view'
import '../apps/components/app-input'
import '../apps/components/app-select'
import '../apps/components/app-submit'
import '../apps/components/app-file'
import '../apps/components/app-row'
import '../apps/components/app-spacer'
import '../apps/components/app-image-select'
import '../apps/components/app-wizard'
import '../apps/components/app-stepper'
import '../apps/components/app-mode'

interface AppContainerProps {
  appId: string
  appName: string
  activeTaskCount: number
  onClose: () => void
  onInvoke: (appId: string, input: Record<string, unknown>) => Promise<void>
}

export default function AppContainer({ appId, appName, activeTaskCount, onClose, onInvoke }: AppContainerProps): React.JSX.Element {
  const { currentProject } = useAppSelector((s) => s.ui)
  const containerRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [providers, setProviders] = useState<Record<string, Record<string, unknown[]>> | null>(null)
  const [minimized, setMinimized] = useState(false)
  const isLoading = activeTaskCount > 0

  // Load view HTML and providers in parallel
  useEffect(() => {
    window.avatica.apps.viewHtml(appId, currentProject?.id).then(setHtml)

    // Build providers context matching webapp structure
    // { image: { generate: [...] }, video: { generate: [...], interpolate: [...] }, ... }
    Promise.all([
      window.avatica.providers.list('image/generate'),
      window.avatica.providers.list('image/edit'),
      window.avatica.providers.list('video/generate'),
      window.avatica.providers.list('video/image_to_video'),
      window.avatica.providers.list('video/interpolate'),
      window.avatica.providers.list('video/extend'),
      window.avatica.providers.list('audio/generate'),
      window.avatica.providers.list('speech/generate'),
      window.avatica.providers.list('text/generate'),
    ]).then(([imageGen, imageEdit, videoGen, videoI2V, videoInterp, videoExtend, audio, speech, text]) => {
      setProviders({
        image: { generate: imageGen, edit: imageEdit },
        video: { generate: videoGen, image_to_video: videoI2V, interpolate: videoInterp, extend: videoExtend },
        audio: { generate: audio },
        speech: { generate: speech },
        text: { generate: text },
      })
    })
  }, [appId])

  // Handle file picker requests from <app-file> components
  const [pickerState, setPickerState] = useState<{ element: AppFilePickerElement; multiple: boolean; max: number; accept: string; schema: string } | null>(null)

  const handleFilePick = useCallback((e: Event) => {
    const { detail } = e as CustomEvent<AppFilePickDetail>
    setPickerState({ element: detail.element, multiple: detail.multiple, max: detail.max || 0, accept: detail.accept || '', schema: detail.schema || '' })
  }, [])

  // Inject HTML and init SDK only when BOTH html and providers are ready
  useEffect(() => {
    const container = containerRef.current
    if (!container || !html || !providers) return

    // Set providers context BEFORE injecting HTML so connectedCallback can resolve bindings
    const el = container as HTMLDivElement & { __providers?: Record<string, Record<string, unknown[]>> }
    el.__providers = providers
    ;(container as any).__appAssetBase = `app://${appId}/`
    if (currentProject?.id) container.setAttribute('data-project-id', currentProject.id)

    container.innerHTML = html

    const handleEstimate = async (input: Record<string, unknown>): Promise<number | null> => {
      return window.avatica.apps.estimate(appId, input, currentProject?.id)
    }

    const cleanup = initApp({
      container,
      onInvoke: async (input) => { await onInvoke(appId, input) },
      onEstimate: handleEstimate,
      onClose,
    })

    return cleanup
  }, [html, providers, appId])

  // Listen for file picker events (composed events from shadow DOM)
  useEffect(() => {
    document.addEventListener('app-file-pick', handleFilePick)
    return () => document.removeEventListener('app-file-pick', handleFilePick)
  }, [handleFilePick])

  return (
    <div className="app-container">
      <div className="app-container__title">
        <button className="panel-close" onClick={onClose} />
        <button className={minimized ? 'panel-maximize' : 'panel-minimize'} onClick={() => setMinimized((m) => !m)} />
        <span className="app-container__title-text">{appName}</span>
        <span style={{ flex: 1 }} />
        <span className={`app-container__lcd ${isLoading ? 'app-container__lcd--active' : ''}`}>
          {isLoading ? `${activeTaskCount} RUNNING` : 'READY'}
        </span>
      </div>
      <div className="app-container__line" style={minimized ? { display: 'none' } : undefined} />
      <div ref={containerRef} style={minimized ? { display: 'none' } : undefined} />
      {pickerState && (
        <FilePicker
          multiple={pickerState.multiple}
          max={pickerState.max}
          accept={pickerState.accept}
          schema={pickerState.schema}
          onSelect={async (files) => {
            setPickerState(null)
            const projectId = currentProject?.id
            // Set local path as a fallback thumbnailUrl for media files. addFiles overrides
            // this for schema entities (which need their referenced image, not the JSON file).
            const withThumbs = await Promise.all(files.map(async (f) => {
              if (!projectId) return f
              const localPath = await window.avatica.files.getLocalPath(projectId, '', f.name)
              return { ...f, thumbnailUrl: `file://${localPath}` }
            }))
            await pickerState.element.addFiles(withThumbs)
          }}
          onClose={() => setPickerState(null)}
        />
      )}
    </div>
  )
}
