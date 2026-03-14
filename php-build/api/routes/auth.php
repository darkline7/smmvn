<?php
/** Auth routes: /api/auth/* */

$method = method();
$seg    = $GLOBALS['routeSegments'] ?? [];  // e.g. ['auth','login']
$action = $seg[1] ?? '';

switch ("$method:$action") {

    case 'GET:config':
        $s = getSettings();
        jsonOut([
            'googleEnabled'    => ($s['google_oauth_enabled'] ?? '') === 'true' && !empty($s['google_client_id']),
            'turnstileEnabled' => ($s['turnstile_enabled'] ?? '') === 'true',
            'turnstileSiteKey' => ($s['turnstile_enabled'] ?? '') === 'true' ? ($s['turnstile_site_key'] ?? '') : '',
            'registrationOpen' => ($s['registration_open'] ?? 'true') !== 'false',
            'maintenanceMode'  => ($s['maintenance_mode'] ?? '') === 'true',
        ]);

    case 'GET:me':
        $sess = requireAuth();
        $db   = getDB();
        $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$sess['userId']]);
        $user = $stmt->fetch();
        if (!$user) jsonError('User not found', 404);
        unset($user['password_hash']);
        jsonOut($user);

    case 'POST:register':
        $s    = getSettings();
        $body = getBody();

        // Turnstile
        if (($s['turnstile_enabled'] ?? '') === 'true' && !empty($s['turnstile_secret_key'])) {
            $token = $body['turnstileToken'] ?? '';
            if (!$token) jsonError('Vui lòng xác minh bạn không phải robot');
            if (!verifyTurnstile($token, $s['turnstile_secret_key'])) jsonError('Xác minh thất bại. Vui lòng thử lại');
        }

        if (($s['registration_open'] ?? 'true') === 'false') jsonError('Đăng ký tạm thời bị tắt', 403);

        $email    = trim($body['email'] ?? '');
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Email không hợp lệ');
        if (strlen($username) < 3 || strlen($username) > 30) jsonError('Username phải từ 3-30 ký tự');
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) jsonError('Username chỉ chứa chữ, số và _');
        if (strlen($password) < 6 || strlen($password) > 128) jsonError('Mật khẩu phải từ 6-128 ký tự');

        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1');
        $stmt->execute([$email, $username]);
        if ($stmt->fetch()) jsonError('Email hoặc tên đăng nhập đã tồn tại');

        $db->prepare('INSERT INTO users (email, username, password_hash, api_key, referral_code) VALUES (?, ?, ?, ?, ?)')
           ->execute([$email, $username, hashPassword($password), generateApiKey(), generateReferralCode()]);
        $userId = (int)$db->lastInsertId('users_id_seq');

        $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        unset($user['password_hash']);
        setSessionCookie(['userId' => $userId, 'userRole' => $user['role']]);
        jsonOut(['user' => $user], 201);

    case 'POST:login':
        $s    = getSettings();
        $body = getBody();

        if (($s['turnstile_enabled'] ?? '') === 'true' && !empty($s['turnstile_secret_key'])) {
            $token = $body['turnstileToken'] ?? '';
            if (!$token) jsonError('Vui lòng xác minh bạn không phải robot');
            if (!verifyTurnstile($token, $s['turnstile_secret_key'])) jsonError('Xác minh thất bại. Vui lòng thử lại');
        }

        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';
        if (!$email || !$password) jsonError('Email và mật khẩu không được để trống');

        $db   = getDB();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !verifyPassword($password, $user['password_hash'], (int)$user['id'])) {
            jsonError('Email hoặc mật khẩu không đúng', 401);
        }
        if ($user['banned']) jsonError('Tài khoản bị khóa', 403);

        setSessionCookie(['userId' => (int)$user['id'], 'userRole' => $user['role']]);
        unset($user['password_hash']);
        jsonOut(['user' => $user]);

    case 'POST:logout':
        clearSessionCookie();
        jsonOut(['success' => true, 'message' => 'Đã đăng xuất']);

    case 'POST:forgot-password':
        jsonOut(['success' => true, 'message' => 'If that email exists, a reset link will be sent']);

    case 'POST:make-admin':
        $expectedKey = env('SETUP_KEY');
        if (!$expectedKey) jsonError('Not found', 404);
        $body     = getBody();
        $setupKey = $body['setupKey'] ?? '';
        $email    = $body['email'] ?? '';
        if (!hash_equals($expectedKey, $setupKey)) jsonError('Invalid setup key', 403);
        if (!$email) jsonError('Email required');
        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user) jsonError('User not found', 404);
        $db->prepare('UPDATE users SET role = ? WHERE id = ?')->execute(['admin', $user['id']]);
        jsonOut(['success' => true, 'message' => "$email is now admin"]);

    // Google OAuth
    case 'GET:google':
        $s        = getSettings();
        $clientId = $s['google_client_id'] ?? '';
        if (!$clientId || ($s['google_oauth_enabled'] ?? '') !== 'true') jsonError('Google OAuth chưa được bật');
        $siteUrl     = $s['site_url'] ?? (($_SERVER['REQUEST_SCHEME'] ?? 'https') . '://' . $_SERVER['HTTP_HOST']);
        $redirectUri = $siteUrl . '/api/auth/google/callback';
        $nonce       = bin2hex(random_bytes(16));
        $state       = base64url_encode(json_encode(['ts' => time(), 'nonce' => $nonce]));
        $secure      = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        setcookie('oauth_state', $nonce, ['expires' => time() + 600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $secure]);
        $url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' . urlencode($clientId)
             . '&redirect_uri=' . urlencode($redirectUri)
             . '&response_type=code&scope=' . urlencode('openid email profile')
             . '&state=' . urlencode($state) . '&access_type=offline';
        header('Location: ' . $url, true, 302);
        exit;

    case 'GET:google/callback':
        $s = getSettings();
        $clientId     = $s['google_client_id'] ?? '';
        $clientSecret = $s['google_client_secret'] ?? '';
        $siteUrl      = $s['site_url'] ?? (($_SERVER['REQUEST_SCHEME'] ?? 'https') . '://' . $_SERVER['HTTP_HOST']);
        $redirectUri  = $siteUrl . '/api/auth/google/callback';

        $code  = $_GET['code'] ?? '';
        $error = $_GET['error'] ?? '';
        $state = $_GET['state'] ?? '';

        if ($error || !$code) { header('Location: ' . $siteUrl . '/login?error=google_denied', true, 302); exit; }

        // Verify state nonce
        $stateData = json_decode(base64url_decode($state), true);
        $cookieNonce = $_COOKIE['oauth_state'] ?? '';
        if (!$cookieNonce || !isset($stateData['nonce']) || !hash_equals($cookieNonce, $stateData['nonce'])) {
            header('Location: ' . $siteUrl . '/login?error=oauth_state_mismatch', true, 302); exit;
        }
        setcookie('oauth_state', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true]);

        // Exchange code
        $tokenBody = http_build_query([
            'code' => $code, 'client_id' => $clientId, 'client_secret' => $clientSecret,
            'redirect_uri' => $redirectUri, 'grant_type' => 'authorization_code',
        ]);
        $ctx = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\nContent-Length: " . strlen($tokenBody),
            'content' => $tokenBody, 'timeout' => 10, 'ignore_errors' => true,
        ]]);
        $tokenResp = @file_get_contents('https://oauth2.googleapis.com/token', false, $ctx);
        $tokens    = json_decode($tokenResp ?: '', true) ?? [];
        if (empty($tokens['access_token'])) { header('Location: ' . $siteUrl . '/login?error=google_token', true, 302); exit; }

        // Get user info
        $ctx2 = stream_context_create(['http' => ['header' => 'Authorization: Bearer ' . $tokens['access_token'], 'timeout' => 10, 'ignore_errors' => true]]);
        $infoResp   = @file_get_contents('https://www.googleapis.com/oauth2/v2/userinfo', false, $ctx2);
        $googleUser = json_decode($infoResp ?: '', true) ?? [];
        if (empty($googleUser['email'])) { header('Location: ' . $siteUrl . '/login?error=google_no_email', true, 302); exit; }

        $db   = getDB();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$googleUser['email']]);
        $user = $stmt->fetch();
        if (!$user) {
            $base = preg_replace('/[^a-zA-Z0-9_]/', '_', $googleUser['name'] ?? explode('@', $googleUser['email'])[0]);
            $username = substr($base, 0, 26) . '_' . substr(bin2hex(random_bytes(2)), 0, 4);
            $db->prepare('INSERT INTO users (email, username, password_hash, api_key, referral_code, email_verified) VALUES (?,?,?,?,?,?)')
               ->execute([$googleUser['email'], $username, hashPassword(bin2hex(random_bytes(32))), generateApiKey(), generateReferralCode(), true]);
            $userId = (int)$db->lastInsertId('users_id_seq');
            $stmt   = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
        }
        if ($user['banned']) { header('Location: ' . $siteUrl . '/login?error=banned', true, 302); exit; }
        setSessionCookie(['userId' => (int)$user['id'], 'userRole' => $user['role']]);
        header('Location: ' . $siteUrl . '/dashboard', true, 302);
        exit;

    default:
        jsonError('Not found', 404);
}
