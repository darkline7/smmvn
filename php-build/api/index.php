<?php
/**
 * SMM Panel Pro — PHP API Router
 * Entry point for all /api/* requests
 *
 * Deploy: upload php-build/ contents to public_html/
 * Set .env file one level ABOVE public_html (i.e. ~/smm-panel.vn/.env)
 */

declare(strict_types=1);

// ── Bootstrap ──────────────────────────────────────────────────────────────────
require_once __DIR__ . '/helpers/config.php';
require_once __DIR__ . '/helpers/jwt.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/auth.php';

// ── CORS headers ───────────────────────────────────────────────────────────────
$siteUrl = env('SITE_URL') ?: setting('site_url');
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

if ($origin) {
    $allowed = $siteUrl ? explode(',', $siteUrl) : [];
    $ok      = !$siteUrl; // allow all if SITE_URL not configured
    foreach ($allowed as $a) {
        $a = trim($a);
        if ($a && (parse_url($a, PHP_URL_HOST) === parse_url($origin, PHP_URL_HOST))) {
            $ok = true; break;
        }
    }
    if ($ok) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key');
    }
}

// ── Preflight ──────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Route parsing ──────────────────────────────────────────────────────────────
// The .htaccess passes REQUEST_URI to this file.
// URI looks like: /api/auth/login  or  /api/orders/5
$uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$uri  = '/' . ltrim($uri, '/');

// Strip /api prefix
$path = preg_replace('#^/api#', '', $uri);
$path = trim($path, '/');

$segments = $path !== '' ? explode('/', $path) : [];

// ── Special: thesieure card callback (no auth) ─────────────────────────────────
if (($segments[0] ?? '') === 'wallet' && ($segments[1] ?? '') === 'cards' && ($segments[2] ?? '') === 'callback') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);
    $body = getBody();
    $requestId = $body['request_id'] ?? '';
    if (!$requestId) jsonOut(['success' => true, 'message' => 'no request_id']);

    $db = getDB();
    $settings = getSettings();
    $partnerId  = $settings['card_partner_id'] ?? '';
    $partnerKey = $settings['card_partner_key'] ?? '';

    if ($partnerId && $partnerKey) {
        $sign         = $body['sign'] ?? '';
        if (!$sign) jsonOut(['success' => false, 'message' => 'Missing signature'], 401);
        $expectedSign = md5($partnerId . $partnerKey . $requestId);
        if (!hash_equals($expectedSign, $sign)) jsonOut(['success' => false, 'message' => 'Invalid signature'], 401);
    }

    $stmt = $db->prepare('SELECT * FROM card_charges WHERE request_id = ? LIMIT 1');
    $stmt->execute([$requestId]);
    $charge = $stmt->fetch();
    if (!$charge) jsonOut(['success' => true, 'message' => 'Charge not found']);
    if (in_array((int)$charge['status'], [1, 3])) jsonOut(['success' => true, 'message' => 'Already processed']);

    $cardStatus  = (int)($body['status'] ?? 3);
    $actualAmount= isset($body['amount']) ? (float)$body['amount'] : null;
    $usdCredited  = null;

    if ($cardStatus === 1 && $actualAmount) {
        $vndRate = (float)($settings['vnd_exchange_rate'] ?? 24000);
        $usd     = $actualAmount / $vndRate;
        try {
            $db->beginTransaction();
            $u = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE LIMIT 1');
            $u->execute([$charge['user_id']]);
            $user = $u->fetch();
            $newBalance = round((float)$user['balance'] + $usd, 4);
            $usdCredited = number_format($usd, 4, '.', '');
            $db->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([number_format($newBalance, 4, '.', ''), $charge['user_id']]);
            $db->prepare('INSERT INTO transactions (user_id,type,amount,balance_after,description,reference_id) VALUES (?,?,?,?,?,?)')->execute([$charge['user_id'],'deposit',$usdCredited,number_format($newBalance,4,'.',''),"Nạp thẻ {$charge['telco']} (callback)",$charge['id']]);
            $db->prepare("UPDATE card_charges SET status=?,message=?,actual_amount=?,usd_credited=?,updated_at=NOW() WHERE id=?")->execute([$cardStatus,$body['message']??null,$actualAmount ? (string)$actualAmount : null,$usdCredited,$charge['id']]);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            jsonOut(['success' => false, 'message' => 'Internal error'], 500);
        }
    } else {
        $db->prepare("UPDATE card_charges SET status=?,message=?,actual_amount=?,updated_at=NOW() WHERE id=?")->execute([$cardStatus,$body['message']??null,$actualAmount ? (string)$actualAmount : null,$charge['id']]);
    }
    jsonOut(['success' => true]);
}

// Store segments globally for route files to use
$GLOBALS['routeSegments'] = $segments;
$section = $segments[0] ?? '';

// ── Route dispatch ─────────────────────────────────────────────────────────────
switch ($section) {
    case 'auth':
        require __DIR__ . '/routes/auth.php';
        break;

    case 'services':
    case 'categories':
        require __DIR__ . '/routes/services.php';
        break;

    case 'dashboard':
        require __DIR__ . '/routes/dashboard.php';
        break;

    case 'orders':
        require __DIR__ . '/routes/orders.php';
        break;

    case 'wallet':
        require __DIR__ . '/routes/wallet.php';
        break;

    case 'profile':
        require __DIR__ . '/routes/profile.php';
        break;

    case 'tickets':
        require __DIR__ . '/routes/tickets.php';
        break;

    case 'webhook':
        // /api/webhook/sepay
        require __DIR__ . '/routes/sepay.php';
        break;

    case 'v2':
        require __DIR__ . '/routes/apiv2.php';
        break;

    case 'admin':
        require __DIR__ . '/routes/admin.php';
        break;

    case 'announcements':
    case 'notifications':
    case 'referrals':
    case 'public':
    case 'cron':
        require __DIR__ . '/routes/misc.php';
        break;

    case 'health':
        jsonOut(['status' => 'ok', 'version' => SMM_VERSION, 'time' => date('c')]);

    default:
        jsonError('API route not found', 404);
}
