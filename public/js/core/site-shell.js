(function () {
  'use strict';

  const PLACEHOLDER_IMG = '/assets/system/placeholder-product.svg';

  function sysAsset(filename) {
    return '/assets/system/' + String(filename).replace(/^\/+/, '');
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function productHref(product) {
    const id = product && product.id != null && Number(product.id) > 0 ? Number(product.id) : null;
    if (id) return `product.html?id=${id}`;
    if (product && product.slug) {
      return `product.html?slug=${encodeURIComponent(product.slug)}&category=${encodeURIComponent(product.categorySlug || 'promo')}`;
    }
    return `product.html?name=${encodeURIComponent((product && product.name) || '')}&category=${encodeURIComponent((product && product.categorySlug) || 'promo')}`;
  }

  function cartCount() {
    try {
      const cart = window.BeltelecomCart;
      if (!cart || typeof cart.loadCart !== 'function') return 0;
      return cart.loadCart().reduce((n, it) => n + (Number(it.qty) || 0), 0);
    } catch {
      return 0;
    }
  }

  function updateCartBadge() {
    const el = document.getElementById('shell-cart-badge');
    if (!el) return;
    const n = cartCount();
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n === 0;
  }

  function wireImageFallback() {
    document.addEventListener(
      'error',
      (e) => {
        const t = e.target;
        if (!t || t.tagName !== 'IMG' || t.dataset.imgFallback === '1') return;
        if (String(t.src || '').includes('placeholder-product')) return;
        t.dataset.imgFallback = '1';
        t.src = PLACEHOLDER_IMG;
      },
      true
    );
  }

  const MENU = [
    { href: 'promo.html', label: 'Акции', description: 'Скидки, выгодные предложения и подборки' },
    { href: 'smartphones.html', label: 'Смартфоны', description: 'Android, iPhone и популярные бренды' },
    { href: 'home.html', label: 'Для дома', description: 'Умная техника и устройства для комфорта' },
    { href: 'tvs.html', label: 'Телевизоры', description: 'Smart TV и модели для гостиной' },
    { href: 'gadgets.html', label: 'Гаджеты', description: 'Носимые устройства и аксессуары' },
    { href: 'vacuum.html', label: 'Пылесосы', description: 'Роботы и техника для уборки' },
    { href: 'games.html', label: 'Игры', description: 'Консоли, геймпады и игровые устройства' },
    { href: 'audio.html', label: 'Аудио', description: 'Наушники, колонки и звук для дома' },
    { href: 'laptops.html', label: 'Ноутбуки', description: 'Модели для работы, учебы и дома' },
    { href: 'tablets.html', label: 'Планшеты', description: 'Планшеты для контента и мобильной работы' },
  ];

  const SERVICE_LINKS = [
    { href: 'search.html', label: 'Поиск' },
    { href: 'cart.html', label: 'Корзина' },
    { href: 'account.html', label: 'Личный кабинет' },
    { href: 'help.html', label: 'Справка' },
    { href: 'contacts.html', label: 'Контакты' },
    { href: 'about.html', label: 'О магазине' },
  ];

  function navActive(href, activePage) {
    const file = href.split('/').pop();
    if (file === 'admin-products.html' && ['admin.html', 'admin-products.html', 'admin-users.html'].includes(activePage)) {
      return ' is-active';
    }
    if (file === 'moderator-products.html' && ['moderator.html', 'moderator-products.html'].includes(activePage)) {
      return ' is-active';
    }
    return file === activePage ? ' is-active' : '';
  }

  function isStorefrontPage(activePage) {
    return ![
      'admin.html',
      'admin-products.html',
      'admin-users.html',
      'moderator.html',
      'moderator-products.html',
      'login.html',
    ].includes(activePage);
  }

  function renderCatalogMega(activePage) {
    const items = MENU.map(
      (m) =>
        `<a class="shell-menu__card${navActive(m.href, activePage)}" href="${m.href}">
          <span class="shell-menu__card-title">${m.label}</span>
          <span class="shell-menu__card-text">${m.description}</span>
        </a>`
    ).join('');

    return `<div class="shell-mega__panel" id="shell-mega-panel" role="region" aria-label="Разделы каталога">
      <div class="shell-mega__intro">
        <strong>Быстрый переход по разделам</strong>
        <span>Откройте нужную категорию без лишних переходов.</span>
      </div>
      <div class="shell-mega__grid">${items}</div>
    </div>`;
  }

  function renderCatalogRail(activePage) {
    if (!isStorefrontPage(activePage)) return '';

    const chips = MENU.map(
      (m) => `<a class="shell-catalog-rail__link${navActive(m.href, activePage)}" href="${m.href}">${m.label}</a>`
    ).join('');

    return `<div class="shell-catalog-rail" aria-label="Быстрый переход по каталогу">
      <div class="shell-catalog-rail__inner">
        <span class="shell-catalog-rail__label">Каталог</span>
        <div class="shell-catalog-rail__links">${chips}</div>
      </div>
    </div>`;
  }

  function renderHeader(activePage) {
    return `<a href="#main" class="shell-skip">К содержимому</a>
<header class="shell-header">
  <div class="shell-header__bar">
    <a class="shell-brand" href="index.html" aria-label="Beltelecom Shop — главная">
      <img src="${sysAsset('логотип.png')}" width="160" height="42" alt="Beltelecom Shop" decoding="async" class="shell-brand__logo" />
      <span class="shell-brand__meta">
        <span class="shell-brand__name">Beltelecom Shop</span>
      </span>
    </a>
    <button type="button" class="shell-burger" id="shell-burger" aria-expanded="false" aria-controls="shell-drawer" aria-label="Меню">
      <span></span><span></span><span></span>
    </button>
    <div class="shell-drawer" id="shell-drawer">
      <div class="shell-header__primary">
        <form class="shell-search" action="search.html" method="get" role="search">
          <label class="visually-hidden" for="shell-search-q">Поиск</label>
          <div class="shell-search__field">
            <input id="shell-search-q" type="search" name="q" placeholder="Найти товар…" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="shell-search-suggest-list" />
            <div id="shell-search-suggest-list" class="search-suggest" role="listbox" hidden></div>
          </div>
          <button type="submit" class="btn btn--primary btn--sm">Найти</button>
        </form>
        <div class="shell-actions" aria-label="Быстрые действия">
          <a class="shell-action shell-action--cart${navActive('cart.html', activePage)}" href="cart.html">
            <span class="shell-action__label">Корзина</span>
            <span class="shell-badge" id="shell-cart-badge" hidden>0</span>
          </a>
          <a class="shell-action${navActive('account.html', activePage)}" href="account.html"><span data-shell-account-label>Кабинет</span></a>
          <a class="shell-action${['admin.html', 'admin-products.html', 'admin-users.html', 'admin-brands.html', 'admin-requests.html', 'admin-orders.html', 'moderator.html', 'moderator-products.html', 'moderator-brands.html', 'moderator-requests.html', 'moderator-orders.html'].includes(activePage) ? ' is-active' : ''}" href="admin-products.html" data-shell-staff-link hidden>Панель</a>
          <a class="shell-action${navActive('login.html', activePage)}" href="login.html" data-shell-login-link>Вход</a>
          <button type="button" class="shell-action shell-nav__button" data-shell-logout-link hidden>Выйти</button>
        </div>
      </div>
      <nav class="shell-nav" aria-label="Основное меню">
        <a class="shell-nav__link${navActive('index.html', activePage)}" href="index.html">Главная</a>
        <div class="shell-mega" id="shell-mega">
          <button type="button" class="shell-mega__toggle" id="shell-mega-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="shell-mega-panel">
            Каталог
            <span class="shell-mega__chev" aria-hidden="true"></span>
          </button>
          ${renderCatalogMega(activePage)}
        </div>
        <a class="shell-nav__link${navActive('promo.html', activePage)}" href="promo.html">Акции</a>
        <a class="shell-nav__link${navActive('search.html', activePage)}" href="search.html">Поиск</a>
        <a class="shell-nav__link${navActive('help.html', activePage)}" href="help.html">Справка</a>
        <a class="shell-nav__link${navActive('about.html', activePage)}" href="about.html">О магазине</a>
        <a class="shell-nav__link${navActive('contacts.html', activePage)}" href="contacts.html">Контакты</a>
      </nav>
    </div>
  </div>
</header>${renderCatalogRail(activePage)}`;
  }

  function renderFooter() {
    const catalogLinks = MENU.map((m) => `<li><a href="${m.href}">${m.label}</a></li>`).join('');
    const serviceLinks = SERVICE_LINKS.map((m) => `<li><a href="${m.href}">${m.label}</a></li>`).join('');

    return `<footer class="shell-footer">
  <div class="shell-footer__inner">
    <div class="shell-footer__col shell-footer__col--brand">
      <div class="shell-footer__brand-block">
        <img src="${sysAsset('лого2.png')}" width="64" height="64" alt="Beltelecom Shop" decoding="async" class="shell-footer__logo" />
        <div>
          <div class="shell-footer__brand">Beltelecom Shop</div>
          <p class="shell-footer__tag">Техника для дома, работы и отдыха</p>
        </div>
      </div>
      <p class="shell-footer__text">Удобный каталог, понятные карточки товаров, быстрый поиск и оформление заказа в несколько шагов.</p>
      <div class="shell-footer__actions">
        <a class="shell-footer__button shell-footer__button--primary" href="promo.html">Смотреть акции</a>
        <a class="shell-footer__button" href="search.html">Перейти в каталог</a>
      </div>
    </div>
    <div class="shell-footer__col">
      <div class="shell-footer__title">Каталог</div>
      <ul class="shell-footer__list shell-footer__list--catalog">${catalogLinks}</ul>
    </div>
    <div class="shell-footer__col">
      <div class="shell-footer__title">Покупателю</div>
      <ul class="shell-footer__list">${serviceLinks}</ul>
      <div class="shell-footer__contact-card">
        <span class="shell-footer__contact-label">Нужна помощь?</span>
        <a href="contacts.html">Связаться с нами</a>
        <p class="shell-footer__contact-text">Подскажем по наличию, выбору техники и оформлению заказа.</p>
      </div>
    </div>
  </div>
  <div class="shell-footer__bottom">
    <p class="shell-footer__copy">© Beltelecom Shop</p>
    <p class="shell-footer__meta">Каталог электроники и техники с удобной навигацией и личным кабинетом.</p>
  </div>
</footer>`;
  }

  async function refreshAuthNav(userHint) {
    const loginLink = document.querySelector('[data-shell-login-link]');
    const logoutLink = document.querySelector('[data-shell-logout-link]');
    const accLabel = document.querySelector('[data-shell-account-label]');
    const adminLink = document.querySelector('[data-shell-staff-link]');
    function hasStaffRole(user) {
      if (!user || typeof user !== 'object') return false;
      const isAdmin = user.isAdmin === true || user.isAdmin === 1 || user.isAdmin === '1';
      const isModerator = user.isModerator === true || user.isModerator === 1 || user.isModerator === '1';
      return isAdmin || isModerator;
    }

    function hideStaffLink() {
      if (!adminLink) return;
      adminLink.hidden = true;
      adminLink.style.display = 'none';
    }

    const auth = window.BeltelecomAuth;
    if (!auth || typeof auth.api !== 'function') {
      if (accLabel) accLabel.textContent = 'Кабинет';
      hideStaffLink();
      if (logoutLink) logoutLink.hidden = true;
      return;
    }
    try {
      let user = userHint;
      if (userHint === undefined) {
        const data = await auth.api('/api/auth/me');
        user = data && data.user ? data.user : null;
      }
      if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (logoutLink) logoutLink.hidden = false;
        if (accLabel) {
          accLabel.textContent = 'Кабинет';
          accLabel.parentElement && (accLabel.parentElement.title = user.name || user.email || 'Кабинет');
        }
        if (adminLink) {
          if (user.isAdmin === true || user.isAdmin === 1 || user.isAdmin === '1') {
            adminLink.hidden = false;
            adminLink.style.display = '';
            adminLink.textContent = 'Админ';
            adminLink.href = 'admin-products.html';
          } else if (user.isModerator === true || user.isModerator === 1 || user.isModerator === '1') {
            adminLink.hidden = false;
            adminLink.style.display = '';
            adminLink.textContent = 'Модератор';
            adminLink.href = 'moderator-products.html';
          } else {
            hideStaffLink();
          }
        }
        if (!hasStaffRole(user)) {
          hideStaffLink();
        }
      } else {
        if (loginLink) loginLink.style.display = '';
        if (logoutLink) logoutLink.hidden = true;
        if (accLabel) accLabel.textContent = 'Кабинет';
        hideStaffLink();
      }
    } catch {
      if (loginLink) loginLink.style.display = '';
      if (logoutLink) logoutLink.hidden = true;
      if (accLabel) accLabel.textContent = 'Кабинет';
      hideStaffLink();
    }
  }

  function mountShell() {
    const active = document.body.getAttribute('data-active') || '';
    const head = document.getElementById('shell-header');
    const foot = document.getElementById('shell-footer');
    if (head) head.outerHTML = renderHeader(active);
    if (foot) foot.outerHTML = renderFooter();

    const burger = document.getElementById('shell-burger');
    const drawer = document.getElementById('shell-drawer');
    const mega = document.getElementById('shell-mega');
    const megaToggle = document.getElementById('shell-mega-toggle');
    const megaPanel = document.getElementById('shell-mega-panel');
    const logoutBtn = document.querySelector('[data-shell-logout-link]');
    const shellSearchForm = document.querySelector('.shell-search');
    const shellSearchInput = document.getElementById('shell-search-q');
    const shellSuggestBox = document.getElementById('shell-search-suggest-list');

    function suggestProducts(query) {
      const endpoint = '/api/search/suggest?q=' + encodeURIComponent(query);
      const auth = window.BeltelecomAuth;
      if (auth && typeof auth.api === 'function') {
        return auth.api(endpoint);
      }
      return fetch(endpoint, { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error('suggest failed');
        return r.json();
      });
    }

    let shellSuggestTimer = 0;
    let shellSuggestReqId = 0;
    let shellSuggestActiveIndex = -1;
    let shellSuggestItems = [];

    function closeShellSuggest() {
      if (!shellSuggestBox || !shellSearchInput) return;
      shellSuggestItems = [];
      shellSuggestActiveIndex = -1;
      shellSuggestBox.innerHTML = '';
      shellSuggestBox.hidden = true;
      shellSearchInput.setAttribute('aria-expanded', 'false');
      shellSearchInput.removeAttribute('aria-activedescendant');
    }

    function applyShellSuggestActive() {
      if (!shellSuggestBox || !shellSearchInput) return;
      const buttons = shellSuggestBox.querySelectorAll('.search-suggest__item');
      buttons.forEach((btn, idx) => {
        const active = idx === shellSuggestActiveIndex;
        btn.classList.toggle('is-active', active);
        if (active) shellSearchInput.setAttribute('aria-activedescendant', btn.id);
      });
      if (shellSuggestActiveIndex < 0) {
        shellSearchInput.removeAttribute('aria-activedescendant');
      }
    }

    function renderShellSuggest(items) {
      if (!shellSuggestBox || !shellSearchInput) return;
      shellSuggestItems = Array.isArray(items) ? items : [];
      if (shellSuggestItems.length === 0) {
        closeShellSuggest();
        return;
      }
      shellSuggestActiveIndex = -1;
      shellSuggestBox.innerHTML = shellSuggestItems
        .map((product, idx) => {
          const name = esc(product.name || '');
          const category = esc(product.categoryTitle || '');
          return `
            <button type="button" id="shell-search-suggest-item-${idx}" class="search-suggest__item" role="option" data-index="${idx}">
              <span class="search-suggest__title">${name}</span>
              <span class="search-suggest__meta">${category}</span>
            </button>`;
        })
        .join('');
      shellSuggestBox.hidden = false;
      shellSearchInput.setAttribute('aria-expanded', 'true');
    }

    function runShellSuggest(query) {
      const text = String(query || '').trim();
      if (text.length < 1) {
        closeShellSuggest();
        return;
      }
      const reqId = ++shellSuggestReqId;
      suggestProducts(text)
        .then((items) => {
          if (reqId !== shellSuggestReqId) return;
          renderShellSuggest(items);
        })
        .catch(() => {
          if (reqId !== shellSuggestReqId) return;
          closeShellSuggest();
        });
    }

    function closeMega() {
      if (!mega || !megaToggle) return;
      mega.classList.remove('is-open');
      megaToggle.setAttribute('aria-expanded', 'false');
    }

    function closeDrawer() {
      if (!burger || !drawer) return;
      drawer.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }

    if (burger && drawer) {
      burger.addEventListener('click', () => {
        const open = drawer.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          if (window.matchMedia('(max-width: 960px)').matches && mega && megaToggle) {
            mega.classList.add('is-open');
            megaToggle.setAttribute('aria-expanded', 'true');
          } else {
            closeMega();
          }
        } else {
          closeMega();
        }
      });
    }

    if (shellSearchInput && shellSuggestBox) {
      shellSearchInput.addEventListener('input', () => {
        clearTimeout(shellSuggestTimer);
        shellSuggestTimer = window.setTimeout(() => runShellSuggest(shellSearchInput.value), 140);
      });

      shellSearchInput.addEventListener('keydown', (event) => {
        if (shellSuggestBox.hidden || shellSuggestItems.length === 0) return;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          shellSuggestActiveIndex = (shellSuggestActiveIndex + 1) % shellSuggestItems.length;
          applyShellSuggestActive();
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          shellSuggestActiveIndex = shellSuggestActiveIndex <= 0 ? shellSuggestItems.length - 1 : shellSuggestActiveIndex - 1;
          applyShellSuggestActive();
          return;
        }
        if (event.key === 'Enter' && shellSuggestActiveIndex >= 0 && shellSuggestItems[shellSuggestActiveIndex]) {
          event.preventDefault();
          window.location.href = productHref(shellSuggestItems[shellSuggestActiveIndex]);
          return;
        }
        if (event.key === 'Escape') closeShellSuggest();
      });

      shellSuggestBox.addEventListener('mousedown', (event) => {
        const target = event.target && event.target.closest ? event.target.closest('.search-suggest__item') : null;
        if (!target) return;
        event.preventDefault();
        const idx = Number(target.getAttribute('data-index'));
        if (!Number.isInteger(idx) || !shellSuggestItems[idx]) return;
        window.location.href = productHref(shellSuggestItems[idx]);
      });

      document.addEventListener('click', (event) => {
        const t = event.target;
        if (t === shellSearchInput || shellSuggestBox.contains(t)) return;
        closeShellSuggest();
      });

      if (shellSearchForm) {
        shellSearchForm.addEventListener('submit', () => closeShellSuggest());
      }
    }

    if (mega && megaToggle && megaPanel) {
      megaToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = mega.classList.toggle('is-open');
        megaToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', () => closeMega());
      mega.addEventListener('click', (e) => e.stopPropagation());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMega();
        closeDrawer();
      }
    });

    document.querySelectorAll('.shell-nav__link[href], .shell-menu__link[href], .shell-action[href], .shell-header__quicklink[href]').forEach((a) => {
      a.addEventListener('click', () => {
        closeDrawer();
        closeMega();
      });
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const auth = window.BeltelecomAuth;
        if (!auth || typeof auth.logout !== 'function') return;
        try {
          await auth.logout();
          closeDrawer();
          closeMega();
          const protectedPages = new Set([
            'account.html',
            'admin.html',
            'admin-products.html',
            'admin-brands.html',
            'admin-users.html',
            'admin-requests.html',
            'admin-orders.html',
            'moderator.html',
            'moderator-products.html',
            'moderator-brands.html',
            'moderator-requests.html',
            'moderator-orders.html',
          ]);
          if (protectedPages.has(active)) {
            window.location.href = 'login.html';
            return;
          }
          window.location.reload();
        } catch {
          window.location.reload();
        }
      });
    }

    updateCartBadge();
    window.addEventListener('storage', (e) => {
      if (e.key === 'bt_cart_v1') updateCartBadge();
    });
    document.addEventListener('beltelecom-cart-changed', updateCartBadge);
    wireImageFallback();
    refreshAuthNav();
  }

  window.BeltelecomShell = {
    mount: mountShell,
    refreshCartBadge: updateCartBadge,
    refreshAuthNav,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountShell);
  } else {
    mountShell();
  }
})();
