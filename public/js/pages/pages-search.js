(function () {
  'use strict';

  const PLACEHOLDER = '/assets/system/placeholder-product.svg';
  const api = window.BeltelecomAuth && window.BeltelecomAuth.api;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('q') || '').trim();
    const form = document.querySelector('.search-page-form');
    const input = document.getElementById('search-q');
    const suggestBox = document.getElementById('search-suggest-list');
    const box = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    if (input) input.value = q;

    function searchProducts(query) {
      const endpoint = '/api/search?q=' + encodeURIComponent(query);
      if (typeof api === 'function') {
        return api(endpoint);
      }
      return fetch(endpoint, { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error('search failed');
        return r.json();
      });
    }

    function suggestProducts(query) {
      const endpoint = '/api/search/suggest?q=' + encodeURIComponent(query);
      if (typeof api === 'function') {
        return api(endpoint);
      }
      return fetch(endpoint, { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error('suggest failed');
        return r.json();
      });
    }

    function productHref(product) {
      const id = product.id != null && Number(product.id) > 0 ? Number(product.id) : null;
      if (id) return `product.html?id=${id}`;
      if (product.slug) {
        return `product.html?slug=${encodeURIComponent(product.slug)}&category=${encodeURIComponent(product.categorySlug || 'promo')}`;
      }
      return `product.html?name=${encodeURIComponent(product.name || '')}&category=${encodeURIComponent(product.categorySlug || 'promo')}`;
    }

    function getSearchErrorMessage(error) {
      const raw = error && error.message ? String(error.message).trim() : '';
      if (
        window.location.protocol === 'file:' ||
        /failed to fetch|networkerror|load failed/i.test(raw)
      ) {
        return 'Поиск недоступен без PHP-сервера. Запустите сайт через php -S localhost:8000 router.php.';
      }
      if (raw && raw !== 'search failed' && raw !== 'Ошибка запроса') {
        return raw;
      }
      return 'Не удалось выполнить поиск. Проверьте, что PHP API и база данных доступны.';
    }

    let suggestTimer = 0;
    let suggestReqId = 0;
    let activeSuggestIndex = -1;
    let suggestItems = [];

    function closeSuggest() {
      if (!suggestBox || !input) return;
      suggestItems = [];
      activeSuggestIndex = -1;
      suggestBox.innerHTML = '';
      suggestBox.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function applyActiveSuggest() {
      if (!suggestBox || !input) return;
      const buttons = suggestBox.querySelectorAll('.search-suggest__item');
      buttons.forEach((btn, idx) => {
        const active = idx === activeSuggestIndex;
        btn.classList.toggle('is-active', active);
        if (active) {
          input.setAttribute('aria-activedescendant', btn.id);
        }
      });
      if (activeSuggestIndex < 0) {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function renderSuggest(items) {
      if (!suggestBox || !input) return;
      suggestItems = Array.isArray(items) ? items : [];
      if (suggestItems.length === 0) {
        closeSuggest();
        return;
      }
      activeSuggestIndex = -1;
      suggestBox.innerHTML = suggestItems
        .map((product, idx) => {
          const name = esc(product.name || '');
          const category = esc(product.categoryTitle || '');
          return `
            <button type="button" id="search-suggest-item-${idx}" class="search-suggest__item" role="option" data-index="${idx}">
              <span class="search-suggest__title">${name}</span>
              <span class="search-suggest__meta">${category}</span>
            </button>`;
        })
        .join('');
      suggestBox.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function runSuggest(query) {
      const text = String(query || '').trim();
      if (text.length < 1) {
        closeSuggest();
        return;
      }
      const reqId = ++suggestReqId;
      suggestProducts(text)
        .then((items) => {
          if (reqId !== suggestReqId) return;
          renderSuggest(items);
        })
        .catch(() => {
          if (reqId !== suggestReqId) return;
          closeSuggest();
        });
    }

    if (input && suggestBox) {
      input.addEventListener('input', () => {
        clearTimeout(suggestTimer);
        suggestTimer = window.setTimeout(() => runSuggest(input.value), 140);
      });

      input.addEventListener('keydown', (event) => {
        if (suggestBox.hidden || suggestItems.length === 0) return;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          activeSuggestIndex = (activeSuggestIndex + 1) % suggestItems.length;
          applyActiveSuggest();
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          activeSuggestIndex = activeSuggestIndex <= 0 ? suggestItems.length - 1 : activeSuggestIndex - 1;
          applyActiveSuggest();
          return;
        }
        if (event.key === 'Enter' && activeSuggestIndex >= 0 && suggestItems[activeSuggestIndex]) {
          event.preventDefault();
          window.location.href = productHref(suggestItems[activeSuggestIndex]);
          return;
        }
        if (event.key === 'Escape') {
          closeSuggest();
        }
      });

      suggestBox.addEventListener('mousedown', (event) => {
        const target = event.target && event.target.closest ? event.target.closest('.search-suggest__item') : null;
        if (!target) return;
        event.preventDefault();
        const idx = Number(target.getAttribute('data-index'));
        if (!Number.isInteger(idx) || !suggestItems[idx]) return;
        window.location.href = productHref(suggestItems[idx]);
      });

      document.addEventListener('click', (event) => {
        const t = event.target;
        if (t === input || suggestBox.contains(t)) return;
        closeSuggest();
      });

      if (form) {
        form.addEventListener('submit', () => closeSuggest());
      }
    }

    if (!q) {
      if (status) status.textContent = 'Введите запрос в поле выше или в шапке сайта.';
      return;
    }

    if (status) status.textContent = 'Загрузка…';
    searchProducts(q)
      .then((data) => {
        closeSuggest();
        if (!Array.isArray(data) || data.length === 0) {
          if (box) box.innerHTML = '';
          if (status) status.textContent = 'Ничего не найдено. Попробуйте другой запрос.';
          return;
        }
        if (status) status.textContent = 'Найдено: ' + data.length;
        if (!box) return;
        box.className = 'catalog__grid';
        box.innerHTML = data
          .map((product) => {
            const catTitle = esc(product.categoryTitle || '');
            const name = esc(product.name || '');
            const desc = esc(product.description || '');
            const priceNum = Number(product.price);
            const priceLabel = Number.isFinite(priceNum)
              ? priceNum.toLocaleString('ru-RU') + ' BYN'
              : esc(String(product.price ?? '')) + ' BYN';
            const img = esc(product.image || PLACEHOLDER);
            const href = productHref(product);
            return `
              <article class="card card--product">
                <div class="card__media">
                  <img src="${img}" alt="" class="card__img" loading="lazy" width="400" height="300" />
                </div>
                <div class="card__body">
                  <p class="card__eyebrow">${catTitle}</p>
                  <h3 class="card__title">${name}</h3>
                  <p class="card__desc">${desc}</p>
                  <p class="card__price">${priceLabel}</p>
                  <a class="btn btn--primary btn--block" href="${href}">Подробнее</a>
                </div>
              </article>`;
          })
          .join('');
      })
      .catch((error) => {
        closeSuggest();
        if (box) box.innerHTML = '';
        if (status) status.textContent = getSearchErrorMessage(error);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
