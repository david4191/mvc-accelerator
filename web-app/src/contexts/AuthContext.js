import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            console.log('AuthContext - Checking authentication...');
            const token = localStorage.getItem('token');
            const userData = localStorage.getItem('user');
            
            console.log('AuthContext - Token exists:', !!token);
            console.log('AuthContext - User data exists:', !!userData);
            
            if (token && userData) {
                const parsedUser = JSON.parse(userData);
                console.log('AuthContext - User parsed:', parsedUser);
                setUser(parsedUser);
                setIsAuthenticated(true);
            } else {
                console.log('AuthContext - No token or user data found');
                setUser(null);
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
            console.log('AuthContext - Loading complete, isAuthenticated:', isAuthenticated);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await authService.login(email, password);
            console.log('AuthContext - Login response:', response);
            
            if (response.token) {
                localStorage.setItem('token', response.token);
                localStorage.setItem('user', JSON.stringify(response.user));
                localStorage.setItem('apiKey', response.user.api_key);
                setUser(response.user);
                setIsAuthenticated(true);
                console.log('AuthContext - Login successful, user set:', response.user);
                return { success: true };
            }
            return { success: false, error: 'Invalid credentials' };
        } catch (error) {
            console.error('AuthContext - Login error:', error);
            return { success: false, error: error.message };
        }
    };

    const register = async (fullname, email, password) => {
        try {
            const response = await authService.register(fullname, email, password);
            console.log('AuthContext - Register response:', response);
            
            if (response.token) {
                localStorage.setItem('token', response.token);
                localStorage.setItem('user', JSON.stringify(response.user));
                localStorage.setItem('apiKey', response.user.api_key);
                setUser(response.user);
                setIsAuthenticated(true);
                console.log('AuthContext - Register successful, user set:', response.user);
                return { success: true };
            }
            return { success: false, error: response.error };
        } catch (error) {
            console.error('AuthContext - Register error:', error);
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        console.log('AuthContext - Logging out');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('apiKey');
        setUser(null);
        setIsAuthenticated(false);
    };

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        register,
        logout
    };

    console.log('AuthContext - Current state:', { isAuthenticated, loading, user: !!user });

    return React.createElement(
        AuthContext.Provider,
        { value: value },
        children
    );
};