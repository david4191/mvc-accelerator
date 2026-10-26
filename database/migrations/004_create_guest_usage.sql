-- Tracks anonymous (not-logged-in) generation attempts by IP address, so a
-- guest's trial limit can be enforced server-side. api_usage can't be reused
-- for this: its user_id column is NOT NULL.
CREATE TABLE IF NOT EXISTS `guest_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) NOT NULL,
  `endpoint` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_guest_usage_ip_created` (`ip_address`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
