const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { resolveProductImage } = require('./lib/product-image-resolver');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function slugify(name, idx) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base ? `smartphones-${base}-${idx + 1}` : `smartphones-item-${idx + 1}`;
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(projectRoot, 'config', '.env'));
  const productsDir = path.join(projectRoot, 'public', 'assets', 'products');
  const smartphones = require(path.join(projectRoot, 'nodejs', 'catalog', 'smartphones.js'));

  if (!Array.isArray(smartphones) || smartphones.length === 0) {
    throw new Error('nodejs/catalog/smartphones.js пуст или имеет неверный формат');
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
    await conn.execute(
      'INSERT INTO categories (slug, title) VALUES (?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title)',
      ['smartphones', 'Смартфоны']
    );

    const [[category]] = await conn.execute('SELECT id FROM categories WHERE slug = ?', ['smartphones']);
    if (!category?.id) throw new Error('Категория smartphones не найдена');

    const sql = `
      INSERT INTO products (
        category_id, slug, name, description, full_description, price, original_price, discount,
        image, color, brand, specs_json, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
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

    for (let i = 0; i < smartphones.length; i += 1) {
      const item = smartphones[i] || {};
      const name = String(item.name || '').trim();
      if (!name) continue;

      const slug = slugify(name, i);
      const description = item.description ? String(item.description) : null;
      const fullDescription = item.fullDescription ? String(item.fullDescription) : null;
      const price = Number(item.price || 0);
      const image = resolveProductImage(productsDir, 'smartphones', item, i, slug);
      const brand = item.brand ? String(item.brand) : null;
      const specs = item.specs && typeof item.specs === 'object' ? JSON.stringify(item.specs) : null;

      await conn.execute(sql, [
        category.id,
        slug,
        name,
        description,
        fullDescription,
        price,
        null,
        null,
        image,
        null,
        brand,
        specs,
      ]);
    }

    console.log(`Synced smartphones: ${smartphones.length}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
