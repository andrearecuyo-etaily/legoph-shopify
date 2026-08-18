/**
 * Creates the footer's "Legal" navigation menu and points
 * `brickline-footer.liquid`'s `legal_menu` setting at it.
 *
 * The setting itself has always been fully wired in code (schema field +
 * render loop in sections/brickline-footer.liquid) — the only missing piece
 * was the menu itself, which only the Admin API (or the admin UI) can create.
 *
 * Link targets, in the order the design specifies:
 *   Privacy policy   -> shop.privacyPolicy.url        (Shopify native policy, always safe)
 *   Terms of use      -> shop.termsOfService.url        (Shopify native policy, always safe)
 *   Cookies            -> page handle 'cookies'
 *   Cookie settings     -> page handle 'cookies'  (same page; Shopify has no separate settings UI)
 *   Legal notice        -> page handle 'terms-and-conditions'
 *   Digital wellbeing    -> page handle 'accessibility-statement'
 *   Accessibility          -> page handle 'accessibility-statement'
 *   Do not sell/share...    -> page handle 'privacy-policy'
 *
 * Handle-based links are only included if that page actually exists on the
 * store — a broken footer link is worse than a short one. Anything skipped is
 * reported so you can create the page (or fix the handle) and re-run.
 *
 * Usage:
 *   export SHOPIFY_ADMIN_TOKEN=shpat_...   # write_online_store_navigation
 *   node docs/menus/create-footer-legal-menu.mjs legoph-gnobvfvh.myshopify.com --dry-run
 *   node docs/menus/create-footer-legal-menu.mjs legoph-gnobvfvh.myshopify.com
 *
 * After it creates the menu, set Footer -> "Legal links menu" to "Legal" in
 * the theme editor (section settings aren't scriptable — that part is manual).
 */

const API_VERSION = '2024-10';
const MENU_HANDLE = 'legal';
const MENU_TITLE = 'Legal';

// [label, kind, value] — kind is 'policy' (shop policy field) or 'page' (page handle)
const LINKS = [
  ['Privacy policy', 'policy', 'privacyPolicy'],
  ['Cookies', 'page', 'cookies'],
  ['Cookie settings', 'page', 'cookies'],
  ['Legal notice', 'page', 'terms-and-conditions'],
  ['Terms of use', 'policy', 'termsOfService'],
  ['Digital wellbeing', 'page', 'accessibility-statement'],
  ['Accessibility', 'page', 'accessibility-statement'],
  ['Do not sell/share my personal information', 'page', 'privacy-policy'],
];

const [shop, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
const token = process.env.SHOPIFY_ADMIN_TOKEN;

if (!shop) {
  console.error('Usage: node create-footer-legal-menu.mjs <shop>.myshopify.com [--dry-run]');
  process.exit(1);
}
if (!token && !dryRun) {
  console.error('Set SHOPIFY_ADMIN_TOKEN (Admin API token with write_online_store_navigation).');
  process.exit(1);
}

async function admin(query, variables) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

const Q_SHOP_POLICIES = `{
  shop {
    privacyPolicy { url }
    termsOfService { url }
  }
}`;

const Q_PAGE_BY_HANDLE = `query($handle: String!) { pageByHandle(handle: $handle) { id onlineStoreUrl } }`;

const Q_MENU_BY_HANDLE = `query($handle: String!) { menu(handle: $handle) { id } }`;

const M_MENU_CREATE = `
  mutation($title: String!, $handle: String, $items: [MenuItemCreateInput!]!) {
    menuCreate(title: $title, handle: $handle, items: $items) {
      menu { id handle }
      userErrors { field message code }
    }
  }`;

async function main() {
  console.log(`\n${dryRun ? 'Would build' : 'Building'} the "${MENU_TITLE}" footer menu on ${shop}\n`);

  if (dryRun) {
    for (const [label, kind, value] of LINKS) {
      console.log(`  ${label.padEnd(45)} ${kind === 'policy' ? `shop.${value}.url` : `page:${value}`}`);
    }
    console.log('\n(dry run — nothing checked against the live store; page existence is only verified on a real run)\n');
    return;
  }

  const existing = await admin(Q_MENU_BY_HANDLE, { handle: MENU_HANDLE });
  if (existing.menu) {
    console.log(`A menu with handle "${MENU_HANDLE}" already exists (${existing.menu.id}). Not touching it — delete it in admin first if you want this script to rebuild it.\n`);
    return;
  }

  const policies = (await admin(Q_SHOP_POLICIES)).shop;
  const items = [];
  const skipped = [];

  for (const [label, kind, value] of LINKS) {
    if (kind === 'policy') {
      const url = value === 'privacyPolicy' ? policies.privacyPolicy?.url : policies.termsOfService?.url;
      if (!url) { skipped.push(`${label} — shop has no ${value} set (Settings > Policies)`); continue; }
      items.push({ title: label, type: 'HTTP', url });
    } else {
      const data = await admin(Q_PAGE_BY_HANDLE, { handle: value });
      if (!data.pageByHandle) { skipped.push(`${label} — no page with handle "${value}" exists`); continue; }
      items.push({ title: label, type: 'PAGE', resourceId: data.pageByHandle.id });
    }
  }

  if (items.length === 0) {
    console.log('No links resolved — nothing to create. See skipped list below.\n');
  } else {
    const data = await admin(M_MENU_CREATE, { title: MENU_TITLE, handle: MENU_HANDLE, items });
    const { menu, userErrors } = data.menuCreate;
    if (menu) {
      console.log(`Created menu "${MENU_TITLE}" (${menu.handle}) with ${items.length}/${LINKS.length} links.\n`);
      console.log('Next: Theme editor -> Footer section -> "Legal links menu" -> select "Legal".\n');
    } else {
      console.log(`FAILED: ${userErrors.map((e) => e.message).join('; ')}\n`);
      process.exit(1);
    }
  }

  if (skipped.length) {
    console.log('Skipped (create the page/policy, then re-run — safe, this script never duplicates):');
    skipped.forEach((s) => console.log(`  - ${s}`));
    console.log('');
  }
}

main();
