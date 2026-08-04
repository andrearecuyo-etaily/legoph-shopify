class CategoryTilesComponent extends HTMLElement {
  connectedCallback() {
    this.tabs = this.querySelectorAll('.category-tiles__tab[data-tab-index]');
    this.panels = this.querySelectorAll('.category-tiles__grid[data-panel-index]');
    this.progressBar = this.querySelector('.category-tiles__progress-bar');

    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => this.setActive(tab.dataset.tabIndex));
    });

    this.querySelectorAll('.category-tiles__grid').forEach((track) => {
      track.addEventListener('scroll', () => this.#updateProgress(track), { passive: true });
    });

    this.#updateProgress(this.querySelector('.category-tiles__grid.is-active') || this.querySelector('.category-tiles__grid'));
  }

  setActive(index) {
    this.tabs.forEach((tab) => {
      const active = tab.dataset.tabIndex === index;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    let activePanel;
    this.panels.forEach((panel) => {
      const isActive = panel.dataset.panelIndex === index;
      panel.classList.toggle('is-active', isActive);
      if (isActive) activePanel = panel;
    });
    this.#updateProgress(activePanel);
  }

  #updateProgress(track) {
    if (!track || !this.progressBar) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const ratio = maxScroll > 0 ? track.scrollLeft / maxScroll : 0;
    const visibleShare = track.clientWidth / track.scrollWidth;
    const width = Math.min(100, Math.max(visibleShare * 100, ratio * (100 - visibleShare * 100) + visibleShare * 100));
    this.progressBar.style.width = `${width}%`;
  }
}

if (!customElements.get('category-tiles-component')) {
  customElements.define('category-tiles-component', CategoryTilesComponent);
}
