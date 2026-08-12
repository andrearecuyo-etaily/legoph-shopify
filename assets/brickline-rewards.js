import { Zap, describeError, NOT_CONFIGURED, OTP_REQUIRED } from '@theme/brickline-zap';

function message(root, text, tone = 'info') {
  const el = root.querySelector('[data-zap-message]');
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
  el.hidden = !text;
}

function busy(form, isBusy) {
  const button = form?.querySelector('button[type="submit"]');
  if (button) button.disabled = isBusy;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** ZAP returns fractional points (5000.20); trim the decimal when it's whole. */
function formatPoints(value) {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
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
    message(this, 'Registering you with the rewards programme…');

    // The endpoint adds branchId and any registration fields the Merchant
    // Dashboard marks required; ZAP answers 400-14 if something is missing.
    const result = await Zap.enrol({ mobile, pin });
    busy(this.enrolForm, false);

    if (result.ok) {
      message(this, 'You’re in. Loading your points…', 'success');
      location.reload();
      return;
    }

    if (result.error === OTP_REQUIRED) {
      this.#reference = result.reference;
      this.enrolForm.hidden = true;
      this.otpForm.hidden = false;
      this.otpForm.querySelector('input')?.focus();
      message(this, 'We sent a code to your mobile. Enter it to finish joining.');
      return;
    }

    message(this, describeError(result.error), 'error');
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
    this.currencies = this.querySelector('[data-zap-currencies]');
    this.tier = this.querySelector('[data-zap-tier]');
    this.balanceOtpForm = this.querySelector('[data-zap-balance-otp]');
    this.redeemForm = this.querySelector('[data-zap-redeem-form]');
    this.redeemOtpField = this.querySelector('[data-zap-redeem-otp]');
    this.couponsRoot = this.querySelector('[data-zap-coupons]');
    this.transactionsRoot = this.querySelector('[data-zap-transactions]');
    this.moreButton = this.querySelector('[data-zap-more]');

    this.balanceOtpForm?.addEventListener('submit', this.#onBalanceOtp);
    this.redeemForm?.addEventListener('submit', this.#onRedeemPoints);
    this.couponsRoot?.addEventListener('click', this.#onRedeemCoupon);
    this.moreButton?.addEventListener('click', () => this.#loadTransactions(this.#marker));

    this.#loadBalance();
    this.#loadTier();
    if (this.couponsRoot) this.#loadCoupons();
    if (this.transactionsRoot) this.#loadTransactions();
  }

  #validPoints = 0;
  #marker = null;
  #redeemReference = null;

  async #loadBalance(auth) {
    const result = await Zap.balance(auth);

    if (result.error === OTP_REQUIRED) {
      // ZAP's auth mode for this merchant wants a code before showing a balance.
      this.#balanceReference = result.reference;
      if (this.balanceOtpForm) this.balanceOtpForm.hidden = false;
      message(this, 'Enter the code we sent you to see your points.');
      return;
    }

    if (!result.ok) {
      // A missing proxy isn't the shopper's fault — say so and leave the
      // placeholders rather than rendering a fake zero.
      message(this, describeError(result.error), result.error === NOT_CONFIGURED ? 'info' : 'error');
      this.#disableActions();
      return;
    }

    if (this.balanceOtpForm) this.balanceOtpForm.hidden = true;
    message(this, '');

    const currencies = (result.currencies || []).slice().sort((a, b) => (b.priority || 0) - (a.priority || 0));
    if (currencies.length === 0) return;

    this.#validPoints = Number(currencies[0].validPoints || 0);
    this.currencies.replaceChildren();

    currencies.forEach((currency, index) => {
      const wrap = el('div', index === 0 ? 'rewards__points' : 'rewards__points rewards__points--muted');
      wrap.appendChild(el('span', 'rewards__points-value', formatPoints(currency.validPoints)));
      wrap.appendChild(el('span', 'rewards__points-label', currency.name || 'Points'));

      if (Number(currency.pendingPoints) > 0) {
        wrap.appendChild(
          el('span', 'rewards__points-pending', `${formatPoints(currency.pendingPoints)} pending`)
        );
      }
      this.currencies.appendChild(wrap);
    });
  }

  #balanceReference = null;

  #onBalanceOtp = async (event) => {
    event.preventDefault();
    const otp = String(new FormData(this.balanceOtpForm).get('otp') || '').trim();
    if (!otp) return;

    busy(this.balanceOtpForm, true);
    await this.#loadBalance({ otp, reference: this.#balanceReference });
    busy(this.balanceOtpForm, false);
  };

  async #loadTier() {
    const result = await Zap.membership();
    if (!result.ok || !result.rank?.name || !this.tier) return;
    this.tier.textContent = result.rank.name;
    this.tier.hidden = false;
  }

  async #loadCoupons() {
    const result = await Zap.coupons();

    if (!result.ok) {
      this.couponsRoot.replaceChildren(el('p', 'account__empty', describeError(result.error)));
      return;
    }

    const coupons = result.coupons || [];
    if (coupons.length === 0) {
      this.couponsRoot.replaceChildren(el('p', 'account__empty', 'No coupons available right now.'));
      return;
    }

    const list = el('ul', 'rewards__coupons');

    for (const coupon of coupons) {
      const item = el('li', 'rewards__coupon');
      const body = el('div');

      body.appendChild(el('span', 'rewards__coupon-name', coupon.promotion?.name || `Coupon ${coupon.id}`));
      if (coupon.promotion?.description) {
        body.appendChild(el('span', 'rewards__coupon-validity', coupon.promotion.description));
      }
      if (coupon.validityEndDate) {
        body.appendChild(
          el(
            'span',
            'rewards__coupon-validity',
            coupon.validityStartDate
              ? `Valid ${formatDate(coupon.validityStartDate)} – ${formatDate(coupon.validityEndDate)}`
              : `Valid until ${formatDate(coupon.validityEndDate)}`
          )
        );
      }
      item.appendChild(body);

      // Only Available + active coupons can be redeemed; Used and Expired are
      // shown so the shopper can see their history, but not offered.
      if (coupon.status === 'Available' && coupon.isActive) {
        const button = el('button', 'account__button account__button--secondary', 'Use coupon');
        button.type = 'button';
        button.dataset.zapRedeemCoupon = coupon.id;
        item.appendChild(button);
      } else {
        item.appendChild(el('span', 'rewards__coupon-status', coupon.status || 'Unavailable'));
      }

      list.appendChild(item);
    }

    this.couponsRoot.replaceChildren(list);
  }

  async #loadTransactions(marker) {
    const result = await Zap.transactions(marker);

    if (!result.ok) {
      if (!marker) {
        this.transactionsRoot.replaceChildren(el('p', 'account__empty', describeError(result.error)));
      }
      if (this.moreButton) this.moreButton.hidden = true;
      return;
    }

    const transactions = result.transactions || [];
    if (!marker && transactions.length === 0) {
      this.transactionsRoot.replaceChildren(el('p', 'account__empty', 'No activity yet.'));
      if (this.moreButton) this.moreButton.hidden = true;
      return;
    }

    const list = marker ? this.transactionsRoot.querySelector('.rewards__activity') : el('ul', 'rewards__activity');
    if (!marker) this.transactionsRoot.replaceChildren(list);

    for (const tx of transactions) {
      const item = el('li', 'rewards__activity-row');
      const body = el('div');

      const earned = (tx.points || []).reduce((sum, p) => sum + Number(p.earned || 0), 0);
      const redeemed = (tx.points || []).reduce((sum, p) => sum + Number(p.redeemed || 0), 0);
      const currency = tx.points?.[0]?.currency || 'points';

      let label = 'Transaction';
      if (earned > 0) label = `Earned ${formatPoints(earned)} ${currency}`;
      else if (redeemed > 0) label = `Redeemed ${formatPoints(redeemed)} ${currency}`;
      else if ((tx.coupons || []).length) label = tx.coupons[0].earned ? 'Coupon earned' : 'Coupon used';

      body.appendChild(el('span', 'rewards__activity-label', label));
      body.appendChild(
        el(
          'span',
          'rewards__activity-meta',
          [formatDate(tx.dateProcessed), tx.branchName || tx.merchantName, tx.refNo].filter(Boolean).join(' · ')
        )
      );
      item.appendChild(body);

      // Pending points haven't cleared in ZAP yet, so flag them.
      if (tx.status && tx.status !== 'Cleared') {
        item.appendChild(el('span', 'rewards__activity-status', tx.status));
      }
      list.appendChild(item);
    }

    this.#marker = result.marker || null;
    if (this.moreButton) this.moreButton.hidden = !this.#marker || transactions.length === 0;
  }

  #onRedeemPoints = async (event) => {
    event.preventDefault();
    const data = new FormData(this.redeemForm);
    const amount = Number(data.get('amount'));
    const otp = String(data.get('otp') || '').trim();

    if (!Number.isFinite(amount) || amount < 1) {
      message(this, 'Enter how many points you want to redeem.', 'error');
      return;
    }

    // Courtesy check only — the endpoint re-reads the real balance from ZAP
    // before honouring anything, because this figure came from the browser.
    if (this.#validPoints && amount > this.#validPoints) {
      message(this, `You only have ${formatPoints(this.#validPoints)} points available.`, 'error');
      return;
    }

    busy(this.redeemForm, true);
    const result = await Zap.redeemPoints(amount, { otp, reference: this.#redeemReference });
    busy(this.redeemForm, false);

    if (result.error === OTP_REQUIRED) {
      this.#redeemReference = result.reference;
      if (this.redeemOtpField) this.redeemOtpField.hidden = false;
      this.redeemOtpField?.querySelector('input')?.focus();
      message(this, 'We sent a code to your mobile. Enter it to confirm this redemption.');
      return;
    }

    if (!result.ok) {
      message(this, describeError(result.error), 'error');
      return;
    }

    message(this, `Redeemed. Reference ${result.transaction_ref}.`, 'success');
    this.redeemForm.reset();
    this.#redeemReference = null;
    if (this.redeemOtpField) this.redeemOtpField.hidden = true;
    this.#loadBalance();
    if (this.transactionsRoot) this.#loadTransactions();
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

    message(this, `Coupon redeemed. Reference ${result.transaction_ref}.`, 'success');
    this.#loadCoupons();
    if (this.transactionsRoot) this.#loadTransactions();
  };

  #disableActions() {
    for (const control of this.querySelectorAll('button')) control.disabled = true;
  }
}

if (!customElements.get('zap-enrol')) customElements.define('zap-enrol', ZapEnrol);
if (!customElements.get('zap-dashboard')) customElements.define('zap-dashboard', ZapDashboard);
