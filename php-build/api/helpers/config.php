<?php
/**
 * SMM Panel Pro — Cấu hình & kết nối DB
 * Đọc .env từ thư mục cha của public_html
 */

define('SMM_VERSION', '2.0-php');

// ── Load .env ──────────────────────────────────────────────────────────────────
function loadEnv(): void {
    // Thử tìm .env ở nhiều vị trí
    $locations = [
        dirname(__DIR__, 3) . '/.env',   // ~/smm-panel/.env (nếu api/ ở public_html/api/)
        dirname(__DIR__, 2) . '/.env',   // một cấp trên api/
        dirname(__DIR__, 1) . '/.env',   // cùng cấp helpers/
        __DIR__ . '/../../../.env',
    ];
    foreach ($locations as $path) {
        if (file_exists($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (str_starts_with($line, '#') || !str_contains($line, '=')) continue;
                [$k, $v] = explode('=', $line, 2);
                $k = trim($k);
                $v = trim($v, " \t\"'");
                if (!array_key_exists($k, $_ENV) && !array_key_exists($k, $_SERVER)) {
                    $_ENV[$k] = $v;
                    putenv("$k=$v");
                }
            }
            break;
        }
    }
}

function env(string $key, string $default = ''): string {
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

// ── Database (PDO PostgreSQL) ──────────────────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = env('DATABASE_URL');
    if (!$dsn) {
        http_response_code(503);
        die(json_encode(['error' => 'DATABASE_URL not configured']));
    }

    // Parse postgresql://user:pass@host:port/dbname?sslmode=require
    $parsed = parse_url($dsn);
    $host   = $parsed['host'] ?? 'localhost';
    $port   = $parsed['port'] ?? 5432;
    $dbname = ltrim($parsed['path'] ?? '/smm', '/');
    $user   = $parsed['user'] ?? '';
    $pass   = $parsed['pass'] ?? '';
    $query  = $parsed['query'] ?? '';

    $sslmode = 'require';
    parse_str($query, $qp);
    if (isset($qp['sslmode'])) $sslmode = $qp['sslmode'];

    $dsn_pdo = "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=$sslmode";

    try {
        $pdo = new PDO($dsn_pdo, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT            => 10,
        ]);
    } catch (PDOException $e) {
        http_response_code(503);
        error_log('[SMM] DB connect error: ' . $e->getMessage());
        die(json_encode(['error' => 'Database connection failed']));
    }

    return $pdo;
}

// ── Settings cache ─────────────────────────────────────────────────────────────
function getSettings(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    try {
        $db = getDB();
        $rows = $db->query('SELECT key, value FROM site_settings')->fetchAll();
        $cache = [];
        foreach ($rows as $r) $cache[$r['key']] = $r['value'] ?? '';
    } catch (Throwable) {
        $cache = [];
    }
    return $cache;
}

function setting(string $key, string $default = ''): string {
    return getSettings()[$key] ?? $default;
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────
loadEnv();
