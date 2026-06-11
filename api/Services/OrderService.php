<?php

require_once __DIR__ . '/../lib/validation.php';

function get_orders_for_user(int $userId): array {
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT id, order_number AS orderNumber, customer_name, phone, email, address, comment,
                total, currency, status, created_at
         FROM orders WHERE user_id = :uid ORDER BY id DESC LIMIT 100'
    );
    $stmt->execute(['uid' => $userId]);
    $orders = $stmt->fetchAll() ?: [];
    $itemStmt = $pdo->prepare(
        'SELECT product_id AS productId, slug_snapshot AS slug, image_snapshot AS image,
                name_snapshot AS name, price_snapshot AS price, qty
         FROM order_items WHERE order_id = :oid'
    );
    foreach ($orders as &$o) {
        $itemStmt->execute(['oid' => $o['id']]);
        $o['items'] = $itemStmt->fetchAll() ?: [];
    }
    unset($o);
    return $orders;
}

function get_orders_for_staff(int $limit = 300): array {
    $lim = max(1, min(1000, $limit));
    $pdo = db();
    $stmt = $pdo->query(
        "SELECT o.id, o.order_number AS orderNumber, o.user_id AS userId, o.customer_name AS customerName,
                o.phone, o.email, o.address, o.comment, o.total, o.currency, o.status, o.created_at AS createdAt,
                u.name AS accountName, u.email AS accountEmail
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.id DESC
         LIMIT {$lim}"
    );
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (!$orders) {
        return [];
    }

    $itemStmt = $pdo->prepare(
        'SELECT order_id AS orderId, product_id AS productId, slug_snapshot AS slug, image_snapshot AS image,
                name_snapshot AS name, price_snapshot AS price, qty
         FROM order_items
         WHERE order_id = :oid'
    );
    foreach ($orders as &$order) {
        $itemStmt->execute(['oid' => $order['id']]);
        $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
    unset($order);
    return $orders;
}

function update_order_status_for_staff(int $orderId, string $newStatus): array {
    $allowed = ['new', 'in_progress', 'done', 'cancelled'];
    if (!in_array($newStatus, $allowed, true)) {
        json_error('Некорректный статус заказа', 400);
    }

    $pdo = db();
    $st = $pdo->prepare('SELECT id, status FROM orders WHERE id = :id LIMIT 1');
    $st->execute(['id' => $orderId]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        json_error('Заказ не найден', 404);
    }
    $oldStatus = (string) ($row['status'] ?? 'new');
    if ($oldStatus === $newStatus) {
        return ['ok' => true, 'orderId' => $orderId, 'status' => $newStatus];
    }

    $upd = $pdo->prepare('UPDATE orders SET status = :status WHERE id = :id');
    $upd->execute(['status' => $newStatus, 'id' => $orderId]);

    try {
        $pdo->prepare(
            'INSERT INTO order_status_log (order_id, old_status, new_status, note)
             VALUES (:oid, :old_status, :new_status, :note)'
        )->execute([
            'oid' => $orderId,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'note' => 'Статус обновлён из панели управления',
        ]);
    } catch (Throwable $e) {
    }

    return ['ok' => true, 'orderId' => $orderId, 'status' => $newStatus];
}

function place_order(array $body, int $authUserId, array $authUser): array {
    $customer = $body['customer'] ?? null;
    $items = $body['items'] ?? null;

    if (!is_array($customer)) json_error('customer обязателен', 400);
    if (!is_array($items) || count($items) < 1) json_error('items обязателен', 400);

    $name = trim((string)($customer['name'] ?? $authUser['name'] ?? ''));
    $phone = trim((string)($customer['phone'] ?? $authUser['phone'] ?? ''));
    $email = trim((string)($customer['email'] ?? $authUser['email'] ?? ''));
    $address = trim((string)($customer['address'] ?? $authUser['address'] ?? ''));
    $comment = trim((string)($body['comment'] ?? ''));

    if ($name === '') json_error('Укажите имя', 400);
    if (strlen($name) < 2) json_error('Имя должно быть не короче 2 символов', 400);

    $phoneCheck = validate_user_phone_optional($phone);
    if ($phoneCheck['error'] !== null) {
        json_error($phoneCheck['error'], 400);
    }
    $phone = $phoneCheck['phone'] ?? '';
    if ($phone === '') {
        json_error('Укажите телефон', 400);
    }

    if ($email !== '') {
        $email = normalize_user_email($email);
        $emailError = validate_user_email($email);
        if ($emailError !== null) {
            json_error($emailError, 400);
        }
    }
    if ($address === '') {
        json_error('Укажите адрес доставки', 400);
    }
    $addressError = validate_user_address_format($address);
    if ($addressError !== null) {
        json_error($addressError, 400);
    }
    $address = normalize_user_address($address);

    $cleanItems = [];
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $qty = (int)($it['qty'] ?? 0);
        $productId = $it['productId'] ?? null;
        $productId = is_numeric($productId) ? (int)$productId : null;

        if ($qty <= 0 || $qty > 999) json_error('Некорректное количество', 400);
        if (!$productId) json_error('Некорректный товар в корзине', 400);

        $slugSnap = trim((string) ($it['slug'] ?? ''));
        $imgSnap = trim((string) ($it['image'] ?? ''));
        $cleanItems[] = [
            'product_id' => $productId,
            'name' => trim((string)($it['name'] ?? '')),
            'price' => 0.0,
            'qty' => $qty,
            'slug' => $slugSnap !== '' ? $slugSnap : null,
            'image' => $imgSnap !== '' ? $imgSnap : null,
        ];
    }
    if (count($cleanItems) < 1) json_error('items обязателен', 400);

    $pdo = db();
    $ordNum = null;
    $orderId = null;
    try {
        $pdo->beginTransaction();

        $total = 0.0;
        foreach ($cleanItems as $idx => $it) {
            $st = $pdo->prepare(
                'SELECT stock_quantity, name, price, slug, image FROM products WHERE id = ? AND is_active = 1 FOR UPDATE'
            );
            $st->execute([$it['product_id']]);
            $pr = $st->fetch(PDO::FETCH_ASSOC);
            if (!$pr) {
                $pdo->rollBack();
                json_error('Товар недоступен: ' . $it['name'], 400);
            }
            $sq = $pr['stock_quantity'];
            if ($sq !== null && (int) $sq < $it['qty']) {
                $pdo->rollBack();
                json_error('Недостаточно на складе: ' . $pr['name'] . ' (запрошено ' . $it['qty'] . ')', 400);
            }
            $actualPrice = round((float) $pr['price'], 2);
            if ($actualPrice < 0) {
                $pdo->rollBack();
                json_error('Некорректная цена товара: ' . $pr['name'], 400);
            }
            $cleanItems[$idx]['name'] = (string) $pr['name'];
            $cleanItems[$idx]['price'] = $actualPrice;
            $cleanItems[$idx]['slug'] = $it['slug'] ?: ($pr['slug'] ?? null);
            $cleanItems[$idx]['image'] = $it['image'] ?: ($pr['image'] ?? null);
            $total += round($actualPrice * $it['qty'], 2);
        }
        $total = round($total, 2);

        $stmt = $pdo->prepare(
            'INSERT INTO orders (user_id, customer_name, phone, email, address, comment, total, currency, status)
             VALUES (:user_id, :customer_name, :phone, :email, :address, :comment, :total, :currency, :status)'
        );
        $stmt->execute([
            'user_id' => $authUserId,
            'customer_name' => $name,
            'phone' => $phone,
            'email' => ($email !== '' ? $email : null),
            'address' => ($address !== '' ? $address : null),
            'comment' => ($comment !== '' ? $comment : null),
            'total' => $total,
            'currency' => 'BYN',
            'status' => 'new',
        ]);

        $orderId = (int) $pdo->lastInsertId();
        $ordNum = 'BTK-' . gmdate('Ymd') . '-' . str_pad((string) $orderId, 5, '0', STR_PAD_LEFT);
        $pdo->prepare('UPDATE orders SET order_number = ? WHERE id = ?')->execute([$ordNum, $orderId]);

        $stmtItem = $pdo->prepare(
            'INSERT INTO order_items (order_id, product_id, slug_snapshot, image_snapshot, name_snapshot, price_snapshot, qty)
             VALUES (:order_id, :product_id, :slug_snapshot, :image_snapshot, :name_snapshot, :price_snapshot, :qty)'
        );

        foreach ($cleanItems as $it) {
            $stmtItem->execute([
                'order_id' => $orderId,
                'product_id' => $it['product_id'],
                'slug_snapshot' => $it['slug'],
                'image_snapshot' => $it['image'],
                'name_snapshot' => $it['name'],
                'price_snapshot' => $it['price'],
                'qty' => $it['qty'],
            ]);
        }

        foreach ($cleanItems as $it) {
            $pdo->prepare(
                'UPDATE products SET stock_quantity = stock_quantity - :q
                 WHERE id = :id AND stock_quantity IS NOT NULL'
            )->execute(['q' => $it['qty'], 'id' => $it['product_id']]);
        }

        try {
            $pdo->prepare(
                'INSERT INTO order_status_log (order_id, old_status, new_status, note)
                 VALUES (?, NULL, ?, ?)'
            )->execute([$orderId, 'new', 'Заказ создан из корзины']);
        } catch (Throwable $e) {
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_error('Не удалось создать заказ', 500, ['details' => $e->getMessage()]);
    }

    return [
        'ok' => true,
        'orderId' => $orderId,
        'orderNumber' => $ordNum,
        'status' => 'new',
    ];
}
