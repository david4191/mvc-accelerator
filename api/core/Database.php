<?php
// api/core/Database.php

class Database {
    private static $instance = null;
    private $connection;
    private $config;
    
    private function __construct() {
        $this->config = require __DIR__ . '/../config/database.php';
        $this->connect();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function connect() {
        $connection = $this->config['connections'][$this->config['default']];
        
        try {
            $dsn = sprintf(
                "%s:host=%s;port=%s;dbname=%s;charset=%s",
                $connection['driver'],
                $connection['host'],
                $connection['port'],
                $connection['database'],
                $connection['charset']
            );
            
            $this->connection = new PDO(
                $dsn,
                $connection['username'],
                $connection['password'],
                $connection['options']
            );
            
        } catch (PDOException $e) {
            throw new Exception("Database connection failed: " . $e->getMessage());
        }
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    public function prepare($sql) {
        return $this->connection->prepare($sql);
    }
    
    public function query($sql) {
        return $this->connection->query($sql);
    }
    
    public function lastInsertId() {
        return $this->connection->lastInsertId();
    }
    
    public function beginTransaction() {
        return $this->connection->beginTransaction();
    }
    
    public function commit() {
        return $this->connection->commit();
    }
    
    public function rollBack() {
        return $this->connection->rollBack();
    }
    
    public function quote($value) {
        return $this->connection->quote($value);
    }
    
    /**
     * Execute query with parameters
     */
    public function execute($sql, $params = []) {
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
    
    /**
     * Fetch all results
     */
    public function fetchAll($sql, $params = []) {
        $stmt = $this->execute($sql, $params);
        return $stmt->fetchAll();
    }
    
    /**
     * Fetch single result
     */
    public function fetchOne($sql, $params = []) {
        $stmt = $this->execute($sql, $params);
        return $stmt->fetch();
    }
    
    /**
     * Get table schema
     */
    public function getTableSchema($table) {
        $sql = "DESCRIBE " . $this->quoteIdentifier($table);
        $stmt = $this->connection->query($sql);
        return $stmt->fetchAll();
    }
    
    /**
     * Quote identifier
     */
    public function quoteIdentifier($identifier) {
        return "`" . str_replace("`", "``", $identifier) . "`";
    }
    
    /**
     * Check if table exists
     */
    public function tableExists($table) {
        $sql = "SHOW TABLES LIKE ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->execute([$table]);
        return $stmt->rowCount() > 0;
    }
    
    /**
     * Get database size
     */
    public function getDatabaseSize() {
        $sql = "
            SELECT 
                table_schema as database_name,
                SUM(data_length + index_length) as size_bytes,
                COUNT(*) as table_count
            FROM information_schema.tables 
            WHERE table_schema = ?
            GROUP BY table_schema
        ";
        
        $stmt = $this->connection->prepare($sql);
        $stmt->execute([$this->config['connections'][$this->config['default']]['database']]);
        return $stmt->fetch();
    }
}