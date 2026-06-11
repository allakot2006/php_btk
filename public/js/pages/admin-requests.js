(function () {
  'use strict';

  const api = window.BeltelecomAuth && window.BeltelecomAuth.api;
  const el = {
    gate: document.getElementById('admin-gate'),
    panel: document.getElementById('admin-panel'),
    search: document.getElementById('requests-search'),
    type: document.getElementById('requests-type'),
    status: document.getElementById('requests-status'),
    refresh: document.getElementById('requests-refresh'),
    listBody: document.querySelector('#requests-list tbody'),
    statusLine: document.getElementById('requests-status-line'),
    statTotal: document.getElementById('requests-stat-total'),
    statNew: document.getElementById('requests-stat-new'),
    statCallback: document.getElementById('requests-stat-callback'),
    statStock: document.getElementById('requests-stat-stock'),
  };

  function setStatus(message, isError) {
    if (!el.statusLine) return;
    el.statusLine.textContent = message || '';
    el.statusLine.classList.remove('is-error', 'is-success');
    if (!message) return;
    if (isError) el.statusLine.classList.add('is-error');
    else el.statusLine.classList.add('is-success');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateStats(items) {
    const list = Array.isArray(items) ? items : [];
    if (el.statTotal) el.statTotal.textContent = String(list.length);
    if (el.statNew) el.statNew.textContent = String(list.filter((item) => item.status === 'new').length);
    if (el.statCallback) el.statCallback.textContent = String(list.filter((item) => item.type === 'callback').length);
    if (el.statStock) el.statStock.textContent = String(list.filter((item) => item.type === 'stock').length);
  }

  function typeLabel(type) {
    if (type === 'callback') return 'Заказать звонок';
    if (type === 'stock') return 'Наличие товара';
    return type || '—';
  }

  function statusLabel(status) {
    if (status === 'new') return 'Новая';
    if (status === 'in_progress') return 'В работе';
    if (status === 'done') return 'Закрыта';
    return status || '—';
  }

  function statusOptions(current) {
    const values = [
      { v: 'new', t: 'Новая' },
      { v: 'in_progress', t: 'В работе' },
      { v: 'done', t: 'Выполнена' },
    ];
    return values
      .map((item) => `<option value="${item.v}"${item.v === current ? ' selected' : ''}>${item.t}</option>`)
      .join('');
  }

  function render(items) {
    if (!el.listBody) return;
    el.listBody.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="7" class="admin-empty">Заявки не найдены.</td>';
      el.listBody.appendChild(row);
      updateStats([]);
      return;
    }
    updateStats(items);
    items.forEach((item) => {
      const row = document.createElement('tr');
      const contacts = [
        item.name ? `<strong>${escapeHtml(item.name)}</strong>` : '',
        item.phone ? `Телефон: ${escapeHtml(item.phone)}` : '',
        item.email ? `Email: ${escapeHtml(item.email)}` : '',
      ].filter(Boolean).join('<br>');
      const requestText = item.type === 'callback'
        ? escapeHtml(item.topic || '—')
        : `${escapeHtml(item.categorySlug || '—')}<div class="admin-table__sub">${escapeHtml(item.queryText || '')}</div>`;
      const accountText = item.userId
        ? `<strong>#${escapeHtml(item.userId)}</strong><br>${escapeHtml(item.accountName || 'Без имени')}<br><span class="admin-table__sub">${escapeHtml(item.accountEmail || '—')}</span>`
        : '<span class="admin-table__sub">Гость</span>';
      const statusCell =
        `<div class="admin-table__inline-actions">` +
        `<select class="input input--sm" data-req-status="${item.id}">${statusOptions(item.status)}</select>` +
        `<button type="button" class="btn btn--sm btn--ghost" data-req-save="${item.id}">Сохранить</button>` +
        `</div>`;
      row.innerHTML =
        `<td>${item.id}</td>` +
        `<td>${escapeHtml(typeLabel(item.type))}</td>` +
        `<td>${accountText}</td>` +
        `<td>${contacts || '—'}</td>` +
        `<td>${requestText}</td>` +
        `<td>${statusCell}</td>` +
        `<td>${escapeHtml(String(item.createdAt || '').replace('T', ' ').slice(0, 16))}</td>`;
      el.listBody.appendChild(row);
    });
  }

  async function updateStatus(requestId, statusValue) {
    const id = Number(requestId);
    if (!Number.isFinite(id) || id <= 0) throw new Error('Некорректный ID заявки');
    const status = String(statusValue || '').trim();
    if (!['new', 'in_progress', 'done'].includes(status)) throw new Error('Некорректный статус');
    await api(`/api/admin/contact-requests/${id}/status`, { method: 'PATCH', body: { status } });
    setStatus('Статус заявки обновлён.', false);
    await refresh();
  }

  async function refresh() {
    const params = new URLSearchParams();
    const search = (el.search && el.search.value ? el.search.value : '').trim();
    const type = el.type && el.type.value ? el.type.value : '';
    const status = el.status && el.status.value ? el.status.value : '';
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const data = await api(`/api/admin/contact-requests${suffix}`);
    render(data);
  }

  async function init() {
    if (!api) {
      if (el.gate) el.gate.hidden = false;
      return;
    }
    let user = null;
    try {
      const data = await api('/api/auth/me');
      user = data && data.user ? data.user : null;
    } catch {
      user = null;
    }
    if (!user || (!user.isAdmin && !user.isModerator)) {
      if (el.gate) el.gate.hidden = false;
      return;
    }
    if (el.panel) el.panel.hidden = false;

    el.refresh?.addEventListener('click', () => refresh().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.search?.addEventListener('input', () => refresh().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.type?.addEventListener('change', () => refresh().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.status?.addEventListener('change', () => refresh().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.listBody?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-req-save]');
      if (!button) return;
      const id = button.getAttribute('data-req-save');
      const select = el.listBody.querySelector(`[data-req-status="${id}"]`);
      const value = select && 'value' in select ? select.value : '';
      updateStatus(id, value).catch((e) => setStatus(e.message || 'Ошибка', true));
    });

    try {
      await refresh();
      setStatus('');
    } catch (e) {
      setStatus(e.message || 'Не удалось загрузить заявки', true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

