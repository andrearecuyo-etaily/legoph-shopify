# Bulk product import

The Products > Import screen in admin caps unverified/dev stores at roughly 10
rows per CSV. `bulk-import-products.mjs` reads the same CSV shape but pushes
each product straight through the Admin API's `productSet` mutation, which has
no such cap. It upserts by `handle`, so re-running after fixing a few bad rows
does not duplicate the ones that already succeeded.

```bash
export SHOPIFY_ADMIN_TOKEN=shpat_...   # write_products
node docs/product-import/bulk-import-products.mjs legoph-gnobvfvh.myshopify.com data/shopify-products-import.csv --dry-run
node docs/product-import/bulk-import-products.mjs legoph-gnobvfvh.myshopify.com data/shopify-products-import.csv
```

`--dry-run` needs no token — it just parses the CSV and prints what would be
sent, one line per product, so a bad row shows up before anything is created.

## CSV shape

`product-import-template.csv` is the file to hand to whoever is compiling the
600+ SKUs — it has the header row and one filled-in example. One row per
variant; rows sharing a `Handle` are grouped into one product. `Option1
Name`/`Option1 Value` left as `Title`/`Default Title` means no real option —
the product gets Shopify's default variant.

It's a trimmed subset of Shopify's full export format, not the full thing —
enough for what the theme actually uses, plus four extra columns
(`Age`, `Pieces`, `Rating`, `Rating Count`) that aren't in Shopify's standard
export at all. Those four map to the `custom.*` product metafields the PDP,
cards and cart already render (see `docs/metafields/README.md`) — worth
getting filled in at the same time as the base product data rather than as a
separate pass later. **The metafield definitions must already exist on the
store** (`node docs/metafields/create-product-metafields.mjs <shop>`) before
running the import, or `productSet` silently drops values for keys with no
definition.

`data/shopify-products-import.csv` is the original 9-row sample without the
metafield columns — still valid input, just without age/pieces/rating.

## Getting the token

**Settings → Apps and sales channels → Develop apps → Create an app** on the
dev store, give it the `write_products` scope, install it, and copy the Admin
API access token (`shpat_...`). This is separate from any Storefront API
token the theme uses.

## Not yet verified

Nothing here has run against a real store yet. Before the first real (non
`--dry-run`) run, check these against the store:

- **`productSet`'s exact input shape** for this API version (`2024-10`) —
  particularly the `files` field for images and `optionValues` for variants.
  If a mutation comes back with a `userErrors` entry naming a field, that
  field's shape is the thing to fix.
- **Inventory location.** The script queries `locations(first: 1)` and puts
  every SKU's stock there. Fine for a single-location store; if the real
  store has more than one location, decide which one should receive initial
  stock before running for real.
- **Rate limiting.** The script sleeps 550ms between products, which is
  conservative for the standard Admin API GraphQL bucket. A large batch (600+)
  will take a while — that's expected, not a hang.

## Why not just ask Shopify to lift the CSV cap?

Also worth doing in parallel — support can usually lift it same-day, and
that's the simpler path if the API route hits schema surprises. This script
exists so the 600+ SKU push doesn't have to wait on that ticket, and so future
large catalog updates (new set waves, price changes) don't need it lifted
again each time.
