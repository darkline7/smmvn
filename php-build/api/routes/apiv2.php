<?php
/** Public API v2 — POST /api/v2 */

if (method() !== 'POST') jsonError('Action is required');

$body   = getBody();
$apiKey = $body['key'] ?? '';
$action = $body['action'] ?? '';
$ip     = $_SERVER['REMOTE_ADDR'] ?? '';

if (!$apiKey)  jsonOut(['error' => 'API key is required'], 401);
if (!$action)  jsonOut(['error' => 'Action is required'], 400);

$db   = getDB();
$stmt = $db->prepare('SELECT * FROM users WHERE api_key = ? LIMIT 1');
$stmt->execute([$apiKey]);
$user = $stmt->fetch();

if (!$user || $user['banned']) {
    logApiRequest($db, null, $action, $body, ['error' => 'Invalid API key'], 'error', $ip);
    jsonOut(['error' => 'Invalid API key'], 401);
}

$uid     = (int)$user['id'];
$isError = false;
$resp    = null;

try {
    switch ($action) {

        case 'services':
            $rows = $db->query(
                "SELECT s.id AS service, s.name, s.type, s.rate, s.min, s.max,
                        (SELECT name FROM categories WHERE id = s.category_id) AS category,
                        s.refill, s.cancel, s.dripfeed
                 FROM services s WHERE s.status = 'active' ORDER BY s.sort_order, s.name"
            )->fetchAll();
            $resp = $rows;
            break;

        case 'balance':
            $resp = ['balance' => (float)$user['balance'], 'currency' => $user['currency']];
            break;

        case 'add':
            $serviceId = (int)($body['service'] ?? 0);
            $link      = trim($body['link'] ?? '');
            $quantity  = (int)($body['quantity'] ?? 0);
            if (!$serviceId || !$link || !$quantity) throw new RuntimeException('service, link, and quantity are required');

            $svc = $db->prepare("SELECT * FROM services WHERE id = ? AND status = 'active' LIMIT 1");
            $svc->execute([$serviceId]);
            $service = $svc->fetch();
            if (!$service) throw new RuntimeException('Service not found or inactive');
            if ($quantity < (int)$service['min'] || $quantity > (int)$service['max']) {
                throw new RuntimeException("Quantity must be between {$service['min']} and {$service['max']}");
            }
            $charge = round(((float)$service['rate'] * $quantity) / 1000, 4);

            $db->beginTransaction();
            $u = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE LIMIT 1');
            $u->execute([$uid]);
            $freshUser = $u->fetch();
            if ((float)$freshUser['balance'] < $charge) { $db->rollBack(); throw new RuntimeException('Insufficient balance'); }
            $newBalance = round((float)$freshUser['balance'] - $charge, 4);
            $db->prepare('INSERT INTO orders (user_id, service_id, link, quantity, charge, status) VALUES (?,?,?,?,?,?)')
               ->execute([$uid, $serviceId, $link, $quantity, number_format($charge,4,'.',''), 'pending']);
            $oid = (int)$db->lastInsertId('orders_id_seq');
            $db->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([number_format($newBalance,4,'.',''), $uid]);
            $db->prepare('INSERT INTO transactions (user_id,type,amount,balance_after,description,reference_id) VALUES (?,?,?,?,?,?)')
               ->execute([$uid,'order',number_format(-$charge,4,'.',''),number_format($newBalance,4,'.',''),"API Order #$oid",$oid]);
            $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')->execute([$oid,'pending','Order created via API']);
            $db->commit();
            $resp = ['order' => $oid];
            break;

        case 'status':
            $orderId = (int)($body['order'] ?? 0);
            if (!$orderId) throw new RuntimeException('order is required');
            $o = $db->prepare('SELECT o.charge, o.start_count, o.status, o.remains, u.currency FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=? AND o.user_id=? LIMIT 1');
            $o->execute([$orderId, $uid]);
            $order = $o->fetch();
            if (!$order) throw new RuntimeException('Order not found');
            $resp = ['charge' => $order['charge'], 'start_count' => $order['start_count'], 'status' => $order['status'], 'remains' => $order['remains'], 'currency' => $order['currency']];
            break;

        case 'multiple_status':
            $orderIds = $body['orders'] ?? '';
            if (!$orderIds) throw new RuntimeException('orders is required');
            $ids = array_filter(array_map('intval', explode(',', (string)$orderIds)));
            if (!$ids) throw new RuntimeException('No valid order IDs');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("SELECT id, charge, start_count, status, remains FROM orders WHERE user_id = ? AND id IN ($placeholders)");
            $stmt->execute(array_merge([$uid], $ids));
            $result = [];
            foreach ($stmt->fetchAll() as $o) $result[(string)$o['id']] = ['charge' => $o['charge'], 'start_count' => $o['start_count'], 'status' => $o['status'], 'remains' => $o['remains']];
            $resp = $result;
            break;

        case 'refill':
            $orderId = (int)($body['order'] ?? 0);
            if (!$orderId) throw new RuntimeException('order is required');
            $o = $db->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1'); $o->execute([$orderId, $uid]);
            $order = $o->fetch();
            if (!$order) throw new RuntimeException('Order not found');
            $s = $db->prepare('SELECT refill FROM services WHERE id = ? LIMIT 1'); $s->execute([$order['service_id']]);
            $svc = $s->fetch();
            if (!($svc['refill'] ?? false)) throw new RuntimeException('This service does not support refill');
            $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')->execute([$orderId,'refill_requested','Refill requested via API']);
            $resp = ['refill' => $orderId];
            break;

        case 'refill_status':
            $refill = (int)($body['refill'] ?? 0);
            if (!$refill) throw new RuntimeException('refill is required');
            $o = $db->prepare('SELECT status FROM orders WHERE id = ? AND user_id = ? LIMIT 1'); $o->execute([$refill, $uid]);
            if (!$o->fetch()) throw new RuntimeException('Order not found');
            $resp = ['status' => 'In progress'];
            break;

        case 'cancel':
            $orderId = (int)($body['order'] ?? 0);
            if (!$orderId) throw new RuntimeException('order is required');
            $o = $db->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1'); $o->execute([$orderId, $uid]);
            $order = $o->fetch();
            if (!$order) throw new RuntimeException('Order not found');
            if (!in_array($order['status'], ['pending','processing'])) throw new RuntimeException('Order cannot be cancelled');
            $db->prepare("UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=?")->execute([$orderId]);
            $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')->execute([$orderId,'cancelled','Cancelled via API']);
            $resp = ['cancel' => [['id' => $orderId, 'cancel' => 1]]];
            break;

        default:
            throw new RuntimeException("Unknown action: $action");
    }
} catch (Throwable $e) {
    $isError = true;
    $resp    = ['error' => $e->getMessage()];
}

logApiRequest($db, $uid, $action, array_merge($body, ['key' => '***']), $resp, $isError ? 'error' : 'success', $ip);
jsonOut($resp);

function logApiRequest(PDO $db, ?int $userId, string $action, array $req, mixed $resp, string $status, string $ip): void {
    try {
        $db->prepare('INSERT INTO api_request_logs (user_id, action, request_body, response_body, status, ip_address) VALUES (?,?,?,?,?,?)')
           ->execute([$userId, $action, json_encode($req), json_encode($resp), $status, $ip]);
    } catch (Throwable) {}
}
