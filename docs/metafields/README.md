# Product metafields

Run `create-product-metafields.mjs` once per store. It is idempotent.

```bash
export SHOPIFY_ADMIN_TOKEN=shpat_...      # write_products, write_metaobject_definitions
node docs/metafields/create-product-metafields.mjs legoph-gnobvfvh.myshopify.com --dry-run
node docs/metafields/create-product-metafields.mjs legoph-gnobvfvh.myshopify.com
```

## Two groups, two reasons

### Already rendered by the theme

`brickline-product-main`, `brickline-product-card` and `brickline-main-cart`
have always read these. Without definitions they cannot be filled in from the
product admin, so the rating stars and the "Ages · Pieces" row render empty.

| Metafield | Type | Where it shows |
|---|---|---|
| `custom.age` | Single line text | `18+ Ages` on the PDP, `18+` on cards and cart lines |
| `custom.pieces` | Integer | `2354 Pieces` on the PDP, `2354 pcs` elsewhere |
| `custom.rating` | Decimal | Fills the stars — the theme does `rating \| round` |
| `custom.rating_count` | Integer | The number in brackets after the stars |

`age` is **text, not a number**, because values look like `18+`. `rating` is a
plain decimal, not Shopify's `rating` type — that type is an object, and the
theme's `| round` would not work on it.

### Just the pictures — no metaobjects needed

If the copy on the template is fine and only the images differ per product, these
three are the whole job. Each is an ordered list of image files, so they take
about two minutes to create by hand — **Settings → Custom data → Products → Add
definition**, type **File**, tick **List of files**, and limit to images.

| Metafield | Fills |
|---|---|
| `custom.band_images` | Feature band pictures, by band position — position 1 takes the first |
| `custom.story_images` | Editorial grid tiles, in order |
| `custom.swatch_images` | Circle grid pictures, in order |

Then set **Band position** on each feature band and upload the images on the
product. Nothing else is required — no metaobjects, no script.

### Per-product page content

There are three product templates (`product`, `product.showcase`,
`product.cinematic`), and the showcase and cinematic ones carried their copy in
**section settings**. Section settings live in the template JSON, so every
product assigned that template shared the same copy — `product.showcase` said
"Bursting with blooms" for whatever product used it.

These metaobjects move that copy onto the product:

| Metaobject | Fields | Rendered by |
|---|---|---|
| `product_story_band` | heading, eyebrow, body, image, button label/link, background and text colour | `brickline-feature-band` |
| `product_story_card` | title, subtitle, image, button label/link | `brickline-editorial-grid` |
| `product_swatch` | label, colour, image, link | `brickline-circle-grid` |

Each is referenced from an ordered list on the product: `custom.story_bands`,
`custom.story_cards`, `custom.swatches`.

Use these when the *copy* differs per product too. If only the pictures differ,
the image lists above are simpler and the sections read both.

Where several sources could supply the same picture, the most specific wins:
the story band metaobject, then the product's image list, then the section's own
Image setting, then the fallback. Per-product beats the section setting because
that one is shared by every product on the template.

**Metaobjects hold content; section settings keep design.** Layout, image ratio,
column counts and padding stay in the section, because they belong to the
template. A story band can override background and text colour, since those
sometimes belong to the content.

## Wiring a template

**Feature band** — set **Band position** to `1` for the first band on the page,
`2` for the second, and so on. `0` keeps the section's own settings, which is
what every non-product template uses.

**Editorial grid** — tick **Use the product's story cards**.

**Circle grid** — tick **Use the product's swatches**.

All three fall back to section settings when the product's list is empty, and
the feature band falls back field by field: a story band that sets only a
heading inherits the section's image, body and button. So turning this on cannot
blank out a page — an unconfigured product renders exactly what it does today.

## Filling it in

1. **Content → Metaobjects → Product story band → Add entry.** One entry per band.
2. **Products → the product → Metafields → Story bands**, and add the entries in
   the order they should appear.
3. On the template, set Band position on each feature band section.

Existing copy in `product.showcase.json` and `product.cinematic.json` is
untouched, so migrate one product at a time and compare.

## Not yet verified

Nothing here has run against a real store. Two things to watch on the first run:

- **The script's `access` and `capabilities` inputs** are written against Admin
  API `2024-10`. If the mutation rejects either, the error names the field.
- **The Liquid metaobject accessors.** Sections read `item.title.value` for text
  and `item.image.value` for images, with rich text rendered directly as
  `band.body`. If a field comes out empty on the first product, that accessor is
  the thing to check.

## A note on images

A section's `image_picker` gives a plain `image`. A metaobject `file_reference`
gives a **`media_image`**, which wraps one. `image_url`, `alt`, `width` and
`height` do not work the same on both, so all three sections unwrap it:

```liquid
if card_image.image != blank
  assign card_image = card_image.image
endif
```

A plain `image` has no `.image`, so it passes through untouched — one line
handles both sources. Remember this when wiring a metaobject image into any
other section. A third shape exists too: `product.media[n]` is a *media* object,
where the plain image is `.preview_image`.

Where a merchant adds one: **Content → Metaobjects → Product story band →
*(entry)* → Image**, then link the entry under **Products → *product* →
Metafields → Story bands**.

Metaobject entries are standalone records, not owned by a product. Two products
referencing the same story band share it, so editing that band's image changes
both. Useful for something like a shared shipping-promise band; surprising
otherwise. Give each product its own entries unless the sharing is wanted.

The feature band also has **Image when the band has none**, used only when
neither the story band nor the section has one:

| Option | Result |
|---|---|
| Leave empty | An empty box — the clearest "not filled in yet" signal |
| The product's main photo | `product.featured_image` |
| The product's gallery, by band position | Band 1 takes the second photo, band 2 the third, so no two bands repeat a shot |

`product.showcase` and `product.cinematic` are set to **the product's main
photo**.

## Never type Liquid into an image field

A section setting is stored **verbatim and never evaluated**. Putting
`{{ product.featured_image }}` into an Image field in the theme editor does not
resolve to the product's photo — the section receives that text as a string.
It was tried on both product templates and had to be undone; use the setting
above instead.

All three sections now discard an image value that has no dimensions, so a
repeat of that mistake renders an empty box rather than a broken one.

None of the product templates currently set a section image, so before this
change the bands and grids on `product.showcase` and `product.cinematic`
rendered empty placeholder boxes. Filling in a product's story bands is what
puts pictures there.

`brickline-product-specs` is the exception and needs nothing: it already falls
back to `product.description` and to the product's second image, so it has
always been per-product. Only its two tag chips are template-shared — those
could come from `product.tags` if that ever matters.
