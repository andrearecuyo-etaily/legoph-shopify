# Brickline design source — page inventory

Source: claude.ai/design project "Brickline" (project id `9f82ee07-e112-4819-bc56-44c8edf43dae`), design system `_ds/brickline-design-system-67f79e5c-1110-42bb-80fb-cf1887de56da`.

Full page HTML was shared in chat on 2026-07-31 for every page below. Only the homepage is saved verbatim in this folder (`Brickline Home.dc.html`) since that's the only one being converted right now. When we're ready to build the others, re-fetch the exact same content via the `DesignSync` tool (`get_file` on `design_handoff_brickline_shopify/pages/<Page Name>.dc.html`) against this same project id — don't hand-retype from memory.

Design tokens are saved in `tokens/` (colors, typography, shape, spacing) — same tokens apply to every page below.

## Status

- [x] Home — converted to Shopify (`sections/brickline-header.liquid`, `brickline-footer.liquid`, `hero-slider.liquid`, `category-tiles.liquid`, `product-rail.liquid`, `promo-banner.liquid`, `feature-grid.liquid`, `newsletter-band.liquid`, wired via `templates/index.json`)
- [x] Loyalty — `templates/page.loyalty.json` (`brickline-loyalty-hero`, `brickline-icon-links`, `brickline-faq`, `brickline-media-text` ×2, `brickline-benefit-grid`, `brickline-panel-mosaic`, `brickline-steps`, `newsletter-band`)
- [x] Collections — `templates/list-collections.json` (`brickline-page-banner`, `brickline-collection-index`)
- [x] Collection 1 — `templates/collection.json` (`brickline-page-banner`, `brickline-collection-description`, `brickline-collection-grid`, `brickline-gift-banner`)
- [x] Collection 2 — `templates/collection.editorial.json` (same core plus `brickline-cta-banner` and two `brickline-editorial-grid` bands)
- [x] Product 1 — `templates/product.json` (`brickline-product-main`, `brickline-product-specs`, `brickline-product-reviews`, `brickline-product-recommendations`, `brickline-recently-viewed`)
- [x] Product 2 — `templates/product.showcase.json` (adds `brickline-feature-band`, `brickline-circle-grid`, `brickline-editorial-grid`)
- [x] Product 3 — `templates/product.cinematic.json` (adds `brickline-cta-banner` and two `brickline-feature-band` splits)
- [x] Cart — `templates/cart.json` (`brickline-main-cart`)
- [x] Cart Drawer — Horizon's `snippets/cart-drawer.liquid` reskinned via `assets/brickline-cart.css`, plus `brickline-shipping-meter` and `brickline-cart-upsells`
- [x] 404 — `templates/404.json` (`brickline-404`)
- [x] Returns — `templates/page.returns.json` (`brickline-rich-text` + `brickline-faq`)
- [x] FAQs — `templates/page.faqs.json` (inset `brickline-page-banner` + grouped `brickline-faq` sections)
- [x] Our Stores — `templates/page.stores.json` (`brickline-store-locator`)
- [x] Contact Us — `templates/page.contact.json` (`brickline-feature-band` ×2 + `brickline-columns`)
- [x] Send Message — `templates/page.send-message.json` (`brickline-contact-form`)
- [x] Search — `templates/search.json` (`brickline-search`)
- [x] Filters Drawer / Sort Drawer — `snippets/brickline-filters-drawer.liquid`, `brickline-sort-drawer.liquid`, driven by `assets/brickline-drawer.js`; replaces the inline disclosures in `brickline-collection-grid`
- [x] Accessibility Statement / Privacy Policy / Terms and Conditions / Shipping Information — assign `templates/page.content.json`; copy lives in the Shopify page editor (`brickline-rich-text` falls back to `page.title` / `page.content`)
- [x] About Us — `templates/page.about.json` (inset banner + `brickline-rich-text` sections)
- [x] Coming Soon — `templates/password.json` (`brickline-coming-soon`, live countdown + storefront password form)
- [x] Free Shipping — `templates/page.free-shipping.json` (`brickline-cta-banner`, `brickline-product-grid`, small-print `brickline-rich-text`, `brickline-feature-band`)
- [x] Account / Account Details / Addresses / Order History / Order Confirmation — `templates/customers/*.liquid` (classic customer accounts)
- [x] Wishlist — `templates/page.wishlist.json` (`brickline-wishlist`, localStorage-backed; see note below)
- [ ] Checkout — see note below

