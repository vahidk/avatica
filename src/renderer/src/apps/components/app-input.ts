import { resolveLabel } from './i18n';

// <app-input> — Styled input component for apps.
//
// Usage:
//   <app-input name="prompt" type="text" placeholder="..."></app-input>
//   <app-input name="count" type="number" value="5" min="1" max="20"></app-input>
//   <app-input name="description" type="textarea" placeholder="..."></app-input>
//
// - Renders hw-styled pit + inner control in shadow DOM
// - Light DOM hidden input for FormData compatibility
// - Auto-disables during app-view[loading]
// - Proxies: placeholder, min, max, value, disabled, rows

class AppInput extends HTMLElement {
  private shadow: ShadowRoot;
  private hiddenInput!: HTMLInputElement;
  private control!: HTMLInputElement | HTMLTextAreaElement;
  private observer: MutationObserver | null = null;

  static get observedAttributes() { return ['value', 'name', 'placeholder', 'disabled', 'min', 'max', 'type', 'rows']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Hidden input in light DOM for FormData
    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.getAttribute('name') || '';
    this.hiddenInput.value = this.getAttribute('value') || '';
    this.appendChild(this.hiddenInput);

    this.render();
    this.wireEvents();
    this.watchForm();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  attributeChangedCallback(attr: string, _old: string, val: string) {
    if (!this.control) return;
    if (attr === 'value') {
      this.control.value = val || '';
      if (this.hiddenInput) this.hiddenInput.value = val || '';
    }
    if (attr === 'name' && this.hiddenInput) this.hiddenInput.name = val || '';
    if (attr === 'placeholder') this.control.placeholder = val || '';
    if (attr === 'disabled') this.control.disabled = val !== null;
    if (attr === 'min' && 'min' in this.control) (this.control as HTMLInputElement).min = val || '';
    if (attr === 'max' && 'max' in this.control) (this.control as HTMLInputElement).max = val || '';
  }

  get value() { return this.control?.value || ''; }
  set value(v: string) {
    if (this.control) this.control.value = v;
    if (this.hiddenInput) this.hiddenInput.value = v;
    this.setAttribute('value', v);
  }

  get name() { return this.getAttribute('name') || ''; }

  private render() {
    const type = this.getAttribute('type') || 'text';
    const placeholder = resolveLabel(this.getAttribute('placeholder'),  this) || '';
    const value = this.getAttribute('value') || '';
    const min = this.getAttribute('min');
    const max = this.getAttribute('max');
    const rows = this.getAttribute('rows') || '3';

    let controlHtml: string;
    if (type === 'textarea') {
      controlHtml = `<textarea class="control" placeholder="${this.esc(placeholder)}" rows="${rows}">${this.esc(value)}</textarea>`;
    } else {
      controlHtml = `<input class="control" type="${this.esc(type)}" placeholder="${this.esc(placeholder)}" value="${this.esc(value)}" ${min !== null ? `min="${this.esc(min!)}"` : ''} ${max !== null ? `max="${this.esc(max!)}"` : ''} autocomplete="off" />`;
    }

    const label = resolveLabel(this.getAttribute('label'),  this);

    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
          flex: 1;
        }
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
        .pit {
          background: var(--hw-bg-pit, #090909);
          border-radius: var(--radius-md);
          padding: 2px;
          box-shadow: var(--hw-shadow-recess, inset 0 2px 4px rgba(0,0,0,0.5));
        }
        .control {
          width: 100%;
          border: none;
          outline: none;
          background: var(--hw-tile-bg, #111);
          border-radius: var(--radius-md-inner);
          padding: 7px 14px;
          font-family: var(--hw-font, monospace);
          font-size: 13px;
          color: var(--hw-text-primary, #e8e8e8);
          letter-spacing: 0.02em;
          box-shadow: var(--hw-shadow-inset, inset 0 1px 4px rgba(0,0,0,0.4));
          caret-color: var(--hw-text-secondary, #999);
          box-sizing: border-box;
          resize: none;
        }
        .control::placeholder { color: var(--hw-text-dim, #444); }
        .control::selection { background: var(--hw-accent, #e87040); color: #fff; }
        :host(.loading) .control { pointer-events: none; opacity: 0.6; }

        /* Number: hide spinners */
        .control[type="number"] {
          -moz-appearance: textfield;
          padding: 0 12px;
          height: 28px;
          font-size: 11px;
          color: var(--hw-text-secondary, #999);
        }
        .control[type="number"]::-webkit-inner-spin-button,
        .control[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        /* Textarea */
        textarea.control {
          min-height: 60px;
        }

        ::slotted(*) { display: none; }
      </style>
      ${label ? `<span class="label">${this.esc(label)}</span>` : ''}
      <div class="pit">
        ${controlHtml}
      </div>
      <slot></slot>
    `;

    this.control = this.shadow.querySelector('.control') as HTMLInputElement | HTMLTextAreaElement;
  }

  private wireEvents() {
    this.control.addEventListener('input', () => {
      this.hiddenInput.value = this.control.value;
      this.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Enter submits the form; Shift+Enter inserts a newline (textarea only).
    this.control.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key !== 'Enter' || ke.shiftKey || ke.isComposing) return;
      ke.preventDefault();
      const form = this.closest('app-view');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: false }));
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

  private esc(s: string) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

customElements.define('app-input', AppInput);
