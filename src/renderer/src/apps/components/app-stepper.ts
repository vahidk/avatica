import { resolveLabel } from './i18n';

// <app-stepper> — Hardware-styled stepper for small numeric ranges.
//
// Usage:
//   <app-stepper name="castSize" value="5" min="1" max="20" label="$castSize"></app-stepper>
//
// - Circular –/+ buttons (cbtn style) flanking a recessed LCD-style display
// - Hidden input in light DOM for FormData compatibility
// - Auto-disables during app-view[loading]

class AppStepper extends HTMLElement {
  private _value = 0;
  private _min = 0;
  private _max = 100;
  private shadow: ShadowRoot;
  private hiddenInput!: HTMLInputElement;
  private display!: HTMLElement;
  private btnDec!: HTMLElement;
  private btnInc!: HTMLElement;
  private observer: MutationObserver | null = null;

  static get observedAttributes() { return ['value', 'name', 'min', 'max', 'disabled']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this._min = parseInt(this.getAttribute('min') || '0', 10);
    this._max = parseInt(this.getAttribute('max') || '100', 10);
    this._value = parseInt(this.getAttribute('value') || String(this._min), 10);

    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.getAttribute('name') || '';
    this.hiddenInput.value = String(this._value);
    this.appendChild(this.hiddenInput);

    this.render();
    this.wireEvents();
    this.watchForm();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  attributeChangedCallback(attr: string, _old: string, val: string) {
    if (attr === 'value') {
      this._value = parseInt(val, 10) || 0;
      this.updateDisplay();
      if (this.hiddenInput) this.hiddenInput.value = String(this._value);
    }
    if (attr === 'name' && this.hiddenInput) this.hiddenInput.name = val || '';
    if (attr === 'min') this._min = parseInt(val, 10) || 0;
    if (attr === 'max') this._max = parseInt(val, 10) || 100;
  }

  get value() { return String(this._value); }
  set value(v: string) {
    this._value = parseInt(v, 10) || 0;
    this.setAttribute('value', String(this._value));
  }

  get name() { return this.getAttribute('name') || ''; }

  private render() {
    const label = resolveLabel(this.getAttribute('label'),  this);

    this.shadow.innerHTML = `
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      <style>
        :host {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
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

        .stepper {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Circular push buttons — matches cbtn--sm from HW design */
        .btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--hw-bg-pit, #090909);
          padding: 2px;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--hw-shadow-recess, inset 0 2px 4px rgba(0,0,0,0.6));
          outline: none;
          flex-shrink: 0;
        }

        .btn__face {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--hw-grad-face, linear-gradient(145deg, #333 0%, #161616 60%, #111 100%));
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s;
        }

        .btn:active .btn__face {
          transform: scale(0.9);
        }

        .btn__face i {
          font-size: 10px;
          color: var(--hw-text-secondary, #999);
        }

        .btn:hover .btn__face i {
          color: var(--hw-text-primary, #e8e8e8);
        }

        .btn.is-disabled {
          opacity: 0.3;
          pointer-events: none;
        }

        /* Recessed display pit */
        .display {
          width: 44px;
          height: 32px;
          background: var(--hw-bg-pit, #090909);
          border-radius: var(--radius-md);
          padding: 2px;
          box-sizing: border-box;
          box-shadow: var(--hw-shadow-recess, inset 0 2px 4px rgba(0,0,0,0.5));
        }

        .display__inner {
          width: 100%;
          height: 100%;
          background: var(--hw-tile-bg, #111);
          border-radius: var(--radius-md-inner);
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          box-shadow: var(--hw-shadow-inset, inset 0 1px 4px rgba(0,0,0,0.4));
          font-family: var(--hw-font, monospace);
          font-size: 13px;
          font-weight: 600;
          color: var(--hw-text-secondary, #999);
          letter-spacing: 0.05em;
          user-select: none;
        }

        :host(.loading) .btn { pointer-events: none; opacity: 0.4; }
        :host(.loading) .display__inner { opacity: 0.6; }

        ::slotted(*) { display: none; }
      </style>

      ${label ? `<span class="label">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>` : ''}
      <div class="stepper">
        <button type="button" class="btn btn-dec"><div class="btn__face"><i class="fa-solid fa-minus"></i></div></button>
        <div class="display"><div class="display__inner"></div></div>
        <button type="button" class="btn btn-inc"><div class="btn__face"><i class="fa-solid fa-plus"></i></div></button>
      </div>
      <slot></slot>
    `;

    this.btnDec = this.shadow.querySelector('.btn-dec')!;
    this.btnInc = this.shadow.querySelector('.btn-inc')!;
    this.display = this.shadow.querySelector('.display__inner')!;
    this.updateDisplay();
  }

  private wireEvents() {
    this.btnDec.addEventListener('click', () => {
      if (this._value > this._min) {
        this._value--;
        this.sync();
      }
    });

    this.btnInc.addEventListener('click', () => {
      if (this._value < this._max) {
        this._value++;
        this.sync();
      }
    });
  }

  private sync() {
    this.hiddenInput.value = String(this._value);
    this.setAttribute('value', String(this._value));
    this.updateDisplay();
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private updateDisplay() {
    if (this.display) this.display.textContent = String(this._value);
    if (this.btnDec) this.btnDec.classList.toggle('is-disabled', this._value <= this._min);
    if (this.btnInc) this.btnInc.classList.toggle('is-disabled', this._value >= this._max);
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

customElements.define('app-stepper', AppStepper);
