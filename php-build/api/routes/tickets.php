<?php
/** Tickets routes — auth required */

$sess     = requireAuth();
$uid      = (int)$sess['userId'];
$method   = method();
$seg      = $GLOBALS['routeSegments'] ?? [];
$ticketId = (int)($seg[1] ?? 0);
$sub      = $seg[2] ?? '';  // 'messages'
$db       = getDB();

// GET /api/tickets
if ($method === 'GET' && !$ticketId) {
    $where  = 'user_id = ?'; $params = [$uid];
    if (!empty($_GET['status'])) { $where .= ' AND status = ?'; $params[] = $_GET['status']; }
    $stmt = $db->prepare("SELECT * FROM tickets WHERE $where ORDER BY updated_at DESC");
    $stmt->execute($params);
    jsonOut(['tickets' => $stmt->fetchAll()]);
}

// POST /api/tickets
if ($method === 'POST' && !$ticketId) {
    $body     = getBody();
    $subject  = trim($body['subject'] ?? '');
    $message  = trim($body['message'] ?? '');
    $priority = $body['priority'] ?? 'medium';
    if (strlen($subject) < 5 || strlen($subject) > 200) jsonError('Subject phải từ 5-200 ký tự');
    if (strlen($message) < 10) jsonError('Message phải ít nhất 10 ký tự');
    if (!in_array($priority, ['low','medium','high'])) $priority = 'medium';

    $db->prepare("INSERT INTO tickets (user_id, subject, status, priority) VALUES (?,?,'open',?)")
       ->execute([$uid, $subject, $priority]);
    $tid = (int)$db->lastInsertId('tickets_id_seq');
    $db->prepare('INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?,?,?,?)')
       ->execute([$tid, $uid, $message, false]);

    // Telegram notify (fire and forget)
    sendTelegram("🎫 <b>Ticket hỗ trợ mới #$tid</b>\n👤 User ID: $uid\n📝 Tiêu đề: $subject");

    $stmt = $db->prepare('SELECT * FROM tickets WHERE id = ? LIMIT 1'); $stmt->execute([$tid]);
    jsonOut($stmt->fetch(), 201);
}

// GET /api/tickets/:id
if ($method === 'GET' && $ticketId && !$sub) {
    $stmt = $db->prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$ticketId, $uid]);
    $ticket = $stmt->fetch();
    if (!$ticket) jsonError('Ticket not found', 404);
    $msgs = $db->prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at');
    $msgs->execute([$ticketId]);
    jsonOut(array_merge($ticket, ['messages' => $msgs->fetchAll()]));
}

// POST /api/tickets/:id/messages
if ($method === 'POST' && $ticketId && $sub === 'messages') {
    $body    = getBody();
    $message = trim($body['message'] ?? '');
    if (!$message) jsonError('Message is required');
    $stmt = $db->prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$ticketId, $uid]);
    $ticket = $stmt->fetch();
    if (!$ticket) jsonError('Ticket not found', 404);
    if ($ticket['status'] === 'closed') jsonError('Ticket is closed');
    $db->prepare('INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?,?,?,?)')
       ->execute([$ticketId, $uid, $message, false]);
    $msgId = (int)$db->lastInsertId('ticket_messages_id_seq');
    $db->prepare("UPDATE tickets SET status = 'pending', updated_at = NOW() WHERE id = ?")->execute([$ticketId]);
    $stmt = $db->prepare('SELECT * FROM ticket_messages WHERE id = ? LIMIT 1'); $stmt->execute([$msgId]);
    jsonOut($stmt->fetch(), 201);
}

jsonError('Not found', 404);
