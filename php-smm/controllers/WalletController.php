<?php
/**
 * Wallet Controller — balance, transactions, deposits, card topup
 */

declare(strict_types=1);

class WalletController
{
    // ── GET /api/wallet/balance ───────────────────────────────────────────────
    public static function balance(): void
    {
        $session = AuthMiddleware::requireAuth();
        $user    = UserModel::findById((int)$session['userId']);
        Response::json(['balance' => (float)$user['balance']]);
    }

    // ── GET /api/wallet/transactions ──────────────────────────────────────────
    public static function transactions(): void
    {
        $session = AuthMiddleware::requireAuth();
        $p       = paginate();

        $total = (int)Database::query(
            'SELECT COUNT(*) FROM transactions WHERE user_id = ?',
            [$session['userId']]
        )->fetchColumn();

        $rows = Database::query(
            'SELECT id, type, amount, balance_after, description, reference_id, created_at
             FROM transactions WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?',
            [$session['userId'], $p['limit'], $p['offset']]
        )->fetchAll();

        Response::json(['transactions' => $rows, 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }

    // ── POST /api/wallet/deposits ─────────────────────────────────────────────
    public static function createDeposit(): void
    {
        $session  = AuthMiddleware::requireAuth();
        RateLimitMiddleware::check('deposit');
        $settings = getSettings();

        $v = Validator::make(getBody())
            ->numeric('amount', 0.01, 100000)
            ->in('method', ['bank_transfer', 'crypto', 'card', 'momo', 'zalopay'], false);
        $v->abortIfFails();

        $amount    = round((float)$v->get('amount'), 2);
        $method    = $v->get('method') ?: 'bank_transfer';
        $minDeposit = (float)($settings['min_deposit_usd'] ?? 1);
        if ($amount < $minDeposit) Response::error("Minimum deposit is \$$minDeposit", 400);

        $depositId = Database::insert(
            'INSERT INTO deposits (user_id, amount, method, status) VALUES (?, ?, ?, ?)',
            [$session['userId'], number_format($amount, 4, '.', ''), $method, 'pending']
        );

        Telegram::newDeposit((int)$session['userId'], "\$$amount", $method);

        $deposit = Database::query('SELECT * FROM deposits WHERE id = ? LIMIT 1', [$depositId])->fetch();
        Response::json($deposit, 201);
    }

    // ── GET /api/wallet/deposits ──────────────────────────────────────────────
    public static function listDeposits(): void
    {
        $session = AuthMiddleware::requireAuth();
        $p       = paginate();

        $total = (int)Database::query(
            'SELECT COUNT(*) FROM deposits WHERE user_id = ?',
            [$session['userId']]
        )->fetchColumn();

        $rows = Database::query(
            'SELECT id, amount, method, status, admin_note, created_at
             FROM deposits WHERE user_id = ?
             ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [$session['userId'], $p['limit'], $p['offset']]
        )->fetchAll();

        Response::json(['deposits' => $rows, 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }

    // ── POST /api/wallet/deposits/{id}/cancel ─────────────────────────────────
    public static function cancelDeposit(int $id): void
    {
        $session = AuthMiddleware::requireAuth();
        $stmt    = Database::query(
            "SELECT * FROM deposits WHERE id = ? AND user_id = ? LIMIT 1",
            [$id, $session['userId']]
        );
        $deposit = $stmt->fetch();
        if (!$deposit) Response::error('Deposit not found', 404);
        if ($deposit['status'] !== 'pending') Response::error('Only pending deposits can be cancelled', 400);

        Database::query("UPDATE deposits SET status = 'cancelled' WHERE id = ?", [$id]);
        Response::success('Deposit cancelled');
    }

    // ── POST /api/wallet/cards ────────────────────────────────────────────────
    // Nạp thẻ cào qua thesieure.com
    public static function submitCard(): void
    {
        $session  = AuthMiddleware::requireAuth();
        $settings = getSettings();
        $v        = Validator::make(getBody())
            ->in('telco', ['VIETTEL', 'MOBIFONE', 'VINAPHONE', 'VIETNAMOBILE', 'GMOBILE', 'REDDI'])
            ->in('faceValue', [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000])
            ->string('code', 9, 15)
            ->string('serial', 9, 20);
        $v->abortIfFails();

        $partnerId  = $settings['card_partner_id']  ?? env('CARD_PARTNER_ID');
        $partnerKey = $settings['card_partner_key'] ?? env('CARD_PARTNER_KEY');
        if (!$partnerId || !$partnerKey) Response::error('Card topup not configured', 503);

        $requestId = bin2hex(random_bytes(8));
        $sign      = md5($partnerId . $partnerKey . $v->get('code') . $v->get('serial'));

        // Insert pending record
        $cardId = Database::insert(
            'INSERT INTO card_charges (user_id, telco, face_value, code, serial, request_id, status)
             VALUES (?, ?, ?, ?, ?, ?, 0)',
            [$session['userId'], $v->get('telco'), $v->get('faceValue'), $v->get('code'), $v->get('serial'), $requestId]
        );

        // Call thesieure API
        $result = self::callCardApi([
            'telco'        => $v->get('telco'),
            'code'         => $v->get('code'),
            'serial'       => $v->get('serial'),
            'amount'       => $v->get('faceValue'),
            'request_id'   => $requestId,
            'partner_id'   => $partnerId,
            'sign'         => $sign,
            'callback_url' => rtrim(env('SITE_URL') ?: setting('site_url'), '/') . '/api/wallet/cards/callback',
        ]);

        Response::json([
            'id'        => $cardId,
            'requestId' => $requestId,
            'status'    => 'pending',
            'message'   => $result['message'] ?? 'Card submitted for processing',
        ], 201);
    }

    // ── POST /api/wallet/cards/callback ──────────────────────────────────────
    // Callback từ thesieure.com — NO AUTH (verified by signature)
    public static function cardCallback(): void
    {
        $body      = getBody();
        $requestId = $body['request_id'] ?? '';
        if (!$requestId) Response::json(['success' => true]);

        $settings   = getSettings();
        $partnerId  = $settings['card_partner_id']  ?? env('CARD_PARTNER_ID');
        $partnerKey = $settings['card_partner_key'] ?? env('CARD_PARTNER_KEY');

        if ($partnerId && $partnerKey) {
            $sign = $body['sign'] ?? '';
            $expectedSign = md5($partnerId . $partnerKey . $requestId);
            if (!hash_equals($expectedSign, $sign)) {
                Response::json(['success' => false, 'message' => 'Invalid signature'], 401);
            }
        }

        $charge = Database::query(
            'SELECT * FROM card_charges WHERE request_id = ? LIMIT 1',
            [$requestId]
        )->fetch();

        if (!$charge || in_array((int)$charge['status'], [1, 3], true)) {
            Response::json(['success' => true]);
        }

        $cardStatus   = (int)($body['status'] ?? 3);
        $actualAmount = isset($body['amount']) ? (float)$body['amount'] : null;

        if ($cardStatus === 1 && $actualAmount) {
            $vndRate = (float)($settings['vnd_exchange_rate'] ?? 24000);
            $usd     = round($actualAmount / $vndRate, 4);

            try {
                $newBalance = UserModel::creditBalance((int)$charge['user_id'], $usd);
                UserModel::logTransaction(
                    (int)$charge['user_id'], 'deposit', $usd, $newBalance,
                    "Nạp thẻ {$charge['telco']} callback", (int)$charge['id']
                );
                Database::query(
                    'UPDATE card_charges SET status=?, message=?, actual_amount=?, usd_credited=?, updated_at=NOW() WHERE id=?',
                    [$cardStatus, $body['message'] ?? '', (string)$actualAmount, number_format($usd, 4, '.', ''), $charge['id']]
                );
                UserModel::notify((int)$charge['user_id'], 'deposit', 'Nạp thẻ thành công', "Thẻ {$charge['telco']} đã được nạp: $" . number_format($usd, 2));
            } catch (Throwable $e) {
                error_log('[SMM-Card] Callback error: ' . $e->getMessage());
                Response::json(['success' => false, 'message' => 'Internal error'], 500);
            }
        } else {
            Database::query(
                'UPDATE card_charges SET status=?, message=?, actual_amount=?, updated_at=NOW() WHERE id=?',
                [$cardStatus, $body['message'] ?? '', $actualAmount ? (string)$actualAmount : null, $charge['id']]
            );
        }

        Response::json(['success' => true]);
    }

    // ── GET /api/wallet/sepay-info ────────────────────────────────────────────
    public static function sepayInfo(): void
    {
        $session  = AuthMiddleware::requireAuth();
        $settings = getSettings();
        $userId   = (int)$session['userId'];

        Response::json([
            'bankAccount' => $settings['bank_account_number'] ?? '',
            'bankName'    => $settings['bank_name'] ?? '',
            'accountName' => $settings['bank_account_name'] ?? '',
            'transferContent' => "SMM{$userId}",
            'qrCode'      => $settings['bank_qr_template']
                ? str_replace('{AMOUNT}', '0', $settings['bank_qr_template'])
                : null,
        ]);
    }

    private static function callCardApi(array $data): array
    {
        $ch = curl_init('https://api.thesieure.com/chargingws/v2');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $raw  = curl_exec($ch);
        curl_close($ch);
        return $raw ? (json_decode($raw, true) ?? []) : [];
    }
}
