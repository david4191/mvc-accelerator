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
exports.projectContext = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ApiClient_1 = require("./api/ApiClient");
const AuthManager_1 = require("./auth/AuthManager");
const ProjectsProvider_1 = require("./views/ProjectsProvider");
const ProjectContext_1 = require("./generation/ProjectContext");
const GenerationManager_1 = require("./generation/GenerationManager");
const WorkspaceSync_1 = require("./sync/WorkspaceSync");
let statusBarItem;
let outputChannel;
let api;
let auth;
let projectsProvider;
let generation;
let sync;
let virtualFilesRef;
exports.projectContext = new ProjectContext_1.ProjectContext();
const MODELS = [
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'ChatGPT', value: 'openai' },
    { label: 'Gemini', value: 'gemini' }
];
async function pickModel() {
    const choice = await vscode.window.showQuickPick(MODELS.map((m) => ({ label: m.label, value: m.value })), { placeHolder: 'Choose an AI model' });
    return choice?.value;
}
async function activate(context) {
    outputChannel = vscode.window.createOutputChannel('MVC Accelerator');
    api = new ApiClient_1.ApiClient();
    auth = new AuthManager_1.AuthManager(context.secrets, api);
    const virtualFiles = new ProjectsProvider_1.VirtualFileContentProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(ProjectsProvider_1.VIRTUAL_FILE_SCHEME, virtualFiles));
    projectsProvider = new ProjectsProvider_1.ProjectsProvider(api, auth, virtualFiles);
    const tree = vscode.window.createTreeView('mvcAcceleratorProjects', { treeDataProvider: projectsProvider });
    context.subscriptions.push(tree);
    generation = new GenerationManager_1.GenerationManager(api, exports.projectContext, createProjectPrompt);
    sync = new WorkspaceSync_1.WorkspaceSync(api);
    virtualFilesRef = virtualFiles;
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'mvcAccelerator.login';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();
    const restored = await auth.restore();
    updateStatusBar(restored);
    if (restored) {
        outputChannel.appendLine(`Restored session for ${auth.getCurrentUser()?.email}`);
    }
    context.subscriptions.push(vscode.commands.registerCommand('mvcAccelerator.login', () => handleLogin()), vscode.commands.registerCommand('mvcAccelerator.logout', () => handleLogout()), vscode.commands.registerCommand('mvcAccelerator.refreshProjects', () => projectsProvider.refresh()), vscode.commands.registerCommand('mvcAccelerator.openProjectFile', (projectId, path) => openProjectFile(projectId, path)), vscode.commands.registerCommand('mvcAccelerator.continueProject', (node) => handleContinueProject(node)), vscode.commands.registerCommand('mvcAccelerator.newProjectPrompt', () => handleNewProjectPrompt()), vscode.commands.registerCommand('mvcAccelerator.planBuild', () => handlePlanBuild()), vscode.commands.registerCommand('mvcAccelerator.syncToWorkspace', (node) => handleSyncToWorkspace(node)), vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mvcAccelerator')) {
            api.updateBaseUrl();
        }
    }));
}
async function handleLogin() {
    const email = await vscode.window.showInputBox({
        prompt: 'MVC Accelerator email',
        placeHolder: 'you@example.com',
        validateInput: (v) => (v && v.includes('@') ? null : 'Enter a valid email')
    });
    if (!email)
        return;
    const password = await vscode.window.showInputBox({
        prompt: 'Password',
        password: true,
        validateInput: (v) => (v ? null : 'Password is required')
    });
    if (!password)
        return;
    try {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Logging in to MVC Accelerator...' }, () => auth.login(email, password));
        updateStatusBar(true);
        projectsProvider.refresh();
        vscode.window.showInformationMessage(`Logged in as ${auth.getCurrentUser()?.username}`);
    }
    catch (e) {
        vscode.window.showErrorMessage(`Login failed: ${(0, AuthManager_1.describeAuthError)(e)}`);
    }
}
async function handleLogout() {
    await auth.logout();
    exports.projectContext.clear();
    generation.clearPlan();
    updateStatusBar(false);
    projectsProvider.refresh();
    vscode.window.showInformationMessage('Logged out of MVC Accelerator');
}
async function openProjectFile(projectId, path) {
    const uri = vscode.Uri.parse(`${ProjectsProvider_1.VIRTUAL_FILE_SCHEME}://${projectId}/${path}`);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true });
}
async function handleContinueProject(node) {
    const projectId = (0, ProjectsProvider_1.projectIdOf)(node);
    const projectName = (0, ProjectsProvider_1.projectNameOf)(node);
    if (!projectId || !projectName)
        return;
    exports.projectContext.set(projectId, projectName);
    generation.clearPlan();
    vscode.window.showInformationMessage(`Continuing "${projectName}" (project #${projectId}) - the next prompt or module you build will be added to it.`);
}
async function requireAuth() {
    if (auth.isAuthenticated())
        return true;
    const choice = await vscode.window.showWarningMessage('Please log in to MVC Accelerator first.', 'Log in');
    if (choice === 'Log in')
        await handleLogin();
    return auth.isAuthenticated();
}
/** Prompts for a project name and creates it - used when no project is being continued. */
async function createProjectPrompt(defaultNameHint) {
    const name = await vscode.window.showInputBox({
        prompt: 'New project name',
        value: defaultNameHint,
        validateInput: (v) => (v && v.trim() ? null : 'A project name is required')
    });
    if (!name)
        return undefined;
    const created = await api.createProject(name, 'mvc', '8.1');
    return { id: created.id, name };
}
async function handleNewProjectPrompt() {
    if (!(await requireAuth()))
        return;
    if (exports.projectContext.projectId) {
        const choice = await vscode.window.showQuickPick([
            { label: `Continue "${exports.projectContext.projectName}"`, value: 'continue' },
            { label: 'Start a brand new project', value: 'new' }
        ], { placeHolder: 'You previously chose to continue a project - what do you want to do?' });
        if (!choice)
            return;
        if (choice.value === 'new')
            exports.projectContext.clear();
    }
    const prompt = await vscode.window.showInputBox({
        prompt: 'Describe what you want to build',
        placeHolder: 'e.g. a blog with posts and comments',
        validateInput: (v) => (v && v.trim().length >= 5 ? null : 'Describe what you want in a bit more detail')
    });
    if (!prompt)
        return;
    const model = await pickModel();
    if (!model)
        return;
    try {
        const outcome = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Generating...', cancellable: false }, () => generation.generateFreeform(prompt, model));
        await showGenerationResult(outcome, 'Generated');
        projectsProvider.refresh();
    }
    catch (e) {
        vscode.window.showErrorMessage(`Generation failed: ${(0, AuthManager_1.describeAuthError)(e)}`);
    }
}
async function handlePlanBuild() {
    if (!(await requireAuth()))
        return;
    const prompt = await vscode.window.showInputBox({
        prompt: 'Describe the full build (this will be broken into a foundation + modules)',
        placeHolder: 'e.g. a hospital management system with patients, appointments, billing and staff',
        validateInput: (v) => (v && v.trim().length >= 10 ? null : 'Describe the build in more detail')
    });
    if (!prompt)
        return;
    const model = await pickModel();
    if (!model)
        return;
    try {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Planning build...', cancellable: false }, () => generation.planBuild(prompt, model));
    }
    catch (e) {
        vscode.window.showErrorMessage(`Planning failed: ${(0, AuthManager_1.describeAuthError)(e)}`);
        return;
    }
    await showPlanPicker(model);
}
async function showPlanPicker(model) {
    const plan = generation.getPlan();
    if (!plan)
        return;
    const items = [];
    const foundationBuilt = generation.isBuilt('foundation');
    items.push({
        label: `${foundationBuilt ? '$(check) ' : '$(circle-large-outline) '}Foundation`,
        description: plan.foundation.description,
        itemType: 'foundation'
    });
    for (const m of plan.modules) {
        const built = generation.isBuilt(m.id);
        items.push({
            label: `${built ? '$(check) ' : '$(circle-large-outline) '}${m.name}`,
            description: m.description,
            itemType: 'module',
            moduleId: m.id
        });
    }
    const choice = await vscode.window.showQuickPick(items, {
        placeHolder: foundationBuilt
            ? 'Pick a module to build (or re-pick a built one to rebuild it)'
            : 'Build the Foundation first'
    });
    if (!choice)
        return;
    if (choice.itemType === 'foundation') {
        if (foundationBuilt) {
            const confirm = await vscode.window.showWarningMessage('Foundation was already built. Rebuilding it may overwrite those files. Continue?', { modal: true }, 'Rebuild');
            if (confirm !== 'Rebuild')
                return showPlanPicker(model);
        }
        try {
            const outcome = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Building Foundation...' }, () => generation.buildFoundation(model));
            await showGenerationResult(outcome, 'Foundation built');
            projectsProvider.refresh();
        }
        catch (e) {
            vscode.window.showErrorMessage(`Foundation build failed: ${(0, AuthManager_1.describeAuthError)(e)}`);
        }
        return showPlanPicker(model);
    }
    if (choice.itemType === 'module' && choice.moduleId) {
        if (!foundationBuilt) {
            vscode.window.showWarningMessage('Build the Foundation first.');
            return showPlanPicker(model);
        }
        if (generation.isBuilt(choice.moduleId)) {
            const confirm = await vscode.window.showWarningMessage(`"${choice.label}" was already built. Rebuilding it may overwrite those files. Continue?`, { modal: true }, 'Rebuild');
            if (confirm !== 'Rebuild')
                return showPlanPicker(model);
        }
        try {
            const outcome = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Building ${choice.label}...` }, () => generation.buildModule(choice.moduleId, model));
            await showGenerationResult(outcome, `${choice.label} built`);
            projectsProvider.refresh();
        }
        catch (e) {
            vscode.window.showErrorMessage(`Module build failed: ${(0, AuthManager_1.describeAuthError)(e)}`);
        }
        return showPlanPicker(model);
    }
}
/** Reports a generation outcome clearly - success, file count, overwrites, and incomplete/truncated results are never conflated. */
async function showGenerationResult(outcome, title) {
    if (outcome.truncatedOrIncomplete) {
        vscode.window.showWarningMessage(`${title}, but the response looked like code with no files recognized in it - it may have been incomplete or in an unexpected format. Check the opened document.`);
    }
    else if (outcome.fileCount > 0) {
        vscode.window.showInformationMessage(`${title}: ${outcome.fileCount} file(s) in project #${outcome.projectId}.`);
    }
    else {
        vscode.window.showInformationMessage(`${title} (no files - this may have been a conceptual answer).`);
    }
    if (outcome.overwrittenFiles.length > 0) {
        vscode.window.showWarningMessage(`Replaced ${outcome.overwrittenFiles.length} existing file(s): ${outcome.overwrittenFiles.join(', ')}`);
    }
    const doc = await vscode.workspace.openTextDocument({ content: outcome.answer, language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: true });
}
async function handleSyncToWorkspace(node) {
    if (!(await requireAuth()))
        return;
    const projectId = (0, ProjectsProvider_1.projectIdOf)(node) ?? exports.projectContext.projectId;
    const projectName = (0, ProjectsProvider_1.projectNameOf)(node) ?? exports.projectContext.projectName;
    if (!projectId) {
        vscode.window.showWarningMessage('Right-click a project in the MVC Accelerator Projects view to sync it.');
        return;
    }
    const folder = await sync.chooseFolder();
    if (!folder)
        return;
    let items;
    try {
        items = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Checking "${projectName}" against ${folder}...` }, () => sync.planSync(projectId, folder));
    }
    catch (e) {
        vscode.window.showErrorMessage(`Could not load project files: ${(0, AuthManager_1.describeAuthError)(e)}`);
        return;
    }
    if (items.length === 0) {
        // Distinguish "nothing to sync yet" from a silent no-op, per the
        // requirement to handle incomplete/empty generation results clearly.
        vscode.window.showInformationMessage(`"${projectName}" has no generated files yet - nothing to sync.`);
        return;
    }
    const unsafe = items.filter((i) => i.status === 'unsafe');
    const brandNew = items.filter((i) => i.status === 'new');
    const conflicts = items.filter((i) => i.status === 'conflict');
    const identical = items.filter((i) => i.status === 'identical');
    if (unsafe.length > 0) {
        outputChannel.appendLine(`Rejected ${unsafe.length} unsafe path(s), never written: ${unsafe.map((i) => i.path).join(', ')}`);
        vscode.window.showWarningMessage(`${unsafe.length} file path(s) from the server were rejected as unsafe (outside the chosen folder) and were not written. See the MVC Accelerator output channel.`);
    }
    vscode.window.showInformationMessage(`"${projectName}": ${brandNew.length} new, ${conflicts.length} differ from your local copy, ${identical.length} unchanged.`);
    if (brandNew.length > 0) {
        const confirmNew = await vscode.window.showInformationMessage(`Create ${brandNew.length} new file(s) in ${folder}?`, { modal: true }, 'Create');
        if (confirmNew === 'Create') {
            for (const item of brandNew) {
                await sync.write(item);
            }
            outputChannel.appendLine(`Wrote ${brandNew.length} new file(s).`);
        }
    }
    if (conflicts.length > 0) {
        const choice = await vscode.window.showWarningMessage(`${conflicts.length} file(s) already exist locally with different content. Local work is never overwritten silently.`, { modal: true }, 'Review each file', 'Skip all (keep local)');
        if (choice === 'Review each file') {
            for (const item of conflicts) {
                await reviewConflict(item, projectId);
            }
        }
        // Any other choice (including dismiss) leaves every conflicting file untouched.
    }
}
async function reviewConflict(item, projectId) {
    virtualFilesRef.setContent(projectId, `__sync__/${item.path}`, item.serverContent);
    const serverUri = vscode.Uri.parse(`${ProjectsProvider_1.VIRTUAL_FILE_SCHEME}://${projectId}/__sync__/${item.path}`);
    const localUri = vscode.Uri.file(item.localAbsPath);
    await vscode.commands.executeCommand('vscode.diff', localUri, serverUri, `${item.path} (local ↔ server)`);
    const choice = await vscode.window.showWarningMessage(`Replace your local "${item.path}" with the server version shown in the diff?`, { modal: true }, 'Overwrite', 'Skip');
    if (choice === 'Overwrite') {
        await sync.write(item);
        outputChannel.appendLine(`Overwrote: ${item.path}`);
    }
    else {
        outputChannel.appendLine(`Skipped (kept local): ${item.path}`);
    }
}
function updateStatusBar(authenticated) {
    if (authenticated) {
        statusBarItem.text = `$(check) MVC Accelerator: ${auth.getCurrentUser()?.username ?? 'Signed in'}`;
        statusBarItem.tooltip = 'Click to log out details in the command palette';
        statusBarItem.command = 'mvcAccelerator.logout';
    }
    else {
        statusBarItem.text = '$(sign-in) MVC Accelerator: Sign in';
        statusBarItem.tooltip = 'Click to log in';
        statusBarItem.command = 'mvcAccelerator.login';
    }
}
function deactivate() {
    // Nothing to tear down - no persistent connections (no WebSocket, unlike
    // the previous extension, since no such server exists on the backend).
}
//# sourceMappingURL=extension.js.map