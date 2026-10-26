<?php
// api/index.php

define('ROOT_PATH', __DIR__);
require_once ROOT_PATH . '/config/autoload.php';

require_once ROOT_PATH . '/core/Cors.php';
Cors::handle();

require_once ROOT_PATH . '/middleware/SecurityHeadersMiddleware.php';
(new SecurityHeadersMiddleware())->handle();


if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$router = new Router();

// ============================================
// PUBLIC ROUTES
// ============================================
$router->get('/', function() {
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'online',
        'message' => 'Welcome to MVC Accelerator API',
        'version' => '1.0.0'
    ]);
    exit;
});

$router->get('/health', function() {
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'healthy',
        'timestamp' => time(),
        'version' => '1.0.0'
    ]);
    exit;
});

$router->get('/health/database', function() {
    header('Content-Type: application/json');

    try {
        $db = $GLOBALS['db'] ?? null;
        if (!$db instanceof PDO) {
            throw new RuntimeException('Database connection unavailable');
        }

        $db->query('SELECT 1');
        $databaseHealthy = true;
    } catch (Throwable $e) {
        error_log('Database health check failed: ' . $e->getMessage());
        $databaseHealthy = false;
    }

    http_response_code($databaseHealthy ? 200 : 503);
    echo json_encode([
        'status' => $databaseHealthy ? 'healthy' : 'unhealthy',
        'database' => $databaseHealthy ? 'connected' : 'unavailable',
        'timestamp' => time()
    ]);
    exit;
});

$router->post('/generate/preview', 'GenerationController@preview');

// GOOGLE OAUTH ROUTES
$router->get('/auth/google', 'AuthController@googleLogin');
$router->get('/auth/google/callback', 'AuthController@googleCallback');

// AUTH ROUTES
$router->post('/register', 'AuthController@register');
$router->post('/login', 'AuthController@login');
$router->post('/logout', 'AuthController@logout');
$router->post('/refresh-token', 'AuthController@refreshToken');
$router->post('/forgot-password', 'AuthController@forgotPassword');
$router->post('/reset-password', 'AuthController@resetPassword');
$router->get('/verify-email', 'AuthController@verifyEmail');

// USER PROFILE ROUTES
$router->get('/user/profile', 'UserController@profile', ['Auth']);
$router->put('/user/profile', 'UserController@updateProfile', ['Auth']);
$router->post('/user/change-password', 'UserController@changePassword', ['Auth']);

// PROJECT ROUTES
$router->get('/projects', 'ProjectController@index', ['Auth']);
$router->get('/projects/{id}', 'ProjectController@show', ['Auth']);
$router->post('/projects', 'ProjectController@store', ['Auth']);
$router->put('/projects/{id}', 'ProjectController@update', ['Auth']);
$router->delete('/projects/{id}', 'ProjectController@destroy', ['Auth']);
$router->post('/projects/{id}/scan', 'ProjectController@scan', ['Auth']);
$router->get('/projects/{id}/scans', 'ProjectController@getScans', ['Auth']);
$router->get('/projects/{id}/files', 'ProjectController@files', ['Auth']);

// GENERATION ROUTES
$router->post('/generate', 'GenerationController@generate', ['Auth']);
$router->post('/generate/plan', 'GenerationController@plan', ['Auth']);
$router->get('/generations', 'GenerationController@history', ['Auth']);
$router->get('/generations/{id}', 'GenerationController@getGeneration', ['Auth']);
$router->get('/generations/{id}/download', 'GenerationController@download', ['Auth']);

// SUBSCRIPTION ROUTES
$router->get('/subscription/status', 'SubscriptionController@status', ['Auth']);
$router->get('/subscription/current', 'SubscriptionController@getCurrent', ['Auth']);
$router->post('/subscription/cancel', 'SubscriptionController@cancel', ['Auth']);
$router->post('/subscription/verify', 'SubscriptionController@verifyPayment', ['Auth']);
$router->get('/subscription/billing-history', 'SubscriptionController@billingHistory', ['Auth']);
$router->get('/plans', 'SubscriptionController@getPlans');

// Get the current URI path
$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^/api#', '', $request_uri);
if (empty($path)) $path = '/';

$router->dispatch($_SERVER['REQUEST_METHOD'], $path);