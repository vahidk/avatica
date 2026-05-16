import { OVERLAY_TEMPLATES } from './overlays/templates';
import type { Clip } from './types';

export function getClipLabel(clip: Clip): string {
  if (clip.kind === 'overlay') {
    const template = OVERLAY_TEMPLATES.find(t => t.id === clip.templateId);
    return `${template?.name || 'Overlay'}: ${clip.vars.text || clip.vars.name || ''}`;
  }
  return clip.fileName || clip.fileId.slice(0, 8);
}
