<?php

function contact_clean(?string $value, int $max = 255): ?string {
    if ($value === null) {
        return null;
    }
    $value = trim($value);
    if ($value === '') {
        return null;
    }
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max);
    }
    return substr($value, 0, $max);
}

function contact_current_user_id(): ?int {
    if (!function_exists('current_user_id')) {
        return null;
    }
    $uid = current_user_id();
    if ($uid === null || $uid === false) {
        return null;
    }
    $id = (int) $uid;
    return $id > 0 ? $id : null;
}

function create_callback_request(array $body): array {
    $name = contact_clean((string) ($body['name'] ?? ''), 128);
    $phone = contact_clean((string) ($body['phone'] ?? ''), 32);
    $topic = contact_clean((string) ($body['reason'] ?? $body['topic'] ?? ''), 128);
    if ($name === null) {
        json_error('Укажите имя', 400);
    }
    if ($phone === null) {
        json_error('Укажите телефон', 400);
    }
    if (strlen($phone) < 7) {
        json_error('Укажите корректный телефон', 400);
    }
    if ($topic === null) {
        json_error('Укажите тему звонка', 400);
    }

    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO contact_requests (type, user_id, name, phone, topic, status)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute(['callback', contact_current_user_id(), $name, $phone, $topic, 'new']);
    return ['ok' => true, 'id' => (int) $pdo->lastInsertId()];
}

function create_stock_request(array $body): array {
    $category = contact_clean((string) ($body['category'] ?? ''), 64);
    $query = contact_clean((string) ($body['query'] ?? ''), 512);
    $email = contact_clean((string) ($body['email'] ?? ''), 254);
    if ($category === null) {
        json_error('Укажите категорию', 400);
    }
    if ($query === null) {
        json_error('Укажите, какой товар нужен', 400);
    }
    if (strlen($query) < 3) {
        json_error('Опишите товар минимум в 3 символа', 400);
    }
    if (!preg_match('/^[a-z0-9_-]{2,64}$/i', (string) $category)) {
        json_error('Некорректная категория', 400);
    }
    if ($email === null || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Укажите корректный email', 400);
    }

    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO contact_requests (type, user_id, email, category_slug, query_text, status)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute(['stock', contact_current_user_id(), $email, $category, $query, 'new']);
    return ['ok' => true, 'id' => (int) $pdo->lastInsertId()];
}

function list_contact_requests(string $type = '', string $status = '', string $search = ''): array {
    $pdo = db();
    $sql = 'SELECT cr.id, cr.type, cr.user_id AS userId, cr.name, cr.phone, cr.email, cr.topic,
                   cr.category_slug AS categorySlug, cr.query_text AS queryText, cr.status, cr.created_at AS createdAt,
                   u.name AS accountName, u.email AS accountEmail
            FROM contact_requests cr
            LEFT JOIN users u ON u.id = cr.user_id
            WHERE 1=1';
    $params = [];
    if ($type !== '' && in_array($type, ['callback', 'stock'], true)) {
        $sql .= ' AND cr.type = :type';
        $params['type'] = $type;
    }
    if ($status !== '' && in_array($status, ['new', 'in_progress', 'done'], true)) {
        $sql .= ' AND cr.status = :status';
        $params['status'] = $status;
    }
    $search = trim($search);
    if ($search !== '') {
        $sql .= ' AND (cr.name LIKE :search OR cr.phone LIKE :search OR cr.email LIKE :search OR cr.topic LIKE :search OR cr.query_text LIKE :search OR u.name LIKE :search OR u.email LIKE :search)';
        $params['search'] = '%' . addcslashes($search, '%_\\') . '%';
    }
    $sql .= ' ORDER BY cr.id DESC LIMIT 500';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function update_contact_request_status(int $id, string $status): array {
    $allowed = ['new', 'in_progress', 'done'];
    if (!in_array($status, $allowed, true)) {
        json_error('Некорректный статус заявки', 400);
    }

    $pdo = db();
    $stmt = $pdo->prepare('UPDATE contact_requests SET status = :status WHERE id = :id');
    $stmt->execute(['status' => $status, 'id' => $id]);
    if ($stmt->rowCount() < 1) {
        json_error('Заявка не найдена', 404);
    }

    $fetch = $pdo->prepare(
        'SELECT cr.id, cr.type, cr.user_id AS userId, cr.name, cr.phone, cr.email, cr.topic,
                cr.category_slug AS categorySlug, cr.query_text AS queryText, cr.status, cr.created_at AS createdAt,
                u.name AS accountName, u.email AS accountEmail
         FROM contact_requests cr
         LEFT JOIN users u ON u.id = cr.user_id
         WHERE cr.id = :id
         LIMIT 1'
    );
    $fetch->execute(['id' => $id]);
    $row = $fetch->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        json_error('Заявка не найдена', 404);
    }
    return ['ok' => true, 'request' => $row];
}

