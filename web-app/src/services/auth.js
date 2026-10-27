import api from './api';

class AuthService {
    async login(email, password) {
        const response = await api.post('/login', { email, password });
        
        if (response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('apiKey', response.user.api_key);
        }
        
        return response;
    }

       async register(username, fullname, email, password) {
        // Send username separately from fullname
        const response = await api.post('/register', { 
            username,     // For login (alphanumeric + underscore)
            fullname,     // For display (letters and spaces)
            email, 
            password 
        });
        
        if (response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('apiKey', response.user.api_key);
        }
        
        return response;
    }


    async logout() {
        try {
            await api.post('/logout');
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('apiKey');
        }
    }

    async refreshToken() {
        const response = await api.post('/refresh-token');
        
        if (response.token) {
            localStorage.setItem('token', response.token);
        }
        
        return response;
    }

    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            return JSON.parse(userStr);
        }
        return null;
    }

    getToken() {
        return localStorage.getItem('token');
    }

    getApiKey() {
        return localStorage.getItem('apiKey');
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    async updateProfile(data) {
        const apiKey = this.getApiKey();
        const response = await api.put('/user/profile', data, {
            headers: { 'X-API-Key': apiKey }
        });
        
        if (response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
        }
        
        return response;
    }

    async changePassword(currentPassword, newPassword) {
        const apiKey = this.getApiKey();
        return api.post('/user/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        }, {
            headers: { 'X-API-Key': apiKey }
        });
    }

    async requestPasswordReset(email) {
        return api.post('/forgot-password', { email });
    }

    async resetPassword(token, password, confirmPassword) {
        return api.post('/reset-password', {
            token,
            password,
            confirm_password: confirmPassword
        });
    }

    async verifyEmail(token) {
        return api.get(`/verify-email?token=${token}`);
    }

    async resendVerification() {
        const apiKey = this.getApiKey();
        return api.post('/resend-verification', {}, {
            headers: { 'X-API-Key': apiKey }
        });
    }
}

export default new AuthService();