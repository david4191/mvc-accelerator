<?php
// api/core/OpenAIEngine.php

class OpenAIEngine {
    private $apiKey;
    private $apiUrl = 'https://api.openai.com/v1/chat/completions';
    private $model;
    private $timeout = 180;
    private $connectTimeout = 30;

    public function __construct() {
        $this->apiKey = $_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY');
        $this->model = $_ENV['OPENAI_MODEL'] ?? getenv('OPENAI_MODEL') ?: 'gpt-4o';

        if (empty($this->apiKey)) {
            error_log("OpenAIEngine: OPENAI_API_KEY not set");
        }
    }

    public function generateCode($prompt) {
        return $this->callOpenAIAPI($prompt, 'code');
    }

    public function answerQuestion($prompt) {
        return $this->callOpenAIAPI($prompt, 'question');
    }

    private function callOpenAIAPI($prompt, $type) {
        if (empty($this->apiKey)) {
            error_log("OpenAIEngine: No API key configured");
            throw new Exception('AI service is not configured. Please contact support.');
        }

        $systemPrompt = $type === 'code'
            ? "You are a PHP developer. Generate code with file paths as comments."
            : "You are a PHP expert. Answer concisely with examples.";

        // Raised from 4000: the "explain every file" prompt requirement
        // makes code responses much longer (narration + code per file),
        // so the old cap was truncating on ordinary foundation-sized builds.
        $maxTokens = $type === 'code' ? 8000 : 2000;
        $tokenCap = 20000; // ceiling for the reasoning-budget-bump retries below

        $data = [
            'model' => $this->model,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $prompt]
            ],
            'temperature' => 0.5,
            'max_tokens' => $maxTokens,
            'stream' => false
        ];

        // Newer OpenAI models (the o1/o3/reasoning-style family, and
        // whatever this account's configured model turns out to be) reject
        // parameters older chat models accept without complaint - no custom
        // 'temperature', 'max_tokens' renamed to 'max_completion_tokens'.
        // They also spend part of the token budget on hidden reasoning before
        // writing any visible output, so a budget sized for a normal chat
        // model can be entirely consumed by reasoning, leaving an empty
        // response. Rather than hardcode per-model quirks, adapt the request
        // to whatever the API itself says it needs and retry, a few times at most.
        // Separate from the per-quirk attempt loop below: a genuinely
        // truncated (but non-empty) response gets at most ONE budget-bump
        // retry, tracked independently so it can't combine with the other
        // retry branches to loop more than once on this specific cause.
        $truncationRetried = false;

        for ($attempt = 0; $attempt < 5; $attempt++) {
            try {
                return $this->sendRequest($data);
            } catch (Exception $e) {
                $message = $e->getMessage();

                if (strpos($message, 'max_completion_tokens') !== false && isset($data['max_tokens'])) {
                    error_log("OpenAIEngine: retrying with max_completion_tokens instead of max_tokens");
                    unset($data['max_tokens']);
                    $data['max_completion_tokens'] = $maxTokens;
                    continue;
                }

                if (strpos($message, "'temperature'") !== false && isset($data['temperature'])) {
                    error_log("OpenAIEngine: retrying without a custom temperature (model only supports the default)");
                    unset($data['temperature']);
                    continue;
                }

                if ($message === 'REASONING_BUDGET_EXHAUSTED') {
                    $tokenKey = isset($data['max_completion_tokens']) ? 'max_completion_tokens' : 'max_tokens';
                    $next = min($data[$tokenKey] * 3, $tokenCap);
                    if ($next <= $data[$tokenKey]) {
                        throw new Exception('This model needs more output budget than this request allows for a prompt this size. Try a shorter prompt or a different model.');
                    }
                    error_log("OpenAIEngine: response was all reasoning tokens with nothing visible, raising {$tokenKey} from {$data[$tokenKey]} to {$next} and retrying");
                    $data[$tokenKey] = $next;
                    continue;
                }

                if ($message === 'OUTPUT_TRUNCATED') {
                    if ($truncationRetried) {
                        throw new Exception('The AI response was cut off before finishing, even after retrying with a larger output budget. Try a narrower request (e.g. fewer files at once) or a different model.');
                    }
                    $tokenKey = isset($data['max_completion_tokens']) ? 'max_completion_tokens' : 'max_tokens';
                    $next = min($data[$tokenKey] * 2, $tokenCap);
                    if ($next <= $data[$tokenKey]) {
                        throw new Exception('The AI response was cut off before finishing, and the output budget is already at its ceiling for this request.');
                    }
                    $truncationRetried = true;
                    error_log("OpenAIEngine: response was truncated (finish_reason=length) with partial content, raising {$tokenKey} from {$data[$tokenKey]} to {$next} and retrying once");
                    $data[$tokenKey] = $next;
                    continue;
                }

                throw $e;
            }
        }

        throw new Exception('AI service rejected the request after adjusting for model-specific parameters.');
    }

    private function sendRequest($data) {
        $startTime = microtime(true);

        error_log("OpenAIEngine: Sending request, model={$this->model}, params=" . implode(',', array_keys($data)));

        $ch = curl_init($this->apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey
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
        error_log("OpenAIEngine: API call took {$elapsed}s, HTTP code: {$httpCode}");

        if ($curlError) {
            error_log("OpenAIEngine: CURL error ({$curlErrno}): {$curlError}");

            if ($curlErrno == CURLE_OPERATION_TIMEDOUT) {
                throw new Exception("The AI service is taking too long to respond. Please try a more specific request.");
            }

            throw new Exception("Connection to AI service failed: {$curlError}");
        }

        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMsg = $errorData['error']['message'] ?? "AI service error (HTTP {$httpCode})";
            error_log("OpenAIEngine: API error: " . $errorMsg);
            throw new Exception($errorMsg);
        }

        $result = json_decode($response, true);
        $content = $result['choices'][0]['message']['content'] ?? '';
        $finishReason = $result['choices'][0]['finish_reason'] ?? null;
        $reasoningTokens = $result['usage']['completion_tokens_details']['reasoning_tokens'] ?? 0;

        if (empty($content)) {
            if ($finishReason === 'length' && $reasoningTokens > 0) {
                error_log("OpenAIEngine: entire token budget ({$reasoningTokens} tokens) spent on reasoning, nothing left for visible output");
                throw new Exception('REASONING_BUDGET_EXHAUSTED');
            }
            error_log("OpenAIEngine: Empty response from API (finish_reason: " . ($finishReason ?? 'unknown') . ")");
            throw new Exception('AI service returned an empty response');
        }

        // finish_reason === 'length' with non-empty content means the model
        // hit the token ceiling mid-response (as opposed to 'stop', a normal
        // completion) - the visible text is genuinely incomplete, not just
        // short. A successful, complete response never reaches this branch.
        if ($finishReason === 'length') {
            error_log("OpenAIEngine: response truncated (finish_reason=length), " . strlen($content) . " chars of partial visible content");
            throw new Exception('OUTPUT_TRUNCATED');
        }

        return $content;
    }
}
