import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ApiClient } from '../api/ApiClient';
import { resolveSafePath } from './PathSafety';

export type SyncStatus = 'new' | 'identical' | 'conflict' | 'unsafe';

export interface SyncPlanItem {
    path: string;
    localAbsPath: string;
    serverContent: string;
    localContent?: string;
    status: SyncStatus;
}

/**
 * Pulls a project's accumulated server-side files and reconciles them
 * against a user-chosen local folder. Never assumes the two are the same:
 * every path is read from disk and compared before any write decision is
 * made, and nothing gets written without an explicit per-file or
 * per-batch choice from the user.
 */
export class WorkspaceSync {
    constructor(private readonly api: ApiClient) {}

    async chooseFolder(): Promise<string | undefined> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Sync project files into this folder',
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
        });
        return uris?.[0]?.fsPath;
    }

    async planSync(projectId: number, workspaceRoot: string): Promise<SyncPlanItem[]> {
        const res = await this.api.getProjectFiles(projectId);
        const items: SyncPlanItem[] = [];

        for (const [relPath, serverContent] of Object.entries(res.data.files)) {
            const localAbsPath = resolveSafePath(workspaceRoot, relPath);
            if (!localAbsPath) {
                items.push({ path: relPath, localAbsPath: '', serverContent, status: 'unsafe' });
                continue;
            }

            let localContent: string | undefined;
            try {
                localContent = await fs.readFile(localAbsPath, 'utf8');
            } catch {
                localContent = undefined;
            }

            let status: SyncStatus;
            if (localContent === undefined) {
                status = 'new';
            } else if (localContent === serverContent) {
                status = 'identical';
            } else {
                status = 'conflict';
            }

            items.push({ path: relPath, localAbsPath, serverContent, localContent, status });
        }

        return items;
    }

    async write(item: SyncPlanItem): Promise<void> {
        await fs.ensureDir(path.dirname(item.localAbsPath));
        await fs.writeFile(item.localAbsPath, item.serverContent, 'utf8');
    }
}
