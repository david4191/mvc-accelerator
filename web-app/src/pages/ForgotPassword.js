import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import authService from '../services/auth';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.requestPasswordReset(email);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || 'Unable to request a password reset right now.');
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
      React.createElement(Mail, { size: 28, className: 'mb-5 text-[color:var(--accent)]', 'aria-hidden': 'true' }),
      React.createElement('h1', { className: 'text-2xl font-bold text-gray-900 dark:text-white' }, 'Forgot your password?'),
      React.createElement(
        'p',
        { className: 'mt-2 text-sm leading-6 text-gray-600 dark:text-[#9aa3af]' },
        'Enter the email address on your account and we will send a reset link if the account exists.'
      ),
      submitted
        ? React.createElement(
            'p',
            { className: 'mt-6 rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200', role: 'status', 'aria-live': 'polite' },
            'If the email exists, a password reset link has been sent.'
          )
        : React.createElement(
            'form',
            { className: 'mt-6 space-y-4', onSubmit: handleSubmit },
            React.createElement(
              'div',
              null,
              React.createElement('label', { htmlFor: 'reset-email', className: 'mb-2 block text-sm font-medium text-gray-700 dark:text-[#d1d5db]' }, 'Email address'),
              React.createElement('input', {
                id: 'reset-email',
                name: 'email',
                type: 'email',
                autoComplete: 'email',
                required: true,
                value: email,
                onChange: (event) => setEmail(event.target.value),
                className: 'w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] dark:border-[#3a414c] dark:bg-[#111318] dark:text-white',
                'aria-describedby': error ? 'reset-error' : undefined
              }),
              error && React.createElement('p', { id: 'reset-error', className: 'mt-2 text-sm text-red-600', role: 'alert' }, error)
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                disabled: loading,
                className: 'w-full rounded-md bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60'
              },
              loading ? 'Sending request...' : 'Send reset link'
            )
          ),
      React.createElement(
        Link,
        { to: '/login', className: 'mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[color:var(--accent)] hover:underline' },
        React.createElement(ArrowLeft, { size: 16, 'aria-hidden': 'true' }),
        'Back to sign in'
      )
    )
  );
};

export default ForgotPassword;