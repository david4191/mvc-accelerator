<?php
// api/core/Env.php

class Env {
    private static $loaded = false;
    private static $variables = [];
    
    /**
     * Load environment variables from .env file
     */
    public static function load($file = null) {
        if (self::$loaded) {
            return;
        }
        
        if (!$file) {
            $file = __DIR__ . '/../../.env';
        }
        
        if (!file_exists($file)) {
            error_log("Env file not found: " . $file);
            return;
        }
        
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            
            // Parse line
            if (strpos($line, '=') !== false) {
                list($name, $value) = explode('=', $line, 2);
                $name = trim($name);
                $value = trim($value);
                
                // Remove quotes if present
                if (strpos($value, '"') === 0 && strrpos($value, '"') === strlen($value) - 1) {
                    $value = substr($value, 1, -1);
                }
                if (strpos($value, "'") === 0 && strrpos($value, "'") === strlen($value) - 1) {
                    $value = substr($value, 1, -1);
                }
                
                self::$variables[$name] = $value;
                
                // Set environment variable
                putenv("$name=$value");
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
        
        self::$loaded = true;
        error_log("Env loaded successfully");
    }
    
    /**
     * Get environment variable
     */
    public static function get($key, $default = null) {
        if (!self::$loaded) {
            self::load();
        }
        
        // Check in $_ENV
        if (isset($_ENV[$key])) {
            return $_ENV[$key];
        }
        
        // Check in getenv
        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }
        
        // Check in our stored variables
        if (isset(self::$variables[$key])) {
            return self::$variables[$key];
        }
        
        return $default;
    }
}

// Auto-load on include
Env::load();