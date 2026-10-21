<?php

require __DIR__ . '/config.php';

$user = require_user();
$action = $_GET['action'] ?? '';

function portal_request(int $id): ?array
{
    $query = db()->prepare(
        'SELECT id, customer_id, assigned_employee_id, service_type, status
         FROM service_requests
         WHERE id = ?'
    );
    $query->execute([$id]);

    $request = $query->fetch();

    return $request ?: null;
}

function portal_can_view_activity(array $user, array $request): bool
{
    if ($user['account_type'] === 'admin') {
        return true;
    }

    return $user['account_type'] === 'employee'
        && (
            user_has_permission($user, 'Field jobs')
            || user_has_permission($user, 'Manage schedules')
        )
        && (
            $request['assigned_employee_id'] === null
            || (int) $request['assigned_employee_id'] === (int) $user['id']
            || user_has_permission($user, 'Manage schedules')
        );
}

try {
    if ($action === 'profile') {
        require_method('GET');
        json_out(['ok' => true, 'user' => $user]);
    }

    if ($action === 'update-profile') {
        require_method('POST');
        $data = json_body();
        $firstName = clean_text($data['first_name'] ?? '', 80);
        $middleName = clean_text($data['middle_name'] ?? '', 80);
        $lastName = clean_text($data['last_name'] ?? '', 80);
        $username = strtolower(trim((string) ($data['username'] ?? '')));
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $phone = trim((string) ($data['phone'] ?? ''));
        $gender = (string) ($data['gender'] ?? '');
        $birthdate = trim((string) ($data['birthdate'] ?? ''));
        $address = clean_text($data['address'] ?? '', 255);

        if (
            $firstName === '' ||
            $lastName === '' ||
            !preg_match('/^[a-z0-9._-]{3,60}$/', $username) ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) ||
            !preg_match('/^[0-9]{10,15}$/', $phone) ||
            !in_array($gender, ['female', 'male', 'other', 'prefer-not-to-say'], true) ||
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthdate) ||
            !checkdate((int) substr($birthdate, 5, 2), (int) substr($birthdate, 8, 2), (int) substr($birthdate, 0, 4)) ||
            strtotime($birthdate) >= strtotime('today') ||
            $address === ''
        ) {
            json_out(['ok' => false, 'message' => 'Complete your profile with valid details.'], 422);
        }

        $query = db()->prepare(
            'SELECT id FROM users WHERE (email = ? OR username = ?) AND id <> ?'
        );
        $query->execute([$email, $username, $user['id']]);
        if ($query->fetch()) {
            json_out(['ok' => false, 'message' => 'Email or username is already in use.'], 409);
        }

        $fullName = clean_text(trim($firstName . ' ' . $middleName . ' ' . $lastName), 120);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $query = $pdo->prepare(
                'UPDATE users
                 SET full_name = ?, username = ?, email = ?, phone = ?, gender = ?
                 WHERE id = ?'
            );
            $query->execute([$fullName, $username, $email, $phone, $gender, $user['id']]);
            if ($user['account_type'] === 'customer') {
                $query = $pdo->prepare(
                    'UPDATE customers
                     SET first_name = ?, middle_name = ?, last_name = ?, birthdate = ?, address = ?
                     WHERE user_id = ?'
                );
            } else {
                $query = $pdo->prepare(
                    'UPDATE employees
                     SET first_name = ?, middle_name = ?, last_name = ?, birthdate = ?, address = ?
                     WHERE user_id = ?'
                );
            }
            $query->execute([
                $firstName,
                $middleName !== '' ? $middleName : null,
                $lastName,
                $birthdate,
                $address,
                $user['id']
            ]);
            $query = $pdo->prepare(
                'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([$user['id'], 'profile_updated', 'user', $user['id']]);
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
        json_out(['ok' => true, 'message' => 'Profile updated.']);
    }

    if ($action === 'payments') {
        require_method('GET');
        $isAccounting = $user['account_type'] === 'admin'
            || user_has_permission($user, 'Manage payments');
        if ($user['account_type'] !== 'customer' && !$isAccounting) {
            json_out(['ok' => false, 'message' => 'Payment access is not available for your role.'], 403);
        }
        if ($isAccounting) {
            $query = db()->query(
                'SELECT p.*, u.full_name AS customer_name, r.service_type
                 FROM payments p
                 JOIN users u ON u.id = p.customer_id
                 JOIN service_requests r ON r.id = p.booking_id
                 ORDER BY p.created_at DESC'
            );
        } else {
            $query = db()->prepare(
                'SELECT p.*, r.service_type
                 FROM payments p
                 JOIN service_requests r ON r.id = p.booking_id
                 WHERE p.customer_id = ?
                 ORDER BY p.created_at DESC'
            );
            $query->execute([$user['id']]);
        }
        json_out(['ok' => true, 'payments' => $query->fetchAll()]);
    }

    if ($action === 'record-payment') {
        require_method('POST');
        if (
            $user['account_type'] !== 'admin' &&
            !user_has_permission($user, 'Manage payments')
        ) {
            json_out(['ok' => false, 'message' => 'Accounting or administrator access required.'], 403);
        }
        $data = json_body();
        $bookingId = filter_var($data['booking_id'] ?? null, FILTER_VALIDATE_INT);
        $amount = $data['amount'] ?? null;
        $amountString = is_scalar($amount) ? trim((string) $amount) : '';
        $status = (string) ($data['status'] ?? 'pending');
        $method = clean_text($data['payment_method'] ?? '', 80);
        $reference = clean_text($data['reference_number'] ?? '', 100);
        if (
            !$bookingId ||
            !preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D', $amountString) ||
            (float) $amount <= 0 ||
            !in_array($status, ['pending', 'paid', 'refunded', 'void'], true)
        ) {
            json_out(['ok' => false, 'message' => 'Enter a valid booking, amount and payment status.'], 422);
        }
        $query = db()->prepare('SELECT customer_id FROM service_requests WHERE id = ?');
        $query->execute([$bookingId]);
        $customerId = $query->fetchColumn();
        if (!$customerId) {
            json_out(['ok' => false, 'message' => 'Booking not found.'], 404);
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $query = $pdo->prepare(
                'INSERT INTO payments
                    (booking_id, customer_id, amount, status, payment_method,
                     reference_number, recorded_by, paid_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $query->execute([
                $bookingId,
                $customerId,
                $amountString,
                $status,
                $method !== '' ? $method : null,
                $reference !== '' ? $reference : null,
                $user['id'],
                $status === 'paid' ? date('Y-m-d H:i:s') : null
            ]);
            $paymentId = (int) $pdo->lastInsertId();
            $receiptNumber = 'SSS-' . str_pad((string) $paymentId, 6, '0', STR_PAD_LEFT);

            $query = $pdo->prepare(
                'INSERT INTO user_notifications (user_id, booking_id, title, message)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([
                $customerId,
                $bookingId,
                'Payment record updated',
                'A ' . $status . ' payment record was added for your booking. Receipt ' . $receiptNumber . '.'
            ]);
            $query = $pdo->prepare(
                'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([$user['id'], 'payment_recorded', 'payment', $paymentId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
        json_out([
            'ok' => true,
            'message' => 'Payment record created. This records an offline/manual payment and does not charge a card.',
            'receipt_number' => $receiptNumber
        ], 201);
    }

    if ($action === 'tickets') {
        require_method('GET');
        $canManage = $user['account_type'] === 'admin'
            || user_has_permission($user, 'Manage support');
        if ($canManage) {
            $query = db()->query(
                'SELECT t.*, u.full_name AS customer_name
                 FROM support_tickets t
                 JOIN users u ON u.id = t.customer_id
                 ORDER BY t.created_at DESC'
            );
        } elseif ($user['account_type'] === 'customer') {
            $query = db()->prepare(
                'SELECT * FROM support_tickets WHERE customer_id = ? ORDER BY created_at DESC'
            );
            $query->execute([$user['id']]);
        } else {
            json_out(['ok' => false, 'message' => 'Support ticket access is not available for your role.'], 403);
        }
        json_out(['ok' => true, 'tickets' => $query->fetchAll()]);
    }

    if ($action === 'create-ticket') {
        require_method('POST');
        if ($user['account_type'] !== 'customer') {
            json_out(['ok' => false, 'message' => 'Only customers can open support tickets.'], 403);
        }
        $data = json_body();
        $subject = clean_text($data['subject'] ?? '', 160);
        $message = clean_text($data['message'] ?? '', 4000);
        $bookingId = filter_var($data['booking_id'] ?? null, FILTER_VALIDATE_INT);
        if ($subject === '' || $message === '') {
            json_out(['ok' => false, 'message' => 'Enter a subject and message.'], 422);
        }
        if ($bookingId) {
            $query = db()->prepare('SELECT id FROM service_requests WHERE id = ? AND customer_id = ?');
            $query->execute([$bookingId, $user['id']]);
            if (!$query->fetch()) {
                json_out(['ok' => false, 'message' => 'Choose one of your own bookings.'], 422);
            }
        }
        $query = db()->prepare(
            'INSERT INTO support_tickets (customer_id, booking_id, subject, message)
             VALUES (?, ?, ?, ?)'
        );
        $query->execute([$user['id'], $bookingId ?: null, $subject, $message]);
        $ticketId = (int) db()->lastInsertId();
        $query = db()->prepare(
            'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
             VALUES (?, ?, ?, ?)'
        );
        $query->execute([$user['id'], 'support_ticket_created', 'support_ticket', $ticketId]);
        json_out(['ok' => true, 'message' => 'Support ticket submitted.'], 201);
    }

    if ($action === 'update-ticket') {
        require_method('POST');
        if (
            $user['account_type'] !== 'admin' &&
            !user_has_permission($user, 'Manage support')
        ) {
            json_out(['ok' => false, 'message' => 'Customer Service or administrator access required.'], 403);
        }
        $data = json_body();
        $id = filter_var($data['ticket_id'] ?? null, FILTER_VALIDATE_INT);
        $status = (string) ($data['status'] ?? '');
        if (!$id || !in_array($status, ['open', 'in_progress', 'resolved', 'closed'], true)) {
            json_out(['ok' => false, 'message' => 'Choose a valid ticket status.'], 422);
        }
        $query = db()->prepare('UPDATE support_tickets SET status = ? WHERE id = ?');
        $query->execute([$status, $id]);
        if (!$query->rowCount()) {
            json_out(['ok' => false, 'message' => 'Ticket not found or status unchanged.'], 404);
        }
        $query = db()->prepare(
            'SELECT customer_id, subject FROM support_tickets WHERE id = ?'
        );
        $query->execute([$id]);
        $ticket = $query->fetch();
        $query = db()->prepare(
            'INSERT INTO user_notifications (user_id, title, message)
             VALUES (?, ?, ?)'
        );
        $query->execute([
            $ticket['customer_id'],
            'Support request updated',
            'Your support request "' . $ticket['subject'] . '" is now ' . str_replace('_', ' ', $status) . '.'
        ]);
        json_out(['ok' => true, 'message' => 'Support ticket updated.']);
    }

    if ($action === 'create-announcement') {
        require_method('POST');
        if (
            $user['account_type'] !== 'admin' &&
            !user_has_permission($user, 'Manage announcements')
        ) {
            json_out(['ok' => false, 'message' => 'HR or administrator access required.'], 403);
        }
        $data = json_body();
        $title = clean_text($data['title'] ?? '', 160);
        $message = clean_text($data['message'] ?? '', 4000);
        $audience = (string) ($data['audience'] ?? 'employees');
        if ($title === '' || $message === '' || !in_array($audience, ['employees', 'technicians', 'all'], true)) {
            json_out(['ok' => false, 'message' => 'Complete the announcement details.'], 422);
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $query = $pdo->prepare(
                'INSERT INTO announcements (title, message, audience, created_by)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([$title, $message, $audience, $user['id']]);
            $notificationAudience = $audience === 'all' ? 'all' : $audience;
            $query = $pdo->prepare(
                "INSERT INTO portal_notifications
                    (title, message, audience, channel, status, created_by)
                 VALUES (?, ?, ?, 'portal', 'sent', ?)"
            );
            $query->execute([$title, $message, $notificationAudience, $user['id']]);
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
        json_out(['ok' => true, 'message' => 'Employee announcement published.'], 201);
    }

    if ($action === 'catalog') {
        require_method('GET');

        $query = db()->query(
            'SELECT service_type, price_label
             FROM service_catalog
             WHERE booking_enabled = 1
             ORDER BY sort_order, service_type'
        );

        json_out([
            'ok' => true,
            'services' => $query->fetchAll()
        ]);
    }

    if ($action === 'activity') {
        require_method('GET');

        $id = filter_var($_GET['request_id'] ?? null, FILTER_VALIDATE_INT);
        $request = $id ? portal_request((int) $id) : null;

        if (!$request) {
            json_out([
                'ok' => false,
                'message' => 'Service request not found.'
            ], 404);
        }

        if (!portal_can_view_activity($user, $request)) {
            json_out([
                'ok' => false,
                'message' => 'You cannot view this job activity.'
            ], 403);
        }

        $query = db()->prepare(
            'SELECT a.id, a.activity_type, a.note, a.latitude, a.longitude, a.created_at,
                    u.full_name AS employee_name
             FROM work_activity a
             JOIN users u ON u.id = a.employee_id
             WHERE a.request_id = ?
             ORDER BY a.created_at DESC'
        );
        $query->execute([$id]);

        json_out([
            'ok' => true,
            'activity' => $query->fetchAll()
        ]);
    }

    if ($action === 'work-event') {
        require_method('POST');

        if (
            $user['account_type'] !== 'employee' ||
            !user_has_permission($user, 'Submit service reports')
        ) {
            json_out([
                'ok' => false,
                'message' => 'Only assigned technicians can record job activity.'
            ], 403);
        }

        $data = json_body();
        $id = filter_var($data['request_id'] ?? null, FILTER_VALIDATE_INT);
        $type = (string) ($data['activity_type'] ?? '');
        $note = clean_text($data['note'] ?? '', 4000);
        $latitude = $data['latitude'] ?? null;
        $longitude = $data['longitude'] ?? null;
        $reportType = (string) ($data['report_type'] ?? 'equipment_problem');

        if (!$id || !in_array($type, ['check_in', 'check_out', 'issue'], true)) {
            json_out([
                'ok' => false,
                'message' => 'Choose a valid job activity.'
            ], 422);
        }

        if ($type === 'issue' && $note === '') {
            json_out([
                'ok' => false,
                'message' => 'Describe the issue before submitting the report.'
            ], 422);
        }

        if (
            $type === 'issue' &&
            !in_array($reportType, ['service', 'equipment_problem', 'site_issue'], true)
        ) {
            json_out(['ok' => false, 'message' => 'Choose a valid issue type.'], 422);
        }

        if ($type === 'check_in' && ($latitude === null || $longitude === null)) {
            json_out([
                'ok' => false,
                'message' => 'Location is required for site check-in. Allow location access and try again.'
            ], 422);
        }

        if (
            ($latitude !== null && (!is_numeric($latitude) || (float) $latitude < -90 || (float) $latitude > 90)) ||
            ($longitude !== null && (!is_numeric($longitude) || (float) $longitude < -180 || (float) $longitude > 180)) ||
            (($latitude === null) !== ($longitude === null))
        ) {
            json_out(['ok' => false, 'message' => 'Location coordinates are invalid.'], 422);
        }

        $request = portal_request((int) $id);

        if (!$request) {
            json_out([
                'ok' => false,
                'message' => 'Service request not found.'
            ], 404);
        }

        if ((int) $request['assigned_employee_id'] !== (int) $user['id']) {
            json_out([
                'ok' => false,
                'message' => 'This job is not assigned to your account.'
            ], 403);
        }

        if (in_array($request['status'], ['completed', 'cancelled'], true)) {
            json_out([
                'ok' => false,
                'message' => 'Completed or cancelled jobs cannot be updated.'
            ], 409);
        }

        $lastActivityQuery = db()->prepare(
            'SELECT activity_type
             FROM work_activity
             WHERE request_id = ?
               AND employee_id = ?
               AND activity_type IN (\'check_in\', \'check_out\')
             ORDER BY created_at DESC, id DESC
             LIMIT 1'
        );
        $lastActivityQuery->execute([$id, $user['id']]);
        $lastActivity = $lastActivityQuery->fetchColumn();

        if ($type === 'check_in' && $lastActivity === 'check_in') {
            json_out([
                'ok' => false,
                'message' => 'You are already checked in to this job.'
            ], 409);
        }

        if ($type === 'check_out' && $lastActivity !== 'check_in') {
            json_out([
                'ok' => false,
                'message' => 'Check in to this job before checking out.'
            ], 409);
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $query = $pdo->prepare(
                'INSERT INTO work_activity
                    (request_id, employee_id, activity_type, note, latitude, longitude)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $query->execute([
                $id,
                $user['id'],
                $type,
                $note !== '' ? $note : null,
                $latitude,
                $longitude
            ]);

            if (in_array($type, ['check_in', 'check_out'], true)) {
                $query = $pdo->prepare(
                    'INSERT INTO attendance_logs
                        (booking_id, employee_id, event_type, latitude, longitude)
                     VALUES (?, ?, ?, ?, ?)'
                );
                $query->execute([$id, $user['id'], $type, $latitude, $longitude]);
            }

            if ($type === 'issue') {
                $query = $pdo->prepare(
                    'INSERT INTO service_reports
                        (booking_id, employee_id, report_type, report)
                     VALUES (?, ?, ?, ?)'
                );
                $query->execute([$id, $user['id'], $reportType, $note]);
                $query = $pdo->prepare(
                    "UPDATE service_requests
                     SET worker_notes = CONCAT_WS(
                        '\\n',
                        NULLIF(worker_notes, ''),
                        CONCAT('Issue report: ', ?)
                     )
                     WHERE id = ?"
                );
                $query->execute([$note, $id]);
            }

            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        json_out([
            'ok' => true,
            'message' => match ($type) {
                'check_in' => 'Check-in recorded.',
                'check_out' => 'Check-out recorded.',
                default => 'Issue report submitted.'
            }
        ], 201);
    }

    if ($action === 'schedule') {
        require_method('POST');

        $canDispatch = $user['account_type'] === 'admin'
            || user_has_permission($user, 'Manage schedules');
        if (!$canDispatch) {
            json_out([
                'ok' => false,
                'message' => 'Dispatch or administrator access required.'
            ], 403);
        }

        $data = json_body();
        $id = filter_var($data['request_id'] ?? null, FILTER_VALIDATE_INT);
        $decision = (string) ($data['decision'] ?? 'schedule');
        $request = $id ? portal_request((int) $id) : null;

        if (!$request) {
            json_out([
                'ok' => false,
                'message' => 'Service request not found.'
            ], 404);
        }

        if (!in_array($decision, ['schedule', 'decline'], true)) {
            json_out([
                'ok' => false,
                'message' => 'Choose an approve or decline action.'
            ], 422);
        }

        if (in_array($request['status'], ['completed', 'cancelled'], true)) {
            json_out([
                'ok' => false,
                'message' => 'Completed or cancelled requests cannot be rescheduled.'
            ], 409);
        }

        if ($decision === 'decline') {
            $query = db()->prepare(
                "UPDATE service_requests
                 SET status = 'cancelled'
                 WHERE id = ?"
            );
            $query->execute([$id]);

            json_out([
                'ok' => true,
                'message' => 'Service request declined.'
            ]);
        }

        $workerId = filter_var($data['worker_id'] ?? null, FILTER_VALIDATE_INT);
        $date = trim((string) ($data['scheduled_date'] ?? ''));
        $start = trim((string) ($data['start_time'] ?? ''));
        $end = trim((string) ($data['end_time'] ?? ''));

        if (
            !$workerId ||
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ||
            !checkdate(
                (int) substr($date, 5, 2),
                (int) substr($date, 8, 2),
                (int) substr($date, 0, 4)
            ) ||
            !preg_match('/^\d{2}:\d{2}$/', $start) ||
            !preg_match('/^\d{2}:\d{2}$/', $end)
        ) {
            json_out([
                'ok' => false,
                'message' => 'Choose an approved technician, a valid date and valid times.'
            ], 422);
        }

        if ($start !== '' && $end !== '' && $end <= $start) {
            json_out([
                'ok' => false,
                'message' => 'End time must be later than start time.'
            ], 422);
        }

        $startTimestamp = strtotime($date . ' ' . $start);
        $endTimestamp = strtotime($date . ' ' . $end);
        if ($startTimestamp === false || $endTimestamp === false) {
            json_out([
                'ok' => false,
                'message' => 'Enter a valid service date and time range.'
            ], 422);
        }

        $settingsRows = db()->query(
            'SELECT setting_key, setting_value FROM service_settings'
        )->fetchAll();
        $settings = array_column($settingsRows, 'setting_value', 'setting_key');
        $requiredSettings = [
            'working_days',
            'opening_time',
            'closing_time',
            'minimum_booking_notice',
            'technician_capacity'
        ];

        foreach ($requiredSettings as $settingKey) {
            if (!isset($settings[$settingKey])) {
                json_out([
                    'ok' => false,
                    'message' => 'Booking settings are incomplete. Review Service settings before scheduling.'
                ], 503);
            }
        }

        $weekDay = (int) date('N', strtotime($date));
        $validDay = match ($settings['working_days']) {
            'Monday-Friday' => $weekDay <= 5,
            'Monday-Saturday' => $weekDay <= 6,
            'Daily' => true,
            default => false
        };
        $noticeHours = preg_match(
            '/^(\d{1,3}) hours$/',
            $settings['minimum_booking_notice'],
            $noticeMatch
        ) ? (int) $noticeMatch[1] : null;
        $capacity = preg_match(
            '/^(\d+) active jobs? per time slot$/',
            $settings['technician_capacity'],
            $capacityMatch
        ) ? (int) $capacityMatch[1] : null;

        if (
            !$validDay ||
            !preg_match('/^\d{2}:\d{2}$/', $settings['opening_time']) ||
            !preg_match('/^\d{2}:\d{2}$/', $settings['closing_time']) ||
            $noticeHours === null ||
            $capacity === null ||
            $capacity < 1
        ) {
            json_out([
                'ok' => false,
                'message' => 'Booking settings contain invalid hours or working days.'
            ], 503);
        }

        if (
            $start < $settings['opening_time'] ||
            $end > $settings['closing_time']
        ) {
            json_out([
                'ok' => false,
                'message' => 'Choose a time within the configured service hours.'
            ], 422);
        }

        if ($startTimestamp < time() + ($noticeHours * 3600)) {
            json_out([
                'ok' => false,
                'message' => 'Choose a date and time that meets the minimum booking notice.'
            ], 422);
        }

        $query = db()->prepare(
            "SELECT COUNT(*)
             FROM request_schedule s
             JOIN service_requests r ON r.id = s.request_id
             WHERE s.request_id <> ?
               AND s.scheduled_date = ?
               AND r.assigned_employee_id = ?
               AND r.status IN ('scheduled', 'in_progress')
               AND s.start_time < ?
               AND s.end_time > ?"
        );
        $query->execute([
            $id,
            $date,
            $workerId,
            $end . ':00',
            $start . ':00'
        ]);

        if ((int) $query->fetchColumn() >= $capacity) {
            json_out([
                'ok' => false,
                'message' => 'This worker is at capacity during that time. Choose another slot or technician.'
            ], 409);
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

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $query = $pdo->prepare(
                "UPDATE service_requests
                 SET assigned_employee_id = ?,
                     preferred_date = ?,
                     status = 'scheduled'
                 WHERE id = ?"
            );
            $query->execute([$workerId, $date, $id]);

            $query = $pdo->prepare(
                'INSERT INTO request_schedule
                    (request_id, scheduled_date, start_time, end_time, assigned_by)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    scheduled_date = VALUES(scheduled_date),
                    start_time = VALUES(start_time),
                    end_time = VALUES(end_time),
                    assigned_by = VALUES(assigned_by)'
            );
            $query->execute([
                $id,
                $date,
                $start !== '' ? $start . ':00' : null,
                $end !== '' ? $end . ':00' : null,
                $user['id']
            ]);

            $query = $pdo->prepare(
                "UPDATE technician_assignments
                 SET status = 'cancelled'
                 WHERE booking_id = ? AND status = 'assigned'"
            );
            $query->execute([$id]);
            $query = $pdo->prepare(
                'INSERT INTO technician_assignments (booking_id, technician_id, assigned_by)
                 VALUES (?, ?, ?)'
            );
            $query->execute([$id, $workerId, $user['id']]);
            $query = $pdo->prepare(
                'INSERT INTO user_notifications (user_id, booking_id, title, message)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([
                $request['customer_id'],
                $id,
                'Service visit scheduled',
                'Your ' . $request['service_type'] . ' visit is scheduled for ' . $date . ' at ' . $start . '.'
            ]);
            $query = $pdo->prepare(
                'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([$user['id'], 'booking_scheduled', 'booking', $id]);

            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        json_out([
            'ok' => true,
            'message' => 'Request approved and assignment saved.'
        ]);
    }

    if ($action === 'change-password') {
        require_method('POST');

        $data = json_body();
        $currentPassword = (string) ($data['current_password'] ?? '');
        $newPassword = (string) ($data['new_password'] ?? '');

        $query = db()->prepare(
            'SELECT password_hash FROM users WHERE id = ?'
        );
        $query->execute([$user['id']]);
        $account = $query->fetch();

        if (
            !$account ||
            !password_verify($currentPassword, $account['password_hash'])
        ) {
            json_out([
                'ok' => false,
                'message' => 'Current password is incorrect.'
            ], 422);
        }

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
            $user['id']
        ]);

        json_out([
            'ok' => true,
            'message' => 'Password changed.'
        ]);
    }

    if ($action === 'reports') {
        require_method('GET');

        $canViewReports = $user['account_type'] === 'admin'
            || user_has_permission($user, 'View reports');
        if (!$canViewReports) {
            json_out([
                'ok' => false,
                'message' => 'Dispatch, Accounting or administrator access required.'
            ], 403);
        }

        $counts = db()->query(
            "SELECT
                COUNT(*) AS total,
                SUM(status = 'submitted') AS submitted,
                SUM(status = 'scheduled') AS scheduled,
                SUM(status = 'in_progress') AS in_progress,
                SUM(status = 'completed') AS completed
             FROM service_requests"
        )->fetch();

        $users = db()->query(
            "SELECT
                SUM(account_type = 'customer') AS customers,
                SUM(account_type = 'employee' AND status = 'approved') AS employees,
                SUM(account_type = 'employee' AND status = 'pending') AS pending
             FROM users"
        )->fetch();

        $services = db()->query(
            'SELECT service_type, COUNT(*) AS total
             FROM service_requests
             GROUP BY service_type
             ORDER BY total DESC, service_type'
        )->fetchAll();
        $payments = db()->query(
            "SELECT COUNT(*) AS records,
                    COALESCE(SUM(status = 'paid'), 0) AS paid_records,
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_total
             FROM payments"
        )->fetch();
        $operations = db()->query(
            "SELECT
                (SELECT COUNT(*) FROM attendance_logs WHERE event_type = 'check_in') AS check_ins,
                (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')) AS open_tickets,
                (SELECT COUNT(*) FROM service_reports) AS service_reports"
        )->fetch();

        json_out([
            'ok' => true,
            'requests' => $counts,
            'users' => $users,
            'services' => $services,
            'payments' => $payments,
            'operations' => $operations
        ]);
    }

    if ($action === 'notifications') {
        require_method('GET');

        if ($user['account_type'] === 'admin') {
            $query = db()->query(
                'SELECT n.*, u.full_name AS author
                 FROM portal_notifications n
                 JOIN users u ON u.id = n.created_by
                 ORDER BY COALESCE(n.scheduled_at, n.created_at) DESC'
            );
            $notifications = $query->fetchAll();
        } else {
            $audience = $user['account_type'] === 'customer'
                ? 'customers'
                : (
                    user_has_role($user, 'technician')
                        ? 'technicians'
                        : 'employees'
                );

            $query = db()->prepare(
                "SELECT n.id, n.title, n.message, n.audience, n.scheduled_at,
                        n.status, n.created_at, u.full_name AS author
                 FROM portal_notifications n
                 JOIN users u ON u.id = n.created_by
                 WHERE (
                    n.status = 'sent'
                    OR (n.status = 'scheduled' AND n.scheduled_at <= NOW())
                   )
                   AND n.audience IN (?, 'all')
                 ORDER BY n.created_at DESC"
            );
            $query->execute([$audience]);
            $notifications = $query->fetchAll();
        }

        $query = db()->prepare(
            "SELECT id, title, message, created_at, read_at, 1 AS personal
             FROM user_notifications
             WHERE user_id = ?
             ORDER BY created_at DESC"
        );
        $query->execute([$user['id']]);
        $notifications = array_merge($query->fetchAll(), $notifications);
        usort($notifications, static fn (array $left, array $right): int =>
            strcmp((string) $right['created_at'], (string) $left['created_at'])
        );

        json_out([
            'ok' => true,
            'notifications' => $notifications
        ]);
    }

    if ($action === 'mark-notification-read') {
        require_method('POST');
        $data = json_body();
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            json_out(['ok' => false, 'message' => 'Choose a valid notification.'], 422);
        }
        $query = db()->prepare(
            'UPDATE user_notifications SET read_at = NOW()
             WHERE id = ? AND user_id = ? AND read_at IS NULL'
        );
        $query->execute([$id, $user['id']]);
        json_out(['ok' => true, 'message' => 'Notification marked as read.']);
    }
    if ($action === 'create-notification') {
        require_method('POST');

        if ($user['account_type'] !== 'admin') {
            json_out([
                'ok' => false,
                'message' => 'Administrator access required.'
            ], 403);
        }

        $data = json_body();
        $title = clean_text($data['title'] ?? '', 160);
        $message = clean_text($data['message'] ?? '', 4000);
        $audience = (string) ($data['audience'] ?? '');
        $channel = (string) ($data['channel'] ?? 'portal');
        $scheduledAt = trim((string) ($data['scheduled_at'] ?? ''));

        if (
            $title === '' ||
            $message === '' ||
            !in_array($audience, ['customers', 'employees', 'technicians', 'all'], true) ||
            !in_array($channel, ['portal', 'email_sms'], true)
        ) {
            json_out([
                'ok' => false,
                'message' => 'Complete the notification fields with valid options.'
            ], 422);
        }

        if ($channel !== 'portal') {
            json_out([
                'ok' => false,
                'message' => 'Email and SMS delivery is not configured. Choose Portal inbox.'
            ], 422);
        }

        if (
            $scheduledAt !== '' &&
            (
                !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $scheduledAt) ||
                strtotime($scheduledAt) === false
            )
        ) {
            json_out([
                'ok' => false,
                'message' => 'Enter a valid notification schedule.'
            ], 422);
        }

        $status = $scheduledAt !== '' &&
            strtotime($scheduledAt) > time()
                ? 'scheduled'
                : 'sent';

        $query = db()->prepare(
            'INSERT INTO portal_notifications
                (title, message, audience, channel, scheduled_at, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $query->execute([
            $title,
            $message,
            $audience,
            $channel,
            $scheduledAt !== ''
                ? str_replace('T', ' ', $scheduledAt) . ':00'
                : null,
            $status,
            $user['id']
        ]);

        json_out([
            'ok' => true,
            'message' => $status === 'scheduled'
                ? 'Notification scheduled.'
                : 'Portal notification published.'
        ], 201);
    }

    if ($action === 'settings') {
        require_method('GET');

        if ($user['account_type'] !== 'admin') {
            json_out([
                'ok' => false,
                'message' => 'Administrator access required.'
            ], 403);
        }

        $settings = db()->query(
            'SELECT setting_key, setting_value
             FROM service_settings
             ORDER BY setting_key'
        )->fetchAll();

        $services = db()->query(
            'SELECT service_type, price_label, booking_enabled
             FROM service_catalog
             ORDER BY sort_order, service_type'
        )->fetchAll();

        json_out([
            'ok' => true,
            'settings' => $settings,
            'services' => $services
        ]);
    }

    if ($action === 'save-settings') {
        require_method('POST');

        if ($user['account_type'] !== 'admin') {
            json_out([
                'ok' => false,
                'message' => 'Administrator access required.'
            ], 403);
        }

        $data = json_body();
        $allowedSettings = [
            'working_days',
            'opening_time',
            'closing_time',
            'minimum_booking_notice',
            'consultation_slot_minutes',
            'technician_capacity'
        ];
        $settings = $data['settings'] ?? null;
        $services = $data['services'] ?? null;

        if (!is_array($settings) || !is_array($services)) {
            json_out([
                'ok' => false,
                'message' => 'Invalid service settings.'
            ], 422);
        }

        $normalizedSettings = [];
        foreach ($settings as $key => $value) {
            if (
                !in_array($key, $allowedSettings, true) ||
                (!is_string($value) && !is_numeric($value))
            ) {
                json_out([
                    'ok' => false,
                    'message' => 'A service setting is invalid.'
                ], 422);
            }

            $normalizedSettings[$key] = trim((string) $value);
        }

        $validWorkingDays = ['Monday-Friday', 'Monday-Saturday', 'Daily'];
        $validNoticePeriods = ['0 hours', '24 hours', '48 hours', '72 hours'];
        $validCapacities = [
            '1 active job per time slot',
            '2 active jobs per time slot',
            '3 active jobs per time slot'
        ];

        if (
            !in_array($normalizedSettings['working_days'] ?? '', $validWorkingDays, true) ||
            !in_array($normalizedSettings['minimum_booking_notice'] ?? '', $validNoticePeriods, true) ||
            !in_array($normalizedSettings['technician_capacity'] ?? '', $validCapacities, true) ||
            !preg_match('/^\d{2}:\d{2}$/', $normalizedSettings['opening_time'] ?? '') ||
            !preg_match('/^\d{2}:\d{2}$/', $normalizedSettings['closing_time'] ?? '') ||
            ($normalizedSettings['opening_time'] ?? '') >= ($normalizedSettings['closing_time'] ?? '') ||
            !preg_match('/^(?:30|45|60|75|90|105|120|135|150|165|180|195|210|225|240)$/', $normalizedSettings['consultation_slot_minutes'] ?? '')
        ) {
            json_out([
                'ok' => false,
                'message' => 'Choose valid working days, hours, booking notice, slot duration and technician capacity.'
            ], 422);
        }

        $catalogTypes = db()->query(
            'SELECT service_type FROM service_catalog'
        )->fetchAll(PDO::FETCH_COLUMN);
        $normalizedServices = [];

        foreach ($services as $service) {
            if (!is_array($service)) {
                json_out([
                    'ok' => false,
                    'message' => 'Invalid service catalog item.'
                ], 422);
            }

            $type = clean_text($service['service_type'] ?? '', 80);
            $price = clean_text($service['price_label'] ?? '', 120);
            $enabledValue = $service['booking_enabled'] ?? null;

            if (
                !in_array($type, $catalogTypes, true) ||
                $price === '' ||
                !in_array($enabledValue, [true, false, 0, 1, '0', '1'], true)
            ) {
                json_out([
                    'ok' => false,
                    'message' => 'Service names, price labels and booking states must be valid.'
                ], 422);
            }

            $normalizedServices[] = [
                'service_type' => $type,
                'price_label' => $price,
                'booking_enabled' => filter_var(
                    $enabledValue,
                    FILTER_VALIDATE_BOOLEAN
                )
            ];
        }

        $pdo = db();
        $pdo->beginTransaction();

        foreach ($normalizedSettings as $key => $value) {
            $query = $pdo->prepare(
                'INSERT INTO service_settings (setting_key, setting_value)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
            );
            $query->execute([$key, $value]);
        }

        foreach ($normalizedServices as $service) {
            $query = $pdo->prepare(
                'UPDATE service_catalog
                 SET price_label = ?, booking_enabled = ?
                 WHERE service_type = ?'
            );
            $query->execute([
                $service['price_label'],
                $service['booking_enabled'] ? 1 : 0,
                $service['service_type']
            ]);
        }

        $pdo->commit();

        json_out([
            'ok' => true,
            'message' => 'Service settings saved.'
        ]);
    }

    json_out([
        'ok' => false,
        'message' => 'Unknown portal action.'
    ], 404);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log((string) $error);

    json_out([
        'ok' => false,
        'message' => 'Portal request failed. Check the database configuration.'
    ], 500);
}
