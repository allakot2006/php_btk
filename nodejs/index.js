const express = require('express');
const cors = require('cors');
const path = require('path');
const { sql, config } = require('./db');

const home = require('./catalog/home');
const tvs = require('./catalog/tvs');
const audio = require('./catalog/audio');
const laptops = require('./catalog/laptops');
const tablets = require('./catalog/tablets');
const gadgets = require('./catalog/gadgets');
const vacuum = require('./catalog/vacuum');
const games = require('./catalog/games');
const promo = require('./catalog/promo');
const smartphones = require('./catalog/smartphones');

const CATALOG = [
  ['promo', 'Акции', promo],
  ['smartphones', 'Смартфоны', smartphones],
  ['home', 'Товары для дома', home],
  ['tvs', 'Телевизоры', tvs],
  ['gadgets', 'Гаджеты', gadgets],
  ['vacuum', 'Пылесосы', vacuum],
  ['games', 'Видеоигры', games],
  ['audio', 'Аудио', audio],
  ['laptops', 'Ноутбуки', laptops],
  ['tablets', 'Планшеты', tablets],
];

function flatCatalog() {
  const out = [];
  for (const [slug, title, items] of CATALOG) {
    (items || []).forEach((p, idx) => {
      out.push({
        ...p,
        categorySlug: slug,
        categoryTitle: title,
        id: p.id != null ? p.id : null,
        slug: p.slug || `${slug}-${idx + 1}`,
      });
    });
  }
  return out;
}

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const api = express.Router();

api.get('/health', (req, res) => {
  res.json({ ok: true });
});

api.get('/categories', (req, res) => {
  res.json(CATALOG.map(([slug, title]) => ({ id: null, slug, title })));
});

api.get('/search', (req, res) => {
  const q = String(req.query.q || '')
    .trim()
    .toLowerCase();
  if (!q) {
    res.json([]);
    return;
  }
  const flat = flatCatalog();
  const hit = flat.filter((p) => {
    const blob = `${p.name || ''} ${p.description || ''} ${p.brand || ''}`.toLowerCase();
    return blob.includes(q);
  });
  res.json(hit.slice(0, 40));
});

api.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: 'Некорректный id' });
    return;
  }
  const p = flatCatalog().find((x) => Number(x.id) === id);
  if (!p) {
    res.status(404).json({ ok: false, error: 'Товар не найден (нужен PHP API или синхронизация с MySQL)' });
    return;
  }
  res.json(p);
});

api.get('/products', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query('SELECT * FROM Products');
    res.json(result.recordset);
  } catch (err) {
    console.error('Ошибка запроса:', err);
    res.status(500).send('Ошибка сервера: ' + err.message);
  }
});

api.get('/home', (req, res) => {
  res.json(home);
});

api.get('/tvs', (req, res) => {
  res.json(tvs);
});

api.get('/audio', (req, res) => {
  res.json(audio);
});

api.get('/laptops', (req, res) => {
  res.json(laptops);
});

api.get('/tablets', (req, res) => {
  res.json(tablets);
});

api.get('/gadgets', (req, res) => {
  res.json(gadgets);
});

api.get('/vacuum', (req, res) => {
  res.json(vacuum);
});

api.get('/games', (req, res) => {
  res.json(games);
});

api.get('/promo', (req, res) => {
  res.json(promo);
});

api.get('/smartphones', (req, res) => {
  res.json(smartphones);
});

api.use((req, res) => {
  res.status(501).json({
    ok: false,
    error:
      'Этот API-маршрут не обслуживается Node-сервером. Запустите PHP: php -S localhost:8000 router.php',
  });
});

app.use('/api', api);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Сервер: http://localhost:${port}`);
});
