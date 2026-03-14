<?php
/**
 * SMM Panel Pro — Front Controller
 * All requests enter here.
 *
 * Deployment: upload ALL project files to public_html/
 * Set .env in public_html/ or one level above it.
 *
 * Required PHP: 8.1+
 * Required extensions: pdo, pdo_mysql, curl, json, mbstring, openssl
 */

declare(strict_types=1);

// ── Autoload ───────────────────────────────────────────────────────────────────
define('BASE_DIR', __DIR__);

require BASE_DIR . '/config/app.php';
require BASE_DIR . '/config/database.php';
require BASE_DIR . '/helpers/Response.php';
require BASE_DIR . '/helpers/JWT.php';
require BASE_DIR . '/helpers/Validator.php';
require BASE_DIR . '/helpers/Telegram.php';
require BASE_DIR . '/middleware/SecurityMiddleware.php';
require BASE_DIR . '/middleware/AuthMiddleware.php';
require BASE_DIR . '/middleware/RateLimitMiddleware.php';
require BASE_DIR . '/models/UserModel.php';
require BASE_DIR . '/models/ServiceModel.php';
require BASE_DIR . '/models/OrderModel.php';
require BASE_DIR . '/controllers/AuthController.php';
require BASE_DIR . '/controllers/ServiceController.php';
require BASE_DIR . '/controllers/OrderController.php';
require BASE_DIR . '/controllers/WalletController.php';
require BASE_DIR . '/controllers/ProfileController.php';
require BASE_DIR . '/controllers/TicketController.php';
require BASE_DIR . '/controllers/AdminController.php';
require BASE_DIR . '/controllers/ApiV2Controller.php';
require BASE_DIR . '/controllers/WebhookController.php';
require BASE_DIR . '/routes/api.php';

// ── Bootstrap ──────────────────────────────────────────────────────────────────
loadEnv();

// Always send JSON content-type for API routes
$uri = $_SERVER['REQUEST_URI'] ?? '/';

// Only intercept /api/* requests
if (!str_starts_with(parse_url($uri, PHP_URL_PATH), '/api')) {
    // SPA fallback — serve index.html for all non-API routes
    $indexFile = BASE_DIR . '/assets/index.html';
    if (file_exists($indexFile)) {
        include $indexFile;
        exit;
    }
    http_response_code(404);
    echo '<!doctype html><html><head><title>404</title></head><body><h1>Page not found</h1></body></html>';
    exit;
}

// ── Apply global middleware ────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
SecurityMiddleware::setHeaders();
SecurityMiddleware::filterRequest();
SecurityMiddleware::handleCors();

// ── Special: card callback (no auth, verified by signature) ───────────────────
$path = parse_url($uri, PHP_URL_PATH);
if ($path === '/api/wallet/cards/callback' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    WalletController::cardCallback();
    exit;
}

// ── Global rate limit (per IP) ─────────────────────────────────────────────────
RateLimitMiddleware::check('global');

// ── Dispatch ───────────────────────────────────────────────────────────────────
Router::dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $uri);
