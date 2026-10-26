const vscode = require('vscode');

class AuthService {
    constructor(context, apiService) {
        this.context = context;
        this.apiService = apiService;
    }

    /**
     * Login user
     */
    async login(email, password) {
        try {
            const response = await this.apiService.post('/login', { email, password });
            
            if (response.token) {
                await this.context.globalState.update('authToken', response.token);
                await this.context.globalState.update('user', response.user);
                
                if (response.user.api_key) {
                    await vscode.workspace.getConfiguration('mvcAccelerator').update(
                        'apiKey',
                        response.user.api_key,
                        vscode.ConfigurationTarget.Global
                    );
                }
                
                return { success: true, user: response.user };
            }
            
            return { success: false, error: 'Invalid response from server' };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Register user
     */
    async register(username, email, password) {
        try {
            const response = await this.apiService.post('/register', {
                username,
                email,
                password
            });
            
            if (response.token) {
                await this.context.globalState.update('authToken', response.token);
                await this.context.globalState.update('user', response.user);
                
                if (response.user.api_key) {
                    await vscode.workspace.getConfiguration('mvcAccelerator').update(
                        'apiKey',
                        response.user.api_key,
                        vscode.ConfigurationTarget.Global
                    );
                }
                
                return { success: true, user: response.user };
            }
            
            return { success: false, error: 'Invalid response from server' };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await this.apiService.post('/logout');
        } catch (error) {
            // Ignore logout errors
        } finally {
            await this.context.globalState.update('authToken', null);
            await this.context.globalState.update('user', null);
            await vscode.workspace.getConfiguration('mvcAccelerator').update(
                'apiKey',
                '',
                vscode.ConfigurationTarget.Global
            );
        }
    }

    /**
     * Check if authenticated
     */
    async isAuthenticated() {
        const token = await this.context.globalState.get('authToken');
        const apiKey = vscode.workspace.getConfiguration('mvcAccelerator').get('apiKey');
        
        if (!token && !apiKey) {
            return false;
        }

        // Verify token with server
        try {
            await this.apiService.get('/user/profile');
            return true;
        } catch (error) {
            // Token invalid
            await this.logout();
            return false;
        }
    }

    /**
     * Get current user
     */
    async getCurrentUser() {
        return await this.context.globalState.get('user');
    }

    /**
     * Get subscription
     */
    async getSubscription() {
        try {
            const response = await this.apiService.get('/subscription/status');
            return response;
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if has active subscription
     */
    async hasActiveSubscription() {
        try {
            const subscription = await this.getSubscription();
            return subscription?.status === 'active';
        } catch (error) {
            return false;
        }
    }

    /**
     * Refresh token
     */
    async refreshToken() {
        try {
            const response = await this.apiService.post('/refresh-token');
            
            if (response.token) {
                await this.context.globalState.update('authToken', response.token);
                return true;
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear cache
     */
    async clearCache() {
        await this.context.globalState.update('authToken', null);
        await this.context.globalState.update('user', null);
    }
}

module.exports = { AuthService };