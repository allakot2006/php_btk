(function () {
  'use strict';
  const api = window.BeltelecomAuth && window.BeltelecomAuth.api;
  const el = {
    gate: document.getElementById('admin-gate'),
    panel: document.getElementById('admin-panel'),
    search: document.getElementById('orders-search'),
    refresh: document.getElementById('orders-refresh'),
    listBody: document.querySelector('#orders-list tbody'),
    status: document.getElementById('orders-status-line'),
  };
  let cache = [];

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function setStatus(message, isError) {
    if (!el.status) return;
    el.status.textContent = message || '';
    el.status.classList.remove('is-error', 'is-success');
    if (!message) return;
    el.status.classList.add(isError ? 'is-error' : 'is-success');
  }
  function statusOptions(current) {
    const values = [
      { value: 'new', label: 'Новый' },
      { value: 'in_progress', label: 'В обработке' },
      { value: 'done', label: 'Выполнен' },
      { value: 'cancelled', label: 'Отменён' },
    ];
    return values.map((s) => `<option value="${s.value}"${s.value === current ? ' selected' : ''}>${s.label}</option>`).join('');
  }
  function render(items) {
    if (!el.listBody) return;
    el.listBody.replaceChildren();
    if (!Array.isArray(items) || !items.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="8" class="admin-empty">Заказы не найдены.</td>';
      el.listBody.appendChild(tr);
      return;
    }
    items.forEach((o) => {
      const tr = document.createElement('tr');
      const number = o.orderNumber ? esc(o.orderNumber) : `#${esc(o.id)}`;
      const contacts = [o.phone ? `Тел: ${esc(o.phone)}` : '', o.email ? `Email: ${esc(o.email)}` : ''].filter(Boolean).join('<br>');
      const itemsText = Array.isArray(o.items) ? o.items.map((it) => `${esc(it.name)} × ${esc(it.qty)}`).join('<br>') : '—';
      const statusCell =
        `<div class="admin-table__inline-actions">` +
        `<select class="input input--sm" data-order-status="${o.id}">${statusOptions(o.status)}</select>` +
        `<button type="button" class="btn btn--sm btn--ghost" data-order-save="${o.id}">Сохранить</button>` +
        `</div>`;
      tr.innerHTML =
        `<td>${number}</td>` +
        `<td>${esc(o.customerName || '—')}</td>` +
        `<td>${contacts || '—'}</td>` +
        `<td>${esc(o.address || '—')}</td>` +
        `<td>${Number(o.total || 0).toLocaleString('ru-RU')} BYN</td>` +
        `<td>${itemsText || '—'}</td>` +
        `<td>${statusCell}</td>` +
        `<td>${esc(String(o.createdAt || '').replace('T', ' ').slice(0, 16))}</td>`;
      el.listBody.appendChild(tr);
    });
  }
  function applySearch() {
    const q = (el.search && el.search.value ? el.search.value : '').trim().toLowerCase();
    if (!q) return render(cache);
    render(cache.filter((o) => [o.orderNumber, o.customerName, o.phone, o.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))));
  }
  async function refresh() {
    cache = await api('/api/admin/orders');
    applySearch();
  }
  async function updateOrderStatus(orderId, nextStatus) {
    const id = Number(orderId);
    if (!Number.isFinite(id) || id <= 0) throw new Error('Некорректный ID заказа');
    const status = String(nextStatus || '').trim();
    if (!['new', 'in_progress', 'done', 'cancelled'].includes(status)) {
      throw new Error('Некорректный статус заказа');
    }
    await api(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: { status } });
    setStatus('Статус заказа обновлён.', false);
    await refresh();
  }
  async function init() {
    if (!api) return;
    try {
      const me = await api('/api/auth/me');
      const user = me && me.user ? me.user : null;
      if (!user || (!user.isAdmin && !user.isModerator)) {
        if (el.gate) el.gate.hidden = false;
        return;
      }
      if (el.panel) el.panel.hidden = false;
      el.refresh?.addEventListener('click', () => refresh().catch((e) => setStatus(e.message || 'Ошибка', true)));
      el.search?.addEventListener('input', applySearch);
      el.listBody?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-order-save]');
        if (!btn) return;
        const id = btn.getAttribute('data-order-save');
        const select = el.listBody.querySelector(`[data-order-status="${id}"]`);
        const value = select && 'value' in select ? select.value : '';
        updateOrderStatus(id, value).catch((e) => setStatus(e.message || 'Ошибка', true));
      });
      await refresh();
    } catch (e) {
      setStatus(e.message || 'Не удалось загрузить заказы', true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
