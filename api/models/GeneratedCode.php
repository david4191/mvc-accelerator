<?php
// api/models/GeneratedCode.php

require_once __DIR__ . '/../core/Model.php';

class GeneratedCode extends Model {
    protected $table = 'generated_code';
    protected $primaryKey = 'id';
    
    /**
     * Get user generations with pagination
     */
    public function getUserGenerations($userId, $page = 1, $limit = 20) {
        $offset = ($page - 1) * $limit;
        
        $sql = "
            SELECT gc.*, p.project_name 
            FROM {$this->table} gc
            LEFT JOIN projects p ON gc.project_id = p.id
            WHERE gc.user_id = ?
            ORDER BY gc.created_at DESC
            LIMIT ? OFFSET ?
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get user generations count
     */
    public function getUserGenerationsCount($userId) {
        $stmt = $this->db->prepare("SELECT COUNT(*) as count FROM {$this->table} WHERE user_id = ?");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        return $result['count'];
    }
    
    /**
     * Get project generations
     */
    public function getProjectGenerations($projectId) {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table} 
            WHERE project_id = ? 
            ORDER BY created_at DESC 
            LIMIT 100
        ");
        $stmt->execute([$projectId]);
        return $stmt->fetchAll();
    }
    
    /**
     * Create generation record
     */
    public function create($data) {
        $sql = "INSERT INTO {$this->table} 
                (user_id, project_id, prompt_text, status, created_at) 
                VALUES (?, ?, ?, ?, ?)";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            $data['user_id'],
            $data['project_id'],
            $data['prompt_text'],
            $data['status'],
            $data['created_at']
        ]);
        
        return $this->db->lastInsertId();
    }
    
    /**
     * Update generation record
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
     * Get generation with project details
     */
    public function getWithProject($id) {
        $sql = "
            SELECT gc.*, p.project_name, p.project_path 
            FROM {$this->table} gc
            LEFT JOIN projects p ON gc.project_id = p.id
            WHERE gc.id = ?
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
    
    /**
     * Get recent generations
     */
    public function getRecent($userId, $limit = 10) {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table} 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        ");
        $stmt->execute([$userId, $limit]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get generation statistics
     */
    public function getStats($userId) {
        $sql = "
            SELECT 
                COUNT(*) as total_generations,
                SUM(file_count) as total_files,
                AVG(file_count) as avg_files,
                SUM(token_count) as total_tokens,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
            FROM {$this->table} 
            WHERE user_id = ?
        ";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
    
    /**
     * Get generations by date range
     */
    public function getByDateRange($userId, $startDate, $endDate) {
        $stmt = $this->db->prepare("
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM {$this->table} 
            WHERE user_id = ? 
                AND created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        ");
        $stmt->execute([$userId, $startDate, $endDate]);
        return $stmt->fetchAll();
    }
    
    /**
     * Delete old generations
     */
    public function deleteOld($days = 30) {
        $stmt = $this->db->prepare("
            DELETE FROM {$this->table} 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        ");
        return $stmt->execute([$days]);
    }
}