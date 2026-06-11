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
    const auth = window.BeltelecomAuth;
    if (!auth) return;
    const root = document.getElementById('orders-root');
    const status = document.getElementById('orders-status');
    const logoutBtn = document.getElementById('acc-logout');
    const profileForm = document.getElementById('profile-form');
    const profileStatus = document.getElementById('profile-status');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profilePhone = document.getElementById('profile-phone');
    const profileAddress = document.getElementById('profile-address');

    function fillProfile(user) {
      if (!user) return;
      if (profileName) profileName.value = user.name || '';
      if (profileEmail) profileEmail.value = user.email || '';
      if (profilePhone) profilePhone.value = user.phone || '';
      if (profileAddress) profileAddress.value = user.address || '';
    }

    function setGuestUi() {
      document.querySelectorAll('[data-guest-only]').forEach((el) => {
        el.style.display = '';
      });
      document.querySelectorAll('[data-auth-only]').forEach((el) => {
        el.style.display = 'none';
      });
    }

    function setUserUi() {
      document.querySelectorAll('[data-guest-only]').forEach((el) => {
        el.style.display = 'none';
      });
      document.querySelectorAll('[data-auth-only]').forEach((el) => {
        el.style.display = '';
      });
    }

    function renderOrders(orders) {
      if (!root) return;
      if (!orders.length) {
        root.innerHTML =
          '<p class="muted">Заказов пока нет. Перейдите в <a href="promo.html">каталог</a>.</p>';
        return;
      }
      root.innerHTML = orders
        .map((o) => {
          const date = o.created_at ? String(o.created_at).slice(0, 19).replace('T', ' ') : '';
          const items = (o.items || [])
            .map((it) => {
              const snapImg = it.image || it.image_snapshot || '';
              const nm = it.name || it.name_snapshot || '';
              const img = snapImg
                ? `<img src="${esc(snapImg)}" alt="" class="order-item__thumb" width="44" height="44" loading="lazy" />`
                : '';
              const line = `${esc(nm)} × ${esc(String(it.qty))} — ${Number(it.price).toLocaleString(
                'ru-RU'
              )} BYN`;
              return `<li class="order-item-row">${img}<span class="order-item-row__text">${line}</span></li>`;
            })
            .join('');
          const ordRef = o.orderNumber ?? o.order_number;
          const orderLabel =
            ordRef != null && String(ordRef).trim() !== ''
              ? esc(String(ordRef).trim())
              : `№${esc(String(o.id))}`;
          return `<article class="order-card">
            <header class="order-card__head">
              <strong>Заказ ${orderLabel}</strong>
              <span class="order-card__status">${esc(o.status || '')}</span>
              <span class="order-card__date">${esc(date)}</span>
            </header>
            <p><strong>Сумма:</strong> ${Number(o.total).toLocaleString('ru-RU')} BYN</p>
            <ul class="order-card__items">${items}</ul>
          </article>`;
        })
        .join('');
    }

    auth
      .loadCurrentUser()
      .then((user) => {
        if (!user) {
          setGuestUi();
          return;
        }
        setUserUi();
        fillProfile(user);
        if (profileStatus) profileStatus.textContent = '';
        if (status) status.textContent = 'Загрузка заказов…';
        return fetch('/api/orders', { credentials: 'same-origin' }).then((r) => {
          if (!r.ok) throw new Error('orders');
          return r.json();
        });
      })
      .then((orders) => {
        if (!orders) return;
        if (status) status.textContent = '';
        renderOrders(Array.isArray(orders) ? orders : []);
      })
      .catch(() => {
        if (status) status.textContent = 'Не удалось загрузить заказы (нужен PHP API).';
      });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        auth.logout().then(() => location.reload());
      });
    }

    if (profileForm) {
      profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (profileStatus) profileStatus.textContent = 'Сохранение профиля…';
        try {
          const payload = {
            name: profileName ? profileName.value.trim() : '',
            phone: profilePhone ? profilePhone.value.trim() : '',
            address: profileAddress ? profileAddress.value.trim() : '',
          };
          if (payload.name.length < 2) {
            throw new Error('Имя должно содержать минимум 2 символа.');
          }
          const validate = window.BeltelecomValidate;
          if (validate) {
            const phoneMsg = validate.phoneError(payload.phone, true);
            if (phoneMsg) throw new Error(phoneMsg);
            payload.phone = validate.normalizePhone(payload.phone) || '';
            const addressMsg = validate.addressErrorMessage(payload.address, true);
            if (addressMsg) throw new Error(addressMsg);
            payload.address = validate.normalizeAddress(payload.address) || '';
          }
          const result = await auth.api('/api/auth/me', { method: 'PATCH', body: payload });
          if (result && result.user) {
            fillProfile(result.user);
            if (window.BeltelecomShell && typeof window.BeltelecomShell.refreshAuthNav === 'function') {
              window.BeltelecomShell.refreshAuthNav(result.user);
            }
          }
          if (profileStatus) profileStatus.textContent = 'Профиль сохранён.';
        } catch (e) {
          if (profileStatus) profileStatus.textContent = e.message || 'Не удалось сохранить профиль.';
        }
      });
    }
  }

  function bindAddressFields() {
    const validate = window.BeltelecomValidate;
    if (!validate || typeof validate.bindAddressInput !== 'function') return;
    validate.bindAddressInput(document.getElementById('profile-address'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      bindAddressFields();
    });
  } else {
    init();
    bindAddressFields();
  }
})();
