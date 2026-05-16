// Resolve a label that may be a translation key (prefixed with $)
// Walks up the DOM to find __i18n set by AppContainer, which holds
// per-app translations for the current language.

export function resolveLabel(raw: string | null, context?: HTMLElement): string | null {
  if (!raw) return null;
  if (!raw.startsWith('$')) return raw;
  const key = raw.slice(1);

  // Walk up DOM to find the app container's __i18n
  let el: HTMLElement | null = context || null;
  while (el) {
    const i18n = (el as any).__i18n as Record<string, string> | undefined;
    if (i18n && key in i18n) return i18n[key];
    el = el.parentElement;
  }

  // Fallback: convert camelCase to Title Case (e.g. "colorPalette" → "Color Palette")
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}
