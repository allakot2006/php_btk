(function () {
  'use strict';

  const api = window.BeltelecomAuth && window.BeltelecomAuth.api;

  const el = {
    gate: document.getElementById('admin-gate'),
    panel: document.getElementById('admin-panel'),
    catFilter: document.getElementById('admin-cat-filter'),
    search: document.getElementById('admin-search'),
    listBody: document.querySelector('#admin-list tbody'),
    form: document.getElementById('admin-product-form'),
    status: document.getElementById('admin-status'),
    specsRoot: document.getElementById('admin-specs-sections'),
    listCount: document.getElementById('admin-list-count'),
    formTitle: document.getElementById('admin-form-title'),
    formLead: document.getElementById('admin-form-lead'),
    currentState: document.getElementById('admin-current-state'),
    currentMeta: document.getElementById('admin-current-meta'),
    preview: document.getElementById('admin-image-preview'),
    previewCaption: document.getElementById('admin-image-caption'),
    statTotal: document.getElementById('admin-stat-total'),
    statActive: document.getElementById('admin-stat-active'),
    statHidden: document.getElementById('admin-stat-hidden'),
    statStock: document.getElementById('admin-stat-stock'),
    fId: document.getElementById('f-id'),
    fCategoryId: document.getElementById('f-categoryId'),
    fSlug: document.getElementById('f-slug'),
    fName: document.getElementById('f-name'),
    fDescription: document.getElementById('f-description'),
    fFullDescription: document.getElementById('f-fullDescription'),
    fPrice: document.getElementById('f-price'),
    fOriginalPrice: document.getElementById('f-originalPrice'),
    fDiscount: document.getElementById('f-discount'),
    fImage: document.getElementById('f-image'),
    fImageFile: document.getElementById('f-image-file'),
    fColor: document.getElementById('f-color'),
    fBrand: document.getElementById('f-brand'),
    fSku: document.getElementById('f-sku'),
    fStock: document.getElementById('f-stock'),
    fIsActive: document.getElementById('f-isActive'),
    btnImagePick: document.getElementById('admin-image-pick'),
    btnDelete: document.getElementById('admin-delete'),
    btnCancelEdit: document.getElementById('admin-cancel-edit'),
    btnRefresh: document.getElementById('admin-refresh'),
    btnNew: document.getElementById('admin-new'),
    btnAddSection: document.getElementById('admin-add-section'),
    btnExample: document.getElementById('admin-specs-example'),
    formWrap: document.querySelector('.admin-form-wrap'),
    modal: document.getElementById('admin-product-modal'),
    modalClose: document.getElementById('admin-modal-close'),
    modalDismiss: document.querySelectorAll('[data-admin-modal-close]'),
    usersTabLink: document.querySelector('.admin-tabs__link[href="admin-users.html"]'),
  };

  const state = {
    categories: [],
    brands: [],
    productsCache: [],
  };

  function openModal() {
    if (!el.modal) return;
    el.modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    if (!el.modal) return;
    el.modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function setStatus(msg, isErr) {
    if (!el.status) return;
    el.status.textContent = msg || '';
    el.status.classList.remove('is-error', 'is-success');
    if (!msg) return;
    if (isErr) el.status.classList.add('is-error');
    else if (!/[.…]$/.test(String(msg))) el.status.classList.add('is-success');
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString('ru-RU');
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
    const active = items.filter((item) => item.isActive !== false).length;
    const hidden = total - active;
    const withStock = items.filter((item) => item.stockQuantity != null && Number(item.stockQuantity) > 0).length;
    if (el.statTotal) el.statTotal.textContent = String(total);
    if (el.statActive) el.statActive.textContent = String(active);
    if (el.statHidden) el.statHidden.textContent = String(hidden);
    if (el.statStock) el.statStock.textContent = String(withStock);
    if (el.listCount) {
      const suffix = total === 1 ? 'позиция' : total >= 2 && total <= 4 ? 'позиции' : 'позиций';
      el.listCount.textContent = `${total} ${suffix}`;
    }
  }

  function updatePreview(url, name) {
    if (!el.preview) return;
    const src = (url || '').trim() || '/assets/system/placeholder-product.svg';
    el.preview.src = src;
    el.preview.alt = name ? `Предпросмотр: ${name}` : 'Предпросмотр товара';
    if (el.previewCaption) {
      el.previewCaption.textContent = (url || '').trim()
        ? `Изображение для карточки: ${src}`
        : 'Задайте URL картинки, чтобы увидеть предпросмотр.';
    }
  }

  function updateFormMeta(product) {
    const isExisting = Boolean(product && product.id);
    if (el.formTitle) {
      el.formTitle.textContent = isExisting ? `Редактирование: ${product.name || 'товар'}` : 'Новая карточка товара';
    }
    if (el.formLead) {
      el.formLead.textContent = isExisting
        ? 'Изменяйте параметры, описание и характеристики выбранного товара.'
        : 'Заполните основные данные, описание и характеристики.';
    }
    if (el.currentState) {
      el.currentState.textContent = isExisting
        ? product.isActive === false ? 'Скрыт с витрины' : 'Опубликован'
        : 'Новый товар';
      el.currentState.classList.toggle('admin-chip--accent', !isExisting || product.isActive !== false);
    }
    if (el.currentMeta) {
      el.currentMeta.textContent = isExisting
        ? `ID ${product.id}${product.sku ? ` · SKU ${product.sku}` : ''}`
        : 'ID появится после сохранения';
    }
    updatePreview(product && product.image ? product.image : '', product && product.name ? product.name : '');
  }

  function getSelectedCategory() {
    const categoryId = Number(el.fCategoryId && el.fCategoryId.value);
    if (!Number.isFinite(categoryId) || categoryId <= 0) return null;
    return state.categories.find((category) => Number(category.id) === categoryId) || null;
  }

  function brandsForCategory(categoryId) {
    const normalized = Number(categoryId);
    if (!Number.isFinite(normalized) || normalized <= 0) return [];
    return state.brands.filter((brand) => Array.isArray(brand.categoryIds) && brand.categoryIds.some((id) => Number(id) === normalized));
  }

  function renderBrandOptions(categoryId, selectedBrand) {
    if (!el.fBrand) return;
    const currentValue = selectedBrand != null ? String(selectedBrand) : String(el.fBrand.value || '');
    const list = brandsForCategory(categoryId).filter((brand) => brand.isActive !== false);
    el.fBrand.replaceChildren();

    function addOption(value, label) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      el.fBrand.appendChild(option);
    }

    addOption('', list.length ? 'Без бренда' : 'Нет брендов для выбранной категории');
    list.forEach((brand) => addOption(String(brand.title || ''), String(brand.title || '')));
    if (currentValue && !list.some((brand) => String(brand.title || '') === currentValue)) {
      addOption(currentValue, `${currentValue} (сохранённое значение)`);
    }
    el.fBrand.value = currentValue;
  }

  function refreshBrandSelect(selectedBrand) {
    const category = getSelectedCategory();
    renderBrandOptions(category ? category.id : 0, selectedBrand);
  }

  async function uploadImage(file) {
    if (!file) return;
    const category = getSelectedCategory();
    if (!category) {
      if (el.fImageFile) el.fImageFile.value = '';
      setStatus('Сначала выберите категорию товара, затем загружайте фото.', true);
      return;
    }
    const formData = new FormData();
    formData.append('image', file);
    formData.append('categoryId', String(category.id));
    if (el.btnImagePick) el.btnImagePick.disabled = true;
    setStatus(`Загрузка изображения "${file.name}"…`);
    try {
      const response = await fetch('/api/admin/products/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : 'Ошибка загрузки изображения');
      }
      const imageUrl = payload && typeof payload.image === 'string' ? payload.image.trim() : '';
      if (!imageUrl) {
        throw new Error('Сервер не вернул путь к загруженному изображению.');
      }
      el.fImage.value = imageUrl;
      updatePreview(imageUrl, el.fName.value.trim());
      setStatus(`Изображение загружено в категорию «${category.title}».`);
    } catch (error) {
      setStatus(error.message || 'Ошибка загрузки изображения', true);
    } finally {
      if (el.btnImagePick) el.btnImagePick.disabled = false;
      if (el.fImageFile) el.fImageFile.value = '';
    }
  }

  function isProductPayload(value) {
    return Boolean(value && typeof value === 'object' && Number(value.id) > 0);
  }

  function fillCategorySelects(list) {
    state.categories = list || [];
    function addOption(select, value, label) {
      const opt = document.createElement('option');
      opt.value = String(value);
      opt.textContent = label;
      select.appendChild(opt);
    }
    if (el.catFilter) {
      el.catFilter.replaceChildren();
      addOption(el.catFilter, '', 'Все категории');
      state.categories.forEach((c) => addOption(el.catFilter, c.slug, `${c.title} (${c.slug})`));
    }
    if (el.fCategoryId) {
      el.fCategoryId.replaceChildren();
      state.categories.forEach((c) => addOption(el.fCategoryId, c.id, `${c.title} (${c.slug})`));
    }
    refreshBrandSelect('');
  }

  function clearSpecsUi() {
    if (el.specsRoot) el.specsRoot.replaceChildren();
  }

  function addSectionUi(data) {
    const sec = data || { title: '', descriptionPoints: [], rows: [] };
    const wrap = document.createElement('div');
    wrap.className = 'admin-sec';

    const head = document.createElement('div');
    head.className = 'admin-sec__head';
    head.innerHTML =
      '<label class="admin-sec__title-label">Заголовок секции <input type="text" class="admin-sec-title" /></label>' +
      '<button type="button" class="btn btn--sm admin-sec-remove">Удалить секцию</button>';
    wrap.appendChild(head);

    const titleInput = wrap.querySelector('.admin-sec-title');
    if (titleInput) titleInput.value = sec.title || '';

    const pointsLabel = document.createElement('label');
    pointsLabel.className = 'admin-sec-points-label';
    pointsLabel.innerHTML =
      'Пункты описания (зелёные ✓), по одному в строке<textarea class="admin-sec-points" rows="3"></textarea>';
    wrap.appendChild(pointsLabel);
    const pointsTa = wrap.querySelector('.admin-sec-points');
    if (pointsTa && Array.isArray(sec.descriptionPoints)) pointsTa.value = sec.descriptionPoints.join('\n');

    const table = document.createElement('table');
    table.className = 'admin-sec-table';
    table.innerHTML =
      '<thead><tr><th>Параметр</th><th>Значение</th><th>Тип</th><th>Доп. к ✓</th><th></th></tr></thead><tbody></tbody>';
    wrap.appendChild(table);
    const tbody = table.querySelector('tbody');

    function addRowUi(row) {
      const r = row || { label: '', value: '', type: 'text', suffix: '' };
      const tr = document.createElement('tr');
      const isBool = r.type === 'bool' || typeof r.value === 'boolean';
      const boolVal = typeof r.value === 'boolean' ? r.value : false;
      const textVal = typeof r.value === 'boolean' ? '' : r.value == null ? '' : String(r.value);
      tr.innerHTML =
        '<td><input type="text" class="admin-row-label" /></td>' +
        '<td class="admin-row-val-cell"></td>' +
        '<td><select class="admin-row-type"><option value="text">Текст</option><option value="bool">Да/нет</option></select></td>' +
        '<td><input type="text" class="admin-row-suffix" placeholder="напр. 6.0" /></td>' +
        '<td><button type="button" class="btn btn--sm admin-row-remove">×</button></td>';
      tr.querySelector('.admin-row-label').value = r.label || '';
      tr.querySelector('.admin-row-suffix').value = r.suffix || '';
      const typeSel = tr.querySelector('.admin-row-type');
      typeSel.value = isBool ? 'bool' : 'text';
      const valCell = tr.querySelector('.admin-row-val-cell');
      function renderValEditor() {
        valCell.replaceChildren();
        if (typeSel.value === 'bool') {
          const lab = document.createElement('label');
          lab.className = 'admin-row-bool';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'admin-row-bool-cb';
          cb.checked = boolVal;
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(' да'));
          valCell.appendChild(lab);
        } else {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'admin-row-text';
          inp.value = textVal;
          valCell.appendChild(inp);
        }
      }
      renderValEditor();
      typeSel.addEventListener('change', renderValEditor);
      tr.querySelector('.admin-row-remove').addEventListener('click', () => tr.remove());
      tbody.appendChild(tr);
    }

    (sec.rows || []).forEach(addRowUi);

    const addRowBtn = document.createElement('button');
    addRowBtn.type = 'button';
    addRowBtn.className = 'btn btn--sm admin-sec-add-row';
    addRowBtn.textContent = '+ Параметр';
    addRowBtn.addEventListener('click', () => addRowUi());
    wrap.appendChild(addRowBtn);

    wrap.querySelector('.admin-sec-remove').addEventListener('click', () => wrap.remove());
    if (el.specsRoot) el.specsRoot.appendChild(wrap);
  }

  function readSpecsFromUi() {
    const sections = [];
    if (!el.specsRoot) return { sections };
    el.specsRoot.querySelectorAll('.admin-sec').forEach((wrap) => {
      const title = (wrap.querySelector('.admin-sec-title') || {}).value?.trim() || '';
      if (!title) return;
      const pointsRaw = (wrap.querySelector('.admin-sec-points') || {}).value || '';
      const descriptionPoints = pointsRaw.split('\n').map((s) => s.trim()).filter(Boolean);
      const rows = [];
      wrap.querySelectorAll('.admin-sec-table tbody tr').forEach((tr) => {
        const label = (tr.querySelector('.admin-row-label') || {}).value?.trim() || '';
        if (!label) return;
        const type = (tr.querySelector('.admin-row-type') || {}).value || 'text';
        const suffix = (tr.querySelector('.admin-row-suffix') || {}).value?.trim() || '';
        const row = { label, suffix: suffix || undefined };
        if (type === 'bool') row.value = Boolean(tr.querySelector('.admin-row-bool-cb')?.checked);
        else row.value = tr.querySelector('.admin-row-text') ? tr.querySelector('.admin-row-text').value : '';
        if (!row.suffix) delete row.suffix;
        rows.push(row);
      });
      const sec = { title, rows };
      if (descriptionPoints.length) sec.descriptionPoints = descriptionPoints;
      sections.push(sec);
    });
    return { sections };
  }

  function loadSpecsToUi(specs) {
    clearSpecsUi();
    if (!specs || typeof specs !== 'object') return;
    const secs = Array.isArray(specs.sections) ? specs.sections : [];
    if (secs.length) {
      secs.forEach((s) => addSectionUi(s));
      return;
    }
    const rows = [];
    for (const [label, value] of Object.entries(specs)) {
      if (label === 'sections') continue;
      rows.push({ label, value: typeof value === 'boolean' ? value : String(value), type: typeof value === 'boolean' ? 'bool' : 'text' });
    }
    if (rows.length) addSectionUi({ title: 'Параметры', rows });
  }

  function exampleLaptopSpecs() {
    clearSpecsUi();
    addSectionUi({
      title: 'Общая информация',
      descriptionPoints: [
        'Компактный ноутбук для работы и учёбы: лёгкий корпус, автономность на день, современные интерфейсы.',
        'Точные параметры зависят от комплектации — сверяйте с паспортом модели.',
      ],
      rows: [
        { label: 'Дата выхода на рынок', value: '2026 г.' },
        { label: 'Продуктовая линейка', value: 'Apple MacBook Neo' },
        { label: 'Тип', value: 'классический' },
      ],
    });
  }

  function clearForm() {
    el.fId.value = '';
    el.fSlug.value = '';
    el.fName.value = '';
    el.fDescription.value = '';
    el.fFullDescription.value = '';
    el.fPrice.value = '';
    el.fOriginalPrice.value = '';
    el.fDiscount.value = '';
    el.fImage.value = '';
    el.fColor.value = '';
    refreshBrandSelect('');
    if (el.fSku) el.fSku.value = '';
    if (el.fStock) el.fStock.value = '';
    if (el.fImageFile) el.fImageFile.value = '';
    el.fIsActive.checked = true;
    el.btnDelete.disabled = true;
    if (el.btnCancelEdit) el.btnCancelEdit.disabled = true;
    clearSpecsUi();
    addSectionUi({ title: 'Основные параметры', rows: [] });
    updateFormMeta(null);
  }

  function fillForm(p) {
    el.fId.value = p.id ? String(p.id) : '';
    el.fCategoryId.value = String(p.categoryId);
    el.fSlug.value = p.slug || '';
    el.fName.value = p.name || '';
    el.fDescription.value = p.description || '';
    el.fFullDescription.value = p.fullDescription || '';
    el.fPrice.value = p.price != null ? String(p.price) : '';
    el.fOriginalPrice.value = p.originalPrice != null ? String(p.originalPrice) : '';
    el.fDiscount.value = p.discount != null ? String(p.discount) : '';
    el.fImage.value = p.image || '';
    el.fColor.value = p.color || '';
    refreshBrandSelect(p.brand || '');
    if (el.fSku) el.fSku.value = p.sku != null ? String(p.sku) : '';
    if (el.fStock) el.fStock.value = p.stockQuantity != null && p.stockQuantity !== '' ? String(p.stockQuantity) : '';
    el.fIsActive.checked = p.isActive !== false;
    el.btnDelete.disabled = !p.id;
    if (el.btnCancelEdit) el.btnCancelEdit.disabled = !p.id;
    loadSpecsToUi(p.specs || null);
    updateFormMeta(p);
  }

  async function openEditProduct(id) {
    if (!id) return;
    setStatus('Загрузка…');
    openModal();
    try {
      const p = await api(`/api/admin/products/${id}`);
      fillForm(p);
      setStatus(`Редактирование товара ID ${p.id}`);
    } catch (e) {
      setStatus(e.message || 'Ошибка', true);
    }
  }

  function renderList(list) {
    el.listBody.replaceChildren();
    if (!Array.isArray(list) || list.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" class="admin-empty">Ничего не найдено по текущим условиям.</td>';
      el.listBody.appendChild(tr);
      updateSummary([]);
      return;
    }
    updateSummary(list);
    list.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${p.id}</td><td>${escapeHtml(p.name)}</td>` +
        `<td class="admin-table__actions"><button type="button" class="btn btn--sm" data-edit-product="${p.id}">Изменить</button></td>`;
      el.listBody.appendChild(tr);
    });
    el.listBody.querySelectorAll('[data-edit-product]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-edit-product');
        await openEditProduct(id);
      });
    });
  }

  function applyFilters() {
    const query = (el.search && el.search.value ? el.search.value : '').trim().toLowerCase();
    const filtered = state.productsCache.filter((p) => {
      if (!query) return true;
      return [p.name, p.slug, p.sku].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
    renderList(filtered);
  }

  async function refreshList() {
    const cat = el.catFilter.value;
    const q = cat ? `?category=${encodeURIComponent(cat)}` : '';
    state.productsCache = await api(`/api/admin/products${q}`);
    applyFilters();
  }

  async function init() {
    closeModal();

    if (!api) {
      el.gate.hidden = false;
      el.gate.querySelector('p').textContent = 'Не загружен auth.js';
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
      el.gate.hidden = false;
      const gateText = el.gate.querySelector('p');
      if (gateText) gateText.textContent = 'Нужны права администратора или модератора. Войдите под подходящей учётной записью и обновите страницу.';
      return;
    }
    el.panel.hidden = false;
    if (el.usersTabLink && !user.isAdmin) {
      el.usersTabLink.hidden = true;
    }

    try {
      const cats = await api('/api/categories');
      fillCategorySelects(cats);
      state.brands = await api('/api/admin/brands');
      refreshBrandSelect('');
    } catch (e) {
      setStatus(e.message || 'Не удалось загрузить категории.', true);
    }

    el.btnRefresh?.addEventListener('click', () => refreshList().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.catFilter?.addEventListener('change', () => refreshList().catch((e) => setStatus(e.message || 'Ошибка', true)));
    el.search?.addEventListener('input', applyFilters);
    el.fCategoryId?.addEventListener('change', () => refreshBrandSelect(''));
    el.btnNew?.addEventListener('click', () => {
      clearForm();
      setStatus('Новая карточка — заполните и сохраните.');
      openModal();
    });
    el.btnCancelEdit?.addEventListener('click', () => {
      clearForm();
      setStatus('Редактирование отменено.');
      closeModal();
    });
    el.modalClose?.addEventListener('click', closeModal);
    el.modalDismiss?.forEach((node) => node.addEventListener('click', closeModal));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && el.modal && !el.modal.hidden) {
        closeModal();
      }
    });
    el.btnAddSection?.addEventListener('click', () => addSectionUi({ title: '', rows: [] }));
    el.btnExample?.addEventListener('click', () => {
      exampleLaptopSpecs();
      setStatus('Вставлен пример секций — отредактируйте под товар.');
    });
    el.btnImagePick?.addEventListener('click', () => {
      if (!el.fCategoryId || !el.fCategoryId.value) {
        setStatus('Сначала выберите категорию товара.', true);
        return;
      }
      el.fImageFile?.click();
    });
    el.fImageFile?.addEventListener('change', async () => {
      const file = el.fImageFile && el.fImageFile.files ? el.fImageFile.files[0] : null;
      await uploadImage(file);
    });

    el.form?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      setStatus('Сохранение…');
      const specs = readSpecsFromUi();
      let stockQuantity = null;
      if (el.fStock && el.fStock.value.trim() !== '') {
        const n = parseInt(el.fStock.value, 10);
        stockQuantity = Number.isFinite(n) ? n : null;
      }
      const price = Number(el.fPrice.value);
      if (!Number.isFinite(price) || price < 0) {
        setStatus('Укажите корректную цену товара.', true);
        return;
      }
      if (stockQuantity !== null && stockQuantity < 0) {
        setStatus('Остаток не может быть отрицательным.', true);
        return;
      }
      const body = {
        categoryId: Number(el.fCategoryId.value),
        slug: el.fSlug.value.trim(),
        name: el.fName.value.trim(),
        description: el.fDescription.value.trim() || null,
        fullDescription: el.fFullDescription.value.trim() || null,
        price,
        originalPrice: el.fOriginalPrice.value === '' ? null : parseFloat(el.fOriginalPrice.value),
        discount: el.fDiscount.value === '' ? null : parseInt(el.fDiscount.value, 10),
        image: el.fImage.value.trim() || null,
        color: el.fColor.value.trim() || null,
        brand: (el.fBrand.value || '').trim() || null,
        sku: el.fSku && el.fSku.value.trim() !== '' ? el.fSku.value.trim() : null,
        stockQuantity,
        isActive: el.fIsActive.checked,
        specs,
      };
      try {
        const id = el.fId.value.trim();
        const result = id
          ? await api(`/api/admin/products/${id}`, { method: 'PUT', body })
          : await api('/api/admin/products', { method: 'POST', body });
        let savedProduct = isProductPayload(result) ? result : null;
        if (!savedProduct && id) {
          savedProduct = await api(`/api/admin/products/${id}`);
        }
        if (!isProductPayload(savedProduct)) {
          throw new Error('Сервер не вернул карточку товара после сохранения.');
        }
        fillForm(savedProduct);
        setStatus(id ? 'Товар сохранён.' : `Товар создан. ID: ${savedProduct.id}`);
        await refreshList();
      } catch (e) {
        setStatus(e.message || 'Ошибка сохранения', true);
      }
    });

    el.btnDelete?.addEventListener('click', async () => {
      const id = el.fId.value.trim();
      if (!id || !confirm('Удалить товар навсегда? Это действие необратимо.')) return;
      try {
        await api(`/api/admin/products/${id}`, { method: 'DELETE' });
        setStatus('Товар удалён.');
        clearForm();
        closeModal();
        await refreshList();
      } catch (e) {
        setStatus(e.message || 'Ошибка удаления', true);
      }
    });

    el.fImage?.addEventListener('input', () => updatePreview(el.fImage.value, el.fName.value));
    el.fName?.addEventListener('input', () => updatePreview(el.fImage.value, el.fName.value));

    clearForm();
    await refreshList();
  }

  window.addEventListener('pageshow', () => {
    closeModal();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
