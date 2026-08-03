class PromoBannerComponent extends HTMLElement {
  connectedCallback() {
    this.pills = this.querySelectorAll('.promo-banner__pill[data-pill-index]');
    this.panels = this.querySelectorAll('.promo-banner__content[data-content-index]');

    this.pills.forEach((pill) => {
      pill.addEventListener('click', () => this.setActive(pill.dataset.pillIndex));
    });
  }

  setActive(index) {
    this.pills.forEach((pill) => {
      const active = pill.dataset.pillIndex === index;
      pill.classList.toggle('is-active', active);
      pill.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    this.panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.contentIndex === index);
    });
  }
}

if (!customElements.get('promo-banner-component')) {
  customElements.define('promo-banner-component', PromoBannerComponent);
}
