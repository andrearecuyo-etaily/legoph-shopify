import { fetchConfig } from '@theme/utilities';
import { CartLinesUpdateEvent, CartErrorEvent } from '@shopify/events';

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

class AddToCartPill extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    this.button?.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.#onClick);
  }

  #onClick = (event) => {
    event.preventDefault();
    if (this.button?.disabled) return;

    const variantId = this.dataset.variantId;
    if (!variantId) return;

    const formData = new FormData();
    formData.set('id', variantId);
    formData.set('quantity', '1');

    const deferredEventPromise = CartLinesUpdateEvent.createPromise();

    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action: 'add',
        context: 'product-rail',
        lines: [{ merchandiseId: variantId, quantity: 1 }],
        promise: deferredEventPromise.promise,
      })
    );

    if (this.button) {
      this.button.disabled = true;
      this.button.classList.add('is-loading');
    }

    fetch(Theme.routes.cart_add_url, fetchConfig('javascript', { body: formData }))
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          this.dispatchEvent(
            new CartErrorEvent({
              error: response.message || 'Add to cart failed',
              code: 'INVALID',
              detail: { description: response.description, errors: response.errors },
            })
          );
          deferredEventPromise.reject(new Error(response.message || 'Add to cart failed'));
          return;
        }

        fetch(`${Theme.routes.cart_url}.js`)
          .then((res) => res.json())
          .then((cart) => {
            deferredEventPromise.resolve({
              cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
              detail: { source: 'product-rail-add-to-cart', itemCount: 1 },
            });
          })
          .catch(deferredEventPromise.reject);

        this.classList.add('is-added');
        window.setTimeout(() => this.classList.remove('is-added'), 1800);
      })
      .catch((error) => {
        deferredEventPromise.reject(error);
      })
      .finally(() => {
        if (this.button) {
          this.button.disabled = false;
          this.button.classList.remove('is-loading');
        }
      });
  };
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-wishlist-toggle]');
  if (!button) return;
  const isActive = button.hasAttribute('data-active');
  button.toggleAttribute('data-active', !isActive);
  button.setAttribute('aria-pressed', String(!isActive));
});

if (!customElements.get('product-rail-component')) {
  customElements.define('product-rail-component', ProductRail);
}

if (!customElements.get('add-to-cart-pill')) {
  customElements.define('add-to-cart-pill', AddToCartPill);
}