## Pages available in the source project (not yet converted)

- Accessibility Statement
- Brickline 404
- Brickline About Us
- Brickline Account Details
- Brickline Account
- Brickline Addresses
- Brickline Checkout
- Brickline Coming Soon
- Brickline Contact Us
- Brickline FAQs
- Brickline Filters Drawer
- Brickline Order Confirmation
- Brickline Order History
- Brickline Our Stores
- Brickline Privacy Policy
- Brickline Returns
- Brickline Search
- Brickline Send Message
- Brickline Shipping Information
- Brickline Sort Drawer
- Brickline Terms and Conditions
- Brickline Wishlist
- Free Shipping

Every one of these pages already shares the exact same utility bar / header / footer markup as the homepage, so `brickline-header.liquid` and `brickline-footer.liquid` (already built) should carry over directly — the work per page is really just the body content between header and footer.

## Notes for future conversion work

- All pages use the same design-system component calls (`x-import component-from-global-scope="BricklineDesignSystem_67f79e.Button|Badge|Card|PriceDisplay|Tag"`) — map these to the same house conventions used in the homepage sections (plain Liquid/CSS, `--radius-pill` for interactive controls, `--brickline-card-radius` for image/content blocks).
- Cart/account/checkout pages (`Brickline Cart`, `Brickline Cart Drawer`, `Brickline Checkout`, `Brickline Account*`, `Brickline Order *`) will need real Shopify data wiring (cart object, customer object, order object) rather than the static/mock JS state used in the design source — these are the highest-effort conversions.
- `Brickline 404`, `Free Shipping`, `Accessibility Statement`, `Brickline Privacy Policy`, `Brickline Terms and Conditions`, `Brickline Returns`, `Brickline FAQs`, `Brickline Shipping Information` are mostly static content — good candidates to convert early/quickly.
- `Brickline Collections`, `Brickline Collection 1/2`, `Brickline Search` are full PLP/search patterns — will need real Shopify collection/search objects and filters, not the mock arrays in the source.
- Footer legal-links menu (spec row 3: Privacy policy, Cookies, Cookie settings, Legal notice, Terms of use, Digital wellbeing, Accessibility, Do not sell/share my personal information) currently has no menu wired in `brickline-footer.liquid`'s `legal_menu` setting (removed as a default because no matching Shopify navigation menu exists yet) — create that menu in Shopify admin and set it in the footer section settings when ready.

## Blocked / needs a decision

**Customer account pages — built for classic accounts.** `templates/customers/`
did not exist in this theme; it was added on the basis that the store runs
*classic* customer accounts. These templates only render under classic accounts —
under Shopify's *new customer accounts* the pages are hosted at
`shopify.com/<store-id>/account` and the theme is bypassed entirely. If the store
is ever migrated to new accounts, everything under `templates/customers/` becomes
dead code.

Only the `Account` design (the login/register card) was converted from its design
file. `Addresses`, `Order History` and `Order Confirmation` were built against the
Shopify `customer` / `order` object model in the established Brickline visual
language and confirmed (2026-08-18) against their design files — see Verification
pass below.

**`Account Details` — built 2026-08-18**, as a follow-up to the verification
pass below. `sections/brickline-customer-account.liquid` now has a third panel
(`id="account-details"`) with a `{% form 'customer', customer %}` covering
first name, last name, email, phone (`customer[phone]`), and an optional new
password + confirmation pair (Shopify's classic-account form requires both
together, so this is one field more than the design showed). Uses the
`.account__form*` CSS that already existed unused
(`assets/brickline-account.css:480-527`, plus new `.account__form-field--divider`
and `.account__errors` added alongside it). `brickline-account-nav.liquid` gained
an "Account Details" nav link — classic accounts have no separate route for a
details page, so it's an in-page anchor (`{{ routes.account_url }}#account-details`)
to the same `/account` page Order History lives on, not a second URL.

