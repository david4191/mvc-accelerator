<?php
// api/core/Router.php

class Router {
    private $routes = [];
    
    public function get($path, $handler, $middleware = []) {
        $this->addRoute('GET', $path, $handler, $middleware);
    }
    
    public function post($path, $handler, $middleware = []) {
        $this->addRoute('POST', $path, $handler, $middleware);
    }
    
    public function put($path, $handler, $middleware = []) {
        $this->addRoute('PUT', $path, $handler, $middleware);
    }
    
    public function delete($path, $handler, $middleware = []) {
        $this->addRoute('DELETE', $path, $handler, $middleware);
    }
    
     
   private function addRoute($method, $path, $handler, $middleware) {
    $this->routes[] = [
        'method' => $method,
        'path' => $path,
        'handler' => $handler,
        'middleware' => $middleware
    ];
}
    
   public function dispatch($method, $uri) {
    // Remove query string
    if (strpos($uri, '?') !== false) {
        $uri = substr($uri, 0, strpos($uri, '?'));
    }
    
    // Remove trailing slash
    $uri = rtrim($uri, '/');
    if (empty($uri)) $uri = '/';
    
    foreach ($this->routes as $index => $route) {
        if ($route['method'] !== $method) {
            continue;
        }

        // Simple string comparison first for exact matches
        if ($route['path'] === $uri) {
            $this->executeHandler($route['handler'], []);
            return;
        }

        // Then try regex for dynamic routes
        $pattern = $this->convertToRegex($route['path']);
        if (preg_match($pattern, $uri, $matches)) {
            array_shift($matches);
            $this->executeHandler($route['handler'], $matches);
            return;
        }
    }

    error_log("NO ROUTE FOUND for: $method $uri");
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Route not found', 'path' => $uri]);
    exit;
}

    private function convertToRegex($path) {
        $path = preg_replace('/\{([a-z]+)\}/', '([^/]+)', $path);
        return '#^' . $path . '$#';
    }
    
    private function runMiddleware($middleware) {
        $class = $middleware . 'Middleware';
        if (class_exists($class)) {
            $instance = new $class();
            if (method_exists($instance, 'handle')) {
                $instance->handle();
            }
        }
    }
    
    /**
     * Execute the route handler with error catching
     */
private function executeHandler($handler, $params) {
    // Clear output buffers
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    try {
        // Handle closures (anonymous functions)
        if (is_callable($handler)) {
            call_user_func_array($handler, $params);
            return;
        }
        
        // Handle "Controller@method" string format
        if (is_string($handler) && strpos($handler, '@') !== false) {
            list($controllerName, $method) = explode('@', $handler);
            
            // Make sure controller name ends with 'Controller'
            if (!str_ends_with($controllerName, 'Controller')) {
                $controllerName .= 'Controller';
            }
            
            // Check if class exists
            if (!class_exists($controllerName)) {
                throw new Exception("Controller class '$controllerName' not found");
            }
            
            // Instantiate controller
            $controller = new $controllerName();
            
            // Check if method exists
            if (!method_exists($controller, $method)) {
                throw new Exception("Method '$method' not found in controller '$controllerName'");
            }
            
            // Call the method
            call_user_func_array([$controller, $method], $params);
            return;
        }
        
        // Handle array format ['Controller', 'method']
        if (is_array($handler) && count($handler) === 2) {
            list($controllerName, $method) = $handler;
            
            // Make sure controller name ends with 'Controller'
            if (!str_ends_with($controllerName, 'Controller')) {
                $controllerName .= 'Controller';
            }
            
            // Check if class exists
            if (!class_exists($controllerName)) {
                throw new Exception("Controller class '$controllerName' not found");
            }
            
            // Instantiate controller
            $controller = new $controllerName();
            
            // Check if method exists
            if (!method_exists($controller, $method)) {
                throw new Exception("Method '$method' not found in controller '$controllerName'");
            }
            
            // Call the method
            call_user_func_array([$controller, $method], $params);
            return;
        }
        
        // If we get here, handler format is invalid
        throw new Exception('Invalid handler format');
        
    } catch (Throwable $e) {
        error_log("Router executeHandler error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Internal server error',
            'message' => $e->getMessage()
        ]);
        exit;
    }
}
    
}