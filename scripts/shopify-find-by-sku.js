#!/usr/bin/env node
/**
 * Look up store products by variant SKU (set number), regardless of handle.
 * Useful when a handle-based check reports "missing" but the product may
 * actually exist under a different (auto-suffixed) handle due to a collision
 * with a pre-existing product.
 *
 * Usage:
 *   SHOPIFY_STORE=... SHOPIFY_ADMIN_TOKEN=... node scripts/shopify-find-by-sku.js 77243 10328 ...
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const skus = process.argv.slice(2).filter(a => !a.startsWith('--'));
const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2025-01';

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE / SHOPIFY_ADMIN_TOKEN env vars.');
  process.exit(1);
}
if (!skus.length) {
  console.error('Usage: node scripts/shopify-find-by-sku.js <sku1> <sku2> ...');
  process.exit(1);
}

const ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

async function gql(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(JSON.stringify(body.errors || body));
  return body.data;
}

const QUERY = `
  query FindBySku($q: String!) {
    productVariants(first: 5, query: $q) {
      nodes {
        sku
        product { id handle title status vendor }
      }
    }
  }
`;

(async () => {
  for (const sku of skus) {
    const data = await gql(QUERY, { q: `sku:${sku}` });
    const nodes = data.productVariants.nodes;
    if (!nodes.length) {
      console.log(`SKU ${sku}: not found anywhere in store`);
    } else {
      for (const n of nodes) {
        console.log(`SKU ${sku}: FOUND -> handle="${n.product.handle}" title="${n.product.title}" status=${n.product.status} vendor=${n.product.vendor} id=${n.product.id}`);
      }
    }
  }
})();
