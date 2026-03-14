<?php
/**
 * JWT HS256 — session cookies
 * Stateless, httpOnly, SameSite=Lax, 30-day TTL
 */

declare(strict_types=1);

class JWT
{
    private const ALGO     = 'sha256';
    private const COOKIE   = 'smm_session';
    private const TTL      = 86400 * 30;  // 30 days

    // ── Encode ────────────────────────────────────────────────────────────────
    public static function encode(array $payload): string
    {
        $header  = self::b64(['alg' => 'HS256', 'typ' => 'JWT']);
        $payload = self::b64($payload);
        $sig     = self::b64(hash_hmac(self::ALGO, "$header.$payload", self::secret(), true));
        return "$header.$payload.$sig";
    }

    // ── Decode + verify ────────────────────────────────────────────────────────
    public static function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $payload, $sig] = $parts;

        $expectedSig = self::b64(hash_hmac(self::ALGO, "$header.$payload", self::secret(), true));
        if (!hash_equals($expectedSig, $sig)) return null;

        $data = json_decode(self::b64d($payload), true);
        if (!is_array($data)) return null;

        // Check expiry
        if (isset($data['exp']) && $data['exp'] < time()) return null;

        return $data;
    }

    // ── Cookie management ──────────────────────────────────────────────────────
    public static function setSessionCookie(array $payload): void
    {
        $payload['iat'] = time();
        $payload['exp'] = time() + self::TTL;
        $token = self::encode($payload);

        // httpOnly prevents JS access — mitigates XSS session theft
        setcookie(self::COOKIE, $token, [
            'expires'  => time() + self::TTL,
            'path'     => '/',
            'secure'   => isset($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    public static function clearSessionCookie(): void
    {
        setcookie(self::COOKIE, '', ['expires' => time() - 3600, 'path' => '/']);
    }

    public static function getSession(): ?array
    {
        // 1. From cookie
        $token = $_COOKIE[self::COOKIE] ?? null;

        // 2. From Authorization header (for API clients)
        if (!$token) {
            $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            if (str_starts_with($auth, 'Bearer ')) {
                $token = substr($auth, 7);
            }
        }

        if (!$token) return null;
        return self::decode($token);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    private static function secret(): string
    {
        $s = env('JWT_SECRET');
        if (strlen($s) < 32) {
            error_log('[SMM] JWT_SECRET too short or not set — using insecure fallback');
            $s = 'INSECURE-FALLBACK-CHANGE-ME-' . php_uname('n');
        }
        return $s;
    }

    private static function b64(array|string $data): string
    {
        $raw = is_array($data) ? json_encode($data) : $data;
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    private static function b64d(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }
}
