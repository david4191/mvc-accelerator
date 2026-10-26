-- ============================================
-- COMPLETE CORRECTED DATABASE SCHEMA
-- For MVC Accelerator Platform
-- ============================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- ============================================
-- DATABASE: formicpq_flakes
-- ============================================
CREATE DATABASE IF NOT EXISTS `formicpq_flakes` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `formicpq_flakes`;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `api_key` varchar(64) DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `verification_token` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `api_key` (`api_key`),
  KEY `idx_email` (`email`),
  KEY `idx_api_key` (`api_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `plan_type` enum('trial','monthly','yearly') DEFAULT 'trial',
  `start_date` timestamp NULL DEFAULT current_timestamp(),
  `end_date` timestamp NULL DEFAULT NULL,
  `payment_status` enum('pending','completed','failed','refunded') DEFAULT 'pending',
  `amount` decimal(10,2) DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `transaction_id` varchar(100) DEFAULT NULL,
  `auto_renew` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_sub` (`user_id`,`plan_type`),
  KEY `idx_expiry` (`end_date`),
  KEY `idx_transaction` (`transaction_id`),
  CONSTRAINT `subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE `projects` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `project_name` varchar(100) NOT NULL,
  `project_path` varchar(500) DEFAULT NULL,
  `framework` enum('mvc','laravel','custom') DEFAULT 'mvc',
  `php_version` varchar(10) DEFAULT '8.1',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_generated` timestamp NULL DEFAULT NULL,
  `last_scanned` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_user_projects` (`user_id`),
  FULLTEXT KEY `idx_project_search` (`project_name`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- GENERATED CODE TABLE
-- ============================================
CREATE TABLE `generated_code` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `project_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `prompt_text` text NOT NULL,
  `enhanced_prompt` text DEFAULT NULL,
  `generated_structure` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`generated_structure`)),
  `generated_files` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`generated_files`)),
  `file_count` int(11) DEFAULT 0,
  `token_count` int(11) DEFAULT 0,
  `status` enum('pending','completed','failed') DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project_gen` (`project_id`),
  KEY `idx_user_gen` (`user_id`),
  FULLTEXT KEY `idx_prompt_search` (`prompt_text`),
  CONSTRAINT `generated_code_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `generated_code_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CODE SCANS TABLE
-- ============================================
CREATE TABLE `code_scans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `project_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `scan_type` enum('security','performance','syntax','structure','full') DEFAULT 'full',
  `issues_found` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`issues_found`)),
  `fixes_applied` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`fixes_applied`)),
  `scan_status` enum('pending','in_progress','completed','failed') DEFAULT 'pending',
  `summary` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project_scan` (`project_id`),
  KEY `idx_user_scan` (`user_id`),
  CONSTRAINT `code_scans_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `code_scans_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- API USAGE TABLE
-- ============================================
CREATE TABLE `api_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `endpoint` varchar(100) NOT NULL,
  `method` varchar(10) DEFAULT 'GET',
  `request_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`request_data`)),
  `response_status` int(11) DEFAULT NULL,
  `response_time` int(11) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `tokens_used` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_api` (`user_id`),
  KEY `idx_endpoint` (`endpoint`),
  KEY `idx_date` (`created_at`),
  CONSTRAINT `api_usage_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE TABLE `sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `refresh_token` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `last_activity` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  UNIQUE KEY `refresh_token` (`refresh_token`),
  KEY `idx_user_sessions` (`user_id`),
  KEY `idx_expiry` (`expires_at`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PASSWORD RESETS TABLE
-- ============================================
CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `idx_user` (`user_id`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- EMAIL VERIFICATIONS TABLE
-- ============================================
CREATE TABLE `email_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `idx_user` (`user_id`),
  KEY `idx_verified` (`verified_at`),
  CONSTRAINT `email_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- LOGIN ATTEMPTS TABLE
-- ============================================
CREATE TABLE `login_attempts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `attempted_at` timestamp NULL DEFAULT current_timestamp(),
  `success` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_email_ip` (`email`,`ip_address`),
  KEY `idx_attempted` (`attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- USER ACTIVITY TABLE
