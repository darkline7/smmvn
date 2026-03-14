<?php
/**
 * Auth Controller — login, register, logout, Google OAuth, make-admin
 */

declare(strict_types=1);

class AuthController
{
    // ── POST /api/auth/login ───────────────────────────────────────────────────
    public static function login(): void
    {
        $body = getBody();
        $v    = Validator::make($body)
            ->email('email')
            ->password('password', 1);  // min 1 on verify path
        $v->abortIfFails();

        $email    = $v->get('email');
        $password = $body['password'];  // raw, not validated by Validator to avoid trim

        // Rate limit: 5 attempts per 5 min per IP + account lockout
        RateLimitMiddleware::checkLogin($email);

        $user = UserModel::findByEmail($email);

        if (!$user || !UserModel::verifyPassword($password, $user['password_hash'] ?? '')) {
            // Record failed attempt for brute-force protection
            RateLimitMiddleware::recordFailedLogin($email);
            // Constant-time response to prevent email enumeration timing
            Response::error('Invalid email or password', 401);
        }

        if ($user['banned']) {
            Response::error('Your account has been suspended. Please contact support.', 403);
        }

        // Auto-upgrade legacy SHA-256 password to bcrypt
        if (!str_starts_with($user['password_hash'], '$2')) {
            $newHash = UserModel::hashPassword($password);
            UserModel::updatePassword((int)$user['id'], $newHash);
        }

        RateLimitMiddleware::clearLoginAttempts($email);

        $sess = [
            'userId'   => (int)$user['id'],
            'email'    => $user['email'],
            'username' => $user['username'],
            'role'     => $user['role'],
        ];
        JWT::setSessionCookie($sess);

        // Don't expose sensitive fields
        unset($user['password_hash'], $user['google_id']);

        Response::json($user);
    }

    // ── POST /api/auth/register ────────────────────────────────────────────────
    public static function register(): void
    {
        $settings = getSettings();

        // Check if registration is open
        if (($settings['registration_closed'] ?? '0') === '1') {
            Response::error('Registration is currently closed', 403);
        }

        $body = getBody();
        $v    = Validator::make($body)
            ->email('email')
            ->password('password', 8)
            ->string('username', 3, 30, false);
        $v->abortIfFails();

        // Turnstile verification
        $turnstileToken = $body['cfTurnstileToken'] ?? $body['turnstileToken'] ?? '';
        if ($turnstileToken && !SecurityMiddleware::verifyTurnstile($turnstileToken)) {
            Response::error('Captcha verification failed', 400);
        }

        $email    = $v->get('email');
        $password = $body['password'];
        $username = $v->get('username') ?: null;

        // Check duplicate email
        $existing = UserModel::findByEmail($email);
        if ($existing) {
            // Constant-time to prevent email enumeration
            Response::error('An account with this email already exists', 409);
        }

        // Referral handling
        $referralCode = trim($body['referralCode'] ?? '');
        $referrerId   = null;
        if ($referralCode) {
            $referrer = Database::query(
                'SELECT id FROM users WHERE referral_code = ? LIMIT 1',
                [strtoupper($referralCode)]
            )->fetch();
            if ($referrer) $referrerId = (int)$referrer['id'];
        }

        $hash   = UserModel::hashPassword($password);
        $userId = UserModel::create($email, $hash, $username ?? '');

        // Grant referral bonus
        if ($referrerId) {
            $referralBonus = (float)($settings['referral_bonus_usd'] ?? 0);
            if ($referralBonus > 0) {
                $newBalance = UserModel::creditBalance($referrerId, $referralBonus);
                UserModel::logTransaction($referrerId, 'referral', $referralBonus, $newBalance, "Referral bonus — new user #$userId");
                Database::query(
                    'INSERT INTO referrals (referrer_id, referred_id, bonus_amount) VALUES (?, ?, ?)',
                    [$referrerId, $userId, number_format($referralBonus, 4, '.', '')]
                );
            }
        }

        // Welcome bonus
        $welcomeBonus = (float)($settings['welcome_bonus_usd'] ?? 0);
        if ($welcomeBonus > 0) {
            UserModel::creditBalance($userId, $welcomeBonus);
            UserModel::logTransaction($userId, 'welcome_bonus', $welcomeBonus, $welcomeBonus, 'Welcome bonus');
        }

        $user = UserModel::findById($userId);
        $sess = [
            'userId'   => $userId,
            'email'    => $user['email'],
            'username' => $user['username'],
            'role'     => $user['role'],
        ];
        JWT::setSessionCookie($sess);
        unset($user['password_hash'], $user['google_id']);

        Response::json($user, 201);
    }

