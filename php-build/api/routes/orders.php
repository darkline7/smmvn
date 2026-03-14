<?php
/** Orders routes — auth required */

$sess   = requireAuth();
$uid    = (int)$sess['userId'];
$method = method();
$seg    = $GLOBALS['routeSegments'] ?? [];
$seg1    = $seg[1] ?? "";
$isMass  = ($seg1 === "mass");
$orderId = $isMass ? 0 : (int)$seg1;
$sub    = $seg[2] ?? '';  // 'refill' or 'cancel'
$db     = getDB();

// GET /api/orders — list user orders
if ($method === 'GET' && !$orderId) {
    $p      = paginate();
    $where  = 'o.user_id = ?';
    $params = [$uid];
    if (!empty($_GET['status']))    { $where .= ' AND o.status = ?';             $params[] = $_GET['status']; }
    if (!empty($_GET['serviceId'])) { $where .= ' AND o.service_id = ?';         $params[] = (int)$_GET['serviceId']; }
    if (!empty($_GET['search']))    { $where .= ' AND o.link ILIKE ?';           $params[] = '%' . $_GET['search'] . '%'; }

    $stmt = $db->prepare("SELECT COUNT(*) FROM orders o WHERE $where"); $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $stmt = $db->prepare(
        "SELECT o.id, o.service_id, (SELECT name FROM services WHERE id = o.service_id) AS service_name,
                o.link, o.quantity, o.start_count, o.remains, o.charge, o.status, o.created_at, o.updated_at
         FROM orders o WHERE $where ORDER BY o.created_at DESC LIMIT ? OFFSET ?"
    );
    $stmt->execute(array_merge($params, [$p['limit'], $p['offset']]));
    jsonOut(['orders' => $stmt->fetchAll(), 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
}

// GET /api/orders/:id — single order
if ($method === 'GET' && $orderId && !$sub) {
    $stmt = $db->prepare(
        "SELECT o.*, (SELECT name FROM services WHERE id = o.service_id) AS service_name
         FROM orders o WHERE o.id = ? AND o.user_id = ? LIMIT 1"
    );
    $stmt->execute([$orderId, $uid]);
    $order = $stmt->fetch();
    if (!$order) jsonError('Order not found', 404);
    $logs = $db->prepare('SELECT * FROM order_logs WHERE order_id = ? ORDER BY created_at');
    $logs->execute([$orderId]);
    jsonOut(array_merge($order, ['logs' => $logs->fetchAll()]));
}

// POST /api/orders — create order
if ($method === 'POST' && !$orderId && !$isMass) {
    $body      = getBody();
    $serviceId = (int)($body['serviceId'] ?? 0);
    $link      = trim($body['link'] ?? '');
    $quantity  = (int)($body['quantity'] ?? 0);

    if (!$serviceId || !$link || !$quantity) jsonError('serviceId, link, quantity are required');
    if (!filter_var($link, FILTER_VALIDATE_URL)) jsonError('Link không hợp lệ');

    $stmt = $db->prepare("SELECT * FROM services WHERE id = ? AND status = 'active' LIMIT 1");
    $stmt->execute([$serviceId]);
    $svc = $stmt->fetch();
    if (!$svc) jsonError('Service not found or inactive');
    if ($quantity < (int)$svc['min'] || $quantity > (int)$svc['max']) {
        jsonError("Quantity must be between {$svc['min']} and {$svc['max']}");
    }

    $charge = round(((float)$svc['rate'] * $quantity) / 1000, 4);

    // Atomic transaction
    try {
        $db->beginTransaction();
        $u = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE LIMIT 1');
        $u->execute([$uid]);
        $user = $u->fetch();
        if (!$user || (float)$user['balance'] < $charge) {
            $db->rollBack();
            jsonError('Insufficient balance');
        }
        $newBalance = round((float)$user['balance'] - $charge, 4);

        $db->prepare(
            'INSERT INTO orders (user_id, service_id, link, quantity, charge, status, runs, interval, comments, username)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $uid, $serviceId, $link, $quantity, number_format($charge, 4, '.', ''), 'pending',
            $body['runs'] ?? null, $body['interval'] ?? null,
            $body['comments'] ?? null, $body['username'] ?? null,
        ]);
        $newOrderId = (int)$db->lastInsertId('orders_id_seq');

        $db->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([number_format($newBalance, 4, '.', ''), $uid]);
        $db->prepare(
            'INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?,?,?,?,?,?)'
        )->execute([$uid, 'order', number_format(-$charge, 4, '.', ''), number_format($newBalance, 4, '.', ''), "Order #$newOrderId - {$svc['name']}", $newOrderId]);
        $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')->execute([$newOrderId, 'pending', 'Order created']);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        jsonError($e->getMessage() === 'Insufficient balance' ? 'Insufficient balance' : 'Có lỗi tạo đơn hàng');
    }

    // Forward to provider (non-blocking: attempt, ignore failures)
    if (!empty($svc['provider_id']) && !empty($svc['provider_service_id'])) {
        $prov = $db->prepare('SELECT * FROM providers WHERE id = ? LIMIT 1');
        $prov->execute([$svc['provider_id']]);
        $provider = $prov->fetch();
        if ($provider && $provider['base_url'] && $provider['api_key']) {
            $params = [
                'action' => 'add', 'service' => $svc['provider_service_id'],
                'link' => $link, 'quantity' => (string)$quantity,
            ];
            if (!empty($body['runs']))     $params['runs']     = (string)$body['runs'];
            if (!empty($body['interval'])) $params['interval'] = (string)$body['interval'];
            if (!empty($body['comments'])) $params['comments'] = $body['comments'];
            $resp = callProviderApi($provider['base_url'], $provider['api_key'], $params, 30);
            if ($resp && isset($resp['order'])) {
                $db->prepare('UPDATE orders SET provider_order_id = ?, status = ?, updated_at = NOW() WHERE id = ?')
                   ->execute([(string)$resp['order'], 'processing', $newOrderId]);
                $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')
                   ->execute([$newOrderId, 'processing', 'Provider order ID: ' . $resp['order']]);
            }
        }
    }

    $stmt = $db->prepare("SELECT *, (SELECT name FROM services WHERE id = service_id) AS service_name FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$newOrderId]);
    jsonOut($stmt->fetch(), 201);
}

// POST /api/orders/:id/refill
if ($method === 'POST' && $orderId && $sub === 'refill') {
    $stmt = $db->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$orderId, $uid]);
    $order = $stmt->fetch();
    if (!$order) jsonError('Order not found', 404);
    $svc = $db->prepare('SELECT refill FROM services WHERE id = ? LIMIT 1');
    $svc->execute([$order['service_id']]);
    $service = $svc->fetch();
    if (!($service['refill'] ?? false)) jsonError('This service does not support refill');
    $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')->execute([$orderId, 'refill_requested', 'Refill requested by user']);
    jsonOut(['success' => true, 'message' => 'Refill requested']);
}

