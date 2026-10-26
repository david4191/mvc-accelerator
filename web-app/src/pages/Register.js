import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, CheckCircle2, XCircle, ArrowRight, Code2 } from 'lucide-react';
import { register as apiRegister } from '../services/api';
import toast from 'react-hot-toast';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    fullname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [touched, setTouched] = useState({
    username: false,
    fullname: false,
    email: false,
    password: false,
    confirmPassword: false
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const validateUsername = (username) => {
    if (!username) return 'Username is required';
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 50) return 'Username must be less than 50 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
    return null;
  };

  const validateFullname = (name) => {
    if (!name) return 'Full name is required';
    if (name.length < 2) return 'Name must be at least 2 characters';
    if (!/^[a-zA-Z\s]+$/.test(name)) return 'Name can only contain letters and spaces';
    return null;
  };

  const validateEmail = (email) => {
    if (!email) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Email is invalid';
    return null;
  };

  const validatePassword = (password) => {
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    
    const checks = {
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^a-zA-Z0-9]/.test(password)
    };
    
    if (!checks.uppercase) return 'Must include uppercase letter';
    if (!checks.lowercase) return 'Must include lowercase letter';
    if (!checks.number) return 'Must include number';
    if (!checks.special) return 'Must include special character';
    
    return null;
  };

  const validateConfirmPassword = (confirm, password) => {
    if (!confirm) return 'Please confirm your password';
    if (confirm !== password) return 'Passwords do not match';
    return null;
  };

  const getFieldError = (field) => {
    switch (field) {
      case 'username':
        return touched.username ? validateUsername(formData.username) : null;
      case 'fullname':
        return touched.fullname ? validateFullname(formData.fullname) : null;
      case 'email':
        return touched.email ? validateEmail(formData.email) : null;
      case 'password':
        return touched.password ? validatePassword(formData.password) : null;
      case 'confirmPassword':
        return touched.confirmPassword ? validateConfirmPassword(formData.confirmPassword, formData.password) : null;
      default:
        return null;
    }
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    if (!password) return { strength: 0, label: 'No password', color: 'bg-gray-200' };
    
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
    
    const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];
    
    return {
      strength: Math.min(strength, 5),
      label: labels[strength - 1] || 'Weak',
      color: colors[strength - 1] || 'bg-gray-300'
    };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.dismiss();

    setTouched({
      username: true,
      fullname: true,
      email: true,
      password: true,
      confirmPassword: true
    });
    
    const errors = {
      username: validateUsername(formData.username),
      fullname: validateFullname(formData.fullname),
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
      confirmPassword: validateConfirmPassword(formData.confirmPassword, formData.password)
    };
    
    if (Object.values(errors).some(error => error !== null)) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    
    const loadingToast = toast.loading('Creating your account...');
    
    try {
      const response = await apiRegister(
        formData.username,
        formData.fullname,
        formData.email,
        formData.password
      );
      
      toast.dismiss(loadingToast);
      
      if (response && response.token) {
        toast.success('Registration Successful! Welcome to MVC Accelerator', {
          duration: 4000,
          icon: React.createElement(CheckCircle2, { size: 18 }),
          style: {
            background: '#4A5C3A',
            color: '#fff',
            borderRadius: '12px',
          }
        });
        
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('apiKey', response.user.api_key);
        
        await login(formData.email, formData.password);
        
        setTimeout(() => {
          navigate('/generator');
        }, 1500);
      } else {
        toast.error(response?.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.dismiss(loadingToast);
      
      if (error.status === 409 || (error.data?.error && error.data.error.includes('Email already'))) {
        toast.error('Email already registered. Please login or use a different email.');
      } else if (error.data?.error && error.data.error.includes('Username')) {
        toast.error(error.data.error);
      } else if (error.data?.error) {
        toast.error(error.data.error);
      } else {
        toast.error('Registration failed. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = () => {
    setGoogleLoading(true);
    toast.loading('Redirecting to Google...');
    window.location.href = 'https://mvc-accelerator.technosphereinnovations.com/api/auth/google';
  };

  const passwordStrength = getPasswordStrength();

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
          'Create Account'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-500 dark:text-[#9aa3af] text-sm' },
          'Start building with MVC Accelerator'
        )
      ),
      
      // Google Sign Up
      React.createElement(
        'button',
        {
          onClick: handleGoogleRegister,
          disabled: googleLoading,
          className: 'w-full mb-6 py-3 border border-gray-200 dark:border-[#2d333d] rounded-xl flex items-center justify-center space-x-3 hover:border-[color:var(--accent)] hover:bg-gray-50 dark:hover:bg-[#0f1115] transition-all duration-300'
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
          googleLoading ? 'Redirecting...' : 'Sign up with Google'
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
          React.createElement('span', { className: 'px-4 bg-white dark:bg-[#1a1d23] text-gray-400 dark:text-[#7b8494]' }, 'Or sign up with email')
        )
      ),
      
      // Registration Form
      React.createElement(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-5' },
        
        // Username field
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Username'),
          React.createElement(
            'div',
            { className: 'relative' },
            React.createElement(User, { size: '1em', className: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#7b8494] text-sm' }),
            React.createElement('input', {
              type: 'text',
              name: 'username',
              value: formData.username,
              onChange: handleChange,
              onBlur: () => handleBlur('username'),
              className: `w-full pl-10 pr-3 py-3 border ${getFieldError('username') ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-colors text-sm`,
              placeholder: 'john_doe123'
            })
          ),
          getFieldError('username') && React.createElement('p', { className: 'mt-1 text-xs text-red-500' }, getFieldError('username')),
          React.createElement('p', { className: 'mt-1 text-xs text-gray-400 dark:text-[#7b8494]' }, 'Letters, numbers, and underscores only. 3-50 characters.')
        ),
        
        // Full Name field
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Full Name'),
          React.createElement(
            'div',
            { className: 'relative' },
            React.createElement(User, { size: '1em', className: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#7b8494] text-sm' }),
            React.createElement('input', {
              type: 'text',
              name: 'fullname',
              value: formData.fullname,
              onChange: handleChange,
              onBlur: () => handleBlur('fullname'),
              className: `w-full pl-10 pr-3 py-3 border ${getFieldError('fullname') ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-colors text-sm`,
              placeholder: 'John Doe'
            })
          ),
          getFieldError('fullname') && React.createElement('p', { className: 'mt-1 text-xs text-red-500' }, getFieldError('fullname'))
        ),
        
        // Email field
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
              name: 'email',
              value: formData.email,
              onChange: handleChange,
              onBlur: () => handleBlur('email'),
              className: `w-full pl-10 pr-3 py-3 border ${getFieldError('email') ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-colors text-sm`,
              placeholder: 'you@example.com'
            })
          ),
          getFieldError('email') && React.createElement('p', { className: 'mt-1 text-xs text-red-500' }, getFieldError('email'))
        ),
        
        // Password field
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
              name: 'password',
              value: formData.password,
              onChange: handleChange,
              onBlur: () => handleBlur('password'),
              className: `w-full pl-10 pr-10 py-3 border ${getFieldError('password') ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-colors text-sm`,
              placeholder: 'Create a strong password'
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
          formData.password && React.createElement(
            'div',
            { className: 'mt-2' },
            React.createElement(
              'div',
              { className: 'flex items-center space-x-2' },
              React.createElement(
                'div',
                { className: 'flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden' },
                React.createElement('div', {
                  className: `h-full ${passwordStrength.color} transition-all duration-300`,
                  style: { width: `${(passwordStrength.strength / 5) * 100}%` }
                })
              ),
              React.createElement('span', { className: 'text-xs text-gray-500 dark:text-[#9aa3af]' }, passwordStrength.label)
            )
          ),
          getFieldError('password') && React.createElement('p', { className: 'mt-1 text-xs text-red-500' }, getFieldError('password'))
        ),
        
        // Confirm Password field
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Confirm Password'),
          React.createElement(
            'div',
            { className: 'relative' },
            React.createElement(Lock, { size: '1em', className: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#7b8494] text-sm' }),
            React.createElement('input', {
              type: showConfirmPassword ? 'text' : 'password',
              name: 'confirmPassword',
              value: formData.confirmPassword,
              onChange: handleChange,
              onBlur: () => handleBlur('confirmPassword'),
              className: `w-full pl-10 pr-10 py-3 border ${getFieldError('confirmPassword') ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-colors text-sm`,
              placeholder: 'Re-enter your password'
            }),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => setShowConfirmPassword(!showConfirmPassword),
                className: 'absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#7b8494] hover:text-gray-600 dark:text-[#b0b8c2]'
              },
              showConfirmPassword ? React.createElement(EyeOff, { size: 18 }) : React.createElement(Eye, { size: 18 })
            )
          ),
          formData.confirmPassword && React.createElement(
            'div',
            { className: 'mt-1 flex items-center space-x-1' },
            formData.password === formData.confirmPassword
              ? React.createElement(React.Fragment, null,
                  React.createElement(CheckCircle2, { size: '1em', className: 'text-green-500 text-xs' }),
                  React.createElement('span', { className: 'text-xs text-green-600' }, 'Passwords match')
                )
              : React.createElement(React.Fragment, null,
                  React.createElement(XCircle, { size: '1em', className: 'text-red-500 text-xs' }),
                  React.createElement('span', { className: 'text-xs text-red-500' }, 'Passwords do not match')
                )
          ),
          getFieldError('confirmPassword') && React.createElement('p', { className: 'mt-1 text-xs text-red-500' }, getFieldError('confirmPassword'))
        ),
        
        // Submit Button
        React.createElement(
          'button',
          {
            type: 'submit',
            disabled: loading,
            className: 'w-full py-3 bg-[color:var(--accent)] text-white rounded-xl font-semibold hover:bg-[color:var(--accent-hover)] transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 shadow-sm flex items-center justify-center space-x-2 mt-2'
          },
          loading ? [
            React.createElement('div', { key: 'spinner', className: 'animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent' }),
            React.createElement('span', { key: 'text' }, 'Creating account...')
          ] : [
            React.createElement('span', { key: 'text' }, 'Create Account'),
            React.createElement(ArrowRight, { key: 'arrow', size: 14 })
          ]
        )
      ),
      
      // Login Link
      React.createElement(
        'p',
        { className: 'text-center mt-6 text-sm text-gray-500 dark:text-[#9aa3af]' },
        'Already have an account? ',
        React.createElement(
          Link,
          { to: '/login', className: 'text-[color:var(--accent)] font-semibold hover:text-[color:var(--accent-hover)] hover:underline transition-colors' },
          'Sign In'
        )
      )
    )
  );
};

export default Register;