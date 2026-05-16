// <app-mode> — Segmented toggle that shows/hides child panels.
//
// Usage:
//   <app-mode name="gender" value="female">
//     <app-mode-option value="female" label="Female">
//       ...content shown when female is selected...
//     </app-mode-option>
//     <app-mode-option value="male" label="Male">
//       ...content shown when male is selected...
//     </app-mode-option>
//   </app-mode>
//
// Attributes:
//   name   — form field name (value included in form submission)
//   value  — currently selected option value (defaults to first option)
//   label  — optional label above the toggle

import { resolveLabel } from './i18n';

class AppMode extends HTMLElement {
  private shadow: ShadowRoot;
  private hiddenInput!: HTMLInputElement;
  private _value = '';

  static get observedAttributes() { return ['value', 'name']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this._value = this.getAttribute('value') || this.modeOptions[0]?.getAttribute('value') || '';

    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.name;
    this.hiddenInput.value = this._value;
    this.appendChild(this.hiddenInput);

    this.render();
    this.updateActive();
  }

  attributeChangedCallback(attr: string, _old: string, val: string) {
    if (attr === 'value' && val !== this._value) {
      this._value = val;
      if (this.hiddenInput) this.hiddenInput.value = val;
      this.updateActive();
      this.updateButtons();
    }
    if (attr === 'name' && this.hiddenInput) {
      this.hiddenInput.name = val;
    }
  }

  get value() { return this._value; }
  set value(v: string) {
    this._value = v;
    this.setAttribute('value', v);
    if (this.hiddenInput) this.hiddenInput.value = v;
  }

  get name() { return this.getAttribute('name') || ''; }

  private get modeOptions(): HTMLElement[] {
    return Array.from(this.querySelectorAll(':scope > app-mode-option'));
  }

  /** Check if an option's value attribute matches the current value (supports comma-separated lists). */
  private optionMatches(opt: HTMLElement): boolean {
    const val = opt.getAttribute('value') || '';
    if (val.includes(',')) {
      return val.split(',').map(v => v.trim()).includes(this._value);
    }
    return val === this._value;
  }

  private updateActive() {
    this.modeOptions.forEach(opt => {
      if (this.optionMatches(opt)) {
        opt.setAttribute('active', '');
      } else {
        opt.removeAttribute('active');
      }
    });
  }

  private updateButtons() {
    this.shadow.querySelectorAll<HTMLElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('seg-btn--active', btn.dataset.value === this._value);
    });
  }

  private render() {
    // Only render buttons for single-value options (not shared/multi-value panels)
    const opts = this.modeOptions
      .filter(o => !(o.getAttribute('value') || '').includes(','))
      .map(o => ({
        value: o.getAttribute('value') || '',
        label: resolveLabel(o.getAttribute('label'),  this) || o.getAttribute('value') || '',
        icon: o.getAttribute('icon') || '',
      }));
    const label = resolveLabel(this.getAttribute('label'),  this);

    this.shadow.innerHTML = `
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      <style>
        :host { display: flex; flex-direction: column; gap: 12px; }

        .label {
          display: block;
          font-family: var(--hw-font, monospace);
          font-size: 11px;
          color: var(--hw-text-secondary, #999);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-shadow: var(--hw-text-engrave, none);
        }

        .toggle {
          display: inline-flex;
          background: var(--hw-bg-pit, #090909);
          border-radius: var(--radius-md);
          padding: 2px;
          box-shadow: var(--hw-shadow-recess, inset 0 2px 4px rgba(0,0,0,0.6));
          align-self: flex-start;
        }

        .seg-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 26px;
          padding: 0 14px;
          border: none;
          border-radius: var(--radius-md-inner);
          background: transparent;
          font-family: var(--hw-font, monospace);
          font-size: 11px;
          color: var(--hw-text-dim, #606060);
          letter-spacing: 0.02em;
          cursor: pointer;
          outline: none;
          user-select: none;
          transition: background 0.15s, color 0.15s;
        }

        .seg-btn:hover {
          color: var(--hw-text-secondary, #999);
        }

        .seg-btn--active {
          background: var(--hw-grad-face-sm, linear-gradient(145deg, #2e2e2e 0%, #161616 60%, #111 100%));
          color: var(--hw-text-primary, #e8e8e8);
        }

        .seg-btn--active:hover {
          color: var(--hw-text-primary, #e8e8e8);
        }

        .seg-icon {
          font-size: 10px;
        }

        .content {
          display: flex;
          flex-direction: column;
        }

        ::slotted(app-mode-option) {
          display: none;
        }

        ::slotted(app-mode-option[active]) {
          display: flex;
        }
      </style>

      ${label ? `<span class="label">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>` : ''}
      <div class="toggle">
        ${opts.map(o => `
          <button type="button" class="seg-btn ${o.value === this._value ? 'seg-btn--active' : ''}" data-value="${o.value}">
            ${o.icon ? `<i class="fa-solid fa-${o.icon} seg-icon"></i>` : ''}
            ${o.label}
          </button>
        `).join('')}
      </div>
      <div class="content">
        <slot></slot>
      </div>
    `;

    this.shadow.querySelectorAll<HTMLElement>('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value || '';
        this.value = val;
        this.updateActive();
        this.updateButtons();
        this.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }
}

class AppModeOption extends HTMLElement {
  connectedCallback() {
    this.style.flexDirection = 'column';
    this.style.gap = '12px';
  }
}

customElements.define('app-mode', AppMode);
customElements.define('app-mode-option', AppModeOption);
