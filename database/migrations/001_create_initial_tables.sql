-- Migration 001: Initial database setup

-- Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS code_versions;
DROP TABLE IF EXISTS code_reviews;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS billing_history;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS user_activity;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS api_usage;
DROP TABLE IF EXISTS code_scans;
DROP TABLE IF EXISTS generated_code;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS users;

-- Create tables (see schema.sql for full definitions)
-- Include all CREATE TABLE statements from schema.sql

-- Insert default data
INSERT INTO templates (name, description, type, structure) VALUES
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