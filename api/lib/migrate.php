<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';

function beltelecom_sql_statements_from_file(string $path): array {
    if (!is_readable($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return [];
    }
    $raw = preg_replace('/^--.*$/m', '', $raw);
    $raw = preg_replace('/^\s*$/m', '', $raw);
    $parts = preg_split('/;\s*\n/s', trim($raw));
    $out = [];
    foreach ($parts as $chunk) {
        $chunk = trim($chunk);
        if ($chunk !== '') {
            $out[] = $chunk;
        }
    }
    return $out;
}

function beltelecom_schema_ready(PDO $pdo): bool {
    $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
    if (!$db) {
        return false;
    }
    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?'
    );
    $st->execute([$db, 'categories']);
    return (int) $st->fetchColumn() > 0;
}

function beltelecom_run_schema_migrations(PDO $pdo): void {
    $root = dirname(__DIR__, 2);
    $schemaPath = $root . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'schema.sql';
    $stmts = beltelecom_sql_statements_from_file($schemaPath);
    foreach ($stmts as $sql) {
        $pdo->exec($sql);
    }
}

function beltelecom_ensure_app_meta_table(PDO $pdo): void {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS app_meta (
          meta_key VARCHAR(64) NOT NULL,
          meta_value VARCHAR(512) NULL,
          PRIMARY KEY (meta_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function beltelecom_migrate_users_is_admin(PDO $pdo): void {
    $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
    if (!$db) {
        return;
    }
    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $st->execute([$db, 'users', 'is_admin']);
    if ((int) $st->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0');
    }
    $email = strtolower(trim((string) env_get('ADMIN_EMAIL', '')));
    if ($email !== '') {
        $u = $pdo->prepare('UPDATE users SET is_admin = 1 WHERE LOWER(email) = ?');
        $u->execute([$email]);
    }
}

function beltelecom_migrate_users_is_moderator(PDO $pdo): void {
    $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
    if (!$db) {
        return;
    }
    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $st->execute([$db, 'users', 'is_moderator']);
    if ((int) $st->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE users ADD COLUMN is_moderator TINYINT(1) NOT NULL DEFAULT 0 AFTER is_admin');
    }
}

function beltelecom_migrate_ecommerce_v2(PDO $pdo): void {
    $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
    if (!$db || !beltelecom_schema_ready($pdo)) {
        return;
    }

    $hasCol = static function (PDO $pdo, string $schema, string $table, string $col): bool {
        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $st->execute([$schema, $table, $col]);

        return (int) $st->fetchColumn() > 0;
    };

    $hasIdx = static function (PDO $pdo, string $schema, string $table, string $idx): bool {
        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?'
        );
        $st->execute([$schema, $table, $idx]);

        return (int) $st->fetchColumn() > 0;
    };

    $hasTable = static function (PDO $pdo, string $schema, string $table): bool {
        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.tables
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
        );
        $st->execute([$schema, $table]);

        return (int) $st->fetchColumn() > 0;
    };

    $hasFk = static function (PDO $pdo, string $schema, string $table, string $constraint): bool {
        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ?'
        );
        $st->execute([$schema, $table, $constraint, 'FOREIGN KEY']);
        return (int) $st->fetchColumn() > 0;
    };

    $tryIdx = static function (PDO $pdo, string $sql) use ($db): void {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            $msg = $e->getMessage();
            if (stripos($msg, 'Duplicate') === false && stripos($msg, 'already exists') === false) {
                error_log('[migrate_v2 index] ' . $msg);
            }
        }
    };

    if (!$hasCol($pdo, $db, 'categories', 'description')) {
        $pdo->exec('ALTER TABLE categories ADD COLUMN description VARCHAR(512) NULL AFTER title');
    }
    if (!$hasCol($pdo, $db, 'categories', 'sort_order')) {
        $pdo->exec('ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER description');
    }
    if (!$hasCol($pdo, $db, 'categories', 'updated_at')) {
        $pdo->exec(
            'ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
        );
    }

    if (!$hasTable($pdo, $db, 'brands')) {
        $pdo->exec(
            'CREATE TABLE brands (
              id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              slug VARCHAR(64) NOT NULL,
              title VARCHAR(128) NOT NULL,
              is_active TINYINT(1) NOT NULL DEFAULT 1,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              UNIQUE KEY uq_brands_slug (slug),
              UNIQUE KEY uq_brands_title (title),
              KEY ix_brands_active_title (is_active, title)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    } else {
        if (!$hasCol($pdo, $db, 'brands', 'is_active')) {
            $pdo->exec('ALTER TABLE brands ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER title');
        }
        if (!$hasCol($pdo, $db, 'brands', 'updated_at')) {
            $pdo->exec(
                'ALTER TABLE brands ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
            );
        }
        if (!$hasIdx($pdo, $db, 'brands', 'uq_brands_slug')) {
            $tryIdx($pdo, 'CREATE UNIQUE INDEX uq_brands_slug ON brands (slug)');
        }
        if (!$hasIdx($pdo, $db, 'brands', 'uq_brands_title')) {
            $tryIdx($pdo, 'CREATE UNIQUE INDEX uq_brands_title ON brands (title)');
        }
    }

    if (!$hasTable($pdo, $db, 'brand_categories')) {
        $pdo->exec(
            'CREATE TABLE brand_categories (
              brand_id BIGINT UNSIGNED NOT NULL,
              category_id BIGINT UNSIGNED NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (brand_id, category_id),
              KEY ix_brand_categories_category (category_id, brand_id),
              CONSTRAINT fk_brand_categories_brand
                FOREIGN KEY (brand_id) REFERENCES brands(id)
                ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT fk_brand_categories_category
                FOREIGN KEY (category_id) REFERENCES categories(id)
                ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    if (!$hasCol($pdo, $db, 'products', 'sku')) {
        $pdo->exec('ALTER TABLE products ADD COLUMN sku VARCHAR(64) NULL AFTER slug');
    }
    if (!$hasCol($pdo, $db, 'products', 'stock_quantity')) {
        $pdo->exec(
            'ALTER TABLE products ADD COLUMN stock_quantity INT NULL DEFAULT NULL COMMENT \'NULL=без лимита\' AFTER specs_json'
        );
    }
    if (!$hasCol($pdo, $db, 'products', 'updated_at')) {
        $pdo->exec(
            'ALTER TABLE products ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
        );
    }
    if (!$hasIdx($pdo, $db, 'products', 'uq_products_sku')) {
        $tryIdx($pdo, 'CREATE UNIQUE INDEX uq_products_sku ON products (sku)');
    }
    if (!$hasIdx($pdo, $db, 'products', 'ix_products_cat_active')) {
        $tryIdx($pdo, 'CREATE INDEX ix_products_cat_active ON products (category_id, is_active)');
    }
    if (!$hasIdx($pdo, $db, 'products', 'ix_products_brand')) {
        $tryIdx($pdo, 'CREATE INDEX ix_products_brand ON products (brand)');
    }

    if (!$hasCol($pdo, $db, 'users', 'is_moderator')) {
        $pdo->exec('ALTER TABLE users ADD COLUMN is_moderator TINYINT(1) NOT NULL DEFAULT 0 AFTER is_admin');
    }
    if (!$hasCol($pdo, $db, 'users', 'is_active')) {
        $pdo->exec('ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_moderator');
    }
    if (!$hasCol($pdo, $db, 'users', 'updated_at')) {
        $pdo->exec(
            'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
        );
    }

    if (!$hasCol($pdo, $db, 'orders', 'order_number')) {
        $pdo->exec('ALTER TABLE orders ADD COLUMN order_number VARCHAR(32) NULL AFTER user_id');
    }
    if (!$hasCol($pdo, $db, 'orders', 'currency')) {
        $pdo->exec("ALTER TABLE orders ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'BYN' AFTER total");
    }
    if (!$hasCol($pdo, $db, 'orders', 'updated_at')) {
        $pdo->exec(
            'ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
        );
    }
    if (!$hasIdx($pdo, $db, 'orders', 'uq_orders_order_number')) {
        $tryIdx($pdo, 'CREATE UNIQUE INDEX uq_orders_order_number ON orders (order_number)');
    }

    if (!$hasCol($pdo, $db, 'order_items', 'slug_snapshot')) {
        $pdo->exec('ALTER TABLE order_items ADD COLUMN slug_snapshot VARCHAR(128) NULL AFTER product_id');
    }
    if (!$hasCol($pdo, $db, 'order_items', 'image_snapshot')) {
        $pdo->exec('ALTER TABLE order_items ADD COLUMN image_snapshot VARCHAR(512) NULL AFTER slug_snapshot');
    }

    if (!$hasTable($pdo, $db, 'order_status_log')) {
        $pdo->exec(
            'CREATE TABLE order_status_log (
              id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              order_id BIGINT UNSIGNED NOT NULL,
              old_status VARCHAR(32) NULL,
              new_status VARCHAR(32) NOT NULL,
              note VARCHAR(512) NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              KEY ix_order_status_log_order (order_id, created_at),
              CONSTRAINT fk_order_status_log_order
                FOREIGN KEY (order_id) REFERENCES orders(id)
                ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    if (!$hasTable($pdo, $db, 'product_images')) {
        $pdo->exec(
            'CREATE TABLE product_images (
              id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              product_id BIGINT UNSIGNED NOT NULL,
              url VARCHAR(512) NOT NULL,
              sort_order INT NOT NULL DEFAULT 0,
              is_primary TINYINT(1) NOT NULL DEFAULT 0,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              KEY ix_product_images_product (product_id, sort_order),
              CONSTRAINT fk_product_images_product
                FOREIGN KEY (product_id) REFERENCES products(id)
                ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    if (!$hasTable($pdo, $db, 'contact_requests')) {
        $pdo->exec(
            'CREATE TABLE contact_requests (
              id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              type VARCHAR(32) NOT NULL,
              user_id BIGINT UNSIGNED NULL,
              name VARCHAR(128) NULL,
              phone VARCHAR(32) NULL,
              email VARCHAR(254) NULL,
              topic VARCHAR(128) NULL,
              category_slug VARCHAR(64) NULL,
              query_text VARCHAR(512) NULL,
              status VARCHAR(32) NOT NULL DEFAULT \'new\',
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              KEY ix_contact_requests_user_id (user_id),
              KEY ix_contact_requests_type_created (type, created_at),
              KEY ix_contact_requests_status_created (status, created_at),
              CONSTRAINT fk_contact_requests_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE SET NULL ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    } else {
        if (!$hasCol($pdo, $db, 'contact_requests', 'user_id')) {
            $pdo->exec('ALTER TABLE contact_requests ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER type');
        }
        if (!$hasIdx($pdo, $db, 'contact_requests', 'ix_contact_requests_user_id')) {
            $tryIdx($pdo, 'CREATE INDEX ix_contact_requests_user_id ON contact_requests (user_id)');
        }
        if (!$hasFk($pdo, $db, 'contact_requests', 'fk_contact_requests_user')) {
            try {
                $pdo->exec(
                    'ALTER TABLE contact_requests
                     ADD CONSTRAINT fk_contact_requests_user
                     FOREIGN KEY (user_id) REFERENCES users(id)
                     ON DELETE SET NULL ON UPDATE CASCADE'
                );
            } catch (Throwable $e) {
                error_log('[migrate_v2 contact_requests fk] ' . $e->getMessage());
            }
        }
    }

    beltelecom_seed_brands_from_products($pdo);
}

function beltelecom_brand_slugify(string $title): string {
    $title = strtolower(trim($title));
    $slug = preg_replace('/[^a-z0-9]+/i', '-', $title);
    $slug = is_string($slug) ? trim($slug, '-') : '';
    if ($slug !== '') {
        return substr($slug, 0, 64);
    }
    return 'brand-' . substr(md5($title), 0, 8);
}

function beltelecom_seed_brands_from_products(PDO $pdo): void {
    $rows = $pdo->query(
        "SELECT DISTINCT TRIM(p.brand) AS brand_title, p.category_id
         FROM products p
         WHERE p.brand IS NOT NULL AND TRIM(p.brand) <> ''"
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (!$rows) {
        return;
    }

    foreach ($rows as $row) {
        $title = trim((string) ($row['brand_title'] ?? ''));
        $categoryId = (int) ($row['category_id'] ?? 0);
        if ($title === '' || $categoryId <= 0) {
            continue;
        }
        $slug = beltelecom_brand_slugify($title);
        $insertBrand = $pdo->prepare(
            'INSERT INTO brands (slug, title, is_active)
             VALUES (:slug, :title, 1)
             ON DUPLICATE KEY UPDATE title = VALUES(title), is_active = 1'
        );
        $insertBrand->execute([
            'slug' => $slug,
            'title' => $title,
        ]);

        $brandIdStmt = $pdo->prepare('SELECT id FROM brands WHERE title = ? LIMIT 1');
        $brandIdStmt->execute([$title]);
        $brandId = (int) $brandIdStmt->fetchColumn();
        if ($brandId <= 0) {
            continue;
        }
        $linkStmt = $pdo->prepare(
            'INSERT IGNORE INTO brand_categories (brand_id, category_id) VALUES (?, ?)'
        );
        $linkStmt->execute([$brandId, $categoryId]);
    }
}

function beltelecom_bootstrap(): void {
    $pdo = db();
    if (!beltelecom_schema_ready($pdo)) {
        beltelecom_run_schema_migrations($pdo);
    }
    beltelecom_ensure_app_meta_table($pdo);
    beltelecom_migrate_users_is_admin($pdo);
    beltelecom_migrate_users_is_moderator($pdo);
    beltelecom_migrate_ecommerce_v2($pdo);

    require_once __DIR__ . '/TestCatalogJsonSeeder.php';
    try {
        TestCatalogJsonSeeder::runIfNeeded($pdo);
    } catch (Throwable $e) {
        error_log('[TestCatalogJsonSeeder] ' . $e->getMessage());
    }

    require_once __DIR__ . '/TestUsersJsonSeeder.php';
    try {
        $userSeedStats = TestUsersJsonSeeder::runIfNeeded($pdo);
        if (!empty($userSeedStats['usersUpserted'])) {
            error_log('[TestUsersJsonSeeder] upserted ' . (int) $userSeedStats['usersUpserted'] . ' users');
        }
    } catch (Throwable $e) {
        error_log('[TestUsersJsonSeeder] ' . $e->getMessage());
    }
}
