<?php
/**
 * HTTP response helpers
 */

function jsonOut(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonError(string $message, int $code = 400): never {
    jsonOut(['error' => $message], $code);
}

function getBody(): array {
    static $body = null;
    if ($body !== null) return $body;
    $raw = file_get_contents('php://input');
    $ct  = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($ct, 'application/json')) {
        $body = json_decode($raw, true) ?? [];
    } elseif (str_contains($ct, 'application/x-www-form-urlencoded')) {
        parse_str($raw, $body);
    } else {
        $body = $_POST ?: (json_decode($raw, true) ?? []);
    }
    return $body;
}

function input(string $key, mixed $default = null): mixed {
    return getBody()[$key] ?? $_GET[$key] ?? $default;
}

function queryParam(string $key, mixed $default = null): mixed {
    return $_GET[$key] ?? $default;
}

function method(): string {
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function paginate(): array {
    $page  = max(1, (int)queryParam('page', 1));
    $limit = min(100, max(1, (int)queryParam('limit', 20)));
    return ['page' => $page, 'limit' => $limit, 'offset' => ($page - 1) * $limit];
}

// Call external API
function callProviderApi(string $baseUrl, string $apiKey, array $params, int $timeoutSec = 60): ?array {
    $params['key'] = $apiKey;
    $body = http_build_query($params);
    $origin = preg_replace('/\/api.*/', '', $baseUrl);
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => implode("\r\n", [
                'Content-Type: application/x-www-form-urlencoded',
                'Content-Length: ' . strlen($body),
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept: application/json, text/plain, */*',
                'Accept-Language: en-US,en;q=0.9',
                'Cache-Control: no-cache',
                'Origin: ' . $origin,
                'Referer: ' . $origin . '/',
            ]),
            'content' => $body,
            'timeout' => $timeoutSec,
            'ignore_errors' => true,
        ],
        'ssl' => ['verify_peer' => true],
    ]);
    $resp = @file_get_contents($baseUrl, false, $ctx);
    if ($resp === false) return null;
    return json_decode($resp, true);
}
