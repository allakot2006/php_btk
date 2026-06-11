<?php

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/response.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $host = env_get('MYSQL_HOST', '127.0.0.1');
    $port = env_get('MYSQL_PORT', '3306');
    $name = env_get('MYSQL_DATABASE', 'beltelecom_shop');
    $user = env_get('MYSQL_USER', 'root');
    $pass = env_get('MYSQL_PASSWORD', '');

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $e) {
        json_error('Ошибка подключения к базе данных', 500, [
            'details' => $e->getMessage(),
        ]);
    }

    return $pdo;
}

