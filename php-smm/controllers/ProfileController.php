<?php
/**
 * Profile Controller
 */

declare(strict_types=1);

class ProfileController
{
    // ── GET /api/profile ──────────────────────────────────────────────────────
    public static function show(): void
    {
        $session = AuthMiddleware::requireAuth();
        $user    = UserModel::findById((int)$session['userId']);
        if (!$user) Response::error('User not found', 404);
        unset($user['password_hash'], $user['google_id']);
        Response::json($user);
    }

    // ── PATCH /api/profile ────────────────────────────────────────────────────
    public static function update(): void
    {
        $session = AuthMiddleware::requireAuth();
        $body    = getBody();
        $sets    = ['updated_at = NOW()']; $params = [];

        if (isset($body['username'])) {
            $v = Validator::make($body)->string('username', 3, 30);
            $v->abortIfFails();
            $sets[]   = 'username = ?';
            $params[] = $v->get('username');
        }

        if (empty($sets[1])) Response::error('Nothing to update', 400);

        $params[] = $session['userId'];
        Database::query('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);

        $user = UserModel::findById((int)$session['userId']);
        unset($user['password_hash'], $user['google_id']);
        Response::json($user);
    }

    // ── POST /api/profile/regenerate-key ─────────────────────────────────────
    public static function regenerateApiKey(): void
    {
        $session = AuthMiddleware::requireAuth();
        $newKey  = UserModel::regenerateApiKey((int)$session['userId']);
        Response::json(['apiKey' => $newKey]);
    }

    // ── GET /api/profile/api-key ──────────────────────────────────────────────
    public static function getApiKey(): void
    {
        $session = AuthMiddleware::requireAuth();
        $user    = Database::query('SELECT api_key FROM users WHERE id = ? LIMIT 1', [$session['userId']])->fetch();
        Response::json(['apiKey' => $user['api_key'] ?? null]);
    }

    // ── GET /api/notifications ────────────────────────────────────────────────
    public static function notifications(): void
    {
        $session = AuthMiddleware::requireAuth();
        $p       = paginate();

        $rows = Database::query(
            'SELECT id, type, title, message, `read`, created_at
             FROM notifications WHERE user_id = ?
             ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [$session['userId'], $p['limit'], $p['offset']]
        )->fetchAll();

        Response::json(['notifications' => $rows]);
    }

    // ── POST /api/notifications/read-all ─────────────────────────────────────
    public static function markAllRead(): void
    {
        $session = AuthMiddleware::requireAuth();
        Database::query('UPDATE notifications SET `read` = 1 WHERE user_id = ?', [$session['userId']]);
        Response::success('All notifications marked as read');
    }

    // ── GET /api/referrals ────────────────────────────────────────────────────
    public static function referrals(): void
    {
        $session = AuthMiddleware::requireAuth();
        $rows    = Database::query(
            'SELECT r.id, r.referred_id, r.bonus_amount, r.created_at,
                    u.username AS referred_username
             FROM referrals r
             LEFT JOIN users u ON u.id = r.referred_id
             WHERE r.referrer_id = ?
             ORDER BY r.created_at DESC',
            [$session['userId']]
        )->fetchAll();

        $total = (float)Database::query(
            'SELECT COALESCE(SUM(bonus_amount), 0) FROM referrals WHERE referrer_id = ?',
            [$session['userId']]
        )->fetchColumn();

        Response::json(['referrals' => $rows, 'totalBonus' => $total]);
    }
}
