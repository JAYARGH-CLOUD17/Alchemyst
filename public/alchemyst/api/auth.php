
<?php

require __DIR__ . '/config.php';

start_session();

$action = $_GET['action'] ?? '';

try {
    if ($action === 'register') {
        require_method('POST');

        $data = json_body();

        $firstName = clean_text($data['first_name'] ?? '', 80);
        $middleName = clean_text($data['middle_name'] ?? '', 80);
        $lastName = clean_text($data['last_name'] ?? '', 80);
        $name = clean_text(trim($firstName . ' ' . $middleName . ' ' . $lastName), 120);
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $username = strtolower(trim((string) ($data['username'] ?? '')));
        $phone = trim((string) ($data['phone'] ?? ''));
        $gender = (string) ($data['gender'] ?? '');
        $birthdate = trim((string) ($data['birthdate'] ?? ''));
        $address = clean_text($data['address'] ?? '', 255);
        $password = (string) ($data['password'] ?? '');
        $confirmPassword = (string) ($data['confirm_password'] ?? '');
        if (
            $firstName === '' ||
            $lastName === '' ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) ||
            !preg_match('/^[a-z0-9._-]{3,60}$/', $username)
        ) {
            json_out([
                'ok' => false,
                'message' => 'Enter your first and last name, a valid email, and a username (3–60 letters, numbers, dots, underscores or hyphens).'
            ], 422);
        }

        if (
            $birthdate === '' ||
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthdate) ||
            !checkdate(
                (int) substr($birthdate, 5, 2),
                (int) substr($birthdate, 8, 2),
                (int) substr($birthdate, 0, 4)
            ) ||
            strtotime($birthdate) >= strtotime('today') ||
            $address === ''
        ) {
            json_out([
                'ok' => false,
                'message' => 'Enter a valid birthdate and address.'
            ], 422);
        }

        if (!preg_match('/^[0-9]{10,15}$/', $phone)) {
            json_out([
                'ok' => false,
                'message' => 'Phone number must contain 10–15 digits only.'
            ], 422);
        }

        $validGenders = [
            'female',
            'male',
            'other',
            'prefer-not-to-say'
        ];

        if (!in_array($gender, $validGenders, true)) {
            json_out([
                'ok' => false,
                'message' => 'Please select a gender option.'
            ], 422);
        }

        if (
            strlen($password) < 8 ||
            $password !== $confirmPassword
        ) {
            json_out([
                'ok' => false,
                'message' => 'Passwords must match and contain at least 8 characters.'
            ], 422);
        }

        if (($data['account_type'] ?? 'customer') !== 'customer') {
            json_out([
                'ok' => false,
                'message' => 'Employee accounts must be created by HR or an administrator.'
            ], 403);
        }

        $query = db()->prepare(
            'SELECT id FROM users WHERE email = ? OR username = ?'
        );

        $query->execute([$email, $username]);

        if ($query->fetch()) {
            json_out([
                'ok' => false,
                'message' => 'This email is already registered.'
            ], 409);
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $query = $pdo->prepare(
                "INSERT INTO users
                    (full_name, username, email, phone, gender, password_hash,
                     account_type, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'customer', 'approved')"
            );
            $query->execute([
                $name,
                $username,
                $email,
                $phone,
                $gender,
                password_hash($password, PASSWORD_DEFAULT)
            ]);
            $userId = (int) $pdo->lastInsertId();
            $query = $pdo->prepare(
                'INSERT INTO customers
                    (user_id, first_name, middle_name, last_name, birthdate, address)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $query->execute([
                $userId,
                $firstName,
                $middleName !== '' ? $middleName : null,
                $lastName,
                $birthdate,
                $address
            ]);
            $query = $pdo->prepare(
                "INSERT INTO user_roles (user_id, role_id)
                 SELECT ?, id FROM roles WHERE name = 'customer'"
            );
            $query->execute([$userId]);
            $query = $pdo->prepare(
                'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([$userId, 'account_registered', 'user', $userId]);
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        json_out([
            'ok' => true,
            'message' => 'Account created. You can now sign in.'
        ], 201);
    }

    if ($action === 'login') {
        require_method('POST');

        $data = json_body();

        $identifier = strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        $loginType = (string) ($data['login_type'] ?? 'customer');

        if (!in_array($loginType, ['customer', 'employee'], true)) {
            json_out([
                'ok' => false,
                'message' => 'Choose customer or employee sign-in.'
            ], 422);
        }

        $query = db()->prepare(
            'SELECT * FROM users WHERE email = ? OR username = ?'
        );

        $query->execute([$identifier, $identifier]);

        $user = $query->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_out([
                'ok' => false,
                'message' => 'Incorrect email or password.'
            ], 401);
        }

        $allowedAccountTypes = $loginType === 'customer'
            ? ['customer']
            : ['employee', 'admin'];

        if (!in_array($user['account_type'], $allowedAccountTypes, true)) {
            json_out([
                'ok' => false,
                'message' => 'Incorrect email or password for this sign-in type.'
            ], 401);
        }

        if ($user['status'] === 'pending') {
            json_out([
                'ok' => false,
                'message' => 'Your employee account is waiting for administrator approval.'
            ], 403);
        }

        if ($user['status'] === 'rejected') {
            json_out([
                'ok' => false,
                'message' => 'Your employee application was rejected. Contact the administrator.'
            ], 403);
        }

        if ($user['status'] === 'inactive') {
            json_out([
                'ok' => false,
                'message' => 'This account is inactive. Contact the administrator.'
            ], 403);
        }

        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $user['id'];

        json_out([
            'ok' => true,
            'user' => current_user()
        ]);
    }

    if ($action === 'me') {
        require_method('GET');

        $user = current_user();

        if (!$user) {
            json_out([
                'ok' => false,
                'message' => 'Not signed in.'
            ], 401);
        }

        json_out([
            'ok' => true,
            'user' => $user
        ]);
    }

    if ($action === 'logout') {
        require_method('POST');

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();

            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        session_destroy();

        json_out(['ok' => true]);
    }

    json_out([
        'ok' => false,
        'message' => 'Unknown action.'
    ], 404);

} catch (Throwable $error) {
    error_log((string) $error);

    json_out([
        'ok' => false,
        'message' => 'Server/database error. Check the database import and api/config.php settings.'
    ], 500);
}
