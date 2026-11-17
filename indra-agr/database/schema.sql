-- INDRA AGR TRADING PVT. LTD. — Normalized MySQL / MariaDB Schema
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci

CREATE DATABASE IF NOT EXISTS `indra_agr_portal`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `indra_agr_portal`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. admins (Single Super Admin initial access; no hardcoded credentials)
CREATE TABLE IF NOT EXISTS `admins` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin') NOT NULL DEFAULT 'super_admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `failed_login_attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL DEFAULT NULL,
  `last_login_at` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admins_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. jobs (Dynamic job vacancy management)
CREATE TABLE IF NOT EXISTS `jobs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(180) NOT NULL,
  `slug` VARCHAR(200) NOT NULL,
  `department` VARCHAR(120) NOT NULL,
  `location` VARCHAR(160) NOT NULL,
  `employment_type` ENUM('Full-Time', 'Part-Time', 'Contract', 'Internship', 'Field Operations') NOT NULL DEFAULT 'Full-Time',
  `experience_required` VARCHAR(120) NOT NULL,
  `qualifications` TEXT NOT NULL,
  `salary_range` VARCHAR(120) NULL DEFAULT NULL,
  `description` LONGTEXT NOT NULL,
  `responsibilities` LONGTEXT NOT NULL,
  `application_deadline` DATE NULL DEFAULT NULL,
  `status` ENUM('draft', 'published', 'closed', 'archived') NOT NULL DEFAULT 'draft',
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_jobs_slug` (`slug`),
  KEY `idx_jobs_status_deadline` (`status`, `application_deadline`),
  KEY `idx_jobs_location` (`location`),
  CONSTRAINT `fk_jobs_admin` FOREIGN KEY (`created_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. applicants (One applicant can submit multiple applications)
