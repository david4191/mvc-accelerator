/**
 * Tracks which project (if any) the user has explicitly chosen to continue
 * building, so every generation call in Phase 2B targets that exact
 * project_id instead of risking a fresh, unrelated project being created.
 */
export class ProjectContext {
    private _projectId: number | undefined;
    private _projectName: string | undefined;

    set(projectId: number, projectName: string): void {
        this._projectId = projectId;
        this._projectName = projectName;
    }

    clear(): void {
        this._projectId = undefined;
        this._projectName = undefined;
    }

    get projectId(): number | undefined {
        return this._projectId;
    }

    get projectName(): string | undefined {
        return this._projectName;
    }
}
