import { resolveLabel } from './i18n';

interface OptionEntry { value: string; label: string; requires?: Record<string, string[]> }
interface ProviderEntry {
  id: string;
  name: string;
  isDefault?: boolean;
  options?: Record<string, OptionEntry[]>;
  defaults?: Record<string, string>;
}

// <app-select> — Custom dropdown web component styled with hw design tokens.
//
// Usage (static options):
//   <app-select name="aspectRatio" value="16:9">
//     <option value="1:1">1:1</option>
//     <option value="16:9">16:9</option>
//   </app-select>
//
// Usage (dynamic options from providers context):
//   <app-select name="model" options="$providers.image.generate"></app-select>
//   <app-select name="imageSize" options="$providers.image.generate[model].imageSize"></app-select>
//
// Option constraints (in provider data):
//   durationSeconds: [
//     { value: '4', label: '4s', requires: { resolution: ['720p'] } },
//     { value: '8', label: '8s' },  // always available
//   ]

class AppSelect extends HTMLElement {
  private _value = '';
  private _open = false;
  private shadow: ShadowRoot;
  private trigger!: HTMLElement;
  private menu!: HTMLElement;
  private valueLabel!: HTMLElement;
  private hiddenInput!: HTMLInputElement;
  private outsideClickHandler: (e: MouseEvent) => void;
  private _dynamicOptions: { value: string; label: string }[] | null = null;
  /** Full unfiltered options — before requires filtering. */
  private _allDynamicOptions: OptionEntry[] | null = null;
  private _cleanups: (() => void)[] = [];

