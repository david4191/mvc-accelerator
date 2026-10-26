"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManager = void 0;
exports.describeAuthError = describeAuthError;
const ApiClient_1 = require("../api/ApiClient");
const TOKEN_KEY = 'mvcAccelerator.authToken';
/**
 * Owns the session token end to end: never written to globalState or a
 * settings.json value (both are plaintext on disk) - only to
 * vscode.SecretStorage, which VS Code backs with the OS keychain.
 */
class AuthManager {
    constructor(secrets, api) {
        this.secrets = secrets;
        this.api = api;
        this.api.setOnUnauthorized(() => {
            // The server told us the token is no longer valid - drop it
            // locally too, rather than let the extension keep presenting a
            // "logged in" state that the backend no longer honors.
            void this.clearSession();
        });
    }
    /** Call once at activation to restore a previously stored session. */
    async restore() {
        const token = await this.secrets.get(TOKEN_KEY);
        if (!token) {
            return false;
        }
        this.api.setToken(token);
        try {
            const profile = await this.api.getProfile();
            this.currentUser = profile.user;
            return true;
        }
        catch (e) {
            // Token exists but the server rejected it (expired/invalid) -
            // this is the exact case the UserController 401 fix makes
            // detectable here; previously it surfaced as a generic 500.
            await this.clearSession();
            return false;
        }
    }
    async login(email, password) {
        const result = await this.api.login(email, password);
        await this.secrets.store(TOKEN_KEY, result.token);
        this.api.setToken(result.token);
        this.currentUser = result.user;
        return result.user;
    }
    async logout() {
        await this.api.logout();
        await this.clearSession();
    }
    async clearSession() {
        await this.secrets.delete(TOKEN_KEY);
        this.api.setToken(undefined);
        this.currentUser = undefined;
    }
    isAuthenticated() {
        return this.currentUser !== undefined;
    }
    getCurrentUser() {
        return this.currentUser;
    }
}
exports.AuthManager = AuthManager;
/** Narrow a caught error down to a user-facing message, 401-aware. */
function describeAuthError(e) {
    if (e instanceof ApiClient_1.ApiError) {
        if (e.status === 401) {
            return 'Your session has expired. Please log in again.';
        }
        return e.message;
    }
    return e instanceof Error ? e.message : 'Unknown error';
}
//# sourceMappingURL=AuthManager.js.map