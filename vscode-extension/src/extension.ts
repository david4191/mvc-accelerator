import * as vscode from 'vscode';
import { ApiClient } from './api/ApiClient';
import { AuthManager, describeAuthError } from './auth/AuthManager';
import { ProjectsProvider, VirtualFileContentProvider, VIRTUAL_FILE_SCHEME, projectIdOf, projectNameOf } from './views/ProjectsProvider';
import { ProjectContext } from './generation/ProjectContext';
import { GenerationManager, GenerationOutcome } from './generation/GenerationManager';
import { WorkspaceSync, SyncPlanItem } from './sync/WorkspaceSync';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let api: ApiClient;
let auth: AuthManager;
let projectsProvider: ProjectsProvider;
let generation: GenerationManager;
let sync: WorkspaceSync;
let virtualFilesRef: VirtualFileContentProvider;
export const projectContext = new ProjectContext();

const MODELS = [
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'ChatGPT', value: 'openai' },
    { label: 'Gemini', value: 'gemini' }
];

async function pickModel(): Promise<string | undefined> {
    const choice = await vscode.window.showQuickPick(
        MODELS.map((m) => ({ label: m.label, value: m.value })),
        { placeHolder: 'Choose an AI model' }
    );
    return choice?.value;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('MVC Accelerator');
    api = new ApiClient();
    auth = new AuthManager(context.secrets, api);

    const virtualFiles = new VirtualFileContentProvider();
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(VIRTUAL_FILE_SCHEME, virtualFiles)
    );

    projectsProvider = new ProjectsProvider(api, auth, virtualFiles);
    const tree = vscode.window.createTreeView('mvcAcceleratorProjects', { treeDataProvider: projectsProvider });
    context.subscriptions.push(tree);

    generation = new GenerationManager(api, projectContext, createProjectPrompt);
    sync = new WorkspaceSync(api);
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

    context.subscriptions.push(
        vscode.commands.registerCommand('mvcAccelerator.login', () => handleLogin()),
        vscode.commands.registerCommand('mvcAccelerator.logout', () => handleLogout()),
        vscode.commands.registerCommand('mvcAccelerator.refreshProjects', () => projectsProvider.refresh()),
        vscode.commands.registerCommand('mvcAccelerator.openProjectFile', (projectId: number, path: string) =>
            openProjectFile(projectId, path)
        ),
        vscode.commands.registerCommand('mvcAccelerator.continueProject', (node: unknown) =>
            handleContinueProject(node)
        ),
        vscode.commands.registerCommand('mvcAccelerator.newProjectPrompt', () => handleNewProjectPrompt()),
        vscode.commands.registerCommand('mvcAccelerator.planBuild', () => handlePlanBuild()),
        vscode.commands.registerCommand('mvcAccelerator.syncToWorkspace', (node: unknown) => handleSyncToWorkspace(node)),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('mvcAccelerator')) {
                api.updateBaseUrl();
            }
        })
    );
}

async function handleLogin(): Promise<void> {
    const email = await vscode.window.showInputBox({
        prompt: 'MVC Accelerator email',
        placeHolder: 'you@example.com',
        validateInput: (v) => (v && v.includes('@') ? null : 'Enter a valid email')
    });
    if (!email) return;

    const password = await vscode.window.showInputBox({
        prompt: 'Password',
        password: true,
        validateInput: (v) => (v ? null : 'Password is required')
    });
    if (!password) return;

    try {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Logging in to MVC Accelerator...' },
            () => auth.login(email, password)
        );
        updateStatusBar(true);
        projectsProvider.refresh();
        vscode.window.showInformationMessage(`Logged in as ${auth.getCurrentUser()?.username}`);
    } catch (e) {
        vscode.window.showErrorMessage(`Login failed: ${describeAuthError(e)}`);
    }
}

async function handleLogout(): Promise<void> {
    await auth.logout();
    projectContext.clear();
    generation.clearPlan();
    updateStatusBar(false);
    projectsProvider.refresh();
    vscode.window.showInformationMessage('Logged out of MVC Accelerator');
}

async function openProjectFile(projectId: number, path: string): Promise<void> {
    const uri = vscode.Uri.parse(`${VIRTUAL_FILE_SCHEME}://${projectId}/${path}`);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true });
}

async function handleContinueProject(node: unknown): Promise<void> {
    const projectId = projectIdOf(node);
    const projectName = projectNameOf(node);
    if (!projectId || !projectName) return;

    projectContext.set(projectId, projectName);
    generation.clearPlan();
    vscode.window.showInformationMessage(
        `Continuing "${projectName}" (project #${projectId}) - the next prompt or module you build will be added to it.`
    );
}

