function markLoaded(img) {
  img.classList.add('is-loaded');
}

function observe(img) {
  if (img.complete) {
    markLoaded(img);
    return;
  }
  img.addEventListener('load', () => markLoaded(img), { once: true });
}

const LAZY_IMAGE_SELECTOR =
  '.category-tiles__image, .product-rail-card__image, .feature-grid__image, .hero-slider__image';

document.querySelectorAll(LAZY_IMAGE_SELECTOR).forEach(observe);

if ('MutationObserver' in window) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        node.querySelectorAll?.(LAZY_IMAGE_SELECTOR).forEach(observe);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
