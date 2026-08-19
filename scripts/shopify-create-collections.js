#!/usr/bin/env node
/**
 * Create one smart (automated) collection per distinct Product Type value found
 * in data/shopify-import-lego-merged.csv — e.g. "Star Wars", "City", "Technic".
 * Each collection's rule is "Product type equals <type>", so future products of
 * that type join automatically; nothing needs to be maintained by hand.
 *
 * Usage:
 *   SHOPIFY_STORE=legoph-gnobvfvh.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *     node scripts/shopify-create-collections.js                # dry run
 *   ... node scripts/shopify-create-collections.js --live        # actually create
 *
 * Flags:
 *   --file <path>          CSV to read Product Types from (default: data/shopify-import-lego-merged.csv)
 *   --store <domain>       overrides SHOPIFY_STORE env var
 *   --token <token>        overrides SHOPIFY_ADMIN_TOKEN env var
 *   --api-version <ver>    default 2025-01
 *   --live                 actually call the API (default is dry run / print only)
 *   --resume-from <path>   skip types already marked "created" in a prior log
 *
 * Writes data/shopify-collections-log.csv with the result per type.
 * Re-run with --resume-from data/shopify-collections-log.csv to continue after a
 * partial failure without recreating collections that already succeeded.
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
    else if (a === '--resume-from') out.resumeFrom = argv[++i];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

const FILE = path.resolve(ROOT, args.file || 'data/shopify-import-lego-merged.csv');
const STORE = args.store || process.env.SHOPIFY_STORE;
const TOKEN = args.token || process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = args.apiVersion || '2025-01';
const LOG = path.join(ROOT, 'data/shopify-collections-log.csv');

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

// ---------------------------------------------------------------- distinct product types
const rows = parseCsv(readFileSync(FILE, 'utf8')).filter(r => r.Title && r.Type && r.Type.trim());
const types = [...new Set(rows.map(r => r.Type.trim()))].sort((a, b) => a.localeCompare(b));

let toProcess = types;
if (args.resumeFrom) {
  const prior = parseCsv(readFileSync(path.resolve(ROOT, args.resumeFrom), 'utf8'));
  const done = new Set(prior.filter(r => r.status === 'created').map(r => r.type));
  const before = toProcess.length;
  toProcess = toProcess.filter(t => !done.has(t));
  console.log(`resume: skipping ${before - toProcess.length} already-created type(s) from ${args.resumeFrom}`);
}

// ---------------------------------------------------------------- API call with retry
const ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/smart_collections.json`;

async function createCollection(type, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  const payload = {
    smart_collection: {
      title: type,
      published: true,
      rules: [{ column: 'type', relation: 'equals', condition: type }],
      disjunctive: false,
    },
  };

  let res;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
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
    if (attempt < MAX_ATTEMPTS) {
      const delay = 2000 * attempt;
      console.warn(`  network error (${err.cause?.code || err.cause?.message || err.message}), retrying in ${delay}ms [attempt ${attempt}/${MAX_ATTEMPTS}]`);
      await new Promise(r => setTimeout(r, delay));
      return createCollection(type, attempt + 1);
    }
    const cause = err.cause ? ` (cause: ${err.cause.code || err.cause.message || err.cause})` : '';
    throw new Error(`${err.message}${cause}`);
  }

  if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
    const retryAfter = parseFloat(res.headers.get('Retry-After') || String(2 * attempt));
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return createCollection(type, attempt + 1);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body.errors || body)}`);
  }
  return body.smart_collection;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- run
(async () => {
  console.log(`${args.live ? 'LIVE' : 'DRY RUN'} — ${toProcess.length} collection(s) from ${path.relative(ROOT, FILE)}`);
  console.log(`store: ${STORE}  api: ${API_VERSION}`);
  console.log('');

  const log = [['type', 'status', 'collection_id', 'error']];
  let ok = 0, failed = 0;

  for (const [i, type] of toProcess.entries()) {
    if (!args.live) {
      console.log(`[${i + 1}/${toProcess.length}] would create collection: "${type}"`);
      log.push([type, 'dry-run', '', '']);
      continue;
    }

    try {
      const col = await createCollection(type);
      console.log(`[${i + 1}/${toProcess.length}] created: "${type}" -> id ${col.id}`);
      log.push([type, 'created', col.id, '']);
      ok++;
    } catch (err) {
      console.error(`[${i + 1}/${toProcess.length}] FAILED: "${type}" -> ${err.message}`);
      log.push([type, 'error', '', err.message.replace(/[\n,]/g, ' ')]);
      failed++;
    }

    await sleep(600);
  }

  writeFileSync(LOG, log.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n', 'utf8');
  console.log('');
  console.log(`log written to ${path.relative(ROOT, LOG)}`);
  if (args.live) console.log(`done: ${ok} created, ${failed} failed`);
  else console.log('this was a dry run — nothing was created. Re-run with --live to actually create collections.');
})();
