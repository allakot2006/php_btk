<?php

function admin_format_product(array $row): array {
    $specsRaw = $row['specs_json'] ?? null;
    $specs = null;
    if (is_string($specsRaw)) {
        $decoded = json_decode($specsRaw, true);
        $specs = is_array($decoded) ? $decoded : null;
    } elseif (is_array($specsRaw)) {
        $specs = $specsRaw;
    }

    return [
        'id' => (int) $row['id'],
        'categoryId' => (int) $row['category_id'],
        'categorySlug' => $row['category_slug'] ?? null,
        'slug' => $row['slug'],
        'name' => $row['name'],
        'description' => $row['description'],
        'fullDescription' => $row['full_description'] ?? null,
        'price' => (float) $row['price'],
        'originalPrice' => isset($row['original_price']) && $row['original_price'] !== null
            ? (float) $row['original_price'] : null,
        'discount' => isset($row['discount']) && $row['discount'] !== null ? (int) $row['discount'] : null,
        'image' => $row['image'],
        'color' => $row['color'],
        'brand' => $row['brand'],
        'sku' => $row['sku'] ?? null,
        'stockQuantity' => array_key_exists('stock_quantity', $row)
            ? ($row['stock_quantity'] !== null ? (int) $row['stock_quantity'] : null)
            : (array_key_exists('stockQuantity', $row)
                ? ($row['stockQuantity'] !== null ? (int) $row['stockQuantity'] : null) : null),
        'specs' => $specs,
        'isActive' => (int) ($row['is_active'] ?? 1) === 1,
    ];
}

function admin_read_specs_from_body(array $body): ?array {
    if (!array_key_exists('specs', $body)) {
        return null;
    }
    $specs = $body['specs'];
    if ($specs === null) {
        return null;
    }
    if (!is_array($specs)) {
        json_error('Поле specs должно быть объектом', 400);
    }
    return $specs;
}

function admin_fetch_product_row(int $id): ?array {
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT p.id, p.category_id, p.slug, p.sku, p.stock_quantity, p.name, p.description, p.full_description,
                p.price, p.original_price, p.discount, p.image, p.color, p.brand, p.specs_json, p.is_active,
                c.slug AS category_slug
         FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}
