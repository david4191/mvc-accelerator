"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsProvider = exports.VirtualFileContentProvider = exports.VIRTUAL_FILE_SCHEME = void 0;
exports.isProjectNode = isProjectNode;
exports.projectIdOf = projectIdOf;
exports.projectNameOf = projectNameOf;
const vscode = __importStar(require("vscode"));
class ProjectNode {
    constructor(project) {
        this.project = project;
    }
}
class FileNode {
    constructor(projectId, path) {
        this.projectId = projectId;
        this.path = path;
    }
}
exports.VIRTUAL_FILE_SCHEME = 'mvc-accelerator-file';
/**
 * Serves a project's server-side file content as a read-only virtual
 * document (mvc-accelerator-file:/<projectId>/<path>) - browsing/opening a
 * file in Phase 2A never touches the local disk. Writing files locally is
 * a distinct, explicit action (Phase 2C's workspace sync).
 */
class VirtualFileContentProvider {
    constructor() {
        this.cache = new Map();
    }
    setContent(projectId, path, content) {
        this.cache.set(`${projectId}/${path}`, content);
    }
    provideTextDocumentContent(uri) {
        const key = `${uri.authority}${uri.path}`;
        return this.cache.get(key) ?? '// Unable to load this file\'s content.';
    }
}
exports.VirtualFileContentProvider = VirtualFileContentProvider;
class ProjectsProvider {
    constructor(api, auth, virtualFiles) {
        this.api = api;
        this.auth = auth;
        this.virtualFiles = virtualFiles;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
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
    async getChildren(element) {
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
exports.ProjectsProvider = ProjectsProvider;
function isProjectNode(node) {
    return node instanceof ProjectNode;
}
function projectIdOf(node) {
    if (node instanceof ProjectNode)
        return node.project.id;
    return undefined;
}
function projectNameOf(node) {
    if (node instanceof ProjectNode)
        return node.project.project_name;
    return undefined;
}
//# sourceMappingURL=ProjectsProvider.js.map