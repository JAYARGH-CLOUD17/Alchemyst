CREATE DATABASE IF NOT EXISTS sunson_registration
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sunson_registration;

CREATE TABLE IF NOT EXISTS registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_type ENUM('client', 'associate') NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  birthdate DATE NOT NULL,
  gender VARCHAR(30) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(11) NOT NULL,
  address TEXT NOT NULL,
  username VARCHAR(12) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  department VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY registrations_email_unique (email),
  UNIQUE KEY registrations_username_unique (username)
);

-- Demo accounts. Passwords are stored as hashes, not readable text.
INSERT IGNORE INTO registrations
  (account_type, first_name, middle_name, last_name, birthdate, gender, email, phone, address, username, password_hash, department)
VALUES
  ('client', 'Kitty', '', 'Kat', '2000-01-01', 'prefer-not', 'kittykat16@example.com', '09000000001', 'Not provided', 'KittyKat16', '$2y$10$/ImrgF5pDNSRctd6WbhkYe8aPKRCBrualfMstPzLtADrDytalXLbO', NULL),
  ('client', 'Sol', '', 'User', '2000-01-01', 'prefer-not', 'sol123@example.com', '09000000002', 'Not provided', 'Sol123', '$2y$10$TO4.X14CJ4BIB4vWia29nOdCtXkpxU.qNwTJkF9CvCf9o5J.zNYLu', NULL);
