<?php
// api/core/Security.php
class Security {
    private static $instance = null;
    private $encryptionKey;
    private $cipher = 'AES-256-GCM';
    
    private function __construct() {
        $this->encryptionKey = $_ENV['ENCRYPTION_KEY'];
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    // Input validation and sanitization
    public function sanitizeInput($data, $type = 'string') {
        if (is_array($data)) {
            return array_map([$this, 'sanitizeInput'], $data);
        }
        
        $data = trim($data);
        $data = stripslashes($data);
        
        switch ($type) {
            case 'email':
                return filter_var($data, FILTER_SANITIZE_EMAIL);
            case 'int':
                return filter_var($data, FILTER_SANITIZE_NUMBER_INT);
            case 'url':
                return filter_var($data, FILTER_SANITIZE_URL);
            default:
                return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
        }
    }
    
    // CSRF Protection
    public function generateCSRFToken() {
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }
    
    public function validateCSRFToken($token) {
        if (!isset($_SESSION['csrf_token']) || $token !== $_SESSION['csrf_token']) {
            throw new Exception('Invalid CSRF token');
        }
        return true;
    }
    
    // Encryption/Decryption
    public function encrypt($data) {
        $iv = random_bytes(openssl_cipher_iv_length($this->cipher));
        $tag = '';
        
        $encrypted = openssl_encrypt(
            $data,
            $this->cipher,
            $this->encryptionKey,
            0,
            $iv,
            $tag
        );
        
        return base64_encode($iv . $tag . $encrypted);
    }
    
    public function decrypt($encryptedData) {
        $data = base64_decode($encryptedData);
        $ivLength = openssl_cipher_iv_length($this->cipher);
        $tagLength = 16; // GCM tag length
        
        $iv = substr($data, 0, $ivLength);
        $tag = substr($data, $ivLength, $tagLength);
        $encrypted = substr($data, $ivLength + $tagLength);
        
        return openssl_decrypt(
            $encrypted,
            $this->cipher,
            $this->encryptionKey,
            0,
            $iv,
            $tag
        );
    }
    
    // Rate Limiting
    public function checkRateLimit($userId, $endpoint, $limit = 100, $timeWindow = 3600) {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT COUNT(*) as count 
            FROM api_usage 
            WHERE user_id = ? AND endpoint = ? 
            AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
        ");
        $stmt->execute([$userId, $endpoint, $timeWindow]);
        $result = $stmt->fetch();
        
        if ($result['count'] >= $limit) {
            throw new Exception('Rate limit exceeded. Try again later.');
        }

        return true;
    }

    // Non-throwing usage count, used where the caller needs to shape its own
    // limit-reached response instead of catching a generic exception.
    public function getRecentUsageCount($userId, $endpoint, $timeWindow = 86400) {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM api_usage
            WHERE user_id = ? AND endpoint = ?
            AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
        ");
        $stmt->execute([$userId, $endpoint, $timeWindow]);
        $result = $stmt->fetch();
        return (int) $result['count'];
    }

    // Guest (not logged in) usage tracking by IP, since api_usage requires a user_id.
    public function getGuestUsageCount($ipAddress, $timeWindow = 86400) {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM guest_usage
            WHERE ip_address = ?
            AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
        ");
        $stmt->execute([$ipAddress, $timeWindow]);
        $result = $stmt->fetch();
        return (int) $result['count'];
    }

    public function recordGuestUsage($ipAddress, $endpoint) {
        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO guest_usage (ip_address, endpoint, created_at) VALUES (?, ?, NOW())");
        $stmt->execute([$ipAddress, $endpoint]);
    }

    // SQL Injection Prevention
    public function preventSQLInjection($input) {
        return str_replace(['\'', '"', ';', '--', '#'], '', $input);
    }
    
    // XSS Prevention
    public function preventXSS($input) {
        return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    
    // File upload security
    public function validateFileUpload($file, $allowedTypes = ['php', 'html', 'js', 'css']) {
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        
        if (!in_array($extension, $allowedTypes)) {
            throw new Exception('File type not allowed');
        }
        
        if ($file['size'] > 10485760) { // 10MB
            throw new Exception('File too large');
        }
        
        return true;
    }
    
    // Generate secure API key
    public function generateApiKey() {
        return bin2hex(random_bytes(32));
    }
    
    // Validate JWT token (verifies signature before trusting any claim)
    public function validateJWT($token) {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                return false;
            }

            list($headerEncoded, $payloadEncoded, $signatureEncoded) = $parts;

            $jwtSecret = $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET');
            if (empty($jwtSecret)) {
                error_log("Security::validateJWT: JWT_SECRET not set in environment");
                return false;
            }

            $signature = $this->base64UrlDecode($signatureEncoded);
            $expectedSignature = hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, $jwtSecret, true);

            if (!hash_equals($expectedSignature, $signature)) {
                return false;
            }

            $payload = json_decode($this->base64UrlDecode($payloadEncoded), true);

            // Check expiration
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                return false;
            }

            return $payload;
        } catch (Exception $e) {
            return false;
        }
    }

    private function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}