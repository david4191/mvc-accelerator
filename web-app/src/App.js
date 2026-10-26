import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Generator from './pages/Generator';
import Projects from './pages/Projects';
import Search from './pages/Search';
import Health from './pages/Health';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import Pricing from './pages/Pricing';
import Documentation from './pages/Documentation';
import OAuthCallback from './pages/OAuthCallback';
import ProtectedRoute from './components/ProtectedRoute';
import ProjectDetail from './pages/ProjectDetail';

const AppLayout = ({ children }) => {
  return React.createElement(
    'div',
    { className: 'min-h-screen dark:bg-black relative md:p-3' },
    React.createElement('div', { className: 'app-gradient-bg' }),
    React.createElement(
      'div',
      { className: 'md:flex md:items-stretch md:min-h-screen md:rounded-2xl md:overflow-hidden md:shadow-2xl' },
      React.createElement(Sidebar, null),
      React.createElement(
        'main',
        { className: 'flex-1 min-w-0 bg-white/60 dark:bg-[#1a1a1a] backdrop-blur-xl md:backdrop-blur-xl' },
        children
      )
    )
  );
};

function App() {
  return React.createElement(
    ThemeProvider,
    null,
    React.createElement(
      AuthProvider,
      null,
      React.createElement(Toaster, {
        position: 'top-center',
        toastOptions: { duration: 4000 }
      }),
      React.createElement(
        Router,
        null,
        React.createElement(
          AppLayout,
          null,
        React.createElement(
          Routes,
          null,
          // Public Routes
          React.createElement(Route, { path: '/', element: React.createElement(Home, null) }),
          React.createElement(Route, { path: '/login', element: React.createElement(Login, null) }),
          React.createElement(Route, { path: '/register', element: React.createElement(Register, null) }),
          React.createElement(Route, { path: '/health', element: React.createElement(Health, null) }),
          React.createElement(Route, { path: '/pricing', element: React.createElement(Pricing, null) }),
          React.createElement(Route, { path: '/docs', element: React.createElement(Documentation, null) }),
          React.createElement(Route, { 
  path: '/projects/:id', 
  element: React.createElement(
    ProtectedRoute,
    null,
    React.createElement(ProjectDetail, null)
  )
}),
          React.createElement(Route, { path: '/oauth-callback', element: React.createElement(OAuthCallback, null) }),
          
          // Protected Routes (require authentication)
          React.createElement(Route, { 
            path: '/generator', 
            element: React.createElement(
              ProtectedRoute,
              null,
              React.createElement(Generator, null)
            )
          }),
          React.createElement(Route, { 
            path: '/search', 
            element: React.createElement(
              ProtectedRoute,
              null,
              React.createElement(Search, null)
            )
          }),
          React.createElement(Route, { 
            path: '/projects', 
            element: React.createElement(
              ProtectedRoute,
              null,
              React.createElement(Projects, null)
            )
          }),
          React.createElement(Route, { 
            path: '/settings', 
            element: React.createElement(
              ProtectedRoute,
              null,
              React.createElement(Settings, null)
            )
          }),
          React.createElement(Route, { 
            path: '/subscription', 
            element: React.createElement(
              ProtectedRoute,
              null,
              React.createElement(Subscription, null)
            )
          })
        )
      )
    )
    )
  );
}

export default App;