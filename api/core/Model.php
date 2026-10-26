<?php
// api/core/Model.php

class Model {
    protected $db;
    protected $table;
    protected $primaryKey = 'id';
    
    // Whitelist allowed table names
    private static $allowedTables = [
        'users', 'projects', 'generated_code', 'subscriptions',
        'api_keys', 'api_usage', 'code_scans', 'sessions', 'project_files'
    ];
    
    public function __construct() {
        if (empty($GLOBALS['db'])) {
            throw new Exception('Database connection is not available. Check your database configuration (api/.env) and that the database server is reachable.');
        }
        $this->db = $GLOBALS['db'];
    }
    
    /**
     * Validate table name against whitelist
     */
    protected function validateTableName($table) {
        if (!in_array($table, self::$allowedTables)) {
            throw new Exception("Invalid table name: " . $table);
        }
        return true;
    }
    
    /**
     * Find record by ID
     */
    public function find($id) {
        $this->validateTableName($this->table);
        $stmt = $this->db->prepare("SELECT * FROM `{$this->table}` WHERE `{$this->primaryKey}` = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
    
    /**
     * Get all records
     */
    public function all($limit = null, $offset = null) {
        $this->validateTableName($this->table);
        $sql = "SELECT * FROM `{$this->table}`";
        
        if ($limit !== null) {
            $sql .= " LIMIT " . (int)$limit;
        }
        
        if ($offset !== null) {
            $sql .= " OFFSET " . (int)$offset;
        }
        
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll();
    }
    
    /**
     * Where clause with parameter binding
     */
    public function where($conditions, $params = []) {
        $this->validateTableName($this->table);
        $sql = "SELECT * FROM `{$this->table}` WHERE ";
        
        $clauses = [];
        foreach ($conditions as $field => $value) {
            // Validate field name (only allow alphanumeric and underscore)
            if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $field)) {
                throw new Exception("Invalid field name: " . $field);
            }
            $clauses[] = "`$field` = ?";
            $params[] = $value;
        }
        
        $sql .= implode(' AND ', $clauses);
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }
    
    /**
     * Create record
     */
    public function create($data) {
        $fields = implode(', ', array_keys($data));
        $placeholders = implode(', ', array_fill(0, count($data), '?'));
        
        $sql = "INSERT INTO {$this->table} ($fields) VALUES ($placeholders)";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute(array_values($data));
        
        return $this->db->lastInsertId();
    }
    
    /**
     * Update record
     */
    public function update($id, $data) {
        $sets = [];
        $params = [];
        
        foreach ($data as $field => $value) {
            $sets[] = "$field = ?";
            $params[] = $value;
        }
        
        $params[] = $id;
        
        $sql = "UPDATE {$this->table} SET " . implode(', ', $sets) . " WHERE {$this->primaryKey} = ?";
        
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }
    
    /**
     * Delete record
     */
    public function delete($id) {
        $stmt = $this->db->prepare("DELETE FROM {$this->table} WHERE {$this->primaryKey} = ?");
        return $stmt->execute([$id]);
    }
    
    /**
     * Count records
     */
    public function count($conditions = []) {
        $sql = "SELECT COUNT(*) as count FROM {$this->table}";
        
        if (!empty($conditions)) {
            $clauses = [];
            $params = [];
            foreach ($conditions as $field => $value) {
                $clauses[] = "$field = ?";
                $params[] = $value;
            }
            $sql .= " WHERE " . implode(' AND ', $clauses);
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params ?? []);
        $result = $stmt->fetch();
        
        return $result['count'];
    }
    
    /**
     * Begin transaction
     */
    public function beginTransaction() {
        $this->db->beginTransaction();
    }
    
    /**
     * Commit transaction
     */
    public function commit() {
        $this->db->commit();
    }
    
    /**
     * Rollback transaction
     */
    public function rollBack() {
        $this->db->rollBack();
    }
    
    /**
     * Get last insert ID
     */
    public function lastInsertId() {
        return $this->db->lastInsertId();
    }
    
    /**
     * Paginate results
     */
    public function paginate($page = 1, $limit = DEFAULT_PAGE_SIZE, $conditions = []) {
        $offset = ($page - 1) * $limit;
        
        $sql = "SELECT * FROM {$this->table}";
        $countSql = "SELECT COUNT(*) as count FROM {$this->table}";
        $params = [];
        
        if (!empty($conditions)) {
            $clauses = [];
            foreach ($conditions as $field => $value) {
                $clauses[] = "$field = ?";
                $params[] = $value;
            }
            $whereClause = " WHERE " . implode(' AND ', $clauses);
            $sql .= $whereClause;
            $countSql .= $whereClause;
        }
        
        $sql .= " LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        // Get total count
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute(array_slice($params, 0, -2));
        $total = $countStmt->fetch()['count'];
        
        // Get paginated results
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $data = $stmt->fetchAll();
        
        return [
            'data' => $data,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => ceil($total / $limit)
            ]
        ];
    }
    
    
}











