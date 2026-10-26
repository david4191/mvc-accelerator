const vscode = require('vscode');
const path = require('path');
const fs = require('fs-extra');

class FixProvider {
    constructor(context, apiService, authService) {
        this.context = context;
        this.apiService = apiService;
        this.authService = authService;
        this.outputChannel = vscode.window.createOutputChannel('MVC Fixer');
    }

    /**
     * Fix issues
     */
    async fix(selectedIssues = null) {
        try {
            // Check authentication
            const isAuthenticated = await this.authService.isAuthenticated();
            if (!isAuthenticated) {
                const login = await vscode.window.showWarningMessage(
                    'Please login to fix issues',
                    'Login',
                    'Cancel'
                );
                if (login === 'Login') {
                    vscode.commands.executeCommand('mvc-accelerator.login');
                }
                return;
            }

            // Get workspace folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Please open a project folder first');
                return;
            }

            const projectPath = workspaceFolders[0].uri.fsPath;

            // Get issues to fix
            let issues = selectedIssues;
            if (!issues) {
                issues = await this.selectIssuesToFix(projectPath);
            }

            if (!issues || issues.length === 0) {
                vscode.window.showInformationMessage('No issues selected to fix');
                return;
            }

            // Confirm fix
            const confirm = await vscode.window.showWarningMessage(
                `Fix ${issues.length} issue${issues.length > 1 ? 's' : ''}?`,
                { modal: true },
                'Fix All',
                'Preview Changes',
                'Cancel'
            );

            if (confirm === 'Cancel') return;

            if (confirm === 'Preview Changes') {
                await this.previewFixes(projectPath, issues);
                return;
            }

            // Apply fixes
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Fixing ${issues.length} issues...`,
                cancellable: true
            }, async (progress, token) => {
                token.onCancellationRequested(() => {
                    this.outputChannel.appendLine('Fix cancelled by user');
                });

                progress.report({ increment: 0, message: "Analyzing issues..." });

                // Get fixes from API
                const fixes = await this.apiService.post('/fix', {
                    projectPath,
                    issues
                });

                progress.report({ increment: 50, message: "Applying fixes..." });

                // Apply fixes
                const results = await this.applyFixes(projectPath, fixes);

                progress.report({ increment: 100, message: "Complete!" });

                this.log(`✅ Applied ${results.applied} fixes, ${results.failed} failed`);

                vscode.window.showInformationMessage(
                    `✅ Fixed ${results.applied} issues!`,
                    'View Changes',
                    'Rescan'
                ).then(selection => {
                    if (selection === 'View Changes') {
                        this.showChanges(results.changedFiles);
                    } else if (selection === 'Rescan') {
                        vscode.commands.executeCommand('mvc-accelerator.scan');
                    }
                });
            });

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Select issues to fix
     */
    async selectIssuesToFix(projectPath) {
        try {
            // Get project
            const projects = await this.apiService.get('/projects');
            const project = projects.find(p => p.project_path === projectPath);
            
            if (!project) {
                vscode.window.showErrorMessage('Project not found');
                return null;
            }

            // Get latest scan results
            const scans = await this.apiService.get(`/projects/${project.id}/scans`);
            if (!scans || scans.length === 0) {
                vscode.window.showInformationMessage('No scan results found. Please scan first.');
                return null;
            }

            const latestScan = scans[0];
            const issues = latestScan.issues_found ? JSON.parse(latestScan.issues_found) : [];

            if (issues.length === 0) {
                vscode.window.showInformationMessage('No issues found to fix');
                return null;
            }

            // Create quick pick items
            const items = issues.map(issue => ({
                label: `$(alert) ${issue.severity.toUpperCase()}: ${issue.description.substring(0, 50)}...`,
                description: issue.location,
                issue: issue,
                picked: issue.severity === 'critical' || issue.severity === 'high'
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select issues to fix',
                canPickMany: true,
                ignoreFocusOut: true
            });

            return selected ? selected.map(item => item.issue) : null;

        } catch (error) {
            this.log('Failed to get issues: ' + error.message);
            return null;
        }
    }

    /**
     * Preview fixes
     */
    async previewFixes(projectPath, issues) {
        try {
            const fixes = await this.apiService.post('/fix/preview', {
                projectPath,
                issues
            });

            if (!fixes || fixes.length === 0) {
                vscode.window.showInformationMessage('No changes to preview');
                return;
            }

            const panel = vscode.window.createWebviewPanel(
                'fixPreview',
                'Fix Preview',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.getPreviewHtml(fixes);

            panel.webview.onDidReceiveMessage(async message => {
                if (message.command === 'apply') {
                    panel.dispose();
                    this.fix(message.issues);
                } else if (message.command === 'viewDiff') {
                    await this.showDiff(message.file, message.original, message.fixed);
                }
            });

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Apply fixes
     */
    async applyFixes(projectPath, fixes) {
        const results = {
            applied: 0,
            failed: 0,
            changedFiles: []
        };

        for (const fix of fixes) {
            try {
                const filePath = path.join(projectPath, fix.file);
                
                // Create backup
                const backupPath = filePath + '.backup';
                await fs.copy(filePath, backupPath);
                
                // Apply fix
                await fs.writeFile(filePath, fix.content);
                
                results.applied++;
                results.changedFiles.push({
                    file: fix.file,
                    backup: backupPath
                });
                
                this.log(`Fixed: ${fix.file}`);
                
            } catch (error) {
                results.failed++;
                this.log(`Failed to fix ${fix.file}: ${error.message}`);
            }
        }

        return results;
    }

    /**
     * Show changes
     */
    async showChanges(changedFiles) {
        const items = changedFiles.map(file => ({
            label: path.basename(file.file),
            description: file.file,
            file: file
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select file to view changes'
        });

        if (selected) {
            await this.showDiff(selected.file.file, null, null, selected.file.backup);
        }
    }

    /**
     * Show diff
     */
    async showDiff(filePath, originalContent, fixedContent, backupPath = null) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const projectPath = workspaceFolders[0].uri.fsPath;
        const fullPath = path.join(projectPath, filePath);

        let originalUri;
        let modifiedUri;

        if (backupPath) {
            // Show diff between backup and current
            originalUri = vscode.Uri.file(backupPath);
            modifiedUri = vscode.Uri.file(fullPath);
        } else {
            // Create temporary files for preview
            const originalTemp = path.join(projectPath, '.temp', 'original_' + path.basename(filePath));
            const fixedTemp = path.join(projectPath, '.temp', 'fixed_' + path.basename(filePath));
            
            await fs.ensureDir(path.dirname(originalTemp));
            await fs.writeFile(originalTemp, originalContent);
            await fs.writeFile(fixedTemp, fixedContent);
            
            originalUri = vscode.Uri.file(originalTemp);
            modifiedUri = vscode.Uri.file(fixedTemp);
        }

        await vscode.commands.executeCommand('vscode.diff',
            originalUri,
            modifiedUri,
            `Changes: ${filePath}`
        );
    }

    /**
     * Get preview HTML
     */
    getPreviewHtml(fixes) {
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
                h2 { color: #2d3748; margin-bottom: 20px; }
                .fix-item {
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                .file-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .filename {
                    font-weight: 600;
                    color: #4299e1;
                }
                .changes {
                    background: #f7fafc;
                    padding: 10px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 0.9em;
                    white-space: pre-wrap;
                    margin: 10px 0;
                }
                .addition { color: #38a169; background: #f0fff4; }
                .deletion { color: #e53e3e; background: #fff5f5; }
                .btn {
                    background: #48bb78;
                    color: white;
                    border: none;
                    padding: 5px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                }
                .btn:hover { background: #38a169; }
                .btn-secondary {
                    background: #a0aec0;
                }
                .btn-secondary:hover { background: #718096; }
                .actions {
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                }
            </style>
        </head>
        <body>
            <h2>Fix Preview</h2>
            <p>Review the changes before applying:</p>
            
            ${fixes.map(fix => `
                <div class="fix-item">
                    <div class="file-header">
                        <span class="filename">${fix.file}</span>
                        <button class="btn btn-secondary" onclick="viewDiff('${fix.file}', '${fix.original.replace(/'/g, "\\'")}', '${fix.fixed.replace(/'/g, "\\'")}')">
                            View Diff
                        </button>
                    </div>
                    <div class="changes">
                        ${this.formatChanges(fix.changes)}
                    </div>
                </div>
            `).join('')}
            
            <div class="actions">
                <button class="btn" onclick="applyFixes()">Apply All Fixes</button>
                <button class="btn btn-secondary" onclick="cancel()">Cancel</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function viewDiff(file, original, fixed) {
                    vscode.postMessage({ 
                        command: 'viewDiff', 
                        file, 
                        original, 
                        fixed 
                    });
                }
                
                function applyFixes() {
                    vscode.postMessage({ 
                        command: 'apply', 
                        issues: ${JSON.stringify(fixes.map(f => f.issue))} 
                    });
                }
                
                function cancel() {
                    vscode.postMessage({ command: 'cancel' });
                }
            </script>
        </body>
        </html>`;
    }

    /**
     * Format changes
     */
    formatChanges(changes) {
        if (!changes) return '';
        
        return changes.split('\n').map(line => {
            if (line.startsWith('+')) {
                return `<span class="addition">${line}</span>`;
            } else if (line.startsWith('-')) {
                return `<span class="deletion">${line}</span>`;
            }
            return line;
        }).join('<br>');
    }

    /**
     * Log message
     */
    log(message) {
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }

    /**
     * Handle error
     */
    handleError(error) {
        this.log(`❌ Error: ${error.message}`);
        
        if (error.response?.status === 403) {
            vscode.window.showErrorMessage('Subscription required. Please upgrade your plan.');
            vscode.commands.executeCommand('mvc-accelerator.subscribe');
        } else {
            vscode.window.showErrorMessage('Fix failed: ' + error.message);
        }
    }
}

module.exports = { FixProvider };