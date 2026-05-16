import HwInput from '../components/hw/HwInput';
import HwSelect from '../components/hw/HwSelect';
import HwColorPicker from '../components/hw/HwColorPicker';
import type { Sequence, OverlayClip } from './types';
import { OVERLAY_TEMPLATES } from './overlays/templates';

interface OverlayEditorProps {
  sequence: Sequence;
  trackId: string;
  clipId: string;
  x: number;
  y: number;
  onSequenceChange: (seq: Sequence) => void;
  onClose: () => void;
}

export default function OverlayEditor({ sequence, trackId, clipId, x, y, onSequenceChange, onClose }: OverlayEditorProps) {
  const track = sequence.tracks.find(t => t.id === trackId);
  const clip = track?.clips.find(c => c.id === clipId);
  if (!clip || clip.kind !== 'overlay') return null;

  const overlayClip = clip;
  const template = OVERLAY_TEMPLATES.find(t => t.id === overlayClip.templateId);
  if (!template) return null;

  function updateClip(updates: Partial<OverlayClip>) {
    onSequenceChange({
      ...sequence,
      tracks: sequence.tracks.map(t =>
        t.id === trackId
          ? { ...t, clips: t.clips.map(c => c.id === clipId && c.kind === 'overlay' ? { ...c, ...updates } : c) }
          : t
      ),
    });
  }

  function updateVar(key: string, value: string | number) {
    updateClip({ vars: { ...overlayClip.vars, [key]: value } });
  }

  function changeTemplate(newTemplateId: string) {
    const newTemplate = OVERLAY_TEMPLATES.find(t => t.id === newTemplateId);
    if (!newTemplate) return;
    const newVars: Record<string, string | number> = {};
    for (const v of newTemplate.vars) {
      newVars[v.key] = overlayClip.vars[v.key] ?? v.default;
    }
    updateClip({ templateId: newTemplateId, vars: newVars });
  }

  return (
    <>
      <div className="compose-overlay" onClick={onClose} />
      <div className="timeline__overlay-editor" style={{ left: x, bottom: window.innerHeight - y }}>
        <div className="app-title">
          <div className="app-traffic">
            <button className="app-close" onClick={onClose} />
          </div>
          <span className="app-title-text">Text Overlay</span>
        </div>
        <div className="app-title-line" />
        <div className="timeline__overlay-editor-body">
          <HwSelect
            label="Style"
            value={overlayClip.templateId}
            options={OVERLAY_TEMPLATES.map(t => ({ value: t.id, label: t.name }))}
            onChange={changeTemplate}
          />
          {template.vars.filter(v => v.type === 'text').map(v => (
            <HwInput
              key={v.key}
              label={v.label}
              value={String(overlayClip.vars[v.key] ?? v.default)}
              onChange={val => updateVar(v.key, val)}
            />
          ))}
          <div className="timeline__overlay-editor-grid">
            {template.vars.filter(v => v.type !== 'text').map(v => (
              <div key={v.key}>
                {v.type === 'number' && (
                  <HwInput
                    label={v.label}
                    value={String(overlayClip.vars[v.key] ?? v.default)}
                    onChange={val => updateVar(v.key, parseInt(val, 10) || 0)}
                  />
                )}
                {v.type === 'select' && (
                  <HwSelect
                    label={v.label}
                    value={String(overlayClip.vars[v.key] ?? v.default)}
                    options={v.options?.map(o => ({ value: o.value, label: o.label })) || []}
                    onChange={val => updateVar(v.key, val)}
                  />
                )}
                {v.type === 'color' && (
                  <HwColorPicker
                    label={v.label}
                    value={String(overlayClip.vars[v.key] ?? v.default)}
                    onChange={val => updateVar(v.key, val)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
