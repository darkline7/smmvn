<?php
/**
 * API Route Definitions
 * Maps HTTP method + path pattern → Controller::method
 *
 * Pattern syntax: /api/orders/{id} — {id} captured as int param
 */

declare(strict_types=1);

class Router
{
    private static array $routes = [];

    public static function get(string $path, callable $handler): void    { self::add('GET',    $path, $handler); }
    public static function post(string $path, callable $handler): void   { self::add('POST',   $path, $handler); }
    public static function patch(string $path, callable $handler): void  { self::add('PATCH',  $path, $handler); }
    public static function delete(string $path, callable $handler): void { self::add('DELETE', $path, $handler); }

    private static function add(string $method, string $path, callable $handler): void
    {
        self::$routes[] = ['method' => $method, 'path' => $path, 'handler' => $handler];
    }

    public static function dispatch(string $method, string $uri): void
    {
        // Strip query string
        $path = parse_url($uri, PHP_URL_PATH);
        $path = rtrim($path, '/') ?: '/';

        foreach (self::$routes as $route) {
            if ($route['method'] !== $method) continue;

            $pattern = preg_replace('/\{(\w+)\}/', '(\d+)', $route['path']);
            $pattern = '#^' . $pattern . '$#';

            if (!preg_match($pattern, $path, $matches)) continue;

            array_shift($matches);  // remove full match
            $params = array_map('intval', $matches);

            ($route['handler'])(...$params);
            return;
        }

        Response::error('Not found', 404);
    }
}

// ── PUBLIC ROUTES (no auth) ────────────────────────────────────────────────────
Router::get('/api/health', fn() => Response::json(['status' => 'ok', 'version' => SMM_VERSION, 'time' => date('c')]));

Router::get('/api/services',          [ServiceController::class, 'index']);
Router::get('/api/services/{id}',     [ServiceController::class, 'show']);
Router::get('/api/categories',        [ServiceController::class, 'categories']);

Router::get('/api/public/settings',   fn() => Response::json([
    'siteName'         => setting('site_name', 'SMM Panel Pro'),
    'siteDescription'  => setting('site_description', ''),
    'logoUrl'          => setting('logo_url', ''),
    'currency'         => setting('currency', 'USD'),
    'minDeposit'       => setting('min_deposit_usd', '1'),
    'googleClientId'   => setting('google_client_id', '') ?: env('GOOGLE_CLIENT_ID'),
    'turnstiteSiteKey' => setting('turnstile_site_key', '') ?: env('TURNSTILE_SITE_KEY'),
    'registrationOpen' => setting('registration_closed', '0') === '0',
]));

Router::get('/api/announcements', fn() => Response::json([
    'announcements' => Database::query("SELECT id, title, content, type, created_at FROM announcements WHERE active = 1 ORDER BY created_at DESC LIMIT 10")->fetchAll(),
]));

// ── AUTH ROUTES ────────────────────────────────────────────────────────────────
Router::post('/api/auth/login',           [AuthController::class, 'login']);
Router::post('/api/auth/register',        [AuthController::class, 'register']);
Router::post('/api/auth/logout',          [AuthController::class, 'logout']);
Router::get('/api/auth/me',               [AuthController::class, 'me']);
Router::post('/api/auth/google',          [AuthController::class, 'googleAuth']);
Router::post('/api/auth/make-admin',      [AuthController::class, 'makeAdmin']);
Router::post('/api/auth/change-password', [AuthController::class, 'changePassword']);

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
Router::get('/api/dashboard', function () {
    $session  = AuthMiddleware::requireAuth();
    $uid      = (int)$session['userId'];
    $user     = UserModel::findById($uid);
    $today    = date('Y-m-d');

    Response::json([
        'balance'            => (float)$user['balance'],
        'totalOrders'        => (int)Database::query('SELECT COUNT(*) FROM orders WHERE user_id = ?', [$uid])->fetchColumn(),
        'totalSpend'         => (float)Database::query('SELECT COALESCE(SUM(charge), 0) FROM orders WHERE user_id = ?', [$uid])->fetchColumn(),
        'activeOrders'       => (int)Database::query("SELECT COUNT(*) FROM orders WHERE user_id = ? AND status IN ('pending','processing','active')", [$uid])->fetchColumn(),
        'completedOrders'    => (int)Database::query("SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'completed'", [$uid])->fetchColumn(),
        'todayOrders'        => (int)Database::query("SELECT COUNT(*) FROM orders WHERE user_id = ? AND DATE(created_at) = ?", [$uid, $today])->fetchColumn(),
        'pendingDeposits'    => (int)Database::query("SELECT COUNT(*) FROM deposits WHERE user_id = ? AND status = 'pending'", [$uid])->fetchColumn(),
        'unreadNotifications'=> (int)Database::query("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND `read` = 0", [$uid])->fetchColumn(),
        'recentOrders'       => Database::query(
            'SELECT o.id, s.name AS service_name, o.link, o.quantity, o.charge, o.status, o.created_at
             FROM orders o LEFT JOIN services s ON s.id = o.service_id
             WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 5',
            [$uid]
        )->fetchAll(),
    ]);
});

// ── ORDERS ─────────────────────────────────────────────────────────────────────
Router::get('/api/orders',               [OrderController::class, 'index']);
Router::get('/api/orders/{id}',          [OrderController::class, 'show']);
Router::post('/api/orders',              [OrderController::class, 'store']);
Router::post('/api/orders/mass',         [OrderController::class, 'massStore']);
Router::post('/api/orders/{id}/refill',  [OrderController::class, 'refill']);
Router::post('/api/orders/{id}/cancel',  [OrderController::class, 'cancel']);

