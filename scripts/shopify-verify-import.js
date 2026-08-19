#!/usr/bin/env node
/**
 * Confirm what's actually live in Shopify vs. data/shopify-import-lego-merged.csv,
 * by querying the Admin REST API directly (not the local import log, which only
 * reflects what a prior run attempted).
 *
 * Usage:
 *   SHOPIFY_STORE=your-store.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *     node scripts/shopify-verify-import.js
 *
 * Flags:
 *   --file <path>          CSV to compare against (default: data/shopify-import-lego-merged.csv)
 *   --store <domain>       overrides SHOPIFY_STORE env var
 *   --token <token>        overrides SHOPIFY_ADMIN_TOKEN env var
 *   --api-version <ver>    default 2025-01
 *   --vendor <name>        filter store-side product list by vendor (default: LEGO)
 *
 * Writes data/shopify-verify-log.csv listing, for every handle in the CSV,
 * whether it was found live in the store.
 */

const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a === '--store') out.store = argv[++i];
    else if (a === '--token') out.token = argv[++i];
    else if (a === '--api-version') out.apiVersion = argv[++i];
    else if (a === '--vendor') out.vendor = argv[++i];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

const FILE = path.resolve(ROOT, args.file || 'data/shopify-import-lego-merged.csv');
const STORE = args.store || process.env.SHOPIFY_STORE;
const TOKEN = args.token || process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = args.apiVersion || '2025-01';
// Default: no vendor filter. The CSV spans 4 vendor values (LEGO, LEGO D2C,
// LEGO LEL, GROWN UP LEGO BAGS) — filtering the store side to just "LEGO"
// undercounts and makes the other 3 vendors' products look "missing".
const VENDOR = args.vendor ?? '';
const OUT_LOG = path.join(ROOT, 'data/shopify-verify-log.csv');

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

// ---------------------------------------------------------------- CSV handles (source of truth for "what should exist")
const rows = parseCsv(readFileSync(FILE, 'utf8'));
const csvHandles = new Set(rows.filter(r => r.Title && r.Title.trim() !== '').map(r => r.Handle));

// ---------------------------------------------------------------- page through the store's actual product list
async function fetchAllHandles() {
  const found = new Set();
  let url = `https://${STORE}/admin/api/${API_VERSION}/products.json?limit=250&fields=id,handle,vendor` +
    (VENDOR ? `&vendor=${encodeURIComponent(VENDOR)}` : '');

  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} fetching ${url}: ${body}`);
    }
    const body = await res.json();
    for (const p of body.products) found.add(p.handle);

    const link = res.headers.get('Link') || res.headers.get('link');
    const next = link && link.split(',').find(part => part.includes('rel="next"'));
    url = next ? next.split(';')[0].trim().replace(/^<|>$/g, '') : null;

    process.stdout.write(`\rfetched ${found.size} product(s) from store so far...`);
  }
  process.stdout.write('\n');
  return found;
}

(async () => {
  console.log(`store: ${STORE}  api: ${API_VERSION}  vendor filter: ${VENDOR || '(none — all vendors)'}`);
  console.log(`comparing against ${csvHandles.size} handle(s) in ${path.relative(ROOT, FILE)}`);
  console.log('');

  const storeHandles = await fetchAllHandles();

  const missing = [...csvHandles].filter(h => !storeHandles.has(h));
  const matched = csvHandles.size - missing.length;
  const extra = [...storeHandles].filter(h => !csvHandles.has(h)); // live but not in this CSV

  console.log('');
  console.log(`CSV handles:        ${csvHandles.size}`);
  console.log(`live in store:      ${storeHandles.size} (vendor=${VENDOR || 'any'})`);
  console.log(`confirmed uploaded: ${matched}`);
  console.log(`still missing:      ${missing.length}`);
  if (extra.length) console.log(`live but not in CSV: ${extra.length}`);

  const log = [['handle', 'status']];
  for (const h of csvHandles) log.push([h, storeHandles.has(h) ? 'live' : 'missing']);
  writeFileSync(OUT_LOG, log.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n', 'utf8');
  console.log('');
  console.log(`per-handle results written to ${path.relative(ROOT, OUT_LOG)}`);
})();
