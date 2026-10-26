import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'https://mvc-accelerator.onrender.com/api';

// Create axios instance with increased timeout (180 seconds)
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 180000 // 180 seconds (3 minutes) - DeepSeek can be slow
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const apiKey = localStorage.getItem('apiKey');
        if (apiKey) {
            config.headers['X-API-Key'] = apiKey;
        }

        console.log(`🚀 API Request: ${config.method.toUpperCase()} ${config.url}`);
        if (config.data) {
            console.log('📦 Request data:', config.data);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => {
        console.log('✅ API Response received:', response.data);
        return response.data;
    },
    (error) => {
        console.error('❌ API Error:', {
            status: error.response?.status,
            url: error.config?.url,
            message: error.message,
            data: error.response?.data
        });

        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('apiKey');
            window.location.href = '/login';
        }

        // Create a detailed error object with the actual error message from server
        const enhancedError = {
            message: error.response?.data?.error || error.response?.data?.message || error.message || 'An error occurred',
            status: error.response?.status,
            data: error.response?.data,
            original: error
        };

        return Promise.reject(enhancedError);
    }
);

/**
 * Generate a preview response (used by Home.js)
 * NO FALLBACKS - returns actual API response or throws error
 */
export const generatePreview = async (prompt, model = 'deepseek') => {
    try {
        console.log(`📝 Sending prompt to ${model}:`, prompt);
        const response = await api.post('/generate/preview', { prompt, model });

        // If response has error flag, throw it
        if (response.success === false) {
            throw new Error(response.error || 'Generation failed');
        }

        // Return the actual response structure
        return {
            type: response.type || 'answer',
            answer: response.answer || response,
            files: response.files || {},
            model: response.model || model,
            success: true
        };
    } catch (error) {
        console.error('❌ Preview generation failed:', error);

        // Re-throw with the real message, but keep the structured response
        // body (limitReached/reason/etc.) intact for callers to inspect.
        const wrapped = new Error(error.message || 'Failed to generate response');
        wrapped.data = error.data;
        wrapped.status = error.status;
        throw wrapped;
    }
};

/**
 * Generate full project code (used by Generator.js)
 */
export const generateCode = async (data) => {
    try {
        console.log('📝 Generating code with:', data);
        const response = await api.post('/generate', data);

        if (response.success === false) {
            throw new Error(response.error || 'Generation failed');
        }

        return response;
    } catch (error) {
        console.error('❌ Code generation failed:', error);
        throw error;
    }
};

/**
 * Break a heavy/bulk build request into an ordered module plan so it can
 * be generated piece by piece into the same project (used by Generator.js)
 */
export const planProject = async (prompt, model = 'deepseek') => {
    try {
        const response = await api.post('/generate/plan', { prompt, model });

        if (response.success === false) {
            throw new Error(response.error || 'Planning failed');
        }

        return response;
    } catch (error) {
        console.error('❌ Build planning failed:', error);
        const wrapped = new Error(error.message || 'Failed to plan this build');
        wrapped.data = error.data;
        wrapped.status = error.status;
        throw wrapped;
    }
};

/**
 * Get a project's merged file tree, accumulated across every generation
 * made into it so far (not just its latest one)
 */
export const getProjectFiles = (id) => api.get(`/projects/${id}/files`);

/**
 * Create a new project
 */
export const createProject = async (data) => {
    try {
        console.log('📝 Creating project:', data);
        const response = await api.post('/projects', data);

        if (response.success === false) {
            throw new Error(response.error || 'Failed to create project');
        }

        return response;
    } catch (error) {
        console.error('❌ Project creation failed:', error);
        throw error;
    }
};

// Health check
export const healthCheck = () => api.get('/health');

// Authentication
export const login = async (email, password) => {
    try {
        const response = await api.post('/login', { email, password });
        return response;
    } catch (error) {
        throw error;
    }
};

export const register = async (username, fullname, email, password) => {
    try {
        const response = await api.post('/register', {
            username,
            fullname,
            email,
            password
        });
        return response;
    } catch (error) {
        throw error;
    }
};

export const logout = () => api.post('/logout');

export const googleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
};

export const refreshToken = async () => {
    try {
        const response = await api.post('/refresh-token');
        if (response.token) {
            localStorage.setItem('token', response.token);
        }
        return response;
    } catch (error) {
        throw error;
    }
};

// User profile
export const getUserProfile = () => api.get('/user/profile');

export const updateUserProfile = async (data) => {
    try {
        const response = await api.put('/user/profile', data);
        return response;
    } catch (error) {
        throw error;
    }
};

export const changePassword = async (currentPassword, newPassword) => {
    try {
        const response = await api.post('/user/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        });
        return response;
    } catch (error) {
        throw error;
    }
};

// Projects
export const getProjects = () => api.get('/projects');

export const getProject = (id) => api.get(`/projects/${id}`);

export const updateProject = (id, data) => api.put(`/projects/${id}`, data);

export const deleteProject = (id) => api.delete(`/projects/${id}`);

export const scanProject = (projectId, path) =>
    api.post(`/projects/${projectId}/scan`, { path });

// Generations
export const getGenerations = () => api.get('/generations');

export const getGeneration = (id) => api.get(`/generations/${id}`);

export const downloadGeneration = (id) => api.get(`/generations/${id}/download`);

// Subscription endpoints live in services/subscription.js, which is what
// Subscription.js and PaymentModal.js actually import - kept out of this
// file to avoid two divergent copies (the old pair here pointed at a
// /subscribe route that was never registered on the backend).

export default api;