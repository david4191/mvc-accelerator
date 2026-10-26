<?php
// api/core/GeminiEngine.php

class GeminiEngine {
    private $apiKey;
    private $model;
    private $timeout = 180;
    private $connectTimeout = 30;

    public function __construct() {
        $this->apiKey = $_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY');
        $this->model = $_ENV['GEMINI_MODEL'] ?? getenv('GEMINI_MODEL') ?: 'gemini-2.0-flash';

        if (empty($this->apiKey)) {
            error_log("GeminiEngine: GEMINI_API_KEY not set");
        }
    }

    public function generateCode($prompt) {
        return $this->callGeminiAPI($prompt, 'code');
    }

    public function answerQuestion($prompt) {
        return $this->callGeminiAPI($prompt, 'question');
    }

    private function callGeminiAPI($prompt, $type) {
        if (empty($this->apiKey)) {
            error_log("GeminiEngine: No API key configured");
            throw new Exception('AI service is not configured. Please contact support.');
        }

        $systemPrompt = $type === 'code'
            ? "You are a PHP developer. Generate code with file paths as comments."
            : "You are a PHP expert. Answer concisely with examples.";

        // Raised from 4000: the "explain every file" prompt requirement
        // makes code responses much longer (narration + code per file),
        // so the old cap was truncating on ordinary foundation-sized builds.
        $maxTokens = $type === 'code' ? 8000 : 2000;

        $data = [
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $prompt]]]
            ],
            'systemInstruction' => [
                'parts' => [['text' => $systemPrompt]]
            ],
            'generationConfig' => [
                'maxOutputTokens' => $maxTokens,
                'temperature' => 0.5
            ]
        ];

        // A genuinely truncated (but non-empty) response gets at most ONE
        // budget-bump retry - a normal, complete response never reaches the
        // truncation branch in sendGeminiRequest(), so this costs nothing
        // extra on the common path.
        try {
            return $this->sendGeminiRequest($data);
        } catch (Exception $e) {
            if ($e->getMessage() !== 'OUTPUT_TRUNCATED') {
                throw $e;
            }

            $next = $maxTokens * 2;
            error_log("GeminiEngine: response was truncated (finishReason=MAX_TOKENS) with partial content, raising maxOutputTokens from {$maxTokens} to {$next} and retrying once");
            $data['generationConfig']['maxOutputTokens'] = $next;

            try {
                return $this->sendGeminiRequest($data);
            } catch (Exception $e2) {
                if ($e2->getMessage() === 'OUTPUT_TRUNCATED') {
                    throw new Exception('The AI response was cut off before finishing, even after retrying with a larger output budget. Try a narrower request (e.g. fewer files at once) or a different model.');
                }
                throw $e2;
            }
        }
    }

    private function sendGeminiRequest($data) {
        $startTime = microtime(true);
        $maxTokens = $data['generationConfig']['maxOutputTokens'];

        $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}";

        error_log("GeminiEngine: Sending request with max_tokens={$maxTokens}, model={$this->model}");

        $ch = curl_init($apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
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
        error_log("GeminiEngine: API call took {$elapsed}s, HTTP code: {$httpCode}");

        if ($curlError) {
            error_log("GeminiEngine: CURL error ({$curlErrno}): {$curlError}");

            if ($curlErrno == CURLE_OPERATION_TIMEDOUT) {
                throw new Exception("The AI service is taking too long to respond. Please try a more specific request.");
            }

            throw new Exception("Connection to AI service failed: {$curlError}");
        }

        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMsg = $errorData['error']['message'] ?? "AI service error (HTTP {$httpCode})";
            error_log("GeminiEngine: API error: " . $errorMsg);
            throw new Exception($errorMsg);
        }

        $result = json_decode($response, true);
        $content = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $finishReason = $result['candidates'][0]['finishReason'] ?? null;

        if (empty($content)) {
            error_log("GeminiEngine: Empty response from API");
            throw new Exception('AI service returned an empty response');
        }

        // finishReason === 'MAX_TOKENS' with non-empty content means Gemini
        // hit the token ceiling mid-response (as opposed to 'STOP', a normal
        // completion) - the visible text is genuinely incomplete, not short.
        if ($finishReason === 'MAX_TOKENS') {
            error_log("GeminiEngine: response truncated (finishReason=MAX_TOKENS), " . strlen($content) . " chars of partial visible content");
            throw new Exception('OUTPUT_TRUNCATED');
        }

        return $content;
    }
}
