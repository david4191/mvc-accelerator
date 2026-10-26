const axios = require('axios');
const vscode = require('vscode');

class ApiService {
    constructor(context) {
        this.context = context;
        this.baseURL = vscode.workspace.getConfiguration('mvcAccelerator').get('apiUrl');
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Request interceptor
        this.client.interceptors.request.use(
            config => {
                const apiKey = vscode.workspace.getConfiguration('mvcAccelerator').get('apiKey');
                if (apiKey) {
                    config.headers['X-API-Key'] = apiKey;
                }
                
                const token = this.context.globalState.get('authToken');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                
                return config;
            },
            error => {
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            response => response.data,
            error => {
                if (error.response?.status === 401) {
                    // Clear invalid token
                    this.context.globalState.update('authToken', null);
                    vscode.commands.executeCommand('mvc-accelerator.login');
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Set base URL
     */
    setBaseUrl(url) {
        this.baseURL = url;
        this.client.defaults.baseURL = url;
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        try {
            return await this.client.get(endpoint, { params });
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        try {
            return await this.client.post(endpoint, data);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        try {
            return await this.client.put(endpoint, data);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        try {
            return await this.client.delete(endpoint);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Handle error
     */
    handleError(error) {
        if (error.response) {
            // Server responded with error
            const message = error.response.data?.error || error.response.statusText;
            const status = error.response.status;
            
            const customError = new Error(message);
            customError.status = status;
            customError.response = error.response;
            
            return customError;
        } else if (error.request) {
            // Request made but no response
            return new Error('Network error. Please check your connection.');
        } else {
            // Something else
            return error;
        }
    }
}

module.exports = { ApiService };