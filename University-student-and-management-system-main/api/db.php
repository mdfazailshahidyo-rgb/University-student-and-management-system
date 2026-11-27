<?php
/** PDO connection factory: the Application Layer <-> Database Layer bridge. */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Return a shared PDO connection to MySQL.
 *
 * @return PDO
 */
function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $exception) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'      => false,
            'message' => 'Database connection failed. Check api/config.php and import database/university.sql.',
            'detail'  => $exception->getMessage(),
        ]);
        exit;
    }

    return $pdo;
}
