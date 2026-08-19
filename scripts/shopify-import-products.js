#!/usr/bin/env node
/**
 * Import data/shopify-import-lego-merged.csv into Shopify via the Admin REST API.
 *
 * Usage:
 *   SHOPIFY_STORE=your-store.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *     node scripts/shopify-import-products.js                # dry run, all products
 *   ... node scripts/shopify-import-products.js --limit 10    # dry run, first 10
 *   ... node scripts/shopify-import-products.js --limit 10 --live   # actually create 10
 *   ... node scripts/shopify-import-products.js --live              # actually create all 627
 *
 * Flags:
 *   --file <path>          CSV to import (default: data/shopify-import-lego-merged.csv)
 *   --store <domain>       overrides SHOPIFY_STORE env var
 *   --token <token>        overrides SHOPIFY_ADMIN_TOKEN env var
 *   --api-version <ver>    default 2025-01
 *   --limit <n>            only process the first n products
 *   --live                 actually call the API (default is dry run / print only)
 *   --resume-from <path>   skip handles already marked "created" in a prior log
 *
 * Writes a log of created product ids / errors to data/shopify-import-log.csv.
 * Re-run with --resume-from data/shopify-import-log.csv to continue after a
 * partial failure without recreating products that already succeeded.
 */

const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { live: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') out.live = true;
    else if (a === '--file') out.file = argv[++i];
    else if (a === '--store') out.store = argv[++i];
    else if (a === '--token') out.token = argv[++i];
    else if (a === '--api-version') out.apiVersion = argv[++i];
    else if (a === '--limit') out.limit = parseInt(argv[++i], 10);
    else if (a === '--resume-from') out.resumeFrom = argv[++i];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

const FILE = path.resolve(ROOT, args.file || 'data/shopify-import-lego-merged.csv');
const STORE = args.store || process.env.SHOPIFY_STORE;
const TOKEN = args.token || process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = args.apiVersion || '2025-01';
const LOG = path.join(ROOT, 'data/shopify-import-log.csv');

if (!STORE || !TOKEN) {
  console.error('Missing store or token. Set SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN env vars, or pass --store/--token.');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
      continue;
    }
    if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// ---------------------------------------------------------------- group rows into products
const rows = parseCsv(readFileSync(FILE, 'utf8'));
const products = [];
let current = null;

for (const r of rows) {
  const isMainRow = r.Title && r.Title.trim() !== '';
  if (isMainRow) {
    current = { row: r, images: [] };
    if (r['Image Src']) {
      current.images.push({ src: r['Image Src'], position: Number(r['Image Position']) || 1, alt: r['Image Alt Text'] || r.Title });
    }
    products.push(current);
  } else if (current && r['Image Src']) {
    current.images.push({ src: r['Image Src'], position: Number(r['Image Position']) || (current.images.length + 1), alt: r['Image Alt Text'] || current.row.Title });
  }
}

let toProcess = products;
if (args.resumeFrom) {
  const prior = parseCsv(readFileSync(path.resolve(ROOT, args.resumeFrom), 'utf8'));
  const done = new Set(prior.filter(r => r.status === 'created').map(r => r.handle));
  const before = toProcess.length;
  toProcess = toProcess.filter(p => !done.has(p.row.Handle));
  console.log(`resume: skipping ${before - toProcess.length} already-created handle(s) from ${args.resumeFrom}`);
}
if (args.limit) toProcess = toProcess.slice(0, args.limit);

// ---------------------------------------------------------------- build Admin API payload
function buildPayload(p) {
  const r = p.row;
  const metafields = [];
  if (r.Age) metafields.push({ namespace: 'custom', key: 'age', type: 'single_line_text_field', value: r.Age });
  if (r.Pieces) metafields.push({ namespace: 'custom', key: 'pieces', type: 'number_integer', value: r.Pieces });
  if (r.Rating) metafields.push({ namespace: 'custom', key: 'rating', type: 'number_decimal', value: r.Rating });
  if (r['Rating Count']) metafields.push({ namespace: 'custom', key: 'rating_count', type: 'number_integer', value: r['Rating Count'] });

  return {
    product: {
      title: r.Title,
      body_html: r['Body (HTML)'],
      vendor: r.Vendor,
      product_type: r.Type,
      tags: r.Tags,
      status: (r.Status || 'active').toLowerCase(),
      handle: r.Handle,
      options: [{ name: r['Option1 Name'] || 'Title' }],
      variants: [{
        option1: r['Option1 Value'] || 'Default Title',
        sku: r['Variant SKU'],
        barcode: r['Variant Barcode'],
        price: r['Variant Price'],
        compare_at_price: r['Variant Compare At Price'] || null,
        inventory_management: r['Variant Inventory Tracker'] || 'shopify',
        inventory_policy: r['Variant Inventory Policy'] || 'deny',
        inventory_quantity: parseInt(r['Variant Inventory Qty'], 10) || 0,
        fulfillment_service: r['Variant Fulfillment Service'] || 'manual',
        weight: r['Variant Grams'] ? Number(r['Variant Grams']) : undefined,
        weight_unit: r['Variant Grams'] ? 'g' : undefined,
        requires_shipping: (r['Variant Requires Shipping'] || 'TRUE').toUpperCase() === 'TRUE',
        taxable: (r['Variant Taxable'] || 'TRUE').toUpperCase() === 'TRUE',
      }],
      images: p.images.map(img => ({ src: img.src, position: img.position, alt: img.alt })),
      metafields,
    },
  };
}

// ---------------------------------------------------------------- API call with basic rate-limit handling
const ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/products.json`;

async function createProduct(payload, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  let res;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // image downloads can be slow
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': TOKEN,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    // network-level failure (connection reset, timeout, DNS, etc.) — retry with backoff
    if (attempt < MAX_ATTEMPTS) {
      const delay = 2000 * attempt;
      console.warn(`  network error (${err.cause?.code || err.cause?.message || err.message}), retrying in ${delay}ms [attempt ${attempt}/${MAX_ATTEMPTS}]`);
      await new Promise(r => setTimeout(r, delay));
      return createProduct(payload, attempt + 1);
    }
    const cause = err.cause ? ` (cause: ${err.cause.code || err.cause.message || err.cause})` : '';
    throw new Error(`${err.message}${cause}`);
  }

  if (res.status === 429 && attempt < MAX_ATTEMPTS) {
    const retryAfter = parseFloat(res.headers.get('Retry-After') || '2');
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return createProduct(payload, attempt + 1);
  }

  if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
    await new Promise(r => setTimeout(r, 2000 * attempt));
    return createProduct(payload, attempt + 1);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body.errors || body)}`);
  }
  return body.product;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- run
