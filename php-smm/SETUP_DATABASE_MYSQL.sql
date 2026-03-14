-- ═══════════════════════════════════════════════════════════════════════════════
-- SMM Panel Pro — MySQL/MariaDB Database Schema
-- Run this in phpMyAdmin, MySQL CLI, or cPanel MySQL Databases
-- MySQL 5.7+ or MariaDB 10.3+
-- ═══════════════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `email`         VARCHAR(255) NOT NULL UNIQUE,
    `username`      VARCHAR(50) NOT NULL DEFAULT '',
    `password_hash` VARCHAR(255) NOT NULL DEFAULT '',
    `google_id`     VARCHAR(128) NULL DEFAULT NULL,
    `role`          ENUM('user','admin','reseller') NOT NULL DEFAULT 'user',
    `balance`       DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
    `banned`        TINYINT(1) NOT NULL DEFAULT 0,
    `api_key`       VARCHAR(64) NULL DEFAULT NULL UNIQUE,
    `referral_code` VARCHAR(20) NULL DEFAULT NULL UNIQUE,
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email       (`email`),
    INDEX idx_api_key     (`api_key`),
    INDEX idx_referral    (`referral_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── site_settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_settings` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key`        VARCHAR(100) NOT NULL UNIQUE,
    `value`      TEXT,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── categories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `categories` (
    `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name`        VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) DEFAULT '',
    `sort_order`  INT NOT NULL DEFAULT 0,
    `active`      TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sort (`sort_order`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── providers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `providers` (
    `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name`           VARCHAR(100) NOT NULL,
    `base_url`       VARCHAR(500) NOT NULL,
    `api_key`        TEXT NOT NULL,
    `status`         ENUM('active','inactive','error') NOT NULL DEFAULT 'active',
    `markup_percent` DECIMAL(6,2) NOT NULL DEFAULT 25.00,
    `last_sync_at`   DATETIME NULL DEFAULT NULL,
    `notes`          TEXT DEFAULT '',
    `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── services ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `services` (
    `id`                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `category_id`         INT UNSIGNED NOT NULL,
    `name`                VARCHAR(200) NOT NULL,
    `description`         TEXT DEFAULT '',
    `type`                VARCHAR(50) NOT NULL DEFAULT 'default',
    `rate`                DECIMAL(12,6) NOT NULL DEFAULT 0.000000,
    `min`                 INT NOT NULL DEFAULT 10,
    `max`                 INT NOT NULL DEFAULT 100000,
    `provider_id`         INT UNSIGNED NULL DEFAULT NULL,
    `provider_service_id` VARCHAR(100) NULL DEFAULT NULL,
    `refill`              TINYINT(1) NOT NULL DEFAULT 0,
    `cancel`              TINYINT(1) NOT NULL DEFAULT 0,
    `dripfeed`            TINYINT(1) NOT NULL DEFAULT 0,
    `subscriptions`       TINYINT(1) NOT NULL DEFAULT 0,
    `average_time`        VARCHAR(100) DEFAULT NULL,
    `sort_order`          INT NOT NULL DEFAULT 0,
    `status`              ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (`category_id`),
    INDEX idx_provider (`provider_id`, `provider_service_id`),
    INDEX idx_sort     (`sort_order`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `orders` (
    `id`                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`           INT UNSIGNED NOT NULL,
    `service_id`        INT UNSIGNED NOT NULL,
    `link`              VARCHAR(2048) NOT NULL,
    `quantity`          INT NOT NULL,
    `charge`            DECIMAL(12,4) NOT NULL,
    `status`            ENUM('pending','processing','active','partial','completed','cancelled','failed','refunded') NOT NULL DEFAULT 'pending',
    `start_count`       INT NULL DEFAULT NULL,
    `remains`           INT NULL DEFAULT NULL,
    `provider_order_id` VARCHAR(100) NULL DEFAULT NULL,
    `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user    (`user_id`),
    INDEX idx_service (`service_id`),
    INDEX idx_status  (`status`),
    INDEX idx_created (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── order_logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_logs` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `order_id`   INT UNSIGNED NOT NULL,
    `status`     VARCHAR(50) NOT NULL,
    `note`       TEXT DEFAULT '',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── transactions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `transactions` (
    `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`       INT UNSIGNED NOT NULL,
    `type`          ENUM('deposit','order','refund','adjustment','bonus','referral','welcome_bonus') NOT NULL,
    `amount`        DECIMAL(12,4) NOT NULL,
    `balance_after` DECIMAL(12,4) NOT NULL,
    `description`   VARCHAR(500) DEFAULT '',
    `reference_id`  INT UNSIGNED NULL DEFAULT NULL,
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user    (`user_id`),
    INDEX idx_created (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── deposits ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `deposits` (
    `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`     INT UNSIGNED NOT NULL,
    `amount`      DECIMAL(12,4) NOT NULL,
    `method`      ENUM('bank_transfer','crypto','card','momo','zalopay','sepay') NOT NULL DEFAULT 'bank_transfer',
    `gateway_ref` VARCHAR(255) NULL DEFAULT NULL,
    `status`      ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    `admin_note`  VARCHAR(500) DEFAULT '',
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user        (`user_id`),
    INDEX idx_status      (`status`),
    INDEX idx_gateway_ref (`gateway_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── tickets ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tickets` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`    INT UNSIGNED NOT NULL,
    `subject`    VARCHAR(200) NOT NULL,
    `status`     ENUM('open','pending','closed') NOT NULL DEFAULT 'open',
    `priority`   ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user   (`user_id`),
    INDEX idx_status (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ticket_messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ticket_messages` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `ticket_id`  INT UNSIGNED NOT NULL,
    `user_id`    INT UNSIGNED NOT NULL,
    `message`    TEXT NOT NULL,
    `is_admin`   TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticket (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── announcements ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `announcements` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `title`      VARCHAR(200) NOT NULL,
    `content`    TEXT NOT NULL,
    `type`       ENUM('info','warning','maintenance','success') NOT NULL DEFAULT 'info',
    `active`     TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`    INT UNSIGNED NOT NULL,
    `type`       VARCHAR(50) NOT NULL DEFAULT 'info',
    `title`      VARCHAR(200) NOT NULL,
    `message`    TEXT NOT NULL,
    `read`       TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (`user_id`, `read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── referrals ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `referrals` (
    `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `referrer_id`  INT UNSIGNED NOT NULL,
    `referred_id`  INT UNSIGNED NOT NULL UNIQUE,
    `bonus_amount` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_referrer (`referrer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── card_charges ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `card_charges` (
    `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`      INT UNSIGNED NOT NULL,
    `telco`        VARCHAR(20) NOT NULL,
    `face_value`   INT NOT NULL,
    `code`         VARCHAR(30) NOT NULL,
    `serial`       VARCHAR(30) NOT NULL,
    `request_id`   VARCHAR(64) NOT NULL UNIQUE,
    `status`       TINYINT NOT NULL DEFAULT 0  COMMENT '0=pending,1=success,2=error,3=maintenance',
    `message`      VARCHAR(500) DEFAULT NULL,
    `actual_amount` INT NULL DEFAULT NULL,
    `usd_credited` DECIMAL(12,4) NULL DEFAULT NULL,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user       (`user_id`),
    INDEX idx_request    (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── rate_limits ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `rate_limits` (
    `key`           VARCHAR(128) NOT NULL PRIMARY KEY,
    `ip`            VARCHAR(45) NOT NULL DEFAULT '',
    `preset`        VARCHAR(30) NOT NULL DEFAULT 'global',
    `count`         INT UNSIGNED NOT NULL DEFAULT 0,
    `window_start`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at`    DATETIME NOT NULL,
    `blocked_until` DATETIME NULL DEFAULT NULL,
    INDEX idx_expires (`expires_at`),
    INDEX idx_ip      (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── api_request_logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `api_request_logs` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`    INT UNSIGNED NULL DEFAULT NULL,
    `ip`         VARCHAR(45) NOT NULL,
    `method`     VARCHAR(10) NOT NULL,
    `path`       VARCHAR(500) NOT NULL,
    `status`     SMALLINT NOT NULL DEFAULT 200,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user    (`user_id`),
    INDEX idx_ip      (`ip`),
    INDEX idx_created (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DEFAULT DATA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Default site settings
INSERT IGNORE INTO `site_settings` (`key`, `value`) VALUES
('site_name',           'SMM Panel Pro'),
('site_description',    'Dịch vụ SMM chuyên nghiệp — tăng follower, like, view'),
('currency',            'USD'),
('min_deposit_usd',     '1'),
('vnd_exchange_rate',   '24000'),
('welcome_bonus_usd',   '0'),
('referral_bonus_usd',  '0'),
('registration_closed', '0'),
('telegram_bot_token',  ''),
('telegram_chat_id',    ''),
('bank_name',           'Vietcombank'),
('bank_account_number', ''),
('bank_account_name',   ''),
('sepay_webhook_secret',''),
('card_partner_id',     ''),
('card_partner_key',    '');

-- Demo category
INSERT IGNORE INTO `categories` (`id`, `name`, `description`, `sort_order`, `active`) VALUES
(1, 'Instagram', 'Instagram services', 1, 1),
(2, 'TikTok', 'TikTok services', 2, 1),
(3, 'Facebook', 'Facebook services', 3, 1),
(4, 'YouTube', 'YouTube services', 4, 1);

-- Demo provider (smmgen.com)
INSERT IGNORE INTO `providers` (`id`, `name`, `base_url`, `api_key`, `markup_percent`) VALUES
(1, 'smmgen.com', 'https://smmgen.com/api/v2', 'fdf00679c023640060b7b04a63396acf', 25.00);

-- Default admin & demo users
-- Password for both: "password" (bcrypt cost=12)
INSERT IGNORE INTO `users` (`id`, `email`, `username`, `password_hash`, `role`, `api_key`, `referral_code`) VALUES
(1, 'admin@smmpanel.com', 'admin',
 '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
 'admin',
 'admin-api-key-change-this-immediately',
 'ADMIN001'),
(2, 'demo@smmpanel.com', 'demo',
 '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
 'user',
 'demo-api-key-0000000000000000000000',
 'DEMO0001');

-- Initial announcement
INSERT IGNORE INTO `announcements` (`title`, `content`, `type`, `active`) VALUES
('Chào mừng đến với SMM Panel Pro',
 'Chào mừng! Đây là nền tảng SMM Panel chuyên nghiệp. Liên hệ support nếu cần hỗ trợ.',
 'info', 1);

SET FOREIGN_KEY_CHECKS = 1;
