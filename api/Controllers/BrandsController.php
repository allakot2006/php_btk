<?php

function handle_brands_request(string $method, string $path): bool {
    if ($method === 'GET' && $path === '/brands') {
        $categorySlug = trim((string) ($_GET['category'] ?? ''));
        json_response(public_list_brands($categorySlug));
    }

    if ($method === 'GET' && $path === '/admin/brands') {
        require_catalog_manager();
        $search = trim((string) ($_GET['search'] ?? ''));
        $category = trim((string) ($_GET['category'] ?? $_GET['categoryId'] ?? ''));
        $status = trim((string) ($_GET['status'] ?? ''));
        json_response(admin_list_brands($search, $category, $status));
    }

    if ($method === 'GET' && preg_match('#^/admin/brands/(\d+)$#', $path, $m)) {
        require_catalog_manager();
        $brand = admin_fetch_brand_row((int) $m[1]);
        if (!$brand) {
            json_error('Бренд не найден', 404);
        }
        json_response($brand);
    }

    if ($method === 'POST' && $path === '/admin/brands') {
        require_catalog_manager();
        $body = read_json_body();
        $title = brand_normalize_title((string) ($body['title'] ?? ''));
        if ($title === '') {
            json_error('Укажите название бренда', 400);
        }
        $categoryIds = brand_validate_category_ids((array) ($body['categoryIds'] ?? $body['categories'] ?? []));

        $pdo = db();
        $exists = $pdo->prepare('SELECT id FROM brands WHERE title = ? LIMIT 1');
        $exists->execute([$title]);
        if ($exists->fetchColumn()) {
            json_error('Такой бренд уже существует', 409);
        }

        $slug = brand_generate_unique_slug($pdo, $title);
        $stmt = $pdo->prepare('INSERT INTO brands (slug, title, is_active) VALUES (?, ?, ?)');
        $stmt->execute([
            $slug,
            $title,
            isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0) : 1,
        ]);
        $brandId = (int) $pdo->lastInsertId();
        brand_save_category_links($pdo, $brandId, $categoryIds);
        json_response(admin_fetch_brand_row($brandId) ?: [], 201);
    }

    if (($method === 'PUT' || $method === 'PATCH') && preg_match('#^/admin/brands/(\d+)$#', $path, $m)) {
        require_catalog_manager();
        $id = (int) $m[1];
        $current = admin_fetch_brand_row($id);
        if (!$current) {
            json_error('Бренд не найден', 404);
        }

        $body = read_json_body();
        $title = array_key_exists('title', $body)
            ? brand_normalize_title((string) $body['title'])
            : (string) $current['title'];
        if ($title === '') {
            json_error('Укажите название бренда', 400);
        }
        $categoryIds = array_key_exists('categoryIds', $body) || array_key_exists('categories', $body)
            ? brand_validate_category_ids((array) ($body['categoryIds'] ?? $body['categories'] ?? []))
            : array_map('intval', (array) ($current['categoryIds'] ?? []));

        $pdo = db();
        $exists = $pdo->prepare('SELECT id FROM brands WHERE title = ? AND id != ? LIMIT 1');
        $exists->execute([$title, $id]);
        if ($exists->fetchColumn()) {
            json_error('Такой бренд уже существует', 409);
        }

        $slug = brand_generate_unique_slug($pdo, $title, $id);
        $stmt = $pdo->prepare('UPDATE brands SET slug = ?, title = ?, is_active = ? WHERE id = ?');
        $stmt->execute([
            $slug,
            $title,
            array_key_exists('isActive', $body) ? ((bool) $body['isActive'] ? 1 : 0) : ($current['isActive'] ? 1 : 0),
            $id,
        ]);
        brand_save_category_links($pdo, $id, $categoryIds);
        json_response(admin_fetch_brand_row($id) ?: []);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/brands/(\d+)$#', $path, $m)) {
        require_catalog_manager();
        $id = (int) $m[1];
        $brand = admin_fetch_brand_row($id);
        if (!$brand) {
            json_error('Бренд не найден', 404);
        }
        if ((int) ($brand['usageCount'] ?? 0) > 0) {
            json_error('Нельзя удалить бренд, который уже используется в товарах', 409);
        }

        $pdo = db();
        $pdo->prepare('DELETE FROM brand_categories WHERE brand_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM brands WHERE id = ?')->execute([$id]);
        json_response(['ok' => true]);
    }

    return false;
}
