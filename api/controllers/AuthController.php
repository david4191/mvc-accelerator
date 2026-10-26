<?php
// api/controllers/AuthController.php

require_once __DIR__ . '/../core/Controller.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../core/Security.php';

class AuthController extends Controller {
    private $userModel;
    private $security;
    private const TRIAL_HOURS = 48;
    private const MAX_LOGIN_ATTEMPTS = 5;
    private const LOCKOUT_TIME = 900; // 15 minutes in seconds
    
    public function __construct() {
        $this->userModel = new User();
        $this->security = Security::getInstance();
    }
    
    
    /**
     * Register a new user with enhanced security
     * POST /api/register
     */
    public function register() {
        try {
            // Add rate limiting
            $ip = $this->getClientIp();
            if (!$this->checkRateLimit('register', $ip, 5, 3600)) {
                return $this->json(['error' => 'Too many registration attempts. Please try again later.'], 429);
            }
            
            // Get POST data
            $data = json_decode(file_get_contents('php://input'), true);
            
            // Log received data for debugging
            error_log("Registration attempt for email: " . ($data['email'] ?? 'not provided'));
            
            // Validate required fields
            if (!isset($data['username']) || !isset($data['email']) || !isset($data['password'])) {
                return $this->json(['error' => 'Missing required fields'], 400);
            }
            
            // Validate username
            if (!preg_match('/^[a-zA-Z0-9_]{3,50}$/', $data['username'])) {
                return $this->json(['error' => 'Username must be 3-50 characters and contain only letters, numbers, and underscores'], 400);
            }
            
            // Sanitize input
            $username = $this->security->sanitizeInput($data['username']);
            $fullname = isset($data['fullname']) ? $this->security->sanitizeInput($data['fullname']) : null;
            $email = $this->security->sanitizeInput($data['email'], 'email');
            $password = $data['password'];
            
            // Validate email format
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return $this->json(['error' => 'Invalid email format'], 400);
            }
            
            // Validate password strength
            $passwordValidation = $this->validatePassword($password);
            if ($passwordValidation !== true) {
                return $this->json(['error' => $passwordValidation], 400);
            }
            
            // Check if user exists (using prepared statements)
            $existingUser = $this->userModel->findByEmail($email);
            if ($existingUser) {
                // Don't reveal if email exists - generic error
                return $this->json(['error' => 'Registration failed. Please try again.'], 400);
            }
            
            $existingUsername = $this->userModel->findByUsername($username);
            if ($existingUsername) {
                return $this->json(['error' => 'Username already taken'], 409);
            }
            
            // Hash password with secure cost
            $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => BCRYPT_ROUNDS]);
            
            // Generate secure API key
            $apiKey = bin2hex(random_bytes(32));
            
            // Create user
            $userId = $this->userModel->create([
                'username' => $username,
                'fullname' => $fullname,
                'email' => $email,
                'password_hash' => $hashedPassword,
                'api_key' => $apiKey,
                'created_at' => date('Y-m-d H:i:s'),
                'is_active' => 1
            ]);
            
            if (!$userId) {
                error_log("Failed to create user in database");
                return $this->json(['error' => 'Failed to create user. Please try again.'], 500);
            }
            
            error_log("User created successfully with ID: " . $userId);
            
            // Create trial subscription
            try {
                $this->createTrialSubscription($userId);
                error_log("Trial subscription created for user: " . $userId);
            } catch (Exception $subError) {
                // Log but don't fail registration
                error_log("Trial subscription creation failed: " . $subError->getMessage());
            }
            
            // Generate secure JWT token
            $token = $this->generateSecureJWT($userId);
            
            // Get user data to return
            $user = $this->userModel->find($userId);
            
            // Clear rate limit
            $this->clearRateLimit('register', $ip);
            
            return $this->json([
                'success' => true,
                'message' => 'Registration successful',
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'fullname' => $user['fullname'],
                    'email' => $user['email'],
                    'api_key' => $user['api_key']
                ]
            ], 201);
            
        } catch (Exception $e) {
            error_log("Registration error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            
            return $this->json([
                'error' => 'Registration failed. Please try again.'
            ], 500);
        }
    }
    
    /**
     * Login user with enhanced security
     * POST /api/login
     */
    public function login() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($data['email']) || !isset($data['password'])) {
                return $this->json(['error' => 'Email and password required'], 400);
            }
            
            $email = $this->security->sanitizeInput($data['email'], 'email');
            $password = $data['password'];
            $ip = $this->getClientIp();
            
            // Check rate limiting
            if (!$this->checkRateLimit('login', $email . ':' . $ip, self::MAX_LOGIN_ATTEMPTS, self::LOCKOUT_TIME)) {
                return $this->json(['error' => 'Too many login attempts. Please try again later.'], 429);
            }
            
            // Find user with prepared statement
            $user = $this->userModel->findByEmail($email);
            
            if (!$user) {
                // Increment attempt count
                $this->incrementLoginAttempts($email, $ip);
                return $this->json(['error' => 'Invalid credentials'], 401);
            }
            
            // Verify password with timing-safe comparison
            if (!password_verify($password, $user['password_hash'])) {
                $this->incrementLoginAttempts($email, $ip);
                return $this->json(['error' => 'Invalid credentials'], 401);
            }
            
            // Check if user is active
            if (!$user['is_active']) {
                return $this->json(['error' => 'Account is deactivated. Please contact support.'], 403);
            }
            
            // Clear login attempts on success
            $this->clearLoginAttempts($email, $ip);
            
            // Update last login
            $this->userModel->updateLastLogin($user['id']);
            
            // Generate new JWT
            $token = $this->generateSecureJWT($user['id']);
            
            error_log("Login successful for user: " . $email);
            
            return $this->json([
                'success' => true,
                'message' => 'Login successful',
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'fullname' => $user['fullname'],
                    'email' => $user['email'],
                    'api_key' => $user['api_key']
                ]
            ]);

        } catch (Exception $e) {
            error_log("Login error: " . $e->getMessage());
            return $this->json(['error' => 'Login failed. Please try again.'], 500);
        }
    }
    /**
     * Logout user
     * POST /api/logout
     */
    public function logout() {
        try {
            $token = $this->getBearerToken();
            
            if ($token) {
                // Invalidate token (add to blacklist)
                $this->invalidateToken($token);
            }
            
            return $this->json([
                'success' => true,
                'message' => 'Logout successful'
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
     /**
     * Generate secure JWT with proper signature
     */
    private function generateSecureJWT($userId) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $headerEncoded = $this->base64UrlEncode($header);
        
        $payload = json_encode([
            'user_id' => $userId,
            'iat' => time(),
            'exp' => time() + JWT_EXPIRY,
            'iss' => $_ENV['APP_URL'] ?? 'https://mvc-accelerator.technosphereinnovations.com',
            'jti' => bin2hex(random_bytes(16)) // Unique token ID
        ]);
        $payloadEncoded = $this->base64UrlEncode($payload);
        
        $secret = $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET');
        if (empty($secret)) {
            error_log("CRITICAL: JWT_SECRET not set in environment");
            throw new Exception('Server is not configured correctly. Please contact support.');
        }
        
        $signature = hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, $secret, true);
        $signatureEncoded = $this->base64UrlEncode($signature);
        
        return $headerEncoded . '.' . $payloadEncoded . '.' . $signatureEncoded;
    }
    
     
    private function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    /**
     * Rate limiting helper
     */
    private function checkRateLimit($action, $key, $maxAttempts, $windowSeconds) {
        $cacheKey = 'rate_limit_' . $action . '_' . md5($key);
        
        // For production, use Redis or database
        // For now, using simple file-based cache
        $data = $this->getRateLimitData($cacheKey);
        
        if (!$data) {
            $data = ['attempts' => 0, 'first_attempt' => time()];
        }
        
        // Reset if window expired
        if (time() - $data['first_attempt'] > $windowSeconds) {
            $data = ['attempts' => 0, 'first_attempt' => time()];
        }
        
        if ($data['attempts'] >= $maxAttempts) {
            return false;
        }
        
        $data['attempts']++;
        $this->saveRateLimitData($cacheKey, $data, $windowSeconds);
        
        return true;
    }

    
    /**
     * Refresh token
     * POST /api/refresh-token
     */
    public function refreshToken() {
        try {
            $token = $this->getBearerToken();
            
            if (!$token) {
                return $this->json(['error' => 'No token provided'], 401);
            }
            
            $payload = $this->validateJWT($token);
            
            if (!$payload) {
                return $this->json(['error' => 'Invalid token'], 401);
            }
            
            // Generate new token
            $newToken = $this->generateJWT($payload['user_id']);
            
            return $this->json([
                'success' => true,
                'token' => $newToken
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Request password reset
     * POST /api/forgot-password
     */
    public function forgotPassword() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            $this->validateRequired($data, ['email']);
            
            $email = $this->security->sanitizeInput($data['email'], 'email');
            
            $user = $this->userModel->findByEmail($email);
            
            if ($user) {
                // Generate reset token
                $resetToken = bin2hex(random_bytes(32));
                $expires = date('Y-m-d H:i:s', strtotime('+' . PASSWORD_RESET_EXPIRY . ' seconds'));
                
                // Save token to database
                $this->userModel->saveResetToken($user['id'], $resetToken, $expires);
                
                // Send reset email
                $this->sendPasswordResetEmail($email, $resetToken);
            }
            
            // Always return success to prevent email enumeration
            return $this->json([
                'success' => true,
                'message' => 'If the email exists, a reset link has been sent'
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Reset password
     * POST /api/reset-password
     */
    public function resetPassword() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            $this->validateRequired($data, ['token', 'password', 'confirm_password']);
            
            if ($data['password'] !== $data['confirm_password']) {
                return $this->json(['error' => 'Passwords do not match'], 400);
            }
            
            // Validate token
            $resetData = $this->userModel->validateResetToken($data['token']);
            
            if (!$resetData) {
                return $this->json(['error' => 'Invalid or expired token'], 400);
            }
            
            // Validate password strength
            $passwordValidation = $this->validatePassword($data['password']);
            if ($passwordValidation !== true) {
                return $this->json(['error' => $passwordValidation], 400);
            }
            
            // Hash new password
            $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => BCRYPT_ROUNDS]);
            
            // Update password
            $this->userModel->updatePassword($resetData['user_id'], $hashedPassword);
            
            // Delete used token
            $this->userModel->deleteResetToken($data['token']);
            
            return $this->json([
                'success' => true,
                'message' => 'Password reset successful'
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Verify email
     * GET /api/verify-email
     */
    public function verifyEmail() {
        try {
            $token = $_GET['token'] ?? '';
            
            if (!$token) {
                return $this->json(['error' => 'No token provided'], 400);
            }
            
            $result = $this->userModel->verifyEmail($token);
            
            if (!$result) {
                return $this->json(['error' => 'Invalid or expired token'], 400);
            }
            
            return $this->json([
                'success' => true,
                'message' => 'Email verified successfully'
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    
     
    private function incrementLoginAttempts($email, $ip) {
        $key = 'login_attempts_' . md5($email . ':' . $ip);
        $this->incrementRateLimit($key, self::MAX_LOGIN_ATTEMPTS, self::LOCKOUT_TIME);
    }
    
    private function clearLoginAttempts($email, $ip) {
        $key = 'login_attempts_' . md5($email . ':' . $ip);
        $this->clearRateLimit($key);
    }
    
    private function getRateLimitData($key) {
        // Use file-based cache (replace with Redis in production)
        $cacheDir = STORAGE_PATH . '/cache/';
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        
        $file = $cacheDir . $key . '.json';
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            if ($data && $data['expires'] > time()) {
                return $data;
            }
        }
        return null;
    }
    
    private function saveRateLimitData($key, $data, $ttl) {
        $cacheDir = STORAGE_PATH . '/cache/';
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        
        $data['expires'] = time() + $ttl;
        file_put_contents($cacheDir . $key . '.json', json_encode($data));
    }
    
    private function incrementRateLimit($key, $max, $window) {
        $data = $this->getRateLimitData($key);
        if (!$data) {
            $data = ['attempts' => 1, 'first_attempt' => time()];
        } else {
            if (time() - $data['first_attempt'] > $window) {
                $data = ['attempts' => 1, 'first_attempt' => time()];
            } else {
                $data['attempts']++;
            }
        }
        $this->saveRateLimitData($key, $data, $window);
    }
    
    private function clearRateLimit($key) {
        $cacheDir = STORAGE_PATH . '/cache/';
        $file = $cacheDir . $key . '.json';
        if (file_exists($file)) {
            unlink($file);
        }
    }
    
    private function getClientIp() {
        $ip = $_SERVER['HTTP_CLIENT_IP'] ?? '';
        $ip = $ip ?: ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
        $ip = $ip ?: ($_SERVER['HTTP_X_FORWARDED'] ?? '');
        $ip = $ip ?: ($_SERVER['HTTP_FORWARDED_FOR'] ?? '');
        $ip = $ip ?: ($_SERVER['HTTP_FORWARDED'] ?? '');
        $ip = $ip ?: ($_SERVER['REMOTE_ADDR'] ?? '');
        
        // Handle multiple IPs in X-Forwarded-For
        if (strpos($ip, ',') !== false) {
            $ips = explode(',', $ip);
            $ip = trim($ips[0]);
        }
        
        return $ip;
    }
    
    private function validatePassword($password) {
        if (strlen($password) < 8) {
            return 'Password must be at least 8 characters long';
        }
        
        if (!preg_match('/[A-Z]/', $password)) {
            return 'Password must contain at least one uppercase letter';
        }
        
        if (!preg_match('/[a-z]/', $password)) {
            return 'Password must contain at least one lowercase letter';
        }
        
        if (!preg_match('/[0-9]/', $password)) {
            return 'Password must contain at least one number';
        }
        
        if (!preg_match('/[^a-zA-Z0-9]/', $password)) {
            return 'Password must contain at least one special character';
        }
        
        // Check against common passwords
        $commonPasswords = [
            'password123', 'admin123', 'qwerty123', '12345678', 
            'password', '123456789', 'admin', 'letmein'
        ];
        
        if (in_array(strtolower($password), $commonPasswords)) {
            return 'Password is too common. Please choose a stronger password.';
        }
        
        return true;
    }
    
  
  /**
 * Create trial subscription
 */
private function createTrialSubscription($userId) {
    // Check if database connection exists
    if (!isset($GLOBALS['db']) || !$GLOBALS['db']) {
        error_log("Cannot create trial subscription: Database not available");
        return;
    }
    
    try {
        $db = $GLOBALS['db'];
        
        // Use defined constant or default value
        $trialHours = defined('TRIAL_HOURS') ? TRIAL_HOURS : 48;
        
        // Also check if it's defined as a class constant
        if (defined('self::TRIAL_HOURS')) {
            $trialHours = self::TRIAL_HOURS;
        }
        
        // Check if subscriptions table exists
        $stmt = $db->prepare("
            INSERT INTO subscriptions (user_id, plan_type, end_date, payment_status, created_at) 
            VALUES (?, 'trial', DATE_ADD(NOW(), INTERVAL ? HOUR), 'completed', NOW())
        ");
        
        $result = $stmt->execute([$userId, $trialHours]);
        
        if ($result) {
            error_log("Trial subscription created for user: " . $userId);
        } else {
            error_log("Failed to create trial subscription for user: " . $userId);
        }
        
    } catch (Exception $e) {
        // Log error but don't throw - trial subscription is not critical for login
        error_log("Error creating trial subscription: " . $e->getMessage());
    }
}
    
    /**
     * Get subscription status
     */
    private function getSubscriptionStatus($userId) {
        if (empty($GLOBALS['db'])) {
            return null;
        }
        $db = $GLOBALS['db'];
        $stmt = $db->prepare("
            SELECT plan_type, end_date 
            FROM subscriptions 
            WHERE user_id = ? AND payment_status = 'completed'
            AND (end_date IS NULL OR end_date > NOW())
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
    
/**
 * Google OAuth Login - Redirect to Google
 * GET /api/auth/google
 */
public function googleLogin() {
    // Simple diagnostic version
    error_log("========== GOOGLE LOGIN CALLED ==========");
    
    try {
        // Hardcoded credentials for testing
        $clientId = '33504210528-el2rft2qsopc1m5vd97vlrnaal6as6jd.apps.googleusercontent.com';
        $redirectUri = 'https://mvc-accelerator.technosphereinnovations.com/api/auth/google/callback';
        
        error_log("Using Client ID: " . substr($clientId, 0, 10) . "...");
        error_log("Using Redirect URI: " . $redirectUri);
        
        $params = [
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'email profile',
            'access_type' => 'online',
            'prompt' => 'select_account'
        ];
        
        $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
        
        error_log("Redirect URL: " . $url);
        
        // Clear any output buffers
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        // Redirect
        header('Location: ' . $url);
        exit;
        
    } catch (Exception $e) {
        error_log("Google Login Error: " . $e->getMessage());
        http_response_code(500);
        echo "Error: " . $e->getMessage();
        exit;
    }
}

/**
 * Find or create user from Google data
 */
private function findOrCreateGoogleUser($googleUser) {
    error_log("findOrCreateGoogleUser called for email: " . $googleUser['email']);
    
    // Check if user exists by email
    $user = $this->userModel->findByEmail($googleUser['email']);
    
    if ($user) {
        error_log("Existing user found: ID " . $user['id']);
        
        // Update last login
        $this->userModel->update($user['id'], [
            'last_login' => date('Y-m-d H:i:s')
        ]);
        
        // Update Google ID if not set
        if (empty($user['google_id'])) {
            $this->userModel->update($user['id'], [
                'google_id' => $googleUser['id']
            ]);
        }
        
        // Get fresh user data
        return $this->userModel->find($user['id']);
    }
    
    error_log("Creating new user from Google data");
    
    // Create new user
    $username = $this->generateUniqueUsername($googleUser['name'] ?? $googleUser['email']);
    $apiKey = bin2hex(random_bytes(32));
    $passwordHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    
    $userData = [
        'username' => $username,
        'email' => $googleUser['email'],
        'password_hash' => $passwordHash,
        'api_key' => $apiKey,
        'google_id' => $googleUser['id'],
        'fullname' => $googleUser['name'] ?? null,
        'created_at' => date('Y-m-d H:i:s'),
        'last_login' => date('Y-m-d H:i:s'),
        'is_active' => 1
    ];
     
    // Add avatar if available
    if (isset($googleUser['picture'])) {
        $userData['avatar'] = $googleUser['picture'];
    }
    
    $userId = $this->userModel->create($userData);
    error_log("New user created with ID: " . $userId);
    
    if (!$userId) {
        throw new Exception('Failed to create user');
    }
    
    // Create trial subscription
    $this->createTrialSubscription($userId);
    
    // Return the created user
    return $this->userModel->find($userId);
}

/**
 * Generate unique username from Google name
 */
private function generateUniqueUsername($name) {
    $username = preg_replace('/[^a-zA-Z0-9]/', '', strtolower($name));
    $username = substr($username, 0, 20);
    
    $userModel = new User();
    $original = $username;
    $counter = 1;
    
    while ($userModel->findByUsername($username)) {
        $username = $original . $counter;
        $counter++;
    }
    
    return $username;
}

/**
 * Send welcome email to new user
 */
private function sendWelcomeEmail($email, $username) {
    $to = $email;
    $subject = "Welcome to MVC Accelerator!";
    
    $message = "
    <html>
    <head>
        <title>Welcome to MVC Accelerator</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4A5C3A; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #4A5C3A; color: white; 
                     text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>Welcome to MVC Accelerator!</h1>
            </div>
            <div class='content'>
                <h2>Hello {$username}!</h2>
                <p>Thank you for joining MVC Accelerator. We're excited to have you on board!</p>
                <p>Your 48-hour free trial has been activated. You can now:</p>
                <ul>
                    <li>Generate unlimited PHP MVC structures</li>
                    <li>Scan your projects for vulnerabilities</li>
                    <li>Use our VS Code extension</li>
                    <li>Save and manage your projects</li>
                </ul>
                <p>
                    <a href='" . $_ENV['APP_URL'] . "/generator' class='button'>Start Building Now</a>
                </p>
                <p>If you have any questions, feel free to reply to this email.</p>
                <p>Best regards,<br>The MVC Accelerator Team</p>
            </div>
            <div class='footer'>
                &copy; 2024 MVC Accelerator. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    ";
    
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8\r\n";
    $headers .= "From: " . $_ENV['MAIL_FROM_ADDRESS'] . "\r\n";
    
    mail($to, $subject, $message, $headers);
}

/**
 * Notify admin of new user registration
 */
private function notifyAdmin($type, $data) {
    $adminEmail = $_ENV['ADMIN_EMAIL'] ?? 'info@technosphereinnovations.com';
    $subject = "MVC Accelerator - New User Registration";
    
    $message = "A new user has registered:\n";
    $message .= "Email: {$data['email']}\n";
    $message .= "Method: {$data['method']}\n";
    $message .= "Time: " . date('Y-m-d H:i:s') . "\n";
    
    if (isset($data['name'])) {
        $message .= "Name: {$data['name']}\n";
    }
    
    mail($adminEmail, $subject, $message);
}

/**
 * Google OAuth Callback - Handle Google's response
 * GET /api/auth/google/callback
 */
public function googleCallback() {
    // Turn on error reporting
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    
    // Log everything
    error_log("========== GOOGLE CALLBACK WITH DB ==========");
    error_log("GET params: " . print_r($_GET, true));
    
    try {
        // Check for error from Google
        if (isset($_GET['error'])) {
            throw new Exception('Google error: ' . $_GET['error']);
        }
        
        // Get authorization code
        $code = $_GET['code'] ?? null;
        if (!$code) {
            throw new Exception('No code provided');
        }
        
        // Get credentials
        $clientId = $_ENV['GOOGLE_CLIENT_ID'] ?? getenv('GOOGLE_CLIENT_ID');
        $clientSecret = $_ENV['GOOGLE_CLIENT_SECRET'] ?? getenv('GOOGLE_CLIENT_SECRET');
        $appUrl = $_ENV['APP_URL'] ?? 'https://mvc-accelerator.technosphereinnovations.com';
        $redirectUri = $appUrl . '/api/auth/google/callback';
        
        error_log("Exchanging code for token...");
        
        // Exchange code for token
        $postData = [
            'code' => $code,
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirectUri,
            'grant_type' => 'authorization_code'
        ];
        
        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Token exchange failed with code: ' . $httpCode);
        }
        
        $tokenData = json_decode($response, true);
        error_log("Token exchange successful");
        
        // Get user info
        error_log("Getting user info...");
        
        $ch = curl_init('https://www.googleapis.com/oauth2/v2/userinfo');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $tokenData['access_token']]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Failed to get user info');
        }
        
        $userInfo = json_decode($response, true);
        error_log("User email: " . $userInfo['email']);
        
        // Check database connection
        error_log("Checking database connection...");
        if (!isset($GLOBALS['db']) || !$GLOBALS['db']) {
            throw new Exception('Database connection not available');
        }
        error_log("Database connection OK");
        
        // Find or create user
        error_log("Calling findOrCreateGoogleUser...");
        $user = $this->findOrCreateGoogleUser($userInfo);
        error_log("User returned with ID: " . ($user['id'] ?? 'null'));
        
        if (!$user || !isset($user['id'])) {
            throw new Exception('Failed to get user data');
        }
        
        // Generate JWT
        error_log("Generating JWT...");
        $jwt = $this->generateSimpleJWT($user['id']);
        error_log("JWT generated");
        
        // Prepare user data
        $userData = [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'api_key' => $user['api_key']
        ];
        
        // Clear output buffers
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        // Redirect
        $redirectUrl = $appUrl . '/oauth-callback?token=' . urlencode($jwt) . '&user=' . urlencode(json_encode($userData));
        error_log("Redirecting to: " . $redirectUrl);
        
        header('Location: ' . $redirectUrl);
        exit;
        
    } catch (Exception $e) {
        error_log("FATAL ERROR: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        
        // Show error page
        echo "<h1>Error</h1>";
        echo "<p>" . htmlspecialchars($e->getMessage()) . "</p>";
        echo "<p>Check error logs for details.</p>";
        echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
        exit;
    }
}

/**
 * Exchange authorization code for access token
 */
private function exchangeGoogleCode($code) {
    $clientId = $_ENV['GOOGLE_CLIENT_ID'] ?? getenv('GOOGLE_CLIENT_ID');
    $clientSecret = $_ENV['GOOGLE_CLIENT_SECRET'] ?? getenv('GOOGLE_CLIENT_SECRET');
    $redirectUri = ($_ENV['APP_URL'] ?? 'https://mvc-accelerator.technosphereinnovations.com') . '/api/auth/google/callback';
    
    error_log("Token Exchange - Starting");
    
    $postData = [
        'code' => $code,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri' => $redirectUri,
        'grant_type' => 'authorization_code'
    ];
    
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_error($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception('CURL Error: ' . $error);
    }
    
    curl_close($ch);
    
    error_log("Token Exchange Response Code: " . $httpCode);
    
    if ($httpCode !== 200) {
        $error = json_decode($response, true);
        $errorMsg = $error['error_description'] ?? $error['error'] ?? 'Unknown error';
        throw new Exception('Token exchange failed: ' . $errorMsg);
    }
    
    $result = json_decode($response, true);
    if (!$result || !isset($result['access_token'])) {
        throw new Exception('Invalid response from Google');
    }
    
    return $result;
}

/**
 * Get user info from Google
 */
private function getGoogleUserInfo($accessToken) {
    $ch = curl_init('https://www.googleapis.com/oauth2/v2/userinfo');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("User Info Response Code: " . $httpCode);
    
    if ($httpCode !== 200) {
        throw new Exception('Failed to get user info from Google');
    }
    
    $userInfo = json_decode($response, true);
    if (!$userInfo || !isset($userInfo['email'])) {
        throw new Exception('Invalid user info response');
    }
    
    return $userInfo;
}

/**
 * Generate a simple JWT token
 */
private function generateSimpleJWT($userId) {
    // Header
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    
    // Payload
    $payload = json_encode([
        'user_id' => $userId,
        'iat' => time(),
        'exp' => time() + 86400, // 24 hours
        'iss' => $_ENV['APP_URL'] ?? 'https://mvc-accelerator.technosphereinnovations.com'
    ]);
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    $secret = $_ENV['JWT_SECRET'] ?? getenv('JWT_SECRET');
    if (empty($secret)) {
        error_log("CRITICAL: JWT_SECRET not set in environment");
        throw new Exception('Server is not configured correctly. Please contact support.');
    }
    
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

}


