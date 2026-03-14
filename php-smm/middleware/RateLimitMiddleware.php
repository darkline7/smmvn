<?php
/**
 * Rate Limiting Middleware — Database-backed (no Redis needed)
 * Prevents brute force, DDoS, API abuse
 */

declare(strict_types=1);

class RateLimitMiddleware
{
    // ── Configuration presets ──────────────────────────────────────────────────
    private const PRESETS = [
        'login'    => ['requests' => 5,   'window' => 300,  'block' => 900],   // 5/5min, block 15min
        'register' => ['requests' => 3,   'window' => 3600, 'block' => 3600],  // 3/hour
        'api'      => ['requests' => 300, 'window' => 60,   'block' => 60],    // 300/min
        'order'    => ['requests' => 30,  'window' => 60,   'block' => 60],    // 30 orders/min
        'global'   => ['requests' => 500, 'window' => 60,   'block' => 30],    // global per IP
        'deposit'  => ['requests' => 10,  'window' => 3600, 'block' => 3600],  // 10 deposits/hour
    ];

    // ── Check + increment counter ──────────────────────────────────────────────
    public static function check(string $preset = 'global', ?string $identifier = null): void
    {
        $config = self::PRESETS[$preset] ?? self::PRESETS['global'];
        $ip     = $identifier ?? currentIp();
        $key    = "rl:{$preset}:{$ip}";
        $now    = time();

        try {
            $db = Database::getInstance();

            // Clean up expired records (housekeeping 1% of requests)
            if (mt_rand(1, 100) === 1) {
                $db->prepare("DELETE FROM rate_limits WHERE expires_at < NOW()")->execute();
            }

            // Check if blocked
            $stmt = $db->prepare(
                "SELECT blocked_until FROM rate_limits WHERE `key` = ? LIMIT 1"
            );
            $stmt->execute([$key]);
            $row = $stmt->fetch();

            if ($row && $row['blocked_until'] && strtotime($row['blocked_until']) > $now) {
                $retryAfter = strtotime($row['blocked_until']) - $now;
                header("Retry-After: $retryAfter");
                header("X-RateLimit-Limit: {$config['requests']}");
                header("X-RateLimit-Remaining: 0");
                Response::error('Too many requests. Please try again later.', 429);
            }

            // Upsert counter
            $db->prepare(
                "INSERT INTO rate_limits (`key`, ip, preset, count, window_start, expires_at)
                 VALUES (?, ?, ?, 1, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))
                 ON DUPLICATE KEY UPDATE
                    count       = IF(window_start < DATE_SUB(NOW(), INTERVAL ? SECOND), 1, count + 1),
                    window_start= IF(window_start < DATE_SUB(NOW(), INTERVAL ? SECOND), NOW(), window_start),
                    expires_at  = DATE_ADD(NOW(), INTERVAL ? SECOND),
                    blocked_until = IF(
                        count >= ? AND window_start >= DATE_SUB(NOW(), INTERVAL ? SECOND),
                        DATE_ADD(NOW(), INTERVAL ? SECOND),
                        NULL
                    )"
            )->execute([
                $key, $ip, $preset,
                $config['window'],           // initial expires_at
                $config['window'],           // reset check for window_start
                $config['window'],           // reset check for window_start (2nd)
                $config['window'],           // expires_at on update
                $config['requests'],         // block threshold
                $config['window'],           // block check window
                $config['block'],            // block duration
            ]);

            // Get current count
            $stmt = $db->prepare("SELECT count FROM rate_limits WHERE `key` = ? LIMIT 1");
            $stmt->execute([$key]);
            $current = (int)($stmt->fetchColumn() ?: 0);

            $remaining = max(0, $config['requests'] - $current);
            header("X-RateLimit-Limit: {$config['requests']}");
            header("X-RateLimit-Remaining: $remaining");
            header("X-RateLimit-Window: {$config['window']}");

            if ($current > $config['requests']) {
                Response::error('Too many requests. Please try again later.', 429);
            }

        } catch (Throwable $e) {
            // Don't fail the request if rate limiting table doesn't exist
            error_log('[SMM-RateLimit] ' . $e->getMessage());
        }
    }

    // ── Login-specific brute force with account lockout ────────────────────────
    public static function checkLogin(string $email): void
    {
        // Check both IP-based and account-based
        self::check('login');

        // Account-level lockout
        $key = 'login:email:' . md5(strtolower($email));
        try {
            $db   = Database::getInstance();
            $stmt = $db->prepare("SELECT count, blocked_until FROM rate_limits WHERE `key` = ? LIMIT 1");
            $stmt->execute([$key]);
            $row = $stmt->fetch();

            if ($row && $row['blocked_until'] && strtotime($row['blocked_until']) > time()) {
                Response::error('Account temporarily locked due to too many failed attempts. Try again in 15 minutes.', 429);
            }
        } catch (Throwable) {}
    }

    public static function recordFailedLogin(string $email): void
    {
        $key = 'login:email:' . md5(strtolower($email));
        try {
            $db = Database::getInstance();
            $db->prepare(
                "INSERT INTO rate_limits (`key`, ip, preset, count, window_start, expires_at)
                 VALUES (?, ?, 'login', 1, NOW(), DATE_ADD(NOW(), INTERVAL 900 SECOND))
                 ON DUPLICATE KEY UPDATE
                    count        = count + 1,
                    expires_at   = DATE_ADD(NOW(), INTERVAL 900 SECOND),
                    blocked_until = IF(count >= 4, DATE_ADD(NOW(), INTERVAL 900 SECOND), NULL)"
            )->execute([$key, currentIp()]);
        } catch (Throwable) {}
    }

    public static function clearLoginAttempts(string $email): void
    {
        $key = 'login:email:' . md5(strtolower($email));
        try {
            Database::query("DELETE FROM rate_limits WHERE `key` = ?", [$key]);
        } catch (Throwable) {}
    }
}
