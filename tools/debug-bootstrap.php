<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../api/lib/env.php';
require_once __DIR__ . '/../api/lib/db.php';
require_once __DIR__ . '/../api/lib/migrate.php';

env_load_file(__DIR__ . '/../config/.env');

function line(string $label, string $value = ''): void
{
    echo $label;
    if ($value !== '') {
        echo ': ' . $value;
    }
    echo PHP_EOL;
}

function bool_to_text(bool $value): string
{
    return $value ? 'yes' : 'no';
}

line('=== Beltelecom DB Bootstrap Debug ===');
line('PHP_VERSION', PHP_VERSION);
line('PHP_SAPI', PHP_SAPI);
line('PDO loaded', bool_to_text(extension_loaded('pdo')));
line('pdo_mysql loaded', bool_to_text(extension_loaded('pdo_mysql')));
line('mysqli loaded', bool_to_text(extension_loaded('mysqli')));
line('');

$host = (string) env_get('MYSQL_HOST', '127.0.0.1');
$port = (string) env_get('MYSQL_PORT', '3306');
$name = (string) env_get('MYSQL_DATABASE', 'beltelecom_shop');
$user = (string) env_get('MYSQL_USER', 'root');
$pass = (string) env_get('MYSQL_PASSWORD', '');

line('MYSQL_HOST', $host);
line('MYSQL_PORT', $port);
line('MYSQL_DATABASE', $name);
line('MYSQL_USER', $user);
line('MYSQL_PASSWORD set', $pass !== '' ? 'yes' : 'no');
line('');

try {
    $pdo = db();
    line('DB connection', 'OK');
} catch (Throwable $e) {
    line('DB connection', 'FAILED');
    line('Error', $e->getMessage());
    exit(1);
}

try {
    beltelecom_bootstrap();
    line('beltelecom_bootstrap()', 'OK');
} catch (Throwable $e) {
    line('beltelecom_bootstrap()', 'FAILED');
    line('Error', $e->getMessage());
    exit(1);
}

$requiredTables = [
    'categories',
    'products',
    'users',
    'orders',
    'order_items',
    'brands',
    'brand_categories',
    'contact_requests',
    'app_meta',
];

line('');
line('=== Table Check ===');
foreach ($requiredTables as $table) {
    try {
        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?'
        );
        $st->execute([$table]);
        $exists = ((int) $st->fetchColumn()) > 0;
        line($table, $exists ? 'OK' : 'MISSING');
    } catch (Throwable $e) {
        line($table, 'ERROR: ' . $e->getMessage());
    }
}

line('');
line('Done');
