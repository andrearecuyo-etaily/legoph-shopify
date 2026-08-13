/**
 * ZAP App Proxy — reference implementation (Cloudflare Worker).
 *
 * Deploy this behind a Shopify App Proxy at subpath `zap`, so the storefront
 * reaches it at /apps/zap/*. It implements docs/zap-app-proxy-contract.md.
 *
 * Two modes:
 *   MOCK = "1"  -> canned responses, no ZAP credentials needed. Use this to test
 *                  every flow in the theme before ZAP access exists.
 *   MOCK unset  -> calls the real Partner API (point ZAP_BASE at staging first).
 *
 * This is a starting point, not a hardened service. Before production you still
 * want: rate limiting, structured logging, retries/timeouts on ZAP calls, and a
 * real store for the customer -> mobile mapping (below it uses Shopify customer
 * metafields, which is fine but costs an Admin API round trip per request).
 *
 * Required environment:
 *   SHOPIFY_APP_SECRET   app's client secret, for proxy signature verification
 *   SHOP                 my-store.myshopify.com
 *   ADMIN_TOKEN          Admin API token with read/write_customers
 *   ZAP_BASE             https://partner.staging.zap.com.ph
 *   ZAP_TOKEN            ZAP partner access token
 *   ZAP_MERCHANT_ID      as provided by ZAP
 *   ZAP_BRANCH_ID        as provided by ZAP
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/* --------------------------------------------------- proxy signature check */

/**
 * Shopify signs every App Proxy request. Without this check anyone could hit
 * the worker directly and pass any logged_in_customer_id they liked.
 */
