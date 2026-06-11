<?php

function handle_catalog_request(string $method, string $path): bool {
    if ($method === 'GET' && $path === '/categories') {
        json_response(get_categories_list());
    }

    if ($method === 'GET' && $path === '/search') {
        $q = (string)($_GET['q'] ?? '');
        json_response(search_products($q, 40));
    }

    if ($method === 'GET' && $path === '/search/suggest') {
        $q = (string) ($_GET['q'] ?? '');
        json_response(search_products_starts_with($q, 8));
    }

    if ($method === 'GET' && preg_match('#^/products/(\d+)$#', $path, $m)) {
        $p = get_product_by_id((int)$m[1]);
        if (!$p) {
            json_error('Товар не найден', 404);
        }
        json_response($p);
    }

    if ($method === 'GET' && $path === '/products') {
        json_response(get_recent_products(50));
    }

    return false;
}

function handle_category_slug_request(string $method, string $path): bool {
    if ($method !== 'GET') {
        return false;
    }

    $slug = ltrim($path, '/');
    if ($slug === '' || preg_match('/^[a-z0-9_-]+$/', $slug) !== 1) {
        return false;
    }

    if (!category_exists_by_slug($slug)) {
        json_error('Категория не найдена', 404);
    }

    json_response(get_products_by_category_slug($slug));
}
