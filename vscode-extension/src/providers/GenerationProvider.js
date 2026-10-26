const vscode = require('vscode');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');

class GenerationProvider {
    constructor(context, apiService, authService) {
        this.context = context;
        this.apiService = apiService;
        this.authService = authService;
        this.outputChannel = vscode.window.createOutputChannel('MVC Generator');
    }

    /**
     * Generate MVC structure
     */
    async generate() {
        try {
            // Check authentication
            const isAuthenticated = await this.authService.isAuthenticated();
            if (!isAuthenticated) {
                const login = await vscode.window.showWarningMessage(
                    'Please login to use the generator',
                    'Login',
                    'Cancel'
                );
                if (login === 'Login') {
                    vscode.commands.executeCommand('mvc-accelerator.login');
                }
                return;
            }

            // Check subscription
            const hasSubscription = await this.authService.hasActiveSubscription();
            if (!hasSubscription) {
                const subscribe = await vscode.window.showWarningMessage(
                    'Active subscription required. Start a free trial?',
                    'Start Trial',
                    'Cancel'
                );
                if (subscribe === 'Start Trial') {
                    vscode.commands.executeCommand('mvc-accelerator.subscribe');
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

            // Get project name
            const projectName = await vscode.window.showInputBox({
                prompt: 'Enter project name',
                placeHolder: 'my-awesome-project',
                value: path.basename(projectPath),
                validateInput: (value) => {
                    return value && value.length > 0 ? null : 'Project name is required';
                }
            });

            if (!projectName) return;

            // Get prompt
            const prompt = await vscode.window.showInputBox({
                prompt: 'Describe what you want to build',
                placeHolder: 'e.g., Create a blog system with user authentication, posts, comments',
                ignoreFocusOut: true,
                validateInput: (value) => {
                    return value && value.length >= 10 ? null : 'Please provide more details (min 10 characters)';
                }
            });

            if (!prompt) return;

            // Select concept
            const concept = await vscode.window.showQuickPick(
                [
                    { label: '$(code) MVC Pattern', description: 'Traditional PHP MVC structure', value: 'mvc' },
                    { label: '$(zap) Laravel', description: 'Laravel framework structure', value: 'laravel' },
                    { label: '$(pencil) Custom', description: 'Custom structure based on your needs', value: 'custom' }
                ],
                { placeHolder: 'Choose your framework/concept' }
            );

            if (!concept) return;

            // Select PHP version
            const phpVersion = await vscode.window.showQuickPick(
                ['7.4', '8.0', '8.1', '8.2'],
                { placeHolder: 'Select PHP version' }
            );

            if (!phpVersion) return;

            // Confirm generation
            const confirm = await vscode.window.showWarningMessage(
                `Generate ${concept.label} project in ${projectPath}?`,
                { modal: true },
                'Generate',
                'Cancel'
            );

            if (confirm !== 'Generate') return;

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating MVC structure...",
                cancellable: true
            }, async (progress, token) => {
                token.onCancellationRequested(() => {
                    this.outputChannel.appendLine('Generation cancelled by user');
                });

                // Step 1: Enhance prompt
                progress.report({ increment: 0, message: "Enhancing prompt..." });
                this.log('Enhancing prompt with AI...');
                
                const enhancedPrompt = await this.enhancePrompt(prompt, concept.value);
                
                // Step 2: Generate structure
                progress.report({ increment: 30, message: "Generating structure..." });
                this.log('Generating MVC structure...');
                
                const generation = await this.apiService.post('/generate', {
                    prompt: enhancedPrompt,
                    concept: concept.value,
                    php_version: phpVersion,
                    project_name: projectName
                });

                // Step 3: Create files
                progress.report({ increment: 70, message: "Creating files..." });
                this.log(`Creating ${generation.file_count} files...`);
                
                await this.createProjectFiles(projectPath, generation.files);
                
                // Step 4: Complete
                progress.report({ increment: 100, message: "Complete!" });
                
                this.log(`✅ Successfully generated ${generation.file_count} files`);
                
                vscode.window.showInformationMessage(
                    `✅ MVC structure generated successfully! Created ${generation.file_count} files.`,
                    'View Files',
                    'Open in Editor'
                ).then(selection => {
                    if (selection === 'View Files') {
                        this.showGeneratedFiles(generation.files);
                    }
                });

                // Show enhanced prompt
                if (enhancedPrompt !== prompt) {
                    const viewPrompt = await vscode.window.showInformationMessage(
                        'Prompt was enhanced. Would you like to see the enhanced version?',
                        'Yes',
                        'No'
                    );
                    if (viewPrompt === 'Yes') {
                        vscode.window.showInformationMessage('Enhanced Prompt:\n' + enhancedPrompt);
                    }
                }
            });

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Enhance prompt with AI
     */
    async enhancePrompt(prompt, concept) {
        try {
            const response = await this.apiService.post('/generate/enhance', {
                prompt,
                concept
            });
            return response.enhancedPrompt || prompt;
        } catch (error) {
            this.log('Prompt enhancement failed, using original prompt');
            return prompt;
        }
    }

    /**
     * Create project files
     */
    async createProjectFiles(basePath, files) {
        for (const [filePath, content] of Object.entries(files)) {
            const fullPath = path.join(basePath, filePath);
            const dir = path.dirname(fullPath);
            
            // Create directory if it doesn't exist
            await fs.ensureDir(dir);
            
            // Write file
            await fs.writeFile(fullPath, content);
            
            this.log(`Created: ${filePath}`);
        }
    }

    /**
     * Show generated files in editor
     */
    async showGeneratedFiles(files) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        
        const projectPath = workspaceFolders[0].uri.fsPath;
        
        // Get first few files to open
        const filePaths = Object.keys(files).slice(0, 5).map(filePath => 
            vscode.Uri.file(path.join(projectPath, filePath))
        );
        
        // Open files in editor
        for (const uri of filePaths) {
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
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
        } else if (error.response?.status === 429) {
            vscode.window.showErrorMessage('Rate limit exceeded. Please try again later.');
        } else {
            vscode.window.showErrorMessage('Generation failed: ' + error.message);
        }
    }
}

module.exports = { GenerationProvider };