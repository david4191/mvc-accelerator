const vscode = require('vscode');
const path = require('path');
const fs = require('fs-extra');

class ScannerProvider {
    constructor(context, apiService, authService) {
        this.context = context;
        this.apiService = apiService;
        this.authService = authService;
        this.outputChannel = vscode.window.createOutputChannel('MVC Scanner');
        this.diagnostics = vscode.languages.createDiagnosticCollection('mvc-accelerator');
    }

    /**
     * Scan entire project
     */
    async scan() {
        try {
            // Check authentication
            const isAuthenticated = await this.authService.isAuthenticated();
            if (!isAuthenticated) {
                const login = await vscode.window.showWarningMessage(
                    'Please login to scan projects',
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

            // Create or get project
            let project = await this.getOrCreateProject(projectPath);
            
            if (!project) {
                vscode.window.showErrorMessage('Failed to create/get project');
                return;
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Scanning project for issues...",
                cancellable: true
            }, async (progress, token) => {
                token.onCancellationRequested(() => {
                    this.outputChannel.appendLine('Scan cancelled by user');
                });

                progress.report({ increment: 0, message: "Analyzing code structure..." });
                this.log('Starting project scan...');

                // Perform scan
                const scanResult = await this.apiService.post(`/projects/${project.id}/scan`, {
                    projectPath
                });

                progress.report({ increment: 50, message: "Analyzing issues..." });

                // Process results
                await this.processScanResults(scanResult, projectPath);

                progress.report({ increment: 100, message: "Scan complete!" });

                this.log(`✅ Scan complete. Found ${scanResult.issues.length} issues.`);

                // Show results
                this.showScanResults(scanResult);
            });

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Scan single file
     */
    async scanFile(filePath) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;

            const projectPath = workspaceFolders[0].uri.fsPath;
            const relativePath = path.relative(projectPath, filePath);

            // Skip if not PHP file
            if (!filePath.endsWith('.php')) return;

            const project = await this.getOrCreateProject(projectPath);
            if (!project) return;

            const scanResult = await this.apiService.post(`/projects/${project.id}/scan-file`, {
                filePath: relativePath
            });

            // Update diagnostics
            this.updateDiagnostics(filePath, scanResult.issues);

        } catch (error) {
            // Silently fail for background scans
            console.error('File scan failed:', error);
        }
    }

    /**
     * Get or create project
     */
    async getOrCreateProject(projectPath) {
        try {
            const projects = await this.apiService.get('/projects');
            const existing = projects.find(p => p.project_path === projectPath);
            
            if (existing) {
                return existing;
            }

            // Create new project
            const projectName = path.basename(projectPath);
            const newProject = await this.apiService.post('/projects', {
                project_name: projectName,
                project_path: projectPath
            });

            return newProject;

        } catch (error) {
            this.log('Failed to get/create project: ' + error.message);
            return null;
        }
    }

    /**
     * Process scan results
     */
    async processScanResults(scanResult, projectPath) {
        // Clear existing diagnostics
        this.diagnostics.clear();

        // Group issues by file
        const issuesByFile = {};
        scanResult.issues.forEach(issue => {
            const filePath = path.join(projectPath, issue.location);
            if (!issuesByFile[filePath]) {
                issuesByFile[filePath] = [];
            }
            issuesByFile[filePath].push(issue);
        });

        // Update diagnostics for each file
        for (const [filePath, issues] of Object.entries(issuesByFile)) {
            this.updateDiagnostics(filePath, issues);
        }

        // Save scan to history
        await this.saveScanHistory(scanResult);
    }

    /**
     * Update diagnostics for a file
     */
    updateDiagnostics(filePath, issues) {
        const diagnostics = issues.map(issue => {
            const severity = this.getDiagnosticSeverity(issue.severity);
            const range = this.extractIssueRange(issue);
            
            return new vscode.Diagnostic(range, issue.description, severity);
        });

        this.diagnostics.set(vscode.Uri.file(filePath), diagnostics);
    }

    /**
     * Get diagnostic severity
     */
    getDiagnosticSeverity(severity) {
        switch (severity) {
            case 'critical':
            case 'high':
                return vscode.DiagnosticSeverity.Error;
            case 'medium':
                return vscode.DiagnosticSeverity.Warning;
            case 'low':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Hint;
        }
    }

    /**
     * Extract issue range from description
     */
    extractIssueRange(issue) {
        // Try to extract line number from description
        const lineMatch = issue.description.match(/line (\d+)/i);
        if (lineMatch) {
            const line = parseInt(lineMatch[1]) - 1;
            return new vscode.Range(line, 0, line, 1000);
        }

        // Default to first line
        return new vscode.Range(0, 0, 0, 0);
    }

    /**
     * Show scan results
     */
    async showScanResults(scanResult) {
        const summary = scanResult.summary;
        
        const message = `Scan complete: ${summary.total} issues found ` +
                       `(${summary.critical} critical, ${summary.high} high, ` +
                       `${summary.medium} medium, ${summary.low} low)`;

        const action = await vscode.window.showInformationMessage(
            message,
            'View Details',
            'Fix Issues',
            'Ignore'
        );

        if (action === 'View Details') {
            this.showIssuesPanel(scanResult);
        } else if (action === 'Fix Issues') {
            vscode.commands.executeCommand('mvc-accelerator.fix');
        }
    }

    /**
     * Show issues panel
     */
    showIssuesPanel(scanResult) {
        const panel = vscode.window.createWebviewPanel(
            'mvcIssues',
            'Scan Results',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getIssuesHtml(scanResult);

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'fix') {
                vscode.commands.executeCommand('mvc-accelerator.fix', message.issues);
                panel.dispose();
            } else if (message.command === 'openFile') {
                const uri = vscode.Uri.file(message.file);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document, {
                    selection: new vscode.Range(message.line, 0, message.line, 0)
                });
            }
        });
    }

    /**
     * Get issues HTML
     */
    getIssuesHtml(scanResult) {
        const issues = scanResult.issues;
        const summary = scanResult.summary;

        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
                .header { margin-bottom: 20px; }
                .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 30px; }
                .stat { padding: 15px; border-radius: 8px; text-align: center; }
                .stat.total { background: #4299e1; color: white; }
                .stat.critical { background: #f56565; color: white; }
                .stat.high { background: #ed8936; color: white; }
                .stat.medium { background: #ecc94b; color: black; }
                .stat.low { background: #48bb78; color: white; }
                .stat-value { font-size: 2em; font-weight: bold; }
                .stat-label { font-size: 0.9em; opacity: 0.9; }
                .issue { 
                    border: 1px solid #e2e8f0; 
                    margin: 10px 0; 
                    padding: 15px; 
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .issue:hover { transform: translateX(5px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .issue.critical { border-left: 5px solid #f56565; }
                .issue.high { border-left: 5px solid #ed8936; }
                .issue.medium { border-left: 5px solid #ecc94b; }
                .issue.low { border-left: 5px solid #48bb78; }
                .severity-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.8em;
                    font-weight: bold;
                    margin-right: 10px;
                }
                .location { color: #718096; font-family: monospace; font-size: 0.9em; margin-top: 5px; }
                .description { margin: 10px 0; color: #2d3748; }
                .fix-btn {
                    background: #48bb78;
                    color: white;
                    border: none;
                    padding: 5px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                }
                .fix-btn:hover { background: #38a169; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Scan Results</h2>
                <p>Found ${issues.length} issues in your project</p>
            </div>
            
            <div class="summary">
                <div class="stat total">
                    <div class="stat-value">${summary.total}</div>
                    <div class="stat-label">Total</div>
                </div>
                <div class="stat critical">
                    <div class="stat-value">${summary.critical}</div>
                    <div class="stat-label">Critical</div>
                </div>
                <div class="stat high">
                    <div class="stat-value">${summary.high}</div>
                    <div class="stat-label">High</div>
                </div>
                <div class="stat medium">
                    <div class="stat-value">${summary.medium}</div>
                    <div class="stat-label">Medium</div>
                </div>
                <div class="stat low">
                    <div class="stat-value">${summary.low}</div>
                    <div class="stat-label">Low</div>
                </div>
            </div>
            
            <div class="issues">
                ${issues.map(issue => `
                    <div class="issue ${issue.severity}" onclick="openFile('${issue.location}', ${issue.line || 0})">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span class="severity-badge" style="background: ${this.getSeverityColor(issue.severity)}; color: white;">
                                    ${issue.severity.toUpperCase()}
                                </span>
                                <span style="font-weight: 600;">${issue.type}</span>
                            </div>
                            <button class="fix-btn" onclick="event.stopPropagation(); fixIssue(this, ${JSON.stringify(issue).replace(/"/g, '&quot;')})">
                                Fix Issue
                            </button>
                        </div>
                        <div class="description">${issue.description}</div>
                        <div class="location">${issue.location}</div>
                    </div>
                `).join('')}
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function openFile(file, line) {
                    vscode.postMessage({ command: 'openFile', file, line });
                }
                
                function fixIssue(button, issue) {
                    button.disabled = true;
                    button.textContent = 'Fixing...';
                    vscode.postMessage({ command: 'fix', issues: [issue] });
                }
            </script>
        </body>
        </html>`;
    }

    /**
     * Get severity color
     */
    getSeverityColor(severity) {
        switch (severity) {
            case 'critical': return '#f56565';
            case 'high': return '#ed8936';
            case 'medium': return '#ecc94b';
            case 'low': return '#48bb78';
            default: return '#a0aec0';
        }
    }

    /**
     * Save scan history
     */
    async saveScanHistory(scanResult) {
        try {
            await this.apiService.post('/scans/history', {
                scanResult,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.log('Failed to save scan history: ' + error.message);
        }
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
            vscode.window.showErrorMessage('Scan failed: ' + error.message);
        }
    }
}

module.exports = { ScannerProvider };