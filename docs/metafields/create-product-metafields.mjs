/**
 * Creates the product metafield and metaobject definitions the Brickline theme
 * reads. Safe to re-run: anything that already exists is reported and skipped.
 *
 * Two groups:
 *
 * 1. Scalar product metafields the theme ALREADY renders today —
 *    sections/brickline-product-main.liquid, snippets/brickline-product-card.liquid
 *    and sections/brickline-main-cart.liquid all read product.metafields.custom.*.
 *    A metafield with no definition cannot be filled in from the product admin,
 *    so those rows render empty until these exist.
 *
 *    Types match how the Liquid uses each value, so don't change them casually:
 *      age    is text, not a number  -> values look like "18+"
 *      rating is a plain decimal     -> the theme does `meta_rating | round`,
 *                                       which would not work on Shopify's
 *                                       `rating` type (an object, not a number)
 *
 * 2. Metaobjects that carry per-product content for the showcase and cinematic
 *    product templates. Section settings live in the template JSON, so every
 *    product sharing a template shares its copy — these move the copy onto the
 *    product. The metaobjects hold content only; layout, image ratio and colours
 *    stay section settings, because those belong to the template's design.
 *
 * Usage:
 *   export SHOPIFY_ADMIN_TOKEN=shpat_...   # write_products, write_metaobject_definitions
 *   node create-product-metafields.mjs legoph-gnobvfvh.myshopify.com
 *   node create-product-metafields.mjs <shop> --dry-run
 */

const API_VERSION = '2024-10';

/* ------------------------------------------------------------- metaobjects */

const METAOBJECTS = [
  {
    type: 'product_story_band',
    name: 'Product story band',
    description: 'One full-width content band on a product page. Rendered by brickline-feature-band.',
    displayNameKey: 'heading',
    fieldDefinitions: [
      { key: 'heading', name: 'Heading', type: 'single_line_text_field', required: true },
      { key: 'eyebrow', name: 'Eyebrow', type: 'single_line_text_field' },
      { key: 'body', name: 'Body', type: 'rich_text_field' },
      { key: 'image', name: 'Image', type: 'file_reference' },
      { key: 'button_label', name: 'Button label', type: 'single_line_text_field' },
      { key: 'button_link', name: 'Button link', type: 'url' },
      { key: 'background_color', name: 'Background colour', type: 'color' },
      { key: 'text_color', name: 'Text colour', type: 'color' },
    ],
  },
  {
    type: 'product_story_card',
    name: 'Product story card',
    description: 'One tile in a product page grid. Rendered by brickline-editorial-grid.',
    displayNameKey: 'title',
    fieldDefinitions: [
      { key: 'title', name: 'Title', type: 'single_line_text_field', required: true },
      { key: 'subtitle', name: 'Subtitle', type: 'multi_line_text_field' },
      { key: 'image', name: 'Image', type: 'file_reference' },
      { key: 'button_label', name: 'Button label', type: 'single_line_text_field' },
      { key: 'button_link', name: 'Button link', type: 'url' },
    ],
  },
  {
    type: 'product_swatch',
    name: 'Product swatch',
    description: 'One colour circle on a product page. Rendered by brickline-circle-grid.',
    displayNameKey: 'label',
    fieldDefinitions: [
      { key: 'label', name: 'Label', type: 'single_line_text_field', required: true },
      { key: 'color', name: 'Colour', type: 'color' },
      { key: 'image', name: 'Image', type: 'file_reference' },
      { key: 'link', name: 'Link', type: 'url' },
    ],
  },
];

/* --------------------------------------------------------- product metafields */

// `metaobject` names a type above; the script swaps it for that definition's id.
const METAFIELDS = [
  {
    namespace: 'custom', key: 'age', name: 'Age',
    description: 'Recommended age, shown as "18+ Ages" on the product page.',
    type: 'single_line_text_field',
  },
  {
    namespace: 'custom', key: 'pieces', name: 'Pieces',
    description: 'Piece count, shown on the product page, cards and cart lines.',
    type: 'number_integer',
  },
  {
    namespace: 'custom', key: 'rating', name: 'Rating',
    description: 'Average review score out of 5. Drives the filled stars.',
    type: 'number_decimal',
  },
  {
    namespace: 'custom', key: 'rating_count', name: 'Rating count',
    description: 'Number of reviews, shown in brackets after the stars.',
    type: 'number_integer',
  },
  {
    namespace: 'custom', key: 'story_bands', name: 'Story bands',
    description: 'Content bands for this product, in order. Each feature band section picks one by position.',
    type: 'list.metaobject_reference', metaobject: 'product_story_band',
  },
  {
    namespace: 'custom', key: 'story_cards', name: 'Story cards',
    description: 'Tiles for this product\'s editorial grid, in order.',
    type: 'list.metaobject_reference', metaobject: 'product_story_card',
  },
  {
    namespace: 'custom', key: 'swatches', name: 'Swatches',
    description: 'Colour circles for this product, in order.',
    type: 'list.metaobject_reference', metaobject: 'product_swatch',
  },
];

/* ---------------------------------------------------------------------- run */

