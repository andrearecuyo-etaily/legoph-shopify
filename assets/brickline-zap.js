/**
 * ZAP loyalty client.
 *
 * The theme never calls the ZAP Partner API — it calls a Shopify App Proxy on
 * this same origin, which forwards to an endpoint holding the partner
 * credentials. See docs/zap-app-proxy-contract.md for the endpoint shapes.
 *
 * Two rules this module exists to enforce:
 *
 * 1. No mobile number leaves the browser except during enrolment. Shopify signs
 *    every proxy request with logged_in_customer_id, and the endpoint resolves
 *    the linked number from that. If reads accepted a browser-supplied number,
 *    any shopper could read or spend a stranger's balance.
 * 2. Nothing here is trusted for value. Redemptions are re-validated server-side
 *    against a fresh ZAP balance; this module only drives the UI.
 */

const PROXY_ROOT = '/apps/zap';

/** Distinguishes "no proxy deployed yet" from a genuine API failure. */
export const NOT_CONFIGURED = 'not_configured';

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

  // With no App Proxy installed the storefront serves its own 404 page, so a
  // non-JSON response means "not wired up yet" rather than a real error.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { ok: false, error: NOT_CONFIGURED };
  }

  try {
    const data = await response.json();
    // Trust the payload's own ok flag; fall back to the HTTP status.
    return typeof data.ok === 'boolean' ? data : { ...data, ok: response.ok };
  } catch {
    return { ok: false, error: NOT_CONFIGURED };
  }
}

export const Zap = {
  /** Register API — the one call that carries a mobile number. */
  enrol(mobile, pin) {
    return call('/enrol', { method: 'POST', body: { mobile, pin } });
  },

  /** Confirms the OTP from the Register step; the endpoint writes the metafields. */
  verifyEnrolment(reference, otp) {
    return call('/enrol/verify', { method: 'POST', body: { reference, otp } });
  },

  /** Inquire Balance API. */
  balance() {
    return call('/balance');
  },

  /** Inquire Coupon List API. */
  coupons() {
    return call('/coupons');
  },

  /** Redeem Coupon API. */
  redeemCoupon(couponId, otp) {
    return call('/coupons/redeem', { method: 'POST', body: { coupon_id: couponId, otp } });
  },

  /** Redeem Points API. Server re-reads the real balance before honouring this. */
  redeemPoints(amount, otp) {
    return call('/points/redeem', { method: 'POST', body: { amount, otp } });
  },
};

/** Human-readable text for the error codes the contract defines. */
export function describeError(error) {
  switch (error) {
    case NOT_CONFIGURED:
      return 'The rewards programme isn’t connected yet. Please check back soon.';
    case 'network':
      return 'We couldn’t reach the rewards service. Please check your connection and try again.';
    case 'already_enrolled':
      return 'This mobile number is already registered.';
    case 'invalid_mobile':
      return 'That doesn’t look like a valid mobile number.';
    case 'invalid_otp':
      return 'That code wasn’t right. Please try again.';
    case 'expired':
      return 'That code has expired. Request a new one.';
    case 'insufficient_points':
      return 'You don’t have enough points for that redemption.';
    case 'zap_unavailable':
      return 'The rewards service is temporarily unavailable. Please try again shortly.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
