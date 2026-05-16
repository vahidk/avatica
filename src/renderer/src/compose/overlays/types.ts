export interface TemplateVar {
  key: string;
  label: string;
  type: 'text' | 'color' | 'number' | 'select';
  options?: { value: string; label: string }[];
  default: string | number;
}

export interface OverlayTemplate {
  id: string;
  name: string;
  category: 'text' | 'lower-third';
  vars: TemplateVar[];
  durationMs: number;
}
