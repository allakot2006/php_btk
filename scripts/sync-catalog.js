const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { resolveProductImage, readProductFilenames } = require('./lib/product-image-resolver');

const CATEGORY_TITLES = {
  promo: 'Акции',
  smartphones: 'Смартфоны',
  home: 'Товары для дома',
  tvs: 'Телевизоры',
  gadgets: 'Гаджеты',
  vacuum: 'Пылесосы',
  games: 'Видеоигры',
  audio: 'Аудио',
  laptops: 'Ноутбуки',
  tablets: 'Планшеты',
};

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSlug(category, item, idx) {
  const imageBase = item.image ? path.basename(String(item.image), path.extname(String(item.image))) : '';
  const byImage = slugify(imageBase);
  const byName = slugify(item.name);
  const core = byImage || byName || `item-${idx + 1}`;
  return `${category}-${core}`;
}

async function syncCategory(conn, category, title, items, productsDir) {
  await conn.execute(
    'INSERT INTO categories (slug, title) VALUES (?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title)',
    [category, title]
  );

  const [[cat]] = await conn.execute('SELECT id FROM categories WHERE slug = ?', [category]);
  if (!cat?.id) throw new Error(`Категория ${category} не найдена`);

  const upsertSql = `
    INSERT INTO products (
      category_id, slug, name, description, full_description, price, original_price, discount,
      image, color, brand, specs_json, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      category_id = VALUES(category_id),
      name = VALUES(name),
      description = VALUES(description),
      full_description = VALUES(full_description),
      price = VALUES(price),
      original_price = VALUES(original_price),
      discount = VALUES(discount),
      image = VALUES(image),
      color = VALUES(color),
      brand = VALUES(brand),
      specs_json = VALUES(specs_json),
      is_active = VALUES(is_active)
  `;

  const keepSlugs = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i] || {};
    const name = String(item.name || '').trim();
    if (!name) continue;

    const slug = buildSlug(category, item, i);
    keepSlugs.push(slug);

    const image = resolveProductImage(productsDir, category, item, i, slug);

    await conn.execute(upsertSql, [
      cat.id,
      slug,
      name,
      item.description ? String(item.description) : null,
      item.fullDescription ? String(item.fullDescription) : null,
      Number(item.price || 0),
      item.originalPrice != null ? Number(item.originalPrice) : null,
      item.discount != null ? Number(item.discount) : null,
      image,
      item.color ? String(item.color) : null,
      item.brand ? String(item.brand) : null,
      item.specs && typeof item.specs === 'object' ? JSON.stringify(item.specs) : null,
    ]);
  }

  if (keepSlugs.length > 0) {
    const placeholders = keepSlugs.map(() => '?').join(',');
    await conn.execute(
      `DELETE FROM products WHERE category_id = ? AND slug NOT IN (${placeholders})`,
      [cat.id, ...keepSlugs]
    );
  } else {
    await conn.execute('DELETE FROM products WHERE category_id = ?', [cat.id]);
  }

  return keepSlugs.length;
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(projectRoot, 'config', '.env'));
  const catalogDir = path.join(projectRoot, 'nodejs', 'catalog');
  const productsDir = path.join(projectRoot, 'public', 'assets', 'products');
  const productFiles = readProductFilenames(productsDir);
  if (productFiles.length > 0) {
    console.log(`Фото в public/assets/products: ${productFiles.length} файл(ов) — пути в БД будут /assets/products/...`);
  } else {
    console.log('Папка public/assets/products пуста — для изображений используются пути из каталога (images/…).');
  }

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'beltelecom_shop',
    charset: 'utf8mb4',
  });

  try {
    await conn.beginTransaction();
    const results = [];

    for (const [category, title] of Object.entries(CATEGORY_TITLES)) {
      const filePath = path.join(catalogDir, `${category}.js`);
      if (!fs.existsSync(filePath)) continue;
      const items = require(filePath);
      if (!Array.isArray(items)) continue;

      const count = await syncCategory(conn, category, title, items, productsDir);
      results.push(`${category}: ${count}`);
    }

    await conn.commit();
    console.log('Synced categories -> ' + results.join(', '));
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
