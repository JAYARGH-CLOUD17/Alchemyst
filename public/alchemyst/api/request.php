
<?php

require __DIR__ . '/config.php';

$user = require_user();
$action = $_GET['action'] ?? '';

try {
    if ($action === 'list') {
        require_method('GET');

        if ($user['account_type'] === 'admin') {
            $query = db()->query(
                'SELECT r.*, c.full_name AS customer_name,
                        c.phone AS customer_phone, c.email AS customer_email,
                        w.full_name AS worker_name,
                        s.scheduled_date, s.start_time, s.end_time
                 FROM service_requests r
                 JOIN users c ON c.id = r.customer_id
                 LEFT JOIN users w ON w.id = r.assigned_employee_id
                 LEFT JOIN request_schedule s ON s.request_id = r.id
                 ORDER BY r.created_at DESC'
            );
        } elseif ($user['account_type'] === 'employee') {
            $canDispatch = user_has_permission($user, 'Manage schedules');
            if (!$canDispatch && !user_has_permission($user, 'Field jobs')) {
                json_out([
                    'ok' => false,
                    'message' => 'Only Technician or Dispatch employees can view service jobs.'
                ], 403);
            }

            $query = db()->prepare(
                "SELECT r.*, c.full_name AS customer_name,
                        c.phone AS customer_phone, c.email AS customer_email,
                        w.full_name AS worker_name,
                        s.scheduled_date, s.start_time, s.end_time
                 FROM service_requests r
                 JOIN users c ON c.id = r.customer_id
                 LEFT JOIN users w ON w.id = r.assigned_employee_id
                 LEFT JOIN request_schedule s ON s.request_id = r.id
                 WHERE ? = 1
                    OR r.assigned_employee_id = ?
                 ORDER BY r.created_at DESC"
            );

            $query->execute([
                $canDispatch ? 1 : 0,
                $user['id']
            ]);
        } else {
            $query = db()->prepare(
                'SELECT r.*, c.full_name AS customer_name,
                        c.phone AS customer_phone, c.email AS customer_email,
                        w.full_name AS worker_name,
                        s.scheduled_date, s.start_time, s.end_time
                 FROM service_requests r
                 JOIN users c ON c.id = r.customer_id
                 LEFT JOIN users w ON w.id = r.assigned_employee_id
                 LEFT JOIN request_schedule s ON s.request_id = r.id
                 WHERE r.customer_id = ?
                 ORDER BY r.created_at DESC'
            );

            $query->execute([$user['id']]);
        }

        json_out([
            'ok' => true,
            'requests' => $query->fetchAll()
        ]);
    }

    if ($action === 'create') {
        require_method('POST');

        if ($user['account_type'] !== 'customer') {
            json_out([
                'ok' => false,
                'message' => 'Only customer accounts can submit service requests.'
            ], 403);
        }

        $data = json_body();

        $type = clean_text($data['service_type'] ?? '', 80);
        $address = clean_text($data['address'] ?? '', 255);
        $details = clean_text($data['details'] ?? '', 4000);
        $date = trim((string) ($data['preferred_date'] ?? ''));
        $time = trim((string) ($data['preferred_time'] ?? ''));

        $availableServices = db()->query(
            'SELECT service_type
             FROM service_catalog
             WHERE booking_enabled = 1'
        )->fetchAll(PDO::FETCH_COLUMN);

        if (
            !in_array($type, $availableServices, true) ||
            $address === '' ||
            $details === ''
        ) {
            json_out([
                'ok' => false,
                'message' => 'Complete all required service request fields.'
            ], 422);
        }

        if (
            $date !== '' &&
            (
                !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ||
                !checkdate(
                    (int) substr($date, 5, 2),
                    (int) substr($date, 8, 2),
                    (int) substr($date, 0, 4)
                )
            )
        ) {
            json_out([
                'ok' => false,
                'message' => 'Invalid preferred date.'
            ], 422);
        }

        if (
            $time !== '' &&
            (
                !preg_match('/^\d{2}:\d{2}$/', $time) ||
                strtotime('1970-01-01 ' . $time) === false
            )
        ) {
            json_out([
                'ok' => false,
                'message' => 'Enter a valid preferred appointment time.'
            ], 422);
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $query = $pdo->prepare(
                'INSERT INTO service_requests
                    (customer_id, service_type, address, details, preferred_date)
                 VALUES (?, ?, ?, ?, ?)'
            );

            $query->execute([
                $user['id'],
                $type,
                $address,
                $details,
                $date ?: null
            ]);
            $requestId = (int) $pdo->lastInsertId();

            if ($date !== '' || $time !== '') {
                $query = $pdo->prepare(
                    'INSERT INTO request_schedule
                        (request_id, scheduled_date, start_time)
                     VALUES (?, ?, ?)'
                );
                $query->execute([
                    $requestId,
                    $date ?: null,
                    $time !== '' ? $time . ':00' : null
                ]);
            }

            $query = $pdo->prepare(
                'INSERT INTO user_notifications (user_id, booking_id, title, message)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([
                $user['id'],
                $requestId,
                'Service request received',
                'Your ' . $type . ' request was submitted. We will contact you about scheduling.'
            ]);

            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        json_out([
            'ok' => true,
            'message' => 'Service request submitted.',
            'id' => $requestId
        ], 201);
    }

    if ($action === 'customer-update') {
        require_method('POST');
        if ($user['account_type'] !== 'customer') {
            json_out(['ok' => false, 'message' => 'Customer account required.'], 403);
        }
        $data = json_body();
        $id = filter_var($data['request_id'] ?? null, FILTER_VALIDATE_INT);
        $operation = (string) ($data['operation'] ?? '');
        if (!$id || $operation !== 'cancel') {
            json_out(['ok' => false, 'message' => 'Choose a valid booking action.'], 422);
        }
        $query = db()->prepare(
            "UPDATE service_requests
             SET status = 'cancelled'
             WHERE id = ? AND customer_id = ?
               AND status IN ('submitted', 'scheduled')"
        );
        $query->execute([$id, $user['id']]);
        if (!$query->rowCount()) {
            json_out([
                'ok' => false,
                'message' => 'This booking can no longer be cancelled online. Contact Customer Service for help.'
            ], 409);
        }
        $query = db()->prepare(
            "UPDATE technician_assignments
             SET status = 'cancelled'
             WHERE booking_id = ? AND status = 'assigned'"
        );
        $query->execute([$id]);
        $query = db()->prepare(
            'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
             VALUES (?, ?, ?, ?)'
        );
        $query->execute([$user['id'], 'booking_cancelled', 'booking', $id]);
        $query = db()->prepare(
            'INSERT INTO user_notifications (user_id, booking_id, title, message)
             VALUES (?, ?, ?, ?)'
        );
        $query->execute([$user['id'], $id, 'Booking cancelled', 'Your service booking has been cancelled.']);
        json_out(['ok' => true, 'message' => 'Booking cancelled.']);
    }

    if ($action === 'update') {
        require_method('POST');

        if (!in_array($user['account_type'], ['admin', 'employee'], true)) {
            json_out([
                'ok' => false,
                'message' => 'Not allowed.'
            ], 403);
        }

        $data = json_body();

        $id = filter_var(
            $data['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        $status = (string) ($data['status'] ?? '');
        $notes = clean_text($data['worker_notes'] ?? '', 4000);

        $validStatuses = [
            'scheduled',
            'in_progress',
            'completed',
            'cancelled'
        ];

        if (!$id || !in_array($status, $validStatuses, true)) {
            json_out([
                'ok' => false,
                'message' => 'Invalid update.'
            ], 422);
        }

        if (
            $user['account_type'] === 'employee' &&
            !user_has_permission($user, 'Field jobs') &&
            !user_has_permission($user, 'Manage schedules')
        ) {
            json_out([
                'ok' => false,
                'message' => 'Not allowed for your department.'
            ], 403);
        }

        $query = db()->prepare(
            'SELECT id, customer_id, service_type, assigned_employee_id
             FROM service_requests
             WHERE id = ?'
        );

        $query->execute([$id]);

        $request = $query->fetch();

        if (!$request) {
            json_out([
                'ok' => false,
                'message' => 'Request not found.'
            ], 404);
        }

        if (
            $user['account_type'] === 'employee' &&
            (
                $request['assigned_employee_id'] === null ||
                (int) $request['assigned_employee_id'] !== (int) $user['id']
            )
        ) {
            json_out([
                'ok' => false,
                'message' => 'This job is not assigned to your account.'
            ], 403);
        }

        $query = db()->prepare(
            'UPDATE service_requests
             SET status = ?, worker_notes = ?
             WHERE id = ?'
        );

        $query->execute([
            $status,
            $notes,
            $id
        ]);

        $query = db()->prepare(
            'INSERT INTO user_notifications (user_id, booking_id, title, message)
             VALUES (?, ?, ?, ?)'
        );
        $query->execute([
            $request['customer_id'],
            $id,
            'Service booking updated',
            'Your ' . $request['service_type'] . ' booking status is now ' . str_replace('_', ' ', $status) . '.'
        ]);

        json_out([
            'ok' => true,
            'message' => 'Service request updated.'
        ]);
    }

    if ($action === 'assign') {
        require_method('POST');

        if (
            $user['account_type'] !== 'admin' &&
            !user_has_permission($user, 'Manage schedules')
        ) {
            json_out([
                'ok' => false,
                'message' => 'Dispatch or administrator access required.'
            ], 403);
        }

        $data = json_body();

        $id = filter_var(
            $data['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        $workerId = filter_var(
            $data['worker_id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id || !$workerId) {
            json_out([
                'ok' => false,
                'message' => 'Choose a valid request and worker.'
            ], 422);
        }

        $query = db()->prepare(
            "SELECT id
             FROM users
             WHERE id = ?
             AND account_type = 'employee'
             AND (
                department = 'Technician'
                OR EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = users.id AND r.name = 'technician'
                )
             )
             AND status = 'approved'"
        );

        $query->execute([$workerId]);

        if (!$query->fetch()) {
            json_out([
                'ok' => false,
                'message' => 'Selected worker is not an approved Technician.'
            ], 422);
        }

        $query = db()->prepare(
            "UPDATE service_requests
             SET assigned_employee_id = ?,
                 status = IF(status = 'submitted', 'scheduled', status)
             WHERE id = ?"
        );

        $query->execute([$workerId, $id]);

        if (!$query->rowCount()) {
            json_out([
                'ok' => false,
                'message' => 'Request not found or unchanged.'
            ], 404);
        }

        json_out([
            'ok' => true,
            'message' => 'Worker assigned.'
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
        'message' => 'Server error. Check the database configuration.'
    ], 500);
}
