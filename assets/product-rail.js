import '@theme/brickline-cart-actions';

class ProductRail extends HTMLElement {
  connectedCallback() {
    this.tabs = Array.from(this.querySelectorAll('.product-rail__tab'));
    this.panels = Array.from(this.querySelectorAll('.product-rail__panel'));
    this.prevButton = this.querySelector('.product-rail__arrow--prev');
    this.nextButton = this.querySelector('.product-rail__arrow--next');

    this.tabs.forEach((tab, i) => tab.addEventListener('click', () => this.#showPanel(i)));
    this.prevButton?.addEventListener('click', () => this.#scrollByCard(-1));
    this.nextButton?.addEventListener('click', () => this.#scrollByCard(1));

    this.panels.forEach((panel) => {
      const track = panel.querySelector('.product-rail__track');
      track?.addEventListener('scroll', () => this.#updateProgress(panel), { passive: true });
      this.#updateProgress(panel);
    });
  }

  get #activePanel() {
    return this.querySelector('.product-rail__panel.is-active');
  }

  #showPanel(index) {
    this.tabs.forEach((tab, i) => tab.classList.toggle('is-active', i === index));
    this.panels.forEach((panel, i) => {
      const isActive = i === index;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
  }

  #scrollByCard(direction) {
    const track = this.#activePanel?.querySelector('.product-rail__track');
    if (!track) return;
    const card = track.querySelector('.product-rail-card');
    const cardWidth = card ? card.getBoundingClientRect().width + 18 : track.clientWidth * 0.8;
    track.scrollBy({ left: cardWidth * direction, behavior: 'smooth' });
  }

  #updateProgress(panel) {
    const track = panel.querySelector('.product-rail__track');
    const bar = panel.querySelector('.product-rail__progress-bar');
    if (!track || !bar) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const ratio = maxScroll > 0 ? track.scrollLeft / maxScroll : 0;
    const visibleShare = track.clientWidth / track.scrollWidth;
    const width = Math.min(100, Math.max(visibleShare * 100, ratio * (100 - visibleShare * 100) + visibleShare * 100));
    bar.style.width = `${width}%`;
  }
}

if (!customElements.get('product-rail-component')) {
  customElements.define('product-rail-component', ProductRail);
}
