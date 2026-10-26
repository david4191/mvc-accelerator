import axios, { AxiosInstance, AxiosError } from 'axios';
import * as vscode from 'vscode';

// Shapes verified directly against the running backend (not assumed from
// the old extension) - see AuthManager's login()/profile() call sites.
export interface ApiUser {
    id: number;
    username: string;
    fullname: string;
    email: string;
    [key: string]: unknown;
}

export interface LoginResponse {
    success: boolean;
    message?: string;
    token: string;
    user: ApiUser;
}

export interface ProfileResponse {
    success: boolean;
    user: ApiUser;
}

export interface Project {
    id: number;
    project_name: string;
    framework: string;
    php_version: string;
    created_at: string;
    generation_count?: number;
    last_generation?: string | null;
}

export interface ProjectsListResponse {
    success: boolean;
    data: Project[];
}

export interface ProjectGeneration {
    id: number;
    prompt_text: string;
    file_count: number;
    created_at: string;
}

export interface ProjectDetailResponse {
    success: boolean;
    data: {
        project: Project;
        generations: ProjectGeneration[];
    };
}

export interface ProjectFilesResponse {
    success: boolean;
    data: {
        files: Record<string, string>;
        file_count: number;
    };
}

export interface GenerateResponse {
    success: boolean;
    type?: string;
    answer?: string;
    files?: Record<string, string>;
    file_count?: number;
    generation_id?: number | null;
    overwritten_files?: string[];
    model?: string;
    error?: string;
    limitReached?: boolean;
    reason?: string;
}

export interface BuildPlan {
    foundation: { description: string; files?: string[] };
    modules: Array<{ id: string; name: string; description: string }>;
}

export interface PlanResponse {
    success: boolean;
    plan?: BuildPlan;
    model?: string;
    error?: string;
}

/**
 * An ApiError always carries the real HTTP status, so callers can tell a
 * genuine 401 (expired/invalid session) apart from any other failure - the
 * old extension's ApiService collapsed every error into one generic shape.
 */
export class ApiError extends Error {
    constructor(message: string, public status?: number, public data?: unknown) {
        super(message);
        this.name = 'ApiError';
    }
}

export class ApiClient {
    private client: AxiosInstance;
    private token: string | undefined;
    private onUnauthorized: (() => void) | undefined;

    constructor() {
        const baseURL = vscode.workspace.getConfiguration('mvcAccelerator').get<string>('apiUrl');
        this.client = axios.create({
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

        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError) => {
                const status = error.response?.status;
                const body = error.response?.data as { error?: string } | undefined;
                const message = body?.error || error.message || 'Request failed';

                if (status === 401 && this.onUnauthorized) {
                    this.onUnauthorized();
                }

                return Promise.reject(new ApiError(message, status, error.response?.data));
            }
        );
    }

    setToken(token: string | undefined): void {
        this.token = token;
    }

    setOnUnauthorized(callback: () => void): void {
        this.onUnauthorized = callback;
    }

    updateBaseUrl(): void {
        this.client.defaults.baseURL = vscode.workspace.getConfiguration('mvcAccelerator').get<string>('apiUrl');
    }

    async login(email: string, password: string): Promise<LoginResponse> {
        const res = await this.client.post<LoginResponse>('/login', { email, password });
        return res.data;
    }

    async logout(): Promise<void> {
        try {
            await this.client.post('/logout');
        } catch {
            // Best-effort - a failed server-side logout shouldn't block clearing the local session.
        }
    }

    async getProfile(): Promise<ProfileResponse> {
        const res = await this.client.get<ProfileResponse>('/user/profile');
        return res.data;
    }

    async getProjects(): Promise<ProjectsListResponse> {
        const res = await this.client.get<ProjectsListResponse>('/projects');
        return res.data;
    }

    async getProject(id: number): Promise<ProjectDetailResponse> {
        const res = await this.client.get<ProjectDetailResponse>(`/projects/${id}`);
        return res.data;
    }

    async getProjectFiles(id: number): Promise<ProjectFilesResponse> {
        const res = await this.client.get<ProjectFilesResponse>(`/projects/${id}/files`);
        return res.data;
    }

    async createProject(projectName: string, framework: string, phpVersion: string): Promise<{ id: number }> {
        const res = await this.client.post<{ id: number }>('/projects', {
            project_name: projectName,
            framework,
            php_version: phpVersion
        });
        return res.data;
    }

    async generate(params: {
        prompt: string;
        concept: string;
        php_version: string;
        project_id?: number;
        model?: string;
    }): Promise<GenerateResponse> {
        const res = await this.client.post<GenerateResponse>('/generate', params);
        return res.data;
    }

    async plan(prompt: string, model = 'deepseek'): Promise<PlanResponse> {
        const res = await this.client.post<PlanResponse>('/generate/plan', { prompt, model });
        return res.data;
    }
}
