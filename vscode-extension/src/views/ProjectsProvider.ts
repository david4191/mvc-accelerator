import * as vscode from 'vscode';
import { ApiClient, Project } from '../api/ApiClient';
import { AuthManager } from '../auth/AuthManager';

type TreeNode = ProjectNode | FileNode;

class ProjectNode {
    constructor(public readonly project: Project) {}
}

class FileNode {
    constructor(public readonly projectId: number, public readonly path: string) {}
}

export const VIRTUAL_FILE_SCHEME = 'mvc-accelerator-file';

/**
 * Serves a project's server-side file content as a read-only virtual
 * document (mvc-accelerator-file:/<projectId>/<path>) - browsing/opening a
 * file in Phase 2A never touches the local disk. Writing files locally is
 * a distinct, explicit action (Phase 2C's workspace sync).
 */
export class VirtualFileContentProvider implements vscode.TextDocumentContentProvider {
    private cache = new Map<string, string>();

    setContent(projectId: number, path: string, content: string): void {
        this.cache.set(`${projectId}/${path}`, content);
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        const key = `${uri.authority}${uri.path}`;
        return this.cache.get(key) ?? '// Unable to load this file\'s content.';
    }
}

export class ProjectsProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private readonly api: ApiClient,
        private readonly auth: AuthManager,
        private readonly virtualFiles: VirtualFileContentProvider
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        if (element instanceof ProjectNode) {
            const item = new vscode.TreeItem(element.project.project_name, vscode.TreeItemCollapsibleState.Collapsed);
            item.description = `${element.project.framework} · PHP ${element.project.php_version}`;
            item.contextValue = 'project';
            item.id = `project-${element.project.id}`;
            item.iconPath = new vscode.ThemeIcon('folder');
            return item;
        }

        const item = new vscode.TreeItem(element.path, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'file';
        item.iconPath = new vscode.ThemeIcon('file');
        item.command = {
            command: 'mvcAccelerator.openProjectFile',
            title: 'Open',
            arguments: [element.projectId, element.path]
        };
        return item;
    }

    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        if (!this.auth.isAuthenticated()) {
            return [];
        }

        if (!element) {
            const res = await this.api.getProjects();
            return res.data.map((p) => new ProjectNode(p));
        }

        if (element instanceof ProjectNode) {
            const res = await this.api.getProjectFiles(element.project.id);
            for (const [path, content] of Object.entries(res.data.files)) {
                this.virtualFiles.setContent(element.project.id, path, content);
            }
            return Object.keys(res.data.files)
                .sort()
                .map((path) => new FileNode(element.project.id, path));
        }

        return [];
    }
}

export function isProjectNode(node: unknown): node is ProjectNode {
    return node instanceof ProjectNode;
}

export function projectIdOf(node: unknown): number | undefined {
    if (node instanceof ProjectNode) return node.project.id;
    return undefined;
}

export function projectNameOf(node: unknown): string | undefined {
    if (node instanceof ProjectNode) return node.project.project_name;
    return undefined;
}
