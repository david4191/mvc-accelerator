<?php
// api/core/ClaudeEngine.php

class ClaudeEngine {
    private $apiKey;
    private $apiUrl = 'https://api.anthropic.com/v1/messages';
    private $model;
    private $timeout = 180;
    private $connectTimeout = 30;

    public function __construct() {
        $this->apiKey = $_ENV['ANTHROPIC_API_KEY'] ?? getenv('ANTHROPIC_API_KEY');
        $this->model = $_ENV['CLAUDE_MODEL'] ?? getenv('CLAUDE_MODEL') ?: 'claude-sonnet-4-5';

        if (empty($this->apiKey)) {
            error_log("ClaudeEngine: ANTHROPIC_API_KEY not set");
        }
    }

    public function generateCode($prompt) {
        return $this->callClaudeAPI($prompt, 'code');
    }

    public function answerQuestion($prompt) {
        return $this->callClaudeAPI($prompt, 'question');
    }

    private function callClaudeAPI($prompt, $type) {
        $startTime = microtime(true);

        if (empty($this->apiKey)) {
            error_log("ClaudeEngine: No API key configured");
            throw new Exception('AI service is not configured. Please contact support.');
        }

        $systemPrompt = $type === 'code'
            ? "You are a PHP developer. Generate code with file paths as comments."
            : "You are a PHP expert. Answer concisely with examples.";

        $maxTokens = $type === 'code' ? 4000 : 2000;

        $data = [
            'model' => $this->model,
            'system' => $systemPrompt,
            'messages' => [
                ['role' => 'user', 'content' => $prompt]
            ],
            'max_tokens' => $maxTokens
        ];

        error_log("ClaudeEngine: Sending request with max_tokens={$maxTokens}, model={$this->model}");

        $ch = curl_init($this->apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-api-key: ' . $this->apiKey,
            'anthropic-version: 2023-06-01'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $this->connectTimeout);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_USERAGENT, 'MVC-Accelerator/1.0');

        // php.ini's configured openssl.cafile/curl.cainfo can point at a path
        // that doesn't exist on this machine (e.g. a broken Homebrew OpenSSL
        // install), which makes curl fail before it ever reaches the network.
        // Fall back to a CA bundle we know is actually present.
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
        $curlErrno = curl_errno($ch);
        curl_close($ch);

        $elapsed = round(microtime(true) - $startTime, 2);
        error_log("ClaudeEngine: API call took {$elapsed}s, HTTP code: {$httpCode}");

        if ($curlError) {
            error_log("ClaudeEngine: CURL error ({$curlErrno}): {$curlError}");

            if ($curlErrno == CURLE_OPERATION_TIMEDOUT) {
                throw new Exception("The AI service is taking too long to respond. Please try a more specific request.");
            }

            throw new Exception("Connection to AI service failed: {$curlError}");
        }

        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMsg = $errorData['error']['message'] ?? "AI service error (HTTP {$httpCode})";
            error_log("ClaudeEngine: API error: " . $errorMsg);
            throw new Exception($errorMsg);
        }

        $result = json_decode($response, true);
        $content = $result['content'][0]['text'] ?? '';

        if (empty($content)) {
            error_log("ClaudeEngine: Empty response from API");
            throw new Exception('AI service returned an empty response');
        }

        return $content;
    }
}