**Wishlist — built, per-browser only.** Saved product ids live in `localStorage`
under `brickline_wishlist`; `assets/brickline-wishlist.js` owns all reads and
writes and fires `brickline:wishlist:change` so the header badge, the hearts on
product cards and the wishlist page stay in sync. The page turns ids back into
real product cards by asking the search route to render its own section
(`/search?q=id:1 OR id:2&section_id=…`), the same trick recently-viewed uses — so
price, availability and card markup stay server-rendered.

The list does **not** follow a shopper to another device or survive clearing site
data. Making it persistent means writing a customer metafield, and this store is
on *classic* customer accounts: there is no Customer Account API, and the
Storefront API cannot write customer metafields. That needs a hosted endpoint
behind an App Proxy holding an Admin API token — it cannot be done from the theme.
If that becomes a requirement, `WishlistStore` in `assets/brickline-wishlist.js` is
the only module that changes (make its methods async and point them at the proxy);
nothing else reads storage directly.

**Checkout.** Not themeable outside Shopify Plus — no Liquid/section access to
`/checkout`. `Brickline Checkout.dc.html` was fetched from source (2026-08-18)
for reference only; nothing under `templates/`/`sections/` should change for
it. The only lever is **Settings → Checkout → Customize** (Shopify's Checkout
branding editor, available on all plans). Mapping from the design to that
editor's controls:

| Design element | Branding editor control | Value to set |
|---|---|---|
| Square corners everywhere (inputs, buttons, cards — `border-radius: 0` throughout, no rounding anywhere in the design) | **Corner radius** (Design → Global) | Set to the minimum/"None" option — Brickline's whole visual language (product cards excepted) is sharp corners, not Horizon's default rounded ones |
| Black "Pay Now" button, full width, bold uppercase-weight display font | **Buttons** → primary button color | `--brand-black` (`#000000`), text white |
| Section headings ("Contact", "Delivery", "Shipping Method", "Payment") in the display face, semibold, large (28px in source) | **Typography** → Headings | Set heading font to Cera Pro if the branding editor's font picker allows a custom/uploaded font on this plan (verify — non-Plus custom-font support varies); otherwise pick the closest system serif/sans match and flag the gap |
| Body copy, labels, inputs in the body face | **Typography** → Body | Cera Pro if available, else closest match |
| Order-summary panel background (`var(--surface-tertiary)`, `#f7f7f7`) | **Design** → Secondary background / summary panel color | `#f7f7f7` |
| Selected shipping-method row gets a `2px solid var(--brand-black)` border, unselected rows a thin `#d9d9d9` border | Not independently controllable in the branding editor — this is checkout's own interaction state styling, no lever exists | No action possible; note as a known gap |
| Yellow (`--brand-yellow`, `#ffd400`) header band used on every other page | Checkout has no equivalent header band by default — Shopify checkout's own header just shows the store logo | Set **Logo** and **Header background** if the editor exposes it; otherwise this is inherently checkout's own layout, not fixable |

Whoever has admin access should apply this in **Settings → Checkout →
Customize** and compare against `Brickline Checkout.dc.html` side by side —
not something this repo can verify without store access.

## Verification pass (2026-08-18)

Re-checked Account, Cart Drawer, and Cart against design source.

- **Account** (`sections/brickline-customer-login.liquid`) — matches the design's
  three-state card (Log In / Register / Forgot password) exactly, including the
  no-JS fallback and the `#recover` hash Shopify redirects to. No drift found.
