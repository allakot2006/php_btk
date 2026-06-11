(function () {
  'use strict';

  const EMAIL_RE = /^[a-z0-9]+(?:\.[a-z0-9]+)*@[a-z0-9]+(?:\.[a-z0-9]+)+$/;

  function normalizeEmail(email) {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  function emailError(email) {
    const value = normalizeEmail(email);
    if (!value) return 'Укажите email';
    if (value.length > 254) return 'Email слишком длинный';
    if (!EMAIL_RE.test(value)) {
      return 'Email может содержать только латинские буквы, цифры, точку и символ @ (например: ivan.petrov@mail.com)';
    }
    const at = value.indexOf('@');
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    if (!local || !domain || !domain.includes('.')) return 'Укажите корректный email';
    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
      return 'Некорректная часть email до @';
    }
    if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
      return 'Некорректный домен email';
    }
    return null;
  }

  function phoneError(phone, optional) {
    const raw = String(phone || '').trim();
    if (!raw) return optional ? null : 'Укажите номер телефона';
    if (raw.length > 32) return 'Телефон слишком длинный';
    if (/[^\d+\s\-()]/.test(raw)) {
      return 'Телефон может содержать только цифры, пробелы и символы + - ( )';
    }
    let digits = raw.replace(/\D/g, '');
    if (!digits) return 'Укажите номер телефона';
    if (digits.startsWith('80') && digits.length === 11) {
      digits = '375' + digits.slice(2);
    }
    let national;
    if (digits.startsWith('375')) {
      if (digits.length !== 12) {
        return 'Номер с кодом +375 должен содержать 12 цифр (например: +375291234567)';
      }
      national = digits.slice(3);
    } else if (digits.length === 9) {
      national = digits;
    } else {
      return 'Укажите 9 цифр номера или полный номер с кодом +375';
    }
    if (!/^(29|33|44|25)\d{7}$/.test(national)) {
      return 'Некорректный белорусский мобильный номер (коды 29, 33, 44, 25)';
    }
    return null;
  }

  function normalizePhone(phone) {
    const err = phoneError(phone, true);
    if (err) return null;
    const raw = String(phone || '').trim();
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('80') && digits.length === 11) digits = '375' + digits.slice(2);
    const national = digits.startsWith('375') ? digits.slice(3) : digits;
    return '+375' + national;
  }

  const ADDRESS_INVALID = 'Адрес указан некорректно';
  const ADDRESS_HINT = 'Укажите в формате: Город, улица, дом';
  const ADDRESS_ALLOWED_RE = /[^\p{L}\p{N}\s.,\-\/]/gu;

  function sanitizeAddressInput(value) {
    return String(value || '').replace(ADDRESS_ALLOWED_RE, '');
  }

  function parseAddressParts(address) {
    return String(address || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function addressError(address, optional) {
    const raw = String(address || '').trim();
    if (!raw) return optional ? null : ADDRESS_INVALID;
    if (raw.length > 512) return ADDRESS_INVALID;
    if (/[^\p{L}\p{N}\s.,\-\/]/u.test(raw)) return ADDRESS_INVALID;

    const parts = parseAddressParts(raw);
    if (parts.length < 3) return ADDRESS_INVALID;
    const city = parts[0];
    const street = parts[1];
    const house = parts[parts.length - 1];
    if (city.length < 2 || street.length < 2) return ADDRESS_INVALID;
    if (house.length < 1 || !/\d/.test(house)) return ADDRESS_INVALID;
    return null;
  }

  function addressErrorMessage(address, optional) {
    const err = addressError(address, optional);
    if (!err) return null;
    return `${err}. ${ADDRESS_HINT}`;
  }

  function normalizeAddress(address) {
    const err = addressError(address, true);
    if (err) return null;
    const parts = parseAddressParts(address);
    if (parts.length < 3) return String(address || '').trim();
    return parts.slice(0, 3).join(', ');
  }

  function bindAddressInput(el) {
    if (!el) return;
    el.addEventListener('input', () => {
      const next = sanitizeAddressInput(el.value);
      if (next === el.value) return;
      const pos = el.selectionStart;
      el.value = next;
      if (typeof pos === 'number') {
        el.setSelectionRange(pos, pos);
      }
    });
  }

  window.BeltelecomValidate = {
    normalizeEmail,
    emailError,
    phoneError,
    normalizePhone,
    ADDRESS_INVALID,
    ADDRESS_HINT,
    sanitizeAddressInput,
    addressError,
    addressErrorMessage,
    normalizeAddress,
    bindAddressInput,
  };
})();
