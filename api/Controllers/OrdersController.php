<?php

function handle_orders_request(string $method, string $path): bool {
    if (($method === 'PATCH' || $method === 'PUT') && preg_match('#^/admin/orders/(\d+)/status$#', $path, $m)) {
        require_catalog_manager();
        $orderId = (int) ($m[1] ?? 0);
        if ($orderId <= 0) {
            json_error('Некорректный ID заказа', 400);
        }
        $body = read_json_body();
        $status = trim((string) ($body['status'] ?? ''));
        json_response(update_order_status_for_staff($orderId, $status));
    }

    if ($method === 'GET' && $path === '/admin/orders') {
        require_catalog_manager();
        json_response(get_orders_for_staff(400));
    }

    if ($method === 'GET' && $path === '/orders') {
        $uid = require_auth_user_id();
        json_response(get_orders_for_user($uid));
    }

    if ($method === 'POST' && $path === '/orders') {
        $authUserId = require_auth_user_id();
        $authUser = get_auth_user_by_id($authUserId);
        if (!$authUser) json_error('Пользователь не найден', 401);

        $result = place_order(read_json_body(), $authUserId, $authUser);
        json_response($result, 201);
    }

    return false;
}
