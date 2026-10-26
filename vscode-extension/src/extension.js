const vscode = require('vscode');
const path = require('path');
const fs = require('fs-extra');
const { ApiService } = require('./services/ApiService');
const { AuthService } = require('./services/AuthService');
const { WebSocketService } = require('./services/WebSocketService');
const { GenerationProvider } = require('./providers/GenerationProvider');
const { ScannerProvider } = require('./providers/ScannerProvider');
const { FixProvider } = require('./providers/FixProvider');

let apiService;
let authService;
let webSocketService;
let generationProvider;
let scannerProvider;
let fixProvider;
let statusBarItem;
let outputChannel;

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    console.log('PHP MVC Accelerator is now active!');
    
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('MVC Accelerator');
    outputChannel.appendLine('Extension activated');
    
    // Initialize services
    apiService = new ApiService(context);
    authService = new AuthService(context, apiService);
    webSocketService = new WebSocketService(context, apiService, authService);
    
    // Initialize providers
    generationProvider = new GenerationProvider(context, apiService, authService);
    scannerProvider = new ScannerProvider(context, apiService, authService);
    fixProvider = new FixProvider(context, apiService, authService);
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(rocket) MVC Accelerator";
    statusBarItem.tooltip = "PHP MVC Accelerator - Click to open dashboard";
    statusBarItem.command = 'mvc-accelerator.showDashboard';
    statusBarItem.show();
    
    // Register commands
    registerCommands(context);
    
    // Check authentication on startup
    await checkAuthOnStartup();
    
    // Auto scan if enabled
    if (vscode.workspace.getConfiguration('mvcAccelerator').get('autoScan')) {
        autoScanWorkspace();
    }
    
    // Watch for file changes if scanOnSave enabled
    if (vscode.workspace.getConfiguration('mvcAccelerator').get('scanOnSave')) {
        setupFileWatcher(context);
    }
    
    // Add to subscriptions
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(outputChannel);
    
    // Handle configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('mvcAccelerator')) {
            handleConfigChange();
        }
    });
}

/**
 * Register all commands
 */
function registerCommands(context) {
    const commands = [
        { command: 'mvc-accelerator.generate', handler: () => generationProvider.generate() },
        { command: 'mvc-accelerator.scan', handler: () => scannerProvider.scan() },
        { command: 'mvc-accelerator.fix', handler: () => fixProvider.fix() },
        { command: 'mvc-accelerator.subscribe', handler: () => handleSubscribe() },
        { command: 'mvc-accelerator.login', handler: () => handleLogin() },
        { command: 'mvc-accelerator.logout', handler: () => handleLogout() },
        { command: 'mvc-accelerator.showDashboard', handler: () => showDashboard() },
        { command: 'mvc-accelerator.openSettings', handler: () => openSettings() },
        { command: 'mvc-accelerator.clearCache', handler: () => clearCache() },
        { command: 'mvc-accelerator.viewLogs', handler: () => viewLogs() }
    ];
    
    commands.forEach(({ command, handler }) => {
        const disposable = vscode.commands.registerCommand(command, handler);
        context.subscriptions.push(disposable);
    });
}

/**
 * Handle login
 */
async function handleLogin() {
    try {
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'user@example.com',
            validateInput: (value) => {
                return value && value.includes('@') ? null : 'Please enter a valid email';
            }
        });
        
        if (!email) return;
        
        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true,
            validateInput: (value) => {
                return value && value.length >= 8 ? null : 'Password must be at least 8 characters';
            }
        });
        
        if (!password) return;
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Logging in...",
            cancellable: false
        }, async () => {
            const result = await authService.login(email, password);
            
            if (result.success) {
                vscode.window.showInformationMessage('✅ Login successful!');
                updateStatusBar(true);
                
                // Connect WebSocket
                await webSocketService.connect();
            } else {
                vscode.window.showErrorMessage('❌ Login failed: ' + result.error);
            }
        });
        
    } catch (error) {
        vscode.window.showErrorMessage('Login failed: ' + error.message);
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to logout?',
        { modal: true },
        'Yes',
        'No'
    );
    
    if (confirm === 'Yes') {
        await authService.logout();
        await webSocketService.disconnect();
        updateStatusBar(false);
        vscode.window.showInformationMessage('Logged out successfully');
    }
}

/**
 * Handle subscribe
 */
