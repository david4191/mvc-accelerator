<?php
// api/core/Auth.php

class Auth {
    private static $instance = null;
    private $user = null;
    
    private function __construct() {}
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Authenticate user
     */
    public function authenticate($email, $password) {
        $db = Database::getInstance();
        
        $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password_hash'])) {
            $this->user = $user;
            $this->updateLastLogin($user['id']);
            return $user;
        }
        
        return false;
    }
    
    /**
     * Authenticate by API key
     */
    public function authenticateByApiKey($apiKey) {
        $db = Database::getInstance();
        
        $stmt = $db->prepare("SELECT * FROM users WHERE api_key = ? AND is_active = 1");
        $stmt->execute([$apiKey]);
        $user = $stmt->fetch();
        
        if ($user) {
            $this->user = $user;
            return $user;
        }
        
        return false;
    }
    
    /**
     * Get current user
     */
    public function user() {
        return $this->user;
    }
    
    /**
     * Check if user is authenticated
     */
    public function check() {
        return $this->user !== null;
    }
    
    /**
     * Check if user has active subscription
     */
    public function hasActiveSubscription() {
        if (!$this->check()) {
            return false;
        }
        
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT COUNT(*) as count 
            FROM subscriptions 
            WHERE user_id = ? 
                AND payment_status = 'completed' 
                AND (end_date IS NULL OR end_date > NOW())
        ");
        $stmt->execute([$this->user['id']]);
        $result = $stmt->fetch();
        
        return $result['count'] > 0;
    }
    
    /**
     * Get user permissions
     */
    public function permissions() {
        if (!$this->check()) {
            return [];
        }
        
        $permissions = [
            'can_generate' => $this->hasActiveSubscription(),
            'can_scan' => $this->hasActiveSubscription(),
            'can_fix' => $this->hasActiveSubscription()
        ];
        
        return $permissions;
    }
    
    /**
     * Update last login
     */
    private function updateLastLogin($userId) {
        $db = Database::getInstance();
        $stmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
        $stmt->execute([$userId]);
    }
    
    /**
     * Logout
     */
    public function logout() {
        $this->user = null;
    }
    
    /**
     * Generate password hash
     */
    public function hashPassword($password) {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => BCRYPT_ROUNDS]);
    }
    
    /**
     * Verify password
     */
    public function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }
    
    /**
     * Generate remember token
     */
    public function generateRememberToken() {
        return bin2hex(random_bytes(32));
    }
    
    /**
     * Check if email is verified
     */
    public function isEmailVerified() {
        if (!$this->check()) {
            return false;
        }
        
        return $this->user['email_verified_at'] !== null;
    }
    
    /**
     * Get user's subscription status
     */
    public function getSubscriptionStatus() {
        if (!$this->check()) {
            return null;
        }
        
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT plan_type, end_date 
            FROM subscriptions 
            WHERE user_id = ? 
                AND payment_status = 'completed' 
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute([$this->user['id']]);
        return $stmt->fetch();
    }
}