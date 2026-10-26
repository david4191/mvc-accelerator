<?php
// api/controllers/UserController.php

require_once __DIR__ . '/../core/Controller.php';
require_once __DIR__ . '/../models/User.php';

class UserController extends Controller {
    private $userModel;
    
    public function __construct() {
        $this->userModel = new User();
    }

    /**
     * An expired/missing/invalid token must come back as 401 so callers'
     * existing 401-handling (clear session, prompt re-login) fires - not as
     * a generic 500, which previously happened because getCurrentUserId()'s
     * exception was caught by the same catch block as real server errors.
     */
    private function requireUserId() {
        try {
            return $this->getCurrentUserId();
        } catch (Throwable $e) {
            $this->json(['error' => 'Authentication required'], 401);
        }
    }

    /**
     * Get user profile
     * GET /api/user/profile
     */
    public function profile() {
        $userId = $this->requireUserId();
        try {
            error_log("UserController::profile - User ID: " . $userId);
            
            $user = $this->userModel->find($userId);
            
            if (!$user) {
                error_log("UserController::profile - User not found: " . $userId);
                return $this->json(['error' => 'User not found'], 404);
            }
            
            // Remove sensitive data
            unset($user['password_hash']);
            
            error_log("UserController::profile - Success for user: " . $user['email']);
            
            return $this->json([
                'success' => true,
                'user' => $user
            ]);
            
        } catch (Exception $e) {
            error_log("UserController::profile - Error: " . $e->getMessage());
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * Update user profile
     * PUT /api/user/profile
     */
   public function updateProfile() {
    $userId = $this->requireUserId();
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        error_log("========== UPDATE PROFILE CALLED ==========");
        error_log("User ID: " . $userId);
        error_log("Raw input: " . file_get_contents('php://input'));
        error_log("Decoded data: " . print_r($data, true));
        
        $user = $this->userModel->find($userId);
        
        if (!$user) {
            error_log("User not found: " . $userId);
            return $this->json(['error' => 'User not found'], 404);
        }
        
        $updateData = [];
        
        if (isset($data['fullname'])) {
            $updateData['fullname'] = $data['fullname'];
            error_log("Setting fullname to: " . $data['fullname']);
        }
        
        if (isset($data['email'])) {
            // Check if email already exists
            $existingUser = $this->userModel->findByEmail($data['email']);
            if ($existingUser && $existingUser['id'] != $userId) {
                error_log("Email already in use: " . $data['email']);
                return $this->json(['error' => 'Email already in use'], 409);
            }
            $updateData['email'] = $data['email'];
            error_log("Setting email to: " . $data['email']);
        }
        
        if (!empty($updateData)) {
            $updateData['updated_at'] = date('Y-m-d H:i:s');
            error_log("Update data to save: " . print_r($updateData, true));
            
            $result = $this->userModel->update($userId, $updateData);
            error_log("Update result: " . ($result ? 'true' : 'false'));
        } else {
            error_log("No data to update");
        }
        
        // Get updated user
        $updatedUser = $this->userModel->find($userId);
        unset($updatedUser['password_hash']);
        
        error_log("Updated user: " . print_r($updatedUser, true));
        error_log("========== UPDATE PROFILE COMPLETE ==========");
        
        return $this->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => $updatedUser
        ]);
         
    } catch (Exception $e) {
        error_log("========== UPDATE PROFILE ERROR ==========");
        error_log("Error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        return $this->json(['error' => $e->getMessage()], 500);
    }
}
    
    /**
     * Change password
     * POST /api/user/change-password
     */
    public function changePassword() {
        $userId = $this->requireUserId();
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            error_log("UserController::changePassword - User ID: " . $userId);
            
            if (!isset($data['current_password']) || !isset($data['new_password'])) {
                return $this->json(['error' => 'Current password and new password are required'], 400);
            }
            
            $user = $this->userModel->find($userId);
            
            if (!$user) {
                return $this->json(['error' => 'User not found'], 404);
            }
            
            // Verify current password
            if (!password_verify($data['current_password'], $user['password_hash'])) {
                error_log("UserController::changePassword - Invalid current password for user: " . $userId);
                return $this->json(['error' => 'Current password is incorrect'], 401);
            }
            
            // Validate new password strength
            if (strlen($data['new_password']) < 8) {
                return $this->json(['error' => 'Password must be at least 8 characters'], 400);
            }
            
            // Hash new password
            $hashedPassword = password_hash($data['new_password'], PASSWORD_BCRYPT);
            
            // Update password
            $this->userModel->update($userId, [
                'password_hash' => $hashedPassword,
                'updated_at' => date('Y-m-d H:i:s')
            ]);
            
            error_log("UserController::changePassword - Password changed for user: " . $userId);
            
            return $this->json([
                'success' => true,
                'message' => 'Password changed successfully'
            ]);
            
        } catch (Exception $e) {
            error_log("UserController::changePassword - Error: " . $e->getMessage());
            return $this->json(['error' => $e->getMessage()], 500);
        }
    }
    
    /**
 * Update record
 */
public function update($id, $data) {
    try {
        $sets = [];
        $params = [];
        
        foreach ($data as $field => $value) {
            $sets[] = "$field = ?";
            $params[] = $value;
        }
        
        $params[] = $id;
        
        $sql = "UPDATE {$this->table} SET " . implode(', ', $sets) . " WHERE {$this->primaryKey} = ?";
        
        error_log("Model::update - SQL: " . $sql);
        error_log("Model::update - Params: " . print_r($params, true));
        
        $stmt = $this->db->prepare($sql);
        $result = $stmt->execute($params);
        
        if ($result) {
            error_log("Model::update - Success, rows affected: " . $stmt->rowCount());
        } else {
            error_log("Model::update - Failed");
        }
        
        return $result;
    } catch (Exception $e) {
        error_log("Model::update - Exception: " . $e->getMessage());
        throw $e;
    }
}
}