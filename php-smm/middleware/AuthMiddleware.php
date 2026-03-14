<?php
/**
 * Authentication middleware
 * Reads JWT session cookie or Bearer token
 */

declare(strict_types=1);

class AuthMiddleware
{
    // ── Require authenticated user ─────────────────────────────────────────────
    public static function requireAuth(): array
    {
        $session = JWT::getSession();
        if (!$session || empty($session['userId'])) {
            Response::error('Authentication required', 401);
        }

        // Check user still exists + not banned — refresh from DB every request
        $user = UserModel::findById((int)$session['userId']);
        if (!$user) {
            JWT::clearSessionCookie();
            Response::error('Account not found', 401);
        }
        if ($user['banned']) {
            JWT::clearSessionCookie();
            Response::error('Your account has been suspended', 403);
        }

        return $session;
    }

    // ── Require admin ──────────────────────────────────────────────────────────
    public static function requireAdmin(): array
    {
        $session = self::requireAuth();
        if (($session['role'] ?? '') !== 'admin') {
            Response::error('Administrator access required', 403);
        }
        return $session;
    }

    // ── API key auth (for /api/v2 endpoint) ────────────────────────────────────
    public static function requireApiKey(): array
    {
        $apiKey = $_SERVER['HTTP_X_API_KEY']
               ?? getBody()['key']
               ?? qs('key')
               ?? null;

        if (!$apiKey) {
            Response::error('API key required', 401);
        }

        // Sanitize — API keys should be alphanumeric
        $apiKey = preg_replace('/[^a-zA-Z0-9]/', '', $apiKey);
        if (strlen($apiKey) < 16) {
            Response::error('Invalid API key', 401);
        }

        $user = UserModel::findByApiKey($apiKey);
        if (!$user) {
            Response::error('Invalid API key', 401);
        }
        if ($user['banned']) {
            Response::error('Account suspended', 403);
        }

        return ['userId' => $user['id'], 'role' => $user['role']];
    }
}