async function requireAuth(): Promise<boolean> {
    if (auth.isAuthenticated()) return true;
    const choice = await vscode.window.showWarningMessage('Please log in to MVC Accelerator first.', 'Log in');
    if (choice === 'Log in') await handleLogin();
    return auth.isAuthenticated();
}

/** Prompts for a project name and creates it - used when no project is being continued. */
async function createProjectPrompt(defaultNameHint: string): Promise<{ id: number; name: string } | undefined> {
    const name = await vscode.window.showInputBox({
        prompt: 'New project name',
        value: defaultNameHint,
        validateInput: (v) => (v && v.trim() ? null : 'A project name is required')
    });
    if (!name) return undefined;

    const created = await api.createProject(name, 'mvc', '8.1');
    return { id: created.id, name };
}

async function handleNewProjectPrompt(): Promise<void> {
    if (!(await requireAuth())) return;

    if (projectContext.projectId) {
        const choice = await vscode.window.showQuickPick(
            [
                { label: `Continue "${projectContext.projectName}"`, value: 'continue' },
                { label: 'Start a brand new project', value: 'new' }
            ],
            { placeHolder: 'You previously chose to continue a project - what do you want to do?' }
        );
        if (!choice) return;
        if (choice.value === 'new') projectContext.clear();
    }

    const prompt = await vscode.window.showInputBox({
        prompt: 'Describe what you want to build',
        placeHolder: 'e.g. a blog with posts and comments',
        validateInput: (v) => (v && v.trim().length >= 5 ? null : 'Describe what you want in a bit more detail')
    });
    if (!prompt) return;

    const model = await pickModel();
    if (!model) return;

    try {
        const outcome = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Generating...', cancellable: false },
            () => generation.generateFreeform(prompt, model)
        );
        await showGenerationResult(outcome, 'Generated');
        projectsProvider.refresh();
    } catch (e) {
        vscode.window.showErrorMessage(`Generation failed: ${describeAuthError(e)}`);
    }
}

async function handlePlanBuild(): Promise<void> {
    if (!(await requireAuth())) return;

    const prompt = await vscode.window.showInputBox({
        prompt: 'Describe the full build (this will be broken into a foundation + modules)',
        placeHolder: 'e.g. a hospital management system with patients, appointments, billing and staff',
        validateInput: (v) => (v && v.trim().length >= 10 ? null : 'Describe the build in more detail')
    });
    if (!prompt) return;

    const model = await pickModel();
    if (!model) return;

    try {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Planning build...', cancellable: false },
            () => generation.planBuild(prompt, model)
        );
    } catch (e) {
        vscode.window.showErrorMessage(`Planning failed: ${describeAuthError(e)}`);
        return;
    }

    await showPlanPicker(model);
}

async function showPlanPicker(model: string): Promise<void> {
    const plan = generation.getPlan();
    if (!plan) return;

    type Item = vscode.QuickPickItem & { itemType: 'foundation' | 'module'; moduleId?: string };
    const items: Item[] = [];

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
    if (!choice) return;

    if (choice.itemType === 'foundation') {
        if (foundationBuilt) {
            const confirm = await vscode.window.showWarningMessage(
                'Foundation was already built. Rebuilding it may overwrite those files. Continue?',
                { modal: true },
                'Rebuild'
            );
            if (confirm !== 'Rebuild') return showPlanPicker(model);
        }
        try {
            const outcome = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Building Foundation...' },
                () => generation.buildFoundation(model)
            );
            await showGenerationResult(outcome, 'Foundation built');
            projectsProvider.refresh();
        } catch (e) {
            vscode.window.showErrorMessage(`Foundation build failed: ${describeAuthError(e)}`);
        }
        return showPlanPicker(model);
    }

    if (choice.itemType === 'module' && choice.moduleId) {
        if (!foundationBuilt) {
            vscode.window.showWarningMessage('Build the Foundation first.');
            return showPlanPicker(model);
        }
        if (generation.isBuilt(choice.moduleId)) {
            const confirm = await vscode.window.showWarningMessage(
                `"${choice.label}" was already built. Rebuilding it may overwrite those files. Continue?`,
                { modal: true },
                'Rebuild'
            );
            if (confirm !== 'Rebuild') return showPlanPicker(model);
        }
        try {
            const outcome = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Building ${choice.label}...` },
                () => generation.buildModule(choice.moduleId as string, model)
            );
            await showGenerationResult(outcome, `${choice.label} built`);
            projectsProvider.refresh();
        } catch (e) {
            vscode.window.showErrorMessage(`Module build failed: ${describeAuthError(e)}`);
        }
        return showPlanPicker(model);
    }
}

/** Reports a generation outcome clearly - success, file count, overwrites, and incomplete/truncated results are never conflated. */
async function showGenerationResult(outcome: GenerationOutcome, title: string): Promise<void> {
    if (outcome.truncatedOrIncomplete) {
        vscode.window.showWarningMessage(
            `${title}, but the response looked like code with no files recognized in it - it may have been incomplete or in an unexpected format. Check the opened document.`
        );
    } else if (outcome.fileCount > 0) {
        vscode.window.showInformationMessage(`${title}: ${outcome.fileCount} file(s) in project #${outcome.projectId}.`);
    } else {
        vscode.window.showInformationMessage(`${title} (no files - this may have been a conceptual answer).`);
    }

    if (outcome.overwrittenFiles.length > 0) {
        vscode.window.showWarningMessage(
            `Replaced ${outcome.overwrittenFiles.length} existing file(s): ${outcome.overwrittenFiles.join(', ')}`
        );
    }

    const doc = await vscode.workspace.openTextDocument({ content: outcome.answer, language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: true });
}

