/**
 * Discount codes can't be validated from Liquid on the cart page — Shopify only
 * resolves them at checkout. Navigating to /discount/<code>?redirect=/cart stores
 * the code on the session so it applies at checkout, which is the supported path.
 */
class BricklineDiscountForm extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input');
    this.button = this.querySelector('button');

    this.button?.addEventListener('click', this.#apply);
    this.input?.addEventListener('keydown', this.#onKeydown);
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.#apply);
    this.input?.removeEventListener('keydown', this.#onKeydown);
  }

  #onKeydown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.#apply();
  };

  #apply = () => {
    const code = this.input?.value.trim();
    if (!code) return;

    const redirect = Theme?.routes?.cart_url || '/cart';
    window.location.href = `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(redirect)}`;
  };
}

if (!customElements.get('brickline-discount-form')) {
  customElements.define('brickline-discount-form', BricklineDiscountForm);
}
