<?php
// api/helpers/security_helper.php

if (!function_exists('csrf_token')) {
    function csrf_token() {
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }
}

if (!function_exists('csrf_field')) {
    function csrf_field() {
        return '<input type="hidden" name="csrf_token" value="' . csrf_token() . '">';
    }
}

if (!function_exists('verify_csrf')) {
    function verify_csrf($token) {
        if (!isset($_SESSION['csrf_token']) || $token !== $_SESSION['csrf_token']) {
            return false;
        }
        return true;
    }
}

if (!function_exists('encrypt')) {
    function encrypt($data) {
        $security = Security::getInstance();
        return $security->encrypt($data);
    }
}

if (!function_exists('decrypt')) {
    function decrypt($data) {
        $security = Security::getInstance();
        return $security->decrypt($data);
    }
}

if (!function_exists('hash_password')) {
    function hash_password($password) {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => BCRYPT_ROUNDS]);
    }
}

if (!function_exists('verify_password')) {
    function verify_password($password, $hash) {
        return password_verify($password, $hash);
    }
}

if (!function_exists('generate_random_string')) {
    function generate_random_string($length = 32) {
        return bin2hex(random_bytes($length / 2));
    }
}

if (!function_exists('is_strong_password')) {
    function is_strong_password($password) {
        $result = validatePassword($password);
        return $result === true;
    }
}

if (!function_exists('sanitize_filename')) {
    function sanitize_filename($filename) {
        $filename = preg_replace('/[^a-zA-Z0-9\-\_\.]/', '', $filename);
        $filename = str_replace('..', '', $filename);
        return $filename;
    }
}

if (!function_exists('secure_file_upload')) {
    function secure_file_upload($file, $destination, $allowedTypes = []) {
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return ['success' => false, 'error' => 'Invalid file upload'];
        }
        
        $filename = sanitize_filename($file['name']);
        $destinationPath = rtrim($destination, '/') . '/' . $filename;
        
        // Check file type
        if (!empty($allowedTypes)) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
            
            if (!in_array($mimeType, $allowedTypes)) {
                return ['success' => false, 'error' => 'File type not allowed'];
            }
        }
        
        // Scan for malware (simplified)
        $content = file_get_contents($file['tmp_name']);
        $suspicious = ['<?php', 'eval(', 'base64_decode', 'system(', 'exec('];
        foreach ($suspicious as $pattern) {
            if (strpos($content, $pattern) !== false) {
                return ['success' => false, 'error' => 'File contains suspicious code'];
            }
        }
        
        if (move_uploaded_file($file['tmp_name'], $destinationPath)) {
            return ['success' => true, 'path' => $destinationPath, 'filename' => $filename];
        }
        
        return ['success' => false, 'error' => 'Failed to upload file'];
    }
}

if (!function_exists('generate_api_key')) {
    function generate_api_key() {
        return bin2hex(random_bytes(32));
    }
}

if (!function_exists('get_client_ip')) {
    function get_client_ip() {
        $ipaddress = '';
        if (isset($_SERVER['HTTP_CLIENT_IP']))
            $ipaddress = $_SERVER['HTTP_CLIENT_IP'];
        else if(isset($_SERVER['HTTP_X_FORWARDED_FOR']))
            $ipaddress = $_SERVER['HTTP_X_FORWARDED_FOR'];
        else if(isset($_SERVER['HTTP_X_FORWARDED']))
            $ipaddress = $_SERVER['HTTP_X_FORWARDED'];
        else if(isset($_SERVER['HTTP_FORWARDED_FOR']))
            $ipaddress = $_SERVER['HTTP_FORWARDED_FOR'];
        else if(isset($_SERVER['HTTP_FORWARDED']))
            $ipaddress = $_SERVER['HTTP_FORWARDED'];
        else if(isset($_SERVER['REMOTE_ADDR']))
            $ipaddress = $_SERVER['REMOTE_ADDR'];
        else
            $ipaddress = 'UNKNOWN';
        
        return $ipaddress;
    }
}

if (!function_exists('is_https')) {
    function is_https() {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || $_SERVER['SERVER_PORT'] == 443;
    }
}

if (!function_exists('prevent_xss')) {
    function prevent_xss($data) {
        if (is_array($data)) {
            return array_map('prevent_xss', $data);
        }
        return htmlspecialchars($data, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}

if (!function_exists('validate_ssl_certificate')) {
    function validate_ssl_certificate($hostname) {
        $g = stream_context_create(['ssl' => ['capture_peer_cert' => true]]);
        $r = stream_socket_client("ssl://{$hostname}:443", $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $g);
        
        if (!$r) {
            return false;
        }
        
        $cont = stream_context_get_params($r);
        $cert = openssl_x509_parse($cont['options']['ssl']['peer_certificate']);
        
        return $cert !== false;
    }
}

if (!function_exists('check_breached_password')) {
    function check_breached_password($password) {
        // Using Have I Been Pwned API (k-anonymity)
        $hash = strtoupper(sha1($password));
        $prefix = substr($hash, 0, 5);
        $suffix = substr($hash, 5);
        
        $ch = curl_init("https://api.pwnedpasswords.com/range/$prefix");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        $response = curl_exec($ch);
        curl_close($ch);
        
        if ($response) {
            $hashes = explode("\r\n", $response);
            foreach ($hashes as $line) {
                list($hashSuffix, $count) = explode(':', $line);
                if ($hashSuffix === $suffix) {
                    return (int)$count;
                }
            }
        }
        
        return 0;
    }
}