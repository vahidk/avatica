import { resolveLabel } from './i18n';
import { resolveAssetUrl } from './asset-url';

// <app-image-select> — Visual grid picker with thumbnail images.
//
// Usage:
//   <app-image-select name="style" columns="3">
//     <option value="editorial" label="Editorial" image="/apps/fashion/editorial.jpg"></option>
//     <option value="streetwear" label="Streetwear" image="/apps/fashion/streetwear.jpg"></option>
//   </app-image-select>
//
// Attributes:
//   name      — form field name
//   value     — currently selected value
//   columns   — grid columns (default 3)
//   multiple  — allow multi-select (comma-separated values)
//   label     — optional label above the grid
//
// Each <option> should have:
//   value     — the value passed to run.js
//   label     — display text below the image
//   image     — URL to the thumbnail image

class AppImageSelect extends HTMLElement {
  private shadow: ShadowRoot;
  private hiddenInput!: HTMLInputElement;
  private _selected: Set<string> = new Set();

  static get observedAttributes() { return ['value', 'name']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const initial = this.getAttribute('value');
    if (initial) {
      initial.split(',').forEach(v => this._selected.add(v.trim()));
    }

    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.name;
    this.hiddenInput.value = this.value;
    this.appendChild(this.hiddenInput);

    this.render();
    this.watchForm();
  }

  attributeChangedCallback(attr: string, _old: string, val: string) {
    if (attr === 'value') {
      this._selected.clear();
      if (val) val.split(',').forEach(v => this._selected.add(v.trim()));
      if (this.hiddenInput) this.hiddenInput.value = val;
      this.updateActive();
    }
    if (attr === 'name' && this.hiddenInput) {
      this.hiddenInput.name = val;
    }
  }

  get value() { return [...this._selected].join(','); }
  set value(v: string) {
    this._selected.clear();
    if (v) v.split(',').forEach(s => this._selected.add(s.trim()));
    this.setAttribute('value', this.value);
    if (this.hiddenInput) this.hiddenInput.value = this.value;
  }

  get name() { return this.getAttribute('name') || ''; }
  get multiple() { return this.hasAttribute('multiple'); }

  private options(): { value: string; label: string; image: string }[] {
    return Array.from(this.querySelectorAll('option')).map(o => ({
      value: o.getAttribute('value') || o.textContent || '',
      label: resolveLabel(o.getAttribute('label'),  this) || o.textContent || '',
      image: resolveAssetUrl(o.getAttribute('image') || '', this),
    }));
  }

  private updateActive() {
    this.shadow.querySelectorAll<HTMLElement>('.card').forEach(card => {
      const val = card.dataset.value || '';
      card.classList.toggle('card--active', this._selected.has(val));
    });
  }

