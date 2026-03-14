<?php
/**
 * Admin Controller — full admin panel API
 * All methods require admin role
 */

declare(strict_types=1);

class AdminController
{
    // ── GET /api/admin/stats ──────────────────────────────────────────────────
    public static function stats(): void
    {
        AuthMiddleware::requireAdmin();
        $today = date('Y-m-d');
        Response::json([
            'totalUsers'      => (int)Database::query('SELECT COUNT(*) FROM users')->fetchColumn(),
            'totalOrders'     => (int)Database::query('SELECT COUNT(*) FROM orders')->fetchColumn(),
            'totalRevenue'    => (float)Database::query('SELECT COALESCE(SUM(charge), 0) FROM orders')->fetchColumn(),
            'pendingDeposits' => (int)Database::query("SELECT COUNT(*) FROM deposits WHERE status='pending'")->fetchColumn(),
            'openTickets'     => (int)Database::query("SELECT COUNT(*) FROM tickets WHERE status='open'")->fetchColumn(),
            'activeServices'  => (int)Database::query("SELECT COUNT(*) FROM services WHERE status='active'")->fetchColumn(),
            'todayOrders'     => (int)Database::query("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = ?", [$today])->fetchColumn(),
            'todayRevenue'    => (float)Database::query("SELECT COALESCE(SUM(charge), 0) FROM orders WHERE DATE(created_at) = ?", [$today])->fetchColumn(),
        ]);
    }

