(function () {
  'use strict';

  const api = window.BeltelecomAuth && window.BeltelecomAuth.api;

  const el = {
    gate: document.getElementById('admin-gate'),
    panel: document.getElementById('admin-panel'),
    search: document.getElementById('admin-brand-search'),
    categoryFilter: document.getElementById('admin-brand-category-filter'),
    statusFilter: document.getElementById('admin-brand-status-filter'),
    listBody: document.querySelector('#admin-brands-list tbody'),
    listCount: document.getElementById('admin-brands-count'),
    statTotal: document.getElementById('admin-brands-stat-total'),
    statActive: document.getElementById('admin-brands-stat-active'),
    statCategories: document.getElementById('admin-brands-stat-categories'),
    statUsed: document.getElementById('admin-brands-stat-used'),
    form: document.getElementById('admin-brand-form'),
    status: document.getElementById('admin-brand-status'),
    formTitle: document.getElementById('admin-brand-form-title'),
    formLead: document.getElementById('admin-brand-form-lead'),
    currentState: document.getElementById('admin-brand-current-state'),
    currentMeta: document.getElementById('admin-brand-current-meta'),
    btnRefresh: document.getElementById('admin-brands-refresh'),
    btnNew: document.getElementById('admin-brand-new'),
    btnReset: document.getElementById('admin-brand-reset'),
    btnDelete: document.getElementById('admin-brand-delete'),
    fId: document.getElementById('brand-id'),
    fTitle: document.getElementById('brand-title'),
    fIsActive: document.getElementById('brand-is-active'),
    categoriesRoot: document.getElementById('brand-categories'),
    usersTabLink: document.querySelector('.admin-tabs__link[href="admin-users.html"]'),
  };

  const state = {
    categories: [],
    brandsCache: [],
  };

  function setStatus(message, isError) {
    if (!el.status) return;
    el.status.textContent = message || '';
    el.status.classList.remove('is-error', 'is-success');
    if (!message) return;
    if (isError) el.status.classList.add('is-error');
    else if (!/[.…]$/.test(String(message))) el.status.classList.add('is-success');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateSummary(list) {
    const items = Array.isArray(list) ? list : [];
    const active = items.filter((item) => item.isActive !== false).length;
    const categoryIds = new Set();
    const used = items.filter((item) => Number(item.usageCount || 0) > 0).length;
    items.forEach((item) => {
      (item.categoryIds || []).forEach((id) => categoryIds.add(Number(id)));
    });
    if (el.listCount) {
      const total = items.length;
      const suffix = total === 1 ? 'бренд' : total >= 2 && total <= 4 ? 'бренда' : 'брендов';
      el.listCount.textContent = `${total} ${suffix}`;
    }
    if (el.statTotal) el.statTotal.textContent = String(items.length);
    if (el.statActive) el.statActive.textContent = String(active);
    if (el.statCategories) el.statCategories.textContent = String(categoryIds.size);
    if (el.statUsed) el.statUsed.textContent = String(used);
  }

  function renderCategoryFilter() {
    if (!el.categoryFilter) return;
    el.categoryFilter.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'Все категории';
    el.categoryFilter.appendChild(all);
    state.categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = String(category.id);
      option.textContent = `${category.title} (${category.slug})`;
      el.categoryFilter.appendChild(option);
    });
  }

  function renderCategoryChecklist(selectedIds) {
    if (!el.categoriesRoot) return;
    const selected = new Set((selectedIds || []).map((id) => Number(id)));
    el.categoriesRoot.replaceChildren();
    state.categories.forEach((category) => {
      const label = document.createElement('label');
      label.className = 'admin-check-grid__item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(category.id);
      checkbox.checked = selected.has(Number(category.id));
      const title = document.createElement('span');
      title.className = 'admin-check-grid__title';
      title.textContent = category.title;
      const meta = document.createElement('span');
      meta.className = 'admin-check-grid__meta';
      meta.textContent = category.slug;
      label.appendChild(checkbox);
      label.appendChild(title);
      label.appendChild(meta);
      el.categoriesRoot.appendChild(label);
    });
  }

  function readSelectedCategoryIds() {
    if (!el.categoriesRoot) return [];
    return Array.from(el.categoriesRoot.querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => Number(input.value))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  function updateFormMeta(brand) {
    const isExisting = Boolean(brand && brand.id);
    if (el.formTitle) {
      el.formTitle.textContent = isExisting ? `Редактирование: ${brand.title || 'бренд'}` : 'Новый бренд';
    }
    if (el.formLead) {
      el.formLead.textContent = isExisting
        ? 'Изменяйте название бренда, доступные категории и его видимость в каталоге.'
        : 'Добавьте бренд и укажите, в каких разделах каталога он должен отображаться.';
    }
    if (el.currentState) {
      el.currentState.textContent = isExisting
        ? (brand.isActive === false ? 'Скрыт' : 'Активен')
        : 'Новый бренд';
      el.currentState.classList.toggle('admin-chip--accent', !isExisting || brand.isActive !== false);
    }
    if (el.currentMeta) {
      if (!isExisting) {
        el.currentMeta.textContent = 'ID появится после сохранения';
      } else {
        const parts = [`ID ${brand.id}`];
        if (brand.slug) parts.push(brand.slug);
        parts.push(`Товаров: ${Number(brand.usageCount || 0)}`);
        el.currentMeta.textContent = parts.join(' · ');
      }
    }
  }

  function clearForm() {
    if (el.fId) el.fId.value = '';
    if (el.fTitle) el.fTitle.value = '';
    if (el.fIsActive) el.fIsActive.checked = true;
    if (el.btnDelete) el.btnDelete.disabled = true;
    renderCategoryChecklist([]);
    updateFormMeta(null);
  }

  function fillForm(brand) {
    if (el.fId) el.fId.value = brand && brand.id ? String(brand.id) : '';
    if (el.fTitle) el.fTitle.value = brand && brand.title ? brand.title : '';
    if (el.fIsActive) el.fIsActive.checked = !brand || brand.isActive !== false;
    if (el.btnDelete) el.btnDelete.disabled = !(brand && brand.id) || Number(brand.usageCount || 0) > 0;
    renderCategoryChecklist((brand && brand.categoryIds) || []);
    updateFormMeta(brand || null);
  }

  function renderBrands(list) {
    if (!el.listBody) return;
    el.listBody.replaceChildren();
    if (!Array.isArray(list) || list.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6" class="admin-empty">Бренды по текущим условиям не найдены.</td>';
      el.listBody.appendChild(row);
      updateSummary([]);
      return;
    }
    updateSummary(list);
    list.forEach((brand) => {
      const row = document.createElement('tr');
      const categories = Array.isArray(brand.categories) && brand.categories.length
        ? brand.categories.map((item) => escapeHtml(item.title)).join(', ')
        : '—';
      const statusBadge = brand.isActive === false
        ? '<span class="admin-badge admin-badge--hidden">Скрыт</span>'
        : '<span class="admin-badge admin-badge--stock">Активен</span>';
      row.innerHTML =
        `<td>${brand.id}</td>` +
        `<td><strong>${escapeHtml(brand.title)}</strong><div class="admin-table__sub">${escapeHtml(brand.slug || '')}</div></td>` +
        `<td>${categories}</td>` +
        `<td>${statusBadge}</td>` +
        `<td>${Number(brand.usageCount || 0)}</td>` +
        `<td><button type="button" class="btn btn--sm" data-edit-brand="${brand.id}">Изменить</button></td>`;
      el.listBody.appendChild(row);
    });
    el.listBody.querySelectorAll('[data-edit-brand]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-edit-brand');
        setStatus('Загрузка…');
        try {
          const brand = await api(`/api/admin/brands/${id}`);
          fillForm(brand);
          setStatus(`Редактирование бренда ID ${brand.id}`);
          document.querySelector('.admin-form-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
          setStatus(error.message || 'Ошибка загрузки', true);
        }
      });
    });
  }

  async function refreshBrands() {
    const params = new URLSearchParams();
    const search = (el.search && el.search.value ? el.search.value : '').trim();
    const category = el.categoryFilter ? el.categoryFilter.value : '';
    const status = el.statusFilter ? el.statusFilter.value : '';
    if (search) params.set('search', search);
    if (category) params.set('categoryId', category);
    if (status) params.set('status', status);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    state.brandsCache = await api(`/api/admin/brands${suffix}`);
    renderBrands(state.brandsCache);
  }

  async function init() {
    if (!api) {
      if (el.gate) el.gate.hidden = false;
      const text = el.gate && el.gate.querySelector('p');
      if (text) text.textContent = 'Не загружен auth.js';
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
      const text = el.gate && el.gate.querySelector('p');
      if (text) text.textContent = 'Нужны права администратора или модератора. Войдите под подходящей учётной записью и обновите страницу.';
      return;
    }
    if (el.panel) el.panel.hidden = false;
    if (el.usersTabLink && !user.isAdmin) {
      el.usersTabLink.hidden = true;
    }

    try {
      state.categories = await api('/api/categories');
      renderCategoryFilter();
      renderCategoryChecklist([]);
    } catch (error) {
      setStatus(error.message || 'Не удалось загрузить категории.', true);
    }

    el.btnRefresh?.addEventListener('click', () => refreshBrands().catch((error) => setStatus(error.message || 'Ошибка', true)));
    el.btnNew?.addEventListener('click', () => {
      clearForm();
      setStatus('Новый бренд — заполните форму и сохраните.');
    });
    el.btnReset?.addEventListener('click', () => {
      clearForm();
      setStatus('Форма бренда очищена.');
    });
    el.search?.addEventListener('input', () => refreshBrands().catch((error) => setStatus(error.message || 'Ошибка', true)));
    el.categoryFilter?.addEventListener('change', () => refreshBrands().catch((error) => setStatus(error.message || 'Ошибка', true)));
    el.statusFilter?.addEventListener('change', () => refreshBrands().catch((error) => setStatus(error.message || 'Ошибка', true)));

    el.form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = el.fTitle ? el.fTitle.value.trim() : '';
      if (!title) {
        setStatus('Укажите название бренда.', true);
        return;
      }
      const categoryIds = readSelectedCategoryIds();
      if (categoryIds.length === 0) {
        setStatus('Выберите хотя бы одну категорию.', true);
        return;
      }
      const body = {
        title,
        categoryIds,
        isActive: el.fIsActive ? el.fIsActive.checked : true,
      };
      setStatus('Сохранение…');
      try {
        const id = el.fId && el.fId.value ? el.fId.value.trim() : '';
        const brand = id
          ? await api(`/api/admin/brands/${id}`, { method: 'PUT', body })
          : await api('/api/admin/brands', { method: 'POST', body });
        fillForm(brand);
        setStatus(id ? 'Бренд сохранён.' : `Бренд создан. ID: ${brand.id}`);
        await refreshBrands();
      } catch (error) {
        setStatus(error.message || 'Ошибка сохранения бренда', true);
      }
    });

    el.btnDelete?.addEventListener('click', async () => {
      const id = el.fId && el.fId.value ? el.fId.value.trim() : '';
      if (!id || !confirm('Удалить бренд? Он исчезнет из фильтров и выпадающих списков.')) return;
      try {
        await api(`/api/admin/brands/${id}`, { method: 'DELETE' });
        clearForm();
        setStatus('Бренд удалён.');
        await refreshBrands();
      } catch (error) {
        setStatus(error.message || 'Ошибка удаления бренда', true);
      }
    });

    clearForm();
    await refreshBrands();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
