(function () {
  'use strict';

  const PLACEHOLDER = '/assets/system/placeholder-product.svg';

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMoney(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('ru-RU') : String(v ?? '');
  }

  function productHref(product) {
    if (product.id != null && Number(product.id) > 0) {
      return `product.html?id=${Number(product.id)}`;
    }
    const categorySlug = encodeURIComponent(product.categorySlug || 'promo');
    if (product.slug) {
      return `product.html?slug=${encodeURIComponent(product.slug)}&category=${categorySlug}`;
    }
    const enc = encodeURIComponent(product.name || '');
    return `product.html?name=${enc}&category=${categorySlug}`;
  }

  function loadHotOffers() {
    const container = document.getElementById('hot-offers');
    if (!container) return;

    fetch('/api/promo', { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('promo failed');
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          container.innerHTML = '<p class="catalog__empty">Пока нет акций в каталоге.</p>';
          return;
        }
        const slice = data.slice(0, 6);
        container.className = 'catalog__grid catalog__grid--home';
        container.innerHTML = slice
          .map((product) => {
            const name = escapeHtml(product.name);
            const desc = escapeHtml(product.description || '');
            const img = escapeHtml(product.image || PLACEHOLDER);
            const origNum = Number(product.originalPrice);
            const orig =
              product.originalPrice != null && Number.isFinite(origNum) && origNum > 0
                ? `<span class="card__price-old">${formatMoney(origNum)} BYN</span>`
                : '';
            const disc = product.discount
              ? `<span class="card__badge">−${escapeHtml(product.discount)}%</span>`
              : '';
            const priceNum = Number(product.price);
            const priceLabel = Number.isFinite(priceNum) ? formatMoney(priceNum) : String(product.price ?? '');
            const payload = escapeHtml(JSON.stringify(product));
            const stockTracked =
              product.stockQuantity != null && product.stockQuantity !== '' && Number.isFinite(Number(product.stockQuantity));
            const outOfStock = stockTracked && Number(product.stockQuantity) <= 0;
            const cartLabel = outOfStock ? 'Нет в наличии' : 'В корзину';
            return `
              <article class="card card--product card--promo">
                ${disc}
                <div class="card__media">
                  <img src="${img}" alt="${name}" class="card__img" loading="lazy" width="400" height="300" />
                </div>
                <div class="card__body">
                  <h3 class="card__title">${name}</h3>
                  <p class="card__desc">${desc}</p>
                  <div class="card__prices">${orig}<span class="card__price-promo">${priceLabel} BYN</span></div>
                  <div class="card__actions">
                    <button type="button" class="btn btn--primary btn--block" data-hot-pick data-payload='${payload}'>Подробнее</button>
                    <button type="button" class="btn btn--cart-cta btn--block" data-hot-cart data-label="${cartLabel}" data-payload='${payload}'${outOfStock ? ' disabled' : ''}>
                      <span class="btn__text">${cartLabel}</span>
                      <img src="/assets/system/корзина.png" alt="" class="btn__icon-right" width="20" height="20" loading="lazy" />
                    </button>
                  </div>
                </div>
              </article>`;
          })
          .join('');

        container.querySelectorAll('[data-hot-pick]').forEach((btn) => {
          btn.addEventListener('click', () => {
            try {
              const product = JSON.parse(btn.getAttribute('data-payload') || '{}');
              if (product.name) window.location.href = productHref(product);
            } catch (_) {}
          });
        });
        container.querySelectorAll('[data-hot-cart]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const cart = window.BeltelecomCart;
            if (!cart || typeof cart.addToCart !== 'function') return;
            try {
              const product = JSON.parse(btn.getAttribute('data-payload') || '{}');
              if (!product || !product.name) return;
              cart.addToCart({
                productId: product.id ?? null,
                slug: product.slug ?? null,
                name: product.name,
                price: product.price,
                image: product.image ?? null,
                stockQuantity: product.stockQuantity ?? null,
              }, 1);
              const original = btn.getAttribute('data-label') || 'В корзину';
              const textNode = btn.querySelector('.btn__text');
              if (textNode) textNode.textContent = 'Добавлено';
              window.setTimeout(() => {
                if (textNode) textNode.textContent = original;
              }, 1100);
            } catch (_) {}
          });
        });
      })
      .catch(() => {
        container.innerHTML =
          '<p class="catalog__error">Акции временно недоступны.</p>';
      });
  }

  function loadDbProducts() {
    const container = document.getElementById('products');
    if (!container) return;

    fetch('/api/products', { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('products failed');
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;
        container.innerHTML = '<h2 class="section-title">Новинки из каталога</h2><div class="catalog__grid catalog__grid--dense"></div>';
        const grid = container.querySelector('.catalog__grid');
        grid.innerHTML = data
          .slice(0, 8)
          .map((p) => {
            const name = escapeHtml(p.name);
            const price = formatMoney(p.price);
            const img = escapeHtml(p.image || PLACEHOLDER);
            const href = escapeHtml(productHref(p));
            return `
              <article class="card card--compact">
                <div class="card__media card__media--sm">
                  <img src="${img}" alt="" class="card__img" loading="lazy" />
                </div>
                <div class="card__body">
                  <h3 class="card__title card__title--sm">${name}</h3>
                  <p class="card__price">${price} BYN</p>
                  <a class="btn btn--ghost btn--sm" href="${href}">Открыть</a>
                </div>
              </article>`;
          })
          .join('');
      })
      .catch(() => {});
  }

  function loadCategoryTiles() {
    const wrap = document.getElementById('category-tiles');
    if (!wrap) return;

    fetch('/api/categories', { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('categories failed');
        return r.json();
      })
      .then((cats) => {
        if (!Array.isArray(cats)) return;
        wrap.innerHTML = cats
          .map((c) => {
            const href = escapeHtml(`${String(c.slug || 'promo')}.html`);
            const title = escapeHtml(c.title || c.slug);
            return `<a class="tile" href="${href}"><span class="tile__title">${title}</span><span class="tile__meta">Перейти</span></a>`;
          })
          .join('');
      })
      .catch(() => {});
  }

  function init() {
    loadHotOffers();
    loadDbProducts();
    loadCategoryTiles();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
