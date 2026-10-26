import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const OAuthCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const userStr = urlParams.get('user');
      const errorMsg = urlParams.get('error');

      if (errorMsg) {
        setStatus('error');
        setError(decodeURIComponent(errorMsg));
        return;
      }

      if (token && userStr) {
        try {
          const user = JSON.parse(decodeURIComponent(userStr));
          
          // Store auth data
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          localStorage.setItem('apiKey', user.api_key);
          
          setStatus('success');
          
          // Redirect to generator after 2 seconds
          setTimeout(() => {
            navigate('/generator');
          }, 2000);
        } catch (err) {
          setStatus('error');
          setError('Invalid user data received');
        }
      } else {
        setStatus('error');
        setError('No authentication data received');
      }
    };

    handleCallback();
  }, [navigate]);

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return React.createElement(
          'div',
          { className: 'text-center' },
          React.createElement(Loader2, { size: '1em', className: 'animate-spin text-5xl text-[color:var(--accent)] mx-auto mb-4' }),
          React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800 dark:text-[#f3f4f6] mb-2' }, 'Completing Authentication...'),
          React.createElement('p', { className: 'text-gray-600 dark:text-[#b0b8c2]' }, 'Please wait while we log you in.')
        );

      case 'success':
        return React.createElement(
          'div',
          { className: 'text-center' },
          React.createElement(CheckCircle2, { size: '1em', className: 'text-6xl text-green-500 mx-auto mb-4' }),
          React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800 dark:text-[#f3f4f6] mb-2' }, 'Login Successful!'),
          React.createElement('p', { className: 'text-gray-600 dark:text-[#b0b8c2] mb-4' }, 'Redirecting you to the generator...'),
          React.createElement('div', { className: 'w-16 h-16 mx-auto border-t-4 border-[color:var(--accent)] rounded-full animate-spin' })
        );

      case 'error':
        return React.createElement(
          'div',
          { className: 'text-center' },
          React.createElement(XCircle, { size: '1em', className: 'text-6xl text-red-500 mx-auto mb-4' }),
          React.createElement('h2', { className: 'text-2xl font-semibold text-gray-800 dark:text-[#f3f4f6] mb-2' }, 'Authentication Failed'),
          React.createElement('p', { className: 'text-red-600 mb-6' }, error),
          React.createElement(
            'button',
            {
              onClick: () => window.location.href = '/login',
              className: 'px-6 py-3 bg-[color:var(--accent)] text-white rounded-lg hover:bg-[color:var(--accent-hover)] transition-colors shadow-lg'
            },
            'Return to Login'
          )
        );

      default:
        return null;
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4' },
    React.createElement(
      'div',
      { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl shadow-xl p-8 max-w-md w-full transform transition-all hover:scale-105 duration-300' },
      renderContent()
    )
  );
};

export default OAuthCallback;