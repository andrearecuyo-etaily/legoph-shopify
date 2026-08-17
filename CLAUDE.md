# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Shopify theme for LEGO Philippines. The base is Shopify's **Horizon** theme (the
stock `README.md` is Horizon's, not this project's), with a **Brickline** design
layer built on top of it. Brickline files are the project's own work; everything
else is upstream Horizon and should generally be left alone.

The convention is a `brickline-` prefix on every file the project owns —
`sections/brickline-*.liquid`, `assets/brickline-*.{css,js}`,
`snippets/brickline-*.liquid`. An unprefixed file is Horizon's.

## Commands

```bash
shopify theme dev      # local preview at :9292, synced to your development theme
shopify theme check    # lint; this is the only checker configured
shopify theme list     # themes on the store, with roles and ids
```

There is no `package.json`, build step, or test runner. `shopify theme check`
is the whole automated-quality story, and it reports pre-existing offenses in
Horizon files — check whether an offense is in a file you touched before acting
on it.

## The `main` branch is wired to the live store

`main` is two-way synced with the live theme through Shopify's GitHub
integration. `shopify[bot]` commits directly to it ("Update from Shopify for
theme legoph-shopify/main") whenever someone edits in the theme editor, and
pushes to `main` deploy to the storefront.

Work on a branch and let a human merge. Before starting, pull — the bot may have
moved `main` since the last local commit. Never `shopify theme push` to the
`[live]` theme.

## Architecture

### Sections own their assets

Every one of the 40 Brickline sections links its own stylesheets at the top of
the file and its own `type="module"` script at the bottom, rather than relying on
a global bundle. All 40 link `brickline-tokens.css` first — that file holds the
design tokens (brand colours, surfaces, text, spacing, shape) mirrored from the
source design system, and everything else is expressed in terms of them.

When adding a section, follow the same shape: link the tokens file, then the
section's own CSS, then render markup, then load the module.

### JavaScript

ES modules with an import map declared in `snippets/scripts.liquid`, mapping
`@theme/<name>` to the asset URL. A module importing another theme module uses
that bare specifier, so **a new shared module must be registered in the import
map** or it will 404 at runtime.

Behaviour is attached with custom elements (`zap-dashboard`, `brickline-drawer`,
`store-locator`, …) that read `data-*` hooks from the Liquid, so state that
decides *what* renders stays in Liquid and JS only handles what changes after
load.

### Templates

Page templates are `templates/page.<handle>.json` and bind to a Shopify page by
its handle — the page must also exist in the admin or the route 404s. Alternate
product and collection layouts (`product.showcase.json`,
`collection.editorial.json`) are assigned per-resource in the admin.

### Design source

`design/brickline-source/PAGES.md` is the conversion inventory: which designs are
converted, which sections each page uses, and the known blockers. Read it before
building a new page, and update its status list after.

Source designs live in a claude.ai/design project (ids in that file). Re-fetch
exact page HTML with the `DesignSync` tool rather than retyping from memory.

## Two integrations with non-obvious constraints

### ZAP loyalty — the theme never calls ZAP

`docs/zap-app-proxy-contract.md` is the authoritative spec; read it before
touching anything ZAP.

The rewards page talks only to a Shopify **App Proxy** at `/apps/zap/*`, which
forwards to an endpoint holding the ZAP credentials. It cannot call the Partner
API directly: the `Authorization: Bearer` token would be readable in page source,
and Earn Points takes only a mobile number and an amount, so a leaked token mints
points to any number.

Consequences worth knowing before changing this code:

- **The browser never sends a mobile number except at enrolment.** Shopify signs
  each proxy request with `logged_in_customer_id`; the endpoint resolves the
  linked number from a customer metafield. Anything else lets a shopper read a
  stranger's balance.
- **Nothing from the browser is trusted for value.** Redemptions are re-validated
  server-side against a fresh ZAP balance.
- **Which state renders is decided in Liquid**, from `customer.zap.enrolled_at`,
  so there is no flash of the wrong state. Only live figures are fetched client-side.
- **The proxy is not deployed.** Every call 404s to the storefront's HTML page,
  which the client treats as `not_configured` — it says so and disables the
  actions rather than showing a fake zero balance. Preserve that: failing
  honestly is the designed behaviour, not a gap.

`docs/zap-proxy-stub/` holds a reference worker with a `MOCK=1` mode that serves
canned data, plus a README describing the three levels of testing and the
assumptions still unconfirmed against ZAP staging. `docs/` is in `.shopifyignore`,
so nothing there uploads to the store.

### Wishlist — per-browser only

Product ids live in `localStorage` under `brickline_wishlist`.
`assets/brickline-wishlist.js` owns every read and write and fires
`brickline:wishlist:change`; nothing else touches storage directly. The page
turns ids back into cards by asking the search route to render its own section,
so pricing and availability stay server-rendered.

Making it follow a shopper across devices needs a customer metafield, which this
store cannot write from the theme (see below). `WishlistStore` is the only module
that would change.

## Classic customer accounts

The store is on **classic** customer accounts, not the new Customer Account API.
So there is no Customer Account API, and the Storefront API cannot write customer
metafields. Any feature needing per-customer server-side state requires a hosted
endpoint behind an App Proxy with an Admin API token — it cannot be done from the
theme. This constraint is what shapes both integrations above.

Customer-facing account pages are `templates/customers/*.liquid`.

## Uploads

Shopify only accepts `assets`, `blocks`, `config`, `layout`, `locales`,
`sections`, `snippets` and `templates`. `.shopifyignore` excludes `design/` and
`docs/` for that reason, along with transient files the CLI writes mid-sync. A
new top-level directory needs a `.shopifyignore` entry or the sync will fail.
