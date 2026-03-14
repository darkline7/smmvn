<?php
/**
 * Database Configuration — MySQL/MariaDB via PDO
 * SMM Panel Pro — Production Ready
 */

declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;

    public static function getInstance(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $dsn    = env('DATABASE_URL');
        $host   = env('DB_HOST', '127.0.0.1');
        $port   = env('DB_PORT', '3306');
        $name   = env('DB_NAME', 'smm_panel');
        $user   = env('DB_USER', 'root');
        $pass   = env('DB_PASS', '');

        // Support both DATABASE_URL (mysql://user:pass@host:port/dbname) and individual vars
        if ($dsn && str_starts_with($dsn, 'mysql://')) {
            $parsed = parse_url($dsn);
            $host   = $parsed['host'] ?? $host;
            $port   = (string)($parsed['port'] ?? $port);
            $name   = ltrim($parsed['path'] ?? "/$name", '/');
            $user   = $parsed['user'] ?? $user;
            $pass   = $parsed['pass'] ?? $pass;
        }

        $pdoDsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";

        try {
            self::$instance = new PDO($pdoDsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_FOUND_ROWS   => true,
                // Force SSL if cert available
                // PDO::MYSQL_ATTR_SSL_CA => '/path/to/ca-cert.pem',
            ]);
            self::$instance->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
            self::$instance->exec("SET time_zone = '+00:00'");
        } catch (PDOException $e) {
            // NEVER expose DB error details in production
            error_log('[SMM-DB] Connection failed: ' . $e->getMessage());
            http_response_code(503);
            die(json_encode(['error' => 'Service temporarily unavailable']));
        }

        return self::$instance;
    }

    // Convenience wrapper
    public static function query(string $sql, array $params = []): PDOStatement
    {
        $db   = self::getInstance();
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function insert(string $sql, array $params = []): int
    {
        $db = self::getInstance();
        $db->prepare($sql)->execute($params);
        return (int)$db->lastInsertId();
    }

    public static function transaction(callable $fn): mixed
    {
        $db = self::getInstance();
        $db->beginTransaction();
        try {
            $result = $fn($db);
            $db->commit();
            return $result;
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }
}
