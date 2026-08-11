/**
 * Thumbnail rail + main stage for the Brickline product page.
 * Thumbnails swap which stage image carries `.is-active`; no fetching involved,
 * every image is already in the DOM.
 */
class BricklineGallery extends HTMLElement {
  connectedCallback() {
    this.thumbs = Array.from(this.querySelectorAll('.product-main__thumb'));
    this.stageImages = Array.from(this.querySelectorAll('.product-main__stage-image'));

    this.thumbs.forEach((thumb) => thumb.addEventListener('click', this.#onThumbClick));
  }

  disconnectedCallback() {
    this.thumbs?.forEach((thumb) => thumb.removeEventListener('click', this.#onThumbClick));
  }

  #onThumbClick = (event) => {
    const index = event.currentTarget.dataset.mediaIndex;
    if (index == null) return;

    this.thumbs.forEach((thumb) => thumb.classList.toggle('is-active', thumb.dataset.mediaIndex === index));
    this.stageImages.forEach((image) => image.classList.toggle('is-active', image.dataset.mediaIndex === index));
  };
}

if (!customElements.get('brickline-gallery')) {
  customElements.define('brickline-gallery', BricklineGallery);
}

// Plus / minus stepper next to the add-to-cart button.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-quantity-step]');
  if (!button) return;

  const input = button.parentElement?.querySelector('.product-main__quantity-input');
  if (!input) return;

  const step = Number(button.dataset.quantityStep) || 0;
  const min = Number(input.min) || 1;
  const max = input.max ? Number(input.max) : Infinity;
  const next = Math.min(max, Math.max(min, (Number(input.value) || min) + step));

  input.value = String(next);
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
