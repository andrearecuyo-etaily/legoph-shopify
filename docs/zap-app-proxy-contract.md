# ZAP loyalty — App Proxy contract

The theme never talks to ZAP. It calls a Shopify **App Proxy** on the storefront's
own origin; the proxy forwards to an endpoint that holds the ZAP Partner API
credentials and calls ZAP server-to-server, exactly as the flow diagram shows
(`STORE → ZAP System`).

```
Browser (theme)              Shopify App Proxy            Your endpoint             ZAP Partner API
  GET /apps/zap/balance  ──►  verifies + appends     ──►  holds API key        ──►  Inquire Balance
                              logged_in_customer_id       resolves id → mobile
```

## Why it cannot be called from the theme

The ZAP partner key would be readable in page source. The Earn Points API takes
only a mobile number and an amount, so a leaked key lets anyone mint points to any
number, or redeem against someone else's balance. Browser CORS would block the
call regardless, but credential exposure is the real reason.

## Identity

ZAP identifies a member by **mobile number**; Shopify identifies by **customer id**.
The proxy is the only place that maps between them.

**The browser never sends a mobile number for reads or redemptions.** Shopify signs
every proxy request with `logged_in_customer_id`; the endpoint resolves the linked
mobile number from that. If the browser could supply a number, any shopper could
read or spend a stranger's balance.

A mobile number is sent exactly once — during enrolment, which the OTP step verifies.

## Metafields the endpoint owns

Written by the endpoint via the Admin API; read by Liquid to pick the page state
server-side (so there's no logged-out flash).

| Metafield | Type | Purpose |
|---|---|---|
| `customer.zap.enrolled_at` | `date_time` | Presence means enrolled. Drives which state the page renders. |
| `customer.zap.mobile_masked` | `single_line_text_field` | Display only, e.g. `•••• ••• 5792`. Never the full number. |

The full mobile number stays server-side. It must not be exposed to Liquid — the
theme has no use for it and page source is public to anyone sharing the device.

## Endpoints

All responses are JSON. All requests are same-origin, so the browser sends session
cookies; the endpoint must still verify Shopify's proxy signature and reject any
request without a `logged_in_customer_id`.

### `POST /apps/zap/enrol`
Register API. The only call carrying a mobile number.
```jsonc
// request
{ "mobile": "09985515792", "pin": "1234" }
// response
{ "ok": true, "otp_required": true, "reference": "otp_abc123" }
{ "ok": false, "error": "already_enrolled" | "invalid_mobile" | "zap_unavailable" }
```

### `POST /apps/zap/enrol/verify`
Confirms the OTP, then writes both metafields.
```jsonc
{ "reference": "otp_abc123", "otp": "482915" }
{ "ok": true, "mobile_masked": "•••• ••• 5792" }
{ "ok": false, "error": "invalid_otp" | "expired" }
```

### `GET /apps/zap/balance`
Inquire Balance API.
```jsonc
{ "ok": true, "valid_points": 1240, "pending_points": 80, "tier": "Gold" }
```

### `GET /apps/zap/coupons`
Inquire Coupon List API.
```jsonc
{ "ok": true, "coupons": [
  { "id": "CPN-9931", "name": "₱200 off ₱2,000", "valid_from": "2026-08-01", "valid_to": "2026-09-30" }
]}
```

### `POST /apps/zap/coupons/redeem`
Redeem Coupon API.
```jsonc
{ "coupon_id": "CPN-9931", "otp": "482915" }   // otp only if ZAP requires it
{ "ok": true, "transaction_ref": "TXN-55210", "discount_code": "ZAP-9931-XYZ" }
```

### `POST /apps/zap/points/redeem`
Redeem Points API. The highest-risk call — it moves real value.
```jsonc
{ "amount": 500, "otp": "482915" }
{ "ok": true, "transaction_ref": "TXN-55211", "redeemed_points": 500, "discount_code": "ZAP-PTS-ABC" }
{ "ok": false, "error": "insufficient_points" | "invalid_otp" }
```
The endpoint **must re-read the balance from ZAP before redeeming** and never trust
an amount the browser claims is affordable.

## Earn Points is not on this page

The diagram has the store submitting a transaction amount — that's a POS counter.
Online, points accrue from an `orders/paid` webhook on the endpoint, calling Earn
Points API with the order total. A customer-facing "earn points" button would let
anyone grant themselves points.

The page shows earned points as the pending/valid balance, not as an action.

## Not configured

Until the proxy exists every call 404s. The client module treats a non-JSON or 404
response as `not_configured` and the page says the programme isn't connected yet,
rather than showing a fake zero balance.
