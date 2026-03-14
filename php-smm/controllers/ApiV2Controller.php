<?php
/**
 * Public API v2 — smmgen.com compatible
 * Authenticated by API key (X-Api-Key header or ?key=)
 */

declare(strict_types=1);

class ApiV2Controller
{
    public static function handle(): void
    {
        RateLimitMiddleware::check('api');
        $session = AuthMiddleware::requireApiKey();
        $action  = getBody()['action'] ?? qs('action') ?? '';

        switch ($action) {
            case 'balance':
                self::balance($session);
                break;
            case 'services':
                self::services();
                break;
            case 'add':
                self::addOrder($session);
                break;
            case 'status':
                self::orderStatus($session);
                break;
            case 'orders':
                self::multiStatus($session);
                break;
            default:
                Response::json(['error' => 'Action not found']);
        }
    }

    private static function balance(array $session): void
    {
        $user = UserModel::findById((int)$session['userId']);
        Response::json(['balance' => (float)$user['balance'], 'currency' => 'USD']);
    }

    private static function services(): void
    {
        $services = ServiceModel::listActive();
        $out      = array_map(fn($s) => [
            'service'      => $s['id'],
            'name'         => $s['name'],
            'type'         => $s['type'],
            'rate'         => $s['rate'],
            'min'          => $s['min'],
            'max'          => $s['max'],
            'category'     => $s['category_name'],
            'description'  => $s['description'] ?? '',
            'refill'       => (bool)$s['refill'],
            'cancel'       => (bool)$s['cancel'],
            'average_time' => $s['average_time'] ?? 'N/A',
        ], $services);

        Response::json($out);
    }

    private static function addOrder(array $session): void
    {
        $serviceId = (int)(getBody()['service'] ?? 0);
        $link      = trim((string)(getBody()['link'] ?? ''));
        $quantity  = (int)(getBody()['quantity'] ?? 0);

        if (!$serviceId || !$link || !$quantity) {
            Response::json(['error' => 'service, link and quantity are required']);
        }

        // Validate link to prevent injection
        if (str_contains($link, "\n") || str_contains($link, "\r") || str_contains($link, "\0")) {
            Response::json(['error' => 'Invalid link']);
        }

        try {
            ['service' => $service, 'charge' => $charge] = ServiceModel::validateOrder($serviceId, $quantity);
            $newBalance = UserModel::deductBalance((int)$session['userId'], $charge);
            $orderId    = OrderModel::create((int)$session['userId'], $serviceId, $link, $quantity, $charge);
            UserModel::logTransaction((int)$session['userId'], 'order', -$charge, $newBalance, "API Order #$orderId", $orderId);
            OrderModel::submitToProvider($orderId);
        } catch (InvalidArgumentException $e) {
            Response::json(['error' => $e->getMessage()]);
        } catch (RuntimeException $e) {
            Response::json(['error' => $e->getMessage()]);
        }

        Response::json(['order' => $orderId]);
    }

    private static function orderStatus(array $session): void
    {
        $orderId = (int)(getBody()['order'] ?? 0);
        if (!$orderId) Response::json(['error' => 'order required']);

        // IDOR protection: only show own orders
        $order = OrderModel::findByIdAndUser($orderId, (int)$session['userId']);
        if (!$order) Response::json(['error' => 'Order not found']);

        Response::json([
            'charge'      => $order['charge'],
            'start_count' => $order['start_count'],
            'status'      => $order['status'],
            'remains'     => $order['remains'],
            'currency'    => 'USD',
        ]);
    }

    private static function multiStatus(array $session): void
    {
        $rawIds = getBody()['orders'] ?? '';
        $ids    = array_filter(array_map('intval', explode(',', (string)$rawIds)));
        if (empty($ids) || count($ids) > 100) {
            Response::json(['error' => 'Provide up to 100 order IDs']);
        }

        // Build placeholders — safe because IDs are int-cast
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $orders       = Database::query(
            "SELECT id, charge, start_count, status, remains FROM orders
             WHERE id IN ($placeholders) AND user_id = ?",
            array_merge($ids, [$session['userId']])
        )->fetchAll();

        $out = [];
        foreach ($orders as $o) {
            $out[$o['id']] = [
                'charge'      => $o['charge'],
                'start_count' => $o['start_count'],
                'status'      => $o['status'],
                'remains'     => $o['remains'],
                'currency'    => 'USD',
            ];
        }

        Response::json($out);
    }
}
