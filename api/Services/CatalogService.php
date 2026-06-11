<?php

function catalog_decode_specs(array $row): array {
    if (isset($row['specs']) && is_string($row['specs'])) {
        $decoded = json_decode($row['specs'], true);
        if (is_array($decoded)) {
            $row['specs'] = $decoded;
        }
    }
    return $row;
}

function category_exists_by_slug(string $slug): bool {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT 1 FROM categories WHERE slug = :slug LIMIT 1');
    $stmt->execute(['slug' => $slug]);
    return (bool) $stmt->fetchColumn();
}

function public_catalog_filter_sql(string $alias = 'p'): string {
    $p = preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $alias) ? $alias : 'p';
    return " AND {$p}.slug NOT LIKE 'seed-asset-%'
             AND {$p}.name NOT LIKE 'Витрина:%'
             AND {$p}.name NOT IN ('Store2', 'Store3', 'Img-News-Btk-Shop')";
}

function get_products_by_category_slug(string $slug): array {
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT p.id, p.slug, p.sku, p.name, p.description, p.full_description AS fullDescription,
                p.price, p.original_price AS originalPrice, p.discount, p.image, p.color, p.brand,
                p.stock_quantity AS stockQuantity,
                p.specs_json AS specs, c.slug AS categorySlug, c.title AS categoryTitle
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE c.slug = :slug AND p.is_active = 1' . public_catalog_filter_sql('p') . '
         ORDER BY p.id DESC'
    );
    $stmt->execute(['slug' => $slug]);
    $rows = $stmt->fetchAll() ?: [];

    return array_map('catalog_decode_specs', $rows);
}

function get_categories_list(): array {
    $pdo = db();
    $stmt = $pdo->query(
        'SELECT id, slug, title, description, sort_order AS sortOrder
         FROM categories ORDER BY sort_order ASC, title ASC'
    );
    return $stmt->fetchAll() ?: [];
}

function search_products(string $q, int $limit = 40): array {
    $q = trim($q);
    if ($q === '') {
        return [];
    }
    $like = '%' . addcslashes($q, '%_\\') . '%';
    $lim = max(1, min(100, $limit));
    $filter = public_catalog_filter_sql('p');
    $pdo = db();
    $stmt = $pdo->prepare(
        "SELECT p.id, p.slug, p.sku, p.name, p.description, p.full_description AS fullDescription,
                p.price, p.original_price AS originalPrice, p.discount, p.image, p.color, p.brand,
                p.stock_quantity AS stockQuantity,
                p.specs_json AS specs, c.slug AS categorySlug, c.title AS categoryTitle
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1{$filter}
           AND (
               p.name LIKE :q_name
               OR p.description LIKE :q_description
               OR p.full_description LIKE :q_full_description
               OR p.slug LIKE :q_slug
               OR p.sku LIKE :q_sku
               OR p.brand LIKE :q_brand
               OR c.title LIKE :q_category_title
               OR c.slug LIKE :q_category_slug
           )
         ORDER BY p.id DESC
         LIMIT {$lim}"
    );
    $stmt->execute([
        'q_name' => $like,
        'q_description' => $like,
        'q_full_description' => $like,
        'q_slug' => $like,
        'q_sku' => $like,
        'q_brand' => $like,
        'q_category_title' => $like,
        'q_category_slug' => $like,
    ]);
    $rows = $stmt->fetchAll() ?: [];

    return array_map('catalog_decode_specs', $rows);
}

function search_products_starts_with(string $q, int $limit = 8): array {
    $q = trim($q);
    if ($q === '') {
        return [];
    }
    $like = addcslashes($q, '%_\\') . '%';
    $lim = max(1, min(20, $limit));
    $filter = public_catalog_filter_sql('p');
    $pdo = db();
    $stmt = $pdo->prepare(
        "SELECT p.id, p.slug, p.name, p.image, c.slug AS categorySlug, c.title AS categoryTitle
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1{$filter}
           AND p.name LIKE :q_name
         ORDER BY
           CASE WHEN LOWER(p.name) = LOWER(:q_exact) THEN 0 ELSE 1 END,
           CHAR_LENGTH(p.name) ASC,
           p.name ASC
         LIMIT {$lim}"
    );
    $stmt->execute([
        'q_name' => $like,
        'q_exact' => $q,
    ]);

    return $stmt->fetchAll() ?: [];
}

function get_product_by_id(int $id): ?array {
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT p.id, p.slug, p.sku, p.name, p.description, p.full_description AS fullDescription,
                p.price, p.original_price AS originalPrice, p.discount, p.image, p.color, p.brand,
                p.stock_quantity AS stockQuantity,
                p.specs_json AS specs, c.slug AS categorySlug, c.title AS categoryTitle
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.id = :id AND p.is_active = 1' . public_catalog_filter_sql('p')
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    if (!is_array($row)) {
        return null;
    }
    return catalog_decode_specs($row);
}

function get_recent_products(int $limit = 50): array {
    $lim = max(1, min(100, $limit));
    $filter = public_catalog_filter_sql('p');
    $pdo = db();
    $stmt = $pdo->query(
        "SELECT p.id, p.slug, p.name, p.description, p.price, p.image, c.slug AS categorySlug, c.title AS categoryTitle
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1{$filter}
         ORDER BY p.id DESC
         LIMIT {$lim}"
    );
    return $stmt->fetchAll() ?: [];
}
