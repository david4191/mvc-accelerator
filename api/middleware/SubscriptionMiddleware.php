<?php
// api/middleware/SubscriptionMiddleware.php

class SubscriptionMiddleware {
    
    public function handle() {
        $user = $_REQUEST['user'] ?? null;
        
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'User not authenticated']);
            exit;
        }
        
        $db = Database::getInstance();
        
        // Check if user has active subscription
        $stmt = $db->prepare("
            SELECT COUNT(*) as count 
            FROM subscriptions 
            WHERE user_id = ? 
                AND payment_status = 'completed' 
                AND (end_date IS NULL OR end_date > NOW())
        ");
        $stmt->execute([$user['id']]);
        $result = $stmt->fetch();
        
        if ($result['count'] == 0) {
            http_response_code(403);
            echo json_encode([
                'error' => 'Active subscription required',
                'code' => 'SUBSCRIPTION_REQUIRED',
                'message' => 'Please subscribe to access this feature'
            ]);
            exit;
        }
        
        // Check rate limits based on subscription tier
        $this->checkRateLimit($user['id']);
    }
    
    private function checkRateLimit($userId) {
        $db = Database::getInstance();
        
        // Get subscription tier
        $stmt = $db->prepare("
            SELECT plan_type 
            FROM subscriptions 
            WHERE user_id = ? 
                AND payment_status = 'completed' 
                AND (end_date IS NULL OR end_date > NOW())
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        $subscription = $stmt->fetch();
        
        // Set rate limits based on tier
        $limits = [
            'trial' => 50,
            'monthly' => 500,
            'yearly' => 1000
        ];
        
        $limit = $limits[$subscription['plan_type']] ?? 50;
        
        // Check usage in last hour
        $stmt = $db->prepare("
            SELECT COUNT(*) as count 
            FROM api_usage 
            WHERE user_id = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ");
        $stmt->execute([$userId]);
        $usage = $stmt->fetch();
        
        if ($usage['count'] >= $limit) {
            http_response_code(429);
            echo json_encode([
                'error' => 'Rate limit exceeded',
                'limit' => $limit,
                'reset' => '1 hour'
            ]);
            exit;
        }
    }
}