
CREATE DATABASE IF NOT EXISTS sunsonsolar
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sunsonsolar;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    gender VARCHAR(40) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    account_type ENUM(
        'customer',
        'employee',
        'admin'
    ) NOT NULL DEFAULT 'customer',

    department ENUM(
        'Administration',
        'IT',
        'Dispatch',
        'Accounting',
        'HR',
        'Marketing',
        'Sales',
        'Customer Service',
        'Technician'
    ) DEFAULT NULL,

    status ENUM(
        'pending',
        'approved',
        'rejected',
        'active'
    ) NOT NULL DEFAULT 'approved',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    customer_id INT UNSIGNED NOT NULL,
    assigned_employee_id INT UNSIGNED DEFAULT NULL,

    service_type VARCHAR(80) NOT NULL,
    address VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    preferred_date DATE DEFAULT NULL,

    status ENUM(
        'submitted',
        'scheduled',
        'in_progress',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'submitted',

    worker_notes TEXT DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_request_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(id),

    CONSTRAINT fk_request_worker
        FOREIGN KEY (assigned_employee_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS request_schedule (
    request_id INT UNSIGNED PRIMARY KEY,
    scheduled_date DATE DEFAULT NULL,
    start_time TIME DEFAULT NULL,
    end_time TIME DEFAULT NULL,
    assigned_by INT UNSIGNED DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_schedule_request
        FOREIGN KEY (request_id)
        REFERENCES service_requests(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_schedule_admin
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_activity (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id INT UNSIGNED NOT NULL,
    employee_id INT UNSIGNED NOT NULL,
    activity_type ENUM('check_in', 'check_out', 'issue') NOT NULL,
    note TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_activity_request
        FOREIGN KEY (request_id)
        REFERENCES service_requests(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_activity_employee
        FOREIGN KEY (employee_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_activity_request_created (request_id, created_at)
);

CREATE TABLE IF NOT EXISTS portal_notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    audience ENUM('customers', 'employees', 'technicians', 'all') NOT NULL,
    channel ENUM('portal', 'email_sms') NOT NULL DEFAULT 'portal',
    scheduled_at DATETIME DEFAULT NULL,
    status ENUM('draft', 'scheduled', 'sent') NOT NULL DEFAULT 'draft',
    created_by INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_notification_audience_schedule (audience, scheduled_at)
);

CREATE TABLE IF NOT EXISTS user_notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    booking_id INT UNSIGNED DEFAULT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME DEFAULT NULL,
    CONSTRAINT fk_user_notification_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_notification_booking
        FOREIGN KEY (booking_id) REFERENCES service_requests(id) ON DELETE SET NULL,
    INDEX idx_user_notification_inbox (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS service_catalog (
    service_type VARCHAR(80) PRIMARY KEY,
    price_label VARCHAR(120) NOT NULL DEFAULT 'Quotation required',
    booking_enabled TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0
);

INSERT IGNORE INTO service_catalog
    (service_type, price_label, booking_enabled, sort_order)
VALUES
    ('Consultation', 'Quotation required / visit', 1, 1),
    ('Designing', 'Quotation required / project', 1, 2),
    ('Permitting', 'Quotation required / project', 1, 3),
    ('Solar installation', 'Quotation required / project', 1, 4),
    ('Maintenance', 'PHP 2,500 / visit · sample', 1, 5),
    ('Repair', 'From PHP 1,500 / visit · sample', 1, 6),
    ('System inspection', 'Quotation required / visit', 1, 7),
    ('Monitoring', 'Quotation required / month', 1, 8);

CREATE TABLE IF NOT EXISTS service_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL
);

INSERT IGNORE INTO service_settings (setting_key, setting_value)
VALUES
    ('working_days', 'Monday-Friday'),
    ('opening_time', '08:00'),
    ('closing_time', '17:00'),
    ('minimum_booking_notice', '24 hours'),
    ('consultation_slot_minutes', '60'),
    ('technician_capacity', '1 active job per time slot');

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(60) DEFAULT NULL,
    ADD UNIQUE INDEX IF NOT EXISTS uq_users_username (username);

ALTER TABLE users
    MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'active', 'inactive')
    NOT NULL DEFAULT 'approved';

ALTER TABLE work_activity
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS departments (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    is_active TINYINT(1) NOT NULL DEFAULT 1
);

INSERT IGNORE INTO departments (name) VALUES
    ('Administration'), ('IT'), ('Dispatch'), ('Accounting'),
    ('HR'), ('Marketing'), ('Sales'), ('Customer Service');

CREATE TABLE IF NOT EXISTS roles (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(40) NOT NULL UNIQUE
);

INSERT IGNORE INTO roles (name) VALUES
    ('customer'), ('admin'), ('hr'), ('dispatcher'), ('technician'),
    ('accounting'), ('customer_service'), ('employee');

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT UNSIGNED NOT NULL,
    role_id SMALLINT UNSIGNED NOT NULL,
    assigned_by INT UNSIGNED DEFAULT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_role_assigner
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = CASE
    WHEN u.account_type = 'admin' THEN 'admin'
    WHEN u.account_type = 'customer' THEN 'customer'
    WHEN u.department = 'HR' THEN 'hr'
    WHEN u.department = 'Dispatch' THEN 'dispatcher'
    WHEN u.department = 'Technician' THEN 'technician'
    WHEN u.department = 'Accounting' THEN 'accounting'
    WHEN u.department = 'Customer Service' THEN 'customer_service'
    ELSE 'employee'
END;

UPDATE users
SET department = 'Dispatch'
WHERE account_type = 'employee' AND department = 'Technician';

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id SMALLINT UNSIGNED NOT NULL,
    permission_key VARCHAR(80) NOT NULL,
    PRIMARY KEY (role_id, permission_key),
    CONSTRAINT fk_role_permission_role
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
JOIN (
    SELECT 'Manage users' AS permission_key UNION ALL
    SELECT 'Manage bookings' UNION ALL SELECT 'Manage products' UNION ALL
    SELECT 'Manage services' UNION ALL SELECT 'Manage schedules' UNION ALL
    SELECT 'View reports' UNION ALL SELECT 'Manage announcements' UNION ALL
    SELECT 'Create employees' UNION ALL SELECT 'Manage support' UNION ALL
    SELECT 'Manage payments' UNION ALL SELECT 'Field jobs' UNION ALL
    SELECT 'Submit service reports' UNION ALL SELECT 'View own account'
) p
WHERE
    (r.name = 'admin') OR
    (r.name = 'hr' AND p.permission_key IN ('Manage users', 'Create employees', 'Manage announcements', 'View own account')) OR
    (r.name = 'dispatcher' AND p.permission_key IN ('Manage bookings', 'Manage schedules', 'View reports', 'Manage support', 'View own account')) OR
    (r.name = 'technician' AND p.permission_key IN ('Field jobs', 'Submit service reports', 'View own account')) OR
    (r.name = 'accounting' AND p.permission_key IN ('Manage payments', 'View own account')) OR
    (r.name = 'customer_service' AND p.permission_key IN ('Manage support', 'View own account')) OR
    (r.name = 'employee' AND p.permission_key = 'View own account') OR
    (r.name = 'customer' AND p.permission_key = 'View own account');

CREATE TABLE IF NOT EXISTS customers (
    user_id INT UNSIGNED PRIMARY KEY,
    first_name VARCHAR(80) NOT NULL,
    middle_name VARCHAR(80) DEFAULT NULL,
    last_name VARCHAR(80) NOT NULL,
    birthdate DATE DEFAULT NULL,
    address VARCHAR(255) NOT NULL,
    CONSTRAINT fk_customer_profile_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT IGNORE INTO customers (user_id, first_name, last_name, address)
SELECT id,
       SUBSTRING_INDEX(full_name, ' ', 1),
       CASE
           WHEN TRIM(SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 1)) = ''
               THEN SUBSTRING_INDEX(full_name, ' ', 1)
           ELSE TRIM(SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 1))
       END,
       ''
FROM users
WHERE account_type = 'customer';

CREATE TABLE IF NOT EXISTS employees (
    user_id INT UNSIGNED PRIMARY KEY,
    first_name VARCHAR(80) NOT NULL,
    middle_name VARCHAR(80) DEFAULT NULL,
    last_name VARCHAR(80) NOT NULL,
    birthdate DATE DEFAULT NULL,
    address VARCHAR(255) NOT NULL DEFAULT '',
    department_id SMALLINT UNSIGNED DEFAULT NULL,
    CONSTRAINT fk_employee_profile_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_employee_profile_department
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

UPDATE employees e
JOIN users u ON u.id = e.user_id
JOIN departments d ON d.name = 'Dispatch'
SET e.department_id = d.id
WHERE u.account_type = 'employee'
  AND u.department = 'Dispatch'
  AND e.department_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id AND r.name = 'technician'
  );

INSERT IGNORE INTO employees (user_id, first_name, last_name, department_id)
SELECT u.id,
       SUBSTRING_INDEX(u.full_name, ' ', 1),
       CASE
           WHEN TRIM(SUBSTRING(u.full_name, LENGTH(SUBSTRING_INDEX(u.full_name, ' ', 1)) + 1)) = ''
               THEN SUBSTRING_INDEX(u.full_name, ' ', 1)
           ELSE TRIM(SUBSTRING(u.full_name, LENGTH(SUBSTRING_INDEX(u.full_name, ' ', 1)) + 1))
       END,
       d.id
FROM users u 
LEFT JOIN departments d ON d.name = u.department
WHERE u.account_type = 'employee';

-- Administrator account seed data (passwords are stored as hashes).
INSERT IGNORE INTO users
    (full_name, username, email, phone, gender, password_hash,
     account_type, department, status)
VALUES
    ('Sol Solis', 'admin', 'sol.solis@sunsonsolar.com', '09291230983',
     'prefer-not-to-say', '$2y$10$jwVXY7tZD3RkoH1Fmhjz0uKn6qNRbjuhSKMvwv3hDpXI96HsFFJtW',
     'admin', 'Administration', 'active'),
    ('Katherine Sinagaraw', 'KittyKat16', 'katherine.sinagaraw@sunsonsolar.com', '09291230983',
     'prefer-not-to-say', '$2y$10$/mjJ0qcdZk8rg/bT4Nx6t.Ls0Z7aQjKYqk4pGVTsFqpu8zihvYWwu',
     'admin', 'Administration', 'active');

INSERT IGNORE INTO employees
    (user_id, first_name, middle_name, last_name, birthdate, address, department_id)
SELECT u.id, 'Sol', NULL, 'Solis', '1967-01-08', 'Pasig City', d.id
FROM users u
JOIN departments d ON d.name = 'Administration'
WHERE u.email = 'sol.solis@sunsonsolar.com'
  AND u.username = 'admin'
  AND u.account_type = 'admin';

INSERT IGNORE INTO employees
    (user_id, first_name, middle_name, last_name, birthdate, address, department_id)
SELECT u.id, 'Katherine', NULL, 'Sinagaraw', '1990-07-01', 'Pasig City', d.id
FROM users u
JOIN departments d ON d.name = 'Administration'
WHERE u.email = 'katherine.sinagaraw@sunsonsolar.com'
  AND u.username = 'KittyKat16'
  AND u.account_type = 'admin';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email IN ('sol.solis@sunsonsolar.com', 'katherine.sinagaraw@sunsonsolar.com')
  AND u.account_type = 'admin';

CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category ENUM('solar_panel', 'inverter', 'battery', 'mounting_equipment', 'wire', 'other') NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(12,2) DEFAULT NULL,
    availability ENUM('available', 'quote_required', 'unavailable') NOT NULL DEFAULT 'quote_required',
    image_url VARCHAR(500) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

DELETE p1 FROM products p1
JOIN products p2
  ON p1.name = p2.name
 AND p1.category = p2.category
 AND p1.id > p2.id;

ALTER TABLE products
    ADD UNIQUE INDEX IF NOT EXISTS uq_product_name_category (name, category);

CREATE TABLE IF NOT EXISTS testimonials (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(120) NOT NULL,
    quote TEXT NOT NULL,
    rating TINYINT UNSIGNED NOT NULL DEFAULT 5,
    status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_by INT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_testimonial_author
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_testimonial_rating CHECK (rating BETWEEN 1 AND 5),
    INDEX idx_testimonial_public (status, created_at)
);

INSERT IGNORE INTO products (name, category, description, availability, sort_order)
VALUES
    ('Solar panels', 'solar_panel', 'High-quality photovoltaic panels for residential and commercial systems.', 'quote_required', 1),
    ('Solar inverters', 'inverter', 'Grid-tied and hybrid inverter options selected for your system design.', 'quote_required', 2),
    ('Solar batteries', 'battery', 'Energy storage options for backup power and self-consumption.', 'quote_required', 3),
    ('Mounting equipment', 'mounting_equipment', 'Secure mounting components suited to your roof and installation.', 'quote_required', 4),
    ('Solar wires and cables', 'wire', 'Solar-rated wiring and electrical balance-of-system components.', 'quote_required', 5);

CREATE TABLE IF NOT EXISTS services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price DECIMAL(12,2) DEFAULT NULL,
    price_label VARCHAR(120) NOT NULL DEFAULT 'Quotation required',
    is_available TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0
);

INSERT IGNORE INTO services (name, description, price_label, sort_order)
SELECT service_type, CONCAT(service_type, ' services provided by Sun Son Solar.'), price_label, sort_order
FROM service_catalog;

CREATE TABLE IF NOT EXISTS technician_assignments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNSIGNED NOT NULL,
    technician_id INT UNSIGNED NOT NULL,
    assigned_by INT UNSIGNED DEFAULT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('assigned', 'completed', 'cancelled') NOT NULL DEFAULT 'assigned',
    CONSTRAINT fk_assignment_booking
        FOREIGN KEY (booking_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_technician
        FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_assigner
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_assignment_technician_status (technician_id, status)
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNSIGNED NOT NULL,
    employee_id INT UNSIGNED NOT NULL,
    event_type ENUM('check_in', 'check_out') NOT NULL,
    latitude DECIMAL(10,7) DEFAULT NULL,
    longitude DECIMAL(10,7) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_booking
        FOREIGN KEY (booking_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_employee
        FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_attendance_job_employee (booking_id, employee_id, created_at)
);

CREATE TABLE IF NOT EXISTS service_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNSIGNED NOT NULL,
    employee_id INT UNSIGNED NOT NULL,
    report_type ENUM('service', 'equipment_problem', 'site_issue') NOT NULL DEFAULT 'service',
    report TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_service_report_booking
        FOREIGN KEY (booking_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_service_report_employee
        FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_service_report_booking (booking_id, created_at)
);

CREATE TABLE IF NOT EXISTS announcements (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    audience ENUM('employees', 'technicians', 'all') NOT NULL DEFAULT 'employees',
    created_by INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_announcement_author
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNSIGNED NOT NULL,
    customer_id INT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'PHP',
    status ENUM('pending', 'paid', 'refunded', 'void') NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(80) DEFAULT NULL,
    reference_number VARCHAR(100) DEFAULT NULL,
    recorded_by INT UNSIGNED DEFAULT NULL,
    paid_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_booking
        FOREIGN KEY (booking_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_customer
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_recorder
        FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_payment_customer_status (customer_id, status)
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NOT NULL,
    booking_id INT UNSIGNED DEFAULT NULL,
    subject VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    assigned_to INT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_customer
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_booking
        FOREIGN KEY (booking_id) REFERENCES service_requests(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_assignee
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_ticket_status_created (status, created_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id INT UNSIGNED DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT UNSIGNED DEFAULT NULL,
    details TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_actor
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_entity (entity_type, entity_id, created_at)
);

CREATE OR REPLACE VIEW bookings AS
SELECT id, customer_id, assigned_employee_id, service_type AS service_name,
       address, details, preferred_date, status, worker_notes, created_at, updated_at
FROM service_requests;

CREATE OR REPLACE VIEW notifications AS
SELECT id, title, message, audience, channel, scheduled_at, status, created_by, created_at
FROM portal_notifications;
