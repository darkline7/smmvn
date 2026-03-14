<?php
/**
 * Order Model
 */

declare(strict_types=1);

class OrderModel
{
    public static function create(int $userId, int $serviceId, string $link, int $quantity, float $charge): int
    {
        return Database::insert(
            'INSERT INTO orders (user_id, service_id, link, quantity, charge, status)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$userId, $serviceId, $link, $quantity, number_format($charge, 4, '.', ''), 'pending']
        );
    }

    public static function findById(int $id): ?array
    {
        $stmt = Database::query(
            'SELECT o.*, s.name AS service_name, s.category_id,
                    (SELECT name FROM categories WHERE id = s.category_id) AS category_name
             FROM orders o
             LEFT JOIN services s ON s.id = o.service_id
             WHERE o.id = ? LIMIT 1',
            [$id]
        );
        return $stmt->fetch() ?: null;
    }

    public static function findByIdAndUser(int $id, int $userId): ?array
    {
        $stmt = Database::query(
            'SELECT o.*, s.name AS service_name, s.refill, s.cancel
             FROM orders o
             LEFT JOIN services s ON s.id = o.service_id
             WHERE o.id = ? AND o.user_id = ? LIMIT 1',
            [$id, $userId]
        );
        return $stmt->fetch() ?: null;
    }

    public static function listForUser(int $userId, array $filters = []): array
    {
        $p      = paginate();
        $where  = 'o.user_id = ?';
        $params = [$userId];

        if (!empty($filters['status'])) {
            $allowed = ['pending','processing','active','partial','completed','cancelled','failed','refunded'];
            if (in_array($filters['status'], $allowed, true)) {
                $where   .= ' AND o.status = ?';
                $params[] = $filters['status'];
            }
        }
        if (!empty($filters['serviceId'])) {
            $where   .= ' AND o.service_id = ?';
            $params[] = (int)$filters['serviceId'];
        }

        $countStmt = Database::query("SELECT COUNT(*) FROM orders o WHERE $where", $params);
        $total     = (int)$countStmt->fetchColumn();

        $stmt = Database::query(
            "SELECT o.id, o.service_id, o.link, o.quantity, o.charge, o.status,
                    o.start_count, o.remains, o.provider_order_id, o.created_at,
                    s.name AS service_name
             FROM orders o
             LEFT JOIN services s ON s.id = o.service_id
             WHERE $where
             ORDER BY o.created_at DESC
             LIMIT ? OFFSET ?",
            array_merge($params, [$p['limit'], $p['offset']])
        );

        return [
            'orders'     => $stmt->fetchAll(),
            'total'      => $total,
            'page'       => $p['page'],
            'totalPages' => (int)ceil($total / $p['limit']),
        ];
    }

    public static function updateStatus(int $orderId, string $status, array $extra = []): void
    {
        $sets   = ['status = ?', 'updated_at = NOW()'];
        $params = [$status];

        if (isset($extra['startCount'])) { $sets[] = 'start_count = ?'; $params[] = (int)$extra['startCount']; }
        if (isset($extra['remains']))    { $sets[] = 'remains = ?';     $params[] = (int)$extra['remains']; }
        if (isset($extra['providerOrderId'])) { $sets[] = 'provider_order_id = ?'; $params[] = (string)$extra['providerOrderId']; }

        $params[] = $orderId;
        Database::query('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
    }

    public static function log(int $orderId, string $status, string $note = ''): void
    {
        Database::query(
            'INSERT INTO order_logs (order_id, status, note) VALUES (?, ?, ?)',
            [$orderId, $status, $note]
        );
    }

    public static function submitToProvider(int $orderId): void
    {
        $order = self::findById($orderId);
        if (!$order) return;

        $provider = Database::query(
            'SELECT p.* FROM providers p
             JOIN services s ON s.provider_id = p.id
             WHERE s.id = ? LIMIT 1',
            [$order['service_id']]
        )->fetch();

        if (!$provider) {
            self::updateStatus($orderId, 'pending');
            return;
        }

        $result = callProviderApi($provider['base_url'], $provider['api_key'], [
            'action'   => 'add',
            'service'  => Database::query('SELECT provider_service_id FROM services WHERE id = ? LIMIT 1', [$order['service_id']])->fetchColumn(),
            'link'     => $order['link'],
            'quantity' => $order['quantity'],
        ]);

        if ($result && isset($result['order'])) {
            self::updateStatus($orderId, 'processing', ['providerOrderId' => $result['order']]);
            self::log($orderId, 'processing', "Sent to provider, order #{$result['order']}");
        } else {
            $err = $result['error'] ?? 'Provider error';
            self::updateStatus($orderId, 'failed');
            self::log($orderId, 'failed', $err);
        }
    }
}
