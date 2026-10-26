<?php
// api/middleware/AuthMiddleware.php

require_once __DIR__ . '/../core/Database.php';

class AuthMiddleware {
    private static $jwtSecret;
    
    public function __construct() {
        self::$jwtSecret = $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET');
        if (empty(self::$jwtSecret)) {
            error_log("CRITICAL: JWT_SECRET not set in environment");
        }
    }
    
    public function handle() {
        $token = $this->getBearerToken();
        
        if (!$token) {
            $this->sendUnauthorized('Authentication required');
            return false;
        }
        
        // Validate JWT with signature verification
        $payload = $this->validateJWT($token);
        
        if (!$payload) {
            $this->sendUnauthorized('Invalid or expired token');
            return false;
        }
        
        // Check if user exists in database
        $db = Database::getInstance()->getConnection();
        
        if (!$db) {
            error_log("AuthMiddleware: Database connection failed");
            $this->sendUnauthorized('Database connection error');
            return false;
        }
        
        try {
            $stmt = $db->prepare("SELECT id, username, email, api_key, is_active FROM users WHERE id = ? AND is_active = 1");
            $stmt->execute([$payload['user_id']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                error_log("AuthMiddleware: User not found for ID: " . $payload['user_id']);
                $this->sendUnauthorized('User not found');
                return false;
            }
            
            // Store user in request
            $_REQUEST['user'] = $user;
            return true;
            
        } catch (PDOException $e) {
            error_log("AuthMiddleware: Database error - " . $e->getMessage());
            $this->sendUnauthorized('Database error');
            return false;
        }
    }
    
    private function getBearerToken() {
        $headers = getallheaders();
        
        // Check multiple header variations
        $authHeaders = ['Authorization', 'authorization', 'HTTP_AUTHORIZATION'];
        
        foreach ($authHeaders as $header) {
            if (isset($headers[$header])) {
                if (preg_match('/Bearer\s(\S+)/', $headers[$header], $matches)) {
                    return $matches[1];
                }
            }
        }
        
        // Also check in $_SERVER
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            if (preg_match('/Bearer\s(\S+)/', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
                return $matches[1];
            }
        }
        
        return null;
    }
    
    /**
     * Validate JWT with signature verification
     */
    private function validateJWT($token) {
        $parts = explode('.', $token);
        
        if (count($parts) !== 3) {
            error_log("AuthMiddleware: Invalid token format - expected 3 parts, got " . count($parts));
            return false;
        }
        
        list($headerEncoded, $payloadEncoded, $signatureEncoded) = $parts;
        
        // Decode header and payload
        $header = json_decode($this->base64UrlDecode($headerEncoded), true);
        $payload = json_decode($this->base64UrlDecode($payloadEncoded), true);
        
        if (!$header || !$payload) {
            error_log("AuthMiddleware: Failed to decode header or payload");
            return false;
        }
        
        // Verify signature
        $expectedSignature = $this->base64UrlEncode(
            hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, self::$jwtSecret, true)
        );
        
        if (!hash_equals($expectedSignature, $signatureEncoded)) {
            error_log("AuthMiddleware: Invalid signature");
            return false;
        }
        
        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            error_log("AuthMiddleware: Token expired");
            return false;
        }
        
        // Verify user_id exists
        if (!isset($payload['user_id'])) {
            error_log("AuthMiddleware: No user_id in token");
            return false;
        }
        
        return $payload;
    }
    
    private function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }
    
    private function sendUnauthorized($message) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => $message]);
        exit;
    }
}