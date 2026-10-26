import * as vscode from 'vscode';
import { ApiClient, ApiError, ApiUser } from '../api/ApiClient';

const TOKEN_KEY = 'mvcAccelerator.authToken';

/**
 * Owns the session token end to end: never written to globalState or a
 * settings.json value (both are plaintext on disk) - only to
 * vscode.SecretStorage, which VS Code backs with the OS keychain.
 */
export class AuthManager {
    private currentUser: ApiUser | undefined;

    constructor(
        private readonly secrets: vscode.SecretStorage,
        private readonly api: ApiClient
    ) {
        this.api.setOnUnauthorized(() => {
            // The server told us the token is no longer valid - drop it
            // locally too, rather than let the extension keep presenting a
            // "logged in" state that the backend no longer honors.
            void this.clearSession();
        });
    }

    /** Call once at activation to restore a previously stored session. */
    async restore(): Promise<boolean> {
        const token = await this.secrets.get(TOKEN_KEY);
        if (!token) {
            return false;
        }
        this.api.setToken(token);

        try {
            const profile = await this.api.getProfile();
            this.currentUser = profile.user;
            return true;
        } catch (e) {
            // Token exists but the server rejected it (expired/invalid) -
            // this is the exact case the UserController 401 fix makes
            // detectable here; previously it surfaced as a generic 500.
            await this.clearSession();
            return false;
        }
    }

    async login(email: string, password: string): Promise<ApiUser> {
        const result = await this.api.login(email, password);
        await this.secrets.store(TOKEN_KEY, result.token);
        this.api.setToken(result.token);
        this.currentUser = result.user;
        return result.user;
    }

    async logout(): Promise<void> {
        await this.api.logout();
        await this.clearSession();
    }

    private async clearSession(): Promise<void> {
        await this.secrets.delete(TOKEN_KEY);
        this.api.setToken(undefined);
        this.currentUser = undefined;
    }

    isAuthenticated(): boolean {
        return this.currentUser !== undefined;
    }

    getCurrentUser(): ApiUser | undefined {
        return this.currentUser;
    }
}

/** Narrow a caught error down to a user-facing message, 401-aware. */
export function describeAuthError(e: unknown): string {
    if (e instanceof ApiError) {
        if (e.status === 401) {
            return 'Your session has expired. Please log in again.';
        }
        return e.message;
    }
    return e instanceof Error ? e.message : 'Unknown error';
}
