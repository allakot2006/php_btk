<?php


$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?? '/';
$path = rawurldecode($path);
if ($path === '' || $path[0] !== '/') {
    $path = '/' . ltrim($path, '/');
}
if (str_contains($path, '..')) {
    http_response_code(400);
    echo '400 Bad Request';
    return true;
}

if (str_starts_with($path, '/api')) {
    require __DIR__ . '/api/index.php';
    return true;
}

$file = __DIR__ . '/public' . $path;
if ($path !== '/' && is_file($file)) {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $types = [
        'css' => 'text/css; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml; charset=utf-8',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'otf' => 'font/otf',
        'eot' => 'application/vnd.ms-fontobject',
        'txt' => 'text/plain; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
    ];

    $type = $types[$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $type);
    header('Content-Length: ' . filesize($file));
    readfile($file);
    return true;
}

if (str_starts_with($path, '/images/')) {
    $aliased = __DIR__ . '/public/images/' . ltrim(substr($path, 8), '/');
    if (is_file($aliased)) {
        $ext = strtolower(pathinfo($aliased, PATHINFO_EXTENSION));
        $types = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml; charset=utf-8',
            'ico' => 'image/x-icon',
        ];
        header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
        header('Content-Length: ' . filesize($aliased));
        readfile($aliased);
        return true;
    }
}

if (str_starts_with($path, '/img/')) {
    $aliased = __DIR__ . '/public/images/' . ltrim(substr($path, 4), '/');
    if (is_file($aliased)) {
        $ext = strtolower(pathinfo($aliased, PATHINFO_EXTENSION));
        $types = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml; charset=utf-8',
            'ico' => 'image/x-icon',
        ];
        header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
        header('Content-Length: ' . filesize($aliased));
        readfile($aliased);
        return true;
    }
}

if ($path === '/' || $path === '') {
    include __DIR__ . '/public/index.html';
    return true;
}

$html = __DIR__ . '/public' . rtrim($path, '/') . '.html';
if (is_file($html)) {
    include $html;
    return true;
}

http_response_code(404);
echo "404 Not Found";
return true;

