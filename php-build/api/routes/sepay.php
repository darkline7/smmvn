<?php
/** SePay webhook — POST /api/webhook/sepay (no user auth, uses API key) */

if (method() !== 'POST') jsonError('Method not allowed', 405);

$s = getSettings();
$webhookSecret = env('SEPAY_WEBHOOK_SECRET') ?: ($s['sepay_webhook_secret'] ?? '');

if (!$webhookSecret) {
    error_log('[SePay] Webhook received but SEPAY_WEBHOOK_SECRET not configured — rejecting');
    jsonOut(['success' => false, 'message' => 'Webhook secret not configured'], 401);
}

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['HTTP_APIKEY'] ?? '');
$body       = getBody();
$bodyApiKey = $body['apikey'] ?? '';
$provided   = $authHeader ?: $bodyApiKey;

if ($provided !== $webhookSecret && $provided !== "Apikey $webhookSecret") {
    jsonOut(['success' => false, 'message' => 'Unauthorized'], 401);
}

$transferType  = $body['transferType'] ?? '';
$content       = $body['content'] ?? '';
$transferAmount= (float)($body['transferAmount'] ?? $body['amount'] ?? $body['in'] ?? 0);

if ($transferType !== 'in') jsonOut(['success' => true, 'message' => 'Ignored: outgoing transfer']);
if ($transferAmount <= 0)   jsonOut(['success' => true, 'message' => 'Invalid amount']);

preg_match('/SMM(\d+)/i', strtoupper($content), $m);
if (!$m) jsonOut(['success' => true, 'message' => 'No matching reference in content']);

$depositId = (int)$m[1];
$db = getDB();
$stmt = $db->prepare("SELECT * FROM deposits WHERE id = ? AND status = 'pending' LIMIT 1");
$stmt->execute([$depositId]);
$deposit = $stmt->fetch();
if (!$deposit) jsonOut(['success' => true, 'message' => 'Deposit not found or already processed']);

$exchangeRate    = (float)($s['vnd_exchange_rate'] ?? 24000);
$depositAmountUSD= (float)$deposit['amount'];
$receivedUSD     = $transferAmount / $exchangeRate;

if (abs($receivedUSD - $depositAmountUSD) > $depositAmountUSD * 0.02) {
    jsonOut(['success' => false, 'message' => "Amount mismatch: expected $depositAmountUSD USD, received " . round($receivedUSD, 2) . ' USD']);
}

$uStmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
$uStmt->execute([$deposit['user_id']]);
$user = $uStmt->fetch();
if (!$user) jsonOut(['success' => false, 'message' => 'User not found']);

$newBalance = round((float)$user['balance'] + $depositAmountUSD, 4);

try {
    $db->beginTransaction();
    $db->prepare("UPDATE deposits SET status='approved', admin_note=?, updated_at=NOW() WHERE id=?")
       ->execute(["Auto-approved by SePay. Received $transferAmount VND", $depositId]);
    $db->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([number_format($newBalance, 4, '.', ''), $deposit['user_id']]);
    $db->prepare('INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?,?,?,?,?,?)')
       ->execute([$deposit['user_id'], 'deposit', $deposit['amount'], number_format($newBalance, 4, '.', ''), "Nạp tiền qua SePay - $content", $depositId]);
    $db->prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?,?,?,?)')
       ->execute([$deposit['user_id'], 'deposit', 'Nạp tiền thành công', "Tài khoản của bạn đã được cộng \${$depositAmountUSD}. Số dư mới: $" . number_format($newBalance, 2)]);
    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    error_log('[SePay] transaction error: ' . $e->getMessage());
    jsonOut(['success' => false, 'message' => 'Internal error'], 500);
}

sendTelegram("🤖 <b>Auto-duyệt nạp tiền #$depositId</b>\n👤 User ID: {$deposit['user_id']}\n💵 Số tiền: \$$depositAmountUSD\n🔑 Mã: SMM$depositId");

jsonOut(['success' => true, 'message' => 'Deposit approved successfully']);
