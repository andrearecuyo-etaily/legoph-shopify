import { Zap, describeError, NOT_CONFIGURED } from '@theme/brickline-zap';

/** Shows a status line, and disables the panel outright if there's no proxy yet. */
function message(root, text, tone = 'info') {
  const el = root.querySelector('[data-zap-message]');
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
  el.hidden = !text;
}

function busy(form, isBusy) {
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = isBusy;
  form.dataset.busy = String(isBusy);
}

/* ---------------------------------------------------------------- enrolment */

class ZapEnrol extends HTMLElement {
  connectedCallback() {
    this.enrolForm = this.querySelector('[data-zap-enrol-form]');
    this.otpForm = this.querySelector('[data-zap-otp-form]');

    this.enrolForm?.addEventListener('submit', this.#onEnrol);
    this.otpForm?.addEventListener('submit', this.#onVerify);
  }

  #reference = null;

  #onEnrol = async (event) => {
    event.preventDefault();
    const data = new FormData(this.enrolForm);
    const mobile = String(data.get('mobile') || '').trim();
    const pin = String(data.get('pin') || '').trim();

    if (!mobile || !pin) {
      message(this, 'Enter your mobile number and a PIN.', 'error');
      return;
    }

    busy(this.enrolForm, true);
    message(this, 'Sending your verification code…');

    const result = await Zap.enrol(mobile, pin);
    busy(this.enrolForm, false);

    if (!result.ok) {
      message(this, describeError(result.error), 'error');
      return;
    }

    this.#reference = result.reference;

    // ZAP may not require an OTP for every partner configuration.
    if (result.otp_required === false) {
      location.reload();
      return;
    }

    this.enrolForm.hidden = true;
    this.otpForm.hidden = false;
    this.otpForm.querySelector('input')?.focus();
    message(this, 'We sent a code to your mobile. Enter it to finish joining.');
  };

  #onVerify = async (event) => {
    event.preventDefault();
    const otp = String(new FormData(this.otpForm).get('otp') || '').trim();
    if (!otp) return;

    busy(this.otpForm, true);
    const result = await Zap.verifyEnrolment(this.#reference, otp);
    busy(this.otpForm, false);

    if (!result.ok) {
      message(this, describeError(result.error), 'error');
      return;
    }

    // The endpoint has written the metafields; reload so Liquid renders the
    // member state rather than reconstructing it here.
    message(this, 'You’re in. Loading your points…', 'success');
    location.reload();
  };
}

/* ---------------------------------------------------------------- dashboard */

class ZapDashboard extends HTMLElement {
  connectedCallback() {
    this.redeemForm = this.querySelector('[data-zap-redeem-form]');
    this.couponsRoot = this.querySelector('[data-zap-coupons]');

    this.redeemForm?.addEventListener('submit', this.#onRedeemPoints);
    this.couponsRoot?.addEventListener('click', this.#onRedeemCoupon);

    this.#loadBalance();
    if (this.couponsRoot) this.#loadCoupons();
  }

  async #loadBalance() {
    const result = await Zap.balance();

    if (!result.ok) {
      // A missing proxy isn't an error the shopper caused — say so plainly and
      // leave the placeholders rather than showing a fake zero.
      message(this, describeError(result.error), result.error === NOT_CONFIGURED ? 'info' : 'error');
      this.#disableActions();
      return;
    }

    this.#setText('[data-zap-valid]', Number(result.valid_points || 0).toLocaleString());
    this.#setText('[data-zap-pending]', Number(result.pending_points || 0).toLocaleString());

    const tier = this.querySelector('[data-zap-tier]');
    if (tier && result.tier) {
      tier.textContent = result.tier;
      tier.hidden = false;
    }

    this.#validPoints = Number(result.valid_points || 0);
  }

  async #loadCoupons() {
    const result = await Zap.coupons();

    if (!result.ok) {
      this.couponsRoot.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'account__empty';
      p.textContent = describeError(result.error);
      this.couponsRoot.appendChild(p);
      return;
    }

    const coupons = result.coupons || [];
    this.couponsRoot.replaceChildren();

    if (coupons.length === 0) {
      const p = document.createElement('p');
      p.className = 'account__empty';
      p.textContent = 'No coupons available right now.';
      this.couponsRoot.appendChild(p);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'rewards__coupons';

    for (const coupon of coupons) {
      const item = document.createElement('li');
      item.className = 'rewards__coupon';

      const body = document.createElement('div');
      const name = document.createElement('span');
      name.className = 'rewards__coupon-name';
      name.textContent = coupon.name || coupon.id;
      body.appendChild(name);

      if (coupon.valid_to) {
        const validity = document.createElement('span');
        validity.className = 'rewards__coupon-validity';
        validity.textContent = coupon.valid_from
          ? `Valid ${formatDate(coupon.valid_from)} – ${formatDate(coupon.valid_to)}`
          : `Valid until ${formatDate(coupon.valid_to)}`;
        body.appendChild(validity);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'account__button account__button--secondary';
      button.dataset.zapRedeemCoupon = coupon.id;
      button.textContent = 'Use coupon';

      item.append(body, button);
      list.appendChild(item);
    }

    this.couponsRoot.appendChild(list);
  }

  #validPoints = 0;

  #onRedeemPoints = async (event) => {
    event.preventDefault();
    const data = new FormData(this.redeemForm);
    const amount = Number(data.get('amount'));
    const otp = String(data.get('otp') || '').trim();

    if (!Number.isFinite(amount) || amount < 1) {
      message(this, 'Enter how many points you want to redeem.', 'error');
      return;
    }

    // A courtesy check only — the endpoint re-reads the real balance from ZAP
    // before honouring anything, because this value came from the browser.
    if (this.#validPoints && amount > this.#validPoints) {
      message(this, `You only have ${this.#validPoints.toLocaleString()} points available.`, 'error');
      return;
    }

    busy(this.redeemForm, true);
    const result = await Zap.redeemPoints(amount, otp);
    busy(this.redeemForm, false);

    if (!result.ok) {
      message(this, describeError(result.error), 'error');
      return;
    }

    message(
      this,
      result.discount_code
        ? `Redeemed. Use code ${result.discount_code} at checkout.`
        : 'Redeemed. Your points balance has been updated.',
      'success'
    );
    this.redeemForm.reset();
    this.#loadBalance();
  };

  #onRedeemCoupon = async (event) => {
    const button = event.target.closest('[data-zap-redeem-coupon]');
    if (!button) return;

    button.disabled = true;
    const result = await Zap.redeemCoupon(button.dataset.zapRedeemCoupon);
    button.disabled = false;

    if (!result.ok) {
      message(this, describeError(result.error), 'error');
      return;
    }

    message(
      this,
      result.discount_code
        ? `Coupon ready. Use code ${result.discount_code} at checkout.`
        : 'Coupon redeemed.',
      'success'
    );
    this.#loadCoupons();
  };

  #disableActions() {
    for (const control of this.querySelectorAll('form button[type="submit"], [data-zap-redeem-coupon]')) {
      control.disabled = true;
    }
  }

  #setText(selector, value) {
    const el = this.querySelector(selector);
    if (el) el.textContent = value;
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

if (!customElements.get('zap-enrol')) customElements.define('zap-enrol', ZapEnrol);
if (!customElements.get('zap-dashboard')) customElements.define('zap-dashboard', ZapDashboard);