// POST /api/orders/:id/cancel
if ($method === 'POST' && $orderId && $sub === 'cancel') {
    $stmt = $db->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$orderId, $uid]);
    $order = $stmt->fetch();
    if (!$order) jsonError('Order not found', 404);
    if (!in_array($order['status'], ['pending', 'processing'])) jsonError('Order cannot be cancelled');
    $svc = $db->prepare('SELECT cancel FROM services WHERE id = ? LIMIT 1');
    $svc->execute([$order['service_id']]);
    $service = $svc->fetch();
    if (!($service['cancel'] ?? false)) jsonError('This service does not support cancellation');
    $db->prepare("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?")->execute([$orderId]);
    $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')->execute([$orderId, 'cancelled', 'Cancelled by user']);
    jsonOut(['success' => true, 'message' => 'Order cancelled']);
}

// POST /api/orders/mass — batch create
if ($method === 'POST' && $isMass) {
    $body   = getBody();
    $orders = $body['orders'] ?? [];
    if (!is_array($orders)) jsonError('orders must be an array');
    $results = [];
    foreach ($orders as $i => $item) {
        $svcId = (int)($item['serviceId'] ?? 0);
        $lnk   = trim($item['link'] ?? '');
        $qty   = (int)($item['quantity'] ?? 0);
        if (!$svcId || !$lnk || !$qty) { $results[] = ['index'=>$i,'success'=>false,'error'=>'Missing required fields']; continue; }
        $svc = $db->prepare("SELECT * FROM services WHERE id = ? AND status = 'active' LIMIT 1");
        $svc->execute([$svcId]); $service = $svc->fetch();
        if (!$service) { $results[] = ['index'=>$i,'success'=>false,'error'=>'Service not found']; continue; }
        if ($qty < (int)$service['min'] || $qty > (int)$service['max']) { $results[] = ['index'=>$i,'success'=>false,'error'=>'Invalid quantity']; continue; }
        $charge = round(((float)$service['rate'] * $qty) / 1000, 4);
        try {
            $db->beginTransaction();
            $u = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE LIMIT 1');
            $u->execute([$uid]); $user = $u->fetch();
            if ((float)$user['balance'] < $charge) { $db->rollBack(); $results[] = ['index'=>$i,'success'=>false,'error'=>'Insufficient balance']; continue; }
            $nb = round((float)$user['balance'] - $charge, 4);
            $db->prepare('INSERT INTO orders (user_id,service_id,link,quantity,charge,status) VALUES (?,?,?,?,?,?)')->execute([$uid,$svcId,$lnk,$qty,number_format($charge,4,'.',''),'pending']);
            $oid = (int)$db->lastInsertId('orders_id_seq');
            $db->prepare('UPDATE users SET balance=? WHERE id=?')->execute([number_format($nb,4,'.',''),$uid]);
            $db->prepare('INSERT INTO transactions (user_id,type,amount,balance_after,description,reference_id) VALUES (?,?,?,?,?,?)')->execute([$uid,'order',number_format(-$charge,4,'.',''),number_format($nb,4,'.',''),("Order #$oid"),$oid]);
            $db->commit();
            $results[] = ['index'=>$i,'success'=>true,'orderId'=>$oid];
        } catch (Throwable $e) { $db->rollBack(); $results[] = ['index'=>$i,'success'=>false,'error'=>'Order failed']; }
    }
    jsonOut(['results' => $results]);
}

jsonError('Not found', 404);
