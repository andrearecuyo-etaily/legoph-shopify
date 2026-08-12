import { fetchConfig } from '@theme/utilities';
import { CartLinesUpdateEvent, CartErrorEvent } from '@shopify/events';

/**
 * Single-variant "Add to Bag" pill used by the Brickline product cards
 * (product rail, collection grid, cart upsells). Adds one unit of
 * `data-variant-id` over AJAX and flashes an "Added" state.
 */
export class AddToCartPill extends HTMLElement {
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
        context: this.dataset.context || 'product-card',
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
              detail: { source: 'brickline-add-to-cart', itemCount: 1 },
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

if (!customElements.get('add-to-cart-pill')) {
  customElements.define('add-to-cart-pill', AddToCartPill);
}
