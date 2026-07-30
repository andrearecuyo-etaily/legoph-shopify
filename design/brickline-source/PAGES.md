# Brickline design source — page inventory

Source: claude.ai/design project "Brickline" (project id `9f82ee07-e112-4819-bc56-44c8edf43dae`), design system `_ds/brickline-design-system-67f79e5c-1110-42bb-80fb-cf1887de56da`.

Full page HTML was shared in chat on 2026-07-31 for every page below. Only the homepage is saved verbatim in this folder (`Brickline Home.dc.html`) since that's the only one being converted right now. When we're ready to build the others, re-fetch the exact same content via the `DesignSync` tool (`get_file` on `design_handoff_brickline_shopify/pages/<Page Name>.dc.html`) against this same project id — don't hand-retype from memory.

Design tokens are saved in `tokens/` (colors, typography, shape, spacing) — same tokens apply to every page below.

## Status

- [x] Home — converted to Shopify (`sections/brickline-header.liquid`, `brickline-footer.liquid`, `hero-slider.liquid`, `category-tiles.liquid`, `product-rail.liquid`, `promo-banner.liquid`, `feature-grid.liquid`, `newsletter-band.liquid`, wired via `templates/index.json`)
- [ ] All other pages below — not started

## Pages available in the source project (not yet converted)

- Accessibility Statement
- Brickline 404
- Brickline About Us
- Brickline Account Details
- Brickline Account
- Brickline Addresses
- Brickline Cart Drawer
- Brickline Cart
- Brickline Checkout
- Brickline Collection 1
- Brickline Collection 2
- Brickline Collections
- Brickline Coming Soon
- Brickline Contact Us
- Brickline FAQs
- Brickline Filters Drawer
- Brickline Loyalty
- Brickline Order Confirmation
- Brickline Order History
- Brickline Our Stores
- Brickline Privacy Policy
- Brickline Product 1
- Brickline Product 2
- Brickline Product 3
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
