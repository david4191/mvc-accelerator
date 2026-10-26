-- Accumulated merged file tree per project. generated_code already stores
-- one isolated JSON blob per generation call; this table merges those
-- blobs by path so a project can be built incrementally across several
-- generations instead of always starting from a blank one.
CREATE TABLE IF NOT EXISTS `project_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `project_id` int(11) NOT NULL,
  `file_path` varchar(300) NOT NULL,
  `content` longtext NOT NULL,
  `source_generation_id` int(11) DEFAULT NULL,
  `is_foundation` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_project_path` (`project_id`,`file_path`),
  KEY `idx_project_files_project` (`project_id`),
  CONSTRAINT `project_files_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_files_ibfk_2` FOREIGN KEY (`source_generation_id`) REFERENCES `generated_code` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
