
<?php

require __DIR__ . '/config.php';

$admin = require_user();
$action = $_GET['action'] ?? '';
$isDispatcher = $admin['account_type'] === 'employee'
    && user_has_permission($admin, 'Manage schedules');
$canManageStaff = $admin['account_type'] === 'admin'
    || user_has_permission($admin, 'Manage users');
if (!$canManageStaff && !($action === 'workers' && $isDispatcher)) {
    json_out([
        'ok' => false,
        'message' => 'HR or administrator access required.'
    ], 403);
}

try {
    if ($action === 'users') {
        if (!$canManageStaff) {
            json_out(['ok' => false, 'message' => 'HR or administrator access required.'], 403);
        }
        require_method('GET');

        $where = $admin['account_type'] === 'admin'
            ? "WHERE account_type <> 'admin'"
            : "WHERE account_type = 'employee'";
        $query = db()->query(
            "SELECT u.id, u.full_name, u.username, u.email, u.phone, u.gender,
                    u.account_type, u.department, u.status, u.created_at,
                    COALESCE(c.first_name, e.first_name) AS first_name,
                    COALESCE(c.middle_name, e.middle_name) AS middle_name,
                    COALESCE(c.last_name, e.last_name) AS last_name,
                    COALESCE(c.birthdate, e.birthdate) AS birthdate,
                    COALESCE(c.address, e.address) AS address,
                    COALESCE((
                        SELECT GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ')
                        FROM user_roles ur
                        JOIN roles r ON r.id = ur.role_id
                        WHERE ur.user_id = u.id
                    ), '') AS role_names
             FROM users u
             LEFT JOIN customers c ON c.user_id = u.id
             LEFT JOIN employees e ON e.user_id = u.id
             {$where}
             ORDER BY u.created_at DESC"
        );

        json_out([
            'ok' => true,
            'users' => $query->fetchAll()
        ]);
    }

    if (in_array($action, ['create-employee', 'update-user'], true)) {
        $requiredPermission = $action === 'create-employee' ? 'Create employees' : 'Manage users';
        if ($admin['account_type'] !== 'admin' && !user_has_permission($admin, $requiredPermission)) {
            json_out(['ok' => false, 'message' => 'This account does not have permission to manage employee accounts.'], 403);
        }

        if ($action === 'update-user') {
            require_method('POST');
            $data = json_body();
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            $query = db()->prepare(
                'SELECT account_type FROM users WHERE id = ? AND account_type <> \'admin\''
            );
            $query->execute([$id]);
            $accountType = $query->fetchColumn();
            if (!$id || !$accountType || ($admin['account_type'] !== 'admin' && $accountType !== 'employee')) {
                json_out(['ok' => false, 'message' => 'Account not found or not available for your role.'], 404);
            }
            $firstName = clean_text($data['first_name'] ?? '', 80);
            $middleName = clean_text($data['middle_name'] ?? '', 80);
            $lastName = clean_text($data['last_name'] ?? '', 80);
            $username = strtolower(trim((string) ($data['username'] ?? '')));
            $email = strtolower(trim((string) ($data['email'] ?? '')));
            $phone = trim((string) ($data['phone'] ?? ''));
            $gender = (string) ($data['gender'] ?? '');
            $birthdate = trim((string) ($data['birthdate'] ?? ''));
            $address = clean_text($data['address'] ?? '', 255);
            $department = (string) ($data['department'] ?? '');
            $roleName = (string) ($data['role'] ?? '');
            $validDepartments = [
                'Administration', 'IT', 'Dispatch', 'Accounting', 'HR',
                'Marketing', 'Sales', 'Customer Service'
            ];
            $rolesByDepartment = [
                'Administration' => ['employee'],
                'IT' => ['employee'],
                'Dispatch' => ['dispatcher', 'technician'],
                'Accounting' => ['accounting'],
                'HR' => ['hr'],
                'Marketing' => ['employee'],
                'Sales' => ['employee'],
                'Customer Service' => ['customer_service']
            ];
            $roleName = $roleName !== ''
                ? $roleName
                : match ($department) {
                    'Dispatch' => 'dispatcher',
                    'Accounting' => 'accounting',
                    'HR' => 'hr',
                    'Customer Service' => 'customer_service',
                    default => 'employee'
                };
            if (
                $firstName === '' || $lastName === '' ||
                !preg_match('/^[a-z0-9._-]{3,60}$/', $username) ||
                !filter_var($email, FILTER_VALIDATE_EMAIL) ||
                !preg_match('/^[0-9]{10,15}$/', $phone) ||
                !in_array($gender, ['female', 'male', 'other', 'prefer-not-to-say'], true) ||
                !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthdate) ||
                !checkdate((int) substr($birthdate, 5, 2), (int) substr($birthdate, 8, 2), (int) substr($birthdate, 0, 4)) ||
                strtotime($birthdate) >= strtotime('today') || $address === '' ||
                (
                    $accountType === 'employee' &&
                    (
                        !in_array($department, $validDepartments, true) ||
                        !in_array($roleName, $rolesByDepartment[$department] ?? [], true)
                    )
                )
            ) {
                json_out(['ok' => false, 'message' => 'Enter valid account profile details.'], 422);
            }
            $query = db()->prepare(
                'SELECT id FROM users WHERE (email = ? OR username = ?) AND id <> ?'
            );
            $query->execute([$email, $username, $id]);
            if ($query->fetch()) {
                json_out(['ok' => false, 'message' => 'Email or username is already in use.'], 409);
            }
            $fullName = clean_text(trim($firstName . ' ' . $middleName . ' ' . $lastName), 120);
            $pdo = db();
            $pdo->beginTransaction();
            try {
                if ($accountType === 'employee') {
                    $query = $pdo->prepare(
                        'UPDATE users SET full_name = ?, username = ?, email = ?, phone = ?, gender = ?, department = ? WHERE id = ?'
                    );
                    $query->execute([$fullName, $username, $email, $phone, $gender, $department, $id]);
                    $query = $pdo->prepare('SELECT id FROM departments WHERE name = ?');
                    $query->execute([$department]);
                    $departmentId = $query->fetchColumn();
                    $query = $pdo->prepare(
                        'UPDATE employees SET first_name = ?, middle_name = ?, last_name = ?, birthdate = ?, address = ?, department_id = ? WHERE user_id = ?'
                    );
                    $query->execute([$firstName, $middleName ?: null, $lastName, $birthdate, $address, $departmentId ?: null, $id]);
                    $query = $pdo->prepare('DELETE FROM user_roles WHERE user_id = ?');
                    $query->execute([$id]);
                    $query = $pdo->prepare(
                        'INSERT INTO user_roles (user_id, role_id, assigned_by)
                         SELECT ?, id, ? FROM roles WHERE name = ?'
                    );
                    $query->execute([$id, $admin['id'], $roleName]);
                } else {
                    $query = $pdo->prepare(
                        'UPDATE users SET full_name = ?, username = ?, email = ?, phone = ?, gender = ? WHERE id = ?'
                    );
                    $query->execute([$fullName, $username, $email, $phone, $gender, $id]);
                    $query = $pdo->prepare(
                        'UPDATE customers SET first_name = ?, middle_name = ?, last_name = ?, birthdate = ?, address = ? WHERE user_id = ?'
                    );
                    $query->execute([$firstName, $middleName ?: null, $lastName, $birthdate, $address, $id]);
                }
                $query = $pdo->prepare(
                    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
                     VALUES (?, ?, ?, ?)'
                );
                $query->execute([$admin['id'], 'account_updated', 'user', $id]);
                $pdo->commit();
            } catch (Throwable $error) {
                $pdo->rollBack();
                throw $error;
            }
            json_out(['ok' => true, 'message' => 'Account updated.']);
        }
        require_method('POST');

        $data = json_body();
        $firstName = clean_text($data['first_name'] ?? '', 80);
        $middleName = clean_text($data['middle_name'] ?? '', 80);
        $lastName = clean_text($data['last_name'] ?? '', 80);
        $name = clean_text(trim($firstName . ' ' . $middleName . ' ' . $lastName), 120);
        $username = strtolower(trim((string) ($data['username'] ?? '')));
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $phone = trim((string) ($data['phone'] ?? ''));
        $birthdate = trim((string) ($data['birthdate'] ?? ''));
        $address = clean_text($data['address'] ?? '', 255);
        $department = (string) ($data['department'] ?? '');
        $password = (string) ($data['temporary_password'] ?? '');
        $roleName = (string) ($data['role'] ?? '');
        $departments = [
            'Administration',
            'IT',
            'Dispatch',
            'Accounting',
            'HR',
            'Marketing',
            'Sales',
            'Customer Service'
        ];
        $rolesByDepartment = [
            'Administration' => ['employee'],
            'IT' => ['employee'],
            'Dispatch' => ['dispatcher', 'technician'],
            'Accounting' => ['accounting'],
            'HR' => ['hr'],
            'Marketing' => ['employee'],
            'Sales' => ['employee'],
            'Customer Service' => ['customer_service']
        ];
        $gender = (string) ($data['gender'] ?? 'prefer-not-to-say');
        $roleName = $roleName !== ''
            ? $roleName
            : match ($department) {
                'Dispatch' => 'dispatcher',
                'Accounting' => 'accounting',
                'HR' => 'hr',
                'Customer Service' => 'customer_service',
                default => 'employee'
            };

        if (
            $firstName === '' ||
            $lastName === '' ||
            !preg_match('/^[a-z0-9._-]{3,60}$/', $username) ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) ||
            !preg_match('/^[0-9]{10,15}$/', $phone) ||
            !in_array($gender, ['female', 'male', 'other', 'prefer-not-to-say'], true) ||
            !in_array($department, $departments, true) ||
            !in_array($roleName, $rolesByDepartment[$department] ?? [], true) ||
            strlen($password) < 12 ||
            $birthdate === '' ||
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthdate) ||
            !checkdate((int) substr($birthdate, 5, 2), (int) substr($birthdate, 8, 2), (int) substr($birthdate, 0, 4)) ||
            strtotime($birthdate) >= strtotime('today') ||
            $address === ''
        ) {
            json_out([
                'ok' => false,
                'message' => 'Complete the employee profile with a valid username, email, phone, birthdate, address, department and temporary password (12+ characters).'
            ], 422);
        }

        $query = db()->prepare(
            'SELECT id FROM users WHERE email = ? OR username = ?'
        );
        $query->execute([$email, $username]);

        if ($query->fetch()) {
            json_out([
                'ok' => false,
                'message' => 'An account with this email already exists.'
            ], 409);
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $query = $pdo->prepare(
                "INSERT INTO users
                    (full_name, username, email, phone, gender, password_hash,
                     account_type, department, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'employee', ?, 'approved')"
            );
            $query->execute([
                $name,
                $username,
                $email,
                $phone,
                $gender,
                password_hash($password, PASSWORD_DEFAULT),
                $department
            ]);
            $employeeId = (int) $pdo->lastInsertId();
            $departmentQuery = $pdo->prepare('SELECT id FROM departments WHERE name = ?');
            $departmentQuery->execute([$department]);
            $departmentId = $departmentQuery->fetchColumn();
            $query = $pdo->prepare(
                'INSERT INTO employees
                    (user_id, first_name, middle_name, last_name, birthdate, address, department_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $query->execute([
                $employeeId,
                $firstName,
                $middleName !== '' ? $middleName : null,
                $lastName,
                $birthdate,
                $address,
                $departmentId ?: null
            ]);
            $query = $pdo->prepare(
                'INSERT INTO user_roles (user_id, role_id, assigned_by)
                 SELECT ?, id, ? FROM roles WHERE name = ?'
            );
            $query->execute([$employeeId, $admin['id'], $roleName]);
            $query = $pdo->prepare(
                'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([$admin['id'], 'employee_created', 'user', $employeeId]);
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        json_out([
            'ok' => true,
            'message' => 'Employee account created. Share the temporary password securely and ask the employee to change it after signing in.'
        ], 201);
    }

    if ($action === 'pending' || $action === 'employees') {
        if (!$canManageStaff) {
            json_out(['ok' => false, 'message' => 'HR or administrator access required.'], 403);
        }
        require_method('GET');

        $where = $action === 'pending'
            ? " AND status = 'pending'"
            : '';

        $query = db()->query(
            "SELECT id, full_name, email, phone, gender,
                    department, status, created_at
             FROM users
             WHERE account_type = 'employee'{$where}
             ORDER BY created_at DESC"
        );

        json_out([
            'ok' => true,
            'users' => $query->fetchAll()
        ]);
    }

    if ($action === 'set-status') {
        if (!$canManageStaff) {
            json_out(['ok' => false, 'message' => 'HR or administrator access required.'], 403);
        }
        require_method('POST');
        $data = json_body();
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        $status = (string) ($data['status'] ?? '');
        if (!$id || !in_array($status, ['active', 'inactive'], true)) {
            json_out(['ok' => false, 'message' => 'Choose a valid user status.'], 422);
        }
        $accountFilter = $admin['account_type'] === 'admin'
            ? "account_type <> 'admin'"
            : "account_type = 'employee'";
        $query = db()->prepare(
            "UPDATE users SET status = ?
             WHERE id = ? AND {$accountFilter} AND status IN ('approved', 'active', 'inactive')"
        );
        $query->execute([$status, $id]);
        if (!$query->rowCount()) {
            $exists = db()->prepare("SELECT id FROM users WHERE id = ? AND {$accountFilter}");
            $exists->execute([$id]);
            if (!$exists->fetch()) {
                json_out(['ok' => false, 'message' => 'Account not found.'], 404);
            }
        }
        $query = db()->prepare(
            'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
             VALUES (?, ?, ?, ?)'
        );
        $query->execute([$admin['id'], 'account_' . $status, 'user', $id]);
        json_out(['ok' => true, 'message' => 'Account status updated.']);
    }

    if ($action === 'decide') {
        if (!$canManageStaff) {
            json_out(['ok' => false, 'message' => 'HR or administrator access required.'], 403);
        }
        require_method('POST');

        $data = json_body();

        $id = filter_var(
            $data['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        $decision = $data['decision'] ?? '';

        if (!$id || !in_array($decision, ['approve', 'reject'], true)) {
            json_out([
                'ok' => false,
                'message' => 'Invalid approval action.'
            ], 422);
        }

        $status = $decision === 'approve'
            ? 'approved'
            : 'rejected';

        $query = db()->prepare(
            "UPDATE users
             SET status = ?
             WHERE id = ?
             AND account_type = 'employee'
             AND status IN ('pending', 'approved', 'rejected')"
        );

        $query->execute([$status, $id]);

        if (!$query->rowCount()) {
            json_out([
                'ok' => false,
                'message' => 'Employee not found or no change made.'
            ], 404);
        }

        $query = db()->prepare(
            'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
             VALUES (?, ?, ?, ?)'
        );
        $query->execute([$admin['id'], 'employee_' . $status, 'user', $id]);

        json_out([
            'ok' => true,
            'message' => 'Employee ' . $status . '.'
        ]);
    }

    if ($action === 'workers') {
        require_method('GET');

        $query = db()->query(
            "SELECT id, full_name, email, department
             FROM users
             WHERE account_type = 'employee'
             AND status = 'approved'
             AND (
                department = 'Technician'
                OR EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = users.id AND r.name = 'technician'
                )
             )
             ORDER BY full_name"
        );

        json_out([
            'ok' => true,
            'workers' => $query->fetchAll()
        ]);
    }

    if ($action === 'change-password') {
        require_method('POST');

        $data = json_body();

        $query = db()->prepare(
            'SELECT password_hash FROM users WHERE id = ?'
        );

        $query->execute([$admin['id']]);

        $user = $query->fetch();

        if (
            !$user ||
            !password_verify(
                (string) ($data['current_password'] ?? ''),
                $user['password_hash']
            )
        ) {
            json_out([
                'ok' => false,
                'message' => 'Current password is incorrect.'
            ], 422);
        }

        $newPassword = (string) ($data['new_password'] ?? '');

        if (strlen($newPassword) < 10) {
            json_out([
                'ok' => false,
                'message' => 'New password must be at least 10 characters.'
            ], 422);
        }

        $query = db()->prepare(
            'UPDATE users SET password_hash = ? WHERE id = ?'
        );

        $query->execute([
            password_hash($newPassword, PASSWORD_DEFAULT),
            $admin['id']
        ]);

        json_out([
            'ok' => true,
            'message' => 'Password changed.'
        ]);
    }

    json_out([
        'ok' => false,
        'message' => 'Unknown action.'
    ], 404);

} catch (Throwable $error) {
    error_log((string) $error);

    json_out([
        'ok' => false,
        'message' => 'Server error. Check database configuration.'
    ], 500);
}
