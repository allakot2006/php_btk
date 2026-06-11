(function () {
  async function api(path, options = {}) {
    const res = await fetch(path, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      let msg = data && data.error ? data.error : 'Ошибка запроса';
      if (data && data.details) {
        msg += ': ' + data.details;
      }
      throw new Error(msg);
    }
    return data;
  }

  function setAuthUi(user) {
    document.querySelectorAll('[data-auth-user]').forEach((el) => {
      el.textContent = user ? `Вы вошли как: ${user.name} (${user.email})` : 'Вы не авторизованы';
    });
    document.querySelectorAll('[data-auth-only]').forEach((el) => {
      el.style.display = user ? '' : 'none';
    });
    document.querySelectorAll('[data-guest-only]').forEach((el) => {
      el.style.display = user ? 'none' : '';
    });
  }

  async function loadCurrentUser() {
    const data = await api('/api/auth/me');
    const user = data && data.user ? data.user : null;
    setAuthUi(user);
    if (window.BeltelecomShell && typeof window.BeltelecomShell.refreshAuthNav === 'function') {
      window.BeltelecomShell.refreshAuthNav(user);
    }
    return user;
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setAuthUi(null);
    if (window.BeltelecomShell && typeof window.BeltelecomShell.refreshAuthNav === 'function') {
      window.BeltelecomShell.refreshAuthNav(null);
    }
  }

  window.BeltelecomAuth = {
    api,
    loadCurrentUser,
    logout,
  };
})();
