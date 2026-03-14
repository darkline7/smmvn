<?php
/** Dashboard stats — auth required */

$sess   = requireAuth();
$uid    = (int)$sess['userId'];
$method = method();
$action = $GLOBALS['routeSegments'][1] ?? 'stats';
$db     = getDB();

if ($method !== 'GET') jsonError('Method not allowed', 405);

if ($action === 'stats') {
    $s0 = $db->prepare('SELECT balance, currency FROM users WHERE id = ? LIMIT 1');
    $s0->execute([$uid]); $user = $s0->fetch();

    $monthStart = date('Y-m-01');

    $s1 = $db->prepare('SELECT COUNT(*) FROM orders WHERE user_id = ?'); $s1->execute([$uid]);
    $s2 = $db->prepare("SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'pending'"); $s2->execute([$uid]);
    $s3 = $db->prepare("SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'completed'"); $s3->execute([$uid]);
    $s4 = $db->prepare("SELECT COALESCE(SUM(ABS(charge::numeric)),0) FROM orders WHERE user_id = ? AND created_at >= ?"); $s4->execute([$uid, $monthStart]);

    jsonOut([
        'balance'         => (float)($user['balance'] ?? 0),
        'currency'        => $user['currency'] ?? 'USD',
        'totalOrders'     => (int)$s1->fetchColumn(),
        'pendingOrders'   => (int)$s2->fetchColumn(),
        'completedOrders' => (int)$s3->fetchColumn(),
        'monthlySpend'    => (float)$s4->fetchColumn(),
    ]);
}

if ($action === 'chart') {
    $period    = $_GET['period'] ?? '30d';
    $days      = $period === '7d' ? 7 : ($period === '90d' ? 90 : 30);
    $startDate = date('Y-m-d', strtotime("-$days days"));

    $stmt = $db->prepare(
        "SELECT DATE(created_at)::text AS date, COUNT(*) AS orders, COALESCE(SUM(charge::numeric),0) AS spend
         FROM orders WHERE user_id = ? AND created_at >= ?
         GROUP BY DATE(created_at) ORDER BY DATE(created_at)"
    );
    $stmt->execute([$uid, $startDate]);
    jsonOut(['data' => $stmt->fetchAll()]);
}

jsonError('Not found', 404);
