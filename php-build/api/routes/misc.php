<?php
/** Misc routes: announcements, notifications, referrals, cron, public settings */

$method = method();
$seg    = $GLOBALS['routeSegments'] ?? [];
$prefix = $seg[0] ?? '';  // 'announcements', 'notifications', 'referrals', 'cron', 'public'
$sub    = $seg[1] ?? '';
$db     = getDB();

// GET /api/announcements — public
if ($prefix === 'announcements' && $method === 'GET') {
    $rows = $db->query("SELECT * FROM announcements WHERE active = true ORDER BY created_at DESC LIMIT 10")->fetchAll();
    jsonOut(['announcements' => $rows]);
}

// GET /api/public/settings — public
if ($prefix === 'public' && $sub === 'settings' && $method === 'GET') {
    $s = getSettings();
    jsonOut([
        'siteName'          => $s['site_name'] ?? 'SMM Pro',
        'siteDescription'   => $s['site_description'] ?? '',
        'siteKeywords'      => $s['site_keywords'] ?? '',
        'logoUrl'           => $s['logo_url'] ?? '',
        'faviconUrl'        => $s['favicon_url'] ?? '',
        'hotline'           => $s['hotline'] ?? '',
        'address'           => $s['address'] ?? '',
        'fanpageUrl'        => $s['fanpage_url'] ?? '',
        'copyrightLeft'     => $s['copyright_left'] ?? '',
        'copyrightRight'    => $s['copyright_right'] ?? '',
        'bankName'          => $s['bank_name'] ?? '',
        'bankAccountNumber' => $s['bank_account_number'] ?? '',
        'bankAccountName'   => $s['bank_account_name'] ?? '',
        'bankBin'           => $s['bank_bin'] ?? '',
        'minDeposit'        => (float)($s['min_deposit'] ?? 1),
        'maxDeposit'        => (float)($s['max_deposit'] ?? 10000),
        'vndExchangeRate'   => (float)($s['vnd_exchange_rate'] ?? 24000),
        'sepayEnabled'      => ($s['sepay_enabled'] ?? '') === 'true',
        'maintenanceMode'   => ($s['maintenance_mode'] ?? '') === 'true',
        'registrationOpen'  => ($s['registration_open'] ?? 'true') !== 'false',
    ]);
}

// Auth required below
$sess = requireAuth();
$uid  = (int)$sess['userId'];

// GET /api/notifications
if ($prefix === 'notifications' && $method === 'GET') {
    $stmt = $db->prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
    $stmt->execute([$uid]);
    $notes  = $stmt->fetchAll();
    $unread = count(array_filter($notes, fn($n) => !$n['read']));
    jsonOut(['notifications' => $notes, 'unread' => $unread]);
}

// POST /api/notifications/read-all
if ($prefix === 'notifications' && $sub === 'read-all' && $method === 'POST') {
    $db->prepare('UPDATE notifications SET read = true WHERE user_id = ?')->execute([$uid]);
    jsonOut(['success' => true, 'message' => 'All notifications marked as read']);
}

// GET /api/referrals
if ($prefix === 'referrals' && $method === 'GET') {
    $u = $db->prepare('SELECT referral_code FROM users WHERE id = ? LIMIT 1'); $u->execute([$uid]);
    $user = $u->fetch();
    $code    = $user['referral_code'] ?? '';
    $siteUrl = setting('site_url') ?: (env('SITE_URL') ?: 'https://yourdomain.com');
    $link    = "$siteUrl/register?ref=$code";

    $stmt = $db->prepare(
        "SELECT r.referred_user_id AS user_id,
                (SELECT username FROM users WHERE id = r.referred_user_id) AS username,
                r.commission, r.created_at
         FROM referrals r WHERE r.referrer_id = ? ORDER BY r.created_at DESC"
    );
    $stmt->execute([$uid]);
    $history = $stmt->fetchAll();
    $total   = array_sum(array_column($history, 'commission'));
    $rSetting= $db->query("SELECT value FROM site_settings WHERE key = 'referral_commission' LIMIT 1")->fetchColumn();
    $rate    = ($rSetting ? (float)$rSetting : 5) / 100;

    jsonOut([
        'referralCode'    => $code,
        'referralLink'    => $link,
        'totalReferrals'  => count($history),
        'totalCommission' => (float)$total,
        'commissionRate'  => $rate,
        'referrals'       => $history,
        'history'         => $history,
    ]);
}

