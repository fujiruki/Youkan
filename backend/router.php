<?php
// backend/router.php
// PHP Built-in Server Router for Smart Verification Protocol (SVP)
// Fixes issue where IDs with dots (e.g. item_xxx.yyy) return 404 on Built-in Server.

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 1. Static Files: If file exists, serve it directly.
// This handles css, js, images, etc.
// FIX: Only check for static files on GET/HEAD. 
// PUT/DELETE/POST should always go to index.php to avoid 404s on "file-like" IDs.
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'HEAD') {
    if (file_exists(__DIR__ . $uri) && is_file(__DIR__ . $uri)) {
        return false; // Let PHP serve the file
    }
}

// 2. Prevent directory traversal (Basic check)
if (strpos($uri, '..') !== false) {
    http_response_code(400);
    echo "Bad Request";
    exit;
}

// 3. Everything else -> index.php
// This ensures that even paths specifically looking like files (ending in .xyz)
// are routed to the API controller if the file doesn't exist.
require 'index.php';
