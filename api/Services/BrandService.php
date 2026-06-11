<?php

function brand_normalize_title(string $title): string {
    return trim(preg_replace('/\s+/u', ' ', $title) ?? $title);
}

function brand_slugify(string $title): string {
    $title = strtolower(brand_normalize_title($title));
    $slug = preg_replace('/[^a-z0-9]+/i', '-', $title);
    $slug = is_string($slug) ? trim($slug, '-') : '';
    if ($slug !== '') {
        return substr($slug, 0, 64);
    }
    return 'brand-' . substr(md5($title), 0, 8);
}

function brand_generate_unique_slug(PDO $pdo, string $title, ?int $ignoreId = null): string {
    $base = brand_slugify($title);
    $slug = $base;
    $suffix = 1;
    while (true) {
        $sql = 'SELECT id FROM brands WHERE slug = ?';
        $params = [$slug];
        if ($ignoreId !== null) {
            $sql .= ' AND id != ?';
            $params[] = $ignoreId;
        }
        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        if (!$stmt->fetchColumn()) {
            return $slug;
        }
        $suffix++;
        $slug = substr($base, 0, max(1, 64 - strlen((string) $suffix) - 1)) . '-' . $suffix;
    }
}

function brand_categories_map(array $brandIds): array {
    if (!$brandIds) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($brandIds), '?'));
    $pdo = db();
    $stmt = $pdo->prepare(
        "SELECT bc.brand_id, c.id, c.slug, c.title
         FROM brand_categories bc
         JOIN categories c ON c.id = bc.category_id
         WHERE bc.brand_id IN ({$placeholders})
         ORDER BY c.sort_order ASC, c.title ASC"
    );
    $stmt->execute($brandIds);
    $map = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $brandId = (int) $row['brand_id'];
        if (!isset($map[$brandId])) {
            $map[$brandId] = [];
        }
        $map[$brandId][] = [
            'id' => (int) $row['id'],
            'slug' => $row['slug'],
            'title' => $row['title'],
        ];
    }
    return $map;
}

function brand_format_admin(array $row, array $categories = []): array {
    return [
        'id' => (int) $row['id'],
        'slug' => $row['slug'],
        'title' => $row['title'],
        'isActive' => (int) ($row['is_active'] ?? 1) === 1,
        'usageCount' => isset($row['usage_count']) ? (int) $row['usage_count'] : 0,
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
        'categories' => $categories,
        'categoryIds' => array_map(static fn(array $item): int => (int) $item['id'], $categories),
    ];
}

function brand_validate_category_ids(array $rawCategoryIds): array {
    $categoryIds = [];
    foreach ($rawCategoryIds as $value) {
        $id = (int) $value;
        if ($id > 0) {
            $categoryIds[$id] = $id;
        }
    }
    $categoryIds = array_values($categoryIds);
    if (!$categoryIds) {
        json_error('Выберите хотя бы одну категорию для бренда', 400);
    }

    $pdo = db();
    $placeholders = implode(',', array_fill(0, count($categoryIds), '?'));
    $stmt = $pdo->prepare("SELECT id FROM categories WHERE id IN ({$placeholders})");
    $stmt->execute($categoryIds);
    $existing = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []);
    sort($existing);
    $expected = $categoryIds;
    sort($expected);
    if ($existing !== $expected) {
        json_error('Одна или несколько выбранных категорий не найдены', 400);
    }

    return $categoryIds;
}

function brand_save_category_links(PDO $pdo, int $brandId, array $categoryIds): void {
    $pdo->prepare('DELETE FROM brand_categories WHERE brand_id = ?')->execute([$brandId]);
    $insert = $pdo->prepare('INSERT INTO brand_categories (brand_id, category_id) VALUES (?, ?)');
    foreach ($categoryIds as $categoryId) {
        $insert->execute([$brandId, $categoryId]);
    }
}

function admin_fetch_brand_row(int $id): ?array {
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT b.*,
                (SELECT COUNT(*) FROM products p WHERE p.brand = b.title) AS usage_count
         FROM brands b
         WHERE b.id = ?
         LIMIT 1'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }
    $categories = brand_categories_map([$id]);
    return brand_format_admin($row, $categories[$id] ?? []);
}

function admin_list_brands(string $search = '', string $categoryFilter = '', string $status = ''): array {
    $pdo = db();
    $sql = 'SELECT b.*,
                   (SELECT COUNT(*) FROM products p WHERE p.brand = b.title) AS usage_count
            FROM brands b
            WHERE 1=1';
    $params = [];
    $search = trim($search);
    if ($search !== '') {
        $sql .= ' AND (b.title LIKE :search OR b.slug LIKE :search)';
        $params['search'] = '%' . addcslashes($search, '%_\\') . '%';
    }
    if ($status === 'active') {
        $sql .= ' AND b.is_active = 1';
    } elseif ($status === 'inactive') {
        $sql .= ' AND b.is_active = 0';
    }
    $categoryFilter = trim($categoryFilter);
    if ($categoryFilter !== '') {
        if (ctype_digit($categoryFilter)) {
            $sql .= ' AND EXISTS (
                SELECT 1 FROM brand_categories bc
                WHERE bc.brand_id = b.id AND bc.category_id = :categoryId
            )';
            $params['categoryId'] = (int) $categoryFilter;
        } else {
            $sql .= ' AND EXISTS (
                SELECT 1 FROM brand_categories bc
                JOIN categories c ON c.id = bc.category_id
                WHERE bc.brand_id = b.id AND c.slug = :categorySlug
            )';
            $params['categorySlug'] = $categoryFilter;
        }
    }
    $sql .= ' ORDER BY b.title ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $ids = array_map(static fn(array $row): int => (int) $row['id'], $rows);
    $categoriesMap = brand_categories_map($ids);

    return array_map(
        static fn(array $row): array => brand_format_admin($row, $categoriesMap[(int) $row['id']] ?? []),
        $rows
    );
}

function public_list_brands(string $categorySlug = ''): array {
    $pdo = db();
    if ($categorySlug !== '') {
        $stmt = $pdo->prepare(
            'SELECT DISTINCT b.id, b.slug, b.title
             FROM brands b
             JOIN brand_categories bc ON bc.brand_id = b.id
             JOIN categories c ON c.id = bc.category_id
             WHERE b.is_active = 1 AND c.slug = :slug
             ORDER BY b.title ASC'
        );
        $stmt->execute(['slug' => $categorySlug]);
    } else {
        $stmt = $pdo->query(
            'SELECT b.id, b.slug, b.title
             FROM brands b
             WHERE b.is_active = 1
             ORDER BY b.title ASC'
        );
    }

    return array_map(
        static fn(array $row): array => [
            'id' => (int) $row['id'],
            'slug' => $row['slug'],
            'title' => $row['title'],
        ],
        $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
    );
}
