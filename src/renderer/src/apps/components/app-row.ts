// <app-row> — Simple flex row layout component.
// Just display:flex with sensible defaults. No behavior.

class AppRow extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
        }
      </style>
      <slot></slot>
    `;
  }
}

customElements.define('app-row', AppRow);
