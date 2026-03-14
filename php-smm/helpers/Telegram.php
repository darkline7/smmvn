<?php
/**
 * Telegram notifications helper
 */

declare(strict_types=1);

class Telegram
{
    public static function send(string $message, bool $silent = false): void
    {
        $token  = env('TELEGRAM_BOT_TOKEN') ?: setting('telegram_bot_token');
        $chatId = env('TELEGRAM_CHAT_ID')   ?: setting('telegram_chat_id');

        if (!$token || !$chatId) return;

        $payload = [
            'chat_id'                  => $chatId,
            'text'                     => $message,
            'parse_mode'               => 'HTML',
            'disable_web_page_preview' => true,
        ];
        if ($silent) $payload['disable_notification'] = true;

        $ch = curl_init("https://api.telegram.org/bot$token/sendMessage");
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $result = curl_exec($ch);
        curl_close($ch);

        if (!$result) {
            error_log('[SMM-Telegram] Failed to send notification');
        }
    }

    public static function newOrder(int $orderId, int $userId, string $service, float $charge): void
    {
        self::send(
            "🛒 <b>Đơn hàng mới #{$orderId}</b>\n" .
            "👤 User: #{$userId}\n" .
            "🎯 Dịch vụ: " . htmlspecialchars($service) . "\n" .
            "💵 Phí: $" . number_format($charge, 4),
            silent: true
        );
    }

    public static function newDeposit(int $userId, string $amount, string $method): void
    {
        self::send(
            "💰 <b>Yêu cầu nạp tiền</b>\n" .
            "👤 User: #{$userId}\n" .
            "💵 Số tiền: {$amount}\n" .
            "💳 Phương thức: {$method}"
        );
    }

    public static function depositApproved(int $depositId, int $userId, string $amount): void
    {
        self::send(
            "✅ <b>Duyệt nạp tiền #{$depositId}</b>\n" .
            "👤 User ID: {$userId}\n" .
            "💵 Số tiền: \${$amount}"
        );
    }

    public static function depositRejected(int $depositId, int $userId, string $amount): void
    {
        self::send(
            "❌ <b>Từ chối nạp tiền #{$depositId}</b>\n" .
            "👤 User ID: {$userId}\n" .
            "💵 Số tiền: \${$amount}"
        );
    }

    public static function newTicket(int $ticketId, string $subject, int $userId): void
    {
        self::send(
            "🎫 <b>Ticket mới #{$ticketId}</b>\n" .
            "👤 User: #{$userId}\n" .
            "📝 " . htmlspecialchars($subject),
            silent: true
        );
    }

    public static function sePayDeposit(int $userId, float $amount, string $bankCode): void
    {
        self::send(
            "🏦 <b>SePay nhận tiền</b>\n" .
            "👤 User: #{$userId}\n" .
            "💵 Số tiền: " . number_format($amount, 0, '.', ',') . " VND\n" .
            "🏧 Ngân hàng: {$bankCode}"
        );
    }
}
