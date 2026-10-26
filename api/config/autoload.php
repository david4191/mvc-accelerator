<?php
// api/config/autoload.php

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Load environment variables from .env file
function loadEnv($path) {
    if (!file_exists($path)) {
        error_log("ERROR: .env file not found at: " . $path);
        return false;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
        // Parse line
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            // Remove quotes if present
            if (strpos($value, '"') === 0 || strpos($value, "'") === 0) {
                $value = substr($value, 1, -1);
            }
            
            // Set environment variables
            $_ENV[$key] = $value;
            putenv("$key=$value");
            
            // Also set in $_SERVER for compatibility
            $_SERVER[$key] = $value;
        }
    }
    
    return true;
}

// Load the .env file
$envPath = __DIR__ . '/../.env';
if (!loadEnv($envPath)) {
    error_log("WARNING: Could not load .env file from: " . $envPath);
}

// Debug: Log critical environment variables (without exposing secrets)
error_log("AUTOLOAD: APP_URL=" . ($_ENV['APP_URL'] ?? 'not set'));
error_log("AUTOLOAD: GOOGLE_CLIENT_ID " . (empty($_ENV['GOOGLE_CLIENT_ID']) ? 'NOT SET' : 'is set'));
error_log("AUTOLOAD: DB_NAME=" . ($_ENV['DB_NAME'] ?? 'not set'));

// Load constants
if (file_exists(__DIR__ . '/constants.php')) {
    require_once __DIR__ . '/constants.php';
} else {
    error_log("ERROR: constants.php not found");
}

// Simple autoloader for classes
spl_autoload_register(function ($class) {
    $directories = [
        __DIR__ . '/../controllers/',
        __DIR__ . '/../models/',
        __DIR__ . '/../core/',
        __DIR__ . '/../middleware/'
    ];
    
    foreach ($directories as $directory) {
        $file = $directory . $class . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

// Error reporting based on APP_DEBUG
$isDebug = (isset($_ENV['APP_DEBUG']) && $_ENV['APP_DEBUG'] === 'true') || 
           (defined('APP_DEBUG') && APP_DEBUG === true);

if ($isDebug) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
}

// Set timezone
$timezone = $_ENV['APP_TIMEZONE'] ?? (getenv('APP_TIMEZONE') ?: 'UTC');
if (defined('APP_TIMEZONE')) {
    $timezone = APP_TIMEZONE;
}
date_default_timezone_set($timezone);

// Session settings
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.use_strict_mode', 1);

// Set secure cookie if using HTTPS
if ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') || 
    (isset($_SERVER['REQUEST_SCHEME']) && $_SERVER['REQUEST_SCHEME'] === 'https')) {
    ini_set('session.cookie_secure', 1);
}

// Session lifetime
$sessionLifetime = (defined('SESSION_LIFETIME') ? SESSION_LIFETIME : 120) * 60;
ini_set('session.gc_maxlifetime', $sessionLifetime);
ini_set('session.cookie_lifetime', $sessionLifetime);

// Load helper functions
$helpersDir = __DIR__ . '/../helpers/';
if (file_exists($helpersDir . 'functions.php')) {
    require_once $helpersDir . 'functions.php';
}
if (file_exists($helpersDir . 'validation.php')) {
    require_once $helpersDir . 'validation.php';
}
if (file_exists($helpersDir . 'security_helper.php')) {
    require_once $helpersDir . 'security_helper.php';
}

// Replace the database connection section (around line 100) with:

// Initialize database connection
try {
    if (file_exists(__DIR__ . '/database.php')) {
        $dbConfig = require __DIR__ . '/database.php';
        
        // Try different connection methods
        $connectionMethods = [
            // Standard TCP connection
            [
                'dsn' => sprintf(
                    "mysql:host=%s;port=%s;dbname=%s;charset=%s",
                    $dbConfig['host'] ?? $_ENV['DB_HOST'] ?? 'localhost',
                    $dbConfig['port'] ?? $_ENV['DB_PORT'] ?? '3306',
                    $dbConfig['database'] ?? $_ENV['DB_DATABASE'] ?? '',
                    $dbConfig['charset'] ?? $_ENV['DB_CHARSET'] ?? 'utf8mb4'
                ),
                'desc' => 'TCP connection'
            ],
            // Try with 127.0.0.1
            [
                'dsn' => sprintf(
                    "mysql:host=%s;port=%s;dbname=%s;charset=%s",
                    '127.0.0.1',
                    $dbConfig['port'] ?? $_ENV['DB_PORT'] ?? '3306',
                    $dbConfig['database'] ?? $_ENV['DB_DATABASE'] ?? '',
                    $dbConfig['charset'] ?? $_ENV['DB_CHARSET'] ?? 'utf8mb4'
                ),
                'desc' => '127.0.0.1 connection'
            ],
            // Try without specifying host (uses local socket)
            [
                'dsn' => sprintf(
                    "mysql:dbname=%s;charset=%s;unix_socket=/var/lib/mysql/mysql.sock",
                    $dbConfig['database'] ?? $_ENV['DB_DATABASE'] ?? '',
                    $dbConfig['charset'] ?? $_ENV['DB_CHARSET'] ?? 'utf8mb4'
                ),
                'desc' => 'Socket connection'
            ]
        ];
        
        $username = $dbConfig['username'] ?? $_ENV['DB_USERNAME'] ?? '';
        $password = $dbConfig['password'] ?? $_ENV['DB_PASSWORD'] ?? '';
        $options = $dbConfig['options'] ?? [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => false
        ];
        
        $connected = false;
        $lastError = '';
        
        foreach ($connectionMethods as $method) {
            try {
                $pdo = new PDO($method['dsn'], $username, $password, $options);
                $connected = true;
                error_log("Database connected using: " . $method['desc']);
                break;
            } catch (PDOException $e) {
                $lastError = $e->getMessage();
                error_log("Failed " . $method['desc'] . ": " . $e->getMessage());
                continue;
            }
        }
        
        if ($connected) {
            $GLOBALS['db'] = $pdo;
            error_log("Database connection successful");
        } else {
            error_log("All database connection methods failed. Last error: " . $lastError);
            $GLOBALS['db'] = null;
        }
    } else {
        error_log("database.php not found");
        $GLOBALS['db'] = null;
    }
} catch (Exception $e) {
    error_log("Unexpected database error: " . $e->getMessage());
    $GLOBALS['db'] = null;
}

// Log startup completion
error_log("Autoloader completed successfully");