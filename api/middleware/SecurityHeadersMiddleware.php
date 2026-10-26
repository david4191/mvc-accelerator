<?php
// api/middleware/SecurityHeadersMiddleware.php

class SecurityHeadersMiddleware {
    
    public function handle() {
        // Content Security Policy
        $csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://code.jquery.com",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
            "img-src 'self' data: https://*.googleusercontent.com",
            "connect-src 'self' https://api.deepseek.com https://mvc-accelerator.technosphereinnovations.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ];
        
        header("Content-Security-Policy: " . implode('; ', $csp));
        
        // Additional security headers
        header("X-Frame-Options: DENY");
        header("X-Content-Type-Options: nosniff");
        header("X-XSS-Protection: 1; mode=block");
        header("Referrer-Policy: strict-origin-when-cross-origin");
        header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
        
        // Strict Transport Security (HSTS) - only in production
        if ($_ENV['APP_ENV'] === 'production') {
            header("Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");
        }
    }
}