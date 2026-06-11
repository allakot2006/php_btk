<?php

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/validation.php';

class TestUsersJsonSeeder {
    private static function envTruthy(string $key, string $default = '0'): bool {
        $v = strtolower(trim((string) env_get($key, $default)));
        return in_array($v, ['1', 'true', 'yes', 'on'], true);
    }

    public static function isEnabled(): bool {
        return self::envTruthy('SEED_TEST_DATA', '0');
    }

    public static function isForce(): bool {
        return self::envTruthy('SEED_TEST_DATA_FORCE', '0');
    }

    private static function seedFilePath(): string {
        return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'seed-users.json';
    }

    private static function alreadySeeded(PDO $pdo): bool {
        $stmt = $pdo->query(
            "SELECT meta_value FROM app_meta WHERE meta_key = 'test_users_json_seeded' LIMIT 1"
        );
        $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        return $row && ($row['meta_value'] ?? '') === '1';
    }

    private static function markSeeded(PDO $pdo): void {
        $sql = 'INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)';
        $pdo->prepare($sql)->execute(['test_users_json_seeded', '1']);
    }

    private static function emptyStats(bool $skipped = false): array {
        return [
            'skipped' => $skipped,
            'usersTotal' => 0,
            'usersUpserted' => 0,
        ];
    }

    /** @return list<string> */
    private static function legacyTestEmails(): array {
        return [
            'admin@beltelecom-shop.test',
            'moderator@beltelecom-shop.test',
        ];
    }

    private static function removeLegacyTestUsers(PDO $pdo): void {
        $stmt = $pdo->prepare('DELETE FROM users WHERE email = ?');
        foreach (self::legacyTestEmails() as $legacyEmail) {
            $stmt->execute([$legacyEmail]);
        }
    }

    private static function upsertUser(PDO $pdo, array $u): void {
        $email = isset($u['email']) ? normalize_user_email((string) $u['email']) : '';
        $emailError = validate_user_email($email);
        if ($emailError !== null) {
            throw new RuntimeException('Email в seed-users.json: ' . $emailError);
        }
        $name = isset($u['name']) ? trim((string) $u['name']) : 'Пользователь';
        if ($name === '') {
            $name = 'Пользователь';
        }
        $plain = isset($u['password']) ? (string) $u['password'] : '';
        if ($plain === '') {
            throw new RuntimeException('Для пользователя ' . $email . ' не указан пароль.');
        }
        $hash = password_hash($plain, PASSWORD_DEFAULT);
        $phoneRaw = isset($u['phone']) && $u['phone'] !== null && $u['phone'] !== ''
            ? trim((string) $u['phone']) : '';
        $phoneCheck = validate_user_phone_optional($phoneRaw);
        if ($phoneCheck['error'] !== null) {
            throw new RuntimeException('Телефон в seed-users.json (' . $email . '): ' . $phoneCheck['error']);
        }
        $phone = $phoneCheck['phone'];
        $addressRaw = array_key_exists('address', $u) && $u['address'] !== null && $u['address'] !== ''
            ? trim((string) $u['address']) : '';
        $addressCheck = validate_user_address_optional($addressRaw);
        if ($addressCheck['error'] !== null) {
            throw new RuntimeException('Адрес в seed-users.json (' . $email . '): ' . $addressCheck['error']);
        }
        $address = $addressCheck['address'];
        $isAdmin = 0;
        if (array_key_exists('isAdmin', $u)) {
            $isAdmin = ((bool) $u['isAdmin']) ? 1 : 0;
        } elseif (array_key_exists('is_admin', $u)) {
            $isAdmin = ((bool) $u['is_admin']) ? 1 : 0;
        }
        $isModerator = 0;
        if ($isAdmin !== 1) {
            if (array_key_exists('isModerator', $u)) {
                $isModerator = ((bool) $u['isModerator']) ? 1 : 0;
            } elseif (array_key_exists('is_moderator', $u)) {
                $isModerator = ((bool) $u['is_moderator']) ? 1 : 0;
            }
        }
        $isActive = 1;
        if (array_key_exists('isActive', $u)) {
            $isActive = ((bool) $u['isActive']) ? 1 : 0;
        } elseif (array_key_exists('is_active', $u)) {
            $isActive = ((bool) $u['is_active']) ? 1 : 0;
        }

        $sql = 'INSERT INTO users (name, email, password_hash, phone, address, is_admin, is_moderator, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    password_hash = VALUES(password_hash),
                    phone = VALUES(phone),
                    address = VALUES(address),
                    is_admin = VALUES(is_admin),
                    is_moderator = VALUES(is_moderator),
                    is_active = VALUES(is_active)';
        $pdo->prepare($sql)->execute([
            $name,
            $email,
            $hash,
            $phone,
            $address,
            $isAdmin,
            $isModerator,
            $isActive,
        ]);
    }

    public static function runIfNeeded(PDO $pdo): array {
        if (!self::isEnabled()) {
            return self::emptyStats(true);
        }
        self::removeLegacyTestUsers($pdo);

        $path = self::seedFilePath();
        if (!is_readable($path)) {
            throw new RuntimeException('Не найден файл тестовых пользователей: ' . $path);
        }
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('Не удалось прочитать файл тестовых пользователей.');
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new RuntimeException('Невалидный JSON в database/seed-users.json');
        }
        $list = $data['users'] ?? null;
        if (!is_array($list) || $list === []) {
            throw new RuntimeException('В database/seed-users.json отсутствует непустой массив users.');
        }

        $stats = self::emptyStats(false);
        $stats['usersTotal'] = count($list);
        $pdo->beginTransaction();
        try {
            foreach ($list as $item) {
                if (!is_array($item)) {
                    throw new RuntimeException('Один из элементов users имеет неверный формат.');
                }
                self::upsertUser($pdo, $item);
                $stats['usersUpserted']++;
            }
            self::markSeeded($pdo);
            $pdo->commit();
            return $stats;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
