import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import authService from '../services/auth';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is invalid or missing its token. Request a new link.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, password, confirmPassword);
      setCompleted(true);
    } catch (requestError) {
      setError(requestError.message || 'Unable to reset your password. Request a new link and try again.');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'section',
    { className: 'min-h-[70vh] flex items-center justify-center px-4 py-12' },
    React.createElement(
      'div',
      { className: 'w-full max-w-md rounded-xl bg-white dark:bg-[#1a1d23] p-8 shadow-xl border border-gray-200 dark:border-[#2d333d]' },
      React.createElement(KeyRound, { size: 28, className: 'mb-5 text-[color:var(--accent)]', 'aria-hidden': 'true' }),
      React.createElement('h1', { className: 'text-2xl font-bold text-gray-900 dark:text-white' }, 'Set a new password'),
      completed
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement('p', { className: 'mt-3 text-sm text-gray-600 dark:text-[#9aa3af]', role: 'status', 'aria-live': 'polite' }, 'Your password has been reset.'),
            React.createElement(Link, { to: '/login', className: 'mt-6 inline-flex min-h-11 items-center rounded-md bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-hover)]' }, 'Continue to sign in')
          )
        : !token
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement('p', { className: 'mt-3 text-sm text-gray-600 dark:text-[#9aa3af]', role: 'alert' }, 'This reset link is invalid or missing its token. Request a new link.'),
              React.createElement(Link, { to: '/forgot-password', className: 'mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[color:var(--accent)] hover:underline' }, React.createElement(ArrowLeft, { size: 16, 'aria-hidden': 'true' }), 'Request a new link')
            )
          : React.createElement(
              'form',
              { className: 'mt-6 space-y-4', onSubmit: handleSubmit },
              React.createElement(
                'div',
                null,
                React.createElement('label', { htmlFor: 'new-password', className: 'mb-2 block text-sm font-medium text-gray-700 dark:text-[#d1d5db]' }, 'New password'),
                React.createElement('input', {
                  id: 'new-password',
                  type: 'password',
                  autoComplete: 'new-password',
                  minLength: 8,
                  required: true,
                  value: password,
                  onChange: (event) => setPassword(event.target.value),
                  className: 'w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] dark:border-[#3a414c] dark:bg-[#111318] dark:text-white'
                })
              ),
              React.createElement(
                'div',
                null,
                React.createElement('label', { htmlFor: 'confirm-password', className: 'mb-2 block text-sm font-medium text-gray-700 dark:text-[#d1d5db]' }, 'Confirm new password'),
                React.createElement('input', {
                  id: 'confirm-password',
                  type: 'password',
                  autoComplete: 'new-password',
                  minLength: 8,
                  required: true,
                  value: confirmPassword,
                  onChange: (event) => setConfirmPassword(event.target.value),
                  className: 'w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] dark:border-[#3a414c] dark:bg-[#111318] dark:text-white'
                })
              ),
              React.createElement('p', { className: 'text-xs leading-5 text-gray-500 dark:text-[#9aa3af]' }, 'Use at least 8 characters, including uppercase and lowercase letters, a number, and a symbol.'),
              error && React.createElement('p', { className: 'text-sm text-red-600', role: 'alert', 'aria-live': 'polite' }, error),
              React.createElement(
                'button',
                {
                  type: 'submit',
                  disabled: loading,
                  className: 'w-full rounded-md bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60'
                },
                loading ? 'Updating password...' : 'Reset password'
              )
            )
    )
  );
};

export default ResetPassword;