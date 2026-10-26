<?php
// api/controllers/SubscriptionController.php

require_once __DIR__ . '/../core/Controller.php';
require_once __DIR__ . '/../models/Subscription.php';
require_once __DIR__ . '/../models/User.php';

class SubscriptionController extends Controller {
    private $subscriptionModel;

    // Prices in Naira. Paystack amounts are in kobo (NGN * 100).
    const PLAN_PRICES = [
        'monthly' => ['amount' => 5000, 'name' => 'Monthly Pro', 'months' => 1],
        'yearly' => ['amount' => 90000, 'name' => 'Yearly Pro', 'months' => 12],
    ];

    public function __construct() {
        $this->subscriptionModel = new Subscription();
    }

    /**
     * Resolve the current user id or send a clean 401 and stop - an expired
     * or missing token is not a server error, and mislabeling it as a 500
     * (as every method here used to) stops the frontend's existing
     * "401 -> clear session, redirect to login" handling from ever firing.
     */
    private function requireUserId() {
        try {
            return $this->getCurrentUserId();
        } catch (Throwable $e) {
            $this->json(['error' => 'Authentication required'], 401);
        }
    }

    /**
     * Get current subscription status
     * GET /api/subscription/status
     */
    public function status() {
        $userId = $this->requireUserId();
        try {
            $hasCompletedMonthly = $this->subscriptionModel->hasCompletedPlan($userId, 'monthly');

            $subscription = $this->subscriptionModel->getActive($userId);

            if ($subscription) {
                return $this->json([
                    'success' => true,
                    'status' => 'active',
                    'plan_type' => $subscription['plan_type'],
                    'end_date' => $subscription['end_date'],
                    'amount' => $subscription['amount'],
                    'hasCompletedMonthly' => $hasCompletedMonthly
                ]);
            }

            // Check if user has trial
            $db = $GLOBALS['db'];
            $stmt = $db->prepare("
                SELECT * FROM subscriptions
                WHERE user_id = ? AND plan_type = 'trial'
                ORDER BY created_at DESC LIMIT 1
            ");
            $stmt->execute([$userId]);
            $trial = $stmt->fetch();

            if ($trial && strtotime($trial['end_date']) > time()) {
                return $this->json([
                    'success' => true,
                    'status' => 'trial',
                    'plan_type' => 'trial',
                    'end_date' => $trial['end_date'],
                    'hasCompletedMonthly' => $hasCompletedMonthly
                ]);
            }

            return $this->json([
                'success' => true,
                'status' => 'inactive',
                'hasCompletedMonthly' => $hasCompletedMonthly
            ]);

        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Get current subscription details
     * GET /api/subscription/current
     */
    public function getCurrent() {
        $userId = $this->requireUserId();
        try {
            $subscription = $this->subscriptionModel->getActive($userId);
            
            if (!$subscription) {
                // Return default trial info
                $db = $GLOBALS['db'];
                $stmt = $db->prepare("
                    SELECT * FROM subscriptions 
                    WHERE user_id = ? AND plan_type = 'trial' 
                    ORDER BY created_at DESC LIMIT 1
                ");
                $stmt->execute([$userId]);
                $trial = $stmt->fetch();
                
                if ($trial) {
                    return $this->json([
                        'success' => true,
                        'plan_type' => 'trial',
                        'end_date' => $trial['end_date'],
                        'is_trial' => true
                    ]);
                }
                
                return $this->json([
                    'success' => true,
                    'plan_type' => null,
                    'is_trial' => false
                ]);
            }
            
            return $this->json([
                'success' => true,
                'plan_type' => $subscription['plan_type'],
                'end_date' => $subscription['end_date'],
                'amount' => $subscription['amount'],
                'is_trial' => false
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Cancel subscription
     * POST /api/subscription/cancel
     */
    public function cancel() {
        $userId = $this->requireUserId();
        try {
            $subscription = $this->subscriptionModel->getActive($userId);

            if (!$subscription) {
                return $this->json(['error' => 'No active subscription found'], 404);
            }
            
            $success = $this->subscriptionModel->cancel($subscription['id']);

            return $this->json([
                'success' => $success,
                'message' => $success ? 'Subscription cancelled successfully' : 'Failed to cancel subscription'
            ]);

        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Verify a Paystack payment and activate the subscription. The frontend
     * never sends card data here - Paystack's Inline.js collects and
     * tokenizes it client-side, and all we get back is a reference, which
     * we independently verify server-side with Paystack using the secret
     * key before trusting it for anything.
     * POST /api/subscription/verify
     */
    public function verifyPayment() {
        $userId = $this->requireUserId();
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $reference = $data['reference'] ?? '';
            $planId = $data['plan'] ?? '';

            if (empty($reference) || !isset(self::PLAN_PRICES[$planId])) {
                return $this->json(['error' => 'Invalid payment reference or plan'], 400);
            }

            if ($planId === 'yearly' && !$this->subscriptionModel->hasCompletedPlan($userId, 'monthly')) {
                return $this->json(['error' => 'Subscribe to the Monthly plan first to unlock Yearly.'], 403);
            }

            if ($this->subscriptionModel->findByTransaction($reference)) {
                return $this->json(['error' => 'This payment has already been processed.'], 409);
            }

            $secretKey = $_ENV['PAYSTACK_SECRET_KEY'] ?? getenv('PAYSTACK_SECRET_KEY');
            if (empty($secretKey)) {
                error_log('verifyPayment: PAYSTACK_SECRET_KEY not configured');
                return $this->json(['error' => 'Payment verification is not configured.'], 500);
            }

            $ch = curl_init('https://api.paystack.co/transaction/verify/' . rawurlencode($reference));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$secretKey}"]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            $caBundle = ini_get('curl.cainfo') ?: ini_get('openssl.cafile');
            if (empty($caBundle) || !is_readable($caBundle)) {
                foreach (['/etc/ssl/cert.pem', '/etc/ssl/certs/ca-certificates.crt'] as $fallback) {
                    if (is_readable($fallback)) {
                        curl_setopt($ch, CURLOPT_CAINFO, $fallback);
                        break;
                    }
                }
            }
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError) {
                error_log("verifyPayment: Paystack verify request failed: {$curlError}");
                return $this->json(['error' => 'Could not reach the payment provider. Try again.'], 502);
            }

            $result = json_decode($response, true);

            if ($httpCode !== 200 || empty($result['status']) || ($result['data']['status'] ?? '') !== 'success') {
                error_log('verifyPayment: Paystack verification did not succeed: ' . $response);
                return $this->json(['error' => 'Payment could not be verified.'], 400);
            }

            $expectedKobo = self::PLAN_PRICES[$planId]['amount'] * 100;
            $paidKobo = $result['data']['amount'] ?? 0;
            $currency = $result['data']['currency'] ?? '';

            if ($paidKobo < $expectedKobo || $currency !== 'NGN') {
                error_log("verifyPayment: amount/currency mismatch - paid {$paidKobo} {$currency}, expected {$expectedKobo} NGN for plan {$planId}");
                return $this->json(['error' => 'Payment amount does not match the selected plan.'], 400);
            }

            $months = self::PLAN_PRICES[$planId]['months'];
            $amount = self::PLAN_PRICES[$planId]['amount'];

            $subscriptionId = $this->subscriptionModel->create([
                'user_id' => $userId,
                'plan_type' => $planId,
                'start_date' => date('Y-m-d H:i:s'),
                'end_date' => date('Y-m-d H:i:s', strtotime("+{$months} months")),
                'payment_status' => 'completed',
                'amount' => $amount,
                'transaction_id' => $reference,
                'auto_renew' => 0
            ]);

            try {
                $db = $GLOBALS['db'];
                if (!empty($db)) {
                    $stmt = $db->prepare("
                        INSERT INTO billing_history (user_id, subscription_id, amount, currency, payment_method, transaction_id, status, created_at)
                        VALUES (?, ?, ?, 'NGN', 'paystack', ?, 'completed', NOW())
                    ");
                    $stmt->execute([$userId, $subscriptionId, $amount, $reference]);
                }
            } catch (Throwable $e) {
                error_log('verifyPayment: failed to record billing_history: ' . $e->getMessage());
            }

            $subscription = $this->subscriptionModel->find($subscriptionId);

            return $this->json([
                'success' => true,
                'subscription' => $subscription
            ]);

        } catch (Exception $e) {
            error_log('verifyPayment error: ' . $e->getMessage());
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/subscription/billing-history
     */
    public function billingHistory() {
        $userId = $this->requireUserId();
        try {
            $db = $GLOBALS['db'];

            if (empty($db)) {
                return $this->json(['success' => true, 'history' => []]);
            }

            $stmt = $db->prepare("
                SELECT amount, currency, payment_method, transaction_id, status, created_at
                FROM billing_history
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 50
            ");
            $stmt->execute([$userId]);

            return $this->json([
                'success' => true,
                'history' => $stmt->fetchAll()
            ]);
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Get available plans
     * GET /api/plans
     */
    public function getPlans() {
        $plans = [
            [
                'id' => 'trial',
                'name' => 'Free Trial',
                'price' => 0,
                'currency' => 'NGN',
                'period' => '48 hours',
                'features' => [
                    'Full access to all features',
                    'Unlimited code generation',
                    'Project scanning',
                    'Error fixing'
                ]
            ],
            [
                'id' => 'monthly',
                'name' => self::PLAN_PRICES['monthly']['name'],
                'price' => self::PLAN_PRICES['monthly']['amount'],
                'currency' => 'NGN',
                'period' => 'month',
                'features' => [
                    'Everything in Trial',
                    'Priority support',
                    'Advanced security scans',
                    'Team collaboration'
                ]
            ]
        ];

        // Yearly is hidden until the user has completed at least one Monthly
        // payment - a guest, or a user who's never gone Monthly, never sees it.
        $userId = $this->tryGetCurrentUserId();
        if ($userId !== null && $this->subscriptionModel->hasCompletedPlan($userId, 'monthly')) {
            $plans[] = [
                'id' => 'yearly',
                'name' => self::PLAN_PRICES['yearly']['name'],
                'price' => self::PLAN_PRICES['yearly']['amount'],
                'currency' => 'NGN',
                'period' => 'year',
                'features' => [
                    'Everything in Monthly',
                    'Save 2 months',
                    'Premium support',
                    'Custom integrations'
                ]
            ];
        }

        return $this->json([
            'success' => true,
            'plans' => $plans
        ]);
    }

    private function tryGetCurrentUserId() {
        try {
            return $this->getCurrentUserId();
        } catch (Throwable $e) {
            return null;
        }
    }
    
    
    /**
     * Check if user has active trial
     */
    public function checkTrialStatus($userId) {
        $db = $GLOBALS['db'];
        
        // Get the user's trial subscription
        $stmt = $db->prepare("
            SELECT * FROM subscriptions 
            WHERE user_id = ? AND plan_type = 'trial' 
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->execute([$userId]);
        $trial = $stmt->fetch();
        
        if (!$trial) {
            return [
                'has_trial' => false,
                'message' => 'No trial found'
            ];
        }
        
        $now = time();
        $trialEnd = strtotime($trial['end_date']);
        $hoursRemaining = round(($trialEnd - $now) / 3600, 1);
        
        return [
            'has_trial' => true,
            'is_active' => $trialEnd > $now,
            'hours_remaining' => max(0, $hoursRemaining),
            'end_date' => $trial['end_date'],
            'expired' => $trialEnd <= $now
        ];
    }
    
    /**
     * Check if user can access premium features
     */
    public function canAccess($userId) {
        // Check for active paid subscription
        $active = $this->subscriptionModel->getActive($userId);
        if ($active) {
            return [
                'can_access' => true,
                'type' => $active['plan_type'],
                'message' => 'Active subscription'
            ];
        }
        
        // Check trial status
        $trialStatus = $this->checkTrialStatus($userId);
        
        if ($trialStatus['has_trial'] && $trialStatus['is_active']) {
            return [
                'can_access' => true,
                'type' => 'trial',
                'hours_remaining' => $trialStatus['hours_remaining'],
                'message' => "Trial active with {$trialStatus['hours_remaining']} hours remaining"
            ];
        }
        
        if ($trialStatus['has_trial'] && $trialStatus['expired']) {
            return [
                'can_access' => false,
                'type' => 'trial_expired',
                'message' => 'Your 48-hour trial has expired. Please subscribe to continue.'
            ];
        }
        
        return [
            'can_access' => false,
            'type' => 'no_subscription',
            'message' => 'No active subscription found'
        ];
    }
    
    /**
 * Check if user can access premium features
 * GET /api/subscription/can-access
 */
public function canAccessEndpoint() {
    try {
        $userId = $this->getCurrentUserId();
        $access = $this->canAccess($userId);
        
        return $this->json([
            'success' => true,
            'data' => $access
        ]);
        
    } catch (Exception $e) {
        return $this->json(['error' => $e->getMessage()], 500);
    }
}

}