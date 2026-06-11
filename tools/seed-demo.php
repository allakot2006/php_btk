<?php


declare(strict_types=1);

$root = dirname(__DIR__);

require_once $root . '/api/lib/env.php';
env_load_file($root . '/config/.env');

$host = env_get('MYSQL_HOST', '127.0.0.1');
$port = env_get('MYSQL_PORT', '3306');
$name = env_get('MYSQL_DATABASE', 'beltelecom_shop');
$user = env_get('MYSQL_USER', 'root');
$pass = env_get('MYSQL_PASSWORD', '');

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name),
        (string) $user,
        (string) $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (Throwable $e) {
    fwrite(STDERR, 'Ошибка подключения к MySQL: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

require_once $root . '/api/lib/migrate.php';

if (!beltelecom_schema_ready($pdo)) {
    beltelecom_run_schema_migrations($pdo);
}
beltelecom_ensure_app_meta_table($pdo);
beltelecom_migrate_users_is_admin($pdo);
beltelecom_migrate_users_is_moderator($pdo);
beltelecom_migrate_ecommerce_v2($pdo);

putenv('SEED_TEST_DATA=1');
putenv('SEED_TEST_DATA_FORCE=1');
$_ENV['SEED_TEST_DATA'] = '1';
$_ENV['SEED_TEST_DATA_FORCE'] = '1';

require_once $root . '/api/lib/TestCatalogJsonSeeder.php';
require_once $root . '/api/lib/TestUsersJsonSeeder.php';

try {
    $catalogStats = TestCatalogJsonSeeder::runIfNeeded($pdo);
} catch (Throwable $e) {
    fwrite(STDERR, 'Ошибка загрузки каталога JSON: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

try {
    $usersStats = TestUsersJsonSeeder::runIfNeeded($pdo);
} catch (Throwable $e) {
    fwrite(STDERR, 'Ошибка загрузки database/seed-users.json: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

echo 'Загрузка тестовых данных завершена.' . PHP_EOL;
echo sprintf(
    '- Каталог: файлов %d, обработано %d, категорий %d, товаров %d%s',
    (int) ($catalogStats['filesTotal'] ?? 0),
    (int) ($catalogStats['filesProcessed'] ?? 0),
    (int) ($catalogStats['categoriesUpserted'] ?? 0),
    (int) ($catalogStats['productsUpserted'] ?? 0),
    !empty($catalogStats['skipped']) ? ' (пропущено)' : ''
) . PHP_EOL;
echo sprintf(
    '- Пользователи: записей %d, обработано %d%s',
    (int) ($usersStats['usersTotal'] ?? 0),
    (int) ($usersStats['usersUpserted'] ?? 0),
    !empty($usersStats['skipped']) ? ' (пропущено)' : ''
) . PHP_EOL;
