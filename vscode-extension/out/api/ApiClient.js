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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = exports.ApiError = void 0;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
/**
 * An ApiError always carries the real HTTP status, so callers can tell a
 * genuine 401 (expired/invalid session) apart from any other failure - the
 * old extension's ApiService collapsed every error into one generic shape.
 */
class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.status = status;
        this.data = data;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
class ApiClient {
    constructor() {
        const baseURL = vscode.workspace.getConfiguration('mvcAccelerator').get('apiUrl');
        this.client = axios_1.default.create({
            baseURL,
            timeout: 180000, // generation calls can be slow, matches the web app's own timeout
            headers: { 'Content-Type': 'application/json' }
        });
        this.client.interceptors.request.use((config) => {
            if (this.token) {
                config.headers = config.headers ?? {};
                config.headers.Authorization = `Bearer ${this.token}`;
            }
            return config;
        });
        this.client.interceptors.response.use((response) => response, (error) => {
            const status = error.response?.status;
            const body = error.response?.data;
            const message = body?.error || error.message || 'Request failed';
            if (status === 401 && this.onUnauthorized) {
                this.onUnauthorized();
            }
            return Promise.reject(new ApiError(message, status, error.response?.data));
        });
    }
    setToken(token) {
        this.token = token;
    }
    setOnUnauthorized(callback) {
        this.onUnauthorized = callback;
    }
    updateBaseUrl() {
        this.client.defaults.baseURL = vscode.workspace.getConfiguration('mvcAccelerator').get('apiUrl');
    }
    async login(email, password) {
        const res = await this.client.post('/login', { email, password });
        return res.data;
    }
    async logout() {
        try {
            await this.client.post('/logout');
        }
        catch {
            // Best-effort - a failed server-side logout shouldn't block clearing the local session.
        }
    }
    async getProfile() {
        const res = await this.client.get('/user/profile');
        return res.data;
    }
    async getProjects() {
        const res = await this.client.get('/projects');
        return res.data;
    }
    async getProject(id) {
        const res = await this.client.get(`/projects/${id}`);
        return res.data;
    }
    async getProjectFiles(id) {
        const res = await this.client.get(`/projects/${id}/files`);
        return res.data;
    }
    async createProject(projectName, framework, phpVersion) {
        const res = await this.client.post('/projects', {
            project_name: projectName,
            framework,
            php_version: phpVersion
        });
        return res.data;
    }
    async generate(params) {
        const res = await this.client.post('/generate', params);
        return res.data;
    }
    async plan(prompt, model = 'deepseek') {
        const res = await this.client.post('/generate/plan', { prompt, model });
        return res.data;
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=ApiClient.js.map