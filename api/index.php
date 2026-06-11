<?php

require_once __DIR__ . '/lib/env.php';
require_once __DIR__ . '/lib/response.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/Http/request.php';
require_once __DIR__ . '/Services/CatalogService.php';
require_once __DIR__ . '/Services/BrandService.php';
require_once __DIR__ . '/Services/AuthService.php';
require_once __DIR__ . '/Services/OrderService.php';
require_once __DIR__ . '/Services/ContactRequestService.php';
require_once __DIR__ . '/Services/AdminProductService.php';
require_once __DIR__ . '/Services/AdminUserService.php';
require_once __DIR__ . '/Controllers/AuthController.php';
require_once __DIR__ . '/Controllers/CatalogController.php';
require_once __DIR__ . '/Controllers/BrandsController.php';
require_once __DIR__ . '/Controllers/OrdersController.php';
require_once __DIR__ . '/Controllers/ContactRequestsController.php';
require_once __DIR__ . '/Controllers/AdminProductsController.php';
require_once __DIR__ . '/Controllers/AdminUsersController.php';
require_once __DIR__ . '/Http/dispatch.php';

env_load_file(__DIR__ . '/../config/.env');

require_once __DIR__ . '/lib/migrate.php';
try {
    beltelecom_bootstrap();
} catch (Throwable $e) {
    error_log('beltelecom_bootstrap: ' . $e->getMessage());
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
    http_response_code(500);
    echo json_encode(
        ['error' => 'Ошибка инициализации базы данных', 'details' => $e->getMessage()],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

session_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = route_path();
dispatch_api_request($method, $path);

