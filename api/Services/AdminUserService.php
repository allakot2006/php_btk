<?php

function admin_format_user(array $row): array {
    $isAdmin = (int) ($row['is_admin'] ?? 0) === 1;
    $isModerator = !$isAdmin && (int) ($row['is_moderator'] ?? 0) === 1;
    return [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'address' => $row['address'],
        'isAdmin' => $isAdmin,
        'isModerator' => $isModerator,
        'role' => $isAdmin ? 'admin' : ($isModerator ? 'moderator' : 'user'),
        'isActive' => (int) ($row['is_active'] ?? 1) === 1,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'ordersCount' => isset($row['orders_count']) ? (int) $row['orders_count'] : 0,
        'lastOrderAt' => $row['last_order_at'] ?? null,
    ];
}

function admin_fetch_user_row(int $id): ?array {
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT u.*,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
                (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
         FROM users u
         WHERE u.id = ?'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

function admin_list_users(?string $search = null, ?string $status = null, ?string $role = null): array {
    $pdo = db();
    $sql = 'SELECT u.*,
                   (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
                   (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
            FROM users u
            WHERE 1=1';
    $params = [];

    $search = trim((string) $search);
    if ($search !== '') {
        $sql .= ' AND (u.name LIKE :q OR u.email LIKE :q OR u.phone LIKE :q)';
        $params['q'] = '%' . addcslashes($search, '%_\\') . '%';
    }

    if ($status === 'active') {
        $sql .= ' AND COALESCE(u.is_active, 1) = 1';
    } elseif ($status === 'inactive') {
        $sql .= ' AND COALESCE(u.is_active, 1) = 0';
    }

    if ($role === 'admin') {
        $sql .= ' AND COALESCE(u.is_admin, 0) = 1';
    } elseif ($role === 'moderator') {
        $sql .= ' AND COALESCE(u.is_admin, 0) = 0 AND COALESCE(u.is_moderator, 0) = 1';
    } elseif ($role === 'user') {
        $sql .= ' AND COALESCE(u.is_admin, 0) = 0 AND COALESCE(u.is_moderator, 0) = 0';
    }

    $sql .= ' ORDER BY u.id DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}
