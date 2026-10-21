
<?php

require __DIR__ . '/config.php';

require_method('GET');

$remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';

if (!in_array($remoteAddress, ['127.0.0.1', '::1', '::ffff:127.0.0.1'], true)) {
    json_out([
        'ok' => false,
        'message' => 'Automatic administrator setup is available only on this computer.'
    ], 403);
}

try {
    $email = 'admin@sunsonsolar.local';
    $password = 'ChangeMe!123';

    $pdo = db();
    $pdo->beginTransaction();

    $query = db()->prepare(
        "SELECT id FROM users
         WHERE account_type = 'admin'
         LIMIT 1"
    );
    $query->execute();

    if ($query->fetch()) {
        $pdo->commit();
        json_out([
            'ok' => true,
            'created' => false,
            'message' => 'Administrator setup is already complete.'
        ]);
    }

    $query = $pdo->prepare(
        "INSERT INTO users
            (full_name, email, phone, gender, password_hash,
             account_type, department, status)
         VALUES (?, ?, ?, ?, ?, 'admin', 'Administration', 'active')"
    );

    $query->execute([
        'Sun Son Administrator',
        $email,
        '09123456789',
        'prefer-not-to-say',
        password_hash($password, PASSWORD_DEFAULT)
    ]);
    $adminId = (int) $pdo->lastInsertId();
    $query = $pdo->prepare(
        "INSERT INTO user_roles (user_id, role_id)
         SELECT ?, id FROM roles WHERE name = 'admin'"
    );
    $query->execute([$adminId]);
    $query = $pdo->prepare(
        'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, ?)'
    );
    $query->execute([$adminId, 'administrator_created', 'user', $adminId]);
    $pdo->commit();

    json_out([
        'ok' => true,
        'created' => true,
        'message' => 'Initial admin created. Login: admin@sunsonsolar.local · Temporary password: ChangeMe!123. Change this password after signing in.'
    ]);

} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log((string) $error);

    json_out([
        'ok' => false,
        'message' => 'Setup failed. Import database.sql and check api/config.php.'
    ], 500);
}
