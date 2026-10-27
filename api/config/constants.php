<?php
// api/config/constants.php

// Application Constants
define('APP_NAME', getenv('APP_NAME') ?: 'PHP MVC Accelerator');
define('APP_VERSION', '1.0.0');
define('APP_ENV', getenv('APP_ENV') ?: 'production');
define('APP_DEBUG', filter_var(getenv('APP_DEBUG'), FILTER_VALIDATE_BOOLEAN) ?: false);
define('APP_URL', getenv('APP_URL') ?: 'http://localhost');
define('APP_TIMEZONE', getenv('APP_TIMEZONE') ?: 'UTC');

// JWT Constants
// This JWT_SECRET constant is intentionally left unset-safe (empty, not a
// known hardcoded value) - nothing in this codebase actually signs/verifies
// with it (every real JWT call site reads JWT_SECRET from the environment
// directly), but a hardcoded fallback sitting here is still a live risk if
// anything starts relying on it later.
define('JWT_SECRET', getenv('JWT_SECRET') ?: '');
// Session length: a user must log in again every 6 hours. Still overridable
// via JWT_TTL.
define('JWT_EXPIRY', (int)(getenv('JWT_TTL') ?: 21600));
define('JWT_REFRESH_EXPIRY', (int)(getenv('JWT_REFRESH_TTL') ?: 604800));

// API Constants
define('API_RATE_LIMIT', (int)(getenv('RATE_LIMIT_REQUESTS') ?: 100));
define('API_RATE_WINDOW', (int)(getenv('RATE_LIMIT_WINDOW') ?: 3600));
define('DEFAULT_PAGE_SIZE', 20);
define('MAX_PAGE_SIZE', 100);

// Session Constants
define('SESSION_LIFETIME', (int)(getenv('SESSION_LIFETIME') ?: 120));
define('PASSWORD_RESET_EXPIRY', (int)(getenv('PASSWORD_RESET_TTL') ?: 3600));

// Bcrypt Constants
define('BCRYPT_ROUNDS', (int)(getenv('BCRYPT_ROUNDS') ?: 12));

// Path Constants
define('STORAGE_PATH', getenv('STORAGE_PATH') ?: __DIR__ . '/../../storage');
define('LOG_PATH', STORAGE_PATH . '/logs');