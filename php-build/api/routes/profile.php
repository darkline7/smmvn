<?php
/** Profile routes — auth required */

$sess   = requireAuth();
$uid    = (int)$sess['userId'];
$method = method();
$action = $GLOBALS['routeSegments'][1] ?? '';  // '' | 'api-key' | 'password'
$db     = getDB();

// GET /api/profile
if ($method === 'GET' && $action === '') {
    $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$uid]);
    $u = $stmt->fetch();
    if (!$u) jsonError('Not found', 404);
    unset($u['password_hash']);
    jsonOut($u);
}

// PATCH /api/profile
if ($method === 'PATCH' && $action === '') {
    $body     = getBody();
    $username = $body['username'] ?? null;
    $timezone = $body['timezone'] ?? null;
    $curPass  = $body['currentPassword'] ?? null;
    $newPass  = $body['newPassword'] ?? null;

    if ($username !== null) {
        if (strlen($username) < 3 || strlen($username) > 30) jsonError('Username phải từ 3-30 ký tự');
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) jsonError('Username chỉ chứa chữ, số và _');
    }

    $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$uid]);
    $user = $stmt->fetch();
    if (!$user) jsonError('Not found', 404);

    $sets = ['updated_at = NOW()'];
    $params = [];
    if ($username)  { $sets[] = 'username = ?';      $params[] = $username; }
    if ($timezone)  { $sets[] = 'timezone = ?';      $params[] = $timezone; }
    if ($newPass && $curPass) {
        if (!verifyPassword($curPass, $user['password_hash'], $uid)) jsonError('Current password is incorrect');
        if (strlen($newPass) < 8) jsonError('Mật khẩu mới tối thiểu 8 ký tự');
        $sets[] = 'password_hash = ?'; $params[] = hashPassword($newPass);
    }
    $params[] = $uid;
    $db->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

    $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$uid]);
    $updated = $stmt->fetch();
    unset($updated['password_hash']);
    jsonOut($updated);
}

// POST /api/profile/api-key
if ($method === 'POST' && $action === 'api-key') {
    $newKey = generateApiKey();
    $db->prepare('UPDATE users SET api_key = ?, updated_at = NOW() WHERE id = ?')->execute([$newKey, $uid]);
    jsonOut(['apiKey' => $newKey]);
}

// POST /api/profile/password
if ($method === 'POST' && $action === 'password') {
    $body    = getBody();
    $curPass = $body['currentPassword'] ?? '';
    $newPass = $body['newPassword'] ?? '';
    if (!$curPass || !$newPass) jsonError('currentPassword and newPassword required');
    if (strlen($newPass) < 8) jsonError('Mật khẩu mới tối thiểu 8 ký tự');
    $stmt = $db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1'); $stmt->execute([$uid]);
    $user = $stmt->fetch();
    if (!verifyPassword($curPass, $user['password_hash'], $uid)) jsonError('Mật khẩu hiện tại không đúng');
    $db->prepare('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?')->execute([hashPassword($newPass), $uid]);
    jsonOut(['success' => true]);
}

jsonError('Not found', 404);
