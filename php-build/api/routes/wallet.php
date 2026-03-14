<?php
/** Wallet routes — auth required */

$sess   = requireAuth();
$uid    = (int)$sess['userId'];
$method = method();
$seg    = $GLOBALS['routeSegments'] ?? [];
$action = $seg[1] ?? '';  // 'balance','transactions','deposits','cards'
$subId  = (int)($seg[2] ?? 0);
$sub    = $seg[3] ?? '';  // 'cancel', 'callback'
$db     = getDB();

// GET /api/wallet/balance
if ($method === 'GET' && $action === 'balance') {
    $stmt = $db->prepare('SELECT balance, currency FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$uid]);
    $u = $stmt->fetch();
    jsonOut(['balance' => (float)($u['balance'] ?? 0), 'currency' => $u['currency'] ?? 'USD']);
}

// GET /api/wallet/transactions
if ($method === 'GET' && $action === 'transactions') {
    $p      = paginate();
    $where  = 'user_id = ?'; $params = [$uid];
    if (!empty($_GET['type'])) { $where .= ' AND type = ?'; $params[] = $_GET['type']; }
    $c = $db->prepare("SELECT COUNT(*) FROM transactions WHERE $where"); $c->execute($params);
    $total = (int)$c->fetchColumn();
    $stmt  = $db->prepare("SELECT * FROM transactions WHERE $where ORDER BY created_at DESC LIMIT ? OFFSET ?");
    $stmt->execute(array_merge($params, [$p['limit'], $p['offset']]));
    jsonOut(['transactions' => $stmt->fetchAll(), 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
}

// GET /api/wallet/deposits
if ($method === 'GET' && $action === 'deposits' && !$subId) {
    $stmt = $db->prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$uid]);
    jsonOut(['deposits' => $stmt->fetchAll()]);
}

// POST /api/wallet/deposits — create deposit request
if ($method === 'POST' && $action === 'deposits' && !$subId) {
    $body   = getBody();
    $amount = (float)($body['amount'] ?? 0);
    $meth   = $body['method'] ?? '';
    $note   = $body['note'] ?? null;
    $valid  = ['bank_transfer', 'qr_payment', 'crypto'];
    if ($amount <= 0) jsonError('Số tiền phải lớn hơn 0');
    if (!in_array($meth, $valid)) jsonError('Phương thức không hợp lệ');
    $db->prepare('INSERT INTO deposits (user_id, amount, method, status, note) VALUES (?,?,?,?,?)')
       ->execute([$uid, number_format($amount, 4, '.', ''), $meth, 'pending', $note]);
    $id = (int)$db->lastInsertId('deposits_id_seq');
    $stmt = $db->prepare('SELECT * FROM deposits WHERE id = ? LIMIT 1'); $stmt->execute([$id]);
    jsonOut($stmt->fetch(), 201);
}

// POST /api/wallet/deposits/:id/cancel
if ($method === 'POST' && $action === 'deposits' && $subId && $sub === 'cancel') {
    $stmt = $db->prepare('SELECT * FROM deposits WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$subId, $uid]);
    $dep = $stmt->fetch();
    if (!$dep) jsonError('Không tìm thấy lệnh nạp', 404);
    if ($dep['status'] !== 'pending') jsonError('Chỉ có thể hủy lệnh đang chờ');
    $db->prepare("UPDATE deposits SET status = 'rejected', note = 'Người dùng hủy lệnh' WHERE id = ?")
       ->execute([$subId]);
    jsonOut(['ok' => true]);
}

// GET /api/wallet/cards
if ($method === 'GET' && $action === 'cards') {
    $stmt = $db->prepare('SELECT * FROM card_charges WHERE user_id = ? ORDER BY created_at DESC LIMIT 30');
    $stmt->execute([$uid]);
    jsonOut(['cards' => $stmt->fetchAll()]);
}

// POST /api/wallet/cards/callback — thesieure.com callback (no auth)
// Note: this is matched before requireAuth at the index level

// POST /api/wallet/cards — nạp thẻ cào
if ($method === 'POST' && $action === 'cards') {
    $body = getBody();
    $validTelcos   = ['VIETTEL','MOBIFONE','VINAPHONE','VIETNAMOBILE','GMOBILE','REDDI'];
    $validAmounts  = [10000,20000,50000,100000,200000,500000];

    $telco  = strtoupper(trim($body['telco'] ?? ''));
    $serial = trim($body['serial'] ?? '');
    $code   = trim($body['code'] ?? '');
    $amount = (int)($body['amount'] ?? 0);

    if (!in_array($telco, $validTelcos))    jsonError('Nhà mạng không hợp lệ');
    if (strlen($serial) < 5)                jsonError('Serial không hợp lệ');
    if (strlen($code) < 5)                  jsonError('Mã thẻ không hợp lệ');
    if (!in_array($amount, $validAmounts))  jsonError('Mệnh giá không hợp lệ');

    $s = getSettings();
    $partnerId  = $s['card_partner_id'] ?? '';
    $partnerKey = $s['card_partner_key'] ?? '';
    if (!$partnerId || !$partnerKey) jsonError('Nạp thẻ cào chưa được cấu hình. Vui lòng liên hệ admin.');

    $requestId = sprintf('%04x%04x-%04x-%04x-%04x-%012x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffffffffffff)
    );

    $db->prepare(
        'INSERT INTO card_charges (user_id, telco, serial, code, declared_amount, request_id, status) VALUES (?,?,?,?,?,?,?)'
    )->execute([$uid, $telco, $serial, $code, $amount, $requestId, 2]);
    $chargeId = (int)$db->lastInsertId('card_charges_id_seq');

    $siteUrl     = $s['site_url'] ?? '';
    $callbackUrl = $siteUrl ? $siteUrl . '/api/wallet/cards/callback' : '';

    $params = [
        'partner_id'  => $partnerId, 'partner_key' => $partnerKey,
        'telco'       => $telco,     'code'         => $code,
        'serial'      => $serial,    'amount'        => (string)$amount,
        'request_id'  => $requestId,
    ];
    if ($callbackUrl) $params['callback_url'] = $callbackUrl;

    $apiResult = callProviderApi('https://thesieure.com/chargingws/v2', '___CARD___', $params, 30);
    // Note: callProviderApi adds 'key', but thesieure uses partner_id/partner_key — override
    // We need a raw call for thesieure
    $body2 = http_build_query($params);
    $ctx   = stream_context_create(['http' => ['method'=>'POST','header'=>"Content-Type: application/x-www-form-urlencoded\r\nContent-Length: ".strlen($body2),'content'=>$body2,'timeout'=>30,'ignore_errors'=>true]]);
    $raw   = @file_get_contents('https://thesieure.com/chargingws/v2', false, $ctx);
    $apiResult = $raw ? json_decode($raw, true) : null;

    if (!$apiResult) {
        $db->prepare("UPDATE card_charges SET status=3, message='Lỗi kết nối', updated_at=NOW() WHERE id=?")->execute([$chargeId]);
        jsonOut(['id'=>$chargeId,'status'=>3,'message'=>'Không thể kết nối đến cổng thanh toán. Vui lòng thử lại sau.']);
    }

    $cardStatus  = (int)($apiResult['status'] ?? 3);
    $cardMessage = $apiResult['message'] ?? 'Không xác định';
    $actualAmount= isset($apiResult['amount']) ? (float)$apiResult['amount'] : null;
    $usdCredited  = null;

    if ($cardStatus === 1 && $actualAmount) {
        $vndRate = (float)($s['vnd_exchange_rate'] ?? 24000);
        $usd     = $actualAmount / $vndRate;
        $u = $db->prepare('SELECT balance FROM users WHERE id = ? LIMIT 1'); $u->execute([$uid]);
        $user = $u->fetch();
        $newBalance = round((float)$user['balance'] + $usd, 4);
        $usdCredited = number_format($usd, 4, '.', '');
        $db->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([number_format($newBalance, 4, '.', ''), $uid]);
        $db->prepare('INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?,?,?,?,?,?)')
           ->execute([$uid, 'deposit', $usdCredited, number_format($newBalance, 4, '.', ''), "Nạp thẻ $telco " . number_format($amount, 0, '.', '.') . 'đ', $chargeId]);
    }

    $db->prepare("UPDATE card_charges SET status=?,message=?,actual_amount=?,usd_credited=?,updated_at=NOW() WHERE id=?")
       ->execute([$cardStatus, $cardMessage, $actualAmount ? (string)$actualAmount : null, $usdCredited, $chargeId]);

    $labels = [1=>'Thành công',2=>'Đang xử lý',3=>'Thẻ lỗi / không hợp lệ',99=>'Hệ thống đang bảo trì'];
    jsonOut(['id'=>$chargeId,'status'=>$cardStatus,'message'=>$labels[$cardStatus] ?? $cardMessage,'usdCredited'=>$usdCredited]);
}

jsonError('Not found', 404);
