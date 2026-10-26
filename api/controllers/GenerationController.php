<?php
// api/controllers/GenerationController.php

require_once __DIR__ . '/../core/Controller.php';
require_once __DIR__ . '/../core/AIEngine.php';
require_once __DIR__ . '/../core/OpenAIEngine.php';
require_once __DIR__ . '/../core/GeminiEngine.php';
require_once __DIR__ . '/../core/Security.php';
require_once __DIR__ . '/../models/Subscription.php';
require_once __DIR__ . '/../models/Project.php';
require_once __DIR__ . '/../models/ProjectFile.php';

class GenerationController extends Controller {

    const GENERATION_ENDPOINT = 'ai_generation';
    const GUEST_LIMIT = 2;
    const FREE_LIMIT = 10;
    const LIMIT_WINDOW_SECONDS = 86400; // 24 hours
    const MAX_PROMPT_LENGTH = 4000; // characters - generous for a detailed spec, bounded against essay-length abuse
    const PREMIUM_ONLY_MODELS = ['openai', 'gemini']; // free/guest tiers are routed to DeepSeek only

    /**
     * Cheap heuristic (no AI call) for whether a prompt is asking to build
     * something vs. asking a conceptual question, so the right-sized token
     * budget can be picked before spending anything on the real call.
     */
    private function isLikelyBuildRequest($prompt) {
        $buildVerbs = '/\b(create|build|make|generate|develop|design|set\s*up|scaffold|add)\b/i';
        $projectNouns = '/\b(website|site|app|application|system|platform|project|api|dashboard|tool|store|shop|portal|service|feature|page)\b/i';
        if (preg_match($buildVerbs, $prompt) && preg_match($projectNouns, $prompt)) {
            return true;
        }
        // A longer prompt is more likely a detailed build spec even without the exact keywords
        return strlen($prompt) > 220;
    }

    /**
     * Pick the AI engine for the requested model. Unknown/unconfigured
     * models fall back to DeepSeek rather than failing the request.
     */
    private function getAIEngine($model) {
        switch ($model) {
            case 'openai':
                return new OpenAIEngine();
            case 'gemini':
                return new GeminiEngine();
            case 'deepseek':
            default:
                return new AIEngine();
        }
    }

    /**
     * Current user id if a valid auth token is present, null for guests.
     * Unlike getCurrentUserId(), never throws.
     */
    private function tryGetCurrentUserId() {
        try {
            return $this->getCurrentUserId();
        } catch (Throwable $e) {
            return null;
        }
    }

