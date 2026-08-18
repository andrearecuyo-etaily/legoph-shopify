/**
 * Bulk-creates products from a Shopify product-export-shaped CSV via the Admin
 * API, bypassing the ~10-row cap the manual Products > Import screen applies to
 * unverified/dev stores. Upserts by handle (productSet), so re-running after
 * fixing a few bad rows does not duplicate the ones that already succeeded.
 *
 * CSV shape: standard Shopify product-export columns. One row per variant;
 * rows sharing a Handle are grouped into one product. See
 * data/shopify-products-import.csv for the columns this reads.
 *
 * Usage:
 *   export SHOPIFY_ADMIN_TOKEN=shpat_...   # write_products
 *   node docs/product-import/bulk-import-products.mjs legoph-gnobvfvh.myshopify.com data/shopify-products-import.csv --dry-run
 *   node docs/product-import/bulk-import-products.mjs legoph-gnobvfvh.myshopify.com data/shopify-products-import.csv
 *
 * See docs/product-import/README.md for the assumptions this makes that have
 * not yet been checked against a live store.
 */

import { readFileSync } from 'node:fs';

const API_VERSION = '2024-10';
const RATE_LIMIT_DELAY_MS = 550; // stays under the 2 req/s Admin API GraphQL default bucket

/* ------------------------------------------------------------------- CSV */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
      continue;
    }

    if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else { field += c; }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function groupByHandle(records) {
  const products = new Map();
  for (const r of records) {
    if (!products.has(r.Handle)) products.set(r.Handle, []);
    products.get(r.Handle).push(r);
  }
  return [...products.values()];
}

const STATUS_MAP = { active: 'ACTIVE', draft: 'DRAFT', archived: 'ARCHIVED' };

function toProductSetInput(rows, locationId) {
  const first = rows[0];
  const hasRealOption = first['Option1 Name'] && first['Option1 Name'] !== 'Title';

  const images = rows
    .filter((r) => r['Image Src'])
    .sort((a, b) => Number(a['Image Position'] || 0) - Number(b['Image Position'] || 0))
    .map((r) => ({ originalSource: r['Image Src'] }));

  const variants = rows.map((r) => ({
    sku: r['Variant SKU'] || undefined,
    price: r['Variant Price'] || undefined,
    compareAtPrice: r['Variant Compare At Price'] || undefined,
    barcode: r['Variant Barcode'] || undefined,
    inventoryPolicy: (r['Variant Inventory Policy'] || 'deny').toUpperCase(),
    inventoryItem: { tracked: r['Variant Inventory Tracker'] === 'shopify' },
    inventoryQuantities: r['Variant Inventory Qty']
      ? [{ locationId, name: 'available', quantity: Number(r['Variant Inventory Qty']) }]
      : undefined,
    optionValues: hasRealOption
      ? [{ optionName: first['Option1 Name'], name: r['Option1 Value'] }]
      : [{ optionName: 'Title', name: 'Default Title' }],
  }));

  // Product metafields the theme already renders — see docs/metafields/README.md.
  // Their definitions must exist on the store first (create-product-metafields.mjs)
  // or productSet silently drops values for keys with no definition.
  const metafields = [
    first.Age && { namespace: 'custom', key: 'age', type: 'single_line_text_field', value: first.Age },
    first.Pieces && { namespace: 'custom', key: 'pieces', type: 'number_integer', value: first.Pieces },
    first.Rating && { namespace: 'custom', key: 'rating', type: 'number_decimal', value: first.Rating },
    first['Rating Count'] && { namespace: 'custom', key: 'rating_count', type: 'number_integer', value: first['Rating Count'] },
  ].filter(Boolean);

  return {
    handle: first.Handle,
    title: first.Title,
    descriptionHtml: first['Body (HTML)'] || undefined,
    vendor: first.Vendor || undefined,
    productType: first.Type || undefined,
    tags: first.Tags ? first.Tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    status: STATUS_MAP[(first.Status || 'draft').toLowerCase()] || 'DRAFT',
    productOptions: hasRealOption
      ? [{ name: first['Option1 Name'], values: [...new Set(rows.map((r) => r['Option1 Value']))].map((name) => ({ name })) }]
      : undefined,
    files: images.length ? images : undefined,
    variants,
    metafields: metafields.length ? metafields : undefined,
  };
}