async function verifyProxySignature(url, secret) {
  const params = new URLSearchParams(url.search);
  const signature = params.get('signature');
  if (!signature) return false;
  params.delete('signature');

  const message = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // Constant-time compare.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------- customer <-> mobile number map */

const MF_NAMESPACE = 'zap';

async function adminGraphQL(env, query, variables) {
  const res = await fetch(`https://${env.SHOP}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

/** The browser never sends a mobile number for reads — it's resolved here. */
async function getLinkedMobile(env, customerId) {
  if (env.MOCK === '1') return '639000000000';

  const data = await adminGraphQL(
    env,
    `query($id: ID!) {
       customer(id: $id) { metafield(namespace: "${MF_NAMESPACE}", key: "mobile") { value } }
     }`,
    { id: `gid://shopify/Customer/${customerId}` }
  );
  return data?.data?.customer?.metafield?.value || null;
}

async function linkCustomer(env, customerId, mobile, zapUserId) {
  if (env.MOCK === '1') return;

  const masked = `•••• ••• ${mobile.slice(-4)}`;
  await adminGraphQL(
    env,
    `mutation($mf: [MetafieldsSetInput!]!) {
       metafieldsSet(metafields: $mf) { userErrors { message } }
     }`,
    {
      mf: [
        // Full number is server-side only — never exposed to Liquid.
        { ownerId: `gid://shopify/Customer/${customerId}`, namespace: MF_NAMESPACE, key: 'mobile', type: 'single_line_text_field', value: mobile },
        { ownerId: `gid://shopify/Customer/${customerId}`, namespace: MF_NAMESPACE, key: 'mobile_masked', type: 'single_line_text_field', value: masked },
        { ownerId: `gid://shopify/Customer/${customerId}`, namespace: MF_NAMESPACE, key: 'user_id', type: 'single_line_text_field', value: zapUserId || '' },
        { ownerId: `gid://shopify/Customer/${customerId}`, namespace: MF_NAMESPACE, key: 'enrolled_at', type: 'date_time', value: new Date().toISOString() },
      ],
    }
  );
  return masked;
}

/* ------------------------------------------------------------- ZAP requests */

async function zap(env, path, body) {
  const res = await fetch(`${env.ZAP_BASE}/v0-1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ZAP_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Maps a ZAP failure onto the contract's shape, passing the code through. */
const fail = (payload) => json({ ok: false, error: payload?.errorCode || 'zap_error' });

/** ZAP wants a code first: send one and tell the theme to retry. */
async function requireOtp(env, mobile, purpose) {
  const sent = await zap(env, `/otp/send/${purpose}`, { mobileNumber: mobile, merchantId: env.ZAP_MERCHANT_ID });
  if (!sent.success) return fail(sent);
  return json({ ok: false, error: 'otp_required', reference: sent.data.refId });
}

/* ------------------------------------------------------------ mock fixtures */

const MOCK = {
  balance: {
    ok: true,
    currencies: [
      { id: 2, name: 'Insiders Points', validPoints: 1240, pendingPoints: 80, priority: 5000 },
      { id: 1, name: 'ZAPCash', validPoints: 180.61, pendingPoints: 0, priority: 8000 },
    ],
  },
  membership: { ok: true, rank: { name: 'Gold', expiry: 2145916799000 }, fullName: 'Test Shopper' },
  coupons: {
    ok: true,
    coupons: [
      { id: 1852396, status: 'Available', isActive: true, validityStartDate: '2026-01-01', validityEndDate: '2026-12-31',
        promotion: { id: 1, name: '₱200 off ₱2,000', description: 'Minimum spend applies' } },
      { id: 1852394, status: 'Used', isActive: true, validityStartDate: '2026-01-01', validityEndDate: '2026-12-31',
        promotion: { id: 2, name: 'Free minifigure', description: null } },
    ],
  },
  transactions: {
    ok: true,
    marker: null,
    transactions: [
      { refNo: 'Z34020863370', status: 'Cleared', dateProcessed: '2026-08-01T01:04:01.000Z', amount: 2400,
        merchantName: 'Brickline', branchName: 'BGC', points: [{ earned: 72, redeemed: 0, currency: 'Insiders Points' }] },
      { refNo: 'Z30192916406', status: 'Pending', dateProcessed: '2026-08-10T07:48:31.000Z', amount: 1200,
        merchantName: 'Brickline', branchName: 'Trinoma', points: [{ earned: 36, redeemed: 0, currency: 'Insiders Points' }] },
    ],
  },
};

/* -------------------------------------------------------------------- routes */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (env.MOCK !== '1' && !(await verifyProxySignature(url, env.SHOPIFY_APP_SECRET))) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const customerId = url.searchParams.get('logged_in_customer_id');
    if (!customerId) return json({ ok: false, error: 'unauthorized' }, 401);

    // Shopify keeps the app-proxy subpath on the URL.
    const route = url.pathname.replace(/^.*\/apps\/zap/, '') || '/';
    const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    if (env.MOCK === '1') {
      // Flip these to exercise the theme's otp_required and error paths.
      if (url.searchParams.get('force') === 'otp') {
        return json({ ok: false, error: 'otp_required', reference: 'mock-ref-1' });
      }
      if (url.searchParams.get('force') === 'insufficient') {
        return json({ ok: false, error: '409-00' });
      }
      switch (route) {
        case '/balance': return json(MOCK.balance);
        case '/membership': return json(MOCK.membership);
        case '/coupons': return json(MOCK.coupons);
        case '/transactions': return json(MOCK.transactions);
        case '/enrol': return json({ ok: false, error: 'otp_required', reference: 'mock-ref-1' });
        case '/enrol/verify':
          return payload.otp === '0000'
            ? json({ ok: true, mobile_masked: '•••• ••• 0000' })
            : json({ ok: false, error: '403-03' });
        case '/points/redeem': return json({ ok: true, transaction_ref: 'Z-MOCK-1', points: { valid: 740, pending: 80, redeemed: 500 } });
        case '/coupons/redeem': return json({ ok: true, transaction_ref: 'Z-MOCK-2' });
        default: return json({ ok: false, error: 'not_found' }, 404);
      }
    }

    const mobile = await getLinkedMobile(env, customerId);

    switch (route) {
      case '/enrol': {
        const res = await zap(env, '/register', {
          mobileNumber: payload.mobile,
          branchId: env.ZAP_BRANCH_ID,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          birthday: payload.birthday,
        });
        if (!res.success) return fail(res);
        const masked = await linkCustomer(env, customerId, payload.mobile, res.data?.id);
        return json({ ok: true, user_id: res.data?.id, mobile_masked: masked });
      }

      case '/enrol/verify': {
        const res = await zap(env, '/otp/verify', {
          refId: payload.reference,
          otp: payload.otp,
          merchantId: env.ZAP_MERCHANT_ID,
        });
        if (!res.success) return fail(res);
        return json({ ok: true });
      }

      case '/balance': {
        if (!mobile) return json({ ok: false, error: 'not_enrolled' });
        const otp = url.searchParams.get('otp');
        const res = await zap(env, '/user/balance/inquiry', {
          mobileNumber: mobile,
          branchId: env.ZAP_BRANCH_ID,
          ...(otp ? { otp, refId: url.searchParams.get('reference') } : {}),
        });
        // 401-06 means the merchant's auth mode wants a code.
        if (!res.success && res.errorCode === '401-06') return requireOtp(env, mobile, 'GET_BALANCE');
        if (!res.success) return fail(res);
        return json({ ok: true, currencies: res.data.currencies });
      }

      case '/membership': {
        if (!mobile) return json({ ok: false, error: 'not_enrolled' });
        const res = await zap(env, '/membership', { mobileNumber: mobile, merchantId: env.ZAP_MERCHANT_ID, branchId: env.ZAP_BRANCH_ID });
        if (!res.success) return fail(res);
        return json({ ok: true, rank: res.data.rank, fullName: res.data.fullName });
      }

      case '/coupons': {
        if (!mobile) return json({ ok: false, error: 'not_enrolled' });
        const res = await zap(env, '/user/coupon/inquiry', { mobileNumber: mobile, branchId: env.ZAP_BRANCH_ID });
        if (!res.success) return fail(res);
        return json({ ok: true, coupons: res.data.coupons });
      }

      case '/transactions': {
        if (!mobile) return json({ ok: false, error: 'not_enrolled' });
        const marker = url.searchParams.get('marker');
        const res = await zap(env, '/user/transactions', {
          mobileNumber: mobile,
          branchId: env.ZAP_BRANCH_ID,
          ...(marker ? { marker } : {}),
        });
        if (!res.success) return fail(res);
        return json({ ok: true, transactions: res.data.transactions, marker: res.data.marker });
      }

      case '/points/redeem': {
        if (!mobile) return json({ ok: false, error: 'not_enrolled' });

        // Re-read the real balance — never trust an amount from the browser.
        const bal = await zap(env, '/user/balance/inquiry', { mobileNumber: mobile, branchId: env.ZAP_BRANCH_ID });
        const available = bal?.data?.currencies?.[0]?.validPoints ?? 0;
        if (Number(payload.amount) > available) return json({ ok: false, error: '409-00' });

        const res = await zap(env, '/transaction/redeem', {
          transactionAmount: String(payload.amount),
          mobileNumber: mobile,
          branchId: env.ZAP_BRANCH_ID,
          ...(payload.otp ? { otp: payload.otp, refId: payload.reference } : {}),
        });
        if (!res.success && res.errorCode === '401-06') return requireOtp(env, mobile, 'USE_POINTS');
        if (!res.success) return fail(res);
        return json({ ok: true, transaction_ref: res.data.transactionRefNo, points: res.data.points });
      }

      case '/coupons/redeem': {
        if (!mobile) return json({ ok: false, error: 'not_enrolled' });
        // Path per the docs' sample curl, not its heading.
        const res = await zap(env, '/transaction/redeem/coupon', {
          couponId: String(payload.coupon_id),
          mobileNumber: mobile,
          branchId: env.ZAP_BRANCH_ID,
          ...(payload.otp ? { otp: payload.otp, refId: payload.reference } : {}),
        });
        if (!res.success && res.errorCode === '401-06') return requireOtp(env, mobile, 'USE_POINTS');
        if (!res.success) return fail(res);
        return json({ ok: true, transaction_ref: res.data.transactionRefNo });
      }

      default:
        return json({ ok: false, error: 'not_found' }, 404);
    }
  },
};
