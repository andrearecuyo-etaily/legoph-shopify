#!/usr/bin/env node
/**
 * Resolve the 10 SKU pairs where a pre-existing product (from an earlier import)
 * collided on handle with a product created by shopify-import-products.js, so
 * Shopify auto-suffixed the new one with "-1". Both are live right now.
 *
 * This script finds the OLD product (at the original, un-suffixed handle) for
 * each of the 10 base handles below, prints a side-by-side comparison against
 * the NEW product (found by SKU), and — only with --live — deletes the OLD one,
 * keeping the NEW product (richer data: images, tags, Age/Pieces/Rating from
 * this import) as the sole listing for that SKU.
 *
 * Usage:
 *   SHOPIFY_STORE=... SHOPIFY_ADMIN_TOKEN=... node scripts/shopify-resolve-duplicates.js          # dry run
 *   ... node scripts/shopify-resolve-duplicates.js --live                                          # actually delete the old ones
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2025-01';

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE / SHOPIFY_ADMIN_TOKEN env vars.');
  process.exit(1);
}

// sku -> base handle (the exact handle from data/shopify-import-lego-merged.csv, no "-1")
const PAIRS = [
  ['77243', 'lego-77243-lego-speed-champions-77243-oracle-red-bull-racing-rb20-f1-race-car-age-18-building-blocks-2025-251pcs'],
  ['10328', 'lego-10328-lego-icons-10328-bouquet-of-roses-age-18-building-blocks-2023-822pcs'],
  ['77242', 'lego-77242-lego-speed-champions-77242-ferrari-sf-24-f1-race-car-age-10-building-blocks-2025-275pcs'],
  ['77255', 'lego-77255-lego-speed-champions-77255-lightning-mcqueen-270-pieces-building-blocks'],
  ['77244', 'lego-77244-lego-speed-champions-77244-mercedes-amg-f1-w15-race-car-age-10-building-blocks-2025-267pcs'],
  ['77256', 'lego-77256-lego-speed-champions-77256-time-machine-from-back-to-the-future-357-pieces-building-blocks'],
  ['77241', 'lego-77241-lego-speed-champions-77241-2-fast-2-furious-honda-s2000-age-9-building-blocks-2025-300pcs'],
  ['77252', 'lego-77252-lego-speed-champions-77252-apxgp-team-race-car-from-f1-the-movie-268-pieces-building-blocks'],
  ['76917', 'lego-76917-lego-speed-champions-76917-2-fast-2-furious-nissan-skyline-gt-r-r34-age-9-building-blocks-2023-319pcs'],
  ['11508', 'lego-11508-lego-botanicals-11508-daisies-133-pieces-building-blocks'],
];

const GRAPHQL_ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;
const REST_ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}`;

async function gql(query, variables) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(JSON.stringify(body.errors || body));
  return body.data;
}

// GraphQL's `query:` search string tokenizes on hyphens, which breaks exact
// matches against our handles (they're full of hyphens) — use REST's exact
// ?handle= filter instead, which does a literal match.
async function findByHandleExact(handle) {
  const url = `${REST_ENDPOINT}/products.json?handle=${encodeURIComponent(handle)}&limit=5`;
  const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const body = await res.json();
  return body.products.find(p => p.handle === handle) || null;
}

const FIND_BY_SKU = `
  query FindBySku($q: String!) {
    productVariants(first: 5, query: $q) {
      nodes {
        sku
        product {
          id handle title status vendor tags
          images(first: 1) { nodes { url } }
        }
      }
    }
  }
`;

const DELETE_PRODUCT = `
  mutation DeleteProduct($id: ID!) {
    productDelete(input: { id: $id }) {
      deletedProductId
      userErrors { field message }
    }
  }
`;

function summarizeRest(p) {
  const v = p.variants[0] || {};
  return `id=gid://shopify/Product/${p.id}\n    handle="${p.handle}"\n    title="${p.title}"\n    status=${p.status} vendor=${p.vendor}\n    tags="${p.tags}"\n    image=${p.images[0]?.src || '(none)'}\n    sku=${v.sku || '(n/a)'} price=${v.price || '(n/a)'}`;
}

function summarizeGql(p, sku) {
  return `id=${p.id}\n    handle="${p.handle}"\n    title="${p.title}"\n    status=${p.status} vendor=${p.vendor}\n    tags="${p.tags.join(', ')}"\n    image=${p.images.nodes[0]?.url || '(none)'}\n    sku=${sku || '(n/a)'}`;
}

(async () => {
  console.log(`${LIVE ? 'LIVE' : 'DRY RUN'} — resolving ${PAIRS.length} duplicate pair(s) on ${STORE}`);
  console.log('');

  const toDelete = [];

  for (const [sku, baseHandle] of PAIRS) {
    const [oldProduct, bySku] = await Promise.all([
      findByHandleExact(baseHandle),
      gql(FIND_BY_SKU, { q: `sku:${sku}` }),
    ]);

    const newVariant = bySku.productVariants.nodes.find(v => v.product.handle === `${baseHandle}-1`);

    console.log(`SKU ${sku}`);
    if (oldProduct) {
      console.log(`  OLD (to delete): ${summarizeRest(oldProduct)}`);
    } else {
      console.log(`  OLD: not found at handle "${baseHandle}" — nothing to delete for this SKU.`);
    }
    if (newVariant) {
      console.log(`  NEW (keeping):   ${summarizeGql(newVariant.product, newVariant.sku)}`);
    } else {
      console.log(`  NEW: not found at handle "${baseHandle}-1" — unexpected, skipping.`);
    }
    console.log('');

    if (oldProduct && newVariant) toDelete.push({ sku, id: `gid://shopify/Product/${oldProduct.id}`, handle: oldProduct.handle });
  }

  console.log(`${toDelete.length} old product(s) identified for deletion.`);

  if (!LIVE) {
    console.log('\ndry run — nothing was deleted. Review the comparison above, then re-run with --live to delete the OLD products.');
    return;
  }

  for (const d of toDelete) {
    const res = await gql(DELETE_PRODUCT, { id: d.id });
    const errs = res.productDelete.userErrors;
    if (errs.length) {
      console.error(`SKU ${d.sku}: FAILED to delete ${d.id} -> ${JSON.stringify(errs)}`);
    } else {
      console.log(`SKU ${d.sku}: deleted ${res.productDelete.deletedProductId} (was "${d.handle}")`);
    }
    await new Promise(r => setTimeout(r, 600));
  }
})();
