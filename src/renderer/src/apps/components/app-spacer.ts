// <app-spacer> — Fills remaining space in a flex row.

class AppSpacer extends HTMLElement {
  connectedCallback() {
    this.style.flex = '1';
  }
}

customElements.define('app-spacer', AppSpacer);
