/**
 * Minimal right-side drawer used by the collection Filters and Sort panels.
 * Opened by any `[data-drawer-open="<id>"]` button, closed by the overlay, the
 * close button, or Escape. Focus is moved into the drawer and restored on close.
 */
class BricklineDrawer extends HTMLElement {
  connectedCallback() {
    this.overlay = this.querySelector('[data-drawer-overlay]');
    this.panel = this.querySelector('[data-drawer-panel]');

    this.addEventListener('click', this.#onClick);
    document.addEventListener('keydown', this.#onKeydown);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    document.removeEventListener('keydown', this.#onKeydown);
    this.#unlockScroll();
  }

  get isOpen() {
    return !this.hidden;
  }

  open(trigger) {
    this.#trigger = trigger || null;
    this.hidden = false;
    this.#lockScroll();

    // Let the drawer paint before moving focus, so the transition isn't skipped.
    requestAnimationFrame(() => {
      const focusable = this.panel?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    });

    trigger?.setAttribute('aria-expanded', 'true');
  }

  close() {
    if (!this.isOpen) return;
    this.hidden = true;
    this.#unlockScroll();
    this.#trigger?.setAttribute('aria-expanded', 'false');
    this.#trigger?.focus();
    this.#trigger = null;
  }

  #trigger = null;

  #onClick = (event) => {
    if (event.target.closest('[data-drawer-close]') || event.target.hasAttribute('data-drawer-overlay')) {
      event.preventDefault();
      this.close();
    }
  };

  #onKeydown = (event) => {
    if (event.key === 'Escape' && this.isOpen) this.close();
  };

  #lockScroll() {
    document.documentElement.style.overflow = 'hidden';
  }

  #unlockScroll() {
    document.documentElement.style.overflow = '';
  }
}

if (!customElements.get('brickline-drawer')) {
  customElements.define('brickline-drawer', BricklineDrawer);
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-drawer-open]');
  if (!trigger) return;

  const drawer = document.getElementById(trigger.dataset.drawerOpen);
  if (!(drawer instanceof BricklineDrawer)) return;

  event.preventDefault();
  drawer.open(trigger);
});

// "See more" reveals the rest of a long filter group.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter-more]');
  if (!button) return;

  event.preventDefault();
  const group = button.closest('[data-filter-group]');
  group?.classList.add('is-expanded');
  button.hidden = true;
});