-- ============================================
CREATE TABLE `user_activity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `action` varchar(50) NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_action` (`user_id`,`action`),
  KEY `idx_entity` (`entity_type`,`entity_id`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `user_activity_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text DEFAULT NULL,
  `data` json DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_notifications` (`user_id`,`read_at`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- API KEYS TABLE
-- ============================================
CREATE TABLE `api_keys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `api_key` varchar(64) NOT NULL,
  `permissions` json DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_key` (`api_key`),
  KEY `idx_user_keys` (`user_id`),
  CONSTRAINT `api_keys_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BILLING HISTORY TABLE
-- ============================================
CREATE TABLE `billing_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `subscription_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `payment_method` varchar(50) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `status` enum('pending','completed','failed','refunded') DEFAULT 'pending',
  `invoice_url` text DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_billing` (`user_id`),
  KEY `idx_transaction` (`transaction_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `billing_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `billing_history_ibfk_2` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CODE VERSIONS TABLE
-- ============================================
CREATE TABLE `code_versions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `generation_id` int(11) NOT NULL,
  `version_number` int(11) NOT NULL,
  `files` json DEFAULT NULL,
  `changes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_version` (`generation_id`,`version_number`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `code_versions_ibfk_1` FOREIGN KEY (`generation_id`) REFERENCES `generated_code` (`id`) ON DELETE CASCADE,
  CONSTRAINT `code_versions_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CODE REVIEWS TABLE
-- ============================================
CREATE TABLE `code_reviews` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `generation_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `rating` int(11) DEFAULT NULL CHECK (`rating` >= 1 and `rating` <= 5),
  `feedback` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_generation` (`generation_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `code_reviews_ibfk_1` FOREIGN KEY (`generation_id`) REFERENCES `generated_code` (`id`) ON DELETE CASCADE,
  CONSTRAINT `code_reviews_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TEMPLATES TABLE
-- ============================================
CREATE TABLE `templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `type` enum('mvc','laravel','custom') DEFAULT 'mvc',
  `structure` json NOT NULL,
  `tags` json DEFAULT NULL,
  `usage_count` int(11) DEFAULT 0,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_usage` (`usage_count`),
  KEY `idx_created_by` (`created_by`),
  FULLTEXT KEY `idx_search` (`name`,`description`),
  CONSTRAINT `templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STORED PROCEDURES
-- ============================================
DELIMITER $$

CREATE PROCEDURE `cleanup_old_records`(IN `days_old` INT)
BEGIN
    DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL days_old DAY);
    DELETE FROM api_usage WHERE created_at < DATE_SUB(NOW(), INTERVAL days_old DAY);
    DELETE FROM user_activity WHERE created_at < DATE_SUB(NOW(), INTERVAL days_old DAY);
    DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL days_old DAY) AND read_at IS NOT NULL;
    DELETE FROM sessions WHERE expires_at < NOW();
    DELETE FROM password_resets WHERE expires_at < NOW();
    DELETE FROM email_verifications WHERE expires_at < NOW();
END$$

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER `after_user_insert` 
AFTER INSERT ON `users` 
FOR EACH ROW
BEGIN
    INSERT INTO subscriptions (user_id, plan_type, end_date, payment_status)
    VALUES (NEW.id, 'trial', DATE_ADD(NOW(), INTERVAL 48 HOUR), 'completed');
END$$

CREATE TRIGGER `update_project_last_generated` 
AFTER INSERT ON `generated_code` 
FOR EACH ROW
BEGIN
    IF NEW.project_id IS NOT NULL THEN
        UPDATE projects SET last_generated = NOW() WHERE id = NEW.project_id;
    END IF;
END$$

CREATE TRIGGER `update_project_last_scanned` 
AFTER INSERT ON `code_scans` 
FOR EACH ROW
BEGIN
    UPDATE projects SET last_scanned = NOW() WHERE id = NEW.project_id;
END$$

DELIMITER ;

-- ============================================
-- EVENTS
-- ============================================
DELIMITER $$
CREATE EVENT `cleanup_event`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
ON COMPLETION PRESERVE
ENABLE
DO
CALL cleanup_old_records(30)$$
DELIMITER ;

-- ============================================
-- VIEWS
-- ============================================
CREATE VIEW `user_subscription_view` AS
SELECT 
    u.id AS user_id,
    u.username,
    u.email,
    u.created_at AS registered_at,
    s.plan_type,
    s.start_date AS subscription_start,
    s.end_date AS subscription_end,
    CASE 
        WHEN s.end_date IS NULL THEN 'lifetime'
        WHEN s.end_date > NOW() THEN 'active'
        ELSE 'expired'
    END AS subscription_status
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.payment_status = 'completed';

CREATE VIEW `usage_statistics_view` AS
SELECT 
    DATE(created_at) AS date,
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(*) AS total_requests,
    SUM(CASE WHEN endpoint LIKE '%generate%' THEN 1 ELSE 0 END) AS generations,
    SUM(CASE WHEN endpoint LIKE '%scan%' THEN 1 ELSE 0 END) AS scans,
    SUM(CASE WHEN endpoint LIKE '%fix%' THEN 1 ELSE 0 END) AS fixes,
    SUM(CASE WHEN response_status >= 400 THEN 1 ELSE 0 END) AS errors,
    AVG(response_time) AS avg_response_time
FROM api_usage
GROUP BY DATE(created_at);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, payment_status);
CREATE INDEX idx_code_scans_project ON code_scans(project_id);
CREATE INDEX idx_generated_code_user ON generated_code(user_id);
CREATE INDEX idx_generated_code_created ON generated_code(created_at);
CREATE INDEX idx_api_usage_user_date ON api_usage(user_id, created_at);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX idx_user_activity_user_created ON user_activity(user_id, created_at);

-- ============================================
-- SAMPLE DATA
-- ============================================
INSERT INTO `templates` (`name`, `description`, `type`, `structure`) VALUES
('Basic MVC', 'Basic MVC structure with controllers, models, and views', 'mvc', '{
    "controllers": ["HomeController.php"],
    "models": [],
    "views": ["home/index.php"],
    "config": ["database.php", "app.php"],
    "public": ["index.php", ".htaccess"]
}'),
('REST API', 'RESTful API structure with JWT authentication', 'mvc', '{
    "controllers": ["AuthController.php", "UserController.php", "ApiController.php"],
    "models": ["User.php"],
    "middleware": ["AuthMiddleware.php"],
    "config": ["database.php", "jwt.php"],
    "public": ["index.php", ".htaccess"]
}'),
('Blog System', 'Complete blog system with posts and comments', 'mvc', '{
    "controllers": ["PostController.php", "CommentController.php", "AuthController.php"],
    "models": ["Post.php", "Comment.php", "User.php"],
    "views": ["posts/index.php", "posts/show.php", "comments/index.php"],
    "config": ["database.php"],
    "public": ["index.php", ".htaccess"]
}');

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;