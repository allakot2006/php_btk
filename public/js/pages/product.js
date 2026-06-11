document.addEventListener('DOMContentLoaded', () => {
  const mainEl = document.querySelector('main');
  if (!mainEl) return;

  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  const productId = idParam ? Number(idParam) : null;
  const name = params.get('name');
  const slug = params.get('slug');
  const category = params.get('category');

  const canById = Number.isFinite(productId) && productId > 0;
  const canByCatalog = Boolean(category) && (Boolean(slug) || Boolean(name) || canById);

  if (!canById && !canByCatalog) {
    mainEl.innerHTML =
      '<p class="product-page-msg">Укажите товар: параметр <strong>id</strong> или пару <strong>category</strong> + <strong>slug</strong> / <strong>name</strong>.</p>';
    return;
  }

  function fetchJson(endpoint, errorMessage) {
    return fetch(endpoint, { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error(errorMessage || 'request failed');
        return res.json();
      });
  }

  function findProductInCatalog(data) {
    if (!Array.isArray(data)) return null;
    if (slug) {
      const bySlug = data.find((p) => String(p.slug || '').toLowerCase() === String(slug).toLowerCase());
      if (bySlug) return bySlug;
    }
    if (canById) {
      const byId = data.find((p) => Number(p.id) === productId);
      if (byId) return byId;
    }
    if (name) {
      const needle = String(name).toLowerCase();
      return (
        data.find((p) => String(p.name || '').toLowerCase() === needle) ||
        data.find((p) => String(p.name || '').toLowerCase().includes(needle)) ||
        null
      );
    }
    return null;
  }

  function fillDescriptionInto(el, text) {
    if (!el) return;
    el.replaceChildren();
    const raw = (text || '').trim();
    if (!raw) {
      return;
    }
    const blocks = raw.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      if (lines[0].startsWith('## ')) {
        const h = document.createElement('h3');
        h.className = 'product-desc-section';
        h.textContent = lines[0].replace(/^##\s+/, '').trim();
        el.appendChild(h);
        for (let i = 1; i < lines.length; i++) {
          const p = document.createElement('p');
          p.className = 'product-desc-p';
          p.textContent = lines[i];
          el.appendChild(p);
        }
        continue;
      }

      if (lines.every((l) => l.startsWith('✅'))) {
        const ul = document.createElement('ul');
        ul.className = 'product-desc-checklist';
        for (const l of lines) {
          const li = document.createElement('li');
          li.textContent = l.replace(/^✅\s*/, '');
          ul.appendChild(li);
        }
        el.appendChild(ul);
        continue;
      }

      const p = document.createElement('p');
      p.className = 'product-desc-p';
      p.textContent = lines.join(' ');
      el.appendChild(p);
    }
  }

  const TEASER_MAX = 360;

  function joinBlocks(blocks) {
    return blocks
      .filter((b) => b && String(b).trim())
      .map((b) => String(b).trim())
      .join('\n\n');
  }

  function splitTeaserParagraph(joined) {
    const t = joined.trim();
    if (t.length <= TEASER_MAX) return { head: t, tail: '' };
    const win = Math.min(t.length, TEASER_MAX + 80);
    const chunk = t.slice(0, win);
    const lastDot = chunk.lastIndexOf('.');
    if (lastDot >= 100) {
      return { head: t.slice(0, lastDot + 1).trim(), tail: t.slice(lastDot + 1).trim() };
    }
    const sp = chunk.lastIndexOf(' ');
    const cut = sp >= 120 ? sp : TEASER_MAX;
    return { head: t.slice(0, cut).trim() + '…', tail: t.slice(cut).trim() };
  }

  function teaserShortFromHead(head, hasTail) {
    if (head.endsWith('…')) return head;
    if (hasTail && !/[.!?]$/.test(head)) return head + '…';
    return head;
  }

  function shortAndRemainderFromFull(fullTrim) {
    const blocks = fullTrim.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) return { short: '', remainder: '', hideFull: true };

    let i = 0;
    for (; i < blocks.length; i++) {
      const lines = blocks[i].split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      if (lines[0].startsWith('## ')) {
        if (lines.length < 2) continue;
        const body = lines.slice(1).join('\n');
        if (!body) continue;

        if (body.length <= TEASER_MAX) {
          const remainderBlocks = [...blocks.slice(0, i), ...blocks.slice(i + 1)];
          const remainder = joinBlocks(remainderBlocks);
          return { short: body, remainder, hideFull: !remainder };
        }

        const { head, tail } = splitTeaserParagraph(body);
        if (!tail || tail.length < 25) {
          return {
            short: teaserShortFromHead(head, Boolean(tail)),
            remainder: fullTrim,
            hideFull: false,
          };
        }
        const newBlock = [lines[0], tail].join('\n');
        const remainderBlocks = [...blocks.slice(0, i), newBlock, ...blocks.slice(i + 1)];
        return {
          short: teaserShortFromHead(head, true),
          remainder: joinBlocks(remainderBlocks),
          hideFull: false,
        };
      }

      break;
    }

    if (i >= blocks.length) {
      return { short: '', remainder: fullTrim, hideFull: false };
    }

    const lines = blocks[i].split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      return { short: '', remainder: fullTrim, hideFull: false };
    }

    if (lines.every((l) => l.startsWith('✅'))) {
      const take = Math.min(2, lines.length);
      const short = lines
        .slice(0, take)
        .map((l) => l.replace(/^✅\s*/, ''))
        .join('. ');
      const restLines = lines.slice(take);
      const remainderBlocks = restLines.length
        ? [...blocks.slice(0, i), restLines.join('\n'), ...blocks.slice(i + 1)]
        : [...blocks.slice(0, i), ...blocks.slice(i + 1)];
      const remainder = joinBlocks(remainderBlocks);
      return { short, remainder, hideFull: !remainder };
    }

    const joined = lines.join(' ');
    if (joined.length <= TEASER_MAX) {
      const remainderBlocks = [...blocks.slice(0, i), ...blocks.slice(i + 1)];
      const remainder = joinBlocks(remainderBlocks);
      return { short: joined, remainder, hideFull: !remainder };
    }

    const { head, tail } = splitTeaserParagraph(joined);
    const short = teaserShortFromHead(head, Boolean(tail));
    if (!tail || tail.length < 25) {
      return { short, remainder: fullTrim, hideFull: false };
    }
    const remainderBlocks = [...blocks.slice(0, i), tail, ...blocks.slice(i + 1)];
    return { short, remainder: joinBlocks(remainderBlocks), hideFull: false };
  }

  function applyProductDescriptions(product) {
    const shortEl = document.getElementById('product-short-desc');
    const fullDescEl = document.getElementById('product-description-full');
    const descTrim = String(product.description || '').trim();
    const fullTrim = String(product.fullDescription || '').trim();

    let shortText = descTrim;
    let fullBody = '';
    let hideFull = true;

    if (descTrim) {
      fullBody = fullTrim && fullTrim !== descTrim ? fullTrim : '';
      hideFull = !fullBody.trim();
    } else if (fullTrim) {
      const { short, remainder, hideFull: hf } = shortAndRemainderFromFull(fullTrim);
      shortText = short;
      fullBody = remainder;
      hideFull = hf;
    }

    if (shortEl) {
      shortEl.textContent = shortText.trim() || 'Краткое описание появится позже.';
    }
    if (fullDescEl) {
      fullDescEl.hidden = hideFull || !String(fullBody || '').trim();
      fillDescriptionInto(fullDescEl, hideFull ? '' : fullBody);
    }
  }

  function renderProduct(product) {
    const priceNum = Number(product.price);
    const img = document.getElementById('product-img');
    if (img) {
      img.src = product.image || '/assets/system/placeholder-product.svg';
      img.alt = product.name || '';
    }

    const nameEl = document.getElementById('product-name');
    if (nameEl) nameEl.textContent = product.name || '';
    const priceEl = document.getElementById('product-price');
    if (priceEl) {
      priceEl.textContent = Number.isFinite(priceNum)
        ? `Цена: ${priceNum.toLocaleString('ru-RU')} BYN`
        : `Цена: ${product.price} BYN`;
    }
    const stockEl = document.getElementById('product-stock');
    const sq = product.stockQuantity;
    const stockTracked =
      sq !== null && sq !== undefined && sq !== '' && Number.isFinite(Number(sq));
    const outOfStock = stockTracked && Number(sq) <= 0;
    if (stockEl) {
      if (stockTracked && !outOfStock) {
        stockEl.hidden = false;
        stockEl.textContent = `В наличии: ${Number(sq)} шт.`;
        stockEl.classList.remove('muted');
      } else if (outOfStock) {
        stockEl.hidden = false;
        stockEl.textContent = 'Нет в наличии';
        stockEl.classList.add('muted');
      } else {
        stockEl.hidden = false;
        stockEl.textContent = 'В наличии';
        stockEl.classList.remove('muted');
      }
    }
    const colorEl = document.querySelector('.product-color');
    if (colorEl) colorEl.textContent = `Цвет: ${product.color || 'Не указан'}`;
    applyProductDescriptions(product);

    const specsTable = document.getElementById('product-specs');
    if (specsTable) {
      if (window.BeltelecomSpecs && typeof window.BeltelecomSpecs.render === 'function') {
        window.BeltelecomSpecs.render(specsTable, product.specs || null);
      } else if (product.specs && Object.keys(product.specs).length > 0) {
        const skip =
          window.BeltelecomSpecs && typeof window.BeltelecomSpecs.shouldSkipSpecRow === 'function'
            ? window.BeltelecomSpecs.shouldSkipSpecRow
            : () => false;
        const tbl = document.createElement('table');
        tbl.className = 'specs-table';
        for (const [key, value] of Object.entries(product.specs)) {
          if (key === 'sections') continue;
          if (skip(key, value)) continue;
          const tr = document.createElement('tr');
          const td1 = document.createElement('td');
          const td2 = document.createElement('td');
          td1.textContent = key;
          td2.textContent = value == null ? '' : String(value);
          tr.appendChild(td1);
          tr.appendChild(td2);
          tbl.appendChild(tr);
        }
        specsTable.innerHTML = '';
        if (tbl.querySelector('tr')) {
          specsTable.appendChild(tbl);
        } else {
          specsTable.innerHTML = '<p>Характеристики скоро появятся.</p>';
        }
      } else {
        specsTable.innerHTML = '<p>Характеристики скоро появятся.</p>';
      }
    }

    const buyBtn = document.getElementById('buy-btn');
    if (!buyBtn) return;
    buyBtn.replaceWith(buyBtn.cloneNode(true));
    const btn = document.getElementById('buy-btn');
    if (!btn) return;
    btn.disabled = outOfStock;
    btn.setAttribute('aria-disabled', outOfStock ? 'true' : 'false');
    if (outOfStock) {
      btn.textContent = 'Нет в наличии';
    } else {
      btn.textContent = 'В корзину';
    }
    btn.addEventListener('click', () => {
      const cart = window.BeltelecomCart;
      const statusEl = document.getElementById('buy-status');
      if (statusEl) statusEl.classList.remove('is-error');
      if (outOfStock) {
        if (statusEl) {
          statusEl.textContent = 'Товар недоступен для заказа.';
          statusEl.classList.add('is-error');
        }
        return;
      }
      if (!cart) {
        if (statusEl) {
          statusEl.textContent = 'Корзина не доступна. Обновите страницу.';
          statusEl.classList.add('is-error');
        }
        return;
      }
      const result = cart.addToCart(
        {
          productId: product.id ?? null,
          slug: product.slug ?? null,
          name: product.name,
          price: Number.isFinite(priceNum) ? priceNum : product.price,
          image: product.image ?? null,
          stockQuantity: stockTracked ? Number(sq) : null,
        },
        1
      );
      if (statusEl) {
        statusEl.textContent = result ? 'Товар добавлен в корзину.' : 'Не удалось добавить товар в корзину.';
        statusEl.classList.toggle('is-error', !result);
      }
      if (window.BeltelecomShell && typeof window.BeltelecomShell.refreshCartBadge === 'function') {
        window.BeltelecomShell.refreshCartBadge();
      }
    });
  }

  if (canById) {
    fetchJson(`/api/products/${productId}`, 'not found')
      .then((product) => {
        renderProduct(product);
      })
      .catch(() => {
        if (!canByCatalog) {
          mainEl.innerHTML = '<p class="product-page-msg">Товар не найден или загрузите каталог с сервера PHP.</p>';
          return;
        }

        fetchJson(`/api/${encodeURIComponent(category)}`, 'category failed')
          .then((data) => {
            const product = findProductInCatalog(data);
            if (!product) {
              mainEl.innerHTML = '<p class="product-page-msg">Товар не найден в каталоге.</p>';
              return;
            }
            renderProduct(product);
          })
          .catch((err) => {
            console.error(err);
            mainEl.innerHTML = '<p class="product-page-msg">Ошибка загрузки товара.</p>';
          });
      });
    return;
  }

  fetchJson(`/api/${encodeURIComponent(category)}`, 'category failed')
    .then((data) => {
      const product = findProductInCatalog(data);
      if (!product) {
        mainEl.innerHTML = '<p class="product-page-msg">Товар не найден в каталоге.</p>';
        return;
      }
      renderProduct(product);
    })
    .catch((err) => {
      console.error(err);
      mainEl.innerHTML = '<p class="product-page-msg">Ошибка загрузки товара.</p>';
    });
});
