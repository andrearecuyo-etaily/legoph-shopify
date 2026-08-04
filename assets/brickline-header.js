class BricklineHeaderComponent extends HTMLElement {
  connectedCallback() {
    this.toggle = this.querySelector('.brickline-header__menu-toggle');
    this.panel = this.querySelector('.brickline-header__mobile-menu');

    if (this.toggle && this.panel) {
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

    this.navItems = Array.from(this.querySelectorAll('.brickline-header__nav-item'));
    this.navItems.forEach((item) => {
      const button = item.querySelector('.brickline-header__nav-link--has-submenu');
      if (!button) return;
      button.addEventListener('click', () => this.toggleSubmenu(item));
    });

    if (this.navItems.length) {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') this.closeAllSubmenus();
      });
      document.addEventListener('click', (event) => {
        if (this.contains(event.target)) return;
        this.closeAllSubmenus();
      });
    }

    this.mobileItems = Array.from(this.querySelectorAll('.brickline-header__mobile-item'));
    this.mobileItems.forEach((item) => {
      const button = item.querySelector('.brickline-header__mobile-link--has-submenu');
      const submenu = item.querySelector('.brickline-header__mobile-submenu');
      if (!button || !submenu) return;
      button.addEventListener('click', () => this.toggleMobileSubmenu(item, button, submenu));
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
    this.closeAllSubmenus();
  }

  toggleSubmenu(item) {
    const isOpen = item.classList.contains('is-open');
    this.closeAllSubmenus();
    if (!isOpen) this.openSubmenu(item);
  }

  openSubmenu(item) {
    item.classList.add('is-open');
    const button = item.querySelector('.brickline-header__nav-link--has-submenu');
    if (button) button.setAttribute('aria-expanded', 'true');
  }

  closeAllSubmenus() {
    this.navItems.forEach((item) => {
      item.classList.remove('is-open');
      const button = item.querySelector('.brickline-header__nav-link--has-submenu');
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  }

  toggleMobileSubmenu(item, button, submenu) {
    const isOpen = item.classList.contains('is-open');
    if (isOpen) {
      item.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      submenu.hidden = true;
    } else {
      item.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      submenu.hidden = false;
    }
  }
}

if (!customElements.get('brickline-header-component')) {
  customElements.define('brickline-header-component', BricklineHeaderComponent);
}
