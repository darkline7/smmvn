<?php
/**
 * Support Ticket Controller
 */

declare(strict_types=1);

class TicketController
{
    // ── GET /api/tickets ──────────────────────────────────────────────────────
    public static function index(): void
    {
        $session = AuthMiddleware::requireAuth();
        $p       = paginate();
        $where   = 'user_id = ?';
        $params  = [$session['userId']];

        if (!empty($_GET['status']) && in_array($_GET['status'], ['open', 'pending', 'closed'], true)) {
            $where   .= ' AND status = ?';
            $params[] = $_GET['status'];
        }

        $total = (int)Database::query("SELECT COUNT(*) FROM tickets WHERE $where", $params)->fetchColumn();
        $rows  = Database::query(
            "SELECT id, subject, status, priority, created_at, updated_at
             FROM tickets WHERE $where ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            array_merge($params, [$p['limit'], $p['offset']])
        )->fetchAll();

        Response::json(['tickets' => $rows, 'total' => $total, 'page' => $p['page'], 'totalPages' => (int)ceil($total / $p['limit'])]);
    }

    // ── POST /api/tickets ─────────────────────────────────────────────────────
    public static function store(): void
    {
        $session = AuthMiddleware::requireAuth();
        $v       = Validator::make(getBody())
            ->string('subject', 5, 200)
            ->string('message', 10, 5000)
            ->in('priority', ['low', 'medium', 'high'], false);
        $v->abortIfFails();

        $ticketId = Database::insert(
            "INSERT INTO tickets (user_id, subject, status, priority) VALUES (?, ?, 'open', ?)",
            [$session['userId'], $v->get('subject'), $v->get('priority') ?: 'medium']
        );

        Database::query(
            'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, 0)',
            [$ticketId, $session['userId'], $v->get('message')]
        );

        Telegram::newTicket($ticketId, $v->get('subject'), (int)$session['userId']);

        $ticket = Database::query('SELECT * FROM tickets WHERE id = ? LIMIT 1', [$ticketId])->fetch();
        Response::json($ticket, 201);
    }

    // ── GET /api/tickets/{id} ─────────────────────────────────────────────────
    public static function show(int $id): void
    {
        $session = AuthMiddleware::requireAuth();
        $ticket  = Database::query(
            'SELECT * FROM tickets WHERE id = ? AND user_id = ? LIMIT 1',
            [$id, $session['userId']]
        )->fetch();
        if (!$ticket) Response::error('Ticket not found', 404);

        $messages = Database::query(
            'SELECT tm.id, tm.message, tm.is_admin, tm.created_at,
                    u.username AS sender_name
             FROM ticket_messages tm
             LEFT JOIN users u ON u.id = tm.user_id
             WHERE tm.ticket_id = ?
             ORDER BY tm.created_at ASC',
            [$id]
        )->fetchAll();

        Response::json(array_merge($ticket, ['messages' => $messages]));
    }

    // ── POST /api/tickets/{id}/messages ───────────────────────────────────────
    public static function addMessage(int $id): void
    {
        $session = AuthMiddleware::requireAuth();
        $v       = Validator::make(getBody())->string('message', 2, 5000);
        $v->abortIfFails();

        $ticket = Database::query(
            'SELECT * FROM tickets WHERE id = ? AND user_id = ? LIMIT 1',
            [$id, $session['userId']]
        )->fetch();
        if (!$ticket) Response::error('Ticket not found', 404);
        if ($ticket['status'] === 'closed') Response::error('Cannot reply to a closed ticket', 400);

        $msgId = Database::insert(
            'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, 0)',
            [$id, $session['userId'], $v->get('message')]
        );

        Database::query("UPDATE tickets SET status = 'pending', updated_at = NOW() WHERE id = ?", [$id]);
        $msg = Database::query('SELECT * FROM ticket_messages WHERE id = ? LIMIT 1', [$msgId])->fetch();
        Response::json($msg, 201);
    }

    // ── DELETE /api/tickets/{id} ──────────────────────────────────────────────
    public static function close(int $id): void
    {
        $session = AuthMiddleware::requireAuth();
        $ticket  = Database::query(
            "SELECT * FROM tickets WHERE id = ? AND user_id = ? LIMIT 1",
            [$id, $session['userId']]
        )->fetch();
        if (!$ticket) Response::error('Ticket not found', 404);

        Database::query("UPDATE tickets SET status = 'closed', updated_at = NOW() WHERE id = ?", [$id]);
        Response::success('Ticket closed');
    }
}
