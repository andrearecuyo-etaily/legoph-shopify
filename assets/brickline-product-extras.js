import { RecentlyViewed } from '@theme/recently-viewed-products';

/**
 * Swaps in Shopify's real recommendations once they're available.
 * The section renders a fallback collection server-side so the row is never
 * empty on first paint; this replaces it with the personalised set.
 */
async function loadRecommendations() {
  const containers = document.querySelectorAll('[data-recommendations-url]');

  for (const container of containers) {
    const url = container.dataset.recommendationsUrl;
    if (!url) continue;

    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const fresh = html.querySelector('.product-recs__items');
      const current = container.querySelector('.product-recs__items');

      if (fresh && current && fresh.children.length > 0) {
        current.replaceChildren(...fresh.children);
      }
    } catch {
      // Leave the server-rendered fallback in place.
    }
  }
}

/**
 * Renders the "Recently viewed" row from the ids Horizon already stores in
 * localStorage, using the search route's section rendering to fetch cards.
 */
async function loadRecentlyViewed() {
  const container = document.querySelector('[data-recently-viewed-section]');
  if (!container) return;

  const currentProductId = container.dataset.currentProductId;
  const ids = RecentlyViewed.getProducts().filter((id) => id !== currentProductId);
  if (ids.length === 0) return;

  const url = new URL(Theme.routes.search_url, location.origin);
  url.searchParams.set('q', ids.map((id) => `id:${id}`).join(' OR '));
  url.searchParams.set('resources[type]', 'product');
  url.searchParams.set('section_id', container.dataset.recentlyViewedSection);

  try {
    const response = await fetch(url);
    if (!response.ok) return;

    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    const fresh = html.querySelector('.recently-viewed__items');
    const target = container.querySelector('.recently-viewed__items');

    if (fresh && target && fresh.children.length > 0) {
      target.replaceChildren(...fresh.children);
      container.hidden = false;
    }
  } catch {
    // Row stays hidden.
  }
}

loadRecommendations();
loadRecentlyViewed();
