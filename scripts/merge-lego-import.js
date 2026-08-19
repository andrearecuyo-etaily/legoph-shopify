#!/usr/bin/env node
/**
 * Build one Shopify-ready product import CSV from the two LEGO source files.
 *
 *   spine  = data/shopify-products-lego-catalog.csv   (798 products, correct Shopify
 *            column names + SKU orientation, Age/Pieces, but NO images)
 *   images = data/[LEGO] Shopify Listing Automated Template ... For Upload.csv
 *            (627 products, 4,773 image URLs, richer tags, weights — Matrixify format
 *            with Variant SKU / Variant Barcode SWAPPED)
 *
 * Join key is the LEGO set number:
 *   spine["Variant SKU"]  ===  images["Variant Barcode"]
 *
 * Output: data/shopify-import-lego-merged.csv
 */

const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPINE = path.join(ROOT, 'data/shopify-products-lego-catalog.csv');
const IMAGES = path.join(
  ROOT,
  'data/[LEGO] Shopify Listing Automated Template - PLEASE MAKE A COPY (2026) - For Upload.csv'
);
const OUT = path.join(ROOT, 'data/shopify-import-lego-merged.csv');

// Images on this host return 403 (private bucket) — Shopify would fail to fetch them.
const BLOCKED_IMAGE_HOSTS = ['etaily-files.s3.amazonaws.com'];

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

const esc = v => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// ---------------------------------------------------------------- load
const spine = parseCsv(readFileSync(SPINE, 'utf8'));
const imgSrc = parseCsv(readFileSync(IMAGES, 'utf8'));

// set number -> image-file record
const bySet = new Map(imgSrc.map(r => [String(r['Variant Barcode']).trim(), r]));

// ---------------------------------------------------------------- output shape
const COLUMNS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value',
  'Variant SKU', 'Variant Barcode', 'Variant Inventory Tracker',
  'Variant Inventory Qty', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Grams', 'Variant Price',
  'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable',
  'Image Src', 'Image Position', 'Image Alt Text',
  'Status', 'Age', 'Pieces', 'Rating', 'Rating Count',
];

const out = [];
const stats = {
  products: 0, matched: 0, unmatched: 0,
  imageRows: 0, imagesKept: 0, imagesDropped: 0,
  tagsUpgraded: 0, weightsAdded: 0,
  noImage: [],
};

for (const p of spine) {
  const set = String(p['Variant SKU']).trim();
  const m = bySet.get(set);
  if (!m) continue; // only upload products present in the template file
  stats.matched++;

  // richer tags from the template when available (6 tags vs 1)
  let tags = p.Tags || '';
  if (m && (m.Tags || '').split(',').filter(t => t.trim()).length >
           tags.split(',').filter(t => t.trim()).length) {
    tags = m.Tags;
    stats.tagsUpgraded++;
  }

  // weight: template gives kg -> Shopify wants grams
  let grams = '';
  if (m && m['Variant Weight']) {
    const kg = parseFloat(m['Variant Weight']);
    const unit = (m['Variant Weight Unit'] || 'kg').toLowerCase();
    if (!isNaN(kg)) {
      grams = Math.round(unit === 'kg' ? kg * 1000 : unit === 'g' ? kg : kg * 1000);
      stats.weightsAdded++;
    }
  }

  // usable images, private hosts removed
  const urls = (m ? (m['Image Src'] || '') : '')
    .split(';').map(u => u.trim()).filter(Boolean);
  const usable = urls.filter(u => !BLOCKED_IMAGE_HOSTS.some(h => u.includes(h)));
  stats.imagesDropped += urls.length - usable.length;
  stats.imagesKept += usable.length;
  if (!usable.length) stats.noImage.push(set);

  const base = {
    Handle: p.Handle,
    Title: p.Title,
    'Body (HTML)': p['Body (HTML)'],
    Vendor: p.Vendor,
    Type: p.Type,
    Tags: tags,
    Published: p.Published || 'TRUE',
    'Option1 Name': p['Option1 Name'] || 'Title',
    'Option1 Value': p['Option1 Value'] || 'Default Title',
    'Variant SKU': p['Variant SKU'],
    'Variant Barcode': p['Variant Barcode'],
    'Variant Inventory Tracker': p['Variant Inventory Tracker'] || 'shopify',
    'Variant Inventory Qty': p['Variant Inventory Qty'] || '0',
    'Variant Inventory Policy': p['Variant Inventory Policy'] || 'deny',
    'Variant Fulfillment Service': p['Variant Fulfillment Service'] || 'manual',
    'Variant Grams': grams,
    'Variant Price': p['Variant Price'],
    'Variant Compare At Price': p['Variant Compare At Price'],
    'Variant Requires Shipping': p['Variant Requires Shipping'] || 'TRUE',
    'Variant Taxable': p['Variant Taxable'] || 'TRUE',
    'Image Src': usable[0] || '',
    'Image Position': usable.length ? '1' : '',
    'Image Alt Text': usable.length ? p.Title : '',
    Status: p.Status || 'active',
    Age: p.Age,
    Pieces: p.Pieces,
    Rating: p.Rating,
    'Rating Count': p['Rating Count'],
  };
  out.push(base);
  stats.products++;

  // remaining images: handle + image columns only
  usable.slice(1).forEach((u, i) => {
    const row = Object.fromEntries(COLUMNS.map(c => [c, '']));
    row.Handle = p.Handle;
    row['Image Src'] = u;
    row['Image Position'] = String(i + 2);
    row['Image Alt Text'] = p.Title;
    out.push(row);
    stats.imageRows++;
  });
}

const csv = [COLUMNS.join(',')]
  .concat(out.map(r => COLUMNS.map(c => esc(r[c])).join(',')))
  .join('\n') + '\n';
writeFileSync(OUT, csv, 'utf8');

// ---------------------------------------------------------------- report
console.log('wrote', path.relative(ROOT, OUT));
console.log('  products            ', stats.products);
console.log('  matched to images   ', stats.matched);
console.log('  no image match      ', stats.unmatched);
console.log('  extra image rows    ', stats.imageRows);
console.log('  image URLs kept     ', stats.imagesKept);
console.log('  image URLs dropped  ', stats.imagesDropped, '(private 403 host)');
console.log('  tags upgraded       ', stats.tagsUpgraded);
console.log('  weights added       ', stats.weightsAdded);
console.log('  total CSV rows      ', out.length);
console.log('  products w/o images ', stats.noImage.length);
if (stats.noImage.length) {
  console.log('    sets:', stats.noImage.slice(0, 20).join(', ') +
    (stats.noImage.length > 20 ? ` …+${stats.noImage.length - 20} more` : ''));
}
