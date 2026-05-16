export interface AppFileInfo {
  id: string;
  name: string;
  thumbnailUrl?: string;
}

export interface AppFilePickerElement extends HTMLElement {
  addFiles: (files: AppFileInfo[]) => Promise<void> | void;
}

export interface AppFilePickDetail {
  element: AppFilePickerElement;
  multiple: boolean;
  max: number;
  accept: string;
  schema: string;
}

export interface AvaticaHostBridge {
  invoke: (input: Record<string, unknown>) => Promise<void>;
  estimate?: (input: Record<string, unknown>) => Promise<number | null>;
  close: () => void;
}

declare global {
  interface Window {
    __avaticaApp?: AvaticaHostBridge;
  }
}
