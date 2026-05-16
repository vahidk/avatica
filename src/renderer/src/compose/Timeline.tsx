import { useState, useRef, useCallback, useEffect } from 'react';

import { faTrash, faVolumeMute, faVolumeUp, faPlus, faPen } from '@fortawesome/free-solid-svg-icons';
import ContextMenuItem from '../components/ui/ContextMenuItem';
import HwSlider from '../components/hw/HwSlider';
import type { Sequence, TrackType, OverlayClip } from './types';
import { OVERLAY_TEMPLATES, getTemplateDefaults } from './overlays/templates';
import { snapToGrid, clampMove, clampResize, findDropPosition } from './snap';
import OverlayEditor from './OverlayEditor';
import ClipContent from './ClipContent';
import { getClipLabel } from './clipUtils';
import type { ClipPreview } from './useClipPreviews';

const TRACK_HEIGHT = 40;
const MS_PER_PIXEL_DEFAULT = 10;
const DEFAULT_DROP_DURATION = 5000;
const TRACK_ICONS: Record<TrackType, string> = { video: 'fa-solid fa-film', audio: 'fa-solid fa-music' };

interface TimelineProps {
  sequence: Sequence;
  onSequenceChange: (seq: Sequence) => void;
  playheadMs: number;
  onSeek: (ms: number) => void;
  onDropFile?: (trackId: string, fileId: string, fileName: string, fileType: string, positionMs: number) => void;
  mediaDurations?: Map<string, number>;
  clipPreviews?: Record<string, ClipPreview>;
  onTogglePlayback?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export default function Timeline({ sequence, onSequenceChange, playheadMs, onSeek, onDropFile, mediaDurations, clipPreviews, onTogglePlayback, onUndo, onRedo }: TimelineProps) {
  
  const [msPerPixel, setMsPerPixel] = useState(MS_PER_PIXEL_DEFAULT);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; trackId: string; clipId?: string } | null>(null);
  const [dropTargetTrackId, setDropTargetTrackId] = useState<string | null>(null);
  const [dropGhost, setDropGhost] = useState<{ trackId: string; startMs: number; durationMs: number } | null>(null);
  const [selectedClip, setSelectedClip] = useState<{ trackId: string; clipId: string } | null>(null);
  const [editingOverlay, setEditingOverlay] = useState<{ trackId: string; clipId: string; x: number; y: number } | null>(null);
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);

  // Shift key disables snapping
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Snap helper bound to current state
  const snap = useCallback((ms: number, opts?: { excludeClipId?: string; duration?: number }) =>
    snapToGrid(ms, sequence, playheadMs, msPerPixel, { ...opts, disabled: shiftHeld }),
  [sequence, playheadMs, msPerPixel, shiftHeld]);

  // --- Clip interactions ---

  const handleClipResize = useCallback((trackId: string, clipId: string, edge: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = sequence.tracks.find(t => t.id === trackId)?.clips.find(c => c.id === clipId);
    if (!clip) return;
    const startX = e.clientX;

    const onMove = (ev: MouseEvent) => {
      const deltaMs = (ev.clientX - startX) * msPerPixel;
      onSequenceChange({
        ...sequence,
        tracks: sequence.tracks.map(t => {
          if (t.id !== trackId) return t;
          return { ...t, clips: t.clips.map(c => {
            if (c.id !== clipId) return c;

            if (c.kind === 'overlay') {
              if (edge === 'left') {
                const s = snap(clip.start + deltaMs, { excludeClipId: clipId });
                const clamped = clampResize(t.clips, clipId, s, Math.max(100, clip.duration - (s - clip.start)));
                return { ...c, start: clamped.start, duration: clamped.duration };
              } else {
                const end = snap(clip.start + clip.duration + deltaMs, { excludeClipId: clipId });
                const clamped = clampResize(t.clips, clipId, clip.start, Math.max(100, end - clip.start));
                return { ...c, duration: clamped.duration };
              }
            }

            const maxDuration = mediaDurations?.get(c.fileId) ?? Infinity;
            if (edge === 'left') {
              const s = snap(clip.start + deltaMs, { excludeClipId: clipId });
              const clamped = clampResize(t.clips, clipId, s, Math.max(100, Math.min(maxDuration, clip.duration - (s - clip.start))));
              return { ...c, start: clamped.start, duration: clamped.duration, trimIn: (c.trimIn ?? 0) + (clamped.start - clip.start) };
            } else {
              const end = snap(clip.start + Math.min(maxDuration, clip.duration + deltaMs), { excludeClipId: clipId });
              const clamped = clampResize(t.clips, clipId, clip.start, Math.max(100, end - clip.start));
              return { ...c, duration: clamped.duration, trimOut: clamped.duration };
            }
          })};
        }),
      });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sequence, msPerPixel, onSequenceChange, mediaDurations, snap]);

  const handleClipMove = useCallback((trackId: string, clipId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedClip({ trackId, clipId });
    const clip = sequence.tracks.find(t => t.id === trackId)?.clips.find(c => c.id === clipId);
    if (!clip) return;
    const startX = e.clientX;

    const onMove = (ev: MouseEvent) => {
      const rawStart = Math.max(0, clip.start + (ev.clientX - startX) * msPerPixel);
      const snappedStart = snap(rawStart, { excludeClipId: clipId, duration: clip.duration });
      onSequenceChange({
        ...sequence,
        tracks: sequence.tracks.map(t => {
          if (t.id !== trackId) return t;
          return { ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, start: clampMove(t.clips, clipId, snappedStart, clip.duration) } : c) };
        }),
      });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sequence, msPerPixel, onSequenceChange, snap]);

  // --- Timeline metrics ---

  const clipEndMs = Math.max(0, ...sequence.tracks.flatMap(t => t.clips.map(c => c.start + c.duration)));
  const totalDurationMs = Math.max(sequence.settings.durationMs ?? 30000, clipEndMs);
  const [scrollWidth, setScrollWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScrollWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const maxMsPerPixel = scrollWidth > 0 ? totalDurationMs / scrollWidth : 250;
  const totalWidth = Math.max(scrollWidth, Math.floor(totalDurationMs / msPerPixel));
  const playheadX = playheadMs / msPerPixel;

  // Auto-fit zoom on mount and when duration changes
  const [prevDuration, setPrevDuration] = useState(0);
  if (totalDurationMs > 0 && scrollWidth > 0 && totalDurationMs !== prevDuration) {
    setPrevDuration(totalDurationMs);
    setMsPerPixel(Math.max(1, totalDurationMs / scrollWidth));
  }

  // Pinch-to-zoom
  const maxMsRef = useRef(maxMsPerPixel);
  useEffect(() => { maxMsRef.current = maxMsPerPixel; });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setMsPerPixel(prev => Math.min(maxMsRef.current, Math.max(1, prev * (e.deltaY > 0 ? 1.05 : 0.95))));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleRulerDown = useCallback((e: React.MouseEvent) => {
    const ruler = e.currentTarget;
    const seekFromEvent = (ev: MouseEvent) => {
      const rect = ruler.getBoundingClientRect();
      onSeek(Math.max(0, (ev.clientX - rect.left) * msPerPixel));
    };
    seekFromEvent(e.nativeEvent);
    const onMove = (ev: MouseEvent) => seekFromEvent(ev);
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [msPerPixel, onSeek]);

  // --- Track operations ---

  function addTrack(type: TrackType) {
    const count = sequence.tracks.filter(t => t.type === type).length + 1;
    onSequenceChange({ ...sequence, tracks: [...sequence.tracks, {
      id: crypto.randomUUID(), type, name: `${type === 'video' ? 'Video' : 'Audio'} ${count}`, disabled: false, muted: false, volume: 1, clips: [],
    }] });
    setAddMenuOpen(false);
  }

  function addOverlayClip(trackId: string, positionMs: number, cursorX: number, cursorY: number) {
    const template = OVERLAY_TEMPLATES[0];
    const clipId = crypto.randomUUID();
    const clip: OverlayClip = { kind: 'overlay', id: clipId, templateId: template.id, vars: getTemplateDefaults(template.id), start: positionMs, duration: template.durationMs };
    onSequenceChange({ ...sequence, tracks: sequence.tracks.map(t => t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t) });
    setEditingOverlay({ trackId, clipId, x: cursorX, y: cursorY });
  }

  const deleteClip = useCallback((trackId: string, clipId: string) => {
    onSequenceChange({ ...sequence, tracks: sequence.tracks.map(t => t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t) });
  }, [sequence, onSequenceChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === ' ') { e.preventDefault(); onTogglePlayback?.(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClip) { e.preventDefault(); deleteClip(selectedClip.trackId, selectedClip.clipId); setSelectedClip(null); }
      if (e.key === 'Escape') setSelectedClip(null);
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); onUndo?.(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); onRedo?.(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedClip, onTogglePlayback, onUndo, onRedo, deleteClip]);

  function handleTrackDragEnd() {
    if (dragTrackId && dragOverIndex !== null) {
      const tracks = [...sequence.tracks];
      const fromIndex = tracks.findIndex(t => t.id === dragTrackId);
      if (fromIndex !== -1 && fromIndex !== dragOverIndex) {
        const [moved] = tracks.splice(fromIndex, 1);
        tracks.splice(dragOverIndex, 0, moved);
        onSequenceChange({ ...sequence, tracks });
      }
    }
    setDragTrackId(null);
    setDragOverIndex(null);
  }

  // --- Render ---

  return (
    <div className="timeline">
      <div className="timeline__body">
        {/* Track headers */}
        <div className="timeline__headers">
          <div className="timeline__ruler-spacer" />
          {sequence.tracks.map((track, i) => (
            <div
              key={track.id}
              className={`timeline__track-header ${dragOverIndex === i && dragTrackId !== track.id ? 'is-drag-over' : ''} ${dragTrackId === track.id ? 'is-dragging' : ''}`}
              draggable
              onDragStart={() => setDragTrackId(track.id)}
              onDragOver={(e) => { e.preventDefault(); if (dragTrackId) setDragOverIndex(i); }}
              onDragEnd={handleTrackDragEnd}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id }); }}
            >
              <button className={`timeline__track-icon-btn ${track.disabled ? 'is-disabled' : ''}`} onClick={() => onSequenceChange({ ...sequence, tracks: sequence.tracks.map(t => t.id === track.id ? { ...t, disabled: !t.disabled } : t) })}>
                <i className={`${TRACK_ICONS[track.type]} timeline__track-icon timeline__track-icon--${track.type}`} />
              </button>
              {renamingTrackId === track.id ? (
                <input
                  className="timeline__track-name-input"
                  defaultValue={track.name}
                  autoFocus
                  onBlur={(e) => {
                    const name = e.target.value.trim() || track.name;
                    onSequenceChange({ ...sequence, tracks: sequence.tracks.map(t => t.id === track.id ? { ...t, name } : t) });
                    setRenamingTrackId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { setRenamingTrackId(null); }
                  }}
                />
              ) : (
                <span
                  className={`timeline__track-name ${track.disabled ? 'is-disabled' : ''}`}
                  onDoubleClick={() => setRenamingTrackId(track.id)}
                >{track.name}</span>
              )}
              <button className={`timeline__mute-btn ${track.muted ? 'is-muted' : ''}`} onClick={() => onSequenceChange({ ...sequence, tracks: sequence.tracks.map(t => t.id === track.id ? { ...t, muted: !t.muted } : t) })}>M</button>
            </div>
          ))}
          <div className="timeline__add-track-wrap">
            <button className="timeline__add-track" onClick={() => setAddMenuOpen(!addMenuOpen)}>+ Track</button>
            {addMenuOpen && (
              <>
                <div className="compose-overlay compose-overlay--menu" onClick={() => setAddMenuOpen(false)} />
                <div className="timeline__add-menu">
                  {(['video', 'audio'] as TrackType[]).map(type => (
                    <button key={type} className="timeline__add-menu-item" onClick={() => addTrack(type)}>
                      <i className={`${TRACK_ICONS[type]} timeline__track-icon timeline__track-icon--${type}`} />
                      {type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scrollable tracks */}
        <div
          ref={scrollRef}
          className="timeline__scroll"
          onContextMenu={(e) => { if (!(e.target as HTMLElement).closest('.timeline__lane')) { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, trackId: '' }); } }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDropGhost(null); setDropTargetTrackId(null); } }}
          onDrop={(e) => {
            e.preventDefault();
            setDropGhost(null);
            const fileId = e.dataTransfer.getData('text/x-avatica-file-id');
            const fileName = e.dataTransfer.getData('text/x-avatica-file-name');
            const fileType = e.dataTransfer.getData('text/x-avatica-file-type');
            if (fileId && onDropFile && sequence.tracks.length > 0) {
              const rect = e.currentTarget.getBoundingClientRect();
              const trackIndex = Math.max(0, Math.min(sequence.tracks.length - 1, Math.floor((e.clientY - rect.top - 24) / TRACK_HEIGHT)));
              onDropFile(sequence.tracks[trackIndex].id, fileId, fileName, fileType, Math.max(0, (e.clientX - rect.left) * msPerPixel));
            }
          }}
        >
          {/* Ruler */}
          <div className="timeline__ruler" style={{ width: totalWidth }} onMouseDown={handleRulerDown}>
            {(() => {
              const pxPerSec = 1000 / msPerPixel;
              const intervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
              const minorInterval = intervals.find(s => s * pxPerSec >= 40) || 300;
              const majorInterval = minorInterval * 5;
              const count = Math.ceil((totalWidth * msPerPixel) / (minorInterval * 1000)) + 1;
              return Array.from({ length: count }, (_, i) => {
                const timeMs = i * minorInterval * 1000;
                const x = timeMs / msPerPixel;
                const major = timeMs % (majorInterval * 1000) === 0;
                return (
                  <div key={i} className="timeline__ruler-tick" style={{ left: x }}>
                    <div className={`timeline__ruler-tick-line ${major ? 'timeline__ruler-tick-line--major' : 'timeline__ruler-tick-line--minor'}`} />
                    {major && <span className="timeline__ruler-label">{formatTime(timeMs)}</span>}
                  </div>
                );
              });
            })()}
          </div>

          {/* Track lanes */}
          {sequence.tracks.map(track => (
            <div
              key={track.id}
              className={`timeline__lane ${dropTargetTrackId === track.id ? 'is-drop-target' : ''}`}
              style={{ width: totalWidth }}
              onDragOver={(e) => {
                e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy';
                setDropTargetTrackId(track.id);
                const rect = e.currentTarget.getBoundingClientRect();
                const rawMs = Math.max(0, (e.clientX - rect.left) * msPerPixel);
                const idType = e.dataTransfer.types.find(t => t.startsWith('application/x-avatica-id-'));
                const dragFileId = idType?.slice('application/x-avatica-id-'.length);
                const dur = (dragFileId && mediaDurations?.get(dragFileId)) || DEFAULT_DROP_DURATION;
                const snappedMs = snap(rawMs, { duration: dur });
                setDropGhost({ trackId: track.id, startMs: findDropPosition(track.clips, snappedMs, dur), durationMs: dur });
              }}
              onClick={() => setSelectedClip(null)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id }); }}
              onDragLeave={() => { setDropTargetTrackId(null); setDropGhost(null); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation(); setDropTargetTrackId(null); setDropGhost(null);
                const fileId = e.dataTransfer.getData('text/x-avatica-file-id');
                const fileName = e.dataTransfer.getData('text/x-avatica-file-name');
                const fileType = e.dataTransfer.getData('text/x-avatica-file-type');
                if (fileId && onDropFile) onDropFile(track.id, fileId, fileName, fileType, Math.max(0, (e.clientX - e.currentTarget.getBoundingClientRect().left) * msPerPixel));
              }}
            >
              {track.clips.map(clip => (
                <div
                  key={clip.id}
                  className={`timeline__clip ${clip.kind === 'overlay' ? 'timeline__clip--overlay' : `timeline__clip--${track.type}`} ${track.disabled ? 'is-disabled' : ''} ${selectedClip?.clipId === clip.id ? 'is-selected' : ''}`}
                  onMouseDown={(e) => handleClipMove(track.id, clip.id, e)}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id, clipId: clip.id }); }}
                  style={{ left: clip.start / msPerPixel, width: clip.duration / msPerPixel }}
                >
                  <div className="timeline__clip-handle timeline__clip-handle--left" onMouseDown={(e) => handleClipResize(track.id, clip.id, 'left', e)} />
                  <ClipContent
                    clip={clip}
                    trackType={track.type}
                    preview={clip.kind === 'media' ? clipPreviews?.[clip.fileId] : undefined}
                    mediaDuration={clip.kind === 'media' ? mediaDurations?.get(clip.fileId) : undefined}
                  />
                  <span className="timeline__clip-label">{getClipLabel(clip)}</span>
                  <div className="timeline__clip-handle timeline__clip-handle--right" onMouseDown={(e) => handleClipResize(track.id, clip.id, 'right', e)} />
                </div>
              ))}
              {dropGhost && dropGhost.trackId === track.id && (
                <div className="timeline__clip-ghost" style={{ left: dropGhost.startMs / msPerPixel, width: dropGhost.durationMs / msPerPixel }} />
              )}
            </div>
          ))}

          {/* Playhead */}
          <div className="timeline__playhead" style={{ left: playheadX }}>
            <div className="timeline__playhead-handle" />
          </div>
        </div>

        {/* Zoom controls */}
        <div className="timeline__zoom-bar">
          <button className="timeline__zoom-btn" title={'Reset zoom'} onClick={() => setMsPerPixel(MS_PER_PIXEL_DEFAULT)}><i className="fa-solid fa-arrows-to-dot" /></button>
          <button className="timeline__zoom-btn" title={'Zoom in'} onClick={() => setMsPerPixel(prev => Math.max(1, prev * 0.7))}><i className="fa-solid fa-magnifying-glass-plus" /></button>
          <div className="timeline__zoom-slider">
            <HwSlider vertical min={0} max={100}
              value={Math.round(100 - ((Math.log(msPerPixel) - Math.log(1)) / (Math.log(maxMsPerPixel) - Math.log(1))) * 100)}
              onChange={(v) => setMsPerPixel(Math.exp(Math.log(1) + (1 - v / 100) * (Math.log(maxMsPerPixel) - Math.log(1))))}
            />
          </div>
          <button className="timeline__zoom-btn" title={'Zoom out'} onClick={() => setMsPerPixel(prev => Math.min(maxMsPerPixel, prev * 1.4))}><i className="fa-solid fa-magnifying-glass-minus" /></button>
          <button className="timeline__zoom-btn" title={'Fit to view'} onClick={() => setMsPerPixel(maxMsPerPixel)}><i className="fa-solid fa-expand" /></button>
        </div>
      </div>

      {/* Overlay editor */}
      {editingOverlay && (
        <OverlayEditor
          sequence={sequence}
          trackId={editingOverlay.trackId}
          clipId={editingOverlay.clipId}
          x={editingOverlay.x}
          y={editingOverlay.y}
          onSequenceChange={onSequenceChange}
          onClose={() => setEditingOverlay(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="compose-overlay" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div className="timeline__context-menu" style={{ left: contextMenu.x, bottom: window.innerHeight - contextMenu.y }}>
            {contextMenu.clipId ? (
              <>
                {(() => {
                  const clip = sequence.tracks.find(t => t.id === contextMenu.trackId)?.clips.find(c => c.id === contextMenu.clipId);
                  if (clip?.kind === 'overlay') return <ContextMenuItem icon={faPen} label={'Edit overlay'} onClick={() => { setEditingOverlay({ trackId: contextMenu.trackId, clipId: contextMenu.clipId!, x: contextMenu.x, y: contextMenu.y }); setContextMenu(null); }} />;
                  return null;
                })()}
                <ContextMenuItem icon={faTrash} label={'Delete clip'} danger onClick={() => { deleteClip(contextMenu.trackId, contextMenu.clipId!); setContextMenu(null); }} />
              </>
            ) : !contextMenu.trackId ? (
              <>
                {(['video', 'audio'] as TrackType[]).map(type => (
                  <ContextMenuItem key={type} icon={faPlus} label={`Add ${type} track`} onClick={() => { addTrack(type); setContextMenu(null); }} />
                ))}
              </>
            ) : (
              <>
                <ContextMenuItem
                  icon={sequence.tracks.find(t => t.id === contextMenu.trackId)?.muted ? faVolumeUp : faVolumeMute}
                  label={sequence.tracks.find(t => t.id === contextMenu.trackId)?.muted ? 'Unmute' : 'Mute'}
                  onClick={() => { onSequenceChange({ ...sequence, tracks: sequence.tracks.map(t => t.id === contextMenu.trackId ? { ...t, muted: !t.muted } : t) }); setContextMenu(null); }}
                />
                <ContextMenuItem icon={faPen} label={'Rename track'} onClick={() => { setRenamingTrackId(contextMenu.trackId); setContextMenu(null); }} />
                {sequence.tracks.find(t => t.id === contextMenu.trackId)?.type === 'video' && (
                  <>
                    <div className="timeline__context-separator" />
                    <ContextMenuItem icon={faPlus} label={'Add text overlay'} onClick={() => { addOverlayClip(contextMenu.trackId, playheadMs, contextMenu.x, contextMenu.y); setContextMenu(null); }} />
                  </>
                )}
                <div className="timeline__context-separator" />
                <ContextMenuItem icon={faTrash} label={'Delete track'} danger onClick={() => { if (sequence.tracks.length > 1) { onSequenceChange({ ...sequence, tracks: sequence.tracks.filter(t => t.id !== contextMenu.trackId) }); setContextMenu(null); } }} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (sec % 1 !== 0) return `${min}:${sec.toFixed(1).padStart(4, '0')}`;
  return `${min}:${Math.floor(sec).toString().padStart(2, '0')}`;
}
