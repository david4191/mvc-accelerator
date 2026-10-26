<?php
// api/models/ProjectFile.php

require_once __DIR__ . '/../core/Model.php';

class ProjectFile extends Model {
    protected $table = 'project_files';
    protected $primaryKey = 'id';

    /**
     * Merge a generation's files into the project's accumulated file tree,
     * one row per path. A path already present is overwritten in place -
     * the newest generation always wins for that path.
     */
    public function upsertMany($projectId, array $files, $generationId, $isFoundation = false) {
        if (empty($files)) {
            return;
        }

        $stmt = $this->db->prepare("
            INSERT INTO project_files (project_id, file_path, content, source_generation_id, is_foundation, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                content = VALUES(content),
                source_generation_id = VALUES(source_generation_id),
                updated_at = NOW()
        ");

        foreach ($files as $path => $content) {
            $stmt->execute([$projectId, substr($path, 0, 300), $content, $generationId, $isFoundation ? 1 : 0]);
        }
    }

    /**
     * Lightweight manifest (paths only) for prompting - avoids paying full
     * file content as context on every follow-up generation.
     */
    public function getManifest($projectId) {
        $stmt = $this->db->prepare("SELECT file_path, is_foundation FROM project_files WHERE project_id = ? ORDER BY file_path");
        $stmt->execute([$projectId]);
        return $stmt->fetchAll();
    }

    /**
     * Full merged file tree for a project (path => content).
     */
    public function getAll($projectId) {
        $stmt = $this->db->prepare("SELECT file_path, content FROM project_files WHERE project_id = ? ORDER BY file_path");
        $stmt->execute([$projectId]);
        $rows = $stmt->fetchAll();

        $files = [];
        foreach ($rows as $row) {
            $files[$row['file_path']] = $row['content'];
        }
        return $files;
    }

    /**
     * The shared base files (layout, config, CSS) locked in from a
     * project's first generation, injected into every later module's
     * prompt so visual/structural style stays consistent.
     */
    public function getFoundationFiles($projectId) {
        $stmt = $this->db->prepare("SELECT file_path, content FROM project_files WHERE project_id = ? AND is_foundation = 1 ORDER BY file_path");
        $stmt->execute([$projectId]);
        $rows = $stmt->fetchAll();

        $files = [];
        foreach ($rows as $row) {
            $files[$row['file_path']] = $row['content'];
        }
        return $files;
    }
}
