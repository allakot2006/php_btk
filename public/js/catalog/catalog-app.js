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

  function productDetailHref(product, categorySlug) {
    if (product.id != null && Number(product.id) > 0) {
      return `product.html?id=${Number(product.id)}`;
    }
    if (product.slug) {
      return `product.html?slug=${encodeURIComponent(product.slug)}&category=${encodeURIComponent(categorySlug)}`;
    }
    const enc = encodeURIComponent(product.name || '');
    return `product.html?name=${enc}&category=${encodeURIComponent(categorySlug)}`;
  }

  const PRICE_FILTERS = {
    all: () => true,
    '0-500': (p) => p <= 500,
    '500-1000': (p) => p > 500 && p <= 1000,
    '1000-2000': (p) => p > 1000 && p <= 2000,
    '2000-plus': (p) => p > 2000,
  };

  function parseProductFromButton(btn) {
    try {
      return JSON.parse(btn.getAttribute('data-product') || '{}');
    } catch {
      return null;
    }
  }

  function wireProductLinks(container, categorySlug) {
    if (!container) return;
    container.querySelectorAll('[data-product-link]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = parseProductFromButton(btn);
        if (!product || !product.name) return;
        window.location.href = productDetailHref(product, categorySlug);
      });
    });
  }

  function wireAddToCart(container) {
    if (!container) return;
    container.querySelectorAll('[data-add-cart]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cart = window.BeltelecomCart;
        if (!cart || typeof cart.addToCart !== 'function') return;
        const product = parseProductFromButton(btn);
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
        btn.textContent = 'Добавлено';
        window.setTimeout(() => {
          btn.textContent = original;
        }, 1100);
      });
    });
  }

  function renderProductCard(product, opts) {
    const { isPromo, categorySlug } = opts;
    const name = escapeHtml(product.name);
    const desc = escapeHtml(product.description || '');
    const imgSrc = escapeHtml(product.image || PLACEHOLDER);
    const priceStr = formatMoney(product.price);
    const payload = escapeHtml(JSON.stringify(product));

    let extra = '';
    if (isPromo) {
      const original = product.originalPrice ?? product.oldPrice;
      const origNum = Number(original);
      if (original != null && Number.isFinite(origNum) && origNum > 0) {
        extra += `<div class="card__price-old">${formatMoney(origNum)} BYN</div>`;
      }
      extra += `<div class="card__price-promo">${priceStr} BYN</div>`;
    } else {
      extra += `<div class="card__price">${priceStr} BYN</div>`;
    }

    const promoBadge =
      product.discount && isPromo
        ? `<span class="card__badge">−${escapeHtml(product.discount)}%</span>`
        : '';
    const stockTracked =
      product.stockQuantity != null && product.stockQuantity !== '' && Number.isFinite(Number(product.stockQuantity));
    const outOfStock = stockTracked && Number(product.stockQuantity) <= 0;
    const stockBadge = outOfStock
      ? `<span class="card__badge card__badge--stock" title="Нет в наличии">Нет в наличии</span>`
      : '';
    const badges =
      promoBadge || stockBadge
        ? `<div class="card__badges" aria-hidden="true">${promoBadge}${stockBadge}</div>`
        : '';
    const cartDisabled = outOfStock ? ' disabled' : '';
    const cartLabel = outOfStock ? 'Нет в наличии' : 'В корзину';

    return `
      <article class="card card--product ${isPromo ? 'card--promo' : ''} ${outOfStock ? 'card--out-of-stock' : ''}">
        ${badges}
        <div class="card__media">
          <img src="${imgSrc}" alt="${name}" class="card__img" loading="lazy" width="400" height="300" />
        </div>
        <div class="card__body">
          <h3 class="card__title">${name}</h3>
          <p class="card__desc">${desc}</p>
          <div class="card__prices">${extra}</div>
          <div class="card__actions">
            <button type="button" class="btn btn--primary btn--block" data-product-link data-product='${payload}'>Подробнее</button>
            <button type="button" class="btn btn--cart-cta btn--block" data-add-cart data-label="${cartLabel}" data-product='${payload}'${cartDisabled}>
              <span>${cartLabel}</span>
              <img src="/assets/system/корзина.png" alt="" class="btn__icon-right" width="20" height="20" loading="lazy" />
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function runCatalog() {
    const slug = document.body.getAttribute('data-catalog');
    if (!slug) return;

    const isPromo = document.body.getAttribute('data-catalog-mode') === 'promo';
    const useBrand =
      document.body.getAttribute('data-brand-filter') !== 'false' &&
      document.getElementById('brand-select');

    const brandSelect = document.getElementById('brand-select');
    const priceSelect = document.getElementById('price-select');
    const container = document.getElementById('products');
    if (!container) return;

    function loadBrandOptions() {
      if (!brandSelect) return Promise.resolve();
      const currentValue = brandSelect.value || 'all';
      brandSelect.disabled = true;
      brandSelect.replaceChildren();
      const defaultOption = document.createElement('option');
      defaultOption.value = 'all';
      defaultOption.textContent = 'Все бренды';
      brandSelect.appendChild(defaultOption);

      return fetch(`/api/brands?category=${encodeURIComponent(slug)}`, { credentials: 'same-origin' })
        .then((response) => {
          if (!response.ok) throw new Error('network');
          return response.json();
        })
        .then((brands) => {
          if (!Array.isArray(brands)) return;
          brands.forEach((brand) => {
            const option = document.createElement('option');
            option.value = String(brand.title || '');
            option.textContent = String(brand.title || '');
            brandSelect.appendChild(option);
          });
          brandSelect.value = Array.from(brandSelect.options).some((option) => option.value === currentValue)
            ? currentValue
            : 'all';
        })
        .catch(() => {
          brandSelect.value = 'all';
        })
        .finally(() => {
          brandSelect.disabled = false;
        });
    }

    function load() {
      const brand = brandSelect ? brandSelect.value : 'all';
      const priceRange = priceSelect ? priceSelect.value : 'all';

      container.innerHTML = '<p class="catalog__loading">Загрузка…</p>';

      fetch(`/api/${encodeURIComponent(slug)}`, { credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok) throw new Error('network');
          return r.json();
        })
        .then((data) => {
          if (!Array.isArray(data)) throw new Error('bad json');
          let list = data;

          if (useBrand && brand !== 'all') {
            list = list.filter(
              (p) => p.brand && String(p.brand).toLowerCase() === brand.toLowerCase()
            );
          }

          const pf = PRICE_FILTERS[priceRange] || PRICE_FILTERS.all;
          list = list.filter((p) => pf(Number(p.price)));

          if (list.length === 0) {
            container.innerHTML =
              '<p class="catalog__empty">Нет товаров по выбранным условиям.</p>';
            return;
          }

          container.className = 'catalog__grid';
          const linkSlug = isPromo ? 'promo' : slug;
          container.innerHTML = list
            .map((p) => renderProductCard(p, { isPromo, categorySlug: linkSlug }))
            .join('');

          wireProductLinks(container, linkSlug);
          wireAddToCart(container);
        })
        .catch(() => {
          container.innerHTML =
            '<p class="catalog__error">Не удалось загрузить каталог. Проверьте сервер (PHP + MySQL).</p>';
        });
    }

    if (brandSelect) brandSelect.addEventListener('change', load);
    if (priceSelect) priceSelect.addEventListener('change', load);
    loadBrandOptions().finally(load);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runCatalog);
  } else {
    runCatalog();
  }
})();
