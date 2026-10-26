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
exports.WorkspaceSync = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const PathSafety_1 = require("./PathSafety");
/**
 * Pulls a project's accumulated server-side files and reconciles them
 * against a user-chosen local folder. Never assumes the two are the same:
 * every path is read from disk and compared before any write decision is
 * made, and nothing gets written without an explicit per-file or
 * per-batch choice from the user.
 */
class WorkspaceSync {
    constructor(api) {
        this.api = api;
    }
    async chooseFolder() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Sync project files into this folder',
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
        });
        return uris?.[0]?.fsPath;
    }
    async planSync(projectId, workspaceRoot) {
        const res = await this.api.getProjectFiles(projectId);
        const items = [];
        for (const [relPath, serverContent] of Object.entries(res.data.files)) {
            const localAbsPath = (0, PathSafety_1.resolveSafePath)(workspaceRoot, relPath);
            if (!localAbsPath) {
                items.push({ path: relPath, localAbsPath: '', serverContent, status: 'unsafe' });
                continue;
            }
            let localContent;
            try {
                localContent = await fs.readFile(localAbsPath, 'utf8');
            }
            catch {
                localContent = undefined;
            }
            let status;
            if (localContent === undefined) {
                status = 'new';
            }
            else if (localContent === serverContent) {
                status = 'identical';
            }
            else {
                status = 'conflict';
            }
            items.push({ path: relPath, localAbsPath, serverContent, localContent, status });
        }
        return items;
    }
    async write(item) {
        await fs.ensureDir(path.dirname(item.localAbsPath));
        await fs.writeFile(item.localAbsPath, item.serverContent, 'utf8');
    }
}
exports.WorkspaceSync = WorkspaceSync;
//# sourceMappingURL=WorkspaceSync.js.map