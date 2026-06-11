import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const validationPath = join(root, 'public/js/core/validation.js');

function loadBeltelecomValidate() {
  const window = {};
  const code = readFileSync(validationPath, 'utf8');
  vm.runInNewContext(code, { window, console });
  return window.BeltelecomValidate;
}

const v = loadBeltelecomValidate();

test('emailError_Empty_ReturnsError', () => {
  assert.equal(v.emailError(''), 'Укажите email');
});

test('emailError_InvalidCyrillic_ReturnsError', () => {
  assert.equal(
    v.emailError('иван@mail.com'),
    'Email может содержать только латинские буквы, цифры, точку и символ @ (например: ivan.petrov@mail.com)'
  );
});

test('emailError_Valid_ReturnsNull', () => {
  assert.equal(v.emailError('ivan.petrov@mail.com'), null);
});

test('normalizeEmail_TrimsAndLowercases', () => {
  assert.equal(v.normalizeEmail('  Test@Mail.COM  '), 'test@mail.com');
});

test('phoneError_EmptyRequired_ReturnsError', () => {
  assert.equal(v.phoneError('', false), 'Укажите номер телефона');
});

test('phoneError_EmptyOptional_ReturnsNull', () => {
  assert.equal(v.phoneError('', true), null);
});

test('phoneError_InvalidOperator_ReturnsError', () => {
  assert.equal(
    v.phoneError('+375201234567', false),
    'Некорректный белорусский мобильный номер (коды 29, 33, 44, 25)'
  );
});

test('phoneError_Valid_ReturnsNull', () => {
  assert.equal(v.phoneError('29 123 45 67', false), null);
});

test('normalizePhone_FormatsToE164', () => {
  assert.equal(v.normalizePhone('80291234567'), '+375291234567');
});

test('addressError_TooFewParts_ReturnsError', () => {
  assert.equal(v.addressError('Минск, проспект', false), v.ADDRESS_INVALID);
});

test('addressError_Valid_ReturnsNull', () => {
  assert.equal(v.addressError('Минск, Независимости, 10', false), null);
});

test('addressErrorMessage_AppendsHint', () => {
  const msg = v.addressErrorMessage('Минск', false);
  assert.match(msg, /Адрес указан некорректно/);
  assert.match(msg, /Город, улица, дом/);
});

test('normalizeAddress_TrimsToThreeParts', () => {
  assert.equal(
    v.normalizeAddress('Гродно, Ожешко, 5, кв. 12'),
    'Гродно, Ожешко, 5'
  );
});

test('sanitizeAddressInput_RemovesInvalidChars', () => {
  assert.equal(v.sanitizeAddressInput('Минск#'), 'Минск');
});
