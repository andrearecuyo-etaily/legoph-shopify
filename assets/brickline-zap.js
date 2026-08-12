/**
 * ZAP loyalty client — ZAP Partner API v0-1, reached through a Shopify App Proxy.
 *
 * The theme never calls partner.zap.com.ph directly: the Bearer access token
 * would be readable in page source, and Earn Points needs only a mobile number
 * and an amount. See docs/zap-app-proxy-contract.md for the endpoint mapping.
 *
 * Two rules this module exists to enforce:
 *
 * 1. No mobile number leaves the browser except at enrolment. Shopify signs each
 *    proxy request with logged_in_customer_id and the endpoint resolves the
 *    linked number from that; otherwise anyone could read a stranger's balance.
 * 2. Nothing here is trusted for value. Redemptions are re-validated server-side
 *    against a fresh ZAP balance — this module only drives the UI.
 *
 * ZAP's merchant config decides whether a PIN and/or OTP is required
 * (partnerGetBalanceByMobileAuthMode, partnerRedeemPointsByMobileAuthMode). The
 * theme doesn't track which: the endpoint answers `otp_required` with a
 * reference, and the caller retries the same request with the code.
 */

const PROXY_ROOT = '/apps/zap';

/** No App Proxy deployed yet — distinct from a genuine API failure. */
export const NOT_CONFIGURED = 'not_configured';
/** ZAP wants an OTP for this call; retry with { otp, reference }. */
export const OTP_REQUIRED = 'otp_required';

async function call(path, { method = 'GET', body } = {}) {
  let response;

  try {
    response = await fetch(`${PROXY_ROOT}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, error: 'network' };
  }

  // Without the proxy installed the storefront serves its own 404 HTML, so a
  // non-JSON body means "not wired up yet" rather than a real error.
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    return { ok: false, error: NOT_CONFIGURED };
  }

  try {
    const data = await response.json();
    return typeof data.ok === 'boolean' ? data : { ...data, ok: response.ok };
  } catch {
    return { ok: false, error: NOT_CONFIGURED };
  }
}

export const Zap = {
  /** POST /v0-1/register — the one call that carries a mobile number. */
  enrol(fields) {
    return call('/enrol', { method: 'POST', body: fields });
  },

  /** POST /v0-1/otp/verify */
  verifyEnrolment(reference, otp) {
    return call('/enrol/verify', { method: 'POST', body: { reference, otp } });
  },

  /** POST /v0-1/user/balance/inquiry — returns an array of currencies. */
  balance({ otp, reference } = {}) {
    const query = otp ? `?otp=${encodeURIComponent(otp)}&reference=${encodeURIComponent(reference)}` : '';
    return call(`/balance${query}`);
  },

  /** POST /v0-1/membership — supplies rank.name as the tier. */
  membership() {
    return call('/membership');
  },

  /** POST /v0-1/user/coupon/inquiry */
  coupons() {
    return call('/coupons');
  },

  /** POST /v0-1/user/transactions — 10 per page; pass the previous marker. */
  transactions(marker) {
    return call(`/transactions${marker ? `?marker=${encodeURIComponent(marker)}` : ''}`);
  },

  /** POST /v0-1/transaction/redeem — amount is a number of points. */
  redeemPoints(amount, { otp, reference } = {}) {
    return call('/points/redeem', { method: 'POST', body: { amount, otp, reference } });
  },

  /** POST /v0-1/transaction/redeem/coupon */
  redeemCoupon(couponId, { otp, reference } = {}) {
    return call('/coupons/redeem', { method: 'POST', body: { coupon_id: couponId, otp, reference } });
  },
};

/**
 * Copy for ZAP's error codes, passed through verbatim by the proxy.
 * Anything unmapped falls back to a generic line rather than leaking a raw code.
 */
const MESSAGES = {
  [NOT_CONFIGURED]: 'The rewards programme isn’t connected yet. Please check back soon.',
  network: 'We couldn’t reach the rewards service. Please check your connection and try again.',

  '400-03': 'That doesn’t look like a valid mobile number.',
  '400-05': 'That doesn’t look like a valid mobile number.',
  '401-10': 'That doesn’t look like a valid mobile number.',
  '400-04': 'That mobile number is already registered.',
  '400-10': 'That coupon has already been used.',
  '400-14': 'Some required details are missing. Please complete every field.',

  '401-00': 'The rewards service rejected the request. Please try again shortly.',
  '401-01': 'The rewards service rejected the request. Please try again shortly.',
  '401-05': 'Please enter your PIN.',
  '401-06': 'Please enter the code we sent you.',
  '401-07': 'That PIN wasn’t right.',
  '401-21': 'That coupon isn’t on your account.',

  '403-01': 'Too many codes requested. Please wait a little before trying again.',
  '403-03': 'That code wasn’t right. Please try again.',
  '403-07': 'That code wasn’t right. Please try again.',
  '403-04': 'Too many attempts. Please request a new code.',
  '403-08': 'Too many attempts. Please request a new code.',

  '404-05': 'The rewards service isn’t set up for this store yet.',
  '404-07': 'That code has expired. Please request a new one.',
  '404-09': 'That code has expired. Please request a new one.',

  '409-00': 'You don’t have enough points for that redemption.',
  '409-04': 'That code has expired. Please request a new one.',
  '409-05': 'That code has expired. Please request a new one.',
};

export function describeError(error) {
  if (MESSAGES[error]) return MESSAGES[error];
  if (typeof error === 'string' && error.startsWith('500-')) {
    return 'The rewards service is temporarily unavailable. Please try again shortly.';
  }
  return 'Something went wrong. Please try again.';
}