  static get observedAttributes() { return ['value', 'name']; }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.contains(e.target as Node)) this.close();
    };
  }

  connectedCallback() {
    this._value = this.getAttribute('value') || '';

    // Hidden input in light DOM for FormData compatibility
    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.name;
    this.hiddenInput.value = this._value;
    this.appendChild(this.hiddenInput);

    this.resolveDynamicOptions();
    this.render();
    this.wireEvents();
    document.addEventListener('click', this.outsideClickHandler);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.outsideClickHandler);
    for (const fn of this._cleanups) fn();
    this._cleanups = [];
  }

  attributeChangedCallback(name: string, _old: string, val: string) {
    if (name === 'value') {
      this._value = val;
      if (this.valueLabel) this.valueLabel.innerHTML = this.ratioBox(val) + this.selectedLabel();
      if (this.hiddenInput) this.hiddenInput.value = val;
    }
    if (name === 'name' && this.hiddenInput) {
      this.hiddenInput.name = val;
    }
  }

  get value() { return this._value; }
  set value(v: string) {
    this._value = v;
    this.setAttribute('value', v);
  }

  get name() { return this.getAttribute('name') || ''; }

  private options(): { value: string; label: string }[] {
    if (this._dynamicOptions) return this._dynamicOptions;
    return Array.from(this.querySelectorAll('option')).map(o => ({
      value: o.hasAttribute('value') ? o.getAttribute('value')! : (o.textContent || ''),
      label: o.textContent || o.getAttribute('value') || '',
    }));
  }

  // --- Dynamic $-binding resolution ---

  private resolveDynamicOptions() {
    const binding = this.getAttribute('options');
    if (!binding?.startsWith('$providers.')) return;

    const path = binding.slice('$providers.'.length); // e.g. "image.generate" or "image.generate[model].imageSize"
    const providers = this.findProvidersContext();
    if (!providers) return;

    // Parse path for [fieldRef] dependency
    const bracketMatch = path.match(/^(.+?)\[(\w+)\]\.(.+)$/);

    if (bracketMatch) {
      // Dependent binding: e.g. "image.generate[model].imageSize"
      const capabilityPath = bracketMatch[1]; // "image.generate"
      const fieldRef = bracketMatch[2];       // "model"
      const optionKey = bracketMatch[3];      // "imageSize"

      const providerList = this.resolvePath(providers, capabilityPath) as ProviderEntry[] | undefined;
      if (!Array.isArray(providerList)) return;

      // Listen for changes on the referenced field
      const depSelect = this.findSiblingByName(fieldRef) as AppSelect | null;
      if (depSelect) {
        const update = () => {
          const selectedId = depSelect.value;
          const provider = providerList.find(p => p.id === selectedId);
          const opts: OptionEntry[] = provider?.options?.[optionKey] || [];
          this._allDynamicOptions = opts;

          // Apply requires filtering + set up constraint listeners
          this.applyConstraints(provider?.defaults?.[optionKey]);
        };

        depSelect.addEventListener('change', update);
        this._cleanups.push(() => depSelect.removeEventListener('change', update));
        update(); // initial resolve
      }
    } else {
      // Model list binding: e.g. "image.generate"
      const providerList = this.resolvePath(providers, path) as ProviderEntry[] | undefined;
      if (!Array.isArray(providerList)) return;

      this._dynamicOptions = providerList.map(p => ({
        value: p.id,
        label: p.name,
      }));

      // Set default value to the capability default provider, or first if none marked
      if (!this._value && this._dynamicOptions.length > 0) {
        const defaultProvider = providerList.find(p => p.isDefault);
        this._value = defaultProvider ? defaultProvider.id : this._dynamicOptions[0].value;
        if (this.hiddenInput) this.hiddenInput.value = this._value;
      }

    }
  }

  /**
   * Filter options by `requires` constraints, listen for changes on constraint
   * siblings, and re-filter + re-render when they change.
   */
  private applyConstraints(defaultVal?: string) {
    const allOpts = this._allDynamicOptions || [];

    // Collect all sibling field names referenced in any requires
    const requiredFields = new Set<string>();
    for (const opt of allOpts) {
      if (opt.requires) {
        for (const field of Object.keys(opt.requires)) requiredFields.add(field);
      }
    }

    const filterAndRender = () => {
      // Read current sibling values
      const siblingValues: Record<string, string> = {};
      for (const field of requiredFields) {
        const sibling = this.findSiblingByName(field) as AppSelect | null;
        if (sibling) siblingValues[field] = sibling.value;
      }

      // Filter options by sibling constraints
      this._dynamicOptions = allOpts
        .filter(opt => {
          if (!opt.requires) return true;
          return Object.entries(opt.requires).every(([field, allowed]) =>
            !siblingValues[field] || allowed.includes(siblingValues[field])
          );
        })
        .map(o => ({ value: o.value, label: o.label }));

      // Select best value: keep current if still valid, else use default, else first
      const validValues = this._dynamicOptions.map(o => o.value);
      if (validValues.includes(this._value)) {
        // current value is still valid — keep it
      } else if (defaultVal && validValues.includes(defaultVal)) {
        this.value = defaultVal;
      } else if (validValues.length > 0) {
        this.value = validValues[0];
      }

      this.render();
      this.wireEvents();
    };

    // Listen for changes on constraint siblings
    for (const field of requiredFields) {
      const sibling = this.findSiblingByName(field) as AppSelect | null;
      if (sibling) {
        const handler = () => filterAndRender();
        sibling.addEventListener('change', handler);
        this._cleanups.push(() => sibling.removeEventListener('change', handler));
      }
    }

    // Initial filter
    filterAndRender();
  }

  private findProvidersContext(): Record<string, unknown> | null {
    let node: HTMLElement | null = this.parentElement;
    while (node) {
      if ('__providers' in node) return (node as HTMLElement & { __providers: Record<string, unknown> }).__providers;
      node = node.parentElement;
    }
    return null;
  }

  private resolvePath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj);
  }

  private findSiblingByName(name: string): HTMLElement | null {
    // Scope to the closest mode panel first so duplicate names across panels resolve correctly
    const root = this.closest('app-mode-option') || this.closest('app-view') || this.parentElement;
    return root?.querySelector(`app-select[name="${name}"]`) as HTMLElement | null;
  }

  // --- Rendering ---

  private selectedLabel(): string {
    const opt = this.options().find(o => o.value === this._value);
    return opt?.label || this._value;
  }

  private ratioBox(value: string): string {
    const match = value.match(/^(\d+):(\d+)$/);
    if (!match) return '';
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    const maxDim = 14;
    const scale = maxDim / Math.max(w, h);
    const rw = Math.round(w * scale);
    const rh = Math.round(h * scale);
    return `<span class="ratio-wrap"><span class="ratio-box" style="width:${rw}px;height:${rh}px"></span></span>`;
  }

  private render() {
    const opts = this.options();
    const label = resolveLabel(this.getAttribute('label'),  this);
    this.shadow.innerHTML = `
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      <style>
        :host { display: inline-block; position: relative; }
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
          box-shadow: var(--hw-shadow-recess, inset 0 2px 4px rgba(0,0,0,0.6));
        }

        .trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          height: 28px;
          min-width: 86px;
          padding: 0 12px;
          background: var(--hw-grad-face-sm, linear-gradient(145deg, #2e2e2e 0%, #161616 60%, #111 100%));
          border: none;
          border-radius: var(--radius-md-inner);
          font-family: var(--hw-font, monospace);
          font-size: 11px;
          color: var(--hw-text-secondary, #999);
          letter-spacing: 0.02em;
          cursor: pointer;
          outline: none;
          user-select: none;
          transition: transform 0.1s;
          box-sizing: border-box;
        }

        :host(:active) .trigger { transform: scale(0.97); }

        .arrow {
          font-size: 8px;
          opacity: 0.5;
          transition: transform 0.15s;
        }
        :host(.is-open) .arrow { transform: rotate(180deg); }

        .menu {
          display: none;
          position: fixed;
          min-width: 100%;
          background: var(--bg-2, #181818);
          border: 1px solid var(--hw-border-deep, #222);
          border-radius: var(--radius-md);
          padding: 4px;
          z-index: 10000;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          flex-direction: column;
          gap: 1px;
        }
        :host(.is-open) .menu { display: flex; }

        .option {
          display: flex;
          align-items: center;
          border: none;
          outline: none;
          background: transparent;
          padding: 6px 10px;
          font-family: var(--hw-font, monospace);
          font-size: 11px;
          color: var(--hw-text-muted, #555);
          letter-spacing: 0.02em;
          cursor: pointer;
          border-radius: var(--radius-sm);
          text-align: left;
          transition: background 0.1s, color 0.1s;
        }
        .option:hover {
          background: var(--hw-bg-recess, #111);
          color: var(--hw-text-primary, #e8e8e8);
        }
        .option[data-active] {
          color: var(--hw-accent, #e87040);
        }
        .option[data-active] .ratio-box {
          border-color: var(--hw-accent, #e87040);
        }
        .value {
          display: flex;
          align-items: center;
        }

        .ratio-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 17px;
          margin-right: 6px;
          flex-shrink: 0;
        }
        .ratio-box {
          display: inline-block;
          border: 1.5px solid var(--hw-text-muted, #555);
          border-radius: 1px;
          flex-shrink: 0;
        }

        ::slotted(*) { display: none; }
      </style>

      ${label ? `<span class="label">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>` : ''}
      <div class="pit">
        <div class="trigger" part="trigger">
          <span class="value">${this.ratioBox(this._value)}${this.selectedLabel()}</span>
          <i class="fa-solid fa-chevron-down arrow"></i>
        </div>
      </div>
      <div class="menu" part="menu">
        ${opts.map(o => `<button type="button" class="option" data-value="${o.value}" ${o.value === this._value ? 'data-active' : ''}>${this.ratioBox(o.value)}${o.label}</button>`).join('')}
      </div>
      <slot></slot>
    `;

    this.trigger = this.shadow.querySelector('.trigger')!;
    this.menu = this.shadow.querySelector('.menu')!;
    this.valueLabel = this.shadow.querySelector('.value')!;
  }

  private wireEvents() {
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._open) this.close();
      else this.open();
    });

    this.menu.querySelectorAll<HTMLElement>('.option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value || '';
        this.value = val;
        this.menu.querySelectorAll('.option').forEach(o => o.removeAttribute('data-active'));
        opt.setAttribute('data-active', '');
        this.close();
        this.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  private open() {
    // Close any other open selects
    document.querySelectorAll('app-select.is-open').forEach(el => {
      if (el !== this) (el as AppSelect).close();
    });
    this._open = true;
    this.classList.add('is-open');
    // Position the fixed menu below the trigger
    const rect = this.trigger.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom + 6}px`;
    this.menu.style.left = `${rect.left}px`;
    this.menu.style.minWidth = `${rect.width}px`;
  }

  private close() {
    this._open = false;
    this.classList.remove('is-open');
  }
}

customElements.define('app-select', AppSelect);
