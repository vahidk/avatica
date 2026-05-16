import { useState, useCallback, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Panel from '../components/ui/Panel'
import FilePicker from '../components/FilePicker'
import CircleButton from '../components/hw/CircleButton'
import Lcd from '../components/hw/Lcd'
import HwButton from '../components/hw/HwButton'
import HwInput from '../components/hw/HwInput'
import HwSelect from '../components/hw/HwSelect'

import type { Track } from './types'
import Timeline from './Timeline'
import { usePlayback } from './usePlayback'
import { useClipPreviews } from './useClipPreviews'
import { useExport } from './useExport'
import {
  selectSequence, setSequence, loadSequence, newSequence, markClean,
  selectCanUndo, selectCanRedo, selectComposeDirty, selectSequenceId, setSequenceId
} from '../store/composeSlice'
import { ActionCreators } from 'redux-undo'
import { bumpFileRefresh } from '../store/uiSlice'
import { useAppSelector } from '../store'
import './compose.css'

interface ComposeProps {
  onClose: () => void
  initialSequenceFile?: string | null
  onSequenceLoaded?: () => void
}

export default function Compose({ onClose, initialSequenceFile, onSequenceLoaded }: ComposeProps) {
  const dispatch = useDispatch()
  const { currentProject } = useAppSelector((s) => s.ui)
  const projectId = currentProject?.id || ''
  const sequence = useSelector(selectSequence)
  const sequenceId = useSelector(selectSequenceId)
  const canUndo = useSelector(selectCanUndo)
  const canRedo = useSelector(selectCanRedo)
  const dirty = useSelector(selectComposeDirty)

  const [timelineHeight, setTimelineHeight] = useState(200)
  const [dragging, setDragging] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadPickerOpen, setLoadPickerOpen] = useState(false)
  const [allFiles, setAllFiles] = useState<any[]>([])

  useEffect(() => {
    if (!projectId) return
    window.avatica.files.list(projectId, '').then(setAllFiles)
  }, [projectId])

  const [mediaDurations, setMediaDurations] = useState<Map<string, number>>(() => new Map())

  // Probe durations for media files
  useEffect(() => {
    if (!projectId) return
    const probed = new Set<string>()
    for (const f of allFiles) {
      if (f.isDirectory || probed.has(f.name)) continue
      const mime = f.mimeType || ''
      if (!mime.startsWith('audio/') && !mime.startsWith('video/')) continue
      probed.add(f.name)
      window.avatica.files.getLocalPath(projectId, '', f.name).then(filePath => {
        const el = document.createElement(mime.startsWith('video/') ? 'video' : 'audio')
        el.preload = 'metadata'
        el.src = `file://${filePath}`
        el.onloadedmetadata = () => {
          const ms = Math.round(el.duration * 1000)
          setMediaDurations(prev => new Map(prev).set(f.name, ms))
          el.src = ''
        }
      })
    }
  }, [allFiles, projectId])

  // Load initial sequence file if provided
  useEffect(() => {
    if (!initialSequenceFile || !projectId) return
    window.avatica.files.readText(projectId, '', initialSequenceFile).then(text => {
      try {
        const json = JSON.parse(text)
        if (json.settings && json.tracks) {
          dispatch(loadSequence(json))
          dispatch(ActionCreators.clearHistory())
          dispatch(setSequenceId(initialSequenceFile))
        }
      } catch (err) {
        console.error('Failed to load sequence:', err)
      }
      onSequenceLoaded?.()
    })
  }, [initialSequenceFile, projectId, dispatch, onSequenceLoaded])

  const handleLoadFile = useCallback(async (files: { id: string; name: string }[]) => {
    setLoadPickerOpen(false)
    const fileName = files[0]?.name
    if (!fileName || !projectId) return
    try {
      const text = await window.avatica.files.readText(projectId, '', fileName)
      const json = JSON.parse(text)
      if (json.settings && json.tracks) {
        dispatch(loadSequence(json))
        dispatch(ActionCreators.clearHistory())
        dispatch(setSequenceId(fileName))
      }
    } catch (err) {
      console.error('Failed to load sequence:', err)
    }
  }, [projectId, dispatch])

  const handleSave = useCallback(async () => {
    if (!projectId) return
    setSaving(true)
    try {
      const json = JSON.stringify({ ...sequence, $schema: 'sequence.v1' }, null, 2)
      const fileName = sequenceId || `Sequence ${new Date().toLocaleString().replace(/[/:\\]/g, '-')}.seq`
      await window.avatica.files.writeText(projectId, '', fileName, json)
      if (!sequenceId) dispatch(setSequenceId(fileName))
      dispatch(markClean())
      dispatch(ActionCreators.clearHistory())
      dispatch(bumpFileRefresh())
    } finally {
      setSaving(false)
    }
  }, [sequence, projectId, sequenceId, dispatch])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleSequenceChange = useCallback((seq: typeof sequence) => {
    dispatch(setSequence(seq))
  }, [dispatch])

  const { canvasRef, playing, buffering, currentTimeMs, togglePlayback, seek } = usePlayback(projectId, sequence)
  const { exporting, progress, doExport, cancelExport, availableFormats } = useExport(projectId, sequence)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const clipPreviews = useClipPreviews(projectId, sequence, allFiles)

  const handleDropFile = useCallback((trackId: string, fileId: string, fileName: string, fileType: string, positionMs: number) => {
    const track = sequence.tracks.find((t: Track) => t.id === trackId)
    if (!track) return
    const mimePrefix = fileType.split('/')[0]
    if (track.type === 'video' && mimePrefix !== 'video' && mimePrefix !== 'image') return
    if (track.type === 'audio' && mimePrefix !== 'audio') return
    const duration = mediaDurations.get(fileId) ?? 5000
    const newClip = { kind: 'media' as const, id: crypto.randomUUID(), fileId, fileName, mimeType: fileType, start: Math.round(positionMs), duration, trimIn: 0, trimOut: duration }
    dispatch(setSequence({
      ...sequence,
      tracks: sequence.tracks.map((t: Track) => {
        if (t.id !== trackId) return t
        const sorted = [...t.clips].sort((a, b) => a.start - b.start)
        let placed = false
        while (!placed) {
          const end = newClip.start + newClip.duration
          const overlap = sorted.find(c => newClip.start < c.start + c.duration && end > c.start)
          if (overlap) newClip.start = overlap.start + overlap.duration
          else placed = true
        }
        return { ...t, clips: [...t.clips, newClip].sort((a, b) => a.start - b.start) }
      }),
    }))
  }, [sequence, dispatch, mediaDurations])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    const startY = e.clientY
    const startHeight = timelineHeight
    const onMove = (e: MouseEvent) => setTimelineHeight(Math.max(120, Math.min(500, startHeight + (startY - e.clientY))))
    const onUp = () => { setDragging(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [timelineHeight])

  const clipEnds = sequence.tracks.flatMap((t: { clips: Array<{ start: number; duration: number }> }) => t.clips.map(c => c.start + c.duration))
  const clipEnd = clipEnds.length > 0 ? Math.max(...clipEnds) : 0
  const totalDuration = Math.max(sequence.settings.durationMs ?? 30000, clipEnd)
  const effectiveDurationSec = Math.round(totalDuration / 1000)
  const [durationInput, setDurationInput] = useState(String(effectiveDurationSec))
  useEffect(() => { setDurationInput(String(effectiveDurationSec)) }, [effectiveDurationSec])

  const RESOLUTION_PRESETS = [{ label: '720p', w: 1280, h: 720 }, { label: '1080p', w: 1920, h: 1080 }, { label: '4K', w: 3840, h: 2160 }]
  const ASPECT_RATIOS = [{ value: '16:9', label: '16:9', ratio: 16 / 9 }, { value: '9:16', label: '9:16', ratio: 9 / 16 }, { value: '4:3', label: '4:3', ratio: 4 / 3 }, { value: '1:1', label: '1:1', ratio: 1 }, { value: 'custom', label: 'Custom', ratio: 0 }]
  const currentRatio = sequence.settings.width / sequence.settings.height
  const currentAspect = ASPECT_RATIOS.find(a => a.ratio && Math.abs(a.ratio - currentRatio) < 0.01)?.value ?? 'custom'

  return (
    <Panel className="compose-root">
      <div className="app-title">
        <div className="app-traffic"><button className="app-close" onClick={onClose} /></div>
        <span className="app-title-text">Compose</span>
        <span className="compose-spacer" />
        <Lcd text={`${formatTime(currentTimeMs)} / ${formatTime(totalDuration)}`} active={playing} />
      </div>
      <div className="app-title-line" />

      <div className="compose-preview"><canvas ref={canvasRef} /></div>

      <div className="compose-transport">
        <div className="compose-transport__left">
          <CircleButton icon="fa-solid fa-file" title="New" onClick={() => { dispatch(newSequence()); dispatch(ActionCreators.clearHistory()); seek(0) }} />
          <CircleButton icon="fa-solid fa-folder-open" title="Load" onClick={() => setLoadPickerOpen(true)} />
          <CircleButton icon="fa-solid fa-floppy-disk" title="Save" disabled={saving || !dirty} onClick={handleSave} />
          <div className="compose-transport__divider" />
          <CircleButton icon="fa-solid fa-rotate-left" title="Undo" disabled={!canUndo} onClick={() => dispatch(ActionCreators.undo())} />
          <CircleButton icon="fa-solid fa-rotate-right" title="Redo" disabled={!canRedo} onClick={() => dispatch(ActionCreators.redo())} />
        </div>
        <div className="compose-transport__center">
          <CircleButton icon="fa-solid fa-backward-step" title="Start" onClick={() => seek(0)} />
          <CircleButton icon={buffering ? 'fa-solid fa-spinner fa-spin' : playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'} title={playing ? 'Pause' : 'Play'} onClick={togglePlayback} disabled={buffering} size={34} />
          <CircleButton icon="fa-solid fa-forward-step" title="End" onClick={() => seek(totalDuration)} />
        </div>
        <div className="compose-transport__right">
          <div className="compose-export-lcd--mini">
            {Array.from({ length: 12 }, (_, i) => (<div key={i} className={`compose-export-lcd__dot ${progress > i / 12 ? 'is-lit' : ''}`} />))}
          </div>
          {exporting ? (
            <CircleButton icon="fa-solid fa-xmark" title="Cancel" onClick={cancelExport} />
          ) : (
            <div className="compose-export-wrap">
              <CircleButton icon="fa-solid fa-download" title="Export" onClick={() => setExportMenuOpen(!exportMenuOpen)} />
              {exportMenuOpen && (
                <>
                  <div className="compose-overlay compose-overlay--menu" onClick={() => setExportMenuOpen(false)} />
                  <div className="timeline__context-menu" style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, left: 'auto', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const mp4 = availableFormats.filter(f => f.ext === 'mp4')
                      const other = availableFormats.filter(f => f.ext !== 'mp4')
                      return (<>
                        {other.length > 0 && (
                          <>
                            <div className="compose-export-group">WebM</div>
                            {other.map(fmt => (
                              <button key={fmt.codec} className="timeline__add-menu-item" onClick={() => { setExportMenuOpen(false); doExport(fmt) }}>
                                <span style={{ minWidth: 38, display: 'inline-block', flexShrink: 0 }}>{fmt.label}</span>
                                <span style={{ fontSize: 11, color: 'var(--hw-text-muted)', whiteSpace: 'nowrap' }}>{fmt.hint}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {mp4.length > 0 && (
                          <>
                            {other.length > 0 && <div className="timeline__context-separator" />}
                            <div className="compose-export-group">MP4</div>
                            {mp4.map(fmt => (
                              <button key={fmt.codec} className="timeline__add-menu-item" onClick={() => { setExportMenuOpen(false); doExport(fmt) }}>
                                <span style={{ minWidth: 38, display: 'inline-block', flexShrink: 0 }}>{fmt.label}</span>
                                <span style={{ fontSize: 11, color: 'var(--hw-text-muted)', whiteSpace: 'nowrap' }}>{fmt.hint}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </>)
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="compose-settings-wrap">
            <CircleButton icon="fa-solid fa-gear" title="Settings" active={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)} />
            {settingsOpen && (
              <>
                <div className="compose-overlay" onClick={() => setSettingsOpen(false)} />
                <div className="hw-panel compose-settings">
                  <div className="app-title"><div className="app-traffic"><button className="app-close" onClick={() => setSettingsOpen(false)} /></div><span className="app-title-text">Settings</span></div>
                  <div className="app-title-line" />
                  <div className="compose-settings__body">
                    <div className="compose-settings__presets">{RESOLUTION_PRESETS.map(p => (<HwButton key={p.label} onClick={() => dispatch(setSequence({ ...sequence, settings: { ...sequence.settings, width: p.w, height: p.h } }))}>{p.label}</HwButton>))}</div>
                    <div className="mfe__row"><span className="mfe__label">Aspect</span><HwSelect value={currentAspect} options={ASPECT_RATIOS.map(a => ({ value: a.value, label: a.label }))} onChange={val => { const ar = ASPECT_RATIOS.find(a => a.value === val); if (ar?.ratio) { const m = Math.max(sequence.settings.width, sequence.settings.height); dispatch(setSequence({ ...sequence, settings: { ...sequence.settings, width: ar.ratio >= 1 ? m : Math.round(m * ar.ratio), height: ar.ratio >= 1 ? Math.round(m / ar.ratio) : m } })) } }} /></div>
                    <div className="mfe__row"><span className="mfe__label">Width</span><HwInput value={String(sequence.settings.width)} onChange={val => dispatch(setSequence({ ...sequence, settings: { ...sequence.settings, width: parseInt(val) || 1920 } }))} /></div>
                    <div className="mfe__row"><span className="mfe__label">Height</span><HwInput value={String(sequence.settings.height)} onChange={val => dispatch(setSequence({ ...sequence, settings: { ...sequence.settings, height: parseInt(val) || 1080 } }))} /></div>
                    <div className="mfe__row"><span className="mfe__label">FPS</span><HwSelect value={String(sequence.settings.fps)} options={[{ value: '24', label: '24' }, { value: '25', label: '25' }, { value: '30', label: '30' }, { value: '60', label: '60' }]} onChange={val => dispatch(setSequence({ ...sequence, settings: { ...sequence.settings, fps: parseInt(val) } }))} /></div>
                    <div className="mfe__row"><span className="mfe__label">Duration</span><HwInput value={durationInput} onChange={val => setDurationInput(val)} onCommit={val => { const ms = Math.max(clipEnd, Math.max(1000, (parseInt(val) || 30) * 1000)); dispatch(setSequence({ ...sequence, settings: { ...sequence.settings, durationMs: ms } })) }} placeholder="seconds" /></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`compose-separator ${dragging ? 'is-dragging' : ''}`} onMouseDown={handleDragStart}><div className="compose-separator__handle" /></div>

      <div className="compose-timeline-wrap" style={{ height: timelineHeight }}>
        <Timeline sequence={sequence} onSequenceChange={handleSequenceChange} playheadMs={currentTimeMs} onSeek={seek} onDropFile={handleDropFile} mediaDurations={mediaDurations} clipPreviews={clipPreviews} onTogglePlayback={togglePlayback} onUndo={() => dispatch(ActionCreators.undo())} onRedo={() => dispatch(ActionCreators.redo())} />
      </div>
      {loadPickerOpen && (
        <FilePicker
          multiple={false}
          max={1}
          accept=".seq,application/json"
          onSelect={handleLoadFile}
          onClose={() => setLoadPickerOpen(false)}
        />
      )}
    </Panel>
  )
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