  private render() {
    const opts = this.options();
    const label = resolveLabel(this.getAttribute('label'),  this);

    this.shadow.innerHTML = `
      <style>
        :host { display: block; overflow: visible; }

        .label {
          display: block;
          font-family: var(--hw-font, monospace);
          font-size: 11px;
          color: var(--hw-text-secondary, #999);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-shadow: var(--hw-text-engrave, none);
          margin-bottom: 8px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(var(--img-select-size, 100px), 1fr));
          gap: 8px;
        }
        :host([size="sm"]) .grid { --img-select-size: 100px; }
        :host([size="md"]) .grid { --img-select-size: 150px; }
        :host([size="lg"]) .grid { --img-select-size: 200px; }

        .grid {
          overflow: visible;
        }

        .card {
          position: relative;
          border-radius: var(--radius-md);
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: border-color 0.15s, box-shadow 0.15s;
          background: var(--hw-bg-pit, #090909);
          box-shadow: var(--hw-shadow-recess, inset 0 2px 4px rgba(0,0,0,0.5));
        }

        .card:hover {
          border-color: var(--hw-border, #252525);
          z-index: 10;
          overflow: visible;
        }

        .card__hover-preview {
          display: none;
          position: fixed;
          width: 200px;
          z-index: 10000;
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--hw-bg-pit, #090909);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
          border: 2px solid var(--hw-border, #252525);
          pointer-events: none;
        }

        .card--active .card__hover-preview {
          border-color: var(--hw-accent, #e87040);
        }

        .card__hover-preview img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
        }

        .card__hover-preview .card__preview-label {
          padding: 6px 8px;
          font-family: var(--hw-font, monospace);
          font-size: 10px;
          color: var(--hw-text-secondary, #999);
          text-align: center;
        }

        .card--active {
          border-color: var(--hw-accent, #e87040);
          box-shadow: 0 0 12px rgba(232, 112, 64, 0.2);
        }

        .card--active:hover {
          border-color: var(--hw-accent, #e87040);
          box-shadow: 0 8px 24px rgba(232, 112, 64, 0.3);
        }

        .card__img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
          border-radius: var(--radius-md) var(--radius-md) 0 0;
        }

        .card__img--empty {
          width: 100%;
          aspect-ratio: 1;
          background: var(--hw-tile-bg, #111);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--hw-text-dim, #444);
          font-size: 20px;
        }

        .card__label {
          padding: 6px 8px;
          font-family: var(--hw-font, monospace);
          font-size: 10px;
          color: var(--hw-text-secondary, #999);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card--active .card__label {
          color: var(--hw-accent, #e87040);
        }

        .card__check {
          display: none;
        }

        :host(.loading) .card {
          pointer-events: none;
          opacity: 0.6;
        }

        ::slotted(*) { display: none; }
      </style>

      ${label ? `<span class="label">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>` : ''}
      <div class="grid">
        ${opts.map(o => `
          <div class="card ${this._selected.has(o.value) ? 'card--active' : ''}" data-value="${o.value}">
            ${o.image
              ? `<img class="card__img" src="${o.image}" alt="${o.label}" loading="lazy" />`
              : `<div class="card__img--empty"><i class="fa-solid fa-image"></i></div>`}
            <div class="card__label">${o.label}</div>
            <div class="card__check"><i class="fa-solid fa-check"></i></div>
            ${o.image ? `<div class="card__hover-preview"><img src="${o.image}" alt="${o.label}" /><div class="card__preview-label">${o.label}</div></div>` : ''}
          </div>
        `).join('')}
      </div>
      <slot></slot>
    `;

    // Wire hover preview positioning (desktop only — skip on touch devices)
    if (!('ontouchstart' in window)) {
      this.shadow.querySelectorAll<HTMLElement>('.card').forEach(card => {
        const preview = card.querySelector<HTMLElement>('.card__hover-preview');
        if (preview) {
          card.addEventListener('mouseenter', () => {
            const rect = card.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            preview.style.left = `${centerX - 100}px`;
            preview.style.top = `${centerY - 100}px`;
            preview.style.display = 'block';
          });
          card.addEventListener('mouseleave', () => {
            preview.style.display = 'none';
          });
        }
      });
    }

    // Wire click events
    this.shadow.querySelectorAll<HTMLElement>('.card').forEach(card => {
      card.addEventListener('click', () => {
        const val = card.dataset.value || '';
        if (this.multiple) {
          if (this._selected.has(val)) this._selected.delete(val);
          else this._selected.add(val);
        } else {
          this._selected.clear();
          this._selected.add(val);
        }
        this.setAttribute('value', this.value);
        if (this.hiddenInput) this.hiddenInput.value = this.value;
        this.updateActive();
        this.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  private watchForm() {
    const form = this.closest('app-view');
    if (!form) return;
    const observer = new MutationObserver(() => {
      this.classList.toggle('loading', form.hasAttribute('loading'));
    });
    observer.observe(form, { attributes: true, attributeFilter: ['loading'] });
  }
}

customElements.define('app-image-select', AppImageSelect);
