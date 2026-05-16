// <app-view> — Behavioral form component for apps.
//
// Handles:
// - Listens for submit event from any <button type="submit"> inside
// - Collects all named inputs
// - Validates required fields before submitting
// - Calls window.avatica.invoke(data)
// - Updates [estimated-cost] when window.avatica.estimate is available
// - Sets [loading] attribute on itself while invoke is in-flight
// - Sets [invalid] attribute when required fields are empty
// - Enter in any text input triggers submit

import type { AvaticaHostBridge } from '../types';

class AppView extends HTMLElement {
  private _loading = false;
  private estimateTimeout: number | null = null;
  private estimateRequestId = 0;
  private estimateAvailable: boolean | null = null;

  connectedCallback() {
    if (!this.style.display) this.style.display = 'flex';
    if (!this.style.flexDirection) this.style.flexDirection = 'column';
    if (!this.style.gap) this.style.gap = '12px';
    if (!this.style.padding) this.style.padding = '16px 20px';
    this.addEventListener('submit', this.handleSubmit);
    this.addEventListener('keydown', this.handleKeydown);
    this.addEventListener('change', this.handleFieldChange);
    this.addEventListener('input', this.handleFieldInput);

    // Initial validation and cost estimate after children connect.
    requestAnimationFrame(() => {
      this.validate();
      this.scheduleEstimate(0);
    });
  }

  disconnectedCallback() {
    this.removeEventListener('submit', this.handleSubmit);
    this.removeEventListener('keydown', this.handleKeydown);
    this.removeEventListener('change', this.handleFieldChange);
    this.removeEventListener('input', this.handleFieldInput);

    if (this.estimateTimeout !== null) {
      window.clearTimeout(this.estimateTimeout);
      this.estimateTimeout = null;
    }

    this.estimateRequestId++;
  }

  validate() {
    const invalid = !this.isValid();
    if (invalid) this.setAttribute('invalid', '');
    else this.removeAttribute('invalid');
  }

  private isValid(): boolean {
    const required = this.querySelectorAll<HTMLElement>('[required]');
    for (const el of required) {
      // Skip fields inside an inactive app-mode-option panel
      const modeOption = el.closest('app-mode-option');
      if (modeOption && !modeOption.hasAttribute('active')) continue;
      const value = (el as unknown as { value: string }).value;
      if (!value || value.trim() === '') return false;
    }
    return true;
  }

  private handleFieldChange = () => {
    this.validate();
    this.scheduleEstimate();
  };

  private handleFieldInput = () => {
    this.validate();
    this.scheduleEstimate();
  };

  private handleKeydown = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'INPUT') {
      e.preventDefault();
      this.submit();
    }
  };

  private handleSubmit = (e: Event) => {
    e.preventDefault();
    this.submit();
  };

  private getAvatica(): AvaticaHostBridge | undefined {
    return window.__avaticaApp;
  }

  private collectData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    this.querySelectorAll<HTMLElement>('[name]').forEach(el => {
      const field = el as HTMLElement & { name?: string; value?: unknown };
      if (!field.name) return;
      // Skip fields inside an inactive app-mode-option panel
      const modeOption = el.closest('app-mode-option');
      if (modeOption && !modeOption.hasAttribute('active')) return;
      data[field.name] = field.value ?? '';
    });
    return data;
  }

  private setEstimatedCost(estimatedCost: number | null) {
    if (estimatedCost === null) {
      this.removeAttribute('estimated-cost');
      return;
    }

    this.setAttribute('estimated-cost', String(estimatedCost));
  }

  private scheduleEstimate(delay = 250) {
    if (this.estimateAvailable === false || this._loading) return;

    const avatica = this.getAvatica();
    if (!avatica?.estimate) return;

    if (this.estimateTimeout !== null) {
      window.clearTimeout(this.estimateTimeout);
    }

    this.estimateTimeout = window.setTimeout(() => {
      this.estimateTimeout = null;
      void this.refreshEstimate();
    }, delay);
  }

  private async refreshEstimate() {
    if (this.estimateAvailable === false || this._loading) return;

    const avatica = this.getAvatica();
    if (!avatica?.estimate) return;

    const requestId = ++this.estimateRequestId;

    try {
      const estimatedCost = await avatica.estimate(this.collectData());
      if (requestId !== this.estimateRequestId) return;

      if (estimatedCost === null) {
        this.estimateAvailable = false;
        this.setEstimatedCost(null);
        return;
      }

      this.estimateAvailable = true;
      this.setEstimatedCost(estimatedCost);
    } catch {
      if (requestId !== this.estimateRequestId) return;
      if (this.estimateAvailable !== true) {
        this.setEstimatedCost(null);
      }
    }
  }

  private async submit() {
    if (!this.isValid()) return;

    const avatica = this.getAvatica();
    if (!avatica) return;

    const data = this.collectData();

    try {
      await avatica.invoke(data);
    } catch {
      // invoke errors are handled by the host bridge
    }
  }
}

customElements.define('app-view', AppView);
