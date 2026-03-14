<?php
/**
 * HTTP Response helper — JSON output, input parsing, pagination
 */

declare(strict_types=1);

class Response
{
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status = 400): never
    {
        self::json(['error' => $message], $status);
    }

    public static function success(string $message = 'Success', array $extra = []): never
    {
        self::json(array_merge(['success' => true, 'message' => $message], $extra));
    }
}

// ── Input helpers ──────────────────────────────────────────────────────────────

function getBody(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;

    $raw = file_get_contents('php://input');

    // JSON body
    if (!empty($raw)) {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $cache = $json;
            return $cache;
        }
    }

    // Form body
    $cache = array_merge($_POST, []);
    return $cache;
}

function input(string $key, mixed $default = null): mixed
{
    return getBody()[$key] ?? $_GET[$key] ?? $default;
}

function qs(string $key, mixed $default = null): mixed
{
    return $_GET[$key] ?? $default;
}

function method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function paginate(int $defaultLimit = 20, int $maxLimit = 100): array
{
    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = min($maxLimit, max(1, (int)($_GET['limit'] ?? $defaultLimit)));
    return [
        'page'   => $page,
        'limit'  => $limit,
        'offset' => ($page - 1) * $limit,
    ];
}

function currentIp(): string
{
    // Prefer forwarded IP (behind proxy/CDN) but sanitize it
    $ip = $_SERVER['HTTP_X_REAL_IP']
       ?? $_SERVER['HTTP_CF_CONNECTING_IP']       // Cloudflare
       ?? $_SERVER['HTTP_X_FORWARDED_FOR']
       ?? $_SERVER['REMOTE_ADDR']
       ?? '0.0.0.0';

    // X-Forwarded-For may be a comma-separated list — take the first
    if (str_contains($ip, ',')) {
        $ip = trim(explode(',', $ip)[0]);
    }

    // Validate
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

function xssClean(mixed $value): mixed
{
    if (is_array($value)) return array_map('xssClean', $value);
    if (!is_string($value)) return $value;
    return htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function callProviderApi(string $baseUrl, string $apiKey, array $params, int $timeout = 60): ?array
{
    if (!$baseUrl || !$apiKey) return null;
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => rtrim($baseUrl, '/'),
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query(array_merge(['key' => $apiKey], $params)),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'SMM-Panel/' . SMM_VERSION,
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err || !$raw) return null;
    $json = json_decode($raw, true);
    return is_array($json) ? $json : null;
}
