<?php
// api/core/ProjectScanner.php
class ProjectScanner {
    private $projectPath;
    private $issues = [];
    
    public function __construct($projectPath) {
        $this->projectPath = $projectPath;
    }
    
    public function scanProject() {
        $this->scanSecurity();
        $this->scanSyntax();
        $this->scanStructure();
        $this->scanPerformance();
        
        return [
            'issues' => $this->issues,
            'summary' => $this->generateSummary()
        ];
    }
    
    private function scanSecurity() {
        $files = $this->getAllPhpFiles();
        
        foreach ($files as $file) {
            $content = file_get_contents($file);
            
            // Check for SQL injection vulnerabilities
            if (preg_match('/mysql_query\s*\(.*\$\_/i', $content)) {
                $this->addIssue($file, 'security', 'Potential SQL injection vulnerability', 'high');
            }
            
            // Check for XSS vulnerabilities
            if (preg_match('/echo\s*\$_(GET|POST|REQUEST)/i', $content)) {
                $this->addIssue($file, 'security', 'Unsanitized output - XSS risk', 'high');
            }
            
            // Check for hardcoded credentials
            if (preg_match('/password\s*=\s*[\'"]\w+[\'"]/i', $content)) {
                $this->addIssue($file, 'security', 'Hardcoded password detected', 'critical');
            }
            
            // Check for outdated functions
            $deprecated = ['mysql_', 'ereg', 'split'];
            foreach ($deprecated as $func) {
                if (strpos($content, $func) !== false) {
                    $this->addIssue($file, 'security', "Deprecated function: $func", 'medium');
                }
            }
        }
    }
    
    private function scanSyntax() {
        $files = $this->getAllPhpFiles();
        
        foreach ($files as $file) {
            $output = [];
            $returnVar = 0;
            exec("php -l " . escapeshellarg($file) . " 2>&1", $output, $returnVar);
            
            if ($returnVar !== 0) {
                $this->addIssue($file, 'syntax', implode("\n", $output), 'critical');
            }
        }
    }
    
    private function scanStructure() {
        // Check MVC structure
        $requiredDirs = ['controllers', 'models', 'views', 'config', 'public'];
        
        foreach ($requiredDirs as $dir) {
            if (!is_dir($this->projectPath . '/' . $dir)) {
                $this->addIssue('structure', 'Missing directory: ' . $dir, 'medium');
            }
        }
        
        // Check naming conventions
        $files = $this->getAllPhpFiles();
        foreach ($files as $file) {
            $filename = basename($file);
            if (preg_match('/Controller\.php$/', $filename)) {
                if (!preg_match('/^[A-Z]/', $filename)) {
                    $this->addIssue($file, 'structure', 'Controller should start with uppercase', 'low');
                }
            }
        }
    }
    
    private function scanPerformance() {
        $files = $this->getAllPhpFiles();
        
        foreach ($files as $file) {
            $content = file_get_contents($file);
            
            // Check for N+1 queries
            if (preg_match('/foreach.*?->(?:get|all)\(\)/', $content)) {
                $this->addIssue($file, 'performance', 'Potential N+1 query issue', 'medium');
            }
            
            // Check for inefficient loops
            if (preg_match('/while.*?mysql_fetch/', $content)) {
                $this->addIssue($file, 'performance', 'Inefficient database fetching', 'medium');
            }
        }
    }
    
    public function fixIssues($issues) {
        $fixes = [];
        
        foreach ($issues as $issue) {
            $fix = $this->applyFix($issue);
            if ($fix) {
                $fixes[] = $fix;
            }
        }
        
        return $fixes;
    }
    
    private function applyFix($issue) {
        switch ($issue['type']) {
            case 'security':
                return $this->fixSecurityIssue($issue);
            case 'syntax':
                return $this->fixSyntaxIssue($issue);
            case 'structure':
                return $this->fixStructureIssue($issue);
            case 'performance':
                return $this->fixPerformanceIssue($issue);
            default:
                return null;
        }
    }
    
    private function fixSecurityIssue($issue) {
        $file = $issue['file'];
        $content = file_get_contents($file);
        
        // Fix SQL injection - convert to prepared statements
        if (strpos($issue['description'], 'SQL injection') !== false) {
            $content = preg_replace(
                '/mysql_query\s*\(\s*([\'"])(.*?)\$\_(GET|POST|REQUEST)\[.*?\](.*?)\1\s*\)/i',
                "// FIXED: Use prepared statements\n// \$stmt = \$pdo->prepare('...');\n// \$stmt->execute([...]);",
                $content
            );
        }
        
        // Fix XSS - add htmlspecialchars
        if (strpos($issue['description'], 'XSS') !== false) {
            $content = preg_replace(
                '/echo\s*(\$_(GET|POST|REQUEST)\[.*?\])/i',
                'echo htmlspecialchars($1, ENT_QUOTES, \'UTF-8\')',
                $content
            );
        }
        
        file_put_contents($file, $content);
        return ['file' => $file, 'fix' => 'Applied security patch'];
    }
    
    private function getAllPhpFiles() {
        $files = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->projectPath)
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = $file->getPathname();
            }
        }
        
        return $files;
    }
    
    private function addIssue($location, $type, $description, $severity) {
        $this->issues[] = [
            'location' => $location,
            'type' => $type,
            'description' => $description,
            'severity' => $severity,
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }
    
    private function generateSummary() {
        $summary = [
            'total' => count($this->issues),
            'critical' => 0,
            'high' => 0,
            'medium' => 0,
            'low' => 0
        ];
        
        foreach ($this->issues as $issue) {
            $summary[$issue['severity']]++;
        }
        
        return $summary;
    }
}