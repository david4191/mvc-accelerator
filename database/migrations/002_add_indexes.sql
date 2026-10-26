-- Migration 002: Add performance indexes

-- Add composite indexes for common queries
CREATE INDEX idx_user_subscription_lookup ON subscriptions(user_id, payment_status, end_date);
CREATE INDEX idx_project_user_lookup ON projects(user_id, is_active, updated_at);
CREATE INDEX idx_generated_code_lookup ON generated_code(user_id, status, created_at);
CREATE INDEX idx_code_scans_lookup ON code_scans(project_id, scan_status, created_at);
CREATE INDEX idx_api_usage_lookup ON api_usage(user_id, endpoint, created_at);

-- Add fulltext indexes for search
ALTER TABLE users ADD FULLTEXT INDEX ft_user_search (username, email);
ALTER TABLE projects ADD FULLTEXT INDEX ft_project_search (project_name);
ALTER TABLE generated_code ADD FULLTEXT INDEX ft_prompt_search (prompt_text);
ALTER TABLE templates ADD FULLTEXT INDEX ft_template_search (name, description);