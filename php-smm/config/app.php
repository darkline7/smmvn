<?php
/**
 * Application bootstrap — loads .env, defines helpers, sets error handling
 * SMM Panel Pro — Production Ready
 */

declare(strict_types=1);

define('SMM_VERSION', '2.0-php-mvc');
define('SMM_ROOT',    dirname(__DIR__));
define('SMM_START',   microtime(true));

// ── Error handling ─────────────────────────────────────────────────────────────
error_reporting(E_ALL);
set_error_handler(function (int $errno, string $errstr, string $errfile, int $errline): bool {
    if (!($errno & error_reporting())) return false;
    $msg = "[SMM-PHP] Error $errno: $errstr in $errfile:$errline";
    error_log($msg);
    return true;
});
set_exception_handler(function (Throwable $e): void {
    error_log('[SMM-EXCEPTION] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    echo json_encode(['error' => 'Internal server error']);
    exit;
});

// ── Load .env ──────────────────────────────────────────────────────────────────
function loadEnv(): void
{
    $locations = [
        SMM_ROOT . '/../.env',          // one level above public_html
        SMM_ROOT . '/.env',             // same level as project root
        SMM_ROOT . '/config/.env',
    ];
    foreach ($locations as $path) {
        if (!file_exists($path)) continue;
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
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

function env(string $key, string $default = ''): string
{
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

// ── Settings cache (DB) ────────────────────────────────────────────────────────
function getSettings(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    try {
        $rows  = Database::query('SELECT `key`, `value` FROM site_settings')->fetchAll();
        $cache = [];
        foreach ($rows as $r) $cache[$r['key']] = $r['value'];
    } catch (Throwable) {
        $cache = [];
    }
    return $cache;
}

function setting(string $key, string $default = ''): string
{
    return getSettings()[$key] ?? $default;
}

// ── Boolean env helper ─────────────────────────────────────────────────────────
function envBool(string $key, bool $default = false): bool
{
    $v = env($key);
    if ($v === '') return $default;
    return in_array(strtolower($v), ['true', '1', 'yes', 'on'], true);
}

// ── Is production? ─────────────────────────────────────────────────────────────
function isProd(): bool
{
    return env('APP_ENV', 'production') === 'production';
}
