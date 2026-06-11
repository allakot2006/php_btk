<?php

require_once __DIR__ . '/../lib/validation.php';

function handle_admin_users_request(string $method, string $path): bool {
    if ($method === 'GET' && $path === '/admin/users') {
        require_admin();
        $search = (string) ($_GET['search'] ?? '');
        $status = (string) ($_GET['status'] ?? '');
        $role = (string) ($_GET['role'] ?? '');
        $rows = admin_list_users($search, $status, $role);
        json_response(array_map('admin_format_user', $rows));
    }

    if ($method === 'GET' && preg_match('#^/admin/users/(\d+)$#', $path, $m)) {
        require_admin();
        $row = admin_fetch_user_row((int) $m[1]);
        if (!$row) {
            json_error('Пользователь не найден', 404);
        }
        json_response(admin_format_user($row));
    }

    if ($method === 'POST' && $path === '/admin/users') {
        require_admin();
        $body = read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        $email = normalize_user_email((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $phoneRaw = trim((string) ($body['phone'] ?? ''));
        $addressRaw = trim((string) ($body['address'] ?? ''));
        [$isAdmin, $isModerator] = admin_resolve_role_flags($body);
        $isActive = array_key_exists('isActive', $body) || array_key_exists('is_active', $body)
            ? ((!empty($body['isActive']) || !empty($body['is_active'])) ? 1 : 0)
            : 1;

        if ($name === '') json_error('Укажите имя пользователя', 400);
        $emailError = validate_user_email($email);
        if ($emailError !== null) json_error($emailError, 400);
        if (strlen($password) < 6) json_error('Пароль должен быть не короче 6 символов', 400);
        $phoneCheck = validate_user_phone_optional($phoneRaw);
        if ($phoneCheck['error'] !== null) json_error($phoneCheck['error'], 400);
        $phone = $phoneCheck['phone'];
        $addressCheck = validate_user_address_optional($addressRaw);
        if ($addressCheck['error'] !== null) json_error($addressCheck['error'], 400);
        $address = $addressCheck['address'];

        $pdo = db();
        $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $exists->execute([$email]);
        if ($exists->fetch()) json_error('Пользователь с таким email уже существует', 409);

        $stmt = $pdo->prepare(
            'INSERT INTO users (name, email, password_hash, phone, address, is_admin, is_moderator, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $name,
            $email,
            password_hash($password, PASSWORD_DEFAULT),
            $phone,
            $address,
            $isAdmin,
            $isModerator,
            $isActive,
        ]);

        $newId = (int) $pdo->lastInsertId();
        json_response(admin_format_user(admin_fetch_user_row($newId) ?: []), 201);
    }

    if (($method === 'PUT' || $method === 'PATCH') && preg_match('#^/admin/users/(\d+)$#', $path, $m)) {
        require_admin();
        $currentAdminId = require_auth_user_id();
        $userId = (int) $m[1];
        $body = read_json_body();
        $row = admin_fetch_user_row($userId);
        if (!$row) {
            json_error('Пользователь не найден', 404);
        }

        $name = array_key_exists('name', $body) ? trim((string) $body['name']) : (string) $row['name'];
        $email = array_key_exists('email', $body) ? normalize_user_email((string) $body['email']) : (string) $row['email'];
        $phoneRaw = array_key_exists('phone', $body) ? trim((string) $body['phone']) : (string) ($row['phone'] ?? '');
        $addressRaw = array_key_exists('address', $body) ? trim((string) $body['address']) : (string) ($row['address'] ?? '');
        $password = array_key_exists('password', $body) ? (string) $body['password'] : '';
        [$isAdmin, $isModerator] = admin_resolve_role_flags($body, $row);
        $isActive = array_key_exists('isActive', $body) || array_key_exists('is_active', $body)
            ? ((!empty($body['isActive']) || !empty($body['is_active'])) ? 1 : 0)
            : (int) ($row['is_active'] ?? 1);

        if ($name === '') json_error('Укажите имя пользователя', 400);
        $emailError = validate_user_email($email);
        if ($emailError !== null) json_error($emailError, 400);
        if ($password !== '' && strlen($password) < 6) json_error('Пароль должен быть не короче 6 символов', 400);
        $phoneCheck = validate_user_phone_optional($phoneRaw);
        if ($phoneCheck['error'] !== null) json_error($phoneCheck['error'], 400);
        $phone = $phoneCheck['phone'];
        $addressCheck = validate_user_address_optional($addressRaw);
        if ($addressCheck['error'] !== null) json_error($addressCheck['error'], 400);
        $address = $addressCheck['address'];
        if ($currentAdminId === $userId && $isAdmin !== 1) json_error('Нельзя снять права администратора у самого себя', 400);
        if ($currentAdminId === $userId && $isActive !== 1) json_error('Нельзя деактивировать собственную учётную запись', 400);

        $pdo = db();
        $exists = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $exists->execute([$email, $userId]);
        if ($exists->fetch()) json_error('Пользователь с таким email уже существует', 409);

        if ($password !== '') {
            $stmt = $pdo->prepare(
                'UPDATE users
                 SET name = ?, email = ?, phone = ?, address = ?, is_admin = ?, is_moderator = ?, is_active = ?, password_hash = ?
                 WHERE id = ?'
            );
            $stmt->execute([
                $name,
                $email,
                $phone,
                $address,
                $isAdmin,
                $isModerator,
                $isActive,
                password_hash($password, PASSWORD_DEFAULT),
                $userId,
            ]);
        } else {
            $stmt = $pdo->prepare(
                'UPDATE users
                 SET name = ?, email = ?, phone = ?, address = ?, is_admin = ?, is_moderator = ?, is_active = ?
                 WHERE id = ?'
            );
            $stmt->execute([
                $name,
                $email,
                $phone,
                $address,
                $isAdmin,
                $isModerator,
                $isActive,
                $userId,
            ]);
        }

        json_response(admin_format_user(admin_fetch_user_row($userId) ?: []));
    }

    if ($method === 'DELETE' && preg_match('#^/admin/users/(\d+)$#', $path, $m)) {
        require_admin();
        $currentAdminId = require_auth_user_id();
        $userId = (int) $m[1];
        if ($currentAdminId === $userId) {
            json_error('Нельзя удалить собственную учётную запись', 400);
        }

        $pdo = db();
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        if ($stmt->rowCount() === 0) {
            json_error('Пользователь не найден', 404);
        }
        json_response(['ok' => true]);
    }

    return false;
}

function admin_resolve_role_flags(array $body, ?array $row = null): array {
    $defaultAdmin = (int) ($row['is_admin'] ?? 0);
    $defaultModerator = (int) ($row['is_moderator'] ?? 0);

    if (array_key_exists('role', $body)) {
        $role = strtolower(trim((string) $body['role']));
        return match ($role) {
            'admin' => [1, 0],
            'moderator' => [0, 1],
            default => [0, 0],
        };
    }

    $hasAdminFlag = array_key_exists('isAdmin', $body) || array_key_exists('is_admin', $body);
    $hasModeratorFlag = array_key_exists('isModerator', $body) || array_key_exists('is_moderator', $body);

    if ($hasAdminFlag || $hasModeratorFlag) {
        $isAdmin = $hasAdminFlag
            ? ((!empty($body['isAdmin']) || !empty($body['is_admin'])) ? 1 : 0)
            : $defaultAdmin;
        $isModerator = $hasModeratorFlag
            ? ((!empty($body['isModerator']) || !empty($body['is_moderator'])) ? 1 : 0)
            : $defaultModerator;
        if ($isAdmin === 1) {
            $isModerator = 0;
        }
        return [$isAdmin, $isModerator];
    }

    return [$defaultAdmin, $defaultModerator];
}
