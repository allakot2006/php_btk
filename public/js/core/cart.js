(function () {
  const CART_KEY = 'bt_cart_v1';

  function safeNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function notifyCartChanged() {
    try {
      document.dispatchEvent(new Event('beltelecom-cart-changed'));
    } catch (_) {}
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    notifyCartChanged();
  }

  function normalizeItem(item) {
    const qty = Math.max(1, Math.min(999, parseInt(item.qty, 10) || 1));
    const price = Math.max(0, safeNumber(item.price, 0));
    const stockRaw = item.stockQuantity ?? item.stock_quantity ?? null;
    const stockQuantity =
      stockRaw === null || stockRaw === undefined || stockRaw === '' || !Number.isFinite(Number(stockRaw))
        ? null
        : Math.max(0, parseInt(stockRaw, 10));
    const finalQty = stockQuantity === null ? qty : Math.min(qty, stockQuantity || 1);
    return {
      productId: item.productId ?? null,
      slug: item.slug ?? null,
      name: String(item.name || '').trim(),
      price,
      image: item.image ?? null,
      qty: finalQty,
      stockQuantity,
    };
  }

  function addToCart(item, qty = 1) {
    const items = loadCart();
    const normalized = normalizeItem({ ...item, qty });
    if (!normalized.name) return;

    const key = normalized.productId != null ? `id:${normalized.productId}` : `name:${normalized.name.toLowerCase()}`;
    const idx = items.findIndex((x) => {
      const xKey = x.productId != null ? `id:${x.productId}` : `name:${String(x.name).toLowerCase()}`;
      return xKey === key;
    });

    if (idx >= 0) {
      const stockLimit =
        normalized.stockQuantity === null ? 999 : Math.max(1, Number(normalized.stockQuantity));
      items[idx] = normalizeItem({
        ...items[idx],
        ...normalized,
        qty: Math.min(stockLimit, (parseInt(items[idx].qty, 10) || 1) + normalized.qty),
      });
    } else {
      items.push(normalized);
    }

    saveCart(items);
    return items;
  }

  function updateQty(index, qty) {
    const items = loadCart();
    if (index < 0 || index >= items.length) return items;
    const stockLimit =
      items[index].stockQuantity === null || items[index].stockQuantity === undefined
        ? 999
        : Math.max(1, Number(items[index].stockQuantity));
    const q = Math.max(1, Math.min(999, stockLimit, parseInt(qty, 10) || 1));
    items[index].qty = q;
    saveCart(items);
    return items;
  }

  function removeItem(index) {
    const items = loadCart();
    if (index < 0 || index >= items.length) return items;
    items.splice(index, 1);
    saveCart(items);
    return items;
  }

  function clearCart() {
    localStorage.setItem(CART_KEY, JSON.stringify([]));
    notifyCartChanged();
  }

  function totals(items) {
    const subtotal = (items || []).reduce((sum, it) => sum + safeNumber(it.price) * safeNumber(it.qty), 0);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
    };
  }

  window.BeltelecomCart = {
    loadCart,
    saveCart,
    addToCart,
    updateQty,
    removeItem,
    clearCart,
    totals,
  };
})();