async function handleSubscribe() {
    try {
        const plans = [
            { label: '$(zap) 48-Hour Trial', description: 'Get started for free', plan: 'trial' },
            { label: '$(credit-card) Monthly Plan', description: '$5/month - Billed monthly', plan: 'monthly' },
            { label: '$(gift) Yearly Plan', description: '$60/year - Save 20%', plan: 'yearly' }
        ];
        
        const selection = await vscode.window.showQuickPick(plans, {
            placeHolder: 'Choose a subscription plan'
        });
        
        if (!selection) return;
        
        if (selection.plan === 'trial') {
            await activateTrial();
        } else {
            // Open subscription page in browser
            const apiUrl = vscode.workspace.getConfiguration('mvcAccelerator').get('apiUrl');
            const url = `${apiUrl}/subscribe?plan=${selection.plan}`;
            require('open')(url);
            
            vscode.window.showInformationMessage(
                'Opening subscription page in your browser...'
            );
        }
        
    } catch (error) {
        vscode.window.showErrorMessage('Subscription failed: ' + error.message);
    }
}

/**
 * Activate trial
 */
async function activateTrial() {
    try {
        const result = await apiService.post('/subscribe', { plan: 'trial' });
        
        if (result.success) {
            vscode.window.showInformationMessage(
                '🎉 48-hour trial activated! Enjoy all features.'
            );
            updateStatusBar(true);
        }
        
    } catch (error) {
        vscode.window.showErrorMessage('Failed to activate trial: ' + error.message);
    }
}

/**
 * Show dashboard
 */
async function showDashboard() {
    const panel = vscode.window.createWebviewPanel(
        'mvcAcceleratorDashboard',
        'MVC Accelerator Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', 'media'))]
        }
    );
    
    const user = await authService.getCurrentUser();
    const subscription = await authService.getSubscription();
    const stats = await apiService.get('/user/stats');
    
    panel.webview.html = getDashboardHtml(user, subscription, stats);
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
            case 'generate':
                vscode.commands.executeCommand('mvc-accelerator.generate');
                break;
            case 'scan':
                vscode.commands.executeCommand('mvc-accelerator.scan');
                break;
            case 'subscribe':
                vscode.commands.executeCommand('mvc-accelerator.subscribe');
                break;
            case 'logout':
                await handleLogout();
                panel.dispose();
                break;
        }
    });
}

/**
 * Check authentication on startup
 */
async function checkAuthOnStartup() {
    const isAuthenticated = await authService.isAuthenticated();
    updateStatusBar(isAuthenticated);
    
    if (isAuthenticated) {
        outputChannel.appendLine('User is authenticated');
        
        // Connect WebSocket
        try {
            await webSocketService.connect();
        } catch (error) {
            outputChannel.appendLine('WebSocket connection failed: ' + error.message);
        }
    }
}

/**
 * Auto scan workspace
 */
async function autoScanWorkspace() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    
    const hasPhpFiles = await checkForPhpFiles(workspaceFolders[0].uri.fsPath);
    
    if (hasPhpFiles) {
        const scan = await vscode.window.showInformationMessage(
            'PHP project detected. Would you like to scan it for issues?',
            'Scan Now',
            'Later',
            'Never'
        );
        
        if (scan === 'Scan Now') {
            vscode.commands.executeCommand('mvc-accelerator.scan');
        } else if (scan === 'Never') {
            await vscode.workspace.getConfiguration('mvcAccelerator').update('autoScan', false, true);
        }
    }
}

/**
 * Check for PHP files in workspace
 */
async function checkForPhpFiles(workspacePath) {
    const files = await fs.readdir(workspacePath);
    return files.some(file => file.endsWith('.php'));
}

/**
 * Setup file watcher
 */
function setupFileWatcher(context) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.php');
    
    watcher.onDidChange(async (uri) => {
        if (await authService.isAuthenticated()) {
            scannerProvider.scanFile(uri.fsPath);
        }
    });
    
    watcher.onDidCreate(async (uri) => {
        if (await authService.isAuthenticated()) {
            scannerProvider.scanFile(uri.fsPath);
        }
    });
    
    context.subscriptions.push(watcher);
}

/**
 * Update status bar based on auth state
 */
