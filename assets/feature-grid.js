class FeatureGridComponent extends HTMLElement {
  connectedCallback() {
    this.hotspots = Array.from(this.querySelectorAll('.feature-grid__hotspot--interactive'));
    this.hotspots.forEach((hotspot) => {
      const button = hotspot.querySelector('.feature-grid__overlay-icon');
      if (!button) return;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        this.toggleHotspot(hotspot);
      });
    });

    if (this.hotspots.length) {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') this.closeAllHotspots();
      });
      document.addEventListener('click', (event) => {
        if (this.contains(event.target)) return;
        this.closeAllHotspots();
      });
    }
  }

  toggleHotspot(hotspot) {
    const isOpen = hotspot.classList.contains('is-open');
    this.closeAllHotspots();
    if (!isOpen) this.openHotspot(hotspot);
  }

  openHotspot(hotspot) {
    hotspot.classList.add('is-open');
    const button = hotspot.querySelector('.feature-grid__overlay-icon');
    if (button) button.setAttribute('aria-expanded', 'true');
  }

  closeAllHotspots() {
    this.hotspots.forEach((hotspot) => {
      hotspot.classList.remove('is-open');
      const button = hotspot.querySelector('.feature-grid__overlay-icon');
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  }
}

if (!customElements.get('feature-grid-component')) {
  customElements.define('feature-grid-component', FeatureGridComponent);
}
