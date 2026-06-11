(function () {
  'use strict';

  function isPlainObject(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
  }

  function shouldSkipSpecRow(label, value) {
    const L = String(label ?? '').trim();
    if (!L) return true;
    const low = L.toLowerCase();
    if (low.startsWith('_')) return true;
    const internal = new Set([
      'фото',
      'photo',
      'изображение',
      'image',
      'папка',
      'folder',
      'path',
      'путь',
      'файл',
      'file',
    ]);
    if (internal.has(low)) return true;
    const valStr = String(value ?? '').trim();
    if (/^(public\/|public\\\\|\\\\)/i.test(valStr)) return true;
    if (/[/\\]assets[/\\]products[/\\]/i.test(valStr)) return true;
    return false;
  }

  function sanitizeSections(sections) {
    if (!Array.isArray(sections)) return [];
    return sections
      .map((sec) => {
        if (!sec || typeof sec !== 'object') return null;
        const rows = (Array.isArray(sec.rows) ? sec.rows : []).filter(
          (r) => r && typeof r.label === 'string' && !shouldSkipSpecRow(r.label, r.value)
        );
        return { ...sec, rows };
      })
      .filter((sec) => {
        if (!sec) return false;
        const hasRows = Array.isArray(sec.rows) && sec.rows.length > 0;
        return hasRows;
      });
  }

  function flatSpecsToSections(specs) {
    const rows = [];
    for (const [label, value] of Object.entries(specs)) {
      if (label === 'sections' || label.startsWith('_')) continue;
      if (value === undefined) continue;
      if (shouldSkipSpecRow(label, value)) continue;
      rows.push({ label, value: value });
    }
    if (!rows.length) return [];
    return [
      {
        title: 'Основные',
        rows,
      },
    ];
  }

  function normalizeSections(specs) {
    if (!isPlainObject(specs)) return [];
    if (Array.isArray(specs.sections) && specs.sections.length) {
      return sanitizeSections(specs.sections);
    }
    return flatSpecsToSections(specs);
  }

  function renderBoolCell(td, value, suffix) {
    const wrap = document.createElement('span');
    wrap.className = 'specs-onl-bool';
    if (value === true || value === 'true' || value === 1 || value === '1') {
      const icon = document.createElement('span');
      icon.className = 'specs-onl-bool__yes';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '✓';
      wrap.appendChild(icon);
      if (suffix) {
        const s = document.createElement('span');
        s.className = 'specs-onl-bool__suffix';
        s.textContent = ' ' + suffix;
        wrap.appendChild(s);
      }
    } else if (value === false || value === 'false' || value === 0 || value === '0') {
      const icon = document.createElement('span');
      icon.className = 'specs-onl-bool__no';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '✕';
      wrap.appendChild(icon);
    } else {
      wrap.textContent = value == null ? '—' : String(value);
    }
    td.appendChild(wrap);
  }

  function renderValueCell(td, row) {
    const v = row.value;
    const suffix = row.suffix != null ? String(row.suffix) : '';
    if (typeof v === 'boolean') {
      renderBoolCell(td, v, suffix);
      return;
    }
    if (v === 'true' || v === 'false') {
      renderBoolCell(td, v === 'true', suffix);
      return;
    }
    const text = v == null ? '' : String(v);
    if (text === '') {
      td.textContent = '—';
      return;
    }
    td.textContent = suffix ? text + ' ' + suffix : text;
  }

  function render(container, specs) {
    container.replaceChildren();
    if (!specs || !isPlainObject(specs)) {
      container.innerHTML = '<p class="specs-onl-empty">Характеристики скоро появятся.</p>';
      return;
    }

    const sections = normalizeSections(specs);
    if (!sections.length) {
      container.innerHTML = '<p class="specs-onl-empty">Характеристики скоро появятся.</p>';
      return;
    }

    const root = document.createElement('div');
    root.className = 'specs-onl';

    for (const sec of sections) {
      if (!sec || typeof sec.title !== 'string') continue;
      const block = document.createElement('div');
      block.className = 'specs-onl-block';

      const head = document.createElement('div');
      head.className = 'specs-onl-block__head';
      const headTitle = document.createElement('span');
      headTitle.className = 'specs-onl-block__head-text';
      headTitle.textContent = sec.title;
      head.appendChild(headTitle);

      const content = document.createElement('div');
      content.className = 'specs-onl-block__content';

      const rows = (Array.isArray(sec.rows) ? sec.rows : []).filter(
        (row) => row && typeof row.label === 'string' && !shouldSkipSpecRow(row.label, row.value)
      );
      if (!rows.length) continue;

      const table = document.createElement('table');
      table.className = 'specs-onl-table';

      rows.forEach((row, idx) => {
        if (!row || typeof row.label !== 'string') return;
        const tr = document.createElement('tr');
        tr.className = 'specs-onl-table__row';
        const td1 = document.createElement('td');
        td1.className = 'specs-onl-table__label';
        const labelInner = document.createElement('div');
        labelInner.className = 'specs-onl-table__label-inner';
        const labelText = document.createElement('span');
        labelText.className = 'specs-onl-table__label-text';
        labelText.textContent = row.label;
        labelInner.appendChild(labelText);
        if (row.help) {
          const tip = document.createElement('span');
          tip.className = 'specs-onl-help';
          tip.textContent = 'i';
          tip.title = String(row.help);
          tip.setAttribute('role', 'img');
          tip.setAttribute('aria-label', 'Пояснение к параметру');
          labelInner.appendChild(tip);
        }
        td1.appendChild(labelInner);
        const td2 = document.createElement('td');
        td2.className = 'specs-onl-table__value';
        renderValueCell(td2, row);
        tr.appendChild(td1);
        tr.appendChild(td2);
        table.appendChild(tr);
      });

      if (rows.length) content.appendChild(table);
      block.appendChild(head);
      block.appendChild(content);
      root.appendChild(block);
    }

    container.appendChild(root);
  }

  window.BeltelecomSpecs = {
    render,
    normalizeSections,
    shouldSkipSpecRow,
  };
})();
