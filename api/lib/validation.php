<?php

declare(strict_types=1);

function validation_utf8_len(string $value): int {
    if (function_exists('mb_strlen')) {
        return (int) mb_strlen($value, 'UTF-8');
    }
    if (preg_match_all('/./u', $value, $matches)) {
        return count($matches[0]);
    }

    return strlen($value);
}

/**
 * Email: латиница, цифры, точка; обязательны @ и домен с точкой.
 */
function validate_user_email(string $email): ?string {
    $email = strtolower(trim($email));
    if ($email === '') {
        return 'Укажите email';
    }
    if (strlen($email) > 254) {
        return 'Email слишком длинный';
    }
    if (!preg_match('/^[a-z0-9]+(?:\.[a-z0-9]+)*@[a-z0-9]+(?:\.[a-z0-9]+)+$/', $email)) {
        return 'Email может содержать только латинские буквы, цифры, точку и символ @ (например: ivan.petrov@mail.com)';
    }
    [$local, $domain] = explode('@', $email, 2);
    if ($local === '' || $domain === '' || !str_contains($domain, '.')) {
        return 'Укажите корректный email';
    }
    if (str_starts_with($local, '.') || str_ends_with($local, '.') || str_contains($local, '..')) {
        return 'Некорректная часть email до @';
    }
    if (str_starts_with($domain, '.') || str_ends_with($domain, '.') || str_contains($domain, '..')) {
        return 'Некорректный домен email';
    }

    return null;
}

function normalize_user_email(string $email): string {
    return strtolower(trim($email));
}

/**
 * Телефон (необязательный): только цифры и + - ( ) пробелы; BY: 9 цифр или +375 и 9 цифр.
 *
 * @return array{error: ?string, phone: ?string}
 */
function validate_user_phone_optional(string $phone): array {
    $phone = trim($phone);
    if ($phone === '') {
        return ['error' => null, 'phone' => null];
    }
    if (strlen($phone) > 32) {
        return ['error' => 'Телефон слишком длинный', 'phone' => null];
    }
    if (preg_match('/[^\d+\s\-()]/u', $phone)) {
        return [
            'error' => 'Телефон может содержать только цифры, пробелы и символы + - ( )',
            'phone' => null,
        ];
    }

    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if ($digits === '') {
        return ['error' => 'Укажите номер телефона', 'phone' => null];
    }

    if (str_starts_with($digits, '80') && strlen($digits) === 11) {
        $digits = '375' . substr($digits, 2);
    }
    if (str_starts_with($digits, '375')) {
        if (strlen($digits) !== 12) {
            return [
                'error' => 'Номер с кодом +375 должен содержать 12 цифр (например: +375291234567)',
                'phone' => null,
            ];
        }
        $national = substr($digits, 3);
    } elseif (strlen($digits) === 9) {
        $national = $digits;
    } else {
        return [
            'error' => 'Укажите 9 цифр номера или полный номер с кодом +375',
            'phone' => null,
        ];
    }

    if (!preg_match('/^(29|33|44|25)\d{7}$/', $national)) {
        return [
            'error' => 'Некорректный белорусский мобильный номер (коды 29, 33, 44, 25)',
            'phone' => null,
        ];
    }

    return ['error' => null, 'phone' => '+375' . $national];
}

const USER_ADDRESS_INVALID = 'Адрес указан некорректно';

/**
 * @return array{error: ?string, address: ?string}
 */
function validate_user_address_optional(string $address): array {
    $address = trim($address);
    if ($address === '') {
        return ['error' => null, 'address' => null];
    }
    $error = validate_user_address_format($address);
    if ($error !== null) {
        return ['error' => $error, 'address' => null];
    }

    return ['error' => null, 'address' => normalize_user_address($address)];
}

function validate_user_address_format(string $address): ?string {
    $address = trim($address);
    if ($address === '') {
        return USER_ADDRESS_INVALID;
    }
    if (strlen($address) > 512) {
        return USER_ADDRESS_INVALID;
    }
    if (!preg_match('/^[\p{L}\p{N}\s.,\-\/]+$/u', $address)) {
        return USER_ADDRESS_INVALID;
    }

    $parts = array_values(array_filter(array_map('trim', explode(',', $address)), static fn(string $p): bool => $p !== ''));
    if (count($parts) < 3) {
        return USER_ADDRESS_INVALID;
    }

    $city = $parts[0];
    $street = $parts[1];
    $house = $parts[count($parts) - 1];

    if (validation_utf8_len($city) < 2 || validation_utf8_len($street) < 2) {
        return USER_ADDRESS_INVALID;
    }
    if (validation_utf8_len($house) < 1 || !preg_match('/\d/u', $house)) {
        return USER_ADDRESS_INVALID;
    }

    return null;
}

function normalize_user_address(string $address): string {
    $parts = array_values(array_filter(array_map('trim', explode(',', $address)), static fn(string $p): bool => $p !== ''));
    if (count($parts) < 3) {
        return trim($address);
    }

    return implode(', ', array_slice($parts, 0, 3));
}