// ── CRON endpoints ──────────────────────────────────────────────────────────────
if ($prefix === 'cron') {
    $s      = getSettings();
    $secret = $s['cron_secret'] ?? '';
    $provided = queryParam('secret', '');
    if (!verifyCronSecret($provided, $secret)) jsonError('Invalid cron secret', 401);

    if ($sub === 'sync-all' && $method === 'GET') {
        $providers = $db->query("SELECT * FROM providers WHERE status = 'active'")->fetchAll();
        $catCount  = (int)$db->query('SELECT COUNT(*) FROM categories')->fetchColumn();
        $svcCount  = (int)$db->query('SELECT COUNT(*) FROM services')->fetchColumn();
        // Quick balance check
        $balances = [];
        foreach ($providers as $p) {
            $res = callProviderApi($p['base_url'], $p['api_key'], ['action'=>'balance'], 10);
            $balances[] = ['provider' => $p['name'], 'balance' => $res['balance'] ?? $res['Balance'] ?? '-', 'currency' => $res['currency'] ?? 'USD'];
        }
        jsonOut([
            'success' => true,
            'message' => 'Đồng bộ đang chạy cho ' . count($providers) . ' provider(s)',
            'stats'   => ['totalCategories' => $catCount, 'totalServices' => $svcCount, 'providerBalances' => $balances],
            'timestamp' => date('c'),
        ]);
        // Note: PHP on shared hosting can't fork — sync runs synchronously after response
        // Use PHP's ignore_user_abort to let it finish after client disconnects
        ignore_user_abort(true);
        set_time_limit(300);
        foreach ($providers as $p) syncOneProvider($db, $p);
        exit;
    }

    if ($sub === 'update-orders' && $method === 'GET') {
        $pending = $db->query(
            "SELECT o.id, o.provider_order_id, o.status, s.provider_id
             FROM orders o JOIN services s ON s.id = o.service_id
             WHERE o.status IN ('pending','processing') AND o.provider_order_id IS NOT NULL
             LIMIT 200"
        )->fetchAll();
        if (!$pending) jsonOut(['success' => true, 'message' => 'No pending orders', 'updated' => 0]);

        $byProvider = [];
        foreach ($pending as $o) {
            if (!$o['provider_id']) continue;
            $byProvider[$o['provider_id']][] = $o;
        }
        $statusMap = [
            'Pending'=>'pending','Processing'=>'processing','In progress'=>'processing',
            'Active'=>'active','Completed'=>'completed','Partial'=>'partial',
            'Cancelled'=>'cancelled','Canceled'=>'cancelled','Failed'=>'failed',
        ];
        $updated = 0;
        foreach ($byProvider as $pid => $orders) {
            $prov = $db->prepare('SELECT * FROM providers WHERE id = ? LIMIT 1'); $prov->execute([$pid]);
            $provider = $prov->fetch();
            if (!$provider || !$provider['base_url']) continue;
            $chunks = array_chunk($orders, 100);
            foreach ($chunks as $chunk) {
                $ids  = implode(',', array_column($chunk, 'provider_order_id'));
                $data = callProviderApi($provider['base_url'], $provider['api_key'], ['action'=>'status','orders'=>$ids], 30);
                if (!is_array($data)) continue;
                foreach ($chunk as $o) {
                    $info = $data[$o['provider_order_id']] ?? null;
                    if (!$info) continue;
                    $newStatus  = $statusMap[$info['status'] ?? ''] ?? $o['status'];
                    $startCount = isset($info['start_count']) ? (int)$info['start_count'] : null;
                    $remains    = isset($info['remains']) ? (int)$info['remains'] : null;
                    if ($newStatus !== $o['status'] || $startCount !== null || $remains !== null) {
                        $sets = ['updated_at = NOW()'];
                        $p2   = [];
                        if ($newStatus !== $o['status']) { $sets[] = 'status = ?'; $p2[] = $newStatus; }
                        if ($startCount !== null) { $sets[] = 'start_count = ?'; $p2[] = $startCount; }
                        if ($remains !== null)    { $sets[] = 'remains = ?';     $p2[] = $remains; }
                        $p2[] = $o['id'];
                        $db->prepare('UPDATE orders SET ' . implode(',', $sets) . ' WHERE id = ?')->execute($p2);
                        if ($newStatus !== $o['status']) {
                            $db->prepare('INSERT INTO order_logs (order_id, status, note) VALUES (?,?,?)')->execute([$o['id'], $newStatus, 'Auto-updated from provider']);
                        }
                        $updated++;
                    }
                }
            }
        }
        jsonOut(['success' => true, 'checked' => count($pending), 'updated' => $updated, 'timestamp' => date('c')]);
    }

    // cron/sync/:id
    if (preg_match('/^\d+$/', $sub) && $method === 'GET') {
        $prov = $db->prepare('SELECT * FROM providers WHERE id = ? LIMIT 1'); $prov->execute([(int)$sub]);
        $provider = $prov->fetch();
        if (!$provider) jsonError('Provider not found', 404);
        $result = syncOneProvider($db, $provider);
        jsonOut(['success' => !isset($result['error']), 'provider' => $provider['name']] + $result + ['timestamp' => date('c')]);
    }
}

