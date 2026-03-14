<?php
/**
 * Security Middleware
 * Sets security headers, blocks suspicious requests, CSRF protection
 */

declare(strict_types=1);

class SecurityMiddleware
{
    // ── Security headers ───────────────────────────────────────────────────────
    public static function setHeaders(): void
    {
        // Prevent MIME sniffing
        header('X-Content-Type-Options: nosniff');
        // Clickjacking protection
        header('X-Frame-Options: SAMEORIGIN');
        // XSS filter (legacy browsers)
        header('X-XSS-Protection: 1; mode=block');
        // HTTPS enforcement (1 year, include subdomains)
        if (isset($_SERVER['HTTPS'])) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
        }
        // Referrer Policy
        header('Referrer-Policy: strict-origin-when-cross-origin');
        // Permissions Policy — restrict dangerous APIs
        header('Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()');
        // Content Security Policy — API-only endpoint, no HTML served by PHP
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        // Remove PHP version fingerprint
        header_remove('X-Powered-By');
        // Remove server header if possible
        @header('Server: ');
    }

    // ── Block obviously malicious requests ────────────────────────────────────
    public static function filterRequest(): void
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        // Block path traversal
        if (str_contains($uri, '..') || str_contains($uri, '%2e%2e')) {
            Response::error('Forbidden', 403);
        }

        // Block null byte injection
        if (str_contains($uri, "\0") || str_contains($uri, '%00')) {
            Response::error('Forbidden', 403);
        }

        // Block common scanner patterns
        $blocked = [
            '.env', '.git', 'wp-login', 'wp-admin', 'xmlrpc', 'phpmyadmin',
            'phpinfo', 'eval(', 'base64_decode', 'system(', 'exec(',
        ];
        $uriLower = strtolower($uri);
        foreach ($blocked as $pattern) {
            if (str_contains($uriLower, $pattern)) {
                Response::error('Forbidden', 403);
            }
        }

        // Block oversized Content-Length (prevent memory exhaustion)
        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > 10 * 1024 * 1024) {  // 10MB
            Response::error('Request too large', 413);
        }
    }

    // ── CORS ──────────────────────────────────────────────────────────────────
    public static function handleCors(): void
    {
        $siteUrl = env('SITE_URL') ?: setting('site_url') ?: '';
        $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (!$origin) return;

        // Allow same origin always
        $allowed = false;
        if ($siteUrl) {
            foreach (explode(',', $siteUrl) as $allowed_url) {
                $allowed_url = trim($allowed_url);
                if ($allowed_url && parse_url($allowed_url, PHP_URL_HOST) === parse_url($origin, PHP_URL_HOST)) {
                    $allowed = true;
                    break;
                }
            }
        } else {
            // No SITE_URL configured — allow all (dev mode)
            $allowed = true;
        }

        if ($allowed) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key, X-CSRF-Token');
            header('Access-Control-Max-Age: 86400');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    // ── CSRF token generation (for cookie sessions) ────────────────────────────
    public static function generateCsrfToken(): string
    {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    public static function validateCsrf(): void
    {
        // CSRF is only needed for state-changing cookie-based requests
        // JWT Bearer token requests are exempt (stateless)
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (str_starts_with($auth, 'Bearer ')) return;

        $m = method();
        if (!in_array($m, ['POST', 'PATCH', 'DELETE'], true)) return;

        // If using cookie auth, validate CSRF
        if (isset($_COOKIE['smm_session'])) {
            $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
            $csrfBody   = getBody()['_csrf'] ?? '';
            $csrfToken  = $csrfHeader ?: $csrfBody;
            $expected   = $_SESSION['csrf_token'] ?? '';

            // Only enforce if session has CSRF token set
            if ($expected && !hash_equals($expected, $csrfToken)) {
                Response::error('Invalid CSRF token', 403);
            }
        }
    }

    // ── Verify Cloudflare Turnstile ────────────────────────────────────────────
    public static function verifyTurnstile(string $token): bool
    {
        $secret = env('TURNSTILE_SECRET') ?: setting('turnstile_secret');
        if (!$secret) return true;  // skip if not configured
        if (!$token) return false;

        $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query(['secret' => $secret, 'response' => $token, 'remoteip' => currentIp()]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $raw  = curl_exec($ch);
        curl_close($ch);
        $resp = $raw ? json_decode($raw, true) : null;
        return ($resp['success'] ?? false) === true;
    }
}
