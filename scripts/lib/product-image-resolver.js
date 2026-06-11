
const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg'];

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function legacyToImageApiPath(src) {
  if (!src) return null;
  const normalized = String(src).replace(/\\/g, '/');
  if (normalized.startsWith('/assets/')) return normalized;
  if (normalized.startsWith('/img/')) return normalized;
  if (normalized.startsWith('images/')) return `/images/${normalized.slice('images/'.length)}`;
  if (normalized.startsWith('/images/')) return normalized;
  return normalized.startsWith('/') ? normalized : `/images/${normalized}`;
}

function readProductFilenames(productsDir) {
  if (!fs.existsSync(productsDir) || !fs.statSync(productsDir).isDirectory()) {
    return [];
  }
  return fs.readdirSync(productsDir).filter((name) => {
    if (name === '.gitkeep' || name.startsWith('.')) return false;
    const ext = path.extname(name).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  });
}

function findFileCaseInsensitive(filesOnDisk, wantedName) {
  const lower = wantedName.toLowerCase();
  return filesOnDisk.find((f) => f.toLowerCase() === lower) || null;
}

function resolveProductImage(productsDir, category, item, index, productSlug) {
  const files = readProductFilenames(productsDir);
  if (files.length === 0) {
    return legacyToImageApiPath(item.image);
  }

  if (item.image) {
    const norm = String(item.image).replace(/\\/g, '/');
    if (norm.startsWith('/assets/products/')) {
      const rest = norm.slice('/assets/products/'.length).split('/').pop();
      const hit = findFileCaseInsensitive(files, rest);
      if (hit) return `/assets/products/${hit}`;
    }
  }

  const tryName = (name) => {
    if (!name || typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const hit = findFileCaseInsensitive(files, trimmed);
    return hit ? `/assets/products/${hit}` : null;
  };

  const tryBaseWithExtensions = (baseRaw) => {
    const base = String(baseRaw || '').trim();
    if (!base) return null;
    const hasExt = IMAGE_EXTENSIONS.includes(path.extname(base).toLowerCase());
    if (hasExt) return tryName(base);
    for (const ext of IMAGE_EXTENSIONS) {
      const hit = tryName(base + ext);
      if (hit) return hit;
    }
    return null;
  };

  const bases = [];
  if (item.image) {
    const norm = String(item.image).replace(/\\/g, '/');
    const bn = path.basename(norm);
    bases.push(bn);
    bases.push(path.parse(bn).name);
  }
  bases.push(productSlug);
  bases.push(`${category}-${slugify(item.name)}`);
  bases.push(slugify(item.name));
  bases.push(`${category}-item-${index + 1}`);
  bases.push(`item-${index + 1}`);

  const seen = new Set();
  for (const b of bases) {
    const key = String(b).trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    const url = tryBaseWithExtensions(key);
    if (url) return url;
  }

  return legacyToImageApiPath(item.image);
}

module.exports = {
  slugify,
  legacyToImageApiPath,
  resolveProductImage,
  readProductFilenames,
};
