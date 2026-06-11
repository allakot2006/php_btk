/**
 * Добавляет в public/assets/products/*.json карточки для каждого JPG/PNG/WebP
 * в этой папке, если для файла ещё нет товара с таким image.
 * Запуск: node tools/sync-product-images-to-json.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'assets', 'products');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** Явная категория, если эвристика ошиблась (имя файла как в папке). */
const CATEGORY_OVERRIDES = {
  'tcl_50_pro_nxtpaper.jpg': 'smartphones',
};

const DESCRIPTION_OVERRIDES = {
  'realme_12.jpg':
    'Смартфон Realme 12 в стильном градиентном фиолетовом (лаванда) цвете. Матовая задняя панель с лёгким переливом, крупный круглый блок камер с тремя объективами и вспышкой, вертикальная декоративная линия по центру корпуса, логотип realme снизу.',
  'realme_12_pro_plus.jpg':
    'Realme 12 Pro+ в отделке Submarine Blue: премиальная задняя панель под веган-кожу, круглый модуль камеры в стиле люксовых часов с золотистым флутированным ободком, изогнутый 120 Hz Curved Vision Display, тонкий корпус с металлическими акцентами.',
  'realme_12 (1).png':
    'Смартфон Realme 12 — альтернативное фото (градиентный фиолетовый корпус, круглый блок камер, матовая поверхность).',
  'tcl_50_pro_nxtpaper.jpg':
    'Смартфон TCL 50 Pro NXTPAPER с дисплеем с эффектом «электронной бумаги»: комфортное чтение, сниженный блик, высокая детализация. Карточка по фото из каталога.',
};

function slugFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const s = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `seed-img-${s || 'photo'}`;
}