const [shop, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
const token = process.env.SHOPIFY_ADMIN_TOKEN;

if (!shop) {
  console.error('Usage: node create-product-metafields.mjs <shop>.myshopify.com [--dry-run]');
  process.exit(1);
}
if (!token && !dryRun) {
  console.error('Set SHOPIFY_ADMIN_TOKEN (Admin API token with write_products and write_metaobject_definitions).');
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

/**
 * One cheap call before the real work, so a bad token or domain is reported once
 * and in plain terms rather than ten times as a mutation failure.
 */
async function preflight() {
  try {
    const data = await admin('{ shop { name myshopifyDomain } }');
    console.log(`Connected to ${data.shop.name} (${data.shop.myshopifyDomain})\n`);
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
      console.error(`  Check the shop domain. You passed: ${shop}`);
      console.error('  It should look like your-store.myshopify.com, not the admin URL.\n');
    } else if (/could not reach/.test(msg)) {
      console.error(`  Check the shop domain and your connection. You passed: ${shop}\n`);
    }

    console.error('  Scopes needed: write_products, write_metaobject_definitions');
    console.error(`  Verify with:\n    curl -s -o /dev/null -w '%{http_code}\\n' \\\n      -H "X-Shopify-Access-Token: $SHOPIFY_ADMIN_TOKEN" \\\n      https://${shop}/admin/api/${API_VERSION}/shop.json\n`);
    console.error('  200 = good, 401 = token, 404 = domain.\n');
    return false;
  }
}

const Q_METAOBJECT_BY_TYPE = `query($type: String!) { metaobjectDefinitionByType(type: $type) { id } }`;

const M_METAOBJECT_CREATE = `
  mutation($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type }
      userErrors { field message code }
    }
  }`;

const M_METAFIELD_CREATE = `
  mutation($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id namespace key type { name } }
      userErrors { field message code }
    }
  }`;

const tally = { created: 0, existed: 0, failed: 0 };
const ids = {};

console.log(`\n${dryRun ? 'Would set up' : 'Setting up'} product content on ${shop}\n`);

if (!dryRun && !(await preflight())) process.exit(1);

/* -- metaobject definitions -- */

console.log('Metaobject definitions');
for (const def of METAOBJECTS) {
  const label = `  ${def.type.padEnd(22)}`;

  if (dryRun) {
    console.log(`${label} ${def.fieldDefinitions.length} fields: ${def.fieldDefinitions.map((f) => f.key).join(', ')}`);
    continue;
  }

  try {
    const existing = await admin(Q_METAOBJECT_BY_TYPE, { type: def.type });
    if (existing.metaobjectDefinitionByType) {
      ids[def.type] = existing.metaobjectDefinitionByType.id;
      tally.existed++;
      console.log(`${label} already exists`);
      continue;
    }

    const data = await admin(M_METAOBJECT_CREATE, {
      definition: {
        ...def,
        access: { storefront: 'PUBLIC_READ' },
        capabilities: { publishable: { enabled: true } },
      },
    });
    const { metaobjectDefinition, userErrors } = data.metaobjectDefinitionCreate;

    if (metaobjectDefinition) {
      ids[def.type] = metaobjectDefinition.id;
      tally.created++;
      console.log(`${label} created`);
    } else {
      tally.failed++;
      console.log(`${label} FAILED ${userErrors.map((e) => e.message).join('; ')}`);
    }
  } catch (err) {
    tally.failed++;
    console.log(`${label} FAILED ${err.message}`);
  }
}

/* -- product metafield definitions -- */

console.log('\nProduct metafields');
for (const def of METAFIELDS) {
  const label = `  ${`${def.namespace}.${def.key}`.padEnd(22)}`;

  if (dryRun) {
    console.log(`${label} ${def.type}${def.metaobject ? ` -> ${def.metaobject}` : ''}`);
    continue;
  }

  const { metaobject, ...input } = def;

  // A metaobject-reference metafield has to name the definition it points at.
  if (metaobject) {
    if (!ids[metaobject]) {
      tally.failed++;
      console.log(`${label} SKIPPED — ${metaobject} was not created`);
      continue;
    }
    input.validations = [{ name: 'metaobject_definition_id', value: ids[metaobject] }];
  }

  try {
    const data = await admin(M_METAFIELD_CREATE, {
      definition: { ...input, ownerType: 'PRODUCT', access: { storefront: 'PUBLIC_READ' } },
    });
    const { createdDefinition, userErrors } = data.metafieldDefinitionCreate;

    if (createdDefinition) {
      tally.created++;
      console.log(`${label} created (${createdDefinition.type.name})`);
    } else if (userErrors.some((e) => e.code === 'TAKEN')) {
      tally.existed++;
      console.log(`${label} already exists`);
    } else {
      tally.failed++;
      console.log(`${label} FAILED ${userErrors.map((e) => e.message).join('; ')}`);
    }
  } catch (err) {
    tally.failed++;
    console.log(`${label} FAILED ${err.message}`);
  }
}

if (!dryRun) {
  console.log(`\n${tally.created} created, ${tally.existed} already existed, ${tally.failed} failed\n`);
  process.exit(tally.failed ? 1 : 0);
}
