<?php
/** Admin routes — admin required */

$sess   = requireAdmin();
$method = method();
$seg    = $GLOBALS['routeSegments'] ?? [];
$section= $seg[1] ?? '';   // stats, users, orders, services, categories, providers, deposits, tickets, settings, announcements
$itemId = (int)($seg[2] ?? 0);
$sub    = $seg[3] ?? '';
$db     = getDB();

// ── STATS ─────────────────────────────────────────────────────────────────────
if ($section === 'stats' && $method === 'GET') {
    $today = date('Y-m-d');
    jsonOut([
        'totalUsers'     => (int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn(),
        'totalOrders'    => (int)$db->query('SELECT COUNT(*) FROM orders')->fetchColumn(),
        'totalRevenue'   => (float)$db->query("SELECT COALESCE(SUM(charge::numeric),0) FROM orders")->fetchColumn(),
        'pendingDeposits'=> (int)$db->query("SELECT COUNT(*) FROM deposits WHERE status='pending'")->fetchColumn(),
        'openTickets'    => (int)$db->query("SELECT COUNT(*) FROM tickets WHERE status='open'")->fetchColumn(),
        'activeServices' => (int)$db->query("SELECT COUNT(*) FROM services WHERE status='active'")->fetchColumn(),
        'todayOrders'    => (int)$db->query("SELECT COUNT(*) FROM orders WHERE created_at >= '$today'")->fetchColumn(),
        'todayRevenue'   => (float)$db->query("SELECT COALESCE(SUM(charge::numeric),0) FROM orders WHERE created_at >= '$today'")->fetchColumn(),
    ]);
}

// ── USERS ─────────────────────────────────────────────────────────────────────
if ($section === 'users') {
    if ($method === 'GET' && !$itemId) {
        $p      = paginate();
        $where  = '1=1'; $params = [];
        if (!empty($_GET['search'])) { $where .= ' AND (email ILIKE ? OR username ILIKE ?)'; $params[] = '%' . $_GET['search'] . '%'; $params[] = '%' . $_GET['search'] . '%'; }
        if ($_GET['status'] === 'banned') { $where .= ' AND banned = true'; }
        if ($_GET['status'] === 'active') { $where .= ' AND banned = false'; }
        $total = (int)$db->prepare("SELECT COUNT(*) FROM users WHERE $where")->execute($params) ? (function() use ($db, $where, $params) { $s = $db->prepare("SELECT COUNT(*) FROM users WHERE $where"); $s->execute($params); return (int)$s->fetchColumn(); })() : 0;
        $stmt  = $db->prepare(
            "SELECT id, email, username, role, balance, banned, created_at,
                    (SELECT COUNT(*) FROM orders WHERE user_id = users.id) AS total_orders,
                    (SELECT COALESCE(SUM(charge::numeric),0) FROM orders WHERE user_id = users.id) AS total_spend
             FROM users WHERE $where ORDER BY created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->execute(array_merge($params, [$p['limit'], $p['offset']]));
        $c = $db->prepare("SELECT COUNT(*) FROM users WHERE $where"); $c->execute($params);
        $total = (int)$c->fetchColumn();
        jsonOut(['users' => $stmt->fetchAll(), 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }
    if ($method === 'GET' && $itemId && !$sub) {
        $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1'); $stmt->execute([$itemId]);
        $user = $stmt->fetch();
        if (!$user) jsonError('Not found', 404);
        unset($user['password_hash']);
        $orders = $db->prepare("SELECT o.id, o.service_id, (SELECT name FROM services WHERE id=o.service_id) AS service_name, o.link, o.quantity, o.charge, o.status, o.created_at FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 5"); $orders->execute([$itemId]);
        $txs    = $db->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5'); $txs->execute([$itemId]);
        jsonOut(array_merge($user, ['recentOrders' => $orders->fetchAll(), 'recentTransactions' => $txs->fetchAll()]));
    }
    if ($method === 'PATCH' && $itemId) {
        $body = getBody();
        $sets = ['updated_at = NOW()']; $params = [];
        $valid_roles = ['user','admin','reseller'];
        if (isset($body['username'])) { $sets[] = 'username = ?'; $params[] = substr((string)$body['username'], 0, 30); }
        if (isset($body['role']) && in_array($body['role'], $valid_roles)) { $sets[] = 'role = ?'; $params[] = $body['role']; }
        if (isset($body['banned'])) { $sets[] = 'banned = ?'; $params[] = (bool)$body['banned'] ? 'true' : 'false'; }
        $params[] = $itemId;
        $stmt = $db->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ? RETURNING *'); $stmt->execute($params);
        $user = $stmt->fetch();
        if (!$user) jsonError('Not found', 404);
        unset($user['password_hash']);
        jsonOut($user);
    }
    if ($method === 'POST' && $itemId && $sub === 'balance') {
        $body   = getBody();
        $amount = (float)($body['amount'] ?? 0);
        $note   = $body['note'] ?? 'Admin adjustment';
        if (!is_numeric($body['amount'] ?? '')) jsonError('amount must be a number');
        if (abs($amount) > 1000000) jsonError('Amount exceeds maximum allowed adjustment');
        try {
            $db->beginTransaction();
            $u = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE LIMIT 1'); $u->execute([$itemId]);
            $user = $u->fetch();
            if (!$user) { $db->rollBack(); jsonError('User not found', 404); }
            $newBalance = round((float)$user['balance'] + $amount, 4);
            if ($newBalance < 0) { $db->rollBack(); jsonError('Balance cannot go negative'); }
            $db->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([number_format($newBalance,4,'.',''), $itemId]);
            $db->prepare('INSERT INTO transactions (user_id,type,amount,balance_after,description) VALUES (?,?,?,?,?)')->execute([$itemId,'adjustment',number_format($amount,4,'.',''),number_format($newBalance,4,'.',''),$note]);
            $db->commit();
        } catch (Throwable $e) { $db->rollBack(); jsonError($e->getMessage()); }
        jsonOut(['success' => true, 'message' => 'Balance adjusted']);
    }
}

// ── ORDERS ────────────────────────────────────────────────────────────────────
if ($section === 'orders') {
    if ($method === 'GET') {
        $p     = paginate();
        $where = '1=1'; $params = [];
        if (!empty($_GET['status']))    { $where .= ' AND o.status = ?';    $params[] = $_GET['status']; }
        if (!empty($_GET['userId']))    { $where .= ' AND o.user_id = ?';   $params[] = (int)$_GET['userId']; }
        if (!empty($_GET['serviceId'])) { $where .= ' AND o.service_id = ?';$params[] = (int)$_GET['serviceId']; }
        if (!empty($_GET['search']))    { $where .= ' AND o.link ILIKE ?';  $params[] = '%' . $_GET['search'] . '%'; }
        if (!empty($_GET['dateFrom']))  { $where .= ' AND o.created_at >= ?';$params[] = $_GET['dateFrom']; }
        if (!empty($_GET['dateTo']))    { $where .= ' AND o.created_at <= ?';$params[] = $_GET['dateTo']; }
        $c = $db->prepare("SELECT COUNT(*) FROM orders o WHERE $where"); $c->execute($params); $total = (int)$c->fetchColumn();
        $stmt = $db->prepare("SELECT o.*, (SELECT name FROM services WHERE id=o.service_id) AS service_name, (SELECT username FROM users WHERE id=o.user_id) AS username FROM orders o WHERE $where ORDER BY o.created_at DESC LIMIT ? OFFSET ?");
        $stmt->execute(array_merge($params, [$p['limit'], $p['offset']]));
        jsonOut(['orders' => $stmt->fetchAll(), 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }
    if ($method === 'PATCH' && $itemId) {
        $body   = getBody();
        $status = $body['status'] ?? '';
        $valid  = ['pending','processing','active','partial','completed','cancelled','failed','refunded'];
        if (!$status) jsonError('status required');
        if (!in_array($status, $valid)) jsonError('Invalid status. Must be one of: ' . implode(', ', $valid));
        $sets = ['status = ?', 'updated_at = NOW()']; $params = [$status];
        if (isset($body['startCount'])) { $sets[] = 'start_count = ?'; $params[] = (int)$body['startCount']; }
        if (isset($body['remains']))    { $sets[] = 'remains = ?';     $params[] = (int)$body['remains']; }
        $params[] = $itemId;
        $stmt = $db->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ? RETURNING *'); $stmt->execute($params);
        $order = $stmt->fetch();
        if (!$order) jsonError('Not found', 404);
        $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')->execute([$itemId, $status, $body['note'] ?? "Status changed to $status by admin"]);
        jsonOut($order);
    }
}

// ── SERVICES ──────────────────────────────────────────────────────────────────
if ($section === 'services') {
    if ($method === 'GET') {
        $where = '1=1'; $params = [];
        if (!empty($_GET['categoryId'])) { $where .= ' AND s.category_id = ?';  $params[] = (int)$_GET['categoryId']; }
        if (!empty($_GET['providerId'])) { $where .= ' AND s.provider_id = ?';   $params[] = (int)$_GET['providerId']; }
        if (!empty($_GET['search']))     { $where .= ' AND s.name ILIKE ?';      $params[] = '%' . $_GET['search'] . '%'; }
        if (!empty($_GET['status']))     { $where .= ' AND s.status = ?';        $params[] = $_GET['status']; }
        $stmt = $db->prepare("SELECT s.*, (SELECT name FROM categories WHERE id=s.category_id) AS category_name, (SELECT name FROM providers WHERE id=s.provider_id) AS provider_name FROM services s WHERE $where ORDER BY s.sort_order, s.name");
        $stmt->execute($params);
        jsonOut(['services' => $stmt->fetchAll()]);
    }
    if ($method === 'POST' && !$itemId) {
        $body = getBody();
        if (!($body['name'] ?? '') || !($body['categoryId'] ?? '') || !isset($body['rate']) || !isset($body['min']) || !isset($body['max'])) {
            jsonError('name, categoryId, rate, min, max are required');
        }
        $db->prepare(
            "INSERT INTO services (name,category_id,provider_id,provider_service_id,type,rate,min,max,description,sort_order,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
        )->execute([
            substr($body['name'],0,200), (int)$body['categoryId'],
            !empty($body['providerId']) ? (int)$body['providerId'] : null,
            !empty($body['providerServiceId']) ? $body['providerServiceId'] : null,
            $body['type'] ?? 'default', (string)$body['rate'], (int)$body['min'], (int)$body['max'],
            !empty($body['description']) ? substr($body['description'],0,2000) : null,
            (int)($body['sortOrder'] ?? 0), in_array($body['status']??'',['active','inactive']) ? $body['status'] : 'active',
        ]);
        $id   = (int)$db->lastInsertId('services_id_seq');
        $stmt = $db->prepare('SELECT * FROM services WHERE id = ? LIMIT 1'); $stmt->execute([$id]);
        jsonOut($stmt->fetch(), 201);
    }
    if ($method === 'PATCH' && $itemId) {
        $body = getBody();
        $sets = ['updated_at = NOW()']; $params = [];
        $map  = ['name'=>['string',200],'type'=>'string','rate'=>'string','description'=>['string',2000]];
        if (isset($body['name']))              { $sets[] = 'name = ?';               $params[] = substr($body['name'],0,200); }
        if (isset($body['categoryId']))        { $sets[] = 'category_id = ?';        $params[] = (int)$body['categoryId']; }
        if (isset($body['providerId']))        { $sets[] = 'provider_id = ?';        $params[] = $body['providerId'] ? (int)$body['providerId'] : null; }
        if (isset($body['providerServiceId'])) { $sets[] = 'provider_service_id = ?';$params[] = $body['providerServiceId'] ?: null; }
        if (isset($body['type']))              { $sets[] = 'type = ?';               $params[] = $body['type']; }
        if (isset($body['rate']))              { $sets[] = 'rate = ?';               $params[] = (string)$body['rate']; }
        if (isset($body['min']))               { $sets[] = 'min = ?';               $params[] = (int)$body['min']; }
        if (isset($body['max']))               { $sets[] = 'max = ?';               $params[] = (int)$body['max']; }
        if (isset($body['description']))       { $sets[] = 'description = ?';        $params[] = $body['description'] ? substr($body['description'],0,2000) : null; }
        if (isset($body['sortOrder']))         { $sets[] = 'sort_order = ?';         $params[] = (int)$body['sortOrder']; }
        if (isset($body['status']))            { $sets[] = 'status = ?';             $params[] = in_array($body['status'],['active','inactive']) ? $body['status'] : 'active'; }
        $params[] = $itemId;
        $stmt = $db->prepare('UPDATE services SET ' . implode(', ', $sets) . ' WHERE id = ? RETURNING *'); $stmt->execute($params);
        $svc  = $stmt->fetch();
        if (!$svc) jsonError('Not found', 404);
        jsonOut($svc);
    }
    if ($method === 'DELETE' && $itemId) {
        $db->prepare("UPDATE services SET status = 'inactive' WHERE id = ?")->execute([$itemId]);
        jsonOut(['success' => true, 'message' => 'Service deactivated']);
    }
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
if ($section === 'categories') {
    if ($method === 'GET') {
        $rows = $db->query("SELECT c.*, (SELECT COUNT(*) FROM services WHERE category_id = c.id) AS service_count FROM categories c ORDER BY c.sort_order, c.name")->fetchAll();
        jsonOut(['categories' => $rows]);
    }
    if ($method === 'POST' && !$itemId && $sub !== 'reorder') {
        $body = getBody();
        if (empty($body['name'])) jsonError('name is required');
        $db->prepare('INSERT INTO categories (name, description, sort_order, active) VALUES (?,?,?,?)')->execute([substr($body['name'],0,100), $body['description'] ? substr($body['description'],0,500) : null, (int)($body['sortOrder']??0), isset($body['active']) ? (bool)$body['active'] : true]);
        $id   = (int)$db->lastInsertId('categories_id_seq');
        $stmt = $db->prepare('SELECT * FROM categories WHERE id = ? LIMIT 1'); $stmt->execute([$id]);
        jsonOut($stmt->fetch(), 201);
    }
    if ($method === 'POST' && $sub === 'reorder') {
        $orders = getBody()['orders'] ?? [];
        foreach ($orders as $o) $db->prepare('UPDATE categories SET sort_order = ?, updated_at = NOW() WHERE id = ?')->execute([(int)$o['sortOrder'], (int)$o['id']]);
        jsonOut(['ok' => true]);
    }
    if ($method === 'PATCH' && $itemId) {
        $body = getBody();
        $sets = ['updated_at = NOW()']; $params = [];
        if (isset($body['name']))       { $sets[] = 'name = ?';       $params[] = substr($body['name'],0,100); }
        if (isset($body['description'])) { $sets[] = 'description = ?'; $params[] = $body['description'] ? substr($body['description'],0,500) : null; }
        if (isset($body['sortOrder']))   { $sets[] = 'sort_order = ?'; $params[] = (int)$body['sortOrder']; }
        if (isset($body['active']))      { $sets[] = 'active = ?';     $params[] = (bool)$body['active'] ? 'true' : 'false'; }
        $params[] = $itemId;
        $stmt = $db->prepare('UPDATE categories SET ' . implode(', ', $sets) . ' WHERE id = ? RETURNING *'); $stmt->execute($params);
        $cat  = $stmt->fetch();
        if (!$cat) jsonError('Not found', 404);
        jsonOut($cat);
    }
    if ($method === 'DELETE' && $itemId) {
        $db->prepare('UPDATE categories SET active = false WHERE id = ?')->execute([$itemId]);
        jsonOut(['success' => true, 'message' => 'Category deactivated']);
    }
}

// ── PROVIDERS ─────────────────────────────────────────────────────────────────
if ($section === 'providers') {
    if ($method === 'GET' && !$itemId) {
        $rows = $db->query("SELECT p.id, p.name, p.base_url, p.status, p.markup_percent, p.last_sync_at, p.notes, p.created_at, (SELECT COUNT(*) FROM services WHERE provider_id = p.id) AS service_count FROM providers p ORDER BY p.name")->fetchAll();
        $rows = array_map(fn($r) => array_merge($r, ['url' => $r['base_url']]), $rows);
        jsonOut(['providers' => $rows]);
    }
    if ($method === 'POST' && !$itemId) {
        $body = getBody();
        $db->prepare('INSERT INTO providers (name, base_url, api_key, notes, markup_percent) VALUES (?,?,?,?,?)')->execute([$body['name']??'', $body['url']??'', $body['apiKey']??'', $body['notes']??'', (string)($body['markupPercent']??25)]);
        $id   = (int)$db->lastInsertId('providers_id_seq');
        $stmt = $db->prepare('SELECT id,name,status,markup_percent,notes,created_at FROM providers WHERE id = ? LIMIT 1'); $stmt->execute([$id]);
        $p    = $stmt->fetch();
        jsonOut(array_merge($p, ['url' => $body['url']]), 201);
    }
    if ($method === 'PATCH' && $itemId) {
        $body = getBody();
        $sets = ['updated_at = NOW()']; $params = [];
        if (isset($body['name']))         { $sets[] = 'name = ?';         $params[] = $body['name']; }
        if (isset($body['url']))          { $sets[] = 'base_url = ?';     $params[] = $body['url']; }
        if (!empty($body['apiKey']))      { $sets[] = 'api_key = ?';      $params[] = $body['apiKey']; }
        if (isset($body['notes']))        { $sets[] = 'notes = ?';        $params[] = $body['notes']; }
        if (isset($body['status']))       { $sets[] = 'status = ?';       $params[] = $body['status']; }
        if (isset($body['markupPercent'])){ $sets[] = 'markup_percent = ?';$params[] = (string)$body['markupPercent']; }
        $params[] = $itemId;
        $stmt = $db->prepare('UPDATE providers SET ' . implode(', ', $sets) . ' WHERE id = ? RETURNING id, name, base_url, status, markup_percent, notes, created_at'); $stmt->execute($params);
        $p    = $stmt->fetch();
        if (!$p) jsonError('Not found', 404);
        jsonOut(array_merge($p, ['url' => $p['base_url']]));
    }
    if ($method === 'DELETE' && $itemId) {
        $db->prepare('DELETE FROM providers WHERE id = ?')->execute([$itemId]);
        jsonOut(['success' => true]);
    }
    if ($method === 'POST' && $itemId && $sub === 'test') {
        $stmt = $db->prepare('SELECT * FROM providers WHERE id = ? LIMIT 1'); $stmt->execute([$itemId]);
        $provider = $stmt->fetch();
        if (!$provider) jsonError('Not found', 404);
        $resp = callProviderApi($provider['base_url'], $provider['api_key'], ['action' => 'balance'], 15);
        if ($resp && isset($resp['balance'])) {
            $db->prepare("UPDATE providers SET status = 'active', updated_at = NOW() WHERE id = ?")->execute([$itemId]);
            jsonOut(['success' => true, 'balance' => $resp['balance']]);
        }
        jsonOut(['success' => false, 'error' => $resp['error'] ?? 'Không nhận được số dư từ provider']);
    }
    if ($method === 'POST' && $itemId && $sub === 'sync') {
        $stmt = $db->prepare('SELECT * FROM providers WHERE id = ? LIMIT 1'); $stmt->execute([$itemId]);
        $provider = $stmt->fetch();
        if (!$provider) jsonError('Not found', 404);
        $result = syncProvider($db, $provider);
        jsonOut(array_merge(['success' => !isset($result['error'])], $result));
    }
}

// ── DEPOSITS ──────────────────────────────────────────────────────────────────
if ($section === 'deposits') {
    if ($method === 'GET') {
        $p     = paginate();
        $where = '1=1'; $params = [];
        if (!empty($_GET['status'])) { $where .= ' AND d.status = ?'; $params[] = $_GET['status']; }
        if (!empty($_GET['userId'])) { $where .= ' AND d.user_id = ?'; $params[] = (int)$_GET['userId']; }
        $c = $db->prepare("SELECT COUNT(*) FROM deposits d WHERE $where"); $c->execute($params); $total = (int)$c->fetchColumn();
        $stmt = $db->prepare("SELECT d.*, (SELECT username FROM users WHERE id = d.user_id) AS username FROM deposits d WHERE $where ORDER BY d.created_at DESC LIMIT ? OFFSET ?");
        $stmt->execute(array_merge($params, [$p['limit'], $p['offset']]));
        jsonOut(['deposits' => $stmt->fetchAll(), 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }
    if ($method === 'POST' && $itemId && in_array($sub, ['approve','reject'])) {
        $stmt = $db->prepare('SELECT * FROM deposits WHERE id = ? LIMIT 1'); $stmt->execute([$itemId]);
        $dep  = $stmt->fetch();
        if (!$dep) jsonError('Not found', 404);
        if ($dep['status'] !== 'pending') jsonError('Deposit already processed');
        $body = getBody();
        if ($sub === 'approve') {
            try {
                $db->beginTransaction();
                $u = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE LIMIT 1'); $u->execute([$dep['user_id']]);
                $user = $u->fetch();
                $newBalance = round((float)$user['balance'] + (float)$dep['amount'], 4);
                $db->prepare("UPDATE deposits SET status='approved', admin_note=?, updated_at=NOW() WHERE id=?")->execute([$body['adminNote']??null, $itemId]);
                $db->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([number_format($newBalance,4,'.',''), $dep['user_id']]);
                $db->prepare('INSERT INTO transactions (user_id,type,amount,balance_after,description,reference_id) VALUES (?,?,?,?,?,?)')->execute([$dep['user_id'],'deposit',$dep['amount'],number_format($newBalance,4,'.',''),"Nạp tiền #$itemId duyệt bởi admin",$itemId]);
                $db->prepare('INSERT INTO notifications (user_id,type,title,message) VALUES (?,?,?,?)')->execute([$dep['user_id'],'deposit','Nạp tiền thành công',"Yêu cầu nạp $" . $dep['amount'] . " đã được duyệt"]);
                $db->commit();
                sendTelegram("✅ <b>Duyệt nạp tiền #{$itemId}</b>\n👤 User ID: {$dep['user_id']}\n💵 Số tiền: \${$dep['amount']}");
            } catch (Throwable $e) { $db->rollBack(); jsonError('Có lỗi xảy ra'); }
        } else {
            $db->prepare("UPDATE deposits SET status='rejected', admin_note=?, updated_at=NOW() WHERE id=?")->execute([$body['adminNote']??'Từ chối bởi admin', $itemId]);
            $db->prepare('INSERT INTO notifications (user_id,type,title,message) VALUES (?,?,?,?)')->execute([$dep['user_id'],'deposit','Yêu cầu nạp tiền bị từ chối',"Yêu cầu nạp $" . $dep['amount'] . " đã bị từ chối"]);
            sendTelegram("❌ <b>Từ chối nạp tiền #{$itemId}</b>\n👤 User ID: {$dep['user_id']}\n💵 Số tiền: \${$dep['amount']}");
        }
        jsonOut(['success' => true, 'message' => $sub === 'approve' ? 'Đã duyệt' : 'Đã từ chối']);
    }
}

// ── TICKETS ───────────────────────────────────────────────────────────────────
if ($section === 'tickets') {
    if ($method === 'GET' && !$itemId) {
        $p     = paginate();
        $where = '1=1'; $params = [];
        if (!empty($_GET['status'])) { $where .= ' AND t.status = ?'; $params[] = $_GET['status']; }
        $c = $db->prepare("SELECT COUNT(*) FROM tickets t WHERE $where"); $c->execute($params); $total = (int)$c->fetchColumn();
        $stmt = $db->prepare("SELECT t.*, (SELECT username FROM users WHERE id = t.user_id) AS username FROM tickets t WHERE $where ORDER BY t.updated_at DESC LIMIT ? OFFSET ?");
        $stmt->execute(array_merge($params, [$p['limit'], $p['offset']]));
        jsonOut(['tickets' => $stmt->fetchAll(), 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }
    if ($method === 'GET' && $itemId) {
        $stmt = $db->prepare('SELECT * FROM tickets WHERE id = ? LIMIT 1'); $stmt->execute([$itemId]);
        $ticket = $stmt->fetch();
        if (!$ticket) jsonError('Not found', 404);
        $msgs = $db->prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at'); $msgs->execute([$itemId]);
        jsonOut(array_merge($ticket, ['messages' => $msgs->fetchAll()]));
    }
    if ($method === 'PATCH' && $itemId) {
        $body = getBody();
        $valid = ['open','pending','closed'];
        $status = $body['status'] ?? '';
        if ($status && in_array($status, $valid)) {
            $db->prepare('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?')->execute([$status, $itemId]);
        }
        $stmt = $db->prepare('SELECT * FROM tickets WHERE id = ? LIMIT 1'); $stmt->execute([$itemId]);
        jsonOut($stmt->fetch());
    }
    if ($method === 'POST' && $itemId && $sub === 'messages') {
        $body    = getBody();
        $message = trim($body['message'] ?? '');
        if (!$message) jsonError('Message is required');
        $stmt = $db->prepare('SELECT * FROM tickets WHERE id = ? LIMIT 1'); $stmt->execute([$itemId]);
        $ticket = $stmt->fetch();
        if (!$ticket) jsonError('Not found', 404);
        $uid = (int)$sess['userId'];
        $db->prepare('INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?,?,?,true)')->execute([$itemId, $uid, $message]);
        $msgId = (int)$db->lastInsertId('ticket_messages_id_seq');
        $db->prepare("UPDATE tickets SET status = 'open', updated_at = NOW() WHERE id = ?")->execute([$itemId]);
        $stmt = $db->prepare('SELECT * FROM ticket_messages WHERE id = ? LIMIT 1'); $stmt->execute([$msgId]);
        jsonOut($stmt->fetch(), 201);
    }
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
if ($section === 'settings') {
    if ($method === 'GET') {
        $rows = $db->query('SELECT key, value FROM site_settings')->fetchAll();
        $out  = []; foreach ($rows as $r) $out[$r['key']] = $r['value'];
        jsonOut($out);
    }
    if ($method === 'POST') {
        $body = getBody();
        foreach ($body as $key => $value) {
            $key = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$key);
            if (!$key) continue;
            $exists = $db->prepare('SELECT 1 FROM site_settings WHERE key = ? LIMIT 1'); $exists->execute([$key]);
            if ($exists->fetchColumn()) {
                $db->prepare('UPDATE site_settings SET value = ?, updated_at = NOW() WHERE key = ?')->execute([(string)$value, $key]);
            } else {
                $db->prepare('INSERT INTO site_settings (key, value) VALUES (?,?)')->execute([$key, (string)$value]);
            }
        }
        jsonOut(['success' => true, 'message' => 'Settings saved']);
    }
}

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────
if ($section === 'announcements') {
    if ($method === 'GET') {
        $rows = $db->query('SELECT * FROM announcements ORDER BY created_at DESC')->fetchAll();
        jsonOut(['announcements' => $rows]);
    }
    if ($method === 'POST' && !$itemId) {
        $body = getBody();
        $type = in_array($body['type']??'',['info','warning','maintenance','success']) ? $body['type'] : 'info';
        $db->prepare("INSERT INTO announcements (title, content, type, active) VALUES (?,?,?,?)")->execute([$body['title']??'', $body['content']??'', $type, isset($body['active']) ? (bool)$body['active'] : true]);
        $id   = (int)$db->lastInsertId('announcements_id_seq');
        $stmt = $db->prepare('SELECT * FROM announcements WHERE id = ? LIMIT 1'); $stmt->execute([$id]);
        jsonOut($stmt->fetch(), 201);
    }
    if ($method === 'PATCH' && $itemId) {
        $body = getBody();
        $sets = ['updated_at = NOW()']; $params = [];
        if (isset($body['title']))   { $sets[] = 'title = ?';  $params[] = $body['title']; }
        if (isset($body['content'])) { $sets[] = 'content = ?';$params[] = $body['content']; }
        if (isset($body['type']))    { $sets[] = 'type = ?';   $params[] = $body['type']; }
        if (isset($body['active']))  { $sets[] = 'active = ?'; $params[] = (bool)$body['active'] ? 'true' : 'false'; }
        $params[] = $itemId;
        $stmt = $db->prepare('UPDATE announcements SET ' . implode(', ', $sets) . ' WHERE id = ? RETURNING *'); $stmt->execute($params);
        jsonOut($stmt->fetch());
    }
    if ($method === 'DELETE' && $itemId) {
        $db->prepare('DELETE FROM announcements WHERE id = ?')->execute([$itemId]);
        jsonOut(['success' => true]);
    }
}

// ── DB Status ─────────────────────────────────────────────────────────────────
if ($section === 'db-status' && $method === 'GET') {
    $start = microtime(true);
    $db->query('SELECT 1');
    $ms = round((microtime(true) - $start) * 1000);
    $uc = (int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn();
    jsonOut(['connected' => true, 'latencyMs' => $ms, 'userCount' => $uc]);
}

function syncProvider(PDO $db, array $provider): array {
    $markup   = 1 + ((float)($provider['markup_percent'] ?? 25)) / 100;
    $services = callProviderApi($provider['base_url'], $provider['api_key'], ['action' => 'services'], 90);
    if (!is_array($services)) return ['added'=>0,'updated'=>0,'total'=>0,'error'=>'Provider returned invalid response'];

    $catCache = [];
    $getOrCreateCategory = function(string $name) use ($db, &$catCache): int {
        $key = trim($name) ?: 'General';
        if (isset($catCache[$key])) return $catCache[$key];
        $s = $db->prepare('SELECT id FROM categories WHERE name = ? LIMIT 1'); $s->execute([$key]);
        $row = $s->fetch();
        if ($row) { $catCache[$key] = (int)$row['id']; return (int)$row['id']; }
        $count = (int)$db->query('SELECT COUNT(*) FROM categories')->fetchColumn();
        $db->prepare('INSERT INTO categories (name, description, sort_order) VALUES (?,?,?)')->execute([$key, '', $count + 1]);
        $id = (int)$db->lastInsertId('categories_id_seq');
        $catCache[$key] = $id; return $id;
    };

    $added = $updated = 0;
    foreach ($services as $s) {
        try {
            $psid    = (string)$s['service'];
            $newRate = number_format((float)$s['rate'] * $markup, 6, '.', '');
            $min = (int)($s['min']??10) ?: 10; $max = (int)($s['max']??100000) ?: 100000;
            $name  = $s['name'] ?? "Service #$psid";
            $catId = $getOrCreateCategory($s['category'] ?? 'General');
            $exist = $db->prepare('SELECT id FROM services WHERE provider_service_id = ? AND provider_id = ? LIMIT 1');
            $exist->execute([$psid, $provider['id']]);
            $row = $exist->fetch();
            if ($row) {
                $db->prepare("UPDATE services SET rate=?,min=?,max=?,name=?,category_id=?,status='active',updated_at=NOW() WHERE id=?")->execute([$newRate,$min,$max,$name,$catId,$row['id']]);
                $updated++;
            } else {
                $db->prepare("INSERT INTO services (category_id,name,description,provider_id,provider_service_id,type,rate,min,max,status,refill,cancel) VALUES (?,?,?,?,?,'default',?,?,?,'active',?,?)")
                   ->execute([$catId,$name,'',$provider['id'],$psid,$newRate,$min,$max, in_array($s['refill']??false,[true,'true','1'],true), in_array($s['cancel']??false,[true,'true','1'],true)]);
                $added++;
            }
        } catch (Throwable) {}
    }
    $db->prepare("UPDATE providers SET last_sync_at=NOW(),status='active',updated_at=NOW() WHERE id=?")->execute([$provider['id']]);
    return ['added'=>$added,'updated'=>$updated,'total'=>$added+$updated];
}

jsonError('Not found', 404);
