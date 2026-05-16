import type { OverlayTemplate } from './types';

const POSITION_OPTIONS = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

const WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
  { value: '300', label: 'Light' },
];

const ALIGN_OPTIONS = [
  { value: 'center', label: 'Center' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const BG_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

function textTemplate(
  id: string,
  name: string,
  defaults: { text?: string; fontSize?: number; color?: string; position?: string; bg?: string },
  durationMs = 3000,
): OverlayTemplate {
  return {
    id,
    name,
    category: 'text',
    durationMs,
    vars: [
      { key: 'text', label: 'Text', type: 'text', default: defaults.text ?? 'Text' },
      { key: 'fontSize', label: 'Size', type: 'number', default: defaults.fontSize ?? 48 },
      { key: 'color', label: 'Color', type: 'color', default: defaults.color ?? '#ffffff' },
      { key: 'fontWeight', label: 'Weight', type: 'select', options: WEIGHT_OPTIONS, default: 'normal' },
      { key: 'align', label: 'Align', type: 'select', options: ALIGN_OPTIONS, default: 'center' },
      { key: 'position', label: 'Position', type: 'select', options: POSITION_OPTIONS, default: defaults.position ?? 'center' },
      { key: 'bg', label: 'Background', type: 'select', options: BG_OPTIONS, default: defaults.bg ?? 'none' },
    ],
  };
}

export const OVERLAY_TEMPLATES: OverlayTemplate[] = [
  textTemplate('title', 'Title', { text: 'TITLE', fontSize: 72 }),
  textTemplate('subtitle', 'Subtitle', { text: 'Subtitle text here', fontSize: 36, position: 'bottom', bg: 'dark' }, 4000),
  textTemplate('caption', 'Caption', { text: 'Caption', fontSize: 24, color: '#cccccc', position: 'bottom' }),
  {
    id: 'lower-third',
    name: 'Lower Third',
    category: 'lower-third',
    durationMs: 4000,
    vars: [
      { key: 'name', label: 'Name', type: 'text', default: 'John Doe' },
      { key: 'title', label: 'Title', type: 'text', default: 'Director' },
      { key: 'color', label: 'Text Color', type: 'color', default: '#ffffff' },
      { key: 'accentColor', label: 'Accent', type: 'color', default: '#3b82f6' },
    ],
  },
];

/** Get default vars for a template. */
export function getTemplateDefaults(templateId: string): Record<string, string | number> {
  const template = OVERLAY_TEMPLATES.find(t => t.id === templateId);
  if (!template) return {};
  const vars: Record<string, string | number> = {};
  for (const v of template.vars) vars[v.key] = v.default;
  return vars;
}
