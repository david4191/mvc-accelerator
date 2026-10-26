import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  // Add debugging
  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated);
  console.log('ProtectedRoute - loading:', loading);
  console.log('ProtectedRoute - user:', user);
  console.log('ProtectedRoute - token:', localStorage.getItem('token'));

  if (loading) {
    return React.createElement(
      'div',
      { className: 'min-h-screen flex items-center justify-center' },
      React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]' })
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute - Not authenticated, redirecting to login');
    return React.createElement(Navigate, { to: '/login' });
  }

  console.log('ProtectedRoute - Authenticated, rendering children');
  return children;
};

export default ProtectedRoute;