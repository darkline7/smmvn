<?php
/** Services & Categories — public read */

$method  = method();
$seg     = $GLOBALS['routeSegments'] ?? [];
$section = $seg[0] ?? '';  // 'services' or 'categories'
$id      = (int)($seg[1] ?? 0);
$db      = getDB();

if ($method !== 'GET') jsonError('Method not allowed', 405);

switch ($section) {
    case 'categories':
        $rows = $db->query(
            "SELECT c.id, c.name, c.description, c.sort_order, c.active,
                    (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id AND s.status = 'active') AS service_count
             FROM categories c WHERE c.active = true ORDER BY c.sort_order, c.name"
        )->fetchAll();
        jsonOut(['categories' => $rows]);

    case 'services':
        if ($id) {
            $stmt = $db->prepare(
                "SELECT s.*, (SELECT name FROM categories WHERE id = s.category_id) AS category_name
                 FROM services s WHERE s.id = ? LIMIT 1"
            );
            $stmt->execute([$id]);
            $svc = $stmt->fetch();
            if (!$svc) jsonError('Service not found', 404);
            jsonOut($svc);
        }
        $where  = "s.status = 'active'";
        $params = [];
        if (!empty($_GET['categoryId'])) { $where .= ' AND s.category_id = ?'; $params[] = (int)$_GET['categoryId']; }
        if (!empty($_GET['search']))     { $where .= ' AND s.name ILIKE ?';    $params[] = '%' . $_GET['search'] . '%'; }
        $stmt = $db->prepare(
            "SELECT s.id, s.category_id, s.name, s.type, s.rate, s.min, s.max,
                    s.description, s.average_time, s.refill, s.cancel, s.dripfeed, s.subscriptions, s.status,
                    (SELECT name FROM categories WHERE id = s.category_id) AS category_name
             FROM services s WHERE $where ORDER BY s.sort_order, s.name"
        );
        $stmt->execute($params);
        jsonOut(['services' => $stmt->fetchAll()]);

    default:
        jsonError('Not found', 404);
}
