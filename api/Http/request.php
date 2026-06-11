<?php

function route_path(): string {
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = parse_url($uri, PHP_URL_PATH) ?? '/';
    if (str_starts_with($path, '/api')) {
        $path = substr($path, 4);
        if ($path === '') $path = '/';
    }
    return $path;
}
