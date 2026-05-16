import { resolveLabel } from './i18n';
import type { AppFileInfo } from '../types';
import { getExtensionForSchemaId, getSchemaThumbnailPathForFile, isSchemaFile } from '../../helpers';

// <app-file> — File picker component for apps.
// Drop zone for dragging files from asset browser. Click opens host file picker.
//
// Usage:
//   <app-file name="reference" label="Reference Image"></app-file>
//   <app-file name="references" label="Reference Images" multiple></app-file>
//
// Events:
//   'app-file-pick' — dispatched when user clicks the zone. Host should open picker
//     and call element.addFiles([{ id, name, thumbnailUrl? }]) with selected files.

class AppFile extends HTMLElement {
  private shadow: ShadowRoot;
  private hiddenInput!: HTMLInputElement;
  private files: AppFileInfo[] = [];
  private observer: MutationObserver | null = null;

  static get observedAttributes() { return ['name', 'label', 'multiple', 'max', 'accept', 'schema']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  get name() { return this.getAttribute('name') || ''; }
  get multiple() { return this.hasAttribute('multiple'); }
  get max() { return parseInt(this.getAttribute('max') || '0', 10) || 0; }
  get accept() { return this.getAttribute('accept') || ''; }
  get schema() { return this.getAttribute('schema') || ''; }

  // Check if a MIME type matches the accept attribute (e.g. "image/*", "image/png,video/*")
  private matchesAccept(mimeType: string): boolean {
    if (!this.accept) return true;
    return this.accept.split(',').some(pattern => {
      const p = pattern.trim();
      if (p.endsWith('/*')) return mimeType.startsWith(p.slice(0, -1));
      return mimeType === p;
    });
  }

  // If the schema attribute is set, verify the file's name has the matching extension.
  // Used to keep entity pickers (scene/character/object/shot) from accepting raw images
  // or unrelated entity types.
  private matchesSchema(fileName: string): boolean {
    if (!this.schema) return true;
    const expectedExt = getExtensionForSchemaId(this.schema);
    if (!expectedExt) return true;
    return fileName.endsWith(expectedExt);
  }

  // Walk up the DOM to find the project id set by AppContainer.
  private resolveProjectId(): string | null {
    let node: HTMLElement | null = this;
    while (node) {
      const pid = node.getAttribute?.('data-project-id');
      if (pid) return pid;
      node = node.parentElement;
    }
    return null;
  }

  // For schema-typed (entity) files, the displayable thumbnail is the referenced image
  // declared by the schema (e.g. references.front for character, references.frame for shot).
  private async resolveEntityThumbnail(fileName: string): Promise<string | undefined> {
    if (!isSchemaFile(fileName)) return undefined;
    const projectId = this.resolveProjectId();
    if (!projectId) return undefined;
    const thumbField = getSchemaThumbnailPathForFile(fileName) || 'references.front';
    try {
      const text = await window.avatica.files.readText(projectId, '', fileName);
      const data = JSON.parse(text);
      const refImage = thumbField.split('.').reduce<any>((acc, key) => acc?.[key], data);
      if (typeof refImage === 'string' && refImage) {
        const p = await window.avatica.files.getLocalPath(projectId, '', refImage);
        return `file://${p}`;
      }
    } catch { /* not JSON or no references */ }
    return undefined;
  }
  get value() { return this.files.map(f => f.id).join(','); }

  connectedCallback() {
    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.name;
    this.appendChild(this.hiddenInput);

    this.render();
    this.watchForm();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }


  // Called by the host after file picker selection
  async addFiles(files: AppFileInfo[]) {
    // For entity (schema) files, replace whatever thumbnailUrl the caller supplied with
    // the resolved reference image — the JSON file itself isn't viewable.
    const resolved = await Promise.all(files.map(async (f) => {
      if (isSchemaFile(f.name)) {
        const refUrl = await this.resolveEntityThumbnail(f.name);
        return { ...f, thumbnailUrl: refUrl };
      }
      return f;
    }));
    if (!this.multiple) {
      this.files = resolved.slice(0, 1);
    } else {
      for (const f of resolved) {
        if (!this.files.some(existing => existing.id === f.id)) {
          if (this.max > 0 && this.files.length >= this.max) break;
          this.files.push(f);
        }
      }
    }
    this.updateHidden();
    this.renderPreviews();
  }

  private removeFile(fileId: string) {
    this.files = this.files.filter(f => f.id !== fileId);
    this.updateHidden();
    this.renderPreviews();
  }

  private updateHidden() {
    this.hiddenInput.value = this.files.map(f => f.id).join(',');
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private render() {
    const label = resolveLabel(this.getAttribute('label'),  this);

    this.shadow.innerHTML = `
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      <style>
        :host { display: block; }
        .label {
          display: block;
          font-family: var(--hw-font, monospace);
          font-size: 11px;
          color: var(--hw-text-secondary, #999);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-shadow: var(--hw-text-engrave, none);
          margin-bottom: 6px;
        }
        .container {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        :host([size="sm"]) .dropzone { width: 50px; height: 50px; }
        :host([size="md"]) .dropzone { width: 100px; height: 100px; }
        :host([size="lg"]) .dropzone { width: 150px; height: 150px; }

        .dropzone {
          width: 50px;
          height: 50px;
          border: 2px dashed var(--hw-border, #252525);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.15s, background 0.15s;
          cursor: pointer;
          flex-shrink: 0;
        }
        .dropzone.dragover {
          border-color: var(--hw-accent, #e87040);
          background: rgba(232,112,64,0.05);
        }
        .hint {
          font-size: 18px;
          color: var(--hw-text-dim, #444);
        }
        .previews {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        :host([size="sm"]) .preview { width: 50px; height: 50px; }
        :host([size="md"]) .preview { width: 100px; height: 100px; }
        :host([size="lg"]) .preview { width: 150px; height: 150px; }

        .preview {
          position: relative;
          width: 50px;
          height: 50px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--hw-tile-bg, #111);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .preview .icon {
          font-size: 18px;
          color: var(--hw-text-muted, #555);
        }
        .preview .remove {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: rgba(0,0,0,0.6);
          color: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 7px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .preview:hover .remove { opacity: 1; }
        :host(.loading) .container { pointer-events: none; opacity: 0.6; }
        ::slotted(*) { display: none; }
      </style>
      ${label ? `<span class="label">${label}</span>` : ''}
      <div class="container">
        <div class="dropzone" id="zone">
          <span class="hint"><i class="fa-solid fa-plus"></i></span>
        </div>
        <div class="previews" id="previews"></div>
      </div>
      <slot></slot>
    `;

    const zone = this.shadow.getElementById('zone')!;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const fileId = e.dataTransfer?.getData('text/x-avatica-file-id');
      const fileType = e.dataTransfer?.getData('text/x-avatica-file-type') || '';
      if (!fileId) return;
      const fileName = e.dataTransfer?.getData('text/x-avatica-file-name') || fileId.slice(0, 8);
      // Validate: if a schema is set, the file must be of that schema (extension match).
      // Otherwise honour any mime accept= clause.
      if (this.schema) {
        if (!this.matchesSchema(fileName)) return;
      } else if (this.accept && !this.matchesAccept(fileType)) {
        return;
      }
      let thumbUrl = e.dataTransfer?.getData('text/x-avatica-file-thumb') || undefined;
      if (!thumbUrl) thumbUrl = await this.resolveEntityThumbnail(fileName);
      this.addFiles([{ id: fileId, name: fileName, thumbnailUrl: thumbUrl }]);
    });
    zone.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.remove')) return;
      // Ask the host to open a file picker
      this.dispatchEvent(new CustomEvent('app-file-pick', {
        bubbles: true,
        composed: true,
        detail: { element: this, multiple: this.multiple, max: this.max, accept: this.accept, schema: this.schema },
      }));
    });
  }

  private renderPreviews() {
    const previews = this.shadow.getElementById('previews');
    if (!previews) return;

    if (this.files.length === 0) {
      previews.innerHTML = '';
      return;
    }

    previews.innerHTML = this.files.map(f => `
      <div class="preview" data-id="${f.id}">
        ${f.thumbnailUrl
          ? `<img src="${f.thumbnailUrl}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><i class="fa-solid fa-file icon" style="display:none"></i>`
          : `<i class="fa-solid fa-file icon"></i>`}
        <button class="remove" data-remove="${f.id}"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `).join('');

    previews.querySelectorAll<HTMLElement>('[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFile(btn.dataset.remove!);
      });
    });
  }

  private watchForm() {
    const form = this.closest('app-view');
    if (!form) return;
    const update = () => {
      this.classList.toggle('loading', form.hasAttribute('loading'));
    };
    update();
    this.observer = new MutationObserver(update);
    this.observer.observe(form, { attributes: true, attributeFilter: ['loading'] });
  }
}

customElements.define('app-file', AppFile);
