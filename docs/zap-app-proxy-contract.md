# ZAP loyalty — App Proxy contract

Built against **ZAP Partner API v0-1**.

- Production `https://partner.zap.com.ph/`
- Staging `https://partner.staging.zap.com.ph/` (separate credentials)

The theme never calls ZAP. It calls a Shopify **App Proxy** on the storefront's
own origin; the proxy forwards to an endpoint holding the credentials and calls
ZAP server-to-server — the `STORE → ZAP System` hop in the flow diagram.

```
Browser (theme)              Shopify App Proxy            Your endpoint             ZAP Partner API
  GET /apps/zap/balance  ──►  verifies + appends     ──►  Authorization:       ──►  POST /v0-1/user/
                              logged_in_customer_id       Bearer <token>            balance/inquiry
                                                          resolves id → mobile
```

## Why it cannot be called from the theme

`Authorization: Bearer <accessToken>` would be readable in page source. Earn
Points takes only a mobile number and an amount, so a leaked token lets anyone
mint points to any number; Redeem Points and Deduct Points are worse. Browser
CORS would block it anyway, but credential exposure is the reason.

## Constants the endpoint holds

Never sent by the browser.

| | Used by |
|---|---|
| `accessToken` | every call, as `Authorization: Bearer` |
| `merchantId` | OTP send/verify/resend, membership, add/deduct points |
| `branchId` | register, balance, coupons, transactions, earn, redeem |

## Identity

ZAP identifies a member by **mobile number** (or `tagUuid`); Shopify by
**customer id**. The proxy is the only place that maps between them.

**The browser never sends a mobile number except at enrolment.** Shopify signs
each proxy request with `logged_in_customer_id`; the endpoint resolves the linked
number from that. Otherwise any shopper could read or spend a stranger's balance.

### Metafields the endpoint owns

| Metafield | Type | Purpose |
|---|---|---|
| `customer.zap.enrolled_at` | `date_time` | Presence means enrolled; picks the page state in Liquid |
| `customer.zap.mobile_masked` | `single_line_text_field` | Display only, e.g. `•••• ••• 5792` |
| `customer.zap.user_id` | `single_line_text_field` | `data.id` from Register |

The full mobile number stays server-side — Liquid has no use for it and page
source is public to anyone sharing the device.

## Auth modes change what's required

ZAP merchant config sets `partnerGetBalanceByMobileAuthMode` and
`partnerRedeemPointsByMobileAuthMode` to one of `NoAuth` / `Pin` / `Otp` /
`PinOtp`. That decides whether `pin`, and `otp` + `refId`, are required on
balance and redemption.

The endpoint owns this. When ZAP needs an OTP it should call
`POST /v0-1/otp/send/<PURPOSE>` (`GET_BALANCE` or `USE_POINTS`) and return
`{ "ok": false, "error": "otp_required", "reference": "<refId>" }`. The theme then
prompts for the code and retries the same call with `otp`. The theme does not need
to know which mode is configured.

## Endpoints

JSON in, JSON out. Same-origin, so cookies ride along — the endpoint must still
verify the proxy signature and reject anything without `logged_in_customer_id`.

### `POST /apps/zap/enrol` → `POST /v0-1/register`
The only call carrying a mobile number. `branchId` is added server-side.
```jsonc
// request
{ "mobile": "639991234567", "pin": "1234",
  "firstName": "John", "lastName": "Smith", "email": "…", "birthday": "1990-01-01" }
// response — ZAP returns data.id; write the metafields, then:
{ "ok": true, "user_id": "2a9da6f2-…", "mobile_masked": "•••• ••• 4567" }
{ "ok": false, "error": "otp_required", "reference": "<refId>" }
{ "ok": false, "error": "400-04" }   // mobile already registered
```
Registration fields marked required in the Merchant Dashboard must be collected,
or ZAP returns `400-14 Required Fields Missing`.

### `POST /apps/zap/enrol/verify` → `POST /v0-1/otp/verify`
```jsonc
{ "reference": "<refId>", "otp": "6721" }
{ "ok": true, "mobile_masked": "•••• ••• 4567" }
{ "ok": false, "error": "403-03" }   // invalid OTP
```

