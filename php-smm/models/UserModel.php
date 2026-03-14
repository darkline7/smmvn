<?php
/**
 * User Model — all user DB operations
 * IDOR-safe: always filter by userId; never trust client-provided IDs alone
 */

declare(strict_types=1);

class UserModel
{
    public static function findById(int $id): ?array
    {
        $stmt = Database::query(
            'SELECT id, email, username, role, balance, banned, api_key, referral_code,
                    google_id, created_at, updated_at
             FROM users WHERE id = ? LIMIT 1',
            [$id]
        );
        return $stmt->fetch() ?: null;
    }

    public static function findByEmail(string $email): ?array
    {
        $stmt = Database::query(
            'SELECT * FROM users WHERE email = ? LIMIT 1',
            [strtolower(trim($email))]
        );
        return $stmt->fetch() ?: null;
    }

    public static function findByApiKey(string $apiKey): ?array
    {
        $stmt = Database::query(
            'SELECT id, email, username, role, balance, banned FROM users WHERE api_key = ? LIMIT 1',
            [$apiKey]
        );
        return $stmt->fetch() ?: null;
    }

    public static function create(string $email, string $passwordHash, string $username = '', string $role = 'user'): int
    {
        $apiKey       = self::generateApiKey();
        $referralCode = self::generateReferralCode();
        $username     = $username ?: self::generateUsername($email);

        return Database::insert(
            'INSERT INTO users (email, username, password_hash, role, api_key, referral_code)
             VALUES (?, ?, ?, ?, ?, ?)',
            [strtolower(trim($email)), $username, $passwordHash, $role, $apiKey, $referralCode]
        );
    }

    public static function updatePassword(int $userId, string $hash): bool
    {
        return Database::query(
            'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
            [$hash, $userId]
        )->rowCount() > 0;
    }

    public static function updateBalance(int $userId, float $newBalance): void
    {
        Database::query(
            'UPDATE users SET balance = ?, updated_at = NOW() WHERE id = ?',
            [number_format($newBalance, 4, '.', ''), $userId]
        );
    }

    public static function deductBalance(int $userId, float $amount): float
    {
        return Database::transaction(function (PDO $db) use ($userId, $amount): float {
            $stmt = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
            $stmt->execute([$userId]);
            $user = $stmt->fetch();

            if (!$user) throw new RuntimeException('User not found');

            $balance = (float)$user['balance'];
            if ($balance < $amount) throw new RuntimeException('Insufficient balance');

            $newBalance = round($balance - $amount, 4);
            $db->prepare('UPDATE users SET balance = ?, updated_at = NOW() WHERE id = ?')
               ->execute([number_format($newBalance, 4, '.', ''), $userId]);

            return $newBalance;
        });
    }

    public static function creditBalance(int $userId, float $amount): float
    {
        return Database::transaction(function (PDO $db) use ($userId, $amount): float {
            $stmt = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            if (!$user) throw new RuntimeException('User not found');

            $newBalance = round((float)$user['balance'] + $amount, 4);
            $db->prepare('UPDATE users SET balance = ?, updated_at = NOW() WHERE id = ?')
               ->execute([number_format($newBalance, 4, '.', ''), $userId]);

            return $newBalance;
        });
    }

    public static function regenerateApiKey(int $userId): string
    {
        $key = self::generateApiKey();
        Database::query('UPDATE users SET api_key = ? WHERE id = ?', [$key, $userId]);
        return $key;
    }

    public static function logTransaction(
        int    $userId,
        string $type,
        float  $amount,
        float  $balanceAfter,
        string $description = '',
        ?int   $referenceId = null
    ): void {
        Database::query(
            'INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$userId, $type, number_format($amount, 4, '.', ''), number_format($balanceAfter, 4, '.', ''), $description, $referenceId]
        );
    }

    public static function notify(int $userId, string $type, string $title, string $message): void
    {
        Database::query(
            'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
            [$userId, $type, $title, $message]
        );
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        if (str_starts_with($hash, '$2')) {
            // bcrypt
            return password_verify($password, $hash);
        }
        // Legacy SHA-256 with salt (auto-upgrade on login)
        $salt = env('SECRET_SALT', 'smm-panel-salt-2024');
        return hash_equals($hash, hash('sha256', $password . $salt));
    }

    private static function generateApiKey(): string
    {
        return bin2hex(random_bytes(20)); // 40-char hex
    }

    private static function generateReferralCode(): string
    {
        return strtoupper(bin2hex(random_bytes(4))); // 8-char
    }

    private static function generateUsername(string $email): string
    {
        $base = preg_replace('/[^a-z0-9]/', '', strtolower(explode('@', $email)[0])) ?: 'user';
        return substr($base, 0, 16) . mt_rand(100, 9999);
    }
}
