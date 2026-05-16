import { OVERLAY_TEMPLATES } from './templates';
import type { OverlayClip } from '../types';

/** Compute fade opacity (10% fade in, 10% fade out). */
function fadeOpacity(progress: number): number {
  if (progress < 0.1) return Math.max(0.05, progress / 0.1);
  if (progress > 0.9) return Math.max(0.05, (1 - progress) / 0.1);
  return 1;
}

/** Resolve position name to canvas coordinates. */
function resolvePosition(
  pos: string, width: number, height: number, fontSize: number,
): { x: number; y: number; defaultAlign: CanvasTextAlign } {
  const margin = fontSize * 1.2;
  const positions: Record<string, { x: number; y: number; defaultAlign: CanvasTextAlign }> = {
    'center':       { x: width / 2, y: height / 2, defaultAlign: 'center' },
    'top':          { x: width / 2, y: margin, defaultAlign: 'center' },
    'bottom':       { x: width / 2, y: height - margin, defaultAlign: 'center' },
    'top-left':     { x: margin * 0.5, y: margin, defaultAlign: 'left' },
    'top-right':    { x: width - margin * 0.5, y: margin, defaultAlign: 'right' },
    'bottom-left':  { x: margin * 0.5, y: height - margin, defaultAlign: 'left' },
    'bottom-right': { x: width - margin * 0.5, y: height - margin, defaultAlign: 'right' },
  };
  return positions[pos] ?? positions['center'];
}

/** Convert a CSS color + opacity to an rgba string. */
function withOpacity(color: string, opacity: number): string {
  if (opacity >= 1) return color;
  // Handle hex
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const r = parseInt(hex[1].slice(0, 2), 16);
    const g = parseInt(hex[1].slice(2, 4), 16);
    const b = parseInt(hex[1].slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  // Handle rgb()
  const rgb = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${opacity})`;
  // Handle rgba() — multiply existing alpha
  const rgba = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${parseFloat(rgba[4]) * opacity})`;
  return color;
}

/** Apply text shadow for readability over video. */
function applyShadow(ctx: CanvasRenderingContext2D, opacity: number) {
  ctx.shadowColor = `rgba(0,0,0,${0.7 * opacity})`;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function renderTextOverlay(ctx: CanvasRenderingContext2D, vars: Record<string, string | number>, w: number, h: number, opacity: number) {
  const text = String(vars.text ?? 'Text');
  const fontSize = Number(vars.fontSize ?? 48);
  const color = String(vars.color ?? '#ffffff');
  const weight = String(vars.fontWeight ?? 'normal');
  const bg = String(vars.bg ?? 'none');

  const pos = resolvePosition(String(vars.position ?? 'center'), w, h, fontSize);
  const align = (String(vars.align ?? '') || pos.defaultAlign) as CanvasTextAlign;

  ctx.font = `${weight} ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  // Background pill
  if (bg !== 'none') {
    const metrics = ctx.measureText(text);
    const px = fontSize * 0.5;
    const py = fontSize * 0.3;
    let bx = pos.x - px;
    if (align === 'center') bx = pos.x - metrics.width / 2 - px;
    else if (align === 'right') bx = pos.x - metrics.width - px;

    ctx.fillStyle = bg === 'dark' ? `rgba(0,0,0,${0.6 * opacity})` : `rgba(255,255,255,${0.3 * opacity})`;
    ctx.beginPath();
    ctx.roundRect(bx, pos.y - fontSize / 2 - py, metrics.width + px * 2, fontSize + py * 2, 6);
    ctx.fill();
  }

  applyShadow(ctx, opacity);
  ctx.fillStyle = withOpacity(color, opacity);
  ctx.fillText(text, pos.x, pos.y);
  clearShadow(ctx);
}

function renderLowerThird(ctx: CanvasRenderingContext2D, vars: Record<string, string | number>, w: number, h: number, opacity: number) {
  const name = String(vars.name ?? 'Name');
  const title = String(vars.title ?? 'Title');
  const color = String(vars.color ?? '#ffffff');
  const accent = String(vars.accentColor ?? '#3b82f6');

  const x = w * 0.04;
  const y = h * 0.82;

  // Accent bar
  ctx.fillStyle = withOpacity(accent, opacity);
  ctx.fillRect(x, y, 4, 56);

  // Text
  applyShadow(ctx, opacity);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = withOpacity(color, opacity);

  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillText(name, x + 16, y + 18);

  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(title, x + 16, y + 44);

  clearShadow(ctx);
}

const RENDERERS: Record<string, (ctx: CanvasRenderingContext2D, vars: Record<string, string | number>, w: number, h: number, opacity: number) => void> = {
  'text': renderTextOverlay,
  'lower-third': renderLowerThird,
};

export function renderOverlay(ctx: CanvasRenderingContext2D, clip: OverlayClip, timeMs: number, width: number, height: number) {
  if (timeMs < clip.start || timeMs >= clip.start + clip.duration) return;

  const template = OVERLAY_TEMPLATES.find(t => t.id === clip.templateId);
  if (!template) return;

  const render = RENDERERS[template.category];
  if (!render) return;

  const progress = (timeMs - clip.start) / clip.duration;
  const opacity = fadeOpacity(progress);

  ctx.save();
  render(ctx, clip.vars, width, height, opacity);
  ctx.restore();
}
