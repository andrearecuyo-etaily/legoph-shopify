# Testing the ZAP rewards page

Three levels, in the order they're worth doing.

## 1. No backend — states, layout, failure copy

Testable immediately.

| What | How |
|---|---|
| Signed-out state | Open the rewards page logged out |
| Not-enrolled state | Sign in as a customer with no `zap.enrolled_at` metafield |
| Member state | Add `zap.enrolled_at` (date/time, any value) and `zap.mobile_masked` (text) to that customer in Admin → Customers → Metafields |
| Not-connected copy | Member state with no proxy: every panel should say the programme isn't connected, and every button should be disabled |

That last row is the important one — it proves the page fails honestly rather
than showing a fake zero balance.

## 2. Mock proxy — every flow, no ZAP credentials

`worker.js` in this folder runs in `MOCK=1` mode and returns canned data shaped
exactly like the contract. Deploy it, point an App Proxy at it, and the whole
page comes alive without ZAP access.

```bash
npm create cloudflare@latest zap-proxy -- --type=hello-world
# replace src/index.js with worker.js
npx wrangler secret put MOCK          # value: 1
npx wrangler deploy
```

Then in the Shopify admin, on your custom app: **App proxy** →
subpath prefix `apps`, subpath `zap`, proxy URL = the worker URL.

The theme will now hit `/apps/zap/*` and get real responses.

Mock mode covers:

- balance with **two** currencies, so the multi-currency layout is exercised
- one coupon Available and one Used, so both the redeem button and the status
  label are shown
- transactions with one Cleared and one Pending row
- `POST /enrol` always answers `otp_required`; code `0000` verifies, anything
  else returns `403-03`

Force the awkward paths with a query param:

```
/apps/zap/balance?force=otp            -> the balance OTP prompt
/apps/zap/points/redeem?force=insufficient  -> "not enough points"
```

`MOCK=1` skips proxy-signature verification so you can curl it directly. Never
leave that set on anything public.

## 3. ZAP staging — real API, safe data

Unset `MOCK`, then set:

```
SHOPIFY_APP_SECRET   app client secret
SHOP                 my-store.myshopify.com
ADMIN_TOKEN          Admin API token, read/write_customers
ZAP_BASE             https://partner.staging.zap.com.ph
ZAP_TOKEN            staging access token
ZAP_MERCHANT_ID      as provided
ZAP_BRANCH_ID        as provided
```

Staging credentials differ from production — confirm which set you have.

Worth checking here specifically:

- **Which auth mode the merchant is on.** If `partnerGetBalanceByMobileAuthMode`
  is `Otp` or `PinOtp`, simply loading the page triggers an SMS. Verify that's
  intended before this reaches real shoppers.
- **Redeem Coupon's path.** The docs' heading says `/v0-1/transaction/redeem`
  but the sample curl says `/v0-1/transaction/redeem/coupon`. The worker uses the
  curl path. Confirm with ZAP.
- **Required registration fields.** ZAP returns `400-14` if the Merchant
  Dashboard marks fields the enrolment form doesn't collect. The form currently
  sends mobile and PIN only — add fields to the section if your config needs more.
- **The registration OTP purpose.** The worker sends `/otp/send/REGISTRATION`,
  which is a guess — the docs we have only name `GET_BALANCE` and `USE_POINTS`.
  Set `ZAP_OTP_PURPOSE_REGISTER` once ZAP confirms it.
- **Whether Register accepts `pin`.** The worker forwards the PIN the shopper
  chooses. If ZAP names that field differently, enrolment will succeed with no
  PIN set and `Pin`/`PinOtp` merchants will fail every call afterwards.

### A gap that is still open

On a `Pin` or `PinOtp` merchant the balance call can come back `401-05` (PIN
missing). The theme has copy for it but no PIN field outside enrolment, so the
shopper reads "Please enter your PIN" with nowhere to type it — the same
dead end the OTP path used to have. If staging shows that auth mode, the redeem
and balance panels need a PIN input the way they already have an OTP one.

## What is not wired up

**Earn Points.** Points only appear once something calls
`POST /v0-1/transaction/earn`. That belongs on a Shopify `orders/paid` webhook
using the order total — it is not part of this page, and is not in the worker.
Until it exists, balances only change through manual adjustments in the ZAP
dashboard.