- **Cart Drawer** (`snippets/cart-drawer.liquid`, `brickline-shipping-meter.liquid`,
  `brickline-cart-upsells.liquid`) — shipping meter and "You might also like"
  upsell row are both present and wired correctly; fixed a missing 🧱 emoji on the
  "unlocked" message. **Missing:** a "View Full Bag" link to `/cart` below the
  Check Out button in the drawer footer (`snippets/cart-summary.liquid`) — the
  design has both a Check Out button and a secondary text link to the full cart
  page; only the button exists today. Scoped as follow-up, not built in this pass.
  `Brickline Cart Drawer.dc.html` in this folder is a structural summary, not the
  literal fetched HTML (no DesignSync access in the verification pass) — re-fetch
  it via `DesignSync get_file` before relying on exact copy/markup from it.
- **Cart** (`sections/brickline-main-cart.liquid`) — has all five checked features:
  age/pieces meta line, discount code field, order-notes textarea, cross-sell grid,
  and a merchant-configurable "Gift with purchase" block. No structural drift.
  One known limitation, not a bug: the discount field redirects to
  `/discount/<code>?redirect=/cart` (`assets/brickline-cart-page.js`) rather than
  showing an inline success/error message, because Liquid can't validate a
  discount code on the cart page — this is a documented Shopify constraint, not
  something to build around in this pass. `Brickline Cart.dc.html` in this folder
  is likewise a structural summary pending a literal re-fetch.
- **Account Details** (`sections/brickline-customer-account.liquid`) — **does not
  exist as an editable page**; see "Blocked / needs a decision" above. This is the
  one real structural gap this verification pass found, not cosmetic drift.
- **Order History** (same section as Account Details — no separate section, as
  already documented) — already used real `order.financial_status`/
  `order.fulfillment_status` for status badges, not mock data. Fixed: added an
  "Items" column (`order.item_count`) and an explicit "View Order" button per row
  (`order.customer_url`) — the design shows both; only the order-number link
  existed before.
- **Order Confirmation** (`sections/brickline-customer-order.liquid`) — line
  items, thumbnails, qty, totals, and shipping-method-in-totals were already
  correct. Fixed: added a "Continue shopping" button at the bottom
  (`routes.all_products_collection_url`), matching the design's closing CTA.
  **Not fixed, needs a product decision:** no green "Order #X confirmed / Thank
  you, {name}!" banner — this section doubles as both the post-checkout
  confirmation and the ordinary order-detail view for old orders, and Liquid has
  no signal for "just came from checkout" to gate a one-time banner correctly.
  Also no card-brand/last-4 payment display ("Visa ending in 4242") — that data
  lives on `order.transactions`, not exposed to storefront Liquid; would need an
  Admin-API-backed proxy, out of scope for a theme-only fix.
- **Search** (`sections/brickline-search.liquid`) — pill search input, live
  results-count text, genuine empty state, 4-column product grid, and popular
  search suggestion pills (via a `suggestion` block type) were all already
  correctly built — no fixes needed. Minor unfixed nuance: suggestions render
  inside the empty-state box rather than as a sibling near the query text like
  the design; cosmetic only, left as-is.
- **Filters Drawer** (`snippets/brickline-filters-drawer.liquid`) — filter
  categories are pulled dynamically from `collection.filters` rather than
  hardcoded, which is correct and better than the design's mock data; no action
  needed there. Fixed real drift: filter group headers had no collapse/expand
  affordance (design shows them as accordions with a chevron). Added
  `data-filter-toggle`/`aria-expanded` buttons, chevron-rotation CSS, and a JS
  toggle handler in `assets/brickline-drawer.js` and `brickline-drawer.css`;
  groups still default to expanded.
- **Sort Drawer** (`snippets/brickline-sort-drawer.liquid`) — radio list bound to
  real `collection.sort_options`/`collection.sort_by`, pinned "Apply" footer, and
  the deliberate absence of "Piece Count"/"Rating" sorts (no metafield-based sort
  config confirmed) all matched the design's intent — no fixes needed. **Known
  gap, not fixed:** the shared `.bl-drawer__panel` class is hardcoded to 380px for
  both Filters and Sort, but the design specifies 340px for Sort specifically.
  Left unfixed since it touches shared drawer infrastructure used by two pages —
  a follow-up modifier class (e.g. `bl-drawer--narrow`) would be the low-risk fix.
