/**
 * Filters the store list in the browser. Every store is already rendered by
 * Liquid, so this is a pure show/hide over `data-store-haystack` — no geocoding
 * or API involved, which is what the design's "distance" control would imply.
 */
class StoreLocator extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('[data-store-search]');
    this.stores = Array.from(this.querySelectorAll('[data-store]'));
    this.empty = this.querySelector('[data-store-empty]');

    this.input?.addEventListener('input', this.#onInput);
  }

  disconnectedCallback() {
    this.input?.removeEventListener('input', this.#onInput);
  }

  #onInput = () => {
    const query = this.input.value.trim().toLowerCase();
    let visible = 0;

    for (const store of this.stores) {
      const match = !query || (store.dataset.storeHaystack || '').includes(query);
      store.hidden = !match;
      if (match) visible++;
    }

    if (this.empty) this.empty.hidden = visible > 0;
  };
}

if (!customElements.get('store-locator')) {
  customElements.define('store-locator', StoreLocator);
}
