<?php

function current_user_id(): ?int {
    $id = $_SESSION['user_id'] ?? null;
    return is_int($id) || ctype_digit((string)$id) ? (int)$id : null;
}

function require_auth_user_id(): int {
    $id = current_user_id();
    if (!$id) json_error('Требуется авторизация', 401);
    return $id;
}

function get_auth_user_by_id(int $id): ?array {
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT id, name, email, phone, address, created_at, is_admin, is_moderator FROM users
         WHERE id = :id AND COALESCE(is_active, 1) = 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }
    $isAdmin = (int) ($row['is_admin'] ?? 0) === 1;
    $isModerator = !$isAdmin && (int) ($row['is_moderator'] ?? 0) === 1;
    return [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'address' => $row['address'],
        'created_at' => $row['created_at'],
        'isAdmin' => $isAdmin,
        'isModerator' => $isModerator,
        'role' => $isAdmin ? 'admin' : ($isModerator ? 'moderator' : 'user'),
    ];
}

function require_admin(): void {
    $uid = require_auth_user_id();
    $user = get_auth_user_by_id($uid);
    if (!$user || empty($user['isAdmin'])) {
        json_error('Недостаточно прав администратора', 403);
    }
}

function require_catalog_manager(): void {
    $uid = require_auth_user_id();
    $user = get_auth_user_by_id($uid);
    if (!$user || (empty($user['isAdmin']) && empty($user['isModerator']))) {
        json_error('Недостаточно прав для управления каталогом', 403);
    }
}