/* ------------------------------------------------------------- Admin API */

const [shop, csvPath, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
const token = process.env.SHOPIFY_ADMIN_TOKEN;

if (!shop || !csvPath) {
  console.error('Usage: node bulk-import-products.mjs <shop>.myshopify.com <path-to-csv> [--dry-run]');
  process.exit(1);
}
if (!token && !dryRun) {
  console.error('Set SHOPIFY_ADMIN_TOKEN (Admin API token with write_products).');
  process.exit(1);
}

async function admin(query, variables) {
  let res;
  try {
    res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    throw new Error(`could not reach https://${shop} — ${err.message}`);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
  }

  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

async function preflight() {
  try {
    const data = await admin('{ shop { name myshopifyDomain } }');
    console.log(`Connected to ${data.shop.name} (${data.shop.myshopifyDomain})`);
    return true;
  } catch (err) {
    const msg = err.message;
    console.error(`\nCannot talk to the Admin API: ${msg}\n`);
    if (/HTTP 401/.test(msg)) {
      console.error('  401 means the token was rejected. Most often:');
      console.error('   - the app was never Installed after saving its scopes');
      console.error('   - this is a Storefront API token, not an Admin API one (must start shpat_)');
      console.error('   - the token belongs to a different store\n');
    } else if (/HTTP 40[34]/.test(msg)) {
      console.error(`  Check the shop domain. You passed: ${shop}\n`);
    }
    console.error('  Scope needed: write_products\n');
    return false;
  }
}

async function primaryLocationId() {
  const data = await admin('{ locations(first: 1) { nodes { id name } } }');
  const loc = data.locations.nodes[0];
  if (!loc) throw new Error('store has no locations to hold inventory');
  console.log(`Using location "${loc.name}" (${loc.id}) for inventory quantities\n`);
  return loc.id;
}

const M_PRODUCT_SET = `
  mutation($input: ProductSetInput!) {
    productSet(input: $input, synchronous: true) {
      product { id handle title }
      userErrors { field message code }
    }
  }`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const records = parseCsv(readFileSync(csvPath, 'utf8'));
  const products = groupByHandle(records);
  console.log(`${dryRun ? 'Would import' : 'Importing'} ${products.length} product(s) from ${csvPath}\n`);

  if (dryRun) {
    for (const rows of products) {
      const input = toProductSetInput(rows, 'gid://shopify/Location/DRY_RUN');
      const metaCount = (input.metafields || []).length;
      console.log(`  ${input.handle.padEnd(50)} ${input.variants.length} variant(s), ${(input.files || []).length} image(s), ${metaCount} metafield(s)`);
    }
    return;
  }

  if (!(await preflight())) process.exit(1);
  const locationId = await primaryLocationId();

  const tally = { created: 0, failed: 0 };
  for (const rows of products) {
    const input = toProductSetInput(rows, locationId);
    const label = `  ${input.handle.padEnd(50)}`;
    try {
      const data = await admin(M_PRODUCT_SET, { input });
      const { product, userErrors } = data.productSet;
      if (product) {
        tally.created++;
        console.log(`${label} OK   ${product.id}`);
      } else {
        tally.failed++;
        console.log(`${label} FAILED ${userErrors.map((e) => e.message).join('; ')}`);
      }
    } catch (err) {
      tally.failed++;
      console.log(`${label} FAILED ${err.message}`);
    }
    await sleep(RATE_LIMIT_DELAY_MS);
  }

  console.log(`\n${tally.created} created/updated, ${tally.failed} failed\n`);
  process.exit(tally.failed ? 1 : 0);
}

main();