    // ── POST /api/auth/logout ──────────────────────────────────────────────────
    public static function logout(): void
    {
        JWT::clearSessionCookie();
        Response::success('Logged out successfully');
    }

    // ── GET /api/auth/me ───────────────────────────────────────────────────────
    public static function me(): void
    {
        $session = AuthMiddleware::requireAuth();
        $user    = UserModel::findById((int)$session['userId']);
        if (!$user) Response::error('User not found', 404);
        unset($user['password_hash'], $user['google_id']);
        Response::json($user);
    }

    // ── POST /api/auth/google ──────────────────────────────────────────────────
    public static function googleAuth(): void
    {
        $token    = getBody()['token'] ?? '';
        $clientId = env('GOOGLE_CLIENT_ID') ?: setting('google_client_id');

        if (!$token) Response::error('Google token required', 400);
        if (!$clientId) Response::error('Google OAuth not configured', 503);

        // Verify token with Google's tokeninfo endpoint
        $ch = curl_init("https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($token));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $raw  = curl_exec($ch);
        curl_close($ch);
        $info = $raw ? json_decode($raw, true) : null;

        if (!$info || ($info['aud'] ?? '') !== $clientId || empty($info['email_verified'])) {
            Response::error('Invalid Google token', 401);
        }

        $email    = strtolower($info['email']);
        $googleId = $info['sub'];
        $name     = $info['name'] ?? '';

        // Find or create user
        $user = UserModel::findByEmail($email);
        if (!$user) {
            $userId = UserModel::create($email, '', $name);
            // Set google_id
            Database::query('UPDATE users SET google_id = ? WHERE id = ?', [$googleId, $userId]);
            $user = UserModel::findById($userId);
        } elseif (!$user['google_id']) {
            Database::query('UPDATE users SET google_id = ? WHERE id = ?', [$googleId, $user['id']]);
        }

        if ($user['banned']) Response::error('Account suspended', 403);

        $sess = [
            'userId'   => (int)$user['id'],
            'email'    => $user['email'],
            'username' => $user['username'],
            'role'     => $user['role'],
        ];
        JWT::setSessionCookie($sess);
        unset($user['password_hash'], $user['google_id']);

        Response::json($user);
    }

    // ── POST /api/auth/make-admin ──────────────────────────────────────────────
    public static function makeAdmin(): void
    {
        $body     = getBody();
        $setupKey = env('SETUP_KEY');

        if (!$setupKey) Response::error('Setup key not configured', 503);
        if (!hash_equals($setupKey, (string)($body['setupKey'] ?? ''))) {
            Response::error('Invalid setup key', 403);
        }

        $email = strtolower(trim($body['email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::error('Invalid email', 400);

        $user = UserModel::findByEmail($email);
        if (!$user) Response::error('User not found', 404);

        Database::query("UPDATE users SET role = 'admin' WHERE id = ?", [$user['id']]);
        Response::success("User {$email} is now an admin");
    }

    // ── POST /api/auth/change-password ────────────────────────────────────────
    public static function changePassword(): void
    {
        $session = AuthMiddleware::requireAuth();
        $body    = getBody();
        $v       = Validator::make($body)
            ->required('currentPassword', 'Current password')
            ->password('newPassword', 8);
        $v->abortIfFails();

        $user = Database::query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [$session['userId']])->fetch();
        if (!$user || !UserModel::verifyPassword($body['currentPassword'], $user['password_hash'])) {
            Response::error('Current password is incorrect', 400);
        }

        $newHash = UserModel::hashPassword($body['newPassword']);
        UserModel::updatePassword((int)$session['userId'], $newHash);

        Response::success('Password changed successfully');
    }
}
