<?php
/**
 * Authentication helpers
 */

function requireAuth(): array {
    $session = getSession();
    if (!$session || empty($session['userId'])) {
        jsonError('Unauthorized', 401);
    }
    return $session;
}

function requireAdmin(): array {
    $session = getSession();
    if (!$session || empty($session['userId']) || ($session['userRole'] ?? '') !== 'admin') {
        jsonError('Forbidden', 403);
    }
    return $session;
}

function hashPassword(string $password): string {
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
}

function verifyPassword(string $password, string $hash, int $userId = 0): bool {
    // bcrypt hash
    if (str_starts_with($hash, '$2')) {
        return password_verify($password, $hash);
    }
    // Legacy SHA-256 + salt
    $salt = env('SECRET_SALT') ?: 'smm-panel-salt-2024';
    $legacy = hash('sha256', $password . $salt);
    $match = hash_equals($legacy, $hash);
    if ($match && $userId > 0) {
        // Upgrade to bcrypt
        try {
            $db = getDB();
            $newHash = hashPassword($password);
            $stmt = $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $stmt->execute([$newHash, $userId]);
        } catch (Throwable) {}
    }
    return $match;
}

function generateApiKey(): string {
    return bin2hex(random_bytes(32));
}

function generateReferralCode(): string {
    return strtoupper(bin2hex(random_bytes(4)));
}

function sendTelegram(string $message): void {
    $settings = getSettings();
    $botToken = env('TELEGRAM_BOT_TOKEN') ?: ($settings['telegram_bot_token'] ?? '');
    $chatId   = env('TELEGRAM_CHAT_ID')   ?: ($settings['telegram_admin_chat_id'] ?? '');
    if (!$botToken || !$chatId) return;

    $payload = json_encode([
        'chat_id'    => $chatId,
        'text'       => $message,
        'parse_mode' => 'HTML',
    ]);

    $ctx = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json\r\nContent-Length: " . strlen($payload) . "\r\n",
            'content' => $payload,
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    @file_get_contents("https://api.telegram.org/bot$botToken/sendMessage", false, $ctx);
}

function verifyCronSecret(string $provided, string $expected): bool {
    if (!$provided || !$expected) return false;
    if (strlen($provided) !== strlen($expected)) return false;
    return hash_equals($expected, $provided);
}

function verifyTurnstile(string $token, string $secretKey): bool {
    $payload = json_encode(['secret' => $secretKey, 'response' => $token]);
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json\r\nContent-Length: " . strlen($payload),
            'content' => $payload,
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    $resp = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $ctx);
    if (!$resp) return false;
    $data = json_decode($resp, true);
    return ($data['success'] ?? false) === true;
}
