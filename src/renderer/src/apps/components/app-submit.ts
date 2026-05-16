// <app-submit> — Submit button for app forms.
// Renders the two-layer hw button with icon and optional cost estimate.
// Automatically shows spinner and disables when inside an <app-view> with [loading].
// Triggers form submit on click.

import { formatCost } from '../../utils/formatCost';

class AppSubmit extends HTMLElement {
  private observer: MutationObserver | null = null;

  static get observedAttributes() { return ['label', 'icon']; }

  attributeChangedCallback() {
    if (this.shadowRoot) this.render();
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
    this.watchForm();

    this.addEventListener('click', () => {
      const form = this.closest('app-view');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: false }));
    });
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  private render() {
    const label = this.getAttribute('label');
    const icon = this.getAttribute('icon') || 'fa-solid fa-arrow-up';
    const estimatedCost = this.closest('app-view')?.getAttribute('estimated-cost');
    const formattedEstimate = estimatedCost === null ? null : formatCost(Number(estimatedCost));
    const hasLabel = !!label;
    const hasEstimate = formattedEstimate !== null;
    const hasText = hasLabel || hasEstimate;

    this.shadowRoot!.innerHTML = `
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      <style>
        :host {
          display: inline-flex;
          flex-shrink: 0;
          cursor: pointer;
        }
        .pit {
          border-radius: var(--radius-md);
          background: var(--hw-bg-pit, #090909);
          padding: 2px;
          box-shadow: var(--hw-shadow-recess, inset 0 2px 4px rgba(0,0,0,0.6));
        }
        .face {
          height: 28px;
          border-radius: var(--radius-md-inner);
          background: var(--hw-grad-face-sm, linear-gradient(145deg, #2e2e2e 0%, #161616 60%, #111 100%));
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 ${hasText ? '14px' : '8px'};
          transition: transform 0.1s;
          color: var(--hw-text-muted, #555);
          font-size: 13px;
          white-space: nowrap;
        }
        .label {
          font-family: var(--hw-font, monospace);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .estimate {
          font-family: var(--hw-font, monospace);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--hw-text-dim, #777);
        }
        :host(:hover) .face { color: var(--hw-accent, #e87040); }
        :host(:hover) .estimate { color: inherit; }
        :host(:active) .face { transform: scale(0.94); }
        :host(.loading) { pointer-events: none; }
        :host(.loading) .face { color: var(--hw-accent, #e87040); }
        :host(.disabled) { opacity: 0.6; pointer-events: none; }

        .icon-main { display: inline; }
        .icon-spinner { display: none; }
        :host(.loading) .icon-main { display: none; }
        :host(.loading) .label { display: none; }
        :host(.loading) .estimate { display: none; }
        :host(.loading) .icon-spinner { display: inline; animation: spin 1s linear infinite; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
      <div class="pit">
        <div class="face">
          ${hasLabel ? `<span class="label">${label}</span>` : ''}
          ${hasEstimate ? `<span class="estimate">${formattedEstimate} CR</span>` : ''}
          <i class="${icon} icon-main"></i>
          <i class="fa-solid fa-spinner icon-spinner"></i>
        </div>
      </div>
    `;
  }

  private watchForm() {
    const form = this.closest('app-view');
    if (!form) return;

    const update = () => {
      this.classList.toggle('loading', form.hasAttribute('loading'));
      this.classList.toggle('disabled', form.hasAttribute('invalid'));
      this.render();
    };
    update();

    this.observer = new MutationObserver(update);
    this.observer.observe(form, { attributes: true, attributeFilter: ['loading', 'invalid', 'estimated-cost'] });
  }
}

customElements.define('app-submit', AppSubmit);
