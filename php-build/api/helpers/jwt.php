<?php
/**
 * JWT HS256 — pure PHP, không cần thư viện ngoài
 */

function jwtSecret(): string {
    $s = env('JWT_SECRET');
    if (!$s) {
        error_log('[SMM] JWT_SECRET not set!');
        $s = 'dev-insecure-secret';
    }
    return $s;
}

function jwtEncode(array $payload): string {
    $header  = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url_encode(json_encode($payload));
    $sig     = base64url_encode(hash_hmac('sha256', "$header.$payload", jwtSecret(), true));
    return "$header.$payload.$sig";
}

function jwtDecode(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;

    $expected = base64url_encode(hash_hmac('sha256', "$header.$payload", jwtSecret(), true));
    if (!hash_equals($expected, $sig)) return null;

    $data = json_decode(base64url_decode($payload), true);
    if (!is_array($data)) return null;

    // Check expiry
    if (isset($data['exp']) && $data['exp'] < time()) return null;

    return $data;
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

// 30 days
const JWT_TTL = 30 * 24 * 3600;
const COOKIE_NAME = 'smm_session';

function setSessionCookie(array $payload): void {
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_TTL;
    $token = jwtEncode($payload);
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    setcookie(COOKIE_NAME, $token, [
        'expires'  => time() + JWT_TTL,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => $secure,
    ]);
}

function clearSessionCookie(): void {
    setcookie(COOKIE_NAME, '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
}

function getSession(): ?array {
    $token = $_COOKIE[COOKIE_NAME] ?? '';
    if (!$token) return null;
    return jwtDecode($token);
}
