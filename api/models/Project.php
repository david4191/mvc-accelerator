<?php
// api/models/Project.php

require_once __DIR__ . '/../core/Model.php';

class Project extends Model {
    protected $table = 'projects';
    protected $primaryKey = 'id';
    
    /**
     * Get user projects with pagination
     */
    public function getUserProjects($userId, $page = 1, $limit = 20) {
        $offset = ($page - 1) * $limit;
        
        $sql = "
            SELECT p.*, 
                   COUNT(DISTINCT gc.id) as generation_count,
                   MAX(gc.created_at) as last_generation
            FROM {$this->table} p
            LEFT JOIN generated_code gc ON p.id = gc.project_id
            WHERE p.user_id = ? AND p.is_active = 1
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get user projects count
     */
    public function getUserProjectsCount($userId) {
        $stmt = $this->db->prepare("SELECT COUNT(*) as count FROM {$this->table} WHERE user_id = ? AND is_active = 1");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        return $result['count'];
    }
    
    /**
     * Find project by ID with user validation
     */
    public function findForUser($id, $userId) {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table} 
            WHERE id = ? AND user_id = ? AND is_active = 1
        ");
        $stmt->execute([$id, $userId]);
        return $stmt->fetch();
    }
    
    /**
     * Create new project
     */
    public function create($data) {
        $sql = "INSERT INTO {$this->table} 
                (user_id, project_name, project_path, framework, php_version, created_at, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            $data['user_id'],
            $data['project_name'],
            $data['project_path'],
            $data['framework'],
            $data['php_version'],
            $data['created_at'],
            $data['is_active']
        ]);
        
        return $this->db->lastInsertId();
    }
    
    /**
     * Update project
     */
    public function update($id, $data) {
        $sets = [];
        $params = [];
        
        foreach ($data as $key => $value) {
            $sets[] = "$key = ?";
            $params[] = $value;
        }
        
        $params[] = $id;
        
        $sql = "UPDATE {$this->table} SET " . implode(', ', $sets) . " WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }
    
    /**
     * Soft delete project
     */
    public function delete($id) {
        $stmt = $this->db->prepare("UPDATE {$this->table} SET is_active = 0 WHERE id = ?");
        return $stmt->execute([$id]);
    }
    
    /**
     * Get project with generations
     */
    public function getWithGenerations($id) {
        $sql = "
            SELECT p.*, 
                   gc.id as generation_id,
                   gc.prompt_text,
                   gc.file_count,
                   gc.created_at as generation_date
            FROM {$this->table} p
            LEFT JOIN generated_code gc ON p.id = gc.project_id
            WHERE p.id = ?
            ORDER BY gc.created_at DESC
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        
        $result = [
            'project' => null,
            'generations' => []
        ];
        
        while ($row = $stmt->fetch()) {
            if (!$result['project']) {
                $result['project'] = [
                    'id' => $row['id'],
                    'name' => $row['project_name'],
                    'path' => $row['project_path'],
                    'framework' => $row['framework'],
                    'php_version' => $row['php_version'],
                    'created_at' => $row['created_at']
                ];
            }
            
            if ($row['generation_id']) {
                $result['generations'][] = [
                    'id' => $row['generation_id'],
                    'prompt' => $row['prompt_text'],
                    'files' => $row['file_count'],
                    'created_at' => $row['generation_date']
                ];
            }
        }
        
        return $result;
    }
    
    /**
     * Search projects
     */
    public function search($userId, $query) {
        $sql = "
            SELECT * FROM {$this->table} 
            WHERE user_id = ? AND is_active = 1 
            AND (project_name LIKE ? OR project_path LIKE ?)
            ORDER BY created_at DESC
            LIMIT 50
        ";
        
        $searchTerm = "%$query%";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId, $searchTerm, $searchTerm]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get recent projects
     */
    public function getRecent($userId, $limit = 5) {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table} 
            WHERE user_id = ? AND is_active = 1 
            ORDER BY updated_at DESC 
            LIMIT ?
        ");
        $stmt->execute([$userId, $limit]);
        return $stmt->fetchAll();
    }
    
    /**
     * Update project path
     */
    public function updatePath($id, $path) {
        $stmt = $this->db->prepare("UPDATE {$this->table} SET project_path = ?, updated_at = NOW() WHERE id = ?");
        return $stmt->execute([$path, $id]);
    }
    
    /**
     * Get project statistics
     */
    public function getStats($id) {
        $sql = "
            SELECT 
                COUNT(DISTINCT gc.id) as total_generations,
                SUM(gc.file_count) as total_files,
                AVG(gc.file_count) as avg_files_per_generation,
                MIN(gc.created_at) as first_generation,
                MAX(gc.created_at) as last_generation
            FROM {$this->table} p
            LEFT JOIN generated_code gc ON p.id = gc.project_id
            WHERE p.id = ?
            GROUP BY p.id
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
}