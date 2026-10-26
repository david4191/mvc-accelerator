<?php
// api/core/Cors.php

class Cors {
    private static $allowedOrigins = [];
    
    public static function init() {
        // Get allowed origins from environment
        $originsEnv = $_ENV['CORS_ALLOWED_ORIGINS'] ?? getenv('CORS_ALLOWED_ORIGINS');
        
        if ($originsEnv && $originsEnv !== '*') {
            self::$allowedOrigins = array_map('trim', explode(',', $originsEnv));
        } else {
            // Default to your domain only
            self::$allowedOrigins = [
                'https://mvc-accelerator.technosphereinnovations.com',
                'http://localhost:3000',
                'http://localhost:3001'
            ];
        }
    }
    
    public static function handle() {
        self::init();
        
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        
        // Check if origin is allowed
        if (self::isOriginAllowed($origin)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
        } else {
            // If no allowed origin, don't set CORS headers
            if (!empty($origin)) {
                error_log("CORS: Blocked origin: $origin");
            }
        }
        
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-Requested-With');
        header('Access-Control-Max-Age: 3600');

        // Handle preflight requests
        if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
            http_response_code(200);
            exit(0);
        }
    }
    
    private static function isOriginAllowed($origin) {
        if (empty($origin)) {
            return false;
        }
        
        foreach (self::$allowedOrigins as $allowed) {
            if ($allowed === '*' && count(self::$allowedOrigins) === 1) {
                // Only allow wildcard if explicitly configured and only one
                return true;
            }
            if ($allowed === $origin) {
                return true;
            }
            // Check for subdomain wildcard (e.g., *.example.com)
            if (strpos($allowed, '*') === 0) {
                $domain = substr($allowed, 2);
                if (strpos($origin, $domain) !== false) {
                    return true;
                }
            }
        }
        return false;
    }
}