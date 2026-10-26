<?php
// api/core/Controller.php

class Controller {
    
    public function __construct() {
        // You can add initialization here if needed
        error_log("Controller constructor called");
    }
    
    protected function trackApiUsage($userId, $endpoint, $referenceId = null) {
    if (empty($GLOBALS['db'])) {
        throw new Exception('Database connection is not available.');
    }
    $db = $GLOBALS['db'];
    $stmt = $db->prepare("
        INSERT INTO api_usage (user_id, endpoint, request_data, created_at)
        VALUES (?, ?, ?, NOW())
    ");
    $stmt->execute([
        $userId,
        $endpoint,
        json_encode(['reference_id' => $referenceId])
    ]);
}
    
    /**
     * Send JSON response
     */
    protected function json($data, $statusCode = 200) {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
    
    /**
     * Validate required fields
     */
    protected function validateRequired($data, $fields) {
        foreach ($fields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                throw new Exception("Field '$field' is required");
            }
        }
    }
    
    /**
     * Get current user ID from JWT
     */
   protected function getCurrentUserId() {
        // Check if user is set by AuthMiddleware
        if (isset($_REQUEST['user']) && isset($_REQUEST['user']['id'])) {
            return $_REQUEST['user']['id'];
        }
        
        // Try to get from token manually
        $token = $this->getBearerToken();
        if ($token) {
            $payload = $this->validateJWT($token);
            if ($payload && isset($payload['user_id'])) {
                return $payload['user_id'];
            }
        }
        
        throw new Exception('User not authenticated');
    }
    
   
    
    /**
     * Get bearer token from header
     */
    protected function getBearerToken() {
        $headers = getallheaders();
        
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
                return $matches[1];
            }
        }
        
        return null;
    }
    
    /**
     * Validate JWT token with signature verification
     */
    protected function validateJWT($token) {
        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            return false;
        }

        list($headerEncoded, $payloadEncoded, $signatureEncoded) = $parts;

        $jwtSecret = $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET');
        if (empty($jwtSecret)) {
            error_log("Controller::validateJWT: JWT_SECRET not set in environment");
            return false;
        }

        $payload = json_decode($this->base64UrlDecode($payloadEncoded), true);
        if (!$payload) {
            return false;
        }

        $expectedSignature = $this->base64UrlEncode(
            hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, $jwtSecret, true)
        );

        if (!hash_equals($expectedSignature, $signatureEncoded)) {
            return false;
        }

        if (isset($payload['exp']) && $payload['exp'] < time()) {
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
}

