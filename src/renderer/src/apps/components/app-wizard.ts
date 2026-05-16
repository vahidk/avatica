// <app-wizard> — Multi-step wizard container for complex app flows.
//
// Usage:
//   <app-wizard>
//     <app-wizard-step title="Style">...step 1 content...</app-wizard-step>
//     <app-wizard-step title="Setting">...step 2 content...</app-wizard-step>
//     <app-wizard-step title="Generate">...step 3 content...</app-wizard-step>
//   </app-wizard>
//
// - Shows one step at a time with back/next navigation
// - Progress dots at the top
// - Last step shows a "Generate" button instead of "Next"
// - Collects values from all steps (not just the current one)

class AppWizard extends HTMLElement {
  private shadow: ShadowRoot;
  private _step = 0;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private get steps(): HTMLElement[] {
    return Array.from(this.querySelectorAll(':scope > app-wizard-step'));
  }

  private get totalSteps(): number {
    return this.steps.length;
  }

  private render() {
    const total = this.totalSteps;
    const step = this._step;
    const isLast = step >= total - 1;
    const isFirst = step === 0;

    this.shadow.innerHTML = `
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      <style>
        :host { display: flex; flex-direction: column; gap: 12px; }

        .header {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 28px;
        }

        .nav-btn {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: var(--radius-sm);
          background: var(--hw-bg-pit, #090909);
          color: var(--hw-text-secondary, #999);
          font-size: 11px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
          box-shadow: var(--hw-shadow-recess, inset 0 2px 4px rgba(0,0,0,0.5));
        }

        .nav-btn:hover { color: var(--hw-text-primary, #e8e8e8); }
        .nav-btn:disabled { opacity: 0.3; cursor: default; }

        .title {
          font-family: var(--hw-font, monospace);
          font-size: 11px;
          font-weight: 600;
          color: var(--hw-text-primary, #e8e8e8);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .dots {
          display: flex;
          gap: 6px;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--hw-border, #252525);
          transition: background 0.2s, box-shadow 0.2s;
        }

        .dot--active {
          background: var(--hw-accent, #e87040);
          box-shadow: 0 0 6px var(--hw-accent, #e87040);
        }

        .dot--done {
          background: var(--hw-text-secondary, #999);
        }

        .content {
          display: flex;
          flex-direction: column;
        }

        ::slotted(app-wizard-step) {
          display: none;
        }

        ::slotted(app-wizard-step[active]) {
          display: flex;
        }
      </style>

      <div class="header">
        <span class="title"></span>
        <span style="flex:1"></span>
        <button type="button" class="nav-btn" id="back" ${isFirst ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
        <div class="dots">
          ${Array.from({ length: total }, (_, i) =>
            `<div class="dot ${i === step ? 'dot--active' : i < step ? 'dot--done' : ''}"></div>`
          ).join('')}
        </div>
        <button type="button" class="nav-btn" id="next" ${isLast ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="content">
        <slot></slot>
      </div>
    `;

    // Show only the current step
    this.steps.forEach((s, i) => {
      if (i === step) s.setAttribute('active', '');
      else s.removeAttribute('active');
    });

    // Update title from current step
    const titleEl = this.shadow.querySelector('.title')!;
    const currentStep = this.steps[step];
    titleEl.textContent = currentStep?.getAttribute('title') || `Step ${step + 1}`;

    // Wire nav buttons
    this.shadow.getElementById('back')?.addEventListener('click', () => {
      if (this._step > 0) { this._step--; this.render(); }
    });

    this.shadow.getElementById('next')?.addEventListener('click', () => {
      if (this._step < this.totalSteps - 1) { this._step++; this.render(); }
    });
  }

  /** Reset wizard to first step */
  reset() {
    this._step = 0;
    this.render();
  }
}

class AppWizardStep extends HTMLElement {
  connectedCallback() {
    this.style.flexDirection = 'column';
    this.style.gap = '12px';
  }
}

customElements.define('app-wizard', AppWizard);
customElements.define('app-wizard-step', AppWizardStep);