function prettyTitle(filename) {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryForFile(name) {
  const o = CATEGORY_OVERRIDES[path.basename(name)];
  if (o) return o;
  const n = name.toLowerCase();
  if (/^store\d\.|^na-sajt|^img-news/.test(n)) return 'promo';
  if (/redmibook|acer_|asus_vivobook|dell_|hp_|macbook|galaxy_book|lenovo_ideapad/.test(n)) return 'laptops';
  if (/ipad_|galaxy_tab|honor_pad|lenovo_tab|realme_pad|xiaomi_pad/.test(n)) return 'tablets';
  if (
    /^lg_|samsung_tv|samsung_qe|samsung_ue|sony_kd|philips_|^tcl_|^tcl\d|tcl_50|xiaomi_tv/.test(n)
  )
    return 'tvs';
  if (/dreame_|xiaomi_robot|xiaomi_handheld/.test(n)) return 'vacuum';
  if (/ps5|dualsense|switch_|steam_deck|xbox_/.test(n)) return 'games';
  if (/airpods|galaxy_buds|honor_earbuds|jbl_|redmi_buds|realme_buds|sony_wh/.test(n)) return 'audio';
  if (/apple_watch|galaxy_watch|mi_band|honor_band|honor_watch|airtag|galaxy_smarttag/.test(n))
    return 'gadgets';
  if (
    /xiaomi_(kettle|lamp|fan|humidifier|socket|scale|door|curtain|camera|smart_air)/.test(n)
  )
    return 'home';
  if (
    /iphone_|^samsung_a\d|redmi_|^poco_|realme_(?!buds|pad)|honor_[x0-9]|honor_200|honor_400|xiaomi_15\.|tecno_|infinix_/.test(
      n
    )
  )
    return 'smartphones';
  if (n.includes('realme_12')) return 'smartphones';
  return null;
}

function brandForFile(name) {
  const n = name.toLowerCase();
  if (/iphone|ipad|macbook|airpods|apple_watch/.test(n)) return 'apple';
  if (/samsung|galaxy_/.test(n)) return 'samsung';
  if (/redmi|poco|xiaomi_|mi_band/.test(n)) return 'xiaomi';
  if (/realme/.test(n)) return 'realme';
  if (/honor/.test(n)) return 'honor';
  if (/tecno/.test(n)) return 'tecno';
  if (/infinix/.test(n)) return 'infinix';
  if (/^lg_/.test(n)) return 'lg';
  if (/sony_|sony_wh/.test(n)) return 'sony';
  if (/philips/.test(n)) return 'philips';
  if (/tcl/.test(n)) return 'tcl';
  if (/jbl/.test(n)) return 'jbl';
  if (/asus/.test(n)) return 'asus';
  if (/acer/.test(n)) return 'acer';
  if (/dell/.test(n)) return 'dell';
  if (/hp_/.test(n)) return 'hp';
  if (/lenovo/.test(n)) return 'lenovo';
  if (/dreame/.test(n)) return 'dreame';
  if (/ps5|dualsense/.test(n)) return 'sony';
  if (/switch|steam/.test(n)) return 'nintendo';
  if (/xbox/.test(n)) return 'microsoft';
  return 'demo';
}

function defaultPrice(category) {
  const m = {
    promo: 49,
    smartphones: 699,
    tablets: 549,
    laptops: 2499,
    tvs: 1299,
    gadgets: 199,
    audio: 129,
    vacuum: 399,
    games: 899,
    home: 79,
  };
  return m[category] ?? 199;
}

function defaultDescription(filename, category, title) {
  const o = DESCRIPTION_OVERRIDES[path.basename(filename)];
  if (o) return o;
  const catRu = {
    promo: 'Промо-материал или фото витрины.',
    smartphones: 'Смартфон — карточка по фотографии из каталога.',
    tablets: 'Планшет — карточка по фотографии из каталога.',
    laptops: 'Ноутбук — карточка по фотографии из каталога.',
    tvs: 'Телевизор — карточка по фотографии из каталога.',
    gadgets: 'Носимый гаджет или аксессуар — карточка по фото.',
    audio: 'Аудиотехника — карточка по фотографии из каталога.',
    vacuum: 'Техника для уборки — карточка по фото.',
    games: 'Игровая техника или аксессуар — карточка по фото.',
    home: 'Товар для дома и умный дом — карточка по фото.',
  };
  return `${title}. ${catRu[category] ?? 'Товар — карточка по фотографии из каталога.'} Уточняйте комплектацию и цену у менеджера.`;
}

function collectImageBasenamesFromJson(data) {
  const set = new Set();
  const items = data.products ?? data.items;
  if (!Array.isArray(items)) return set;
  for (const p of items) {
    const img = p.image;
    if (typeof img !== 'string' || !img.includes('/assets/products/')) continue;
    const base = img.split('/').pop();
    if (base) set.add(base);
  }
  return set;
}

function main() {
  const jsonFiles = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => f.endsWith('.json') && /^[a-z0-9_-]+\.json$/.test(f));

  const byCategory = {};
  for (const f of jsonFiles) {
    const slug = f.replace(/\.json$/, '');
    const raw = fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8');
    byCategory[slug] = JSON.parse(raw);
  }

  const allImages = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .filter((f) => f !== '.gitkeep');

  const globalUsed = new Set();
  for (const data of Object.values(byCategory)) {
    for (const b of collectImageBasenamesFromJson(data)) globalUsed.add(b);
  }

  for (const filename of allImages) {
    if (globalUsed.has(filename)) continue;
    const cat = categoryForFile(filename);
    if (!cat || !byCategory[cat]) continue;
    const title = prettyTitle(filename);
    const desc = defaultDescription(filename, cat, title);
    const slug = slugFromFilename(filename);
    const imagePath = `/assets/products/${filename}`;
    const product = {
      slug,
      name: title,
      description: desc.slice(0, 160) + (desc.length > 160 ? '…' : ''),
      full_description: desc,
      price: defaultPrice(cat),
      image: imagePath,
      color: '—',
      brand: brandForFile(filename),
      specs: {
        Фото: filename,
        Папка: 'public/assets/products',
      },
    };
    byCategory[cat].products.push(product);
    globalUsed.add(filename);
  }

  for (const slug of Object.keys(byCategory)) {
    const data = byCategory[slug];
    const items = data.products ?? [];
    const imgs = new Set(data.local_images ?? []);
    for (const p of items) {
      if (typeof p.image === 'string' && p.image.includes('/assets/products/')) {
        const b = p.image.split('/').pop();
        if (b && IMAGE_EXT.has(path.extname(b).toLowerCase())) imgs.add(b);
      }
    }
    data.local_images = [...imgs].sort((a, b) => a.localeCompare(b, 'en'));
    const out = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(path.join(PRODUCTS_DIR, `${slug}.json`), out, 'utf8');
  }

  console.log('Updated category JSON files from images in public/assets/products/');
}

main();