    // ── USERS ─────────────────────────────────────────────────────────────────
    public static function listUsers(): void
    {
        AuthMiddleware::requireAdmin();
        $p      = paginate();
        $where  = '1=1'; $params = [];

        if (!empty($_GET['search'])) {
            $where   .= ' AND (email LIKE ? OR username LIKE ?)';
            $s        = '%' . $_GET['search'] . '%';
            $params[] = $s; $params[] = $s;
        }
        if (($_GET['status'] ?? '') === 'banned') { $where .= ' AND banned = 1'; }
        if (($_GET['status'] ?? '') === 'active')  { $where .= ' AND banned = 0'; }

        $total = (int)Database::query("SELECT COUNT(*) FROM users WHERE $where", $params)->fetchColumn();
        $rows  = Database::query(
            "SELECT u.id, u.email, u.username, u.role, u.balance, u.banned, u.created_at,
                    (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS total_orders,
                    (SELECT COALESCE(SUM(charge), 0) FROM orders WHERE user_id = u.id) AS total_spend
             FROM users u WHERE $where ORDER BY u.created_at DESC LIMIT ? OFFSET ?",
            array_merge($params, [$p['limit'], $p['offset']])
        )->fetchAll();

        Response::json(['users' => $rows, 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }

    public static function getUser(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $user = UserModel::findById($id);
        if (!$user) Response::error('User not found', 404);

        $orders = Database::query(
            'SELECT o.id, s.name AS service_name, o.link, o.quantity, o.charge, o.status, o.created_at
             FROM orders o LEFT JOIN services s ON s.id = o.service_id
             WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 5',
            [$id]
        )->fetchAll();

        $txs = Database::query(
            'SELECT id, type, amount, balance_after, description, created_at
             FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [$id]
        )->fetchAll();

        Response::json(array_merge($user, ['recentOrders' => $orders, 'recentTransactions' => $txs]));
    }

    public static function updateUser(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $body  = getBody();
        $sets  = ['updated_at = NOW()']; $params = [];

        if (isset($body['username'])) { $sets[] = 'username = ?'; $params[] = substr((string)$body['username'], 0, 30); }
        if (isset($body['role']) && in_array($body['role'], ['user', 'admin', 'reseller'], true)) { $sets[] = 'role = ?'; $params[] = $body['role']; }
        if (isset($body['banned'])) { $sets[] = 'banned = ?'; $params[] = (int)filter_var($body['banned'], FILTER_VALIDATE_BOOLEAN); }
        if (count($sets) < 2) Response::error('Nothing to update', 400);

        $params[] = $id;
        Database::query('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
        $user = UserModel::findById($id);
        Response::json($user);
    }

    public static function adjustBalance(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $v = Validator::make(getBody())->numeric('amount', -1000000, 1000000);
        $v->abortIfFails();

        $amount = round((float)$v->get('amount'), 4);
        $note   = substr(trim(getBody()['note'] ?? 'Admin adjustment'), 0, 255);

        try {
            $newBalance = Database::transaction(function (PDO $db) use ($id, $amount): float {
                $stmt = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
                $stmt->execute([$id]);
                $user = $stmt->fetch();
                if (!$user) throw new RuntimeException('User not found');
                $nb = round((float)$user['balance'] + $amount, 4);
                if ($nb < 0) throw new RuntimeException('Balance cannot go negative');
                $db->prepare('UPDATE users SET balance = ?, updated_at = NOW() WHERE id = ?')
                   ->execute([number_format($nb, 4, '.', ''), $id]);
                return $nb;
            });
            UserModel::logTransaction($id, 'adjustment', $amount, $newBalance, $note);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 400);
        }

        Response::success('Balance adjusted');
    }

    // ── ORDERS ─────────────────────────────────────────────────────────────────
    public static function listOrders(): void
    {
        AuthMiddleware::requireAdmin();
        $p      = paginate();
        $where  = '1=1'; $params = [];

        $allowed_status = ['pending','processing','active','partial','completed','cancelled','failed','refunded'];
        if (!empty($_GET['status']) && in_array($_GET['status'], $allowed_status, true)) { $where .= ' AND o.status = ?'; $params[] = $_GET['status']; }
        if (!empty($_GET['userId']))    { $where .= ' AND o.user_id = ?'; $params[] = (int)$_GET['userId']; }
        if (!empty($_GET['serviceId'])) { $where .= ' AND o.service_id = ?'; $params[] = (int)$_GET['serviceId']; }
        if (!empty($_GET['search']))    { $where .= ' AND o.link LIKE ?'; $params[] = '%' . $_GET['search'] . '%'; }

        $total = (int)Database::query("SELECT COUNT(*) FROM orders o WHERE $where", $params)->fetchColumn();
        $rows  = Database::query(
            "SELECT o.*, s.name AS service_name, u.username
             FROM orders o
             LEFT JOIN services s ON s.id = o.service_id
             LEFT JOIN users u ON u.id = o.user_id
             WHERE $where ORDER BY o.created_at DESC LIMIT ? OFFSET ?",
            array_merge($params, [$p['limit'], $p['offset']])
        )->fetchAll();

        Response::json(['orders' => $rows, 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }

    public static function updateOrder(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $body   = getBody();
        $status = $body['status'] ?? '';
        $valid  = ['pending','processing','active','partial','completed','cancelled','failed','refunded'];
        if (!in_array($status, $valid, true)) Response::error('Invalid status', 400);

        OrderModel::updateStatus($id, $status, [
            'startCount' => $body['startCount'] ?? null,
            'remains'    => $body['remains'] ?? null,
        ]);
        OrderModel::log($id, $status, $body['note'] ?? "Status changed to $status by admin");

        Response::json(OrderModel::findById($id));
    }

    // ── SERVICES ───────────────────────────────────────────────────────────────
    public static function listAdminServices(): void
    {
        AuthMiddleware::requireAdmin();
        $where  = '1=1'; $params = [];
        if (!empty($_GET['categoryId'])) { $where .= ' AND s.category_id = ?'; $params[] = (int)$_GET['categoryId']; }
        if (!empty($_GET['providerId'])) { $where .= ' AND s.provider_id = ?'; $params[] = (int)$_GET['providerId']; }
        if (!empty($_GET['search']))     { $where .= ' AND s.name LIKE ?'; $params[] = '%' . $_GET['search'] . '%'; }
        if (!empty($_GET['status']))     { $where .= ' AND s.status = ?'; $params[] = $_GET['status']; }

        $rows = Database::query(
            "SELECT s.*, c.name AS category_name, p.name AS provider_name
             FROM services s
             LEFT JOIN categories c ON c.id = s.category_id
             LEFT JOIN providers p ON p.id = s.provider_id
             WHERE $where ORDER BY s.sort_order ASC, s.name ASC",
            $params
        )->fetchAll();

        Response::json(['services' => $rows]);
    }

    public static function createService(): void
    {
        AuthMiddleware::requireAdmin();
        $v = Validator::make(getBody())
            ->string('name', 1, 200)
            ->integer('categoryId', 1)
            ->numeric('rate', 0)
            ->integer('min', 1)
            ->integer('max', 1)
            ->in('status', ['active', 'inactive'], false)
            ->optional('type', 'default')
            ->optional('description', '')
            ->optional('providerId', null)
            ->optional('providerServiceId', null)
            ->optional('sortOrder', 0);
        $v->abortIfFails();

        $id = Database::insert(
            'INSERT INTO services (name, category_id, provider_id, provider_service_id, type, rate, min, max, description, sort_order, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$v->get('name'), $v->get('categoryId'), $v->get('providerId'), $v->get('providerServiceId'),
             $v->get('type'), number_format((float)$v->get('rate'), 6, '.', ''), $v->get('min'), $v->get('max'),
             $v->get('description'), (int)$v->get('sortOrder'), $v->get('status') ?: 'active']
        );

        Response::json(Database::query('SELECT * FROM services WHERE id = ? LIMIT 1', [$id])->fetch(), 201);
    }

    public static function updateService(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $body = getBody();
        $sets = ['updated_at = NOW()']; $params = [];

        $stringFields = ['name' => 200, 'type' => 50, 'description' => 2000, 'provider_service_id' => 100];
        foreach ($stringFields as $col => $maxLen) {
            $key = lcfirst(str_replace('_', '', ucwords($col, '_')));
            if (isset($body[$key])) { $sets[] = "$col = ?"; $params[] = substr((string)$body[$key], 0, $maxLen); }
        }
        if (isset($body['categoryId']))  { $sets[] = 'category_id = ?';  $params[] = (int)$body['categoryId']; }
        if (isset($body['providerId']))  { $sets[] = 'provider_id = ?';  $params[] = $body['providerId'] ? (int)$body['providerId'] : null; }
        if (isset($body['rate']))        { $sets[] = 'rate = ?';         $params[] = number_format((float)$body['rate'], 6, '.', ''); }
        if (isset($body['min']))         { $sets[] = 'min = ?';          $params[] = (int)$body['min']; }
        if (isset($body['max']))         { $sets[] = 'max = ?';          $params[] = (int)$body['max']; }
        if (isset($body['sortOrder']))   { $sets[] = 'sort_order = ?';   $params[] = (int)$body['sortOrder']; }
        if (isset($body['status']) && in_array($body['status'], ['active', 'inactive'], true)) { $sets[] = 'status = ?'; $params[] = $body['status']; }

        $params[] = $id;
        $affected = Database::query('UPDATE services SET ' . implode(', ', $sets) . ' WHERE id = ?', $params)->rowCount();
        if (!$affected) Response::error('Service not found', 404);

        Response::json(Database::query('SELECT * FROM services WHERE id = ? LIMIT 1', [$id])->fetch());
    }

    // ── CATEGORIES ─────────────────────────────────────────────────────────────
    public static function listAdminCategories(): void
    {
        AuthMiddleware::requireAdmin();
        $rows = Database::query(
            'SELECT c.*, (SELECT COUNT(*) FROM services WHERE category_id = c.id) AS service_count
             FROM categories c ORDER BY c.sort_order ASC, c.name ASC'
        )->fetchAll();
        Response::json(['categories' => $rows]);
    }

    public static function createCategory(): void
    {
        AuthMiddleware::requireAdmin();
        $v = Validator::make(getBody())->string('name', 2, 100)->optional('description', '')->optional('sortOrder', 0);
        $v->abortIfFails();

        $id = Database::insert(
            'INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)',
            [$v->get('name'), $v->get('description'), (int)$v->get('sortOrder')]
        );
        Response::json(Database::query('SELECT * FROM categories WHERE id = ? LIMIT 1', [$id])->fetch(), 201);
    }

    public static function updateCategory(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $body = getBody(); $sets = ['updated_at = NOW()']; $params = [];
        if (isset($body['name']))       { $sets[] = 'name = ?';       $params[] = substr($body['name'], 0, 100); }
        if (isset($body['description'])){ $sets[] = 'description = ?';$params[] = substr($body['description'], 0, 500); }
        if (isset($body['sortOrder']))  { $sets[] = 'sort_order = ?'; $params[] = (int)$body['sortOrder']; }
        if (isset($body['active']))     { $sets[] = 'active = ?';     $params[] = (int)filter_var($body['active'], FILTER_VALIDATE_BOOLEAN); }
        $params[] = $id;
        Database::query('UPDATE categories SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
        Response::json(Database::query('SELECT * FROM categories WHERE id = ? LIMIT 1', [$id])->fetch());
    }

    // ── PROVIDERS ──────────────────────────────────────────────────────────────
    public static function listProviders(): void
    {
        AuthMiddleware::requireAdmin();
        $rows = Database::query(
            'SELECT id, name, base_url AS url, status, markup_percent, last_sync_at, notes, created_at,
                    (SELECT COUNT(*) FROM services WHERE provider_id = providers.id) AS service_count
             FROM providers ORDER BY name ASC'
        )->fetchAll();
        Response::json(['providers' => $rows]);
    }

    public static function createProvider(): void
    {
        AuthMiddleware::requireAdmin();
        $body = getBody();
        if (empty($body['name']) || empty($body['url']) || empty($body['apiKey'])) {
            Response::error('name, url, apiKey are required', 400);
        }
        $id = Database::insert(
            'INSERT INTO providers (name, base_url, api_key, notes, markup_percent) VALUES (?, ?, ?, ?, ?)',
            [$body['name'], $body['url'], $body['apiKey'], $body['notes'] ?? '', (string)($body['markupPercent'] ?? 25)]
        );
        $p = Database::query('SELECT id, name, base_url AS url, status, markup_percent FROM providers WHERE id = ? LIMIT 1', [$id])->fetch();
        Response::json($p, 201);
    }

    public static function updateProvider(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $body = getBody(); $sets = ['updated_at = NOW()']; $params = [];
        if (isset($body['name']))          { $sets[] = 'name = ?';          $params[] = $body['name']; }
        if (isset($body['url']))           { $sets[] = 'base_url = ?';      $params[] = $body['url']; }
        if (!empty($body['apiKey']))       { $sets[] = 'api_key = ?';       $params[] = $body['apiKey']; }
        if (isset($body['notes']))         { $sets[] = 'notes = ?';         $params[] = $body['notes']; }
        if (isset($body['status']))        { $sets[] = 'status = ?';        $params[] = $body['status']; }
        if (isset($body['markupPercent'])) { $sets[] = 'markup_percent = ?';$params[] = (string)$body['markupPercent']; }
        $params[] = $id;
        Database::query('UPDATE providers SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
        Response::json(Database::query('SELECT id, name, base_url AS url, status, markup_percent, notes FROM providers WHERE id = ? LIMIT 1', [$id])->fetch());
    }

    public static function testProvider(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $p = Database::query('SELECT * FROM providers WHERE id = ? LIMIT 1', [$id])->fetch();
        if (!$p) Response::error('Provider not found', 404);

        $resp = callProviderApi($p['base_url'], $p['api_key'], ['action' => 'balance'], 15);
        if ($resp && isset($resp['balance'])) {
            Database::query("UPDATE providers SET status = 'active', updated_at = NOW() WHERE id = ?", [$id]);
            Response::json(['success' => true, 'balance' => $resp['balance']]);
        }
        Response::json(['success' => false, 'error' => $resp['error'] ?? 'No balance returned from provider']);
    }

    public static function syncProvider(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $p = Database::query('SELECT * FROM providers WHERE id = ? LIMIT 1', [$id])->fetch();
        if (!$p) Response::error('Provider not found', 404);

        $result = self::doSync($p);
        Response::json(array_merge(['success' => !isset($result['error'])], $result));
    }

    // ── DEPOSITS ───────────────────────────────────────────────────────────────
    public static function listDeposits(): void
    {
        AuthMiddleware::requireAdmin();
        $p     = paginate(); $where = '1=1'; $params = [];
        if (!empty($_GET['status'])) { $where .= ' AND d.status = ?'; $params[] = $_GET['status']; }
        if (!empty($_GET['userId'])) { $where .= ' AND d.user_id = ?'; $params[] = (int)$_GET['userId']; }
        $total = (int)Database::query("SELECT COUNT(*) FROM deposits d WHERE $where", $params)->fetchColumn();
        $rows  = Database::query(
            "SELECT d.*, u.username FROM deposits d LEFT JOIN users u ON u.id = d.user_id WHERE $where ORDER BY d.created_at DESC LIMIT ? OFFSET ?",
            array_merge($params, [$p['limit'], $p['offset']])
        )->fetchAll();
        Response::json(['deposits' => $rows, 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }

    public static function approveDeposit(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $dep = Database::query('SELECT * FROM deposits WHERE id = ? LIMIT 1', [$id])->fetch();
        if (!$dep) Response::error('Deposit not found', 404);
        if ($dep['status'] !== 'pending') Response::error('Deposit already processed', 400);

        $note = substr(trim(getBody()['adminNote'] ?? ''), 0, 255);

        try {
            $newBalance = UserModel::creditBalance((int)$dep['user_id'], (float)$dep['amount']);
            Database::query("UPDATE deposits SET status='approved', admin_note=?, updated_at=NOW() WHERE id=?", [$note, $id]);
            UserModel::logTransaction((int)$dep['user_id'], 'deposit', (float)$dep['amount'], $newBalance, "Deposit #{$id} approved");
            UserModel::notify((int)$dep['user_id'], 'deposit', 'Nạp tiền thành công', "Yêu cầu nạp \${$dep['amount']} đã được duyệt");
            Telegram::depositApproved($id, (int)$dep['user_id'], (string)$dep['amount']);
        } catch (Throwable $e) {
            Response::error('Failed to approve deposit: ' . $e->getMessage());
        }

        Response::success('Deposit approved');
    }

    public static function rejectDeposit(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $dep = Database::query('SELECT * FROM deposits WHERE id = ? LIMIT 1', [$id])->fetch();
        if (!$dep) Response::error('Deposit not found', 404);
        if ($dep['status'] !== 'pending') Response::error('Deposit already processed', 400);

        $note = substr(trim(getBody()['adminNote'] ?? 'Rejected by admin'), 0, 255);
        Database::query("UPDATE deposits SET status='rejected', admin_note=?, updated_at=NOW() WHERE id=?", [$note, $id]);
        UserModel::notify((int)$dep['user_id'], 'deposit', 'Yêu cầu nạp tiền bị từ chối', "Yêu cầu nạp \${$dep['amount']} đã bị từ chối");
        Telegram::depositRejected($id, (int)$dep['user_id'], (string)$dep['amount']);

        Response::success('Deposit rejected');
    }

    // ── TICKETS ────────────────────────────────────────────────────────────────
    public static function listAdminTickets(): void
    {
        AuthMiddleware::requireAdmin();
        $p     = paginate(); $where = '1=1'; $params = [];
        if (!empty($_GET['status'])) { $where .= ' AND t.status = ?'; $params[] = $_GET['status']; }
        $total = (int)Database::query("SELECT COUNT(*) FROM tickets t WHERE $where", $params)->fetchColumn();
        $rows  = Database::query(
            "SELECT t.*, u.username FROM tickets t LEFT JOIN users u ON u.id = t.user_id WHERE $where ORDER BY t.updated_at DESC LIMIT ? OFFSET ?",
            array_merge($params, [$p['limit'], $p['offset']])
        )->fetchAll();
        Response::json(['tickets' => $rows, 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }

    public static function replyTicket(int $id): void
    {
        $session = AuthMiddleware::requireAdmin();
        $v       = Validator::make(getBody())->string('message', 2, 5000);
        $v->abortIfFails();

        $ticket = Database::query('SELECT * FROM tickets WHERE id = ? LIMIT 1', [$id])->fetch();
        if (!$ticket) Response::error('Ticket not found', 404);

        $msgId = Database::insert(
            'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, 1)',
            [$id, $session['userId'], $v->get('message')]
        );

        $status = getBody()['status'] ?? 'open';
        if (in_array($status, ['open', 'pending', 'closed'], true)) {
            Database::query('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?', [$status, $id]);
        } else {
            Database::query("UPDATE tickets SET status = 'open', updated_at = NOW() WHERE id = ?", [$id]);
        }

        Response::json(Database::query('SELECT * FROM ticket_messages WHERE id = ? LIMIT 1', [$msgId])->fetch(), 201);
    }

    // ── SETTINGS ───────────────────────────────────────────────────────────────
    public static function getSettings(): void
    {
        AuthMiddleware::requireAdmin();
        $rows = Database::query('SELECT `key`, `value` FROM site_settings')->fetchAll();
        $out  = []; foreach ($rows as $r) $out[$r['key']] = $r['value'];
        Response::json($out);
    }

    public static function saveSettings(): void
    {
        AuthMiddleware::requireAdmin();
        $body = getBody();
        foreach ($body as $key => $value) {
            // Sanitize key — only allow safe characters
            $key = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$key);
            if (!$key || strlen($key) > 100) continue;
            $value = (string)$value;
            if (strlen($value) > 10000) continue;

            Database::query(
                'INSERT INTO site_settings (`key`, `value`) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE `value` = ?, updated_at = NOW()',
                [$key, $value, $value]
            );
        }
        Response::success('Settings saved');
    }

    // ── ANNOUNCEMENTS ──────────────────────────────────────────────────────────
    public static function listAnnouncements(): void
    {
        AuthMiddleware::requireAdmin();
        Response::json(['announcements' => Database::query('SELECT * FROM announcements ORDER BY created_at DESC')->fetchAll()]);
    }

    public static function createAnnouncement(): void
    {
        AuthMiddleware::requireAdmin();
        $v = Validator::make(getBody())
            ->string('title', 2, 200)
            ->string('content', 2, 5000)
            ->in('type', ['info', 'warning', 'maintenance', 'success'], false)
            ->boolean('active');
        $v->abortIfFails();

        $id = Database::insert(
            'INSERT INTO announcements (title, content, type, active) VALUES (?, ?, ?, ?)',
            [$v->get('title'), $v->get('content'), $v->get('type') ?: 'info', (int)$v->get('active')]
        );
        Response::json(Database::query('SELECT * FROM announcements WHERE id = ? LIMIT 1', [$id])->fetch(), 201);
    }

    public static function updateAnnouncement(int $id): void
    {
        AuthMiddleware::requireAdmin();
        $body = getBody(); $sets = ['updated_at = NOW()']; $params = [];
        if (isset($body['title']))   { $sets[] = 'title = ?';  $params[] = substr($body['title'], 0, 200); }
        if (isset($body['content'])) { $sets[] = 'content = ?';$params[] = substr($body['content'], 0, 5000); }
        if (isset($body['type']))    { $sets[] = 'type = ?';   $params[] = in_array($body['type'], ['info','warning','maintenance','success'], true) ? $body['type'] : 'info'; }
        if (isset($body['active']))  { $sets[] = 'active = ?'; $params[] = (int)filter_var($body['active'], FILTER_VALIDATE_BOOLEAN); }
        $params[] = $id;
        Database::query('UPDATE announcements SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
        Response::json(Database::query('SELECT * FROM announcements WHERE id = ? LIMIT 1', [$id])->fetch());
    }

    public static function deleteAnnouncement(int $id): void
    {
        AuthMiddleware::requireAdmin();
        Database::query('DELETE FROM announcements WHERE id = ?', [$id]);
        Response::success('Deleted');
    }

    // ── DB Status ──────────────────────────────────────────────────────────────
    public static function dbStatus(): void
    {
        AuthMiddleware::requireAdmin();
        $start = microtime(true);
        Database::query('SELECT 1');
        $ms = round((microtime(true) - $start) * 1000, 2);
        Response::json(['connected' => true, 'latencyMs' => $ms, 'userCount' => (int)Database::query('SELECT COUNT(*) FROM users')->fetchColumn()]);
    }

    // ── Cron — sync orders ─────────────────────────────────────────────────────
    public static function cronUpdateOrders(): void
    {
        $secret   = qs('secret');
        $expected = env('CRON_SECRET');
        if (!$expected || !hash_equals($expected, (string)$secret)) {
            Response::error('Forbidden', 403);
        }

        $orders = Database::query(
            "SELECT o.*, p.base_url, p.api_key
             FROM orders o
             JOIN services s ON s.id = o.service_id
             JOIN providers p ON p.id = s.provider_id
             WHERE o.status IN ('processing','active') AND o.provider_order_id IS NOT NULL
             LIMIT 100"
        )->fetchAll();

        $updated = 0;
        foreach ($orders as $order) {
            $result = callProviderApi($order['base_url'], $order['api_key'], [
                'action' => 'status',
                'order'  => $order['provider_order_id'],
            ]);
            if (!$result || isset($result['error'])) continue;

            $newStatus = match (strtolower($result['status'] ?? '')) {
                'completed'  => 'completed',
                'cancelled'  => 'cancelled',
                'partial'    => 'partial',
                'in progress'=> 'processing',
                default      => null,
            };
            if ($newStatus && $newStatus !== $order['status']) {
                OrderModel::updateStatus((int)$order['id'], $newStatus, [
                    'startCount' => $result['start_count'] ?? null,
                    'remains'    => $result['remains'] ?? null,
                ]);
                $updated++;
            }
        }

        Response::json(['updated' => $updated, 'checked' => count($orders)]);
    }

    // ── Cron — sync all providers ──────────────────────────────────────────────
    public static function cronSyncAll(): void
    {
        $secret   = qs('secret');
        $expected = env('CRON_SECRET');
        if (!$expected || !hash_equals($expected, (string)$secret)) {
            Response::error('Forbidden', 403);
        }

        $providers = Database::query("SELECT * FROM providers WHERE status = 'active'")->fetchAll();
        $results   = [];
        foreach ($providers as $p) {
            $results[$p['name']] = self::doSync($p);
        }

        Response::json(['results' => $results]);
    }

    // ── Internal: sync one provider ────────────────────────────────────────────
    private static function doSync(array $provider): array
    {
        $markup   = 1 + ((float)($provider['markup_percent'] ?? 25)) / 100;
        $services = callProviderApi($provider['base_url'], $provider['api_key'], ['action' => 'services'], 90);
        if (!is_array($services)) return ['error' => 'Invalid response from provider'];

        $catCache = [];
        $added = $updated = 0;

        foreach ($services as $s) {
            $psid    = (string)($s['service'] ?? '');
            $catName = $s['category'] ?? 'General';
            $name    = $s['name'] ?? "Service #{$psid}";
            $rate    = number_format((float)($s['rate'] ?? 0) * $markup, 6, '.', '');
            $min     = max(1, (int)($s['min'] ?? 10));
            $max     = max($min, (int)($s['max'] ?? 100000));

            if (!isset($catCache[$catName])) {
                $cat = Database::query('SELECT id FROM categories WHERE name = ? LIMIT 1', [$catName])->fetch();
                if (!$cat) {
                    $catId = Database::insert('INSERT INTO categories (name, active) VALUES (?, 1)', [$catName]);
                } else {
                    $catId = (int)$cat['id'];
                }
                $catCache[$catName] = $catId;
            }

            $exist = Database::query(
                'SELECT id FROM services WHERE provider_service_id = ? AND provider_id = ? LIMIT 1',
                [$psid, $provider['id']]
            )->fetch();

            if ($exist) {
                Database::query(
                    "UPDATE services SET rate=?, min=?, max=?, name=?, category_id=?, status='active', updated_at=NOW() WHERE id=?",
                    [$rate, $min, $max, $name, $catCache[$catName], $exist['id']]
                );
                $updated++;
            } else {
                Database::query(
                    "INSERT INTO services (category_id, name, provider_id, provider_service_id, type, rate, min, max, status, refill, cancel)
                     VALUES (?, ?, ?, ?, 'default', ?, ?, ?, 'active', ?, ?)",
                    [$catCache[$catName], $name, $provider['id'], $psid, $rate, $min, $max,
                     (int)in_array($s['refill'] ?? false, [true, '1', 'true'], true),
                     (int)in_array($s['cancel'] ?? false, [true, '1', 'true'], true)]
                );
                $added++;
            }
        }

        Database::query("UPDATE providers SET last_sync_at=NOW(), status='active' WHERE id=?", [$provider['id']]);
        return ['added' => $added, 'updated' => $updated, 'total' => $added + $updated];
    }
}
