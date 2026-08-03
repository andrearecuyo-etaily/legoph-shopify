class BricklineHeaderComponent extends HTMLElement {
  connectedCallback() {
    this.toggle = this.querySelector('.brickline-header__menu-toggle');
    this.panel = this.querySelector('.brickline-header__mobile-menu');
    if (!this.toggle || !this.panel) return;

    this.toggle.addEventListener('click', () => this.toggleMenu());
    this.panel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => this.closeMenu());
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (this.toggle.getAttribute('aria-expanded') !== 'true') return;
      if (this.contains(event.target)) return;
      this.closeMenu();
    });
  }

  toggleMenu() {
    const isOpen = this.toggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) this.closeMenu();
    else this.openMenu();
  }

  openMenu() {
    this.toggle.setAttribute('aria-expanded', 'true');
    this.panel.hidden = false;
  }

  closeMenu() {
    this.toggle.setAttribute('aria-expanded', 'false');
    this.panel.hidden = true;
  }
}

if (!customElements.get('brickline-header-component')) {
  customElements.define('brickline-header-component', BricklineHeaderComponent);
}