function syncOneProvider(PDO $db, array $provider): array {
    $markup = 1 + ((float)($provider['markup_percent'] ?? 25)) / 100;
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
        $catCache[$key] = $id;
        return $id;
    };

    $added = $updated = 0;
    foreach ($services as $s) {
        try {
            $psid    = (string)($s['service'] ?? '');
            $newRate = number_format((float)$s['rate'] * $markup, 6, '.', '');
            $min     = (int)($s['min'] ?? 10) ?: 10;
            $max     = (int)($s['max'] ?? 100000) ?: 100000;
            $name    = $s['name'] ?? "Service #$psid";
            $catId   = $getOrCreateCategory($s['category'] ?? 'General');
            $exist   = $db->prepare('SELECT id FROM services WHERE provider_service_id = ? AND provider_id = ? LIMIT 1');
            $exist->execute([$psid, $provider['id']]);
            $row = $exist->fetch();
            if ($row) {
                $db->prepare("UPDATE services SET rate=?,min=?,max=?,name=?,category_id=?,status='active',updated_at=NOW() WHERE id=?")
                   ->execute([$newRate,$min,$max,$name,$catId,$row['id']]);
                $updated++;
            } else {
                $db->prepare("INSERT INTO services (category_id,name,description,provider_id,provider_service_id,type,rate,min,max,status,refill,cancel) VALUES (?,?,?,?,?,'default',?,?,?,'active',?,?)")
                   ->execute([$catId,$name,'',$provider['id'],$psid,$newRate,$min,$max,
                       in_array($s['refill'] ?? false, [true,'true','1'],true),
                       in_array($s['cancel'] ?? false, [true,'true','1'],true),
                   ]);
                $added++;
            }
        } catch (Throwable) {}
    }
    $db->prepare("UPDATE providers SET last_sync_at=NOW(),status='active',updated_at=NOW() WHERE id=?")->execute([$provider['id']]);
    return ['added'=>$added,'updated'=>$updated,'total'=>$added+$updated];
}

jsonError('Not found', 404);
