<?php

function handle_admin_products_request(string $method, string $path): bool {
    if ($method === 'GET' && $path === '/admin/products') {
        require_catalog_manager();
        $pdo = db();
        $cat = trim((string) ($_GET['category'] ?? ''));
        $sql = 'SELECT p.id, p.category_id, p.slug, p.sku, p.stock_quantity, p.name, p.description, p.full_description,
                p.price, p.original_price, p.discount, p.image, p.color, p.brand, p.specs_json, p.is_active,
                c.slug AS category_slug
                FROM products p
                JOIN categories c ON c.id = p.category_id';
        $params = [];
        if ($cat !== '' && preg_match('/^[a-z0-9_-]+$/', $cat) === 1) {
            if (ctype_digit($cat)) {
                $sql .= ' WHERE c.id = :catId';
                $params['catId'] = (int) $cat;
            } else {
                $sql .= ' WHERE c.slug = :cat';
                $params['cat'] = $cat;
            }
        }
        $sql .= ' ORDER BY p.id DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        json_response(array_map('admin_format_product', $rows));
    }

    if ($method === 'GET' && preg_match('#^/admin/products/(\d+)$#', $path, $m)) {
        require_catalog_manager();
        $row = admin_fetch_product_row((int) $m[1]);
        if (!$row) {
            json_error('Товар не найден', 404);
        }
        json_response(admin_format_product($row));
    }

    if ($method === 'POST' && $path === '/admin/products/upload-image') {
        require_catalog_manager();
        $categoryId = (int) ($_POST['categoryId'] ?? $_POST['category_id'] ?? 0);
        if ($categoryId <= 0) {
            json_error('Сначала выберите категорию товара', 400);
        }
        if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
            json_error('Файл изображения не передан', 400);
        }
        $file = $_FILES['image'];
        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode !== UPLOAD_ERR_OK) {
            json_error(admin_upload_error_message($errorCode), 400);
        }
        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            json_error('Файл пустой или повреждён', 400);
        }
        if ($size > 8 * 1024 * 1024) {
            json_error('Размер изображения не должен превышать 8 МБ', 400);
        }
        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            json_error('Не удалось получить временный файл загрузки', 400);
        }
        $imageInfo = @getimagesize($tmpName);
        if (!is_array($imageInfo)) {
            json_error('Можно загружать только изображения', 400);
        }
        $extension = admin_upload_extension(
            isset($imageInfo['mime']) ? (string) $imageInfo['mime'] : '',
            isset($file['name']) ? (string) $file['name'] : ''
        );
        if ($extension === null) {
            json_error('Поддерживаются только JPG, PNG, WEBP и GIF', 400);
        }

        $pdo = db();
        $categoryStmt = $pdo->prepare('SELECT slug FROM categories WHERE id = ?');
        $categoryStmt->execute([$categoryId]);
        $categoryRow = $categoryStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($categoryRow) || empty($categoryRow['slug'])) {
            json_error('Категория не найдена', 400);
        }
        $categorySlug = (string) $categoryRow['slug'];

        $publicDir = realpath(__DIR__ . '/../../public');
        if ($publicDir === false) {
            json_error('Не найдена папка public для сохранения изображений', 500);
        }
        $assetsDir = $publicDir . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'products';
        $categoryDir = $assetsDir . DIRECTORY_SEPARATOR . $categorySlug;
        if (!is_dir($categoryDir) && !mkdir($categoryDir, 0775, true) && !is_dir($categoryDir)) {
            json_error('Не удалось создать папку категории для изображения', 500);
        }

        $baseName = admin_upload_basename(pathinfo((string) ($file['name'] ?? ''), PATHINFO_FILENAME));
        if ($baseName === '') {
            $baseName = 'product-image';
        }
        try {
            $suffix = bin2hex(random_bytes(4));
        } catch (Throwable $e) {
            $suffix = (string) mt_rand(100000, 999999);
        }
        $filename = $baseName . '-' . date('Ymd-His') . '-' . $suffix . '.' . $extension;
        $targetPath = $categoryDir . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            json_error('Не удалось сохранить изображение в проект', 500);
        }

        $imageUrl = '/assets/products/' . $categorySlug . '/' . $filename;
        json_response([
            'ok' => true,
            'image' => $imageUrl,
            'categorySlug' => $categorySlug,
        ], 201);
    }

    if ($method === 'POST' && $path === '/admin/products') {
        require_catalog_manager();
        $body = read_json_body();
        $categoryId = (int) ($body['categoryId'] ?? $body['category_id'] ?? 0);
        $slug = trim((string) ($body['slug'] ?? ''));
        $name = trim((string) ($body['name'] ?? ''));
        if ($categoryId <= 0) {
            json_error('Укажите categoryId', 400);
        }
        if ($slug === '' || !preg_match('/^[a-z0-9_-]+$/', $slug)) {
            json_error('Некорректный slug (латиница, цифры, - и _)', 400);
        }
        if ($name === '') {
            json_error('Укажите название', 400);
        }
        if (!array_key_exists('price', $body) || !is_numeric($body['price']) || (float) $body['price'] < 0) {
            json_error('Укажите корректную цену', 400);
        }
        $pdo = db();
        $c = $pdo->prepare('SELECT id FROM categories WHERE id = ?');
        $c->execute([$categoryId]);
        if (!$c->fetch()) {
            json_error('Категория не найдена', 400);
        }
        $ex = $pdo->prepare('SELECT id FROM products WHERE slug = ?');
        $ex->execute([$slug]);
        if ($ex->fetch()) {
            json_error('Товар с таким slug уже есть', 409);
        }
        $specs = admin_read_specs_from_body($body);
        $specsJson = $specs !== null ? json_encode($specs, JSON_UNESCAPED_UNICODE) : null;

        $skuRaw = isset($body['sku']) ? trim((string) $body['sku']) : '';
        $sku = $skuRaw !== '' ? $skuRaw : null;
        if ($sku !== null) {
            $chk = $pdo->prepare('SELECT id FROM products WHERE sku = ?');
            $chk->execute([$sku]);
            if ($chk->fetch()) {
                json_error('Артикул (SKU) уже занят', 409);
            }
        }
        $stockQ = array_key_exists('stockQuantity', $body)
            ? $body['stockQuantity']
            : ($body['stock_quantity'] ?? null);
        $stockQuantity = null;
        if ($stockQ !== null && $stockQ !== '') {
            $stockQuantity = (int) $stockQ;
            if ($stockQuantity < 0) {
                json_error('Остаток не может быть отрицательным', 400);
            }
        }

        $stmt = $pdo->prepare(
            'INSERT INTO products (
                category_id, slug, sku, name, description, full_description, price, original_price, discount,
                image, color, brand, specs_json, stock_quantity, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $categoryId,
            $slug,
            $sku,
            $name,
            isset($body['description']) ? (string) $body['description'] : null,
            isset($body['fullDescription']) ? (string) $body['fullDescription']
                : (isset($body['full_description']) ? (string) $body['full_description'] : null),
            (float) $body['price'],
            isset($body['originalPrice']) ? (float) $body['originalPrice']
                : (isset($body['original_price']) ? (float) $body['original_price'] : null),
            isset($body['discount']) ? (int) $body['discount'] : null,
            isset($body['image']) ? (string) $body['image'] : null,
            isset($body['color']) ? (string) $body['color'] : null,
            isset($body['brand']) ? (string) $body['brand'] : null,
            $specsJson,
            $stockQuantity,
            isset($body['isActive']) ? ((bool) $body['isActive'] ? 1 : 0)
                : (isset($body['is_active']) ? ((bool) $body['is_active'] ? 1 : 0) : 1),
        ]);
        $newId = (int) $pdo->lastInsertId();
        json_response(admin_format_product(admin_fetch_product_row($newId) ?: []), 201);
    }

    if (($method === 'PUT' || $method === 'PATCH') && preg_match('#^/admin/products/(\d+)$#', $path, $m)) {
        require_catalog_manager();
        $id = (int) $m[1];
        $body = read_json_body();
        $pdo = db();
        $cur = $pdo->prepare('SELECT id, slug FROM products WHERE id = ?');
        $cur->execute([$id]);
        $existing = $cur->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            json_error('Товар не найден', 404);
        }
        $newSlug = array_key_exists('slug', $body) ? trim((string) $body['slug']) : $existing['slug'];
        if ($newSlug === '' || !preg_match('/^[a-z0-9_-]+$/', $newSlug)) {
            json_error('Некорректный slug', 400);
        }
        if ($newSlug !== $existing['slug']) {
            $ex = $pdo->prepare('SELECT id FROM products WHERE slug = ? AND id != ?');
            $ex->execute([$newSlug, $id]);
            if ($ex->fetch()) {
                json_error('Товар с таким slug уже есть', 409);
            }
        }
        $categoryId = array_key_exists('categoryId', $body) || array_key_exists('category_id', $body)
            ? (int) ($body['categoryId'] ?? $body['category_id'] ?? 0) : null;
        if ($categoryId !== null) {
            if ($categoryId <= 0) {
                json_error('Некорректный categoryId', 400);
            }
            $c = $pdo->prepare('SELECT id FROM categories WHERE id = ?');
            $c->execute([$categoryId]);
            if (!$c->fetch()) {
                json_error('Категория не найдена', 400);
            }
        }

        $stmtCur = $pdo->prepare(
            'SELECT category_id, slug, sku, stock_quantity, name, description, full_description, price, original_price, discount,
                    image, color, brand, specs_json, is_active FROM products WHERE id = ?'
        );
        $stmtCur->execute([$id]);
        $p = $stmtCur->fetch(PDO::FETCH_ASSOC);
        if (!$p) {
            json_error('Товар не найден', 404);
        }

        $name = array_key_exists('name', $body) ? trim((string) $body['name']) : $p['name'];
        if ($name === '') {
            json_error('Укажите название', 400);
        }
        if (array_key_exists('price', $body) && (!is_numeric($body['price']) || (float) $body['price'] < 0)) {
            json_error('Укажите корректную цену', 400);
        }

        $skuFinal = array_key_exists('sku', $body)
            ? (trim((string) $body['sku']) !== '' ? trim((string) $body['sku']) : null)
            : ($p['sku'] ?? null);
        if ($skuFinal !== null) {
            $chk = $pdo->prepare('SELECT id FROM products WHERE sku = ? AND id != ?');
            $chk->execute([$skuFinal, $id]);
            if ($chk->fetch()) {
                json_error('Артикул (SKU) уже занят', 409);
            }
        }
        if (array_key_exists('stockQuantity', $body) || array_key_exists('stock_quantity', $body)) {
            $sv = $body['stockQuantity'] ?? $body['stock_quantity'];
            $stockFinal = ($sv === null || $sv === '') ? null : (int) $sv;
            if ($stockFinal !== null && $stockFinal < 0) {
                json_error('Остаток не может быть отрицательным', 400);
            }
        } else {
            $stockFinal = isset($p['stock_quantity']) && $p['stock_quantity'] !== null ? (int) $p['stock_quantity'] : null;
        }
        if (array_key_exists('specs', $body)) {
            $specs = admin_read_specs_from_body($body);
        } else {
            $rawSpecs = $p['specs_json'] ?? null;
            $specs = is_string($rawSpecs) ? json_decode($rawSpecs, true) : null;
        }
        if (!is_array($specs)) {
            $specs = null;
        }
        $specsJson = $specs !== null ? json_encode($specs, JSON_UNESCAPED_UNICODE) : null;

        $catIdFinal = $categoryId ?? (int) $p['category_id'];
        $upd = $pdo->prepare(
            'UPDATE products SET
                category_id = ?, slug = ?, sku = ?, name = ?, description = ?, full_description = ?,
                price = ?, original_price = ?, discount = ?, image = ?, color = ?, brand = ?, specs_json = ?, stock_quantity = ?, is_active = ?
             WHERE id = ?'
        );
        $upd->execute([
            $catIdFinal,
            $newSlug,
            $skuFinal,
            $name,
            array_key_exists('description', $body) ? ($body['description'] !== null ? (string) $body['description'] : null) : $p['description'],
            array_key_exists('fullDescription', $body)
                ? ($body['fullDescription'] !== null ? (string) $body['fullDescription'] : null)
                : (array_key_exists('full_description', $body)
                    ? ($body['full_description'] !== null ? (string) $body['full_description'] : null)
                    : $p['full_description']),
            array_key_exists('price', $body) ? (float) $body['price'] : (float) $p['price'],
            array_key_exists('originalPrice', $body)
                ? ($body['originalPrice'] !== null ? (float) $body['originalPrice'] : null)
                : (array_key_exists('original_price', $body)
                    ? ($body['original_price'] !== null ? (float) $body['original_price'] : null)
                    : $p['original_price']),
            array_key_exists('discount', $body)
                ? ($body['discount'] !== null ? (int) $body['discount'] : null) : $p['discount'],
            array_key_exists('image', $body) ? ($body['image'] !== null ? (string) $body['image'] : null) : $p['image'],
            array_key_exists('color', $body) ? ($body['color'] !== null ? (string) $body['color'] : null) : $p['color'],
            array_key_exists('brand', $body) ? ($body['brand'] !== null ? (string) $body['brand'] : null) : $p['brand'],
            $specsJson,
            $stockFinal,
            array_key_exists('isActive', $body) ? ((bool) $body['isActive'] ? 1 : 0)
                : (array_key_exists('is_active', $body) ? ((bool) $body['is_active'] ? 1 : 0) : (int) $p['is_active']),
            $id,
        ]);

        json_response(admin_format_product(admin_fetch_product_row($id) ?: []));
    }

    if ($method === 'DELETE' && preg_match('#^/admin/products/(\d+)$#', $path, $m)) {
        require_catalog_manager();
        $id = (int) $m[1];
        $pdo = db();
        $stmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_error('Товар не найден', 404);
        }
        json_response(['ok' => true]);
    }

    return false;
}

function admin_upload_error_message(int $code): string {
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Файл слишком большой',
        UPLOAD_ERR_PARTIAL => 'Файл загрузился не полностью',
        UPLOAD_ERR_NO_FILE => 'Файл не выбран',
        UPLOAD_ERR_NO_TMP_DIR => 'На сервере отсутствует временная папка',
        UPLOAD_ERR_CANT_WRITE => 'Сервер не смог записать файл',
        UPLOAD_ERR_EXTENSION => 'Загрузка остановлена расширением PHP',
        default => 'Не удалось загрузить файл',
    };
}

function admin_upload_extension(string $mime, string $originalName): ?string {
    $mime = strtolower(trim($mime));
    $ext = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
    $mimeMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    if (isset($mimeMap[$mime])) {
        return $mimeMap[$mime];
    }
    return in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)
        ? ($ext === 'jpeg' ? 'jpg' : $ext)
        : null;
}

function admin_upload_basename(string $name): string {
    $clean = preg_replace('/[^a-z0-9]+/i', '-', trim($name));
    $clean = is_string($clean) ? trim($clean, '-') : '';
    return strtolower(substr($clean, 0, 60));
}
