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

document.querySelectorAll('.category-tiles__image, .product-rail-card__image').forEach(observe);

if ('MutationObserver' in window) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        node.querySelectorAll?.('.category-tiles__image, .product-rail-card__image').forEach(observe);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
