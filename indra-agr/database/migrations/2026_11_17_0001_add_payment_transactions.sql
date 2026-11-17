-- Migration: 2026_11_17_0001_add_payment_transactions.sql
-- Adds UPI Payment Gateway, Application Drafts, Webhook Idempotency, and Payment Audit Logging

USE `indra_agr_portal`;

-- 1. application_drafts (Holds verified OTP + uploaded docs draft before verified payment finalizes submission)
CREATE TABLE IF NOT EXISTS `application_drafts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `draft_token` CHAR(64) NOT NULL,
  `job_id` BIGINT UNSIGNED NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `mobile_number` VARCHAR(20) NOT NULL,
  `email_address` VARCHAR(190) NOT NULL,
  `mobile_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('in_progress', 'payment_pending', 'submitted', 'expired') NOT NULL DEFAULT 'in_progress',
  `final_application_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_drafts_token` (`draft_token`),
  KEY `idx_drafts_job` (`job_id`),
  CONSTRAINT `fk_drafts_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. payment_transactions
CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `draft_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `application_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `receipt_number` VARCHAR(48) NULL DEFAULT NULL,
  `gateway_provider` ENUM('razorpay', 'cashfree') NOT NULL,
  `gateway_mode` ENUM('test', 'live') NOT NULL DEFAULT 'test',
  `payment_order_id` VARCHAR(120) NOT NULL,
  `gateway_payment_id` VARCHAR(120) NULL DEFAULT NULL,
  `gateway_signature` VARCHAR(255) NULL DEFAULT NULL,
  `amount` INT UNSIGNED NOT NULL COMMENT 'Amount in smallest currency unit (paise)',
  `currency` CHAR(3) NOT NULL DEFAULT 'INR',
  `payment_method` VARCHAR(60) NULL DEFAULT NULL,
  `transaction_reference` VARCHAR(120) NULL DEFAULT NULL COMMENT 'UPI UTR / RRN / Bank Reference',
  `payment_status` ENUM('created', 'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'created',
  `refund_status` ENUM('Not Requested', 'Requested', 'Processing', 'Refunded', 'Refund Failed') NOT NULL DEFAULT 'Not Requested',
  `refund_id` VARCHAR(120) NULL DEFAULT NULL,
  `refund_amount` INT UNSIGNED NULL DEFAULT NULL,
  `refund_reason` TEXT NULL DEFAULT NULL,
  `refund_requested_at` DATETIME NULL DEFAULT NULL,
  `refunded_at` DATETIME NULL DEFAULT NULL,
  `confirmation_email_sent` TINYINT(1) NOT NULL DEFAULT 0,
  `receipt_storage_path` VARCHAR(255) NULL DEFAULT NULL,
  `gateway_response` LONGTEXT NULL DEFAULT NULL,
  `failure_reason` VARCHAR(500) NULL DEFAULT NULL,
  `paid_at` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_order_id` (`payment_order_id`),
  UNIQUE KEY `uq_gateway_payment_id` (`gateway_payment_id`),
  UNIQUE KEY `uq_receipt_number` (`receipt_number`),
  KEY `idx_payment_application` (`application_id`),
  KEY `idx_payment_draft` (`draft_id`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_payment_paid_at` (`paid_at`),
  CONSTRAINT `fk_payment_draft` FOREIGN KEY (`draft_id`) REFERENCES `application_drafts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. payment_receipt_sequences (Concurrency-safe unique receipt numbers)
CREATE TABLE IF NOT EXISTS `payment_receipt_sequences` (
  `seq_year` SMALLINT UNSIGNED NOT NULL,
  `last_value` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`seq_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. payment_webhook_events (Idempotency & duplicate webhook protection)
CREATE TABLE IF NOT EXISTS `payment_webhook_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gateway_provider` ENUM('razorpay', 'cashfree') NOT NULL,
  `event_id` VARCHAR(160) NOT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `payment_order_id` VARCHAR(120) NULL DEFAULT NULL,
  `signature_valid` TINYINT(1) NOT NULL DEFAULT 0,
  `processed_at` DATETIME NULL DEFAULT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_webhook_provider_event` (`gateway_provider`, `event_id`),
  KEY `idx_webhook_order` (`payment_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. payment_audit_logs
CREATE TABLE IF NOT EXISTS `payment_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_transaction_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `actor_type` ENUM('candidate', 'webhook', 'admin', 'system') NOT NULL,
  `actor_id` VARCHAR(120) NULL DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_payment` (`payment_transaction_id`),
  CONSTRAINT `fk_audit_payment` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Link applications to verified payment transaction
ALTER TABLE `applications`
  ADD COLUMN IF NOT EXISTS `payment_transaction_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `privacy_consent_accepted`,
  ADD COLUMN IF NOT EXISTS `fee_amount_paise` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `payment_transaction_id`,
  ADD UNIQUE KEY `uq_applications_payment_tx` (`payment_transaction_id`);
