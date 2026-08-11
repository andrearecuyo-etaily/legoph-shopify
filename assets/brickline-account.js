/**
 * Log In / Register / Forgot password tabs on the customer login card.
 *
 * Panels are rendered server-side and only shown or hidden here, so a customer
 * with JS disabled still sees the login form (the default panel) and can submit
 * it — the register and recover forms remain reachable at /account/register and
 * via the emailed reset link.
 */
class CustomerAuth extends HTMLElement {
  connectedCallback() {
    this.tabs = Array.from(this.querySelectorAll('[data-auth-tab]'));
    this.panels = Array.from(this.querySelectorAll('[data-auth-panel]'));

    this.addEventListener('click', this.#onClick);

    // Shopify redirects back with ?recover=true or #recover after a reset request.
    const wantsRecover =
      location.hash === '#recover' || new URLSearchParams(location.search).has('recover');

    this.#show(wantsRecover ? 'recover' : this.dataset.startTab || 'login');
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
  }

  #onClick = (event) => {
    const tab = event.target.closest('[data-auth-tab]');
    if (!tab) return;

    event.preventDefault();
    this.#show(tab.dataset.authTab);
  };

  #show(name) {
    for (const panel of this.panels) {
      panel.classList.toggle('is-active', panel.dataset.authPanel === name);
    }

    // "Forgot password" is a link inside the login panel, not one of the two
    // top-level tabs, so it leaves Log In visually selected.
    const selected = name === 'recover' ? 'login' : name;
    for (const tab of this.tabs) {
      if (!tab.classList.contains('customer-auth__tab')) continue;
      tab.classList.toggle('is-active', tab.dataset.authTab === selected);
      tab.setAttribute('aria-selected', String(tab.dataset.authTab === selected));
    }
  }
}

if (!customElements.get('customer-auth')) {
  customElements.define('customer-auth', CustomerAuth);
}

/**
 * Province select + address delete on the addresses page.
 *
 * `country_option_tags` renders each country's provinces onto the <option> as a
 * data-provinces JSON array, so the dependent select can be filled without a
 * request. Deleting posts the hidden _method=delete form Shopify expects.
 */
function syncProvinces(countrySelect) {
  const target = document.getElementById(countrySelect.dataset.provinceTarget);
  if (!target) return;

  const option = countrySelect.selectedOptions[0];
  let provinces = [];
  try {
    provinces = JSON.parse(option?.dataset.provinces || '[]');
  } catch {
    provinces = [];
  }

  const wanted = target.dataset.default || '';
  target.innerHTML = '';

  // Countries with no subdivisions (Singapore, for one) hide the field entirely.
  const field = target.closest('.account__form-field');
  if (provinces.length === 0) {
    if (field) field.hidden = true;
    return;
  }
  if (field) field.hidden = false;

  for (const [value, label] of provinces) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === wanted) opt.selected = true;
    target.appendChild(opt);
  }
}

for (const select of document.querySelectorAll('[data-address-country]')) {
  if (select.dataset.default) select.value = select.dataset.default;
  syncProvinces(select);
  select.addEventListener('change', () => syncProvinces(select));
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-address-delete]');
  if (!button) return;

  event.preventDefault();
  if (!confirm('Delete this address?')) return;

  const form = document.createElement('form');
  form.method = 'post';
  form.action = button.dataset.addressUrl;
  form.innerHTML = '<input type="hidden" name="_method" value="delete">';
  document.body.appendChild(form);
  form.submit();
});
