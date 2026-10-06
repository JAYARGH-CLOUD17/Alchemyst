CREATE DATABASE IF NOT EXISTS `SSS_DATABASE`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `SSS_DATABASE`;

CREATE TABLE IF NOT EXISTS `clients` (
  `client_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) NULL,
  `birthdate` DATE NOT NULL,
  `gender` ENUM('Female', 'Male', 'Prefer not to say') NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `phone` CHAR(11) NOT NULL,
  `address` VARCHAR(500) NOT NULL,
  `username` VARCHAR(13) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`client_id`),
  UNIQUE KEY `uq_clients_username` (`username`),
  UNIQUE KEY `uq_clients_email` (`email`),
  CONSTRAINT `chk_clients_phone_format`
    CHECK (`phone` REGEXP '^09[0-9]{9}$')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `associates` (
  `associate_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) NULL,
  `birthdate` DATE NOT NULL,
  `gender` ENUM('Female', 'Male', 'Prefer not to say') NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `phone` CHAR(11) NOT NULL,
  `address` VARCHAR(500) NOT NULL,
  `username` VARCHAR(13) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `department` ENUM(
    'Administration',
    'IT',
    'Dispatch',
    'Accounting',
    'HR',
    'Marketing',
    'Sales',
    'Customer Service'
  ) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`associate_id`),
  UNIQUE KEY `uq_associates_username` (`username`),
  UNIQUE KEY `uq_associates_email` (`email`),
  CONSTRAINT `chk_associates_phone_format`
    CHECK (`phone` REGEXP '^09[0-9]{9}$')
) ENGINE=InnoDB;

ALTER TABLE `clients`
  MODIFY `gender` ENUM('Female', 'Male', 'Prefer not to say') NOT NULL;

ALTER TABLE `associates`
  MODIFY `gender` ENUM('Female', 'Male', 'Prefer not to say') NOT NULL;

DELIMITER //

DROP TRIGGER IF EXISTS `clients_username_unique_insert`//
DROP TRIGGER IF EXISTS `clients_username_unique_update`//
DROP TRIGGER IF EXISTS `associates_username_unique_insert`//
DROP TRIGGER IF EXISTS `associates_username_unique_update`//

CREATE TRIGGER `clients_username_unique_insert`
BEFORE INSERT ON `clients`
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM `associates` WHERE `username` = NEW.`username`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Username already exists';
  END IF;
END//

CREATE TRIGGER `clients_username_unique_update`
BEFORE UPDATE ON `clients`
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM `associates` WHERE `username` = NEW.`username`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Username already exists';
  END IF;
END//

CREATE TRIGGER `associates_username_unique_insert`
BEFORE INSERT ON `associates`
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM `clients` WHERE `username` = NEW.`username`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Username already exists';
  END IF;
END//

CREATE TRIGGER `associates_username_unique_update`
BEFORE UPDATE ON `associates`
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM `clients` WHERE `username` = NEW.`username`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Username already exists';
  END IF;
END//

DELIMITER ;
