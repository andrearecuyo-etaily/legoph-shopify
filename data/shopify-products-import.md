# LEGO Philippines — Shopify Product Import

627 products imported live via `scripts/shopify-import-products.js`, built from
`data/shopify-import-lego-merged.csv`.

## Source

- **Spine (identity/schema):** `data/shopify-products-lego-catalog.csv` — 798 products,
  correct SKU/Barcode orientation, Age/Pieces/Rating.
- **Enrichment (images/tags/weight):** `data/[LEGO] Shopify Listing Automated Template -
  PLEASE MAKE A COPY (2026) - For Upload.csv` — 627 products, joined by LEGO set number
  (`spine["Variant SKU"] === template["Variant Barcode"]`).
- Merge script: `scripts/merge-lego-import.js`. Output: `data/shopify-import-lego-merged.csv`
  (only the 627 products present in the template file were carried forward — the 171
  catalog-only products with no template match were excluded, per instruction to follow
  the template file's product count).

## Result

- **627 / 627 products confirmed live** (verified via `scripts/shopify-verify-import.js`
  and, for handle-collision cases, `scripts/shopify-find-by-sku.js`).
  - 617 landed at their exact expected handle.
  - 10 landed under a `-1` suffixed handle because a pre-existing product (from an
    earlier, separate "700+ sku file" import) already occupied that exact handle.
    These 10 duplicate pairs are being reconciled via
    `scripts/shopify-resolve-duplicates.js` (keep the new, fuller-data product;
    delete the old one).
- Full per-handle result: `data/shopify-import-log.csv` (most recent run only —
  overwritten each run) and `data/shopify-verify-log.csv` (live-vs-CSV comparison).

## SKUs with missing images

30 image URLs (positions 9–11, i.e. extra detail/lifestyle shots — not the primary
photo) were excluded from the import because they point to a private S3 bucket that
returns `403 Forbidden`:

```
https://etaily-files.s3.amazonaws.com/Marketplace-Images/<Titan|NBA>/2026/march/<set>/<9|10|11>.png
```

Every affected product still has at least one working image from `slatic.net`, so
none of these 10 shipped without a photo — they're just missing their last 3 detail shots.

| SKU (Set #) | Product |
|---|---|
| 77243 | LEGO Speed Champions 77243 Oracle Red Bull Racing RB20 F1 Race Car |
| 10328 | LEGO Icons 10328 Bouquet of Roses |
| 77242 | LEGO Speed Champions 77242 Ferrari SF-24 F1 Race Car |
| 77255 | LEGO Speed Champions 77255 Lightning McQueen |
| 77244 | LEGO Speed Champions 77244 Mercedes-AMG F1 W15 Race Car |
| 77256 | LEGO Speed Champions 77256 Time Machine from Back to the Future |
| 77241 | LEGO Speed Champions 77241 2 Fast 2 Furious Honda S2000 |
| 77252 | LEGO Speed Champions 77252 APXGP Team Race Car from F1 The Movie |
| 76917 | LEGO Speed Champions 76917 2 Fast 2 Furious Nissan Skyline GT-R (R34) |
| 11508 | LEGO Botanicals 11508 Daisies |

If the S3 bucket path above is made public (or the images are re-hosted somewhere
reachable), the remaining 30 images can be backfilled onto these 10 products.

## Related

- Collections: `data/shopify-collections.md`
