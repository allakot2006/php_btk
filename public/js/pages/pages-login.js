(function () {
  'use strict';

  function showForm(form) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.querySelectorAll('.auth-tabs .tab-btn').forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', '-1');
    });
    if (form === 'login') {
      document.getElementById('login-form').classList.remove('hidden');
      const b = document.querySelector('.auth-tabs .tab-btn[data-tab="login"]');
      if (b) {
        b.classList.add('active');
        b.setAttribute('aria-selected', 'true');
        b.setAttribute('tabindex', '0');
      }
    } else {
      document.getElementById('register-form').classList.remove('hidden');
      const b = document.querySelector('.auth-tabs .tab-btn[data-tab="register"]');
      if (b) {
        b.classList.add('active');
        b.setAttribute('aria-selected', 'true');
        b.setAttribute('tabindex', '0');
      }
    }
  }

  function init() {
    const tabButtons = document.querySelectorAll('.auth-tabs .tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        showForm(tab);
        btn.focus();
      });
    });

    const tablist = document.querySelector('.auth-tabs');
    if (tablist) {
      tablist.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const tabs = Array.from(tabButtons);
        let i = tabs.indexOf(document.activeElement);
        if (i < 0) {
          i = e.key === 'ArrowRight' ? -1 : tabs.length;
        }
        const nextIdx =
          e.key === 'ArrowRight' ? Math.min(tabs.length - 1, i + 1) : Math.max(0, i - 1);
        const next = tabs[nextIdx];
        if (next) {
          showForm(next.getAttribute('data-tab'));
          next.focus();
        }
      });
    }

    const auth = window.BeltelecomAuth;
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const status = document.getElementById('auth-status');
    const logoutBtn = document.getElementById('logout-btn');
    const successBox = document.getElementById('auth-success');
    const successTitle = document.getElementById('auth-success-title');
    const successText = document.getElementById('auth-success-text');
    if (!auth || !loginForm || !registerForm || !status) return;

    function setStatus(message, isError) {
      status.textContent = message || '';
      status.classList.toggle('is-error', Boolean(isError));
    }

    function startSuccessFlow(title, message, redirectTo) {
      document.querySelectorAll('.auth-tabs, .auth-form, .auth-status-line').forEach((node) => {
        node.classList.add('hidden');
      });
      if (successTitle) successTitle.textContent = title;
      if (successText) successText.textContent = message;
      if (successBox) successBox.classList.remove('hidden');
      document.querySelector('.auth-panel')?.classList.add('auth-panel--success');
      window.setTimeout(() => {
        window.location.href = redirectTo;
      }, 1400);
    }

    const validate = window.BeltelecomValidate;

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus('Проверяем данные…', false);
      if (validate) {
        const emailMsg = validate.emailError(document.getElementById('login-email').value);
        if (emailMsg) {
          setStatus(emailMsg, true);
          return;
        }
      }
      try {
        await auth.api('/api/auth/login', {
          method: 'POST',
          body: {
            email: validate ? validate.normalizeEmail(document.getElementById('login-email').value) : document.getElementById('login-email').value,
            password: document.getElementById('login-password').value,
          },
        });
        await auth.loadCurrentUser();
        if (window.BeltelecomShell) window.BeltelecomShell.refreshAuthNav();
        startSuccessFlow('Вход выполнен', 'Добро пожаловать! Перенаправляем вас в личный кабинет…', 'account.html');
      } catch (err) {
        setStatus(err.message || 'Ошибка входа', true);
      }
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus('Создаём аккаунт…', false);
      const password = document.getElementById('reg-password').value;
      const confirm = document.getElementById('reg-confirm').value;
      if (password !== confirm) {
        setStatus('Пароли не совпадают', true);
        return;
      }
      if (validate) {
        const emailMsg = validate.emailError(document.getElementById('reg-email').value);
        if (emailMsg) {
          setStatus(emailMsg, true);
          return;
        }
        const phoneMsg = validate.phoneError(document.getElementById('reg-phone').value, true);
        if (phoneMsg) {
          setStatus(phoneMsg, true);
          return;
        }
        const addressMsg = validate.addressErrorMessage(document.getElementById('reg-address').value, true);
        if (addressMsg) {
          setStatus(addressMsg, true);
          return;
        }
      }
      try {
        const phoneRaw = document.getElementById('reg-phone').value;
        const addressRaw = document.getElementById('reg-address').value;
        await auth.api('/api/auth/register', {
          method: 'POST',
          body: {
            name: document.getElementById('reg-name').value.trim(),
            email: validate ? validate.normalizeEmail(document.getElementById('reg-email').value) : document.getElementById('reg-email').value,
            password,
            phone: validate ? validate.normalizePhone(phoneRaw) : phoneRaw,
            address: validate ? validate.normalizeAddress(addressRaw) : addressRaw.trim(),
          },
        });
        await auth.loadCurrentUser();
        if (window.BeltelecomShell) window.BeltelecomShell.refreshAuthNav();
        startSuccessFlow('Аккаунт создан', 'Регистрация прошла успешно. Переходим в ваш личный кабинет…', 'account.html');
      } catch (err) {
        setStatus(err.message || 'Ошибка регистрации', true);
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await auth.logout();
          if (window.BeltelecomShell) window.BeltelecomShell.refreshAuthNav();
          setStatus('Вы вышли из аккаунта.', false);
        } catch (err) {
          setStatus(err.message || 'Ошибка выхода', true);
        }
      });
    }

    if (validate && typeof validate.bindAddressInput === 'function') {
      validate.bindAddressInput(document.getElementById('reg-address'));
    }

    auth.loadCurrentUser().catch(() => setStatus('Не удалось проверить сессию', true));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