(async () => {
  console.log(`${args.live ? 'LIVE IMPORT' : 'DRY RUN'} — ${toProcess.length} product(s) from ${path.relative(ROOT, FILE)}`);
  console.log(`store: ${STORE}  api: ${API_VERSION}`);
  console.log('');

  const log = [['handle', 'status', 'product_id', 'error']];
  let ok = 0, failed = 0;

  for (const [i, p] of toProcess.entries()) {
    const handle = p.row.Handle;
    const payload = buildPayload(p);

    if (!args.live) {
      console.log(`[${i + 1}/${toProcess.length}] would create: ${handle} (${p.images.length} image(s), sku=${p.row['Variant SKU']})`);
      log.push([handle, 'dry-run', '', '']);
      continue;
    }

    try {
      const product = await createProduct(payload);
      console.log(`[${i + 1}/${toProcess.length}] created: ${handle} -> id ${product.id}`);
      log.push([handle, 'created', product.id, '']);
      ok++;
    } catch (err) {
      console.error(`[${i + 1}/${toProcess.length}] FAILED: ${handle} -> ${err.message}`);
      log.push([handle, 'error', '', err.message.replace(/[\n,]/g, ' ')]);
      failed++;
    }

    // Standard Admin API REST limit is ~2 req/sec — stay comfortably under it.
    await sleep(600);
  }

  writeFileSync(LOG, log.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n', 'utf8');
  console.log('');
  console.log(`log written to ${path.relative(ROOT, LOG)}`);
  if (args.live) console.log(`done: ${ok} created, ${failed} failed`);
  else console.log('this was a dry run — nothing was created. Re-run with --live to actually import.');
})();