function updateStatusBar(isAuthenticated) {
    if (isAuthenticated) {
        statusBarItem.text = "$(check) MVC Accelerator";
        statusBarItem.tooltip = "Authenticated - Click to open dashboard";
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = "$(rocket) MVC Accelerator";
        statusBarItem.tooltip = "Not authenticated - Click to login";
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

/**
 * Handle configuration changes
 */
function handleConfigChange() {
    const config = vscode.workspace.getConfiguration('mvcAccelerator');
    apiService.setBaseUrl(config.get('apiUrl'));
}

/**
 * Open settings
 */
function openSettings() {
    vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:php-mvc-accelerator'
    );
}

/**
 * Clear cache
 */
async function clearCache() {
    const confirm = await vscode.window.showWarningMessage(
        'Clear all cached data?',
        { modal: true },
        'Yes',
        'No'
    );
    
    if (confirm === 'Yes') {
        await authService.clearCache();
        vscode.window.showInformationMessage('Cache cleared successfully');
    }
}

/**
 * View logs
 */
function viewLogs() {
    outputChannel.show();
}

/**
 * Get dashboard HTML
 */
function getDashboardHtml(user, subscription, stats) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MVC Accelerator Dashboard</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                margin: 0;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .header {
                background: white;
                border-radius: 10px;
                padding: 30px;
                margin-bottom: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            
            .header h1 {
                margin: 0;
                color: #333;
                font-size: 2.5em;
            }
            
            .header p {
                color: #666;
                margin: 10px 0 0;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .stat-card {
                background: white;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.05);
                transition: transform 0.3s;
            }
            
            .stat-card:hover {
                transform: translateY(-5px);
            }
            
            .stat-value {
                font-size: 2.5em;
                font-weight: bold;
                color: #667eea;
            }
            
            .stat-label {
                color: #666;
                margin-top: 10px;
            }
            
            .subscription-info {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                border-radius: 10px;
                padding: 20px;
                color: white;
                margin-bottom: 20px;
            }
            
            .actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s;
            }
            
            .btn-primary {
                background: #667eea;
                color: white;
            }
            
            .btn-primary:hover {
                background: #5a67d8;
                transform: translateY(-2px);
            }
            
            .btn-secondary {
                background: #e2e8f0;
                color: #4a5568;
            }
            
            .btn-secondary:hover {
                background: #cbd5e0;
            }
            
            .btn-danger {
                background: #fc8181;
                color: white;
            }
            
            .btn-danger:hover {
                background: #f56565;
            }
            
            .recent-activity {
                background: white;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.05);
            }
            
            .recent-activity h3 {
                margin-top: 0;
                color: #333;
            }
            
            .activity-item {
                padding: 15px;
                border-bottom: 1px solid #edf2f7;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .activity-item:last-child {
                border-bottom: none;
            }
            
            .activity-type {
                font-weight: 600;
                color: #667eea;
            }
            
            .activity-time {
                color: #a0aec0;
                font-size: 0.9em;
            }
            
            @media (max-width: 768px) {
                .header h1 {
                    font-size: 2em;
                }
                
                .stats-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome, ${user?.username || 'Developer'}!</h1>
                <p>PHP MVC Accelerator Dashboard</p>
                
                <div class="actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="sendCommand('generate')">
                        New Generation
                    </button>
                    <button class="btn btn-primary" onclick="sendCommand('scan')">
                        Scan Project
                    </button>
                    <button class="btn btn-secondary" onclick="sendCommand('subscribe')">
                        Manage Subscription
                    </button>
                    <button class="btn btn-danger" onclick="sendCommand('logout')">
                        Logout
                    </button>
                </div>
            </div>
            
            <div class="subscription-info">
                <h3>Subscription Status</h3>
                <p>Plan: ${subscription?.plan_type || 'Trial'}</p>
                <p>Expires: ${subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'Never'}</p>
                ${subscription?.plan_type === 'trial' ? 
                    '<p style="margin-top: 10px;">✨ Your 48-hour trial is active</p>' : ''}
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats?.total_projects || 0}</div>
                    <div class="stat-label">Total Projects</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-value">${stats?.total_generations || 0}</div>
                    <div class="stat-label">Generations</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-value">${stats?.total_scans || 0}</div>
                    <div class="stat-label">Code Scans</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-value">${stats?.fixed_issues || 0}</div>
                    <div class="stat-label">Issues Fixed</div>
                </div>
            </div>
            
            <div class="recent-activity">
                <h3>Recent Activity</h3>
                ${stats?.recent_activity?.length ? 
                    stats.recent_activity.map(activity => `
                        <div class="activity-item">
                            <span class="activity-type">${activity.type}</span>
                            <span>${activity.description}</span>
                            <span class="activity-time">${new Date(activity.created_at).toLocaleString()}</span>
                        </div>
                    `).join('') : 
                    '<p style="color: #a0aec0; text-align: center; padding: 20px;">No recent activity</p>'
                }
            </div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            function sendCommand(command) {
                vscode.postMessage({ command });
            }
        </script>
    </body>
    </html>`;
}

/**
 * Deactivate extension
 */
function deactivate() {
    if (webSocketService) {
        webSocketService.disconnect();
    }
    console.log('MVC Accelerator deactivated');
}

module.exports = {
    activate,
    deactivate
};