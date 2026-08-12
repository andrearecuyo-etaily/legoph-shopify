import { WishlistStore } from '@theme/brickline-wishlist';

/**
 * Fills the wishlist page from the ids in localStorage.
 *
 * Ids are turned back into rendered product cards by asking the search route to
 * render this same section (`/search?q=id:1 OR id:2&section_id=…`), which is the
 * pattern Horizon already uses for recently-viewed products. It keeps price,
 * availability and card markup server-rendered, so nothing has to be duplicated
 * in JS.
 */
const page = document.querySelector('[data-wishlist-page]');

if (page) {
  const grid = page.querySelector('[data-wishlist-grid]');
  const empty = page.querySelector('[data-wishlist-empty]');
  const error = page.querySelector('[data-wishlist-error]');
  const summary = page.querySelector('[data-wishlist-summary]');
  const sectionId = page.dataset.wishlistPage;

  const render = async () => {
    const ids = WishlistStore.get();

    error.hidden = true;

    if (ids.length === 0) {
      grid.hidden = true;
      grid.replaceChildren();
      empty.hidden = false;
      summary.hidden = true;
      return;
    }

    // We know the list isn't empty, so commit to that before the fetch lands.
    empty.hidden = true;

    const url = new URL(Theme.routes.search_url, location.origin);
    url.searchParams.set('q', ids.map((id) => `id:${id}`).join(' OR '));
    url.searchParams.set('resources[type]', 'product');
    url.searchParams.set('section_id', sectionId);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Search responded ${response.status}`);

      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const fresh = html.querySelector('.wishlist__items');
      const cards = fresh ? Array.from(fresh.children) : [];

      if (cards.length === 0) {
        // Every saved product has since been deleted or unpublished.
        grid.hidden = true;
        grid.replaceChildren();
        empty.hidden = false;
        summary.hidden = true;
        return;
      }

      // Search returns matches in relevance order, not the order they were
      // saved. Re-sort to match the stored list so the newest addition leads.
      const order = new Map(ids.map((id, index) => [id, index]));
      cards.sort((a, b) => {
        const aId = a.querySelector('[data-wishlist-remove]')?.dataset.wishlistRemove;
        const bId = b.querySelector('[data-wishlist-remove]')?.dataset.wishlistRemove;
        return (order.get(aId) ?? Infinity) - (order.get(bId) ?? Infinity);
      });

      grid.replaceChildren(...cards);
      grid.hidden = false;
      empty.hidden = true;
      summary.hidden = false;
      summary.textContent = `${cards.length} ${cards.length === 1 ? 'set' : 'sets'} saved`;
    } catch {
      // Leave whatever is already on screen and say so, rather than silently
      // showing the empty state as if the list had been lost.
      error.hidden = false;
    }
  };

  render();

  // Removing a card re-renders from the store, which also refreshes the count.
  document.addEventListener('brickline:wishlist:change', render);
}
