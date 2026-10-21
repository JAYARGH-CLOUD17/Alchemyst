<?php

declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_NAME = 'sunsonsolar';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST
        . ';dbname=' . DB_NAME
        . ';charset=utf8mb4';

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ];

    $pdo = new PDO(
        $dsn,
        DB_USER,
        DB_PASS,
        $options
    );

    return $pdo;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('sunsonsolar_session');

    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']),
        'samesite' => 'Lax'
    ]);

    session_start();
}

function json_out(array $data, int $status = 200): never
{
    http_response_code($status);

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    echo json_encode($data);
    exit;
}

function json_body(): array
{
    $input = file_get_contents('php://input');
    $data = json_decode($input ?: '{}', true);

    return is_array($data) ? $data : [];
}

function require_method(string $method): void
{
    $currentMethod = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($currentMethod !== $method) {
        json_out([
            'ok' => false,
            'message' => 'Method not allowed.'
        ], 405);
    }
}

function current_user(): ?array
{
    start_session();

    if (empty($_SESSION['uid'])) {
        return null;
    }

    $query = db()->prepare(
        'SELECT u.id, u.full_name, u.username, u.email, u.phone, u.gender,
                u.account_type, u.department, u.status, u.created_at,
                COALESCE(c.first_name, e.first_name) AS first_name,
                COALESCE(c.middle_name, e.middle_name) AS middle_name,
                COALESCE(c.last_name, e.last_name) AS last_name,
                COALESCE(c.birthdate, e.birthdate) AS birthdate,
                COALESCE(c.address, e.address) AS address,
                (
                    SELECT GROUP_CONCAT(DISTINCT r.name ORDER BY r.name)
                    FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = u.id
                ) AS role_names,
                (
                    SELECT GROUP_CONCAT(DISTINCT rp.permission_key ORDER BY rp.permission_key)
                    FROM user_roles ur
                    JOIN role_permissions rp ON rp.role_id = ur.role_id
                    WHERE ur.user_id = u.id
                ) AS permission_keys
         FROM users u
         LEFT JOIN customers c ON c.user_id = u.id
         LEFT JOIN employees e ON e.user_id = u.id
         WHERE u.id = ?'
    );

    $query->execute([(int) $_SESSION['uid']]);

    $user = $query->fetch();

    if (
        !$user ||
        !in_array($user['status'], ['approved', 'active'], true)
    ) {
        $_SESSION = [];
        session_destroy();

        return null;
    }

    return $user;
}

function user_has_role(array $user, string $role): bool
{
    return in_array($role, explode(',', (string) ($user['role_names'] ?? '')), true);
}

function user_has_permission(array $user, string $permission): bool
{
    return in_array($permission, explode(',', (string) ($user['permission_keys'] ?? '')), true);
}

function require_user(): array
{
    $user = current_user();

    if (!$user) {
        json_out([
            'ok' => false,
            'message' => 'Please sign in first.'
        ], 401);
    }

    return $user;
}

function require_admin(): array
{
    $user = require_user();

    if ($user['account_type'] !== 'admin') {
        json_out([
            'ok' => false,
            'message' => 'Administrator access required.'
        ], 403);
    }

    return $user;
}

function clean_text($value, int $max = 255): string
{
    $text = trim((string) $value);

    return mb_substr($text, 0, $max);
}
