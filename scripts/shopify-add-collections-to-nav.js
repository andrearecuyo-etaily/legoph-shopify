#!/usr/bin/env node
/**
 * Append the 50 LEGO-theme collections (created by shopify-create-collections.js,
 * logged in data/shopify-collections-log.csv) as flat top-level links on the
 * theme's existing main navigation menu.
 *
 * Menus are GraphQL-only in the Admin API (no REST resource), so this reads the
 * current menu with `menus`, preserves every existing item exactly as-is
 * (menuUpdate replaces the whole item list), and appends the new collection
 * links after it. Already-linked collections are skipped so re-running is safe.
 *
 * Usage:
 *   SHOPIFY_STORE=legoph-gnobvfvh.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *     node scripts/shopify-add-collections-to-nav.js                # dry run
 *   ... node scripts/shopify-add-collections-to-nav.js --live        # actually update
 *
 * Flags:
 *   --log <path>            collections log (default: data/shopify-collections-log.csv)
 *   --menu-handle <handle>  default: main-menu
 *   --store <domain>        overrides SHOPIFY_STORE env var
 *   --token <token>         overrides SHOPIFY_ADMIN_TOKEN env var
 *   --api-version <ver>     default 2025-01
 *   --live                  actually call the API (default is dry run / print only)
 */

const { readFileSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { live: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') out.live = true;
    else if (a === '--log') out.log = argv[++i];
    else if (a === '--menu-handle') out.menuHandle = argv[++i];
    else if (a === '--store') out.store = argv[++i];
    else if (a === '--token') out.token = argv[++i];
    else if (a === '--api-version') out.apiVersion = argv[++i];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

const LOG = path.resolve(ROOT, args.log || 'data/shopify-collections-log.csv');
const MENU_HANDLE = args.menuHandle || 'main-menu';
const STORE = args.store || process.env.SHOPIFY_STORE;
const TOKEN = args.token || process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = args.apiVersion || '2025-01';

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

const GRAPHQL_ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

async function gql(query, variables, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  let res;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      res = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': TOKEN,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      const delay = 2000 * attempt;
      console.warn(`  network error (${err.cause?.code || err.message}), retrying in ${delay}ms [attempt ${attempt}/${MAX_ATTEMPTS}]`);
      await new Promise(r => setTimeout(r, delay));
      return gql(query, variables, attempt + 1);
    }
    throw err;
  }

  if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
    const retryAfter = parseFloat(res.headers.get('Retry-After') || String(2 * attempt));
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return gql(query, variables, attempt + 1);
  }

  const body = await res.json();
  if (!res.ok || body.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(body.errors || body)}`);
  }
  return body.data;
}

const MENU_ITEM_FIELDS = `
  id
  title
  type
  url
  resourceId
  tags
`;

const MENU_QUERY = `
  query MainMenu {
    menus(first: 50) {
      nodes {
        id
        handle
        title
        items {
          ${MENU_ITEM_FIELDS}
          items {
            ${MENU_ITEM_FIELDS}
            items {
              ${MENU_ITEM_FIELDS}
            }
          }
        }
      }
    }
  }
`;

const MENU_UPDATE_MUTATION = `
  mutation MenuUpdate($id: ID!, $title: String, $handle: String, $items: [MenuItemUpdateInput!]) {
    menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
      menu { id items { id title type resourceId } }
      userErrors { field message }
    }
  }
`;

// existing item -> MenuItemUpdateInput, preserving it exactly (menuUpdate replaces the full tree)
function toUpdateInput(item) {
  const out = { id: item.id, title: item.title, type: item.type };
  if (item.url) out.url = item.url;
  if (item.resourceId) out.resourceId = item.resourceId;
  if (item.tags && item.tags.length) out.tags = item.tags;
  if (item.items && item.items.length) out.items = item.items.map(toUpdateInput);
  return out;
}

function collectResourceIds(items, set = new Set()) {
  for (const it of items) {
    if (it.resourceId) set.add(it.resourceId);
    if (it.items) collectResourceIds(it.items, set);
  }
  return set;
}

(async () => {
  const rows = parseCsv(readFileSync(LOG, 'utf8')).filter(r => r.status === 'created' && r.collection_id);

  console.log(`${args.live ? 'LIVE' : 'DRY RUN'} — linking ${rows.length} collection(s) from ${path.relative(ROOT, LOG)} onto menu "${MENU_HANDLE}"`);
  console.log(`store: ${STORE}  api: ${API_VERSION}`);
  console.log('');

  const data = await gql(MENU_QUERY, {});
  const menu = data.menus.nodes.find(m => m.handle === MENU_HANDLE);
  if (!menu) {
    console.error(`No menu with handle "${MENU_HANDLE}" found. Available handles: ${data.menus.nodes.map(m => m.handle).join(', ')}`);
    process.exit(1);
  }

  const existingIds = collectResourceIds(menu.items);
  const existingItems = menu.items.map(toUpdateInput);

  const newItems = [];
  for (const r of rows) {
    const resourceId = `gid://shopify/Collection/${r.collection_id}`;
    if (existingIds.has(resourceId)) continue; // already linked, skip
    newItems.push({ title: r.type, type: 'COLLECTION', resourceId });
  }

  console.log(`menu "${menu.title}" (${menu.handle}): ${menu.items.length} existing item(s), ${newItems.length} new, ${rows.length - newItems.length} already present`);
  newItems.forEach((it, i) => console.log(`  [+${i + 1}] ${it.title}`));

  if (!newItems.length) {
    console.log('\nnothing to add — all collections already linked.');
    return;
  }

  if (!args.live) {
    console.log(`\ndry run — nothing was changed. Re-run with --live to append these ${newItems.length} link(s) to "${menu.handle}".`);
    return;
  }

  const result = await gql(MENU_UPDATE_MUTATION, {
    id: menu.id,
    title: menu.title,
    handle: menu.handle,
    items: [...existingItems, ...newItems],
  });

  const errs = result.menuUpdate.userErrors;
  if (errs && errs.length) {
    console.error('\nmenuUpdate returned errors:', JSON.stringify(errs, null, 2));
    process.exit(1);
  }

  console.log(`\ndone — menu now has ${result.menuUpdate.menu.items.length} top-level item(s).`);
})();