### `GET /apps/zap/balance` → `POST /v0-1/user/balance/inquiry`
ZAP returns **an array of currencies** — a merchant can run more than one (the
docs' example has "Angus Points" and "ZAPCash"). Pass it through in `priority`
order; the theme renders the first prominently.
```jsonc
{ "ok": true, "currencies": [
  { "id": 2, "name": "Angus Points", "validPoints": 5000.20, "pendingPoints": 2000.11, "priority": 5000 }
]}
{ "ok": false, "error": "otp_required", "reference": "<refId>" }
```

### `GET /apps/zap/membership` → `POST /v0-1/membership`
Supplies the tier. `rank.name` is the tier label, `rank.expiry` its expiry.
```jsonc
{ "ok": true, "rank": { "name": "Gold", "expiry": 2145916799000 }, "fullName": "…" }
```

### `GET /apps/zap/coupons` → `POST /v0-1/user/coupon/inquiry`
```jsonc
{ "ok": true, "coupons": [
  { "id": 1852396, "status": "Available", "isActive": true,
    "validityStartDate": "2014-04-23", "validityEndDate": "2020-01-01",
    "promotion": { "id": 1, "name": "Free Steak Saturdays", "description": null } }
]}
```
`status` is `Available` / `Expired` / `Used`. The theme only offers a redeem
button on `Available` + `isActive`.

### `GET /apps/zap/transactions?marker=` → `POST /v0-1/user/transactions`
Ten per request; pass back `marker` from the previous response to page.
```jsonc
{ "ok": true, "marker": "2020-08-12T07:48:07.000Z---6d92ce8a-…", "transactions": [
  { "refNo": "Z34020863370", "status": "Cleared", "dateProcessed": "2020-08-13T01:04:01.000Z",
    "amount": 100, "merchantName": "…", "branchName": "…",
    "points": [ { "earned": 5, "redeemed": 0, "currency": "Angus Points" } ] }
]}
```

### `POST /apps/zap/points/redeem` → `POST /v0-1/transaction/redeem`
`transactionAmount` is the **number of points**, not currency.
```jsonc
{ "amount": 500, "otp": "6721", "reference": "<refId>" }
{ "ok": true, "transaction_ref": "Z31945680594",
  "points": { "valid": 100, "pending": 10, "redeemed": 500 } }
{ "ok": false, "error": "409-00" }   // insufficient points
{ "ok": false, "error": "otp_required", "reference": "<refId>" }
```
The endpoint **must re-read the balance from ZAP before redeeming**. Never trust
an amount the browser claims is affordable.

### `POST /apps/zap/coupons/redeem` → `POST /v0-1/transaction/redeem/coupon`
Note the path: the docs' heading says `/transaction/redeem`, but the sample curl
uses `/transaction/redeem/coupon`. The curl is the working one.
```jsonc
{ "coupon_id": 1852396, "otp": "6721", "reference": "<refId>" }
{ "ok": true, "transaction_ref": "Z33095362223" }
{ "ok": false, "error": "400-10" }   // coupon already used
```

## Earn Points is not on this page

`POST /v0-1/transaction/earn` takes `transactionAmount` + mobile + `branchId` —
the diagram's store counter. Online that belongs on a Shopify `orders/paid`
webhook using the order total. A customer-facing earn button would be
self-service points.

Points then appear here as `pendingPoints`, clearing to `validPoints` on ZAP's
own schedule.

## Error codes

Passed through verbatim so the theme can map them; `assets/brickline-zap.js`
holds the copy.

| Code | Meaning |
|---|---|
| `400-03` / `400-05` / `401-10` | invalid mobile number |
| `400-04` | mobile already registered |
| `400-10` | coupon already used |
| `400-14` | required registration fields missing |
| `401-00` / `401-01` | unauthorized token |
| `401-05` / `401-06` | pin, or otp/refId, missing |
| `401-07` | incorrect PIN |
| `401-21` | coupon does not belong to that user |
| `403-01` | send-OTP limit exceeded |
| `403-03` / `403-07` | invalid OTP |
| `403-04` / `403-08` | max attempts exceeded |
| `404-05` | merchant not found |
| `404-07` / `404-09` | OTP session not found |
| `409-00` | insufficient points |
| `409-04` / `409-05` | session expired or already complete |
| `500-*` | ZAP internal error |

## Not configured

Until the proxy exists every call 404s to the storefront's HTML page. The client
treats a non-JSON response as `not_configured`, says the programme isn't
connected, and disables the actions rather than showing a fake zero balance.
