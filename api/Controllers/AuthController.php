<?php

require_once __DIR__ . '/../lib/validation.php';

function handle_auth_request(string $method, string $path): bool {
    if ($method === 'POST' && $path === '/auth/register') {
        $body = read_json_body();
        $name = trim((string)($body['name'] ?? ''));
        $email = normalize_user_email((string)($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $phoneRaw = trim((string)($body['phone'] ?? ''));
        $addressRaw = trim((string)($body['address'] ?? ''));

        if ($name === '') json_error('Укажите имя', 400);
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
        $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email');
        $exists->execute(['email' => $email]);
        if ($exists->fetch()) json_error('Пользователь с таким email уже существует', 409);

        $stmt = $pdo->prepare(
            'INSERT INTO users (name, email, password_hash, phone, address)
             VALUES (:name, :email, :password_hash, :phone, :address)'
        );
        $stmt->execute([
            'name' => $name,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'phone' => $phone,
            'address' => $address,
        ]);

        $userId = (int)$pdo->lastInsertId();
        $_SESSION['user_id'] = $userId;
        $user = get_auth_user_by_id($userId);
        json_response(['ok' => true, 'user' => $user], 201);
    }

    if ($method === 'POST' && $path === '/auth/login') {
        $body = read_json_body();
        $email = normalize_user_email((string)($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');

        if ($password === '') json_error('Введите пароль', 400);
        $emailError = validate_user_email($email);
        if ($emailError !== null) json_error($emailError, 400);

        $pdo = db();
        $stmt = $pdo->prepare('SELECT id, password_hash, is_active FROM users WHERE email = :email');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || !password_verify($password, (string)$row['password_hash'])) {
            json_error('Неверный email или пароль', 401);
        }
        if (isset($row['is_active']) && (int) $row['is_active'] !== 1) {
            json_error('Аккаунт отключён. Обратитесь в поддержку.', 403);
        }

        $userId = (int)$row['id'];
        $_SESSION['user_id'] = $userId;
        $user = get_auth_user_by_id($userId);
        json_response(['ok' => true, 'user' => $user]);
    }

    if ($method === 'POST' && $path === '/auth/logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool)$params['secure'], (bool)$params['httponly']);
        }
        session_destroy();
        json_response(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/auth/me') {
        $id = current_user_id();
        if (!$id) json_response(['ok' => true, 'user' => null]);
        $user = get_auth_user_by_id($id);
        if (!$user) {
            $_SESSION = [];
            json_response(['ok' => true, 'user' => null]);
        }
        json_response(['ok' => true, 'user' => $user]);
    }

    if (($method === 'PATCH' || $method === 'PUT') && $path === '/auth/me') {
        $uid = require_auth_user_id();
        $body = read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));
        $address = trim((string) ($body['address'] ?? ''));

        if ($name === '') {
            json_error('Укажите имя', 400);
        }
        if (strlen($name) < 2) {
            json_error('Имя должно быть не короче 2 символов', 400);
        }
        $phoneCheck = validate_user_phone_optional($phone);
        if ($phoneCheck['error'] !== null) {
            json_error($phoneCheck['error'], 400);
        }
        $phone = $phoneCheck['phone'];
        $addressCheck = validate_user_address_optional($address);
        if ($addressCheck['error'] !== null) {
            json_error($addressCheck['error'], 400);
        }
        $address = $addressCheck['address'];

        $pdo = db();
        $stmt = $pdo->prepare('UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?');
        $stmt->execute([
            $name,
            $phone,
            $address,
            $uid,
        ]);

        $user = get_auth_user_by_id($uid);
        json_response(['ok' => true, 'user' => $user]);
    }

    return false;
}
