<?php
// api/controllers/ProjectController.php

require_once __DIR__ . '/../core/Controller.php';
require_once __DIR__ . '/../models/Project.php';
require_once __DIR__ . '/../models/GeneratedCode.php';
require_once __DIR__ . '/../core/ProjectScanner.php';
require_once __DIR__ . '/../models/ProjectFile.php';

class ProjectController extends Controller {
    private $projectModel;
    private $generatedCodeModel;
    
    public function __construct() {
        $this->projectModel = new Project();
        $this->generatedCodeModel = new GeneratedCode();
    }

    /**
     * An expired/missing/invalid token must come back as 401 so the
     * frontend's existing 401-handling (clear session, redirect to login)
     * fires - not as a generic 500 or a silently-empty success response,
     * either of which previously let an expired session look like "you
     * have no projects" instead of "please log in again".
     */
    private function requireUserId() {
        try {
            return $this->getCurrentUserId();
        } catch (Throwable $e) {
            $this->json(['error' => 'Authentication required'], 401);
        }
    }

    /**
     * Create new project
     * POST /api/projects
     */
    public function store() {
        // Enable error logging
        error_reporting(E_ALL);
        ini_set('display_errors', 1);

        $userId = $this->requireUserId();

        try {
            // Log all request data for debugging
            error_log("========== PROJECT CREATE START ==========");
            error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
            error_log("Headers: " . print_r(getallheaders(), true));

            error_log("User ID: " . $userId);

            // Verify user exists in database
            $db = $GLOBALS['db'];
            $stmt = $db->prepare("SELECT id, email, username FROM users WHERE id = ? AND is_active = 1");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            if (!$user) {
                error_log("ERROR: User ID {$userId} does not exist in users table!");
                return $this->json(['error' => 'User not found in database'], 404);
            }
            
            error_log("User found: " . print_r($user, true));
            
            // Get POST data
            $input = file_get_contents('php://input');
            error_log("Raw input: " . $input);
            
            $data = json_decode($input, true);
            
            if (!$data) {
                error_log("ERROR: Invalid JSON data");
                return $this->json(['error' => 'Invalid JSON data'], 400);
            }
            
            error_log("Decoded data: " . print_r($data, true));
            
            // Validate required fields
            if (!isset($data['project_name']) || empty($data['project_name'])) {
                error_log("ERROR: Project name is missing");
                return $this->json(['error' => 'Project name is required'], 400);
            }
            
            // Prepare project data
            $projectData = [
                'user_id' => $userId,
                'project_name' => $data['project_name'],
                'project_path' => $data['project_path'] ?? null,
                'framework' => $data['framework'] ?? 'mvc',
                'php_version' => $data['php_version'] ?? '8.1',
                'created_at' => date('Y-m-d H:i:s'),
                'is_active' => 1
            ];
            
            error_log("Project data to insert: " . print_r($projectData, true));
            
            // Create project
            $projectId = $this->projectModel->create($projectData);
            
            if (!$projectId) {
                error_log("ERROR: Failed to create project - create() returned false/null");
                return $this->json(['error' => 'Failed to create project'], 500);
            }
            
            error_log("Project created successfully with ID: " . $projectId);
            error_log("========== PROJECT CREATE SUCCESS ==========");
            
            return $this->json([
                'success' => true,
                'message' => 'Project created successfully',
                'id' => $projectId,
                'project' => [
                    'id' => $projectId,
                    'project_name' => $projectData['project_name'],
                    'framework' => $projectData['framework'],
                    'php_version' => $projectData['php_version']
                ]
            ], 201);
            
        } catch (PDOException $e) {
            error_log("========== PDO EXCEPTION ==========");
            error_log("Error code: " . $e->getCode());
            error_log("Error message: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            
            // Check if it's a foreign key constraint error
            if (strpos($e->getMessage(), 'foreign key constraint fails') !== false) {
                return $this->json([
                    'error' => 'Invalid user. Please log in again.',
                    'debug' => 'Foreign key constraint violation - user may not exist'
                ], 400);
            }
            
            return $this->json([
                'error' => 'Database error',
                'debug' => APP_DEBUG ? $e->getMessage() : null
            ], 500);
            
        } catch (Exception $e) {
            error_log("========== GENERAL EXCEPTION ==========");
            error_log("Error message: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            
            return $this->json([
                'error' => $e->getMessage(),
                'debug' => APP_DEBUG ? $e->getTraceAsString() : null
            ], 500);
        }
    }
    
    /**
     * Get all projects for user
     * GET /api/projects
     */
    public function index() {
        $userId = $this->requireUserId();
        try {
            $projects = $this->projectModel->getUserProjects($userId, 1, 100);

            return $this->json([
                'success' => true,
                'data' => $projects
            ]);

        } catch (Exception $e) {
            error_log("Projects index error: " . $e->getMessage());
            return $this->json([
                'success' => true,
                'data' => []
            ]);
        }
    }
    
    /**
     * Get single project
     * GET /api/projects/{id}
     */
    public function show($id) {
        $userId = $this->requireUserId();
        try {
            $project = $this->projectModel->find($id);
            
            if (!$project || $project['user_id'] != $userId) {
                return $this->json(['error' => 'Project not found'], 404);
            }
            
            // Get generation history
            $generations = $this->generatedCodeModel->getProjectGenerations($id);
            
            return $this->json([
                'success' => true,
                'data' => [
                    'project' => $project,
                    'generations' => $generations
                ]
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    
    /**
     * Update project
     * PUT /api/projects/{id}
     */
    public function update($id) {
        $userId = $this->requireUserId();
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            $project = $this->projectModel->find($id);
            
            if (!$project || $project['user_id'] != $userId) {
                return $this->json(['error' => 'Project not found'], 404);
            }
            
            $updateData = [
                'project_name' => $data['project_name'] ?? $project['project_name'],
                'project_path' => $data['project_path'] ?? $project['project_path'],
                'framework' => $data['framework'] ?? $project['framework'],
                'php_version' => $data['php_version'] ?? $project['php_version'],
                'updated_at' => date('Y-m-d H:i:s')
            ];
            
            $success = $this->projectModel->update($id, $updateData);
            
            return $this->json([
                'success' => $success,
                'message' => $success ? 'Project updated successfully' : 'Failed to update project'
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Delete project
     * DELETE /api/projects/{id}
     */
    public function destroy($id) {
        $userId = $this->requireUserId();
        try {
            $project = $this->projectModel->find($id);
            
            if (!$project || $project['user_id'] != $userId) {
                return $this->json(['error' => 'Project not found'], 404);
            }
            
            // Soft delete
            $success = $this->projectModel->delete($id);
            
            return $this->json([
                'success' => $success,
                'message' => $success ? 'Project deleted successfully' : 'Failed to delete project'
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Merged current file tree for a project, accumulated across every
     * generation made into it so far (not just its latest one).
     * GET /api/projects/{id}/files
     */
    public function files($id) {
        $userId = $this->requireUserId();
        try {
            $project = $this->projectModel->find($id);

            if (!$project || $project['user_id'] != $userId) {
                return $this->json(['error' => 'Project not found'], 404);
            }

            $projectFileModel = new ProjectFile();
            $files = $projectFileModel->getAll($id);

            // Lets the frontend recognize "this project already has a
            // foundation" when re-planning a build for it, instead of
            // presenting Foundation as unbuilt just because a fresh plan
            // object has no memory of earlier generations.
            $hasFoundation = !empty($projectFileModel->getFoundationFiles($id));

            return $this->json([
                'success' => true,
                'data' => [
                    'files' => $files,
                    'file_count' => count($files),
                    'has_foundation' => $hasFoundation
                ]
            ]);

        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Scan project for issues
     * POST /api/projects/{id}/scan
     */
    public function scan($id) {
        $userId = $this->requireUserId();
        try {
            $project = $this->projectModel->find($id);
            
            if (!$project || $project['user_id'] != $userId) {
                return $this->json(['error' => 'Project not found'], 404);
            }
            
            if (!$project['project_path']) {
                return $this->json(['error' => 'Project path not set'], 400);
            }
            
            // Check subscription
            if (!$this->checkSubscription($userId)) {
                return $this->json(['error' => 'Active subscription required'], 403);
            }
            
            // Initialize scanner
            $scanner = new ProjectScanner($project['project_path']);
            
            // Perform scan
            $scanResult = $scanner->scanProject();
            
            // Save scan results
            $this->saveScanResults($id, $userId, $scanResult);
            
            return $this->json([
                'success' => true,
                'data' => $scanResult
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Get project scan history
     * GET /api/projects/{id}/scans
     */
    public function getScans($id) {
        $userId = $this->requireUserId();
        try {
            $project = $this->projectModel->find($id);
            
            if (!$project || $project['user_id'] != $userId) {
                return $this->json(['error' => 'Project not found'], 404);
            }
            
            $db = $GLOBALS['db'];
            $stmt = $db->prepare("
                SELECT * FROM code_scans 
                WHERE project_id = ? 
                ORDER BY created_at DESC 
                LIMIT 50
            ");
            $stmt->execute([$id]);
            $scans = $stmt->fetchAll();
            
            return $this->json([
                'success' => true,
                'data' => $scans
            ]);
            
        } catch (Exception $e) {
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Save scan results
     */
    private function saveScanResults($projectId, $userId, $scanResult) {
        $db = $GLOBALS['db'];
        $stmt = $db->prepare("
            INSERT INTO code_scans 
            (project_id, user_id, scan_type, issues_found, scan_status, created_at) 
            VALUES (?, ?, 'syntax', ?, 'completed', NOW())
        ");
        $stmt->execute([
            $projectId,
            $userId,
            json_encode($scanResult['issues'])
        ]);
    }
}










