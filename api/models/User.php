<?php
// api/models/User.php

require_once __DIR__ . '/../core/Model.php';

class User extends Model {
    protected $table = 'users';
    protected $primaryKey = 'id';
    
    /**
     * Find user by email
     */
    public function findByEmail($email) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        return $stmt->fetch();
    }
    
    /**
     * Find user by username
     */
    public function findByUsername($username) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE username = ? AND is_active = 1");
        $stmt->execute([$username]);
        return $stmt->fetch();
    }
    
    /**
     * Find user by API key
     */
    public function findByApiKey($apiKey) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE api_key = ? AND is_active = 1");
        $stmt->execute([$apiKey]);
        return $stmt->fetch();
    }
    
    /**
     * Create new user
     */
    public function create($data) {
        $sql = "INSERT INTO {$this->table}
                (username, fullname, email, password_hash, api_key, created_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            $data['username'],
            $data['fullname'] ?? null,
            $data['email'],
            $data['password_hash'],
            $data['api_key'],
            $data['created_at'],
            $data['is_active']
        ]);

        return $this->db->lastInsertId();
    }
    
    /**
     * Update last login
     */
    public function updateLastLogin($userId) {
        $stmt = $this->db->prepare("UPDATE {$this->table} SET last_login = NOW() WHERE id = ?");
        $stmt->execute([$userId]);
    }
    
    /**
     * Save password reset token
     */
    public function saveResetToken($userId, $token, $expires) {
        // Delete old tokens
        $stmt = $this->db->prepare("DELETE FROM password_resets WHERE user_id = ?");
        $stmt->execute([$userId]);
        
        // Insert new token
        $stmt = $this->db->prepare("
            INSERT INTO password_resets (user_id, token, expires_at) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$userId, $token, $expires]);
    }
    
    /**
     * Validate reset token
     */
    public function validateResetToken($token) {
        $stmt = $this->db->prepare("
            SELECT * FROM password_resets 
            WHERE token = ? AND expires_at > NOW() 
            AND used = 0
        ");
        $stmt->execute([$token]);
        return $stmt->fetch();
    }
    
    /**
     * Update password
     */
    public function updatePassword($userId, $hashedPassword) {
        $stmt = $this->db->prepare("UPDATE {$this->table} SET password_hash = ? WHERE id = ?");
        $stmt->execute([$hashedPassword, $userId]);
    }
    
    /**
     * Delete reset token
     */
    public function deleteResetToken($token) {
        $stmt = $this->db->prepare("DELETE FROM password_resets WHERE token = ?");
        $stmt->execute([$token]);
    }
    
    /**
     * Verify email
     */
    public function verifyEmail($token) {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} 
            SET email_verified_at = NOW() 
            WHERE verification_token = ? 
            AND email_verified_at IS NULL
        ");
        $stmt->execute([$token]);
        return $stmt->rowCount() > 0;
    }
    
    /**
     * Generate email verification token
     */
    public function generateVerificationToken($userId) {
        $token = bin2hex(random_bytes(32));
        $stmt = $this->db->prepare("
            UPDATE {$this->table} 
            SET verification_token = ? 
            WHERE id = ?
        ");
        $stmt->execute([$token, $userId]);
        return $token;
    }
    
    /**
     * Get user with subscription
     */
    public function getUserWithSubscription($userId) {
        $sql = "
            SELECT u.*, s.plan_type, s.end_date as subscription_end 
            FROM {$this->table} u
            LEFT JOIN subscriptions s ON u.id = s.user_id 
                AND s.payment_status = 'completed' 
                AND (s.end_date IS NULL OR s.end_date > NOW())
            WHERE u.id = ?
            ORDER BY s.created_at DESC
            LIMIT 1
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
    
    /**
     * Deactivate user
     */
    public function deactivate($userId) {
        $stmt = $this->db->prepare("UPDATE {$this->table} SET is_active = 0 WHERE id = ?");
        $stmt->execute([$userId]);
    }
    
    /**
     * Reactivate user
     */
    public function reactivate($userId) {
        $stmt = $this->db->prepare("UPDATE {$this->table} SET is_active = 1 WHERE id = ?");
        $stmt->execute([$userId]);
    }
    
    /**
     * Get user statistics
     */
    public function getUserStats($userId) {
        $sql = "
            SELECT 
                COUNT(DISTINCT p.id) as total_projects,
                COUNT(DISTINCT gc.id) as total_generations,
                COUNT(DISTINCT cs.id) as total_scans,
                MAX(gc.created_at) as last_generation
            FROM {$this->table} u
            LEFT JOIN projects p ON u.id = p.user_id
            LEFT JOIN generated_code gc ON u.id = gc.user_id
            LEFT JOIN code_scans cs ON u.id = cs.user_id
            WHERE u.id = ?
            GROUP BY u.id
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
    
   
public function createFromGoogle($data) {
    $sql = "INSERT INTO {$this->table} 
            (username, fullname, email, password_hash, api_key, google_id, avatar, created_at, is_active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $this->db->prepare($sql);
    $stmt->execute([
        $data['username'],
        $data['fullname'],
        $data['email'],
        $data['password_hash'],
        $data['api_key'],
        $data['google_id'],
        $data['avatar'],
        $data['created_at'],
        $data['is_active']
    ]);
    
    return $this->db->lastInsertId();
}
 



/**
 * Find user by Google ID
 */
public function findByGoogleId($googleId) {
    $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE google_id = ? AND is_active = 1");
    $stmt->execute([$googleId]);
    return $stmt->fetch();
}

/**
 * Update user with Google data
 */
public function updateGoogleData($userId, $googleId, $avatar) {
    $stmt = $this->db->prepare("
        UPDATE {$this->table} 
        SET google_id = ?, avatar = ?, updated_at = NOW() 
        WHERE id = ?
    ");
    return $stmt->execute([$googleId, $avatar, $userId]);
}

}















