<?php
/**
 * Service Model
 */

declare(strict_types=1);

class ServiceModel
{
    public static function findById(int $id, bool $activeOnly = true): ?array
    {
        $where = 'id = ?' . ($activeOnly ? " AND status = 'active'" : '');
        $stmt  = Database::query("SELECT * FROM services WHERE $where LIMIT 1", [$id]);
        return $stmt->fetch() ?: null;
    }

    public static function listActive(array $filters = []): array
    {
        $where  = "s.status = 'active'";
        $params = [];

        if (!empty($filters['categoryId'])) {
            $where  .= ' AND s.category_id = ?';
            $params[] = (int)$filters['categoryId'];
        }
        if (!empty($filters['search'])) {
            $where  .= ' AND s.name LIKE ?';
            $params[] = '%' . $filters['search'] . '%';
        }

        $stmt = Database::query(
            "SELECT s.id, s.category_id, s.name, s.type, s.rate, s.min, s.max,
                    s.description, s.average_time, s.refill, s.cancel,
                    s.dripfeed, s.sort_order, s.status,
                    c.name AS category_name
             FROM services s
             LEFT JOIN categories c ON c.id = s.category_id
             WHERE $where
             ORDER BY s.sort_order ASC, s.name ASC",
            $params
        );
        return $stmt->fetchAll();
    }

    public static function listCategories(): array
    {
        return Database::query(
            "SELECT c.id, c.name, c.description, c.sort_order,
                    COUNT(s.id) AS service_count
             FROM categories c
             LEFT JOIN services s ON s.category_id = c.id AND s.status = 'active'
             WHERE c.active = 1
             GROUP BY c.id
             ORDER BY c.sort_order ASC, c.name ASC"
        )->fetchAll();
    }

    public static function validateOrder(int $serviceId, int $quantity): array
    {
        $service = self::findById($serviceId);
        if (!$service) {
            throw new InvalidArgumentException('Service not found or unavailable');
        }
        if ($quantity < (int)$service['min'] || $quantity > (int)$service['max']) {
            throw new InvalidArgumentException(
                "Quantity must be between {$service['min']} and {$service['max']}"
            );
        }
        $charge = round(((float)$service['rate'] * $quantity) / 1000, 4);
        return ['service' => $service, 'charge' => $charge];
    }
}
