import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getProjects } from '../services/api';
import {
  Plus, Search, Folder, Activity,
  LogOut, Settings, CreditCard,
  FileText, Sun, Moon, Trash2,
  Menu, X, MessageSquare, ChevronDown
} from 'lucide-react';

const HISTORY_EVENT = 'conversation-history-changed';
const MAX_HISTORY = 20;

const loadMergedHistory = () => {
  const readList = (key, source) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(e => ({ ...e, _source: source })) : [];
    } catch (e) {
      return [];
    }
  };

  const merged = [
    ...readList('homeConversationHistory', 'home'),
    ...readList('generatorConversationHistory', 'generator')
  ];

  merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return merged.slice(0, MAX_HISTORY);
};

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [history, setHistory] = useState(loadMergedHistory);
  // null = not loaded yet (don't filter anything out while unknown);
  // once loaded, a generator entry whose project isn't in here anymore
  // (soft-deleted) gets hidden instead of lingering forever.
  const [activeProjectIds, setActiveProjectIds] = useState(null);

  const { isAuthenticated, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsOpen(!mobile);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) setIsOpen(false);
    setProfileMenuOpen(false);
    setHistory(loadMergedHistory());
  }, [location.pathname, isMobile]);

  // Cross-check against the backend's real project list so a soft-deleted
  // project's old entries stop showing here - loadMergedHistory only reads
  // localStorage, which never finds out a project was deleted.
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveProjectIds(null);
      return;
    }
    getProjects()
      .then(res => {
        const list = res?.data || res || [];
        setActiveProjectIds(new Set(list.map(p => String(p.id))));
      })
      .catch(() => {});
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    const refresh = () => setHistory(loadMergedHistory());
    window.addEventListener(HISTORY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(HISTORY_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [profileMenuOpen]);

  const closeMobile = () => isMobile && setIsOpen(false);

  const handleClearConversations = () => {
    if (window.confirm('Clear saved conversation history on this device?')) {
      localStorage.removeItem('homeConversationHistory');
      localStorage.removeItem('generatorConversationHistory');
      setHistory([]);
      window.dispatchEvent(new Event(HISTORY_EVENT));
    }
  };

  const handleHistoryClick = (entry) => {
    const target = entry._source === 'generator' ? '/generator' : '/';
    navigate(target, { state: { scrollToId: entry.id } });
    closeMobile();
  };

  const handleNewChat = () => {
    navigate('/', { state: { newChat: true } });
    closeMobile();
  };

  const planName = user?.subscription?.plan_name || user?.subscription?.plan || 'Free';

  const profileMenuItems = [
    { icon: Folder, label: 'Projects', path: '/projects' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: CreditCard, label: 'Subscription', path: '/subscription' },
    { icon: Activity, label: 'Health', path: '/health' }
  ];

  const utilityItems = [
    { icon: Trash2, label: 'Clear all conversations', action: handleClearConversations },
    {
      icon: theme === 'dark' ? Sun : Moon,
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      action: toggleTheme
    },
    { icon: CreditCard, label: 'Upgrade to Pro', path: '/pricing' },
    { icon: FileText, label: 'Guide & FAQ', path: '/docs' }
  ];

  const ProfileCard = () => React.createElement(
    'div',
    { className: 'relative', ref: profileMenuRef },
    React.createElement(
      'button',
      {
        onClick: () => setProfileMenuOpen(prev => !prev),
        className: 'w-full flex items-center space-x-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-left'
      },
      React.createElement(
        'div',
        { className: 'w-9 h-9 shrink-0 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-hover)] rounded-full flex items-center justify-center text-white font-semibold shadow-sm' },
        user?.fullname?.charAt(0).toUpperCase() || 'U'
      ),
      React.createElement(
        'div',
        { className: 'flex-1 min-w-0' },
        React.createElement('div', { className: 'font-semibold text-gray-800 dark:text-gray-100 truncate text-sm' }, user?.fullname || 'Guest'),
        React.createElement('div', { className: 'text-xs text-gray-500 dark:text-gray-400 truncate' }, `${planName} account`)
      ),
      React.createElement(ChevronDown, {
        size: 14,
        className: `text-gray-400 dark:text-gray-500 shrink-0 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`
      })
    ),
    profileMenuOpen && React.createElement(
      'div',
      { className: 'absolute left-0 right-0 mt-1 bg-white dark:bg-[#1f2128] rounded-xl shadow-lg border border-gray-100 dark:border-white/10 py-1 z-20' },
      profileMenuItems.map(item => React.createElement(
        Link,
        {
          key: item.path,
          to: item.path,
          onClick: () => { setProfileMenuOpen(false); closeMobile(); },
          className: 'flex items-center space-x-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-[color:var(--accent)] transition-colors'
        },
        React.createElement(item.icon, { size: 15 }),
        React.createElement('span', null, item.label)
      ))
    )
  );

  const SidebarContent = () => React.createElement(
    'div',
    { className: 'h-full flex flex-col relative bg-white/60 dark:bg-[#161616] backdrop-blur-xl md:backdrop-blur-xl border-r border-black/5 dark:border-white/5' },

    isMobile && React.createElement(
      'button',
      {
        onClick: () => setIsOpen(false),
        className: 'absolute top-4 right-4 p-1 bg-gray-100 dark:bg-white/10 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors z-10',
        'aria-label': 'Close menu'
      },
      React.createElement(X, { size: 20, className: 'text-gray-600 dark:text-gray-300' })
    ),

    !isAuthenticated && React.createElement(
      'div',
      { className: 'p-4 flex items-center justify-between' },
      React.createElement(
        Link,
        { to: '/', className: 'text-lg font-bold text-[color:var(--accent)] tracking-tight', onClick: closeMobile },
        'MVC Accelerator'
      ),
      React.createElement(
        'button',
        {
          onClick: toggleTheme,
          className: 'p-2 rounded-lg text-gray-400 hover:text-[color:var(--accent)] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors',
          'aria-label': 'Toggle theme'
        },
        theme === 'dark' ? React.createElement(Sun, { size: 18 }) : React.createElement(Moon, { size: 18 })
      )
    ),

    isAuthenticated && React.createElement(
      'div',
      { className: 'p-3' },
      React.createElement(ProfileCard, null)
    ),

    isAuthenticated && React.createElement(
      'div',
      { className: 'flex-1 overflow-y-auto px-3 space-y-0.5 max-h-[45vh] md:max-h-none' },
      (() => {
        const visible = activeProjectIds
          ? history.filter(entry => !entry.projectId || activeProjectIds.has(String(entry.projectId)))
          : history;
        return visible.length === 0
          ? React.createElement('p', { className: 'text-xs text-gray-400 dark:text-gray-500 px-2 py-2' }, 'Your conversations will appear here.')
          : visible.map(entry => React.createElement(
            'button',
            {
              key: `${entry._source}-${entry.id}`,
              onClick: () => handleHistoryClick(entry),
              className: 'w-full flex items-center space-x-2 px-2 py-2 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors'
            },
            React.createElement(MessageSquare, { size: 14, className: 'text-gray-400 dark:text-gray-500 shrink-0' }),
            React.createElement('span', { className: 'text-sm truncate' }, entry.projectName || entry.prompt || 'Untitled')
          ));
      })()
    ),

    isAuthenticated && React.createElement(
      'div',
      { className: 'p-3' },
      React.createElement(
        'button',
        {
          onClick: handleNewChat,
          className: 'w-full flex items-center justify-center space-x-2 py-2.5 bg-[color:var(--accent)] text-white rounded-xl text-sm font-medium hover:bg-[color:var(--accent-hover)] transition-colors shadow-sm'
        },
        React.createElement(Plus, { size: 16 }),
        React.createElement('span', null, 'Start a new chat')
      )
    ),

    !isAuthenticated && React.createElement(
      'div',
      { className: 'flex-1 flex flex-col items-center justify-center px-6 text-center' },
      React.createElement('p', { className: 'text-sm text-gray-500 dark:text-gray-400 mb-4' }, 'Log in to start chatting and save your history.'),
      React.createElement(
        Link,
        {
          to: '/login',
          onClick: closeMobile,
          className: 'block w-full px-4 py-2.5 text-center text-sm font-medium border-2 border-[color:var(--accent)] text-[color:var(--accent)] rounded-xl hover:bg-[color:var(--accent)] hover:text-white transition-colors mb-2'
        },
        'Log in'
      ),
      React.createElement(
        Link,
        {
          to: '/register',
          onClick: closeMobile,
          className: 'block w-full px-4 py-2.5 text-center text-sm font-medium bg-[color:var(--accent)] text-white rounded-xl hover:bg-[color:var(--accent-hover)] transition-colors shadow-md'
        },
        'Sign up'
      )
    ),

    React.createElement('hr', { className: 'mx-3 border-black/5 dark:border-white/10' }),

    React.createElement(
      'div',
      { className: 'p-3 space-y-0.5' },
      utilityItems.map(item => {
        const row = (extraProps) => React.createElement(
          extraProps.to ? Link : 'button',
          {
            key: item.label,
            className: 'w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors',
            ...extraProps
          },
          React.createElement(item.icon, { size: 17 }),
          React.createElement('span', { className: 'text-sm font-medium' }, item.label)
        );

        return item.path
          ? row({ to: item.path, onClick: closeMobile })
          : row({ onClick: () => { item.action(); closeMobile(); } });
      }),
      isAuthenticated && React.createElement(
        'button',
        {
          onClick: () => { logout(); closeMobile(); navigate('/'); },
          className: 'w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors'
        },
        React.createElement(LogOut, { size: 17 }),
        React.createElement('span', { className: 'text-sm font-medium' }, 'Log out')
      )
    )
  );

  if (isMobile && !isOpen) {
    return React.createElement(
      'button',
      {
        onClick: () => setIsOpen(true),
        className: 'fixed top-4 left-4 z-50 p-3 bg-[color:var(--accent)] text-white rounded-xl shadow-lg hover:bg-[color:var(--accent-hover)] transition-all duration-300 transform hover:scale-105',
        'aria-label': 'Open menu'
      },
      React.createElement(Menu, { size: 24 })
    );
  }

  return React.createElement(
    React.Fragment,
    null,
    isMobile && isOpen && React.createElement(
      'div',
      {
        onClick: () => setIsOpen(false),
        className: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300',
        'aria-label': 'Close overlay'
      }
    ),

    React.createElement(
      'div',
      {
        className: `${isMobile
          ? `fixed left-0 top-0 h-full w-72 max-w-[85vw] z-50 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
          : 'w-72 shrink-0'
        }`
      },
      React.createElement(SidebarContent, null)
    )
  );
};

export default Sidebar;
