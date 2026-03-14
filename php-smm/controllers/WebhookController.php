<?php
/**
 * Webhook Controller — SePay bank webhook
 */

declare(strict_types=1);

class WebhookController
{
    // ── POST /api/webhook/sepay ───────────────────────────────────────────────
    public static function sepay(): void
    {
        $settings = getSettings();
        $secret   = env('SEPAY_WEBHOOK_SECRET') ?: ($settings['sepay_webhook_secret'] ?? '');

        // Validate secret
        if ($secret) {
            $provided = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            if (str_starts_with($provided, 'Bearer ')) {
                $provided = substr($provided, 7);
            }
            if (!$provided) {
                $provided = getBody()['apikey'] ?? '';
            }
            if (!hash_equals($secret, $provided)) {
                Response::json(['success' => false, 'message' => 'Unauthorized'], 401);
            }
        }

        $body        = getBody();
        $content     = trim($body['content'] ?? $body['transferContent'] ?? '');
        $amount      = (float)($body['transferAmount'] ?? $body['amount'] ?? 0);
        $bankCode    = $body['bankCode'] ?? $body['bank'] ?? 'Unknown';
        $referenceId = $body['referenceCode'] ?? $body['id'] ?? '';

        if (!$content || !$amount) {
            Response::json(['success' => true, 'message' => 'Skipped — missing content or amount']);
        }

        // Prevent duplicate processing
        if ($referenceId) {
            $dup = Database::query(
                "SELECT id FROM deposits WHERE gateway_ref = ? AND status != 'pending' LIMIT 1",
                [$referenceId]
            )->fetch();
            if ($dup) {
                Response::json(['success' => true, 'message' => 'Already processed']);
            }
        }

        // Extract userId from transfer content
        // Pattern: SMM{userId} or SMM{userId} with any surrounding text
        $userId = null;
        if (preg_match('/\bSMM(\d+)\b/i', $content, $m)) {
            $userId = (int)$m[1];
        }

        if (!$userId) {
            error_log("[SePay] No user ID found in content: $content");
            Response::json(['success' => true, 'message' => 'No user ID found in transfer content']);
        }

        $user = UserModel::findById($userId);
        if (!$user) {
            Response::json(['success' => true, 'message' => 'User not found']);
        }

        // Convert VND to USD
        $vndRate = (float)($settings['vnd_exchange_rate'] ?? 24000);
        $usd     = round($amount / $vndRate, 4);

        try {
            Database::transaction(function (PDO $db) use ($userId, $usd, $amount, $referenceId, $bankCode, $content) {
                // Credit user balance
                $stmt = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
                $stmt->execute([$userId]);
                $user       = $stmt->fetch();
                $newBalance = round((float)$user['balance'] + $usd, 4);

                $db->prepare('UPDATE users SET balance = ?, updated_at = NOW() WHERE id = ?')
                   ->execute([number_format($newBalance, 4, '.', ''), $userId]);

                // Record deposit
                $depositId = Database::insert(
                    "INSERT INTO deposits (user_id, amount, method, gateway_ref, status, admin_note)
                     VALUES (?, ?, 'bank_transfer', ?, 'approved', ?)",
                    [$userId, number_format($usd, 4, '.', ''), $referenceId ?: null, "SePay auto: $content"]
                );

                UserModel::logTransaction($userId, 'deposit', $usd, $newBalance, "SePay bank transfer: $bankCode", $depositId);
                UserModel::notify($userId, 'deposit', 'Nạp tiền thành công', "Đã nhận " . number_format($amount, 0, '.', ',') . " VND ≈ \${$usd}");
            });
        } catch (Throwable $e) {
            error_log('[SePay] Error processing webhook: ' . $e->getMessage());
            Response::json(['success' => false, 'message' => 'Processing error'], 500);
        }

        Telegram::sePayDeposit($userId, $amount, $bankCode);
        Response::json(['success' => true, 'message' => 'Processed']);
    }
}
