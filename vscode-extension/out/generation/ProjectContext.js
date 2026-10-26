"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectContext = void 0;
/**
 * Tracks which project (if any) the user has explicitly chosen to continue
 * building, so every generation call in Phase 2B targets that exact
 * project_id instead of risking a fresh, unrelated project being created.
 */
class ProjectContext {
    set(projectId, projectName) {
        this._projectId = projectId;
        this._projectName = projectName;
    }
    clear() {
        this._projectId = undefined;
        this._projectName = undefined;
    }
    get projectId() {
        return this._projectId;
    }
    get projectName() {
        return this._projectName;
    }
}
exports.ProjectContext = ProjectContext;
//# sourceMappingURL=ProjectContext.js.map