class CategoryTilesComponent extends HTMLElement {
  connectedCallback() {
    this.tabs = this.querySelectorAll('.category-tiles__tab[data-tab-index]');
    this.panels = this.querySelectorAll('.category-tiles__grid[data-panel-index]');

    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => this.setActive(tab.dataset.tabIndex));
    });
  }

  setActive(index) {
    this.tabs.forEach((tab) => {
      const active = tab.dataset.tabIndex === index;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    this.panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panelIndex === index);
    });
  }
}

if (!customElements.get('category-tiles-component')) {
  customElements.define('category-tiles-component', CategoryTilesComponent);
}
