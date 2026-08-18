/**
 * Converts the Lazada/marketplace listing template (the sheet compiled for
 * multi-channel product data) into the Shopify product-export-shaped CSV
 * that bulk-import-products.mjs / the Admin CSV importer expects. See
 * docs/product-import/README.md for the target shape.
 *
 * The source sheet has a 4-row header (group labels, column names, a
 * required/optional marker row, then a description row) before data starts,
 * and its last 6 columns are only named in the description row, not the
 * column-name row. This reads columns by fixed position rather than by name
 * for that reason.
 *
 * Usage:
 *   node docs/product-import/convert-lazada-csv.mjs <source.csv> <dest.csv>
 */

import { readFileSync, writeFileSync } from 'node:fs';

const [srcPath, destPath] = process.argv.slice(2);
if (!srcPath || !destPath) {
  console.error('Usage: node convert-lazada-csv.mjs <source.csv> <dest.csv>');
  process.exit(1);
}

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
  return rows;
}

function csvField(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(fields) {
  return fields.map(csvField).join(',');
}

/* --------------------------------------------------------------- source */

// Fixed column positions in the Lazada sheet (0-indexed), data rows start
// at index 4 (after group-label, column-name, required-marker, description).
const COL = {
  ITEM_CODE: 1,
  SKU_BARCODE: 2,
  PRODUCT_NAME: 3,
  BRAND: 4,
  PLAIN_TEXT_DESC: 5,
  HTML_DESC: 6,
  PRICE: 27,
  STOCK_QTY: 28,
  AGE: 43,
  THEMES: 46,
  PRODUCT_STATUS: 47,
};

const STATUS_MAP = {
  outgoing: 'active',
  'carry over': 'active',
  novelty: 'active',
  provisional: 'draft',
  discontinued: 'archived',
  '': 'draft',
};

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function extractPieces(title) {
  const m = title.match(/\((\d+)\s*(?:pcs|pieces)\)/i);
  return m ? m[1] : '';
}

function toShopifyRow(r) {
  const itemCode = r[COL.ITEM_CODE].trim();
  const title = r[COL.PRODUCT_NAME].trim();
  const bodyHtml = r[COL.HTML_DESC].trim() || (r[COL.PLAIN_TEXT_DESC].trim()
    ? `<p>${r[COL.PLAIN_TEXT_DESC].trim().replace(/\n+/g, '</p><p>')}</p>`
    : '');
  const status = STATUS_MAP[r[COL.PRODUCT_STATUS].trim().toLowerCase()] ?? 'draft';

  return {
    Handle: slugify(`lego-${itemCode}-${title}`),
    Title: title,
    'Body (HTML)': bodyHtml,
    Vendor: r[COL.BRAND].trim() || 'LEGO',
    Type: r[COL.THEMES].trim(),
    Tags: r[COL.THEMES].trim(),
    Published: 'TRUE',
    'Option1 Name': 'Title',
    'Option1 Value': 'Default Title',
    'Variant SKU': itemCode,
    'Variant Barcode': r[COL.SKU_BARCODE].trim(),
    'Variant Inventory Tracker': 'shopify',
    'Variant Inventory Qty': r[COL.STOCK_QTY].trim() || '0',
    'Variant Inventory Policy': 'deny',
    'Variant Fulfillment Service': 'manual',
    'Variant Price': r[COL.PRICE].trim(),
    'Variant Compare At Price': '',
    'Variant Requires Shipping': 'TRUE',
    'Variant Taxable': 'TRUE',
    'Image Src': '',
    'Image Position': '',
    Status: status,
    Age: r[COL.AGE].trim(),
    Pieces: extractPieces(title),
    Rating: '',
    'Rating Count': '',
  };
}

/* ---------------------------------------------------------------- main */

const rows = parseCsv(readFileSync(srcPath, 'utf8'));
const data = rows.slice(4).filter((r) => r[COL.ITEM_CODE] && r[COL.ITEM_CODE].trim());

const HEADER = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Barcode',
  'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price',
  'Variant Requires Shipping', 'Variant Taxable', 'Image Src', 'Image Position',
  'Status', 'Age', 'Pieces', 'Rating', 'Rating Count',
];

const out = [csvLine(HEADER)];
const seenHandles = new Map();
let dupes = 0;

for (const r of data) {
  const row = toShopifyRow(r);
  if (seenHandles.has(row.Handle)) {
    dupes++;
    row.Handle = `${row.Handle}-${r[COL.ITEM_CODE].trim()}`;
  }
  seenHandles.set(row.Handle, true);
  out.push(csvLine(HEADER.map((h) => row[h])));
}

writeFileSync(destPath, out.join('\n') + '\n', 'utf8');

console.log(`Converted ${data.length} product(s) from ${srcPath}`);
console.log(`Wrote ${destPath}`);
if (dupes) console.log(`Note: ${dupes} handle collision(s) resolved by appending item code`);
console.log('\nKnown gaps in this conversion:');
console.log('  - No Image Src: the source sheet has no image URLs, so all products import without images.');
console.log('  - Variant Inventory Qty defaulted to 0 for every row: the source Stock Quantity / Lazada Stocks columns are empty.');
console.log('  - Status derived from Product Status: Discontinued -> archived, everything else -> active, blank -> draft.');
