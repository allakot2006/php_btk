(function () {
  'use strict';

  const api = window.BeltelecomAuth && window.BeltelecomAuth.api;

  const el = {
    gate: document.getElementById('admin-gate'),
    panel: document.getElementById('admin-panel'),
    search: document.getElementById('admin-user-search'),
    statusFilter: document.getElementById('admin-user-status-filter'),
    roleFilter: document.getElementById('admin-user-role-filter'),
    listBody: document.querySelector('#admin-users-list tbody'),
    listCount: document.getElementById('admin-users-count'),
    adminsCount: document.getElementById('admin-users-admins'),
    moderatorsCount: document.getElementById('admin-users-moderators'),
    statTotal: document.getElementById('admin-users-stat-total'),
    statAdmins: document.getElementById('admin-users-stat-admins'),
    statModerators: document.getElementById('admin-users-stat-moderators'),
    statActive: document.getElementById('admin-users-stat-active'),
    statInactive: document.getElementById('admin-users-stat-inactive'),
    form: document.getElementById('admin-user-form'),
    status: document.getElementById('admin-user-status'),
    formTitle: document.getElementById('admin-user-form-title'),
    formLead: document.getElementById('admin-user-form-lead'),
    currentState: document.getElementById('admin-user-current-state'),
    currentMeta: document.getElementById('admin-user-current-meta'),
    btnRefresh: document.getElementById('admin-users-refresh'),
    btnNew: document.getElementById('admin-user-new'),
    btnDelete: document.getElementById('admin-user-delete'),
    formWrap: document.querySelector('.admin-form-wrap'),
    fId: document.getElementById('u-id'),
    fName: document.getElementById('u-name'),
    fEmail: document.getElementById('u-email'),
    fPhone: document.getElementById('u-phone'),
    fPassword: document.getElementById('u-password'),
    fAddress: document.getElementById('u-address'),
    fRole: document.getElementById('u-role'),
    fIsActive: document.getElementById('u-isActive'),
  };

  const state = {
    currentAdminUser: null,
    usersCache: [],
  };

  function setStatus(msg, isErr) {
    if (!el.status) return;
    el.status.textContent = msg || '';
    el.status.classList.remove('is-error', 'is-success');
    if (!msg) return;
    if (isErr) el.status.classList.add('is-error');
    else if (!/[.…]$/.test(String(msg))) el.status.classList.add('is-success');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateSummary(list) {
    const items = Array.isArray(list) ? list : [];
    const total = items.length;
    const admins = items.filter((item) => item.isAdmin).length;
    const moderators = items.filter((item) => item.isModerator).length;
    const active = items.filter((item) => item.isActive !== false).length;
    const inactive = total - active;
    if (el.listCount) {
      const suffix = total === 1 ? 'пользователь' : total >= 2 && total <= 4 ? 'пользователя' : 'пользователей';
      el.listCount.textContent = `${total} ${suffix}`;
    }
    if (el.adminsCount) {
      el.adminsCount.textContent = `${admins} админ${admins === 1 ? '' : admins >= 2 && admins <= 4 ? 'а' : 'ов'}`;
    }
    if (el.moderatorsCount) {
      el.moderatorsCount.textContent = `${moderators} модератор${moderators === 1 ? '' : moderators >= 2 && moderators <= 4 ? 'а' : 'ов'}`;
    }
    if (el.statTotal) el.statTotal.textContent = String(total);
    if (el.statAdmins) el.statAdmins.textContent = String(admins);
    if (el.statModerators) el.statModerators.textContent = String(moderators);
    if (el.statActive) el.statActive.textContent = String(active);
    if (el.statInactive) el.statInactive.textContent = String(inactive);
  }

  function updateFormMeta(user) {
    const isExisting = Boolean(user && user.id);
    if (el.formTitle) {
      el.formTitle.textContent = isExisting ? `Редактирование: ${user.name || 'пользователь'}` : 'Новый пользователь';
    }
    if (el.formLead) {
      el.formLead.textContent = isExisting
        ? 'Изменяйте профиль, роль и доступ выбранного пользователя.'
        : 'Создайте аккаунт и при необходимости назначьте роль пользователя, модератора или администратора.';
    }
    if (el.currentState) {
      el.currentState.textContent = isExisting
        ? user.isActive === false ? 'Отключён' : getRoleLabel(user)
        : 'Новый';
      el.currentState.classList.toggle('admin-chip--accent', !isExisting || user.isActive !== false);
    }
    if (el.currentMeta) {
      if (isExisting) {
        const parts = [`ID ${user.id}`];
        if (user.email) parts.push(user.email);
        if (user.ordersCount != null) parts.push(`Заказов: ${user.ordersCount}`);
        el.currentMeta.textContent = parts.join(' · ');
      } else {
        el.currentMeta.textContent = 'ID появится после сохранения';
      }
    }
  }

  function clearForm() {
    el.fId.value = '';
    el.fName.value = '';
    el.fEmail.value = '';
    el.fPhone.value = '';
    el.fPassword.value = '';
    el.fAddress.value = '';
    el.fRole.value = 'user';
    el.fIsActive.checked = true;
    el.fRole.disabled = false;
    el.fIsActive.disabled = false;
    el.btnDelete.disabled = true;
    updateFormMeta(null);
  }

  function fillForm(user) {
    const isSelf = state.currentAdminUser && Number(state.currentAdminUser.id) === Number(user.id);
    el.fId.value = user.id ? String(user.id) : '';
    el.fName.value = user.name || '';
    el.fEmail.value = user.email || '';
    el.fPhone.value = user.phone || '';
    el.fPassword.value = '';
    el.fAddress.value = user.address || '';
    el.fRole.value = user.role || (user.isAdmin ? 'admin' : (user.isModerator ? 'moderator' : 'user'));
    el.fIsActive.checked = user.isActive !== false;
    el.fRole.disabled = isSelf;
    el.fIsActive.disabled = isSelf;
    el.btnDelete.disabled = !user.id || isSelf;
    updateFormMeta(user);
  }

  function renderUsers(list) {
    el.listBody.replaceChildren();
    if (!Array.isArray(list) || list.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="admin-empty">Пользователи по текущим условиям не найдены.</td>';
      el.listBody.appendChild(tr);
      updateSummary([]);
      return;
    }
    updateSummary(list);
    list.forEach((user) => {
      const tr = document.createElement('tr');
      const roleBadge = user.isAdmin
        ? '<span class="admin-badge admin-badge--active">Админ</span>'
        : user.isModerator
          ? '<span class="admin-badge admin-badge--stock">Модератор</span>'
          : '<span class="admin-badge">Пользователь</span>';
      const statusBadge = user.isActive !== false
        ? '<span class="admin-badge admin-badge--stock">Активен</span>'
        : '<span class="admin-badge admin-badge--hidden">Отключён</span>';
      const meta = [user.email, user.phone].filter(Boolean).map((s) => escapeHtml(String(s))).join('<br />');
      tr.innerHTML =
        `<td>${user.id}</td>` +
        `<td><strong>${escapeHtml(user.name)}</strong><div class="admin-table__sub">${meta || '—'}</div></td>` +
        `<td>${roleBadge}</td>` +
        `<td>${statusBadge}</td>` +
        `<td>${Number(user.ordersCount || 0)}<div class="admin-table__sub">${user.lastOrderAt ? escapeHtml(String(user.lastOrderAt).slice(0, 16).replace('T', ' ')) : 'Без заказов'}</div></td>` +
        `<td><button type="button" class="btn btn--sm" data-edit-user="${user.id}">Изменить</button></td>`;
      el.listBody.appendChild(tr);
    });
    el.listBody.querySelectorAll('[data-edit-user]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-edit-user');
        setStatus('Загрузка…');
        try {
          const user = await api(`/api/admin/users/${id}`);
          fillForm(user);
          setStatus('');
          el.formWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
          setStatus(e.message || 'Ошибка', true);
        }
      });
    });
  }

  async function refreshUsers() {
    const params = new URLSearchParams();
    const search = (el.search.value || '').trim();
    const status = el.statusFilter.value || '';
    const role = el.roleFilter.value || '';
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (role) params.set('role', role);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    state.usersCache = await api(`/api/admin/users${suffix}`);
    renderUsers(state.usersCache);
  }

  function getRoleLabel(user) {
    if (user && user.isAdmin) return 'Администратор';
    if (user && user.isModerator) return 'Модератор';
    return 'Пользователь';
  }

  async function init() {
    if (!api) {
      el.gate.hidden = false;
      el.gate.querySelector('p').textContent = 'Не загружен auth.js';
      return;
    }

    try {
      const data = await api('/api/auth/me');
      state.currentAdminUser = data && data.user ? data.user : null;
    } catch {
      state.currentAdminUser = null;
    }
    if (!state.currentAdminUser || !state.currentAdminUser.isAdmin) {
      el.gate.hidden = false;
      return;
    }
    el.panel.hidden = false;

    el.btnRefresh?.addEventListener('click', () => refreshUsers().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.search?.addEventListener('input', () => refreshUsers().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.statusFilter?.addEventListener('change', () => refreshUsers().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.roleFilter?.addEventListener('change', () => refreshUsers().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.btnNew?.addEventListener('click', () => {
      clearForm();
      setStatus('Новый пользователь — заполните профиль и сохраните.');
    });

    el.form?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      setStatus('Сохранение…');
      const isEditing = Boolean(el.fId.value.trim());
      const password = el.fPassword.value;
      if (!isEditing && password.length < 6) {
        setStatus('Для нового пользователя укажите пароль не короче 6 символов.', true);
        return;
      }
      if (password && password.length < 6) {
        setStatus('Пароль должен быть не короче 6 символов.', true);
        return;
      }
      const validate = window.BeltelecomValidate;
      if (validate) {
        const emailMsg = validate.emailError(el.fEmail.value);
        if (emailMsg) {
          setStatus(emailMsg, true);
          return;
        }
        const phoneMsg = validate.phoneError(el.fPhone.value, true);
        if (phoneMsg) {
          setStatus(phoneMsg, true);
          return;
        }
        const addressMsg = validate.addressErrorMessage(el.fAddress.value, true);
        if (addressMsg) {
          setStatus(addressMsg, true);
          return;
        }
      }
      const body = {
        name: el.fName.value.trim(),
        email: validate ? validate.normalizeEmail(el.fEmail.value) : el.fEmail.value.trim(),
        phone: validate ? validate.normalizePhone(el.fPhone.value) || null : el.fPhone.value.trim() || null,
        password: password || '',
        address: validate ? validate.normalizeAddress(el.fAddress.value) || null : el.fAddress.value.trim() || null,
        role: el.fRole.value || 'user',
        isActive: el.fIsActive.checked,
      };
      try {
        const id = el.fId.value.trim();
        const result = id
          ? await api(`/api/admin/users/${id}`, { method: 'PUT', body })
          : await api('/api/admin/users', { method: 'POST', body });
        fillForm(result);
        setStatus(id ? 'Пользователь сохранён.' : `Пользователь создан. ID: ${result.id}`);
        await refreshUsers();
      } catch (e) {
        setStatus(e.message || 'Ошибка сохранения пользователя', true);
      }
    });

    el.btnDelete?.addEventListener('click', async () => {
      const id = el.fId.value.trim();
      if (!id || !confirm('Удалить пользователя навсегда? Заказы останутся, но отвяжутся от аккаунта.')) return;
      try {
        await api(`/api/admin/users/${id}`, { method: 'DELETE' });
        setStatus('Пользователь удалён.');
        clearForm();
        await refreshUsers();
      } catch (e) {
        setStatus(e.message || 'Ошибка удаления пользователя', true);
      }
    });

    clearForm();
    await refreshUsers();

    const validate = window.BeltelecomValidate;
    if (validate && typeof validate.bindAddressInput === 'function' && el.fAddress) {
      validate.bindAddressInput(el.fAddress);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
