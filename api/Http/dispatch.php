<?php

function dispatch_api_request(string $method, string $path): void {
    if ($method === 'GET' && $path === '/health') {
        json_response(['ok' => true]);
    }

    handle_auth_request($method, $path);
    handle_catalog_request($method, $path);
    handle_brands_request($method, $path);
    handle_contact_requests_request($method, $path);
    handle_orders_request($method, $path);
    handle_admin_products_request($method, $path);
    handle_admin_users_request($method, $path);

    handle_category_slug_request($method, $path);

    json_error('Не найдено', 404);
}
