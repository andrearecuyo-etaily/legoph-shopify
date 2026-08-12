/**
 * Brickline wishlist — localStorage backed.
 *
 * Everything that reads or writes the list goes through WishlistStore, so the
 * storage backend is the only thing that would change if this later needs to
 * follow a shopper across devices. That upgrade means a customer metafield
 * written through an App Proxy: this store is on *classic* customer accounts,
 * so there is no Customer Account API and the Storefront API cannot write
 * customer metafields — it needs a hosted endpoint with an Admin API token,
 * which can't live in theme JS. Swapping this module (and awaiting its methods)
 * is the whole job on the theme side.
 *
 * State lives under one key as an array of product ids. Every mutation fires
 * `brickline:wishlist:change` on `document` so the header badge, the product
 * cards and the wishlist page all stay in sync without knowing about each other.
 */

const STORAGE_KEY = 'brickline_wishlist';
const CHANGE_EVENT = 'brickline:wishlist:change';

export const WishlistStore = {
  /** @returns {string[]} product ids, newest first */
  get() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch {
      // Corrupt or unavailable storage (private mode, quota) — treat as empty
      // rather than breaking every card on the page.
      return [];
    }
  },

  has(id) {
    return this.get().includes(String(id));
  },

  count() {
    return this.get().length;
  },

  add(id) {
    const next = [String(id), ...this.get().filter((item) => item !== String(id))];
    this.#write(next);
    return next;
  },

  remove(id) {
    this.#write(this.get().filter((item) => item !== String(id)));
  },

  /** @returns {boolean} whether the item is on the list afterwards */
  toggle(id) {
    const isSaved = this.has(id);
    if (isSaved) {
      this.remove(id);
    } else {
      this.add(id);
    }
    return !isSaved;
  },

  #write(ids) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Out of quota or storage disabled. The in-page state below still
      // reflects the change; it just won't survive a reload.
    }
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { ids } }));
  },
};

/** Paints every heart on the page to match stored state. */
function syncToggles() {
  const saved = new Set(WishlistStore.get());

  for (const button of document.querySelectorAll('[data-wishlist-toggle]')) {
    const id = button.dataset.wishlistToggle;
    if (!id) continue;

    const isSaved = saved.has(id);
    button.toggleAttribute('data-active', isSaved);
    button.setAttribute('aria-pressed', String(isSaved));
    button.setAttribute('aria-label', isSaved ? 'Remove from wishlist' : 'Add to wishlist');
  }
}

/** Updates the header badge; hidden entirely at zero. */
function syncCount() {
  const count = WishlistStore.count();

  for (const badge of document.querySelectorAll('[data-wishlist-count]')) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-wishlist-toggle]');
  if (!button) return;

  const id = button.dataset.wishlistToggle;
  if (!id) return;

  event.preventDefault();
  WishlistStore.toggle(id);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-wishlist-remove]');
  if (!button) return;

  event.preventDefault();
  WishlistStore.remove(button.dataset.wishlistRemove);
});

document.addEventListener(CHANGE_EVENT, () => {
  syncToggles();
  syncCount();
});

// Another tab changed the list.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  syncToggles();
  syncCount();
});

syncToggles();
syncCount();
