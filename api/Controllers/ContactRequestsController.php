<?php

function handle_contact_requests_request(string $method, string $path): bool {
    if ($method === 'POST' && $path === '/contacts/callback') {
        $body = read_json_body();
        json_response(create_callback_request($body), 201);
    }

    if ($method === 'POST' && $path === '/contacts/stock') {
        $body = read_json_body();
        json_response(create_stock_request($body), 201);
    }

    if ($method === 'GET' && $path === '/admin/contact-requests') {
        require_catalog_manager();
        $type = trim((string) ($_GET['type'] ?? ''));
        $status = trim((string) ($_GET['status'] ?? ''));
        $search = trim((string) ($_GET['search'] ?? ''));
        json_response(list_contact_requests($type, $status, $search));
    }

    if (($method === 'PATCH' || $method === 'PUT') && preg_match('#^/admin/contact-requests/(\d+)/status$#', $path, $m)) {
        require_catalog_manager();
        $id = (int) ($m[1] ?? 0);
        if ($id <= 0) {
            json_error('Некорректный ID заявки', 400);
        }
        $body = read_json_body();
        $status = trim((string) ($body['status'] ?? ''));
        json_response(update_contact_request_status($id, $status));
    }

    return false;
}

