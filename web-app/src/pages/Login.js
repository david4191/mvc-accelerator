import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Code2 } from 'lucide-react';
import { login as apiLogin, googleLogin } from '../services/api';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [lockoutTime, setLockoutTime] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const validateForm = () => {
    const newErrors = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    toast.dismiss();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    
    setLoading(true);
    
    const loadingToast = toast.loading('Signing you in...');
    
    try {
      const response = await apiLogin(email, password);
      
      toast.dismiss(loadingToast);
      
      if (response && response.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('apiKey', response.user.api_key);
        
        try {
          await login(email, password);
        } catch (authError) {
          console.error('Auth context login error:', authError);
        }
        
        toast.success('Welcome back!', {
          duration: 3000,
          icon: React.createElement(CheckCircle2, { size: 18 }),
          style: {
            background: '#4A5C3A',
            color: '#fff',
            padding: '16px',
            borderRadius: '12px',
          }
        });
        
        setTimeout(() => {
          navigate('/generator', { replace: true });
        }, 1500);
      } else {
        toast.error(response?.message || 'Invalid credentials.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.dismiss(loadingToast);
      
      if (error.status === 429) {
        const retryAfter = error.data?.retry_after || 900;
        const minutes = Math.ceil(retryAfter / 60);
        setLockoutTime(Date.now() + (retryAfter * 1000));
        toast.error(`Too many attempts. Please wait ${minutes} minute(s).`);
      } else if (error.status === 401) {
        toast.error('Invalid email or password.');
        setPassword('');
      } else {
        toast.error(error.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    toast.loading('Redirecting to Google...');
    try {
      googleLogin();
    } catch (error) {
      setGoogleLoading(false);
      toast.error('Failed to connect to Google.');
    }
  };

  useEffect(() => {
    if (!lockoutTime) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutTime - Date.now()) / 1000));
      if (remaining <= 0) {
        setLockoutTime(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  const isLockedOut = lockoutTime && lockoutTime > Date.now();
  const lockoutRemaining = lockoutTime ? Math.ceil((lockoutTime - Date.now()) / 1000) : 0;
  const lockoutMinutes = Math.floor(lockoutRemaining / 60);
  const lockoutSeconds = lockoutRemaining % 60;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] flex items-center justify-center py-12 px-4' },
    React.createElement(
      'div',
      { className: 'max-w-md w-full bg-white dark:bg-[#1a1d23] rounded-2xl shadow-xl border border-gray-200 dark:border-[#2d333d] p-8 transform transition-all duration-300 hover:shadow-2xl' },
      
      // Logo and Header
      React.createElement(
        'div',
        { className: 'text-center mb-8' },
        React.createElement(
          'div',
          { className: 'inline-flex items-center justify-center w-16 h-16 bg-[color:var(--accent)]/10 rounded-full mb-4' },
          React.createElement(Code2, { size: '1em', className: 'text-3xl text-[color:var(--accent)]' })
        ),
        React.createElement(
          'h2',
          { className: 'text-3xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2' },
          'Welcome Back'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-500 dark:text-[#9aa3af] text-sm' },
          'Sign in to continue building amazing projects'
        )
      ),
      
      // Form error
      errors.form && React.createElement(
        'div',
        { className: 'mb-4 p-3 bg-red-50 border border-red-200 rounded-lg' },
        React.createElement('p', { className: 'text-sm text-red-600 flex items-center' },
          React.createElement(AlertTriangle, { size: '1em', className: 'mr-2 flex-shrink-0' }),
          errors.form
        )
      ),
      
      // Google Login
      React.createElement(
        'button',
        {
          onClick: handleGoogleLogin,
          disabled: googleLoading || isLockedOut,
          type: 'button',
          className: `w-full mb-6 py-3 border border-gray-200 dark:border-[#2d333d] rounded-xl flex items-center justify-center space-x-3 hover:border-[color:var(--accent)] hover:bg-gray-50 dark:hover:bg-[#0f1115] transition-all duration-300 ${isLockedOut ? 'opacity-50 cursor-not-allowed' : ''}`
        },
        React.createElement(
          'svg',
          { width: 20, height: 20, viewBox: '0 0 48 48' },
          React.createElement('path', { fill: '#FFC107', d: 'M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z' }),
          React.createElement('path', { fill: '#FF3D00', d: 'M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z' }),
          React.createElement('path', { fill: '#4CAF50', d: 'M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z' }),
          React.createElement('path', { fill: '#1976D2', d: 'M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z' })
        ),
        React.createElement('span', { className: 'text-gray-700 dark:text-[#d1d5db] font-medium' }, 
          googleLoading ? 'Redirecting...' : 'Continue with Google'
        )
      ),
      
      // Divider
      React.createElement(
        'div',
        { className: 'relative mb-6' },
        React.createElement('div', { className: 'absolute inset-0 flex items-center' },
          React.createElement('div', { className: 'w-full border-t border-gray-200 dark:border-[#2d333d]' })
        ),
        React.createElement('div', { className: 'relative flex justify-center text-sm' },
          React.createElement('span', { className: 'px-4 bg-white dark:bg-[#1a1d23] text-gray-400 dark:text-[#7b8494]' }, 'Or continue with email')
        )
      ),
      
      // Login Form
      React.createElement(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-5' },
        
        // Email Field
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Email Address'),
          React.createElement(
            'div',
            { className: 'relative' },
            React.createElement(Mail, { size: '1em', className: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#7b8494] text-sm' }),
            React.createElement('input', {
              type: 'email',
              value: email,
              onChange: (e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({...errors, email: null});
              },
              disabled: isLockedOut,
              className: `w-full pl-10 pr-3 py-3 border ${errors.email ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-colors text-sm ${isLockedOut ? 'bg-gray-50 dark:bg-[#0f1115]' : ''}`,
              placeholder: 'you@example.com'
            })
          ),
          errors.email && React.createElement('p', { className: 'mt-1 text-xs text-red-500' }, errors.email)
        ),
        
        // Password Field
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Password'),
          React.createElement(
            'div',
            { className: 'relative' },
            React.createElement(Lock, { size: '1em', className: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#7b8494] text-sm' }),
            React.createElement('input', {
              type: showPassword ? 'text' : 'password',
              value: password,
              onChange: (e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({...errors, password: null});
              },
              disabled: isLockedOut,
              className: `w-full pl-10 pr-10 py-3 border ${errors.password ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-colors text-sm ${isLockedOut ? 'bg-gray-50 dark:bg-[#0f1115]' : ''}`,
              placeholder: '••••••••'
            }),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => setShowPassword(!showPassword),
                className: 'absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#7b8494] hover:text-gray-600 dark:text-[#b0b8c2]'
              },
              showPassword ? React.createElement(EyeOff, { size: 18 }) : React.createElement(Eye, { size: 18 })
            )
          ),
          errors.password && React.createElement('p', { className: 'mt-1 text-xs text-red-500' }, errors.password)
        ),
        
        // Forgot Password
        React.createElement(
          'div',
          { className: 'flex justify-end' },
          React.createElement(
            Link,
            { to: '/forgot-password', className: 'text-sm text-[color:var(--accent)] hover:text-[color:var(--accent-hover)] hover:underline transition-colors' },
            'Forgot password?'
          )
        ),
        
        // Lockout Timer
        isLockedOut && React.createElement(
          'div',
          { className: 'p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center' },
          React.createElement('p', { className: 'text-sm text-yellow-700' },
            React.createElement(AlertTriangle, { size: '1em', className: 'inline mr-2' }),
            `Please wait ${lockoutMinutes}:${lockoutSeconds.toString().padStart(2, '0')} before trying again.`
          )
        ),
        
        // Submit Button
        React.createElement(
          'button',
          {
            type: 'submit',
            disabled: loading || isLockedOut,
            className: `w-full py-3 bg-[color:var(--accent)] text-white rounded-xl font-semibold hover:bg-[color:var(--accent-hover)] transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 shadow-sm flex items-center justify-center space-x-2`
          },
          loading ? [
            React.createElement('div', { key: 'spinner', className: 'animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent' }),
            React.createElement('span', { key: 'text' }, 'Signing in...')
          ] : [
            React.createElement('span', { key: 'text' }, 'Sign In'),
            React.createElement(ArrowRight, { key: 'arrow', size: 14 })
          ]
        )
      ),
      
      // Register Link
      React.createElement(
        'p',
        { className: 'text-center mt-6 text-sm text-gray-500 dark:text-[#9aa3af]' },
        "Don't have an account? ",
        React.createElement(
          Link,
          { to: '/register', className: 'text-[color:var(--accent)] font-semibold hover:text-[color:var(--accent-hover)] hover:underline transition-colors' },
          'Create free account'
        )
      )
    )
  );
};

export default Login;