// ── WALLET ─────────────────────────────────────────────────────────────────────
Router::get('/api/wallet/balance',            [WalletController::class, 'balance']);
Router::get('/api/wallet/transactions',       [WalletController::class, 'transactions']);
Router::post('/api/wallet/deposits',          [WalletController::class, 'createDeposit']);
Router::get('/api/wallet/deposits',           [WalletController::class, 'listDeposits']);
Router::post('/api/wallet/deposits/{id}/cancel', [WalletController::class, 'cancelDeposit']);
Router::get('/api/wallet/sepay-info',         [WalletController::class, 'sepayInfo']);
Router::post('/api/wallet/cards',             [WalletController::class, 'submitCard']);
// Card callback: public, verified by signature (handled separately in index.php)

// ── PROFILE ────────────────────────────────────────────────────────────────────
Router::get('/api/profile',                     [ProfileController::class, 'show']);
Router::patch('/api/profile',                   [ProfileController::class, 'update']);
Router::get('/api/profile/api-key',             [ProfileController::class, 'getApiKey']);
Router::post('/api/profile/regenerate-key',     [ProfileController::class, 'regenerateApiKey']);
Router::get('/api/notifications',               [ProfileController::class, 'notifications']);
Router::post('/api/notifications/read-all',     [ProfileController::class, 'markAllRead']);
Router::get('/api/referrals',                   [ProfileController::class, 'referrals']);

// ── TICKETS ────────────────────────────────────────────────────────────────────
Router::get('/api/tickets',                     [TicketController::class, 'index']);
Router::post('/api/tickets',                    [TicketController::class, 'store']);
Router::get('/api/tickets/{id}',                [TicketController::class, 'show']);
Router::post('/api/tickets/{id}/messages',      [TicketController::class, 'addMessage']);
Router::delete('/api/tickets/{id}',             [TicketController::class, 'close']);

// ── WEBHOOKS (public, no auth) ─────────────────────────────────────────────────
Router::post('/api/webhook/sepay',              [WebhookController::class, 'sepay']);

// ── PUBLIC API v2 ──────────────────────────────────────────────────────────────
Router::post('/api/v2',                         [ApiV2Controller::class, 'handle']);
Router::get('/api/v2',                          [ApiV2Controller::class, 'handle']);

// ── ADMIN ROUTES ───────────────────────────────────────────────────────────────
Router::get('/api/admin/stats',                        [AdminController::class, 'stats']);
Router::get('/api/admin/db-status',                    [AdminController::class, 'dbStatus']);

Router::get('/api/admin/users',                        [AdminController::class, 'listUsers']);
Router::get('/api/admin/users/{id}',                   [AdminController::class, 'getUser']);
Router::patch('/api/admin/users/{id}',                 [AdminController::class, 'updateUser']);
Router::post('/api/admin/users/{id}/balance',          [AdminController::class, 'adjustBalance']);

Router::get('/api/admin/orders',                       [AdminController::class, 'listOrders']);
Router::patch('/api/admin/orders/{id}',                [AdminController::class, 'updateOrder']);

Router::get('/api/admin/services',                     [AdminController::class, 'listAdminServices']);
Router::post('/api/admin/services',                    [AdminController::class, 'createService']);
Router::patch('/api/admin/services/{id}',              [AdminController::class, 'updateService']);

Router::get('/api/admin/categories',                   [AdminController::class, 'listAdminCategories']);
Router::post('/api/admin/categories',                  [AdminController::class, 'createCategory']);
Router::patch('/api/admin/categories/{id}',            [AdminController::class, 'updateCategory']);

Router::get('/api/admin/providers',                    [AdminController::class, 'listProviders']);
Router::post('/api/admin/providers',                   [AdminController::class, 'createProvider']);
Router::patch('/api/admin/providers/{id}',             [AdminController::class, 'updateProvider']);
Router::post('/api/admin/providers/{id}/test',         [AdminController::class, 'testProvider']);
Router::post('/api/admin/providers/{id}/sync',         [AdminController::class, 'syncProvider']);

Router::get('/api/admin/deposits',                     [AdminController::class, 'listDeposits']);
Router::post('/api/admin/deposits/{id}/approve',       [AdminController::class, 'approveDeposit']);
Router::post('/api/admin/deposits/{id}/reject',        [AdminController::class, 'rejectDeposit']);

Router::get('/api/admin/tickets',                      [AdminController::class, 'listAdminTickets']);
Router::post('/api/admin/tickets/{id}/messages',       [AdminController::class, 'replyTicket']);

Router::get('/api/admin/settings',                     [AdminController::class, 'getSettings']);
Router::post('/api/admin/settings',                    [AdminController::class, 'saveSettings']);

Router::get('/api/admin/announcements',                [AdminController::class, 'listAnnouncements']);
Router::post('/api/admin/announcements',               [AdminController::class, 'createAnnouncement']);
Router::patch('/api/admin/announcements/{id}',         [AdminController::class, 'updateAnnouncement']);
Router::delete('/api/admin/announcements/{id}',        [AdminController::class, 'deleteAnnouncement']);

// ── CRON (called by cPanel cron, secured by CRON_SECRET) ──────────────────────
Router::get('/api/cron/update-orders',                 [AdminController::class, 'cronUpdateOrders']);
Router::get('/api/cron/sync-all',                      [AdminController::class, 'cronSyncAll']);

// ── /api/orders/mass routing fix ──────────────────────────────────────────────
// Note: Since {id} requires digits, /api/orders/mass won't match /api/orders/{id}
// This is handled correctly by the digit-only regex in Router::dispatch
