(function () {
  'use strict';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    const cart = window.BeltelecomCart;
    const auth = window.BeltelecomAuth;
    if (!cart || !auth) return;

    const elEmpty = document.getElementById('cart-empty');
    const elContent = document.getElementById('cart-content');
    const elItems = document.getElementById('cart-items');
    const elTotal = document.getElementById('cart-total');
    const elClear = document.getElementById('cart-clear');
    const form = document.getElementById('checkout-form');
    const status = document.getElementById('checkout-status');
    const submit = document.getElementById('checkout-submit');
    if (!elEmpty || !elContent || !elItems || !elTotal || !elClear || !form || !status || !submit) return;

    let authUser = null;

    function render() {
      const items = cart.loadCart();
      const { subtotal } = cart.totals(items);
      elTotal.textContent = subtotal.toLocaleString('ru-RU');

      if (!items.length) {
        elEmpty.style.display = '';
        elContent.style.display = 'none';
        elItems.innerHTML = '';
        if (window.BeltelecomShell) window.BeltelecomShell.refreshCartBadge();
        return;
      }

      elEmpty.style.display = 'none';
      elContent.style.display = '';

      elItems.innerHTML = items
        .map((it, idx) => {
          const name = esc(it.name);
          const img = esc(it.image || '/assets/system/placeholder-product.svg');
          const stockTracked =
            it.stockQuantity !== null &&
            it.stockQuantity !== undefined &&
            it.stockQuantity !== '' &&
            Number.isFinite(Number(it.stockQuantity));
          const maxQty = stockTracked ? Math.max(1, Number(it.stockQuantity)) : 999;
          const stockText = stockTracked
            ? `<div class="cart-row__stock">Доступно: ${maxQty} шт.</div>`
            : '';
          return `
          <div class="cart-row" data-idx="${idx}">
            <div class="cart-row__grid">
              <img src="${img}" alt="" class="cart-row__img" width="80" height="80" />
              <div class="cart-row__info">
                <div class="cart-row__name">${name}</div>
                <div class="cart-row__price">${Number(it.price).toLocaleString('ru-RU')} BYN</div>
                ${stockText}
              </div>
              <div class="cart-row__qty">
                <label class="visually-hidden" for="q-${idx}">Количество</label>
                <input id="q-${idx}" class="input cart-qty" type="number" min="1" max="${maxQty}" value="${Number(
                  it.qty
                )}" />
              </div>
              <button type="button" class="btn btn--ghost cart-remove">Удалить</button>
            </div>
          </div>`;
        })
        .join('');

      elItems.querySelectorAll('.cart-remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const row = e.target.closest('.cart-row');
          const idx = Number(row.dataset.idx);
          cart.removeItem(idx);
          render();
        });
      });

      elItems.querySelectorAll('.cart-qty').forEach((input) => {
        input.addEventListener('change', (e) => {
          const row = e.target.closest('.cart-row');
          const idx = Number(row.dataset.idx);
          cart.updateQty(idx, e.target.value);
          render();
        });
      });
      if (window.BeltelecomShell) window.BeltelecomShell.refreshCartBadge();
    }

    elClear.addEventListener('click', () => {
      cart.clearCart();
      render();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = '';
      status.classList.remove('is-error', 'is-success');
      if (!authUser) {
        status.textContent = 'Войдите в аккаунт перед оформлением заказа.';
        status.classList.add('is-error');
        return;
      }

      const items = cart.loadCart();
      if (!items.length) {
        status.textContent = 'Добавьте товары в корзину.';
        status.classList.add('is-error');
        return;
      }
      if (items.some((it) => it.productId === null || it.productId === undefined || Number(it.productId) <= 0)) {
        status.textContent =
          'В корзине есть устаревшие позиции без ID товара. Удалите их и добавьте товары заново из каталога.';
        status.classList.add('is-error');
        return;
      }

      const nameValue = (document.getElementById('customer-name').value || '').trim();
      const phoneValue = (document.getElementById('customer-phone').value || '').trim();
      const emailValue = (document.getElementById('customer-email').value || '').trim();
      const addressValue = (document.getElementById('customer-address').value || '').trim();
      if (nameValue.length < 2) {
        status.textContent = 'Укажите имя (минимум 2 символа).';
        status.classList.add('is-error');
        return;
      }
      const validate = window.BeltelecomValidate;
      if (validate) {
        const phoneMsg = validate.phoneError(phoneValue, false);
        if (phoneMsg) {
          status.textContent = phoneMsg;
          status.classList.add('is-error');
          return;
        }
        const addressMsg = validate.addressErrorMessage(addressValue, false);
        if (addressMsg) {
          status.textContent = addressMsg;
          status.classList.add('is-error');
          return;
        }
        if (emailValue) {
          const emailMsg = validate.emailError(emailValue);
          if (emailMsg) {
            status.textContent = emailMsg;
            status.classList.add('is-error');
            return;
          }
        }
      } else {
        if (phoneValue.length < 7) {
          status.textContent = 'Укажите корректный телефон.';
          status.classList.add('is-error');
          return;
        }
        if (addressValue.length < 5) {
          status.textContent = 'Адрес указан некорректно. Укажите в формате: Город, улица, дом';
          status.classList.add('is-error');
          return;
        }
        if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
          status.textContent = 'Укажите корректный email.';
          status.classList.add('is-error');
          return;
        }
      }

      const normalizedAddress = validate ? validate.normalizeAddress(addressValue) : addressValue;
      if (!normalizedAddress) {
        status.textContent = validate
          ? validate.addressErrorMessage(addressValue, false)
          : 'Адрес указан некорректно. Укажите в формате: Город, улица, дом';
        status.classList.add('is-error');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Отправка…';

      try {
        const payload = {
          customer: {
            name: nameValue,
            phone: validate ? validate.normalizePhone(phoneValue) : phoneValue,
            email: validate && emailValue ? validate.normalizeEmail(emailValue) : emailValue,
            address: normalizedAddress,
          },
          comment: document.getElementById('customer-comment').value,
          items: items.map((it) => ({
            productId: it.productId,
            slug: it.slug || null,
            image: it.image || null,
            name: it.name,
            price: it.price,
            qty: it.qty,
          })),
        };

        const data = await auth.api('/api/orders', {
          method: 'POST',
          body: payload,
        });

        if (!data || data.ok === false) {
          status.textContent = (data && data.error) || 'Не удалось оформить заказ';
          status.classList.add('is-error');
          return;
        }

        cart.clearCart();
        render();
        const num =
          data.orderNumber != null && String(data.orderNumber).trim() !== ''
            ? String(data.orderNumber).trim()
            : String(data.orderId || '');
        status.textContent = `Заказ ${num} создан. Статус: ${data.status || 'new'}`;
        status.classList.add('is-success');
        form.reset();
      } catch (err) {
        const raw = err && err.message ? String(err.message).trim() : '';
        if (window.location.protocol === 'file:' || /failed to fetch|networkerror|load failed/i.test(raw)) {
          status.textContent =
            'Не удалось связаться с сервером. Запустите сайт: php -S localhost:8000 router.php';
        } else if (raw && raw !== 'Ошибка запроса') {
          status.textContent = raw;
        } else {
          status.textContent = 'Не удалось оформить заказ. Проверьте данные и попробуйте снова.';
        }
        status.classList.add('is-error');
        console.error(err);
      } finally {
        submit.disabled = false;
        submit.textContent = 'Отправить заказ';
      }
    });

    auth
      .loadCurrentUser()
      .then((user) => {
        authUser = user;
        if (user) {
          const nameEl = document.getElementById('customer-name');
          const emailEl = document.getElementById('customer-email');
          const phoneEl = document.getElementById('customer-phone');
          const addressEl = document.getElementById('customer-address');
          if (nameEl && !nameEl.value) nameEl.value = user.name || '';
          if (emailEl && !emailEl.value) emailEl.value = user.email || '';
          if (phoneEl && !phoneEl.value) phoneEl.value = user.phone || '';
          if (addressEl && !addressEl.value) addressEl.value = user.address || '';
        }
      })
      .catch(() => {
        status.textContent = 'Не удалось проверить авторизацию.';
        status.classList.add('is-error');
      })
      .finally(render);

    const validate = window.BeltelecomValidate;
    if (validate && typeof validate.bindAddressInput === 'function') {
      validate.bindAddressInput(document.getElementById('customer-address'));
    }
    const phoneEl = document.getElementById('customer-phone');
    if (phoneEl) {
      phoneEl.addEventListener('input', () => {
        const next = phoneEl.value.replace(/[^\d+\s\-()]/g, '');
        if (next !== phoneEl.value) phoneEl.value = next;
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
