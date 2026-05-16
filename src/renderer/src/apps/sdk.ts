// App SDK — thin bridge between app HTML and the host.
// Exposes window.__avaticaApp for app scripts (not window.avatica, which is used by preload IPC).

import type { AvaticaHostBridge } from './types';

export interface AppHostOptions {
  container: HTMLElement;
  onInvoke: (input: Record<string, unknown>) => Promise<void>;
  onEstimate?: (input: Record<string, unknown>) => Promise<number | null>;
  onClose: () => void;
}

declare global {
  interface Window {
    __avaticaApp?: AvaticaHostBridge;
  }
}

export function initApp({ container, onInvoke, onEstimate, onClose }: AppHostOptions): () => void {
  const bridge: AvaticaHostBridge = { invoke: onInvoke, close: onClose };
  if (onEstimate) bridge.estimate = onEstimate;
  window.__avaticaApp = bridge;

  // Execute <script> tags (innerHTML doesn't run them)
  container.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    s.textContent = old.textContent;
    old.replaceWith(s);
  });

  return () => {
    delete window.__avaticaApp;
  };
}
