"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationManager = void 0;
const ApiClient_1 = require("../api/ApiClient");
const DEFAULT_FRAMEWORK = 'mvc';
const DEFAULT_PHP_VERSION = '8.1';
/**
 * Owns the plan-this-build state (kept in memory only, per the approved
 * scope - no persistence endpoint or DB table was added) and the shared
 * "which project does this generation target" logic, so continuation and
 * module-by-module building can never silently create an unrelated project.
 */
class GenerationManager {
    constructor(api, projectContext, createProject) {
        this.api = api;
        this.projectContext = projectContext;
        this.createProject = createProject;
        this.builtKeys = new Set();
    }
    getPlan() {
        return this.plan;
    }
    isBuilt(key) {
        return this.builtKeys.has(key);
    }
    clearPlan() {
        this.plan = undefined;
        this.planSourcePrompt = undefined;
        this.builtKeys.clear();
        this.planProjectId = undefined;
    }
    async planBuild(prompt, model) {
        const res = await this.api.plan(prompt, model);
        if (!res.plan) {
            throw new Error(res.error || "Couldn't break that down into a build plan.");
        }
        this.plan = res.plan;
        this.planSourcePrompt = prompt;
        this.builtKeys.clear();
        this.planProjectId = undefined;
        return res.plan;
    }
    /**
     * Resolves which project a generation should target, in priority order:
     * an explicitly continued project, a project already established by an
     * earlier step in this same plan, or (only if neither exists) a newly
     * created one - prompting for a name once, and remembering the result
     * for every later call so a second module never ends up in a different
     * project than the first.
     */
    async resolveProjectId(defaultNameHint) {
        if (this.projectContext.projectId) {
            return this.projectContext.projectId;
        }
        if (this.planProjectId) {
            return this.planProjectId;
        }
        const created = await this.createProject(defaultNameHint);
        if (!created) {
            throw new Error('A project is required before generating - cancelled.');
        }
        this.planProjectId = created.id;
        this.projectContext.set(created.id, created.name);
        return created.id;
    }
    async generateFreeform(prompt, model) {
        const projectId = await this.resolveProjectId(prompt.slice(0, 40) || 'New Project');
        return this.runGenerate(projectId, prompt, model);
    }
    async buildFoundation(model) {
        if (!this.plan)
            throw new Error('No build plan - run "Plan a Bulk Build" first.');
        const projectId = await this.resolveProjectId(this.planSourcePrompt?.slice(0, 40) || 'New Project');
        const modulePrompt = `Build the shared foundation for this project: ${this.planSourcePrompt}\n\n` +
            `Foundation scope: ${this.plan.foundation.description}\n\n` +
            `Only build the shared/foundation pieces described above - not the feature-specific modules themselves. ` +
            `Later requests will add those one at a time into this same project and will reuse what you build here.`;
        const outcome = await this.runGenerate(projectId, modulePrompt, model);
        this.builtKeys.add('foundation');
        return outcome;
    }
    async buildModule(moduleId, model) {
        if (!this.plan)
            throw new Error('No build plan - run "Plan a Bulk Build" first.');
        if (!this.builtKeys.has('foundation'))
            throw new Error('Build the Foundation first.');
        const module = this.plan.modules.find((m) => m.id === moduleId);
        if (!module)
            throw new Error(`Unknown module "${moduleId}".`);
        const projectId = await this.resolveProjectId(this.planSourcePrompt?.slice(0, 40) || 'New Project');
        const modulePrompt = `This project already has a foundation generated. Now build ONLY this one module: ` +
            `"${module.name}" - ${module.description}\n\n` +
            `Original project goal, for context: ${this.planSourcePrompt}\n\n` +
            `Do not redo the foundation or any other module - just this one.`;
        const outcome = await this.runGenerate(projectId, modulePrompt, model);
        this.builtKeys.add(moduleId);
        return outcome;
    }
    async runGenerate(projectId, prompt, model) {
        let res;
        try {
            res = await this.api.generate({
                prompt,
                concept: DEFAULT_FRAMEWORK,
                php_version: DEFAULT_PHP_VERSION,
                project_id: projectId,
                model
            });
        }
        catch (e) {
            if (e instanceof ApiClient_1.ApiError && e.status === 429) {
                throw new Error(e.data?.error || e.message);
            }
            throw e;
        }
        if (res.success === false) {
            throw new Error(res.error || 'Generation failed');
        }
        const files = res.files ?? {};
        const fileCount = res.file_count ?? Object.keys(files).length;
        // A generation can come back "successful" at the HTTP level but
        // still be an incomplete/truncated result (e.g. the AI engine's
        // retry-on-truncation gave up) - report that distinctly rather than
        // treating zero extracted files from a code-type response as normal.
        const truncatedOrIncomplete = res.type === 'code' && fileCount === 0;
        return {
            projectId,
            answer: res.answer ?? '',
            files,
            fileCount,
            overwrittenFiles: res.overwritten_files ?? [],
            truncatedOrIncomplete
        };
    }
}
exports.GenerationManager = GenerationManager;
//# sourceMappingURL=GenerationManager.js.map