async function handleSyncToWorkspace(node: unknown): Promise<void> {
    if (!(await requireAuth())) return;

    const projectId = projectIdOf(node) ?? projectContext.projectId;
    const projectName = projectNameOf(node) ?? projectContext.projectName;
    if (!projectId) {
        vscode.window.showWarningMessage('Right-click a project in the MVC Accelerator Projects view to sync it.');
        return;
    }

    const folder = await sync.chooseFolder();
    if (!folder) return;

    let items: SyncPlanItem[];
    try {
        items = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Checking "${projectName}" against ${folder}...` },
            () => sync.planSync(projectId, folder)
        );
    } catch (e) {
        vscode.window.showErrorMessage(`Could not load project files: ${describeAuthError(e)}`);
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
        vscode.window.showWarningMessage(
            `${unsafe.length} file path(s) from the server were rejected as unsafe (outside the chosen folder) and were not written. See the MVC Accelerator output channel.`
        );
    }

    vscode.window.showInformationMessage(
        `"${projectName}": ${brandNew.length} new, ${conflicts.length} differ from your local copy, ${identical.length} unchanged.`
    );

    if (brandNew.length > 0) {
        const confirmNew = await vscode.window.showInformationMessage(
            `Create ${brandNew.length} new file(s) in ${folder}?`,
            { modal: true },
            'Create'
        );
        if (confirmNew === 'Create') {
            for (const item of brandNew) {
                await sync.write(item);
            }
            outputChannel.appendLine(`Wrote ${brandNew.length} new file(s).`);
        }
    }

    if (conflicts.length > 0) {
        const choice = await vscode.window.showWarningMessage(
            `${conflicts.length} file(s) already exist locally with different content. Local work is never overwritten silently.`,
            { modal: true },
            'Review each file',
            'Skip all (keep local)'
        );

        if (choice === 'Review each file') {
            for (const item of conflicts) {
                await reviewConflict(item, projectId);
            }
        }
        // Any other choice (including dismiss) leaves every conflicting file untouched.
    }
}

async function reviewConflict(item: SyncPlanItem, projectId: number): Promise<void> {
    virtualFilesRef.setContent(projectId, `__sync__/${item.path}`, item.serverContent);
    const serverUri = vscode.Uri.parse(`${VIRTUAL_FILE_SCHEME}://${projectId}/__sync__/${item.path}`);
    const localUri = vscode.Uri.file(item.localAbsPath);

    await vscode.commands.executeCommand('vscode.diff', localUri, serverUri, `${item.path} (local ↔ server)`);

    const choice = await vscode.window.showWarningMessage(
        `Replace your local "${item.path}" with the server version shown in the diff?`,
        { modal: true },
        'Overwrite',
        'Skip'
    );

    if (choice === 'Overwrite') {
        await sync.write(item);
        outputChannel.appendLine(`Overwrote: ${item.path}`);
    } else {
        outputChannel.appendLine(`Skipped (kept local): ${item.path}`);
    }
}

function updateStatusBar(authenticated: boolean): void {
    if (authenticated) {
        statusBarItem.text = `$(check) MVC Accelerator: ${auth.getCurrentUser()?.username ?? 'Signed in'}`;
        statusBarItem.tooltip = 'Click to log out details in the command palette';
        statusBarItem.command = 'mvcAccelerator.logout';
    } else {
        statusBarItem.text = '$(sign-in) MVC Accelerator: Sign in';
        statusBarItem.tooltip = 'Click to log in';
        statusBarItem.command = 'mvcAccelerator.login';
    }
}

export function deactivate(): void {
    // Nothing to tear down - no persistent connections (no WebSocket, unlike
    // the previous extension, since no such server exists on the backend).
}
