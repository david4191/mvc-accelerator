<?php
// api/models/Subscription.php

require_once __DIR__ . '/../core/Model.php';

class Subscription extends Model {
    protected $table = 'subscriptions';
    protected $primaryKey = 'id';
    
    /**
     * Get user subscriptions
     */
    public function getUserSubscriptions($userId) {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table} 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        ");
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get active subscription
     */
    public function getActive($userId) {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table} 
            WHERE user_id = ? 
                AND payment_status = 'completed' 
                AND (end_date IS NULL OR end_date > NOW())
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
    
    /**
     * Create subscription
     */
    public function create($data) {
        $sql = "INSERT INTO {$this->table} 
                (user_id, plan_type, start_date, end_date, payment_status, amount, transaction_id, auto_renew) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            $data['user_id'],
            $data['plan_type'],
            $data['start_date'] ?? date('Y-m-d H:i:s'),
            $data['end_date'],
            $data['payment_status'],
            $data['amount'],
            $data['transaction_id'] ?? null,
            $data['auto_renew'] ?? 0
        ]);
        
        return $this->db->lastInsertId();
    }
    
    /**
     * Update subscription status
     */
    public function updateStatus($id, $status, $transactionId = null) {
        $sql = "UPDATE {$this->table} SET payment_status = ?";
        $params = [$status];
        
        if ($transactionId) {
            $sql .= ", transaction_id = ?";
            $params[] = $transactionId;
        }
        
        $sql .= ", updated_at = NOW() WHERE id = ?";
        $params[] = $id;
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }
    
    /**
     * Cancel subscription
     */
    public function cancel($id) {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} 
            SET auto_renew = 0, updated_at = NOW() 
            WHERE id = ?
        ");
        return $stmt->execute([$id]);
    }
    
    /**
     * Get expiring subscriptions
     */
    public function getExpiring($days = 3) {
        $stmt = $this->db->prepare("
            SELECT s.*, u.email, u.username 
            FROM {$this->table} s
            JOIN users u ON s.user_id = u.id
            WHERE s.payment_status = 'completed' 
                AND s.auto_renew = 1
                AND s.end_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
        ");
        $stmt->execute([$days]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get expired subscriptions
     */
    public function getExpired() {
        $stmt = $this->db->prepare("
            SELECT s.*, u.email, u.username 
            FROM {$this->table} s
            JOIN users u ON s.user_id = u.id
            WHERE s.payment_status = 'completed' 
                AND s.end_date < NOW()
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }
    
    /**
     * Check if user has active subscription
     */
    public function hasActive($userId) {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count 
            FROM {$this->table} 
            WHERE user_id = ? 
                AND payment_status = 'completed' 
                AND (end_date IS NULL OR end_date > NOW())
        ");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        return $result['count'] > 0;
    }

    /**
     * Has the user ever completed a payment for the given plan type
     * (active or expired) - used to gate the Yearly plan behind Monthly.
     */
    public function hasCompletedPlan($userId, $planType) {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count
            FROM {$this->table}
            WHERE user_id = ? AND plan_type = ? AND payment_status = 'completed'
        ");
        $stmt->execute([$userId, $planType]);
        $result = $stmt->fetch();
        return $result['count'] > 0;
    }
    
    /**
     * Get subscription statistics
     */
    public function getStats() {
        $sql = "
            SELECT 
                plan_type,
                COUNT(*) as total,
                SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN end_date < NOW() THEN 1 ELSE 0 END) as expired,
                SUM(amount) as total_revenue
            FROM {$this->table} 
            WHERE payment_status = 'completed'
            GROUP BY plan_type
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll();
    }
    
    /**
     * Get revenue by period
     */
    public function getRevenueByPeriod($period = 'month') {
        $groupBy = $period === 'year' ? '%Y' : '%Y-%m';
        
        $stmt = $this->db->prepare("
            SELECT 
                DATE_FORMAT(created_at, ?) as period,
                COUNT(*) as subscriptions,
                SUM(amount) as revenue
            FROM {$this->table} 
            WHERE payment_status = 'completed'
            GROUP BY DATE_FORMAT(created_at, ?)
            ORDER BY period DESC
            LIMIT 12
        ");
        $stmt->execute([$groupBy, $groupBy]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get trial conversions
     */
    public function getTrialConversions() {
        $sql = "
            SELECT 
                COUNT(DISTINCT t.user_id) as trials,
                COUNT(DISTINCT s.user_id) as conversions,
                (COUNT(DISTINCT s.user_id) / COUNT(DISTINCT t.user_id)) * 100 as conversion_rate
            FROM {$this->table} t
            LEFT JOIN {$this->table} s 
                ON t.user_id = s.user_id 
                AND s.plan_type IN ('monthly', 'yearly') 
                AND s.payment_status = 'completed'
            WHERE t.plan_type = 'trial'
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetch();
    }
    
    /**
     * Extend subscription
     */
    public function extend($id, $months = 1) {
        $stmt = $this->db->prepare("
            UPDATE {$this->table} 
            SET end_date = DATE_ADD(end_date, INTERVAL ? MONTH),
                updated_at = NOW()
            WHERE id = ?
        ");
        return $stmt->execute([$months, $id]);
    }
    
    /**
     * Get subscription by transaction
     */
    public function findByTransaction($transactionId) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE transaction_id = ?");
        $stmt->execute([$transactionId]);
        return $stmt->fetch();
    }
}