CREATE TABLE IF NOT EXISTS `applicants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(150) NOT NULL,
  `father_name` VARCHAR(150) NULL DEFAULT NULL,
  `date_of_birth` DATE NOT NULL,
  `gender` VARCHAR(40) NULL DEFAULT NULL,
  `nationality` VARCHAR(80) NOT NULL DEFAULT 'Indian',
  `mobile_number` VARCHAR(20) NOT NULL,
  `email_address` VARCHAR(190) NOT NULL,
  `permanent_address` TEXT NOT NULL,
  `district` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `pin_code` VARCHAR(12) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_applicants_email_mobile` (`email_address`, `mobile_number`),
  KEY `idx_applicants_mobile` (`mobile_number`),
  KEY `idx_applicants_email` (`email_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Concurrency-safe sequence table for INDRA-AGR-YYYY-NNNNNN
CREATE TABLE IF NOT EXISTS `application_sequences` (
  `seq_year` SMALLINT UNSIGNED NOT NULL,
  `last_value` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`seq_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. applications (Each application belongs to one applicant and one published job)
CREATE TABLE IF NOT EXISTS `applications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_number` VARCHAR(32) NOT NULL,
  `applicant_id` BIGINT UNSIGNED NOT NULL,
  `job_id` BIGINT UNSIGNED NOT NULL,
  `preferred_location` VARCHAR(160) NOT NULL,
  `experience_level` ENUM('Fresher', 'Experienced') NOT NULL DEFAULT 'Fresher',
  `expected_salary` VARCHAR(80) NULL DEFAULT NULL,
  `mobile_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `mobile_verified_at` DATETIME NULL DEFAULT NULL,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `email_verified_at` DATETIME NULL DEFAULT NULL,
  `declaration_accepted` TINYINT(1) NOT NULL DEFAULT 0,
  `privacy_consent_accepted` TINYINT(1) NOT NULL DEFAULT 0,
  `payment_transaction_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `fee_amount_paise` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('Submitted', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'On Hold') NOT NULL DEFAULT 'Submitted',
  `internal_remarks` TEXT NULL DEFAULT NULL,
  `pdf_storage_path` VARCHAR(255) NULL DEFAULT NULL,
  `submitted_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_applications_number` (`application_number`),
  UNIQUE KEY `uq_applications_payment_tx` (`payment_transaction_id`),
  KEY `idx_applications_status` (`status`),
  KEY `idx_applications_job` (`job_id`),
  KEY `idx_applications_submitted` (`submitted_at`),
  CONSTRAINT `fk_applications_applicant` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_applications_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. education_details
CREATE TABLE IF NOT EXISTS `education_details` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `tenth_board` VARCHAR(150) NOT NULL,
  `tenth_passing_year` SMALLINT UNSIGNED NOT NULL,
  `tenth_roll_number` VARCHAR(60) NOT NULL,
  `tenth_marks_obtained` DECIMAL(7,2) NOT NULL,
  `tenth_total_marks` DECIMAL(7,2) NOT NULL,
  `twelfth_board` VARCHAR(150) NOT NULL,
  `twelfth_passing_year` SMALLINT UNSIGNED NOT NULL,
  `twelfth_roll_number` VARCHAR(60) NOT NULL,
  `twelfth_marks_obtained` DECIMAL(7,2) NOT NULL,
  `twelfth_total_marks` DECIMAL(7,2) NOT NULL,
  `highest_qualification` VARCHAR(180) NOT NULL,
  `additional_qualifications` TEXT NULL DEFAULT NULL,
  `computer_skills` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_education_application` (`application_id`),
  CONSTRAINT `fk_education_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. work_experience
CREATE TABLE IF NOT EXISTS `work_experience` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `previous_employer` VARCHAR(180) NULL DEFAULT NULL,
  `previous_designation` VARCHAR(150) NULL DEFAULT NULL,
  `duration_summary` VARCHAR(120) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_work_exp_application` (`application_id`),
  CONSTRAINT `fk_work_exp_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. applicant_documents (Stored outside public webroot with random filenames)
CREATE TABLE IF NOT EXISTS `applicant_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `document_type` ENUM('photograph', 'resume', 'tenth_marksheet', 'twelfth_marksheet', 'highest_qualification', 'other') NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size_bytes` INT UNSIGNED NOT NULL,
  `verification_status` ENUM('Pending', 'Verified', 'Re-upload Requested') NOT NULL DEFAULT 'Pending',
  `uploaded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_documents_stored_name` (`stored_filename`),
  KEY `idx_documents_application` (`application_id`),
  CONSTRAINT `fk_documents_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. verification_otps (Hashed OTPs, 5-min expiry, max 5 attempts, 60-sec cooldown)
CREATE TABLE IF NOT EXISTS `verification_otps` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel` ENUM('mobile', 'email') NOT NULL,
  `recipient` VARCHAR(190) NOT NULL,
  `purpose` ENUM('application_verification', 'status_tracking') NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `max_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 5,
  `expires_at` DATETIME NOT NULL,
  `verified_at` DATETIME NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_lookup` (`channel`, `recipient`, `purpose`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. application_status_history
CREATE TABLE IF NOT EXISTS `application_status_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `previous_status` VARCHAR(40) NULL DEFAULT NULL,
  `new_status` VARCHAR(40) NOT NULL,
  `changed_by_admin_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `remarks` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_history_app` (`application_id`),
  CONSTRAINT `fk_status_history_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_status_history_admin` FOREIGN KEY (`changed_by_admin_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. interviews
CREATE TABLE IF NOT EXISTS `interviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `scheduled_by_admin_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `interview_date` DATE NOT NULL,
  `interview_time` TIME NOT NULL,
  `mode` ENUM('Online', 'Offline') NOT NULL DEFAULT 'Online',
  `location_or_link` VARCHAR(500) NOT NULL,
  `instructions` TEXT NULL DEFAULT NULL,
  `status` ENUM('Scheduled', 'Rescheduled', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Scheduled',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_interviews_app` (`application_id`),
  KEY `idx_interviews_date` (`interview_date`),
  CONSTRAINT `fk_interviews_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_interviews_admin` FOREIGN KEY (`scheduled_by_admin_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. email_logs
CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipient_email` VARCHAR(190) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `template_key` VARCHAR(80) NOT NULL,
  `status` ENUM('sent', 'failed') NOT NULL,
  `error_message` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_logs_recipient` (`recipient_email`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. directors
CREATE TABLE IF NOT EXISTS `directors` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(150) NOT NULL,
  `designation` VARCHAR(120) NOT NULL DEFAULT 'Director',
  `bio` TEXT NULL DEFAULT NULL,
  `display_order` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. website_settings
CREATE TABLE IF NOT EXISTS `website_settings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(120) NOT NULL,
  `setting_value` LONGTEXT NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_website_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. application_drafts (Temporary verified draft before gateway payment completes)
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

-- 15. payment_transactions
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
  `amount` INT UNSIGNED NOT NULL COMMENT 'Amount in paise',
  `currency` CHAR(3) NOT NULL DEFAULT 'INR',
  `payment_method` VARCHAR(60) NULL DEFAULT NULL,
  `transaction_reference` VARCHAR(120) NULL DEFAULT NULL,
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

-- 16. payment_receipt_sequences
CREATE TABLE IF NOT EXISTS `payment_receipt_sequences` (
  `seq_year` SMALLINT UNSIGNED NOT NULL,
  `last_value` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`seq_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. payment_webhook_events
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

-- 18. payment_audit_logs
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

SET FOREIGN_KEY_CHECKS = 1;
