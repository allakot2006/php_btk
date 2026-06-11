<?php

require_once __DIR__ . '/env.php';

class TestCatalogJsonSeeder {
    private static function envTruthy(string $key, string $default = '0'): bool {
        $v = strtolower(trim((string) env_get($key, $default)));
        return in_array($v, ['1', 'true', 'yes', 'on'], true);
    }

    public static function isEnabled(): bool {
        return self::envTruthy('SEED_TEST_DATA', '0');
    }

    public static function isForce(): bool {
        return self::envTruthy('SEED_TEST_DATA_FORCE', '0');
    }

    private static function productsDir(): string {
        return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'products';
    }

    private static function alreadySeeded(PDO $pdo): bool {
        $stmt = $pdo->query(
            "SELECT meta_value FROM app_meta WHERE meta_key = 'test_catalog_json_seeded' LIMIT 1"
        );
        $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        return $row && ($row['meta_value'] ?? '') === '1';
    }

    private static function markSeeded(PDO $pdo): void {
        $sql = 'INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)';
        $pdo->prepare($sql)->execute(['test_catalog_json_seeded', '1']);
    }

    private static function emptyStats(bool $skipped = false): array {
        return [
            'skipped' => $skipped,
            'filesTotal' => 0,
            'filesProcessed' => 0,
            'categoriesUpserted' => 0,
            'productsUpserted' => 0,
        ];
    }

    private static function upsertCategory(PDO $pdo, string $slug, string $title): int {
        $pdo->prepare(
            'INSERT INTO categories (slug, title) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title)'
        )->execute([$slug, $title]);
        $stmt = $pdo->prepare('SELECT id FROM categories WHERE slug = ?');
        $stmt->execute([$slug]);
        $id = $stmt->fetchColumn();
        return (int) $id;
    }

    private static function upsertProduct(PDO $pdo, int $categoryId, string $categorySlug, array $p): void {
        $slug = isset($p['slug']) ? (string) $p['slug'] : '';
        if ($slug === '') {
            $slug = 'demo-seed-' . $categorySlug . '-' . substr(sha1(json_encode($p)), 0, 8);
        }
        $name = isset($p['name']) ? (string) $p['name'] : 'Товар';
        $description = isset($p['description']) ? (string) $p['description'] : null;
        $full = isset($p['full_description']) ? (string) $p['full_description']
            : (isset($p['fullDescription']) ? (string) $p['fullDescription'] : null);
        $price = isset($p['price']) ? (float) $p['price'] : 0;
        $orig = isset($p['original_price']) ? $p['original_price'] : ($p['originalPrice'] ?? null);
        $orig = $orig !== null && $orig !== '' ? (float) $orig : null;
        $discount = isset($p['discount']) ? (int) $p['discount'] : null;
        $image = isset($p['image']) ? (string) $p['image'] : null;
        $color = isset($p['color']) ? (string) $p['color'] : null;
        $brand = isset($p['brand']) ? (string) $p['brand'] : null;
        $specs = $p['specs'] ?? null;
        $specsJson = is_array($specs) ? json_encode($specs, JSON_UNESCAPED_UNICODE) : null;

        $skuRaw = isset($p['sku']) ? trim((string) $p['sku']) : '';
        $sku = $skuRaw !== '' ? $skuRaw : null;
        $stockRaw = $p['stock_quantity'] ?? $p['stockQuantity'] ?? null;
        $stockQuantity = null;
        if ($stockRaw !== null && $stockRaw !== '') {
            $stockQuantity = (int) $stockRaw;
        }
        $isActive = 1;
        if (array_key_exists('is_active', $p)) {
            $isActive = ((bool) $p['is_active']) ? 1 : 0;
        } elseif (array_key_exists('isActive', $p)) {
            $isActive = ((bool) $p['isActive']) ? 1 : 0;
        }

        $sql = 'INSERT INTO products (
            category_id, slug, sku, name, description, full_description, price, original_price, discount,
            image, color, brand, specs_json, stock_quantity, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            category_id = VALUES(category_id),
            sku = VALUES(sku),
            name = VALUES(name),
            description = VALUES(description),
            full_description = VALUES(full_description),
            price = VALUES(price),
            original_price = VALUES(original_price),
            discount = VALUES(discount),
            image = VALUES(image),
            color = VALUES(color),
            brand = VALUES(brand),
            specs_json = VALUES(specs_json),
            stock_quantity = VALUES(stock_quantity),
            is_active = VALUES(is_active)';

        $pdo->prepare($sql)->execute([
            $categoryId,
            $slug,
            $sku,
            $name,
            $description,
            $full,
            $price,
            $orig,
            $discount,
            $image,
            $color,
            $brand,
            $specsJson,
            $stockQuantity,
            $isActive,
        ]);
    }

    public static function runIfNeeded(PDO $pdo): array {
        if (!self::isEnabled()) {
            return self::emptyStats(true);
        }
        if (!self::isForce() && self::alreadySeeded($pdo)) {
            return self::emptyStats(true);
        }

        $dir = self::productsDir();
        if (!is_dir($dir)) {
            throw new RuntimeException('Не найдена папка с тестовыми товарами: ' . $dir);
        }

        $files = glob($dir . DIRECTORY_SEPARATOR . '*.json') ?: [];
        if ($files === []) {
            throw new RuntimeException('В папке public/assets/products не найдено ни одного JSON-файла.');
        }

        $stats = self::emptyStats(false);
        $stats['filesTotal'] = count($files);
        $pdo->beginTransaction();
        try {
            foreach ($files as $file) {
                $base = basename($file, '.json');
                if (!preg_match('/^[a-z0-9_-]+$/', $base)) {
                    throw new RuntimeException('Некорректное имя JSON-файла категории: ' . basename($file));
                }
                $raw = file_get_contents($file);
                if ($raw === false) {
                    throw new RuntimeException('Не удалось прочитать файл: ' . $file);
                }
                $data = json_decode($raw, true);
                if (!is_array($data)) {
                    throw new RuntimeException('Невалидный JSON в файле: ' . basename($file));
                }
                $title = isset($data['category_title']) ? (string) $data['category_title']
                    : (isset($data['categoryTitle']) ? (string) $data['categoryTitle'] : $base);
                $items = $data['products'] ?? $data['items'] ?? null;
                if (!is_array($items) || $items === []) {
                    throw new RuntimeException('В файле ' . basename($file) . ' отсутствует непустой массив products/items.');
                }
                $catId = self::upsertCategory($pdo, $base, $title);
                $stats['categoriesUpserted']++;
                foreach ($items as $item) {
                    if (!is_array($item)) {
                        throw new RuntimeException('В файле ' . basename($file) . ' найден товар в неверном формате.');
                    }
                    self::upsertProduct($pdo, $catId, $base, $item);
                    $stats['productsUpserted']++;
                }
                $stats['filesProcessed']++;
            }
            if ((int) $stats['productsUpserted'] > 0) {
                self::markSeeded($pdo);
            }
            $pdo->commit();
            return $stats;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
