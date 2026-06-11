<?php

declare(strict_types=1);

/**
 * Юнит-тесты валидации пользовательских данных (аналог NUnit/PHPUnit).
 * Запуск: php tests/php/UserValidationTest.php
 */

require_once dirname(__DIR__, 2) . '/api/lib/validation.php';

$failures = 0;

function test(string $name, callable $fn): void
{
    global $failures;
    try {
        $fn();
        echo "OK   {$name}\n";
    } catch (Throwable $e) {
        echo "FAIL {$name}: {$e->getMessage()}\n";
        $failures++;
    }
}

function assertSame(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        $msg = $message !== '' ? $message : 'Значения не совпадают';
        throw new RuntimeException(
            $msg . ' — ожидалось ' . var_export($expected, true) . ', получено ' . var_export($actual, true)
        );
    }
}

function assertNull(mixed $actual, string $message = ''): void
{
    assertSame(null, $actual, $message);
}

// --- validate_user_email ---

test('validate_user_email_Empty_ReturnsError', function (): void {
    assertSame('Укажите email', validate_user_email(''));
});

test('validate_user_email_InvalidCyrillic_ReturnsError', function (): void {
    assertSame(
        'Email может содержать только латинские буквы, цифры, точку и символ @ (например: ivan.petrov@mail.com)',
        validate_user_email('иван@mail.com')
    );
});

test('validate_user_email_InvalidFormat_ReturnsError', function (): void {
    assertSame(
        'Email может содержать только латинские буквы, цифры, точку и символ @ (например: ivan.petrov@mail.com)',
        validate_user_email('not-an-email')
    );
});

test('validate_user_email_TooLong_ReturnsError', function (): void {
    $long = str_repeat('a', 250) . '@b.co';
    assertSame('Email слишком длинный', validate_user_email($long));
});

test('validate_user_email_Valid_ReturnsNull', function (): void {
    assertNull(validate_user_email('ivan.petrov@mail.com'));
});

test('normalize_user_email_TrimsAndLowercases', function (): void {
    assertSame('test@mail.com', normalize_user_email('  Test@Mail.COM  '));
});

// --- validate_user_phone_optional ---

test('validate_user_phone_Empty_ReturnsNull', function (): void {
    $r = validate_user_phone_optional('');
    assertNull($r['error']);
    assertNull($r['phone']);
});

test('validate_user_phone_InvalidChars_ReturnsError', function (): void {
    $r = validate_user_phone_optional('abc-def');
    assertSame(
        'Телефон может содержать только цифры, пробелы и символы + - ( )',
        $r['error']
    );
});

test('validate_user_phone_InvalidOperator_ReturnsError', function (): void {
    $r = validate_user_phone_optional('+375201234567');
    assertSame(
        'Некорректный белорусский мобильный номер (коды 29, 33, 44, 25)',
        $r['error']
    );
});

test('validate_user_phone_ValidShort_ReturnsNormalized', function (): void {
    $r = validate_user_phone_optional('29 123 45 67');
    assertNull($r['error']);
    assertSame('+375291234567', $r['phone']);
});

test('validate_user_phone_ValidFull_ReturnsNormalized', function (): void {
    $r = validate_user_phone_optional('+375 33 123 45 67');
    assertNull($r['error']);
    assertSame('+375331234567', $r['phone']);
});

test('validate_user_phone_Legacy80Prefix_ReturnsNormalized', function (): void {
    $r = validate_user_phone_optional('80291234567');
    assertNull($r['error']);
    assertSame('+375291234567', $r['phone']);
});

// --- validate_user_address ---

test('validate_user_address_format_TooFewParts_ReturnsError', function (): void {
    assertSame(USER_ADDRESS_INVALID, validate_user_address_format('Минск, проспект'));
});

test('validate_user_address_format_NoHouseNumber_ReturnsError', function (): void {
    assertSame(USER_ADDRESS_INVALID, validate_user_address_format('Минск, Независимости, дом'));
});

test('validate_user_address_format_Valid_ReturnsNull', function (): void {
    assertNull(validate_user_address_format('Минск, Независимости, 10'));
});

test('normalize_user_address_TrimsToThreeParts', function (): void {
    assertSame(
        'Гродно, Ожешко, 5',
        normalize_user_address('Гродно, Ожешко, 5, кв. 12, подъезд 2')
    );
});

test('validate_user_address_optional_Empty_ReturnsNull', function (): void {
    $r = validate_user_address_optional('');
    assertNull($r['error']);
    assertNull($r['address']);
});

test('validate_user_address_optional_Valid_ReturnsNormalized', function (): void {
    $r = validate_user_address_optional('Брест, Московская, 15');
    assertNull($r['error']);
    assertSame('Брест, Московская, 15', $r['address']);
});

echo "\n";
if ($failures > 0) {
    echo "Провалено тестов: {$failures}\n";
    exit(1);
}

echo "Все тесты пройдены.\n";
exit(0);