    private function getClientIp() {
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

    private function modelDisplayName($model) {
        $names = ['openai' => 'ChatGPT', 'gemini' => 'Gemini', 'deepseek' => 'DeepSeek'];
        return $names[$model] ?? ucfirst($model);
    }

    /**
     * Enforce the guest/free/premium generation limits shared by preview()
     * and generate(). Returns null if the request may proceed, or an array
     * describing the limit response to send back otherwise.
     */
    private function checkGenerationLimit($userId, $model = 'deepseek') {
        // Fail OPEN: if the limit check itself breaks (e.g. the guest_usage
        // migration hasn't been run yet), let the request through rather than
        // taking down generation for everyone. Limit enforcement is a nice-to-have;
        // generation working at all is not.
        try {
            $security = Security::getInstance();
            $wantsPremiumModel = in_array($model, self::PREMIUM_ONLY_MODELS, true);

            if ($userId !== null) {
                $isPremium = (new Subscription())->hasActive($userId);
                if ($isPremium) {
                    return null;
                }

                if ($wantsPremiumModel) {
                    return [
                        'success' => false,
                        'limitReached' => true,
                        'reason' => 'premium_model_required',
                        'error' => $this->modelDisplayName($model) . " is a Premium-only model. Upgrade to Premium to use it, or switch to DeepSeek in the selector above."
                    ];
                }

                $usageCount = $security->getRecentUsageCount($userId, self::GENERATION_ENDPOINT, self::LIMIT_WINDOW_SECONDS);
                if ($usageCount >= self::FREE_LIMIT) {
                    return [
                        'success' => false,
                        'limitReached' => true,
                        'reason' => 'free_limit',
                        'error' => "You've used all " . self::FREE_LIMIT . " free generations for today. Upgrade to Premium for unlimited access."
                    ];
                }
                return null;
            }

            if ($wantsPremiumModel) {
                return [
                    'success' => false,
                    'limitReached' => true,
                    'reason' => 'premium_model_required',
                    'error' => $this->modelDisplayName($model) . " is a Premium-only model. Sign up and upgrade to Premium to use it, or switch to DeepSeek in the selector above."
                ];
            }

            $ip = $this->getClientIp();
            $guestCount = $security->getGuestUsageCount($ip, self::LIMIT_WINDOW_SECONDS);
            if ($guestCount >= self::GUEST_LIMIT) {
                return [
                    'success' => false,
                    'limitReached' => true,
                    'reason' => 'guest_limit',
                    'error' => "You've used your " . self::GUEST_LIMIT . " free trial generations. Sign in or sign up to keep going."
                ];
            }
            return null;
        } catch (Throwable $e) {
            error_log("checkGenerationLimit failed, failing open: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Record a successful generation against the shared guest/free-tier limit.
     */
    private function recordGeneration($userId) {
        try {
            if ($userId !== null) {
                $this->trackApiUsage($userId, self::GENERATION_ENDPOINT);
            } else {
                Security::getInstance()->recordGuestUsage($this->getClientIp(), self::GENERATION_ENDPOINT);
            }
        } catch (Throwable $e) {
            error_log("recordGeneration failed: " . $e->getMessage());
        }
    }

    /**
     * PREVIEW ENDPOINT - Used by Home.js (Tutor Mode)
     */
    public function preview() {
        header("Content-Type: application/json");

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        $prompt = $data['prompt'] ?? '';
        $model = $data['model'] ?? 'deepseek';

        if (empty($prompt)) {
            $this->json([
                'success' => false,
                'error' => 'Prompt is required'
            ], 400);
            return;
        }

        if (strlen($prompt) > self::MAX_PROMPT_LENGTH) {
            $this->json([
                'success' => false,
                'error' => 'That prompt is too long (max ' . self::MAX_PROMPT_LENGTH . ' characters). Trim it down and try again.'
            ], 400);
            return;
        }

        $userId = $this->tryGetCurrentUserId();
        $limitResponse = $this->checkGenerationLimit($userId, $model);
        if ($limitResponse !== null) {
            $this->json($limitResponse, 429);
            return;
        }

        try {
            error_log("Preview - Starting with prompt: " . substr($prompt, 0, 100) . " (model: $model)");

            $ai = $this->getAIEngine($model);
            
            $tutorPrompt = "You are Codey the PHP Wizard 🧙 — a cartoon-like, upbeat coding mentor character. You are NOT a narrator who cracks one joke and then switches to a textbook — you stay in character as Codey for the ENTIRE response, like a character in a kids' educational cartoon who happens to be genuinely excellent at PHP. Never stall with clarifying questions.\n\n" .
                "The user said: " . $prompt . "\n\n" .
                "First, decide what they actually want:\n" .
                "A) A CONCEPTUAL QUESTION (e.g. 'what is a variable', 'explain MVC') — answer as Codey, in plain words a total beginner (think: someone who has never written a line of code) could follow on the first read. Use one concrete, everyday-object analogy. Define any technical word the moment you use it — never assume the reader already knows it. Sprinkle in a couple of relevant emoji as visual props, the way a cartoon character would gesture. One working code example. Keep it tight.\n" .
                "B) A BUILD REQUEST (e.g. 'create a social media website', 'build me a blog', anything describing a project or feature) — this is the common case, and it needs the FULL treatment below, not a couple of snippets.\n\n" .
                "For a BUILD REQUEST, deliver all of this, in this exact order — structure and schema always come before any application code, never after:\n" .
                "1. A short, funny paragraph AS Codey framing what you're building and the sensible assumptions you made (never ask the user to clarify — just assume and say so in passing).\n" .
                "2. A file structure diagram (plain text tree) showing every file you're about to create.\n" .
                "3. The database schema as a fenced ```sql block, if the project needs persistent data — designed securely from the start (hashed passwords never plain text, correct types and lengths, foreign keys and indexes where they matter, NOT NULL where it matters).\n" .
                "4. A breakdown of the structure and schema simple enough for a total beginner to follow on the first read: what each top-level folder is for, what each table represents and why it has the columns it has, and why you made the security choices you made — stay in character as Codey here too (use an analogy, maybe a little emoji aside), don't drop into dry spec-sheet mode just because this section is technical.\n" .
                "5. Every PHP file the project actually needs to run end to end — at minimum: the entry point/router if relevant, controller(s), model(s), and view(s)/templates for the core feature, config where it matters. Don't stop at one controller for a multi-feature request — cover the features you listed in your framing paragraph. This must be a complete guide, not a code dump: before EVERY file's code block, give 1-3 sentences in Codey's voice on what that specific file does, why it exists, and anything notable in it (e.g. 'why this method is here', 'why this check matters'). Never present a code block with zero explanation around it — every single file gets its own mini walkthrough, however short.\n" .
                "6. A short 'how to run this' setup section (3-6 steps, no fluff) — still in Codey's voice, not a sudden tone shift to a formal README.\n" .
                "7. One closing line of encouragement with personality, not a generic sign-off.\n\n" .
                "Formatting rules, no exceptions:\n" .
                "- Every code file must start with its own '// path/to/file.php' comment on the first line inside the fence, and every fenced code block must have its closing ``` — never leave one open. Example:\n" .
                "```php\n// controllers/UserController.php\n<?php\nclass UserController extends Controller {\n    public function index() {\n        // ...\n    }\n}\n```\n" .
                "- Code must be correct, bug-free, and secure (prepared statements, input validation, output escaping) — weave the security reasoning into the explanation in plain English, don't just silently do it or list it as a boring checklist.\n" .
                "- Stay in character as Codey across every section of the response, including the technical ones — the voice should never flatten into a dry manual partway through. Keep the humor light, cartoonish and workplace-appropriate — silly analogies and playful emoji asides, never political, edgy, or divisive, and never at the expense of the actual technical substance.\n" .
                "- Language must stay at a total-beginner level throughout, not just in the first paragraph — no unexplained jargon anywhere in the response.\n" .
                "- NEVER ask a clarifying question or tell them to 'be more specific.' They came for a working answer, not an interview.";

            // Right-size the output budget instead of always paying for a
            // full build's worth of tokens on a one-line question.
            $answer = $this->isLikelyBuildRequest($prompt)
                ? $ai->generateCode($tutorPrompt)
                : $ai->answerQuestion($tutorPrompt);
            error_log("Preview - Response length: " . strlen($answer));
            
            if (empty($answer) || strlen($answer) < 50) {
                $answer = $this->getDefaultEducationalResponse($prompt);
            }
            
            $files = $this->extractFilesFromResponse($answer);

            $this->recordGeneration($userId);

            $this->json([
                'success' => true,
                'type' => count($files) > 0 ? 'code' : 'answer',
                'answer' => $answer,
                'files' => $files,
                'model' => $model
            ]);

        } catch (Exception $e) {
            error_log("Preview Error: " . $e->getMessage());
            
            $this->json([
                'success' => true,
                'type' => 'answer',
                'answer' => $this->getErrorResponse($prompt, $e->getMessage()),
                'files' => [],
                'model' => $model
            ]);
        }
    }
    
    /**
     * GENERATE ENDPOINT - Used by Generator.js for full project generation
     */
    public function generate() {
        header("Content-Type: application/json");
        
        // Check authentication
        try {
            $userId = $this->getCurrentUserId();
            error_log("Generate called for user: " . $userId);
        } catch (Exception $e) {
            $this->json([
                'success' => false,
                'error' => 'Authentication required'
            ], 401);
            return;
        }
        
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        $prompt = $data['prompt'] ?? '';
        $concept = $data['concept'] ?? 'mvc';
        $phpVersion = $data['php_version'] ?? '8.1';
        $projectId = $data['project_id'] ?? null;
        $model = $data['model'] ?? 'deepseek';
        
        if (empty($prompt)) {
            $this->json([
                'success' => false,
                'error' => 'Prompt is required'
            ], 400);
            return;
        }

        if (strlen($prompt) > self::MAX_PROMPT_LENGTH) {
            $this->json([
                'success' => false,
                'error' => 'That prompt is too long (max ' . self::MAX_PROMPT_LENGTH . ' characters). Trim it down and try again.'
            ], 400);
            return;
        }

        $limitResponse = $this->checkGenerationLimit($userId, $model);
        if ($limitResponse !== null) {
            $this->json($limitResponse, 429);
            return;
        }

        // A project_id only gets to influence the prompt or receive saved
        // files if it's actually owned by this user - otherwise silently
        // treat the request as starting a fresh project.
        if ($projectId && !(new Project())->findForUser($projectId, $userId)) {
            $projectId = null;
        }

        try {
            error_log("Generate - Starting with prompt: " . substr($prompt, 0, 100) . " (model: $model)");

            $ai = $this->getAIEngine($model);

            // Build the prompt
            $existingContext = $projectId ? $this->buildExistingProjectContext($projectId) : null;
            $aiPrompt = $this->buildProjectPrompt($prompt, $concept, $phpVersion, $existingContext);
            error_log("Generate - AI Prompt length: " . strlen($aiPrompt));
            
            // Generate the project
            $response = $ai->generateCode($aiPrompt);
            error_log("Generate - AI Response length: " . strlen($response));
            
            // Extract files from response
            $files = $this->extractFilesFromResponse($response);
            error_log("Generate - Files extracted: " . count($files));
            
            // Log the first few file names if any
            if (count($files) > 0) {
                $fileNames = array_keys($files);
                error_log("Generate - Files: " . implode(", ", array_slice($fileNames, 0, 5)));
            }
            
            // Format the answer
            $formattedAnswer = $this->formatProjectAnswer($response, $files, $prompt, $concept);
            
            // Save to database
            $generatedId = null;
            $overwrittenFiles = [];
            try {
                $saveResult = $this->saveGeneratedProject(
                    $userId,
                    $projectId,
                    $prompt,
                    $response,
                    $files,
                    $model
                );
                $generatedId = $saveResult['generation_id'];
                $overwrittenFiles = $saveResult['overwritten_files'];
            } catch (Exception $dbError) {
                error_log("Failed to save to database: " . $dbError->getMessage());
            }

            $this->recordGeneration($userId);

            $this->json([
                'success' => true,
                'type' => 'code',
                'answer' => $formattedAnswer,
                'files' => $files,
                'file_count' => count($files),
                'generation_id' => $generatedId,
                'overwritten_files' => $overwrittenFiles,
                'model' => $model
            ]);
            
        } catch (Exception $e) {
            error_log("Generate Error: " . $e->getMessage());
            error_log("Generate Error Trace: " . $e->getTraceAsString());
            
            $this->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * PLAN ENDPOINT - Used by Generator.js to break a heavy/bulk build
     * request (e.g. "build a hospital management system") into an ordered
     * list of smaller modules that can each be generated separately into
     * the same project, instead of attempting it all in one capped call.
     */
    public function plan() {
        header("Content-Type: application/json");

        try {
            $userId = $this->getCurrentUserId();
        } catch (Exception $e) {
            $this->json(['success' => false, 'error' => 'Authentication required'], 401);
            return;
        }

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        $prompt = $data['prompt'] ?? '';
        $model = $data['model'] ?? 'deepseek';

        if (empty($prompt)) {
            $this->json(['success' => false, 'error' => 'Prompt is required'], 400);
            return;
        }

        if (strlen($prompt) > self::MAX_PROMPT_LENGTH) {
            $this->json([
                'success' => false,
                'error' => 'That prompt is too long (max ' . self::MAX_PROMPT_LENGTH . ' characters). Trim it down and try again.'
            ], 400);
            return;
        }

        $limitResponse = $this->checkGenerationLimit($userId, $model);
        if ($limitResponse !== null) {
            $this->json($limitResponse, 429);
            return;
        }

        try {
            $ai = $this->getAIEngine($model);

            $planPrompt = "You are a software project planner. The user wants to build: \"" . $prompt . "\"\n\n" .
                "This may be too large to build in a single pass, so break it into a build plan. Respond with ONLY valid JSON, no prose, no markdown code fence, in exactly this shape:\n" .
                '{"foundation": {"description": "<fill in>", "files": ["path/one.php", "path/two.css"]}, "modules": [{"id": "short_slug", "name": "Human Readable Name", "description": "<fill in>"}]}' . "\n\n" .
                "Rules: 3-8 modules, ordered so an earlier module never depends on a later one. 'foundation' is always generated first and is not itself a module. Keep every description under 25 words. " .
                "Every description must be specific to THIS project - name the actual entities, pages, or features involved (e.g. \"Shared layout, DB connection, and the `products`/`orders` tables this store needs\"), not a generic template sentence about layout/DB/design-tokens that could apply to any project. Output raw JSON only - no code fence, no explanation before or after it.";

            $planResponse = $ai->answerQuestion($planPrompt);
            $plan = $this->parsePlanJson($planResponse);

            if (!$plan) {
                $this->json([
                    'success' => false,
                    'error' => "Couldn't break that down into a build plan. Try rephrasing, or just generate it directly instead."
                ], 200);
                return;
            }

            $this->recordGeneration($userId);

            $this->json([
                'success' => true,
                'plan' => $plan,
                'model' => $model
            ]);

        } catch (Exception $e) {
            error_log("Plan Error: " . $e->getMessage());
            $this->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Pull the plan JSON out of the AI's response even if it ignored the
     * "raw JSON only" instruction and wrapped it in a fence or a sentence.
     */
    private function parsePlanJson($raw) {
        $raw = trim((string)$raw);
        $raw = preg_replace('/^```[a-zA-Z]*\s*|\s*```$/', '', $raw);

        $decoded = json_decode($raw, true);

        if (!is_array($decoded) || !isset($decoded['modules'])) {
            if (preg_match('/\{.*\}/s', $raw, $m)) {
                $decoded = json_decode($m[0], true);
            }
        }

        if (!is_array($decoded) || !isset($decoded['modules']) || !is_array($decoded['modules'])) {
            return null;
        }

        // The frontend's module checklist only unlocks modules once the
        // foundation entry has a "Build" button to click - a plan missing a
        // usable foundation description would leave that checklist
        // permanently locked with no way forward, so treat it as invalid
        // rather than handing it to the UI half-usable.
        if (empty($decoded['foundation']['description']) || !is_string($decoded['foundation']['description'])) {
            return null;
        }

        // Each module needs a real id/name/description - a malformed entry
        // would otherwise render as a clickable row whose click bakes the
        // literal string "undefined" into the generation prompt.
        foreach ($decoded['modules'] as $module) {
            if (empty($module['id']) || empty($module['name']) || empty($module['description'])) {
                return null;
            }
        }

        return $decoded;
    }

    /**
     * Assemble the "what already exists in this project" context injected
     * into a follow-up generation, so module 2+ doesn't redefine or drift
     * away from what module 1 already built. Returns null for a project
     * with no files yet (i.e. this generation IS the first/foundation one).
     */
    private function buildExistingProjectContext($projectId) {
        $projectFileModel = new ProjectFile();
        $manifest = $projectFileModel->getManifest($projectId);

        if (empty($manifest)) {
            return null;
        }

        $parts = ["This project already has files from earlier generations. Do NOT recreate, rename, or redefine any of the paths listed below - only add the new files this specific request needs, and if you need to reference something that already exists, use its existing path/name exactly as given."];
        $parts[] = "\nExisting files in this project:";
        foreach ($manifest as $row) {
            $parts[] = "- " . $row['file_path'];
        }

        $foundation = $projectFileModel->getFoundationFiles($projectId);
        if (!empty($foundation)) {
            $parts[] = "\nShared foundation files - reuse their exact contents, structure, naming, and style verbatim. Do not introduce new colors, fonts, spacing values, navigation markup, or component patterns that aren't already established below; match what's already there instead of inventing a parallel style:";

            // Each file gets its own allowance so one large file can't starve
            // the rest, and an overall cap bounds total prompt growth. A file
            // that doesn't fit whole is NEVER truncated mid-content - cutting
            // a CSS/layout file off partway risks the model treating the
            // broken remainder as real and reusing it verbatim. A file that
            // can't fit whole is left out of the inlined content entirely and
            // only referenced by path instead.
            $perFileBudget = 6000; // characters
            $totalBudget = 24000; // characters - still a small fraction of any current model's context window
            $totalUsed = 0;
            $omittedPaths = [];

            foreach ($foundation as $path => $content) {
                $len = strlen($content);
                if ($len <= $perFileBudget && ($totalUsed + $len) <= $totalBudget) {
                    $parts[] = "```\n// " . $path . "\n" . $content . "\n```";
                    $totalUsed += $len;
                } else {
                    $omittedPaths[] = $path;
                }
            }

            if (!empty($omittedPaths)) {
                $parts[] = "\n(These foundation files exist and must still be reused by their exact path - do not recreate or guess at their contents, they were just too large to paste in full here: " . implode(', ', $omittedPaths) . ")";
            }
        }

        return implode("\n", $parts);
    }

    /**
     * Build project prompt
     */
    private function buildProjectPrompt($prompt, $concept, $phpVersion, $existingContext = null) {
        $continuationBlock = $existingContext
            ? ($existingContext . "\n\n---\n\n")
            : '';

        // A continuing generation must NOT be told to recreate the generic
        // skeleton below - it already exists in the project. Only a fresh,
        // standalone generation gets the fixed starter-file list.
        $filesBlock = $existingContext
            ? "Create exactly the files this specific request needs - nothing more. Do not create index.php, .htaccess, core/*, or config/database.php again; those already exist in this project (see above) and must be reused, not rewritten. Match the layout, navigation, typography, colors, and spacing already established in the foundation files shown above - this module should look and feel like it belongs to the same project, not a different one."
            : "Create ALL these files:
- index.php
- .htaccess
- config/database.php
- core/Controller.php
- core/Model.php
- core/Database.php
- core/Router.php
- controllers/HomeController.php
- controllers/UserController.php
- models/User.php
- views/layouts/main.php
- views/home/index.php
- views/users/index.php
- database/schema.sql";

        return $continuationBlock . "You are Codey the PHP Wizard 🧙 — a cartoon-like, upbeat coding mentor character. Stay in character as Codey for the ENTIRE response, including the technical sections — never crack one joke in the opener and then flatten into a dry manual. Create a complete " . $concept . " project for: " . $prompt . "

PHP Version: " . $phpVersion . "

Deliver everything in this exact order — structure and schema always come before any application code, never after:
1. A short, funny paragraph AS Codey framing what you're building and any sensible assumptions you made (never ask the user to clarify — just assume and say so in passing).
2. A complete file structure diagram (plain text tree).
3. The full database schema as a fenced ```sql block — designed securely from the start (hashed passwords never plain text, correct types and lengths, foreign keys and indexes where they matter, NOT NULL where it matters).
4. A breakdown of the structure and schema simple enough for a total beginner (someone who has never written a line of code) to follow on the first read: what each top-level folder is for, what each table represents and why it has the columns it has, and why you made the security choices you made. Use a concrete, everyday-object analogy, define any technical word the moment you use it, and sprinkle in a couple of relevant emoji as visual props — still in Codey's voice, not a sudden tone shift into spec-sheet mode.
5. Every file listed below, fully implemented. This must be a complete guide, not a code dump: before EVERY file's code block, give 1-3 sentences in Codey's voice on what that specific file does, why it exists, and anything notable in it. Never present a code block with zero explanation around it - every single file gets its own mini walkthrough, however short.
6. Step-by-step setup instructions (3-6 steps, no fluff) — still as Codey.
7. One closing line of encouragement with personality, not a generic sign-off.

CRITICAL: Format each file exactly like this example, including the closing code fence:
```php
// controllers/UserController.php
<?php
class UserController extends Controller {
    public function index() {
        // Code here
    }
}
```

" . $filesBlock . "

Code requirements (non-negotiable, this code may run in production):
- Every database query must use prepared statements / parameterized queries — never interpolate request data directly into SQL.
- Sanitize and validate all user input; escape all output that reaches HTML (e.g. htmlspecialchars) to prevent XSS.
- No deprecated or removed PHP functions. Code must run cleanly on PHP " . $phpVersion . " with no warnings or notices.
- Handle realistic edge cases (missing fields, invalid IDs, empty results) rather than assuming the happy path.

Tone: keep the humor light, cartoonish and workplace-appropriate — silly analogies and playful emoji asides woven in naturally throughout every section (not just the opener), never political, edgy, or divisive, and never at the expense of the actual technical substance. Language must stay at a total-beginner level the whole way through — no unexplained jargon anywhere. Make it extremely detailed and genuinely fun to read, like Codey is narrating the whole thing. Every code file must have the path comment at the top, and every code block must be properly closed with a matching ``` fence.";
}

/**

Extract files from AI response - FIXED VERSION
*/
private function extractFilesFromResponse($response) {
$files = array();
$ext = '(?:php|html|js|css|sql|json|xml|txt|md|htaccess|env)';

// Pattern 1: fenced code block with // filename.php as its first line
$pattern1 = '/```[a-zA-Z]*\s*\n\/\/\s*([^\n]+\.' . $ext . ')\s*\n(.*?)\n```/is';
if (preg_match_all($pattern1, $response, $matches, PREG_SET_ORDER)) {
foreach ($matches as $match) {
$filename = trim($match[1]);
$code = trim($match[2]);
if (!empty($filename) && !empty($code)) {
$files[$filename] = $code;
}
}
}

// Pattern 1b: same idea as Pattern 1, but for file-path comments written in
// a non-"//" comment style - "-- path" (SQL) or "# path" (shell/.env) as the
// fence's first line. Added because a real response used "-- database/schema.sql"
// and Pattern 1 (which only recognizes "//") missed it entirely, returning
// zero files despite the response containing a complete, usable file.
$pattern1b = '/```[a-zA-Z]*\s*\n(?:--|#)\s*([^\n]+\.' . $ext . ')\s*\n(.*?)\n```/is';
if (preg_match_all($pattern1b, $response, $matches, PREG_SET_ORDER)) {
foreach ($matches as $match) {
$filename = trim($match[1]);
$code = trim($match[2]);
if (!empty($filename) && !empty($code) && !isset($files[$filename])) {
$files[$filename] = $code;
}
}
}

// Pattern 1c: same as 1b, for "/* path */" block-comment style - CSS has no
// "//" comment syntax at all, so a CSS file can only ever be caught by
// Pattern 1 if it uses this style for its path comment.
$pattern1c = '/```[a-zA-Z]*\s*\n\/\*\s*([^\n*]+\.' . $ext . ')\s*\*\/\s*\n(.*?)\n```/is';
if (preg_match_all($pattern1c, $response, $matches, PREG_SET_ORDER)) {
foreach ($matches as $match) {
$filename = trim($match[1]);
$code = trim($match[2]);
if (!empty($filename) && !empty($code) && !isset($files[$filename])) {
$files[$filename] = $code;
}
}
}

// Pattern 2: ### filename.php heading directly above a fenced code block
$pattern2 = '/###\s+`?([^\n`]+\.' . $ext . ')`?\s*\n```[a-zA-Z]*\s*\n(.*?)\n```/is';
if (preg_match_all($pattern2, $response, $matches, PREG_SET_ORDER)) {
foreach ($matches as $match) {
$filename = trim($match[1]);
$code = trim($match[2]);
if (!empty($filename) && !empty($code) && !isset($files[$filename])) {
$files[$filename] = $code;
}
}
}

// Pattern 3: **filename.php** heading directly above a fenced code block
$pattern3 = '/\*\*([^\n*]+\.' . $ext . ')\*\*\s*\n```[a-zA-Z]*\s*\n(.*?)\n```/is';
if (preg_match_all($pattern3, $response, $matches, PREG_SET_ORDER)) {
foreach ($matches as $match) {
$filename = trim($match[1]);
$code = trim($match[2]);
if (!empty($filename) && !empty($code) && !isset($files[$filename])) {
$files[$filename] = $code;
}
}
}

// Pattern 4: File: filename.php / Path: filename.php label above a fenced code block
$pattern4 = '/(?:File|Path):\s*`?([^\n`]+\.' . $ext . ')`?\s*\n```[a-zA-Z]*\s*\n(.*?)\n```/is';
if (preg_match_all($pattern4, $response, $matches, PREG_SET_ORDER)) {
foreach ($matches as $match) {
$filename = trim($match[1]);
$code = trim($match[2]);
if (!empty($filename) && !empty($code) && !isset($files[$filename])) {
$files[$filename] = $code;
}
}
}

// Pattern 5: Look for any PHP code block and try to extract class name
if (empty($files)) {
$pattern5 = '/```(?:php)?\s*\n(.*?)\n```/is';
if (preg_match_all($pattern5, $response, $matches, PREG_SET_ORDER)) {
$counter = 1;
foreach ($matches as $match) {
$code = trim($match[1]);
if (!empty($code) && strpos($code, '<?php') !== false) {
// Try to extract class name
if (preg_match('/^\/\/\s*([^\n]+\.php)/', $code, $fileMatch)) {
$filename = trim($fileMatch[1]);
} elseif (preg_match('/class\s+(\w+)/', $code, $classMatch)) {
$filename = 'controllers/' . $classMatch[1] . '.php';
} else {
$filename = 'file_' . $counter . '.php';
}
$files[$filename] = $code;
$counter++;
}
}
}
}

return $files;
}

/**

Format project answer
*/
private function formatProjectAnswer($response, $files, $prompt, $concept) {
$projectName = $this->extractProjectName($prompt);

// If response is empty, return the response directly (might be loading)
if (empty($response)) {
return "# 🚀 Generating Your " . ucfirst($concept) . " Project: " . $projectName . "\n\n" .
"Please wait while I create your complete project...\n\n" .
"The project is being generated. This may take a moment. 🚀";
}

// If response is very short, return it as is
if (strlen($response) < 200) {
return $response;
}

$output = "# 🚀 " . ucfirst($concept) . " Project: " . $projectName . "\n\n";

if (count($files) > 0) {
$output .= "## 📁 Project Structure\n\n```\n";

// Build structure tree
$structure = array();
foreach ($files as $path => $content) {
$parts = explode('/', $path);
$current = &$structure;
foreach ($parts as $part) {
if (!isset($current[$part])) {
$current[$part] = array();
}
$current = &$current[$part];
}
$current['file'] = true;
}

$output .= $this->renderTree($structure);
$output .= "```\n\n";

$output .= "## 📄 Generated Files (" . count($files) . " files)\n\n";
foreach ($files as $path => $content) {
$size = round(strlen($content) / 1024, 2);
$output .= "- " . $path . " (" . $size . " KB)\n";
}
$output .= "\n---\n\n";
}

// Add the full AI response
$output .= $response;

$output .= "\n\n---\n\n";
$output .= "## 🎯 What You've Learned\n\n";
$output .= "- How to structure a " . $concept . " application\n";
$output .= "- Database design and CRUD operations\n";
$output .= "- Security best practices\n";
$output .= "- Professional PHP development techniques\n\n";

$output .= "## 🚀 Next Steps\n\n";
$output .= "1. Follow the setup instructions above\n";
$output .= "2. Run the code and test it\n";
$output .= "3. Modify and experiment\n";
$output .= "4. Add your own features\n\n";

$output .= "Keep coding! 🎓";

return $output;
}

/**

Render directory tree
*/
private function renderTree($structure, $indent = 0) {
$output = '';
foreach ($structure as $name => $children) {
if ($name === 'file') {
continue;
}

$isFile = isset($children['file']) && count($children) === 1;
$prefix = str_repeat(' ', $indent) . '├── ';
$output .= $prefix . $name . ($isFile ? '' : '/') . "\n";

if (!$isFile && is_array($children)) {
$output .= $this->renderTree($children, $indent + 1);
}
}
return $output;
}

/**

Get default educational response
*/
private function getDefaultEducationalResponse($prompt) {
return "# 🎓 Let me help you understand " . ucfirst($prompt) . "\n\n" .
"## What is this concept?\n\n" .
"I'll explain this in simple terms. " . ucfirst($prompt) . " is an important concept in PHP development.\n\n" .
"## Simple Explanation\n\n" .
"Think of it like this: " . $this->getAnalogyForPrompt($prompt) . "\n\n" .
"## Code Example\n\n" .
"php\n" . "<?php\n" . "// Here's a simple example to help you understand\n" . "// This shows the basic structure\n\n" . "// Example code would go here\n" . "// Try this out and see what happens!\n" . "\n\n" .
"## Key Points to Remember\n\n" .
"- Start with small examples\n" .
"- Practice writing code yourself\n" .
"- Don't be afraid to make mistakes\n\n" .
"Keep coding! 🚀";
}

/**

Get analogy based on prompt
*/
private function getAnalogyForPrompt($prompt) {
$lowerPrompt = strtolower($prompt);

if (strpos($lowerPrompt, 'mvc') !== false) {
return "a restaurant. The Model is the kitchen (handles data), the View is the dining area (what customers see), and the Controller is the waiter (handles requests and coordinates everything).";
} elseif (strpos($lowerPrompt, 'class') !== false || strpos($lowerPrompt, 'object') !== false) {
return "a cookie cutter (class) and the cookies (objects). The cutter defines the shape, and each cookie is an instance of that shape with its own sprinkles (properties).";
} elseif (strpos($lowerPrompt, 'database') !== false) {
return "a filing cabinet. Each drawer is a table, each folder is a record, and the index helps you find what you need quickly.";
} else {
return "building with LEGO blocks. Each block is a piece of code, and you connect them to build something amazing.";
}
}

/**

Get error response
*/
private function getErrorResponse($prompt, $error) {
$lower = strtolower($error);

if (strpos($lower, 'credit balance') !== false || strpos($lower, 'quota') !== false || strpos($lower, 'insufficient') !== false) {
    return "# 💳 This AI model is out of credits\n\n" .
        "The selected model's account is out of API credits, so it can't respond right now. Add credits/billing on that provider's dashboard, or switch to a different model in the selector above and try again.\n\n" .
        "_Details: {$error}_";
}

if (strpos($lower, 'not configured') !== false || strpos($lower, 'api key') !== false || strpos($lower, 'unauthorized') !== false || strpos($lower, 'invalid x-api-key') !== false) {
    return "# 🔑 This AI model isn't set up yet\n\n" .
        "The selected model doesn't have a valid API key configured on the server, so it can't respond. Try a different model in the selector above, or ask whoever runs this instance to add the missing key.\n\n" .
        "_Details: {$error}_";
}

if (strpos($lower, 'timed out') !== false || strpos($lower, 'timeout') !== false) {
    return "# ⏱️ That took too long\n\n" .
        "The AI service didn't respond in time. This usually clears up on a retry — give it another shot, maybe with a shorter prompt.\n\n" .
        "_Details: {$error}_";
}

return "# ⚠️ Something went wrong generating that\n\n" .
    "The AI service hit an error while working on \"" . htmlspecialchars($prompt, ENT_QUOTES, 'UTF-8') . "\". Try again, or switch models in the selector above.\n\n" .
    "_Details: {$error}_";
}

/**

Save generated project to database
*/
private function saveGeneratedProject($userId, $projectId, $prompt, $response, $files, $model) {
try {
if (!isset($GLOBALS['db']) || !$GLOBALS['db']) {
error_log("Cannot save to database: No connection");
return ['generation_id' => null, 'overwritten_files' => []];
}

$db = $GLOBALS['db'];

if (!$projectId) {
$projectName = $this->extractProjectName($prompt);

$stmt = $db->prepare("
INSERT INTO projects (user_id, project_name, framework, php_version, created_at, is_active)
VALUES (?, ?, ?, ?, NOW(), 1)
");

$stmt->execute([
$userId,
$projectName,
'mvc',
'8.1'
]);

$projectId = $db->lastInsertId();
error_log("Created new project with ID: " . $projectId);
}

$stmt = $db->prepare("
INSERT INTO generated_code
(user_id, project_id, prompt_text, generated_structure, generated_files, file_count, status, model_used, created_at)
VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, NOW())
");

$stmt->execute([
$userId,
$projectId,
$prompt,
substr($response, 0, 50000),
json_encode($files),
count($files),
$model
]);

$generationId = $db->lastInsertId();

$overwrittenFiles = [];

if (!empty($files)) {
    $projectFileModel = new ProjectFile();
    $existingManifest = $projectFileModel->getManifest($projectId);

    // Flag (not block) any path this generation is about to replace - the
    // upsert below still wins on conflict same as before, this just lets
    // the caller tell the user what got overwritten.
    $existingPaths = array_flip(array_column($existingManifest, 'file_path'));
    foreach (array_keys($files) as $path) {
        if (isset($existingPaths[$path])) {
            $overwrittenFiles[] = $path;
        }
    }

    // The first generation a project ever gets becomes its foundation -
    // whatever shared layout/config/CSS it defines gets reused verbatim
    // by every later module instead of each one reinventing its own.
    $isFirstGeneration = empty($existingManifest);
    $projectFileModel->upsertMany($projectId, $files, $generationId, $isFirstGeneration);
}

return ['generation_id' => $generationId, 'overwritten_files' => $overwrittenFiles];

} catch (Exception $e) {
error_log("Failed to save: " . $e->getMessage());
return ['generation_id' => null, 'overwritten_files' => []];
}
}

/**

Extract project name from prompt
*/
private function extractProjectName($prompt) {
$prompt = trim($prompt);
$prompt = preg_replace('/^(generate|create|build|make|help with|teach me|explain|hello|hi|what is|how to)\s+/i', '', $prompt);
$words = explode(' ', $prompt);
$name = implode(' ', array_slice($words, 0, 5));

if (strlen($name) < 3) {
$name = "PHP Project";
}

return ucwords(strtolower($name));
}
}