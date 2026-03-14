<?php
/**
 * Order Controller
 */

declare(strict_types=1);

class OrderController
{
    // ── GET /api/orders ───────────────────────────────────────────────────────
    public static function index(): void
    {
        $session = AuthMiddleware::requireAuth();
        $result  = OrderModel::listForUser((int)$session['userId'], [
            'status'    => qs('status'),
            'serviceId' => qs('serviceId'),
        ]);
        Response::json($result);
    }

    // ── GET /api/orders/{id} ──────────────────────────────────────────────────
    public static function show(int $id): void
    {
        $session = AuthMiddleware::requireAuth();
        $order   = OrderModel::findByIdAndUser($id, (int)$session['userId']);
        if (!$order) Response::error('Order not found', 404);

        $logs = Database::query(
            'SELECT status, note, created_at FROM order_logs WHERE order_id = ? ORDER BY id',
            [$id]
        )->fetchAll();

        Response::json(array_merge($order, ['logs' => $logs]));
    }

    // ── POST /api/orders ──────────────────────────────────────────────────────
    public static function store(): void
    {
        $session = AuthMiddleware::requireAuth();
        RateLimitMiddleware::check('order');

        $body = getBody();
        $v    = Validator::make($body)
            ->integer('serviceId', 1)
            ->string('link', 1, 2048)
            ->integer('quantity', 1);
        $v->abortIfFails();

        $serviceId = $v->get('serviceId');
        $link      = $v->get('link');
        $quantity  = $v->get('quantity');

        // Validate URL format (soft check — some services don't need URLs)
        // Only hard-block obvious injection
        if (str_contains($link, "\n") || str_contains($link, "\r")) {
            Response::error('Invalid link format', 400);
        }

        try {
            ['service' => $service, 'charge' => $charge] = ServiceModel::validateOrder($serviceId, $quantity);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        }

        // Atomic balance check + deduct
        try {
            $newBalance = UserModel::deductBalance((int)$session['userId'], $charge);
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 400);
        }

        $orderId = OrderModel::create((int)$session['userId'], $serviceId, $link, $quantity, $charge);
        UserModel::logTransaction(
            (int)$session['userId'], 'order', -$charge, $newBalance,
            "Order #{$orderId}: {$service['name']}", $orderId
        );
        OrderModel::log($orderId, 'pending', 'Order placed');

        // Submit to provider asynchronously (best-effort — cron will retry)
        OrderModel::submitToProvider($orderId);

        Telegram::newOrder($orderId, (int)$session['userId'], $service['name'], $charge);

        $order = OrderModel::findById($orderId);
        Response::json($order, 201);
    }

    // ── POST /api/orders/mass ─────────────────────────────────────────────────
    public static function massStore(): void
    {
        $session = AuthMiddleware::requireAuth();
        $orders  = getBody()['orders'] ?? [];

        if (!is_array($orders) || empty($orders)) {
            Response::error('orders must be a non-empty array', 400);
        }
        if (count($orders) > 100) {
            Response::error('Maximum 100 orders per batch', 400);
        }

        $results = [];
        foreach ($orders as $i => $item) {
            $v = Validator::make($item)
                ->integer('serviceId', 1)
                ->string('link', 1, 2048)
                ->integer('quantity', 1);

            if ($v->fails()) {
                $results[] = ['index' => $i, 'success' => false, 'error' => 'Validation failed'];
                continue;
            }

            try {
                ['service' => $service, 'charge' => $charge] = ServiceModel::validateOrder($v->get('serviceId'), $v->get('quantity'));
                $newBalance = UserModel::deductBalance((int)$session['userId'], $charge);
                $orderId    = OrderModel::create((int)$session['userId'], $v->get('serviceId'), $v->get('link'), $v->get('quantity'), $charge);
                UserModel::logTransaction((int)$session['userId'], 'order', -$charge, $newBalance, "Order #{$orderId}", $orderId);
                OrderModel::submitToProvider($orderId);
                $results[] = ['index' => $i, 'success' => true, 'orderId' => $orderId];
            } catch (Throwable $e) {
                $results[] = ['index' => $i, 'success' => false, 'error' => $e->getMessage()];
            }
        }

        Response::json(['results' => $results]);
    }

    // ── POST /api/orders/{id}/refill ──────────────────────────────────────────
    public static function refill(int $id): void
    {
        $session = AuthMiddleware::requireAuth();
        $order   = OrderModel::findByIdAndUser($id, (int)$session['userId']);
        if (!$order) Response::error('Order not found', 404);
        if ($order['status'] !== 'completed') Response::error('Only completed orders can be refilled', 400);
        if (!$order['refill']) Response::error('This service does not support refill', 400);

        OrderModel::log($id, 'refill_requested', 'Refill requested by user');
        Response::success('Refill request submitted');
    }

    // ── POST /api/orders/{id}/cancel ──────────────────────────────────────────
    public static function cancel(int $id): void
    {
        $session = AuthMiddleware::requireAuth();
        $order   = OrderModel::findByIdAndUser($id, (int)$session['userId']);
        if (!$order) Response::error('Order not found', 404);
        if (!in_array($order['status'], ['pending', 'processing'], true)) {
            Response::error('Order cannot be cancelled in its current status', 400);
        }
        if (!$order['cancel']) Response::error('This service does not support cancellation', 400);

        OrderModel::updateStatus($id, 'cancelled');
        OrderModel::log($id, 'cancelled', 'Cancelled by user');
        Response::success('Order cancelled');
    }
}
