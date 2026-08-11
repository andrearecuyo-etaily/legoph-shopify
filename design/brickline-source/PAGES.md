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
- [ ] Wishlist, Checkout — see note below

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
file. `Account Details`, `Addresses`, `Order History` and `Order Confirmation` were
built against the Shopify `customer` / `order` object model in the established
Brickline visual language — worth a pass against those four design files before
sign-off.

**Wishlist.** Shopify has no native wishlist. Delivering this needs either an app
(Wishlist Plus, Swym) whose markup we'd theme, or a custom implementation backed by
customer metafields plus an App Proxy. The wishlist heart on the product cards is
presentational only today — it toggles for the life of the page and persists nothing.

**Checkout.** Not themeable outside Shopify Plus. On non-Plus plans the design can
only be approximated through the checkout branding settings in admin.
