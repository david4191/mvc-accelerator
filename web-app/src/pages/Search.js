import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Loader2, Folder, Clock, ArrowRight, X } from 'lucide-react';
import { getProjects } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const Search = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    loadProjects();
  }, [isAuthenticated, navigate]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await getProjects();
      
      if (response && response.data) {
        setAllProjects(response.data);
      } else if (Array.isArray(response)) {
        setAllProjects(response);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    
    setTimeout(() => {
      const results = allProjects.filter(project => 
        project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.framework && project.framework.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (project.project_path && project.project_path.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      setSearchResults(results);
      setSearching(false);
    }, 300);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
  };

  if (loading) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] flex items-center justify-center' },
      React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]' })
    );
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] py-20 px-4' },
    React.createElement(
      'div',
      { className: 'container mx-auto max-w-4xl' },
      
      // Header
      React.createElement(
        'div',
        { className: 'text-center mb-8' },
        React.createElement(
          'div',
          { className: 'inline-flex items-center justify-center w-16 h-16 bg-[color:var(--accent)]/10 rounded-full mb-4' },
          React.createElement(SearchIcon, { size: '1em', className: 'text-2xl text-[color:var(--accent)]' })
        ),
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2' },
          'Search Projects'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-500 dark:text-[#9aa3af] text-sm' },
          'Search through your saved projects and generations'
        )
      ),

      // Search Form
      React.createElement(
        'form',
        { onSubmit: handleSearch, className: 'relative mb-8' },
        React.createElement('input', {
          type: 'text',
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
          placeholder: 'Search by project name, framework, or path...',
          className: 'w-full px-5 py-4 pr-32 border border-gray-200 dark:border-[#2d333d] rounded-xl bg-white dark:bg-[#1a1d23] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent text-gray-700 dark:text-[#d1d5db]'
        }),
        React.createElement(
          'div',
          { className: 'absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1' },
          searchTerm && React.createElement(
            'button',
            {
              type: 'button',
              onClick: clearSearch,
              className: 'p-2 text-gray-400 dark:text-[#7b8494] hover:text-gray-600 dark:text-[#b0b8c2] transition-colors'
            },
            React.createElement(X, { size: 14 })
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              disabled: searching,
              className: 'p-2 bg-[color:var(--accent)] text-white rounded-lg hover:bg-[color:var(--accent-hover)] transition-colors disabled:opacity-50'
            },
            searching ? React.createElement(Loader2, { className: 'animate-spin', size: 16 }) : React.createElement(ArrowRight, { size: 16 })
          )
        )
      ),

      // Results count
      searchTerm && React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement(
          'p',
          { className: 'text-gray-500 dark:text-[#9aa3af] text-sm' },
          `Found ${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchTerm}"`
        )
      ),

      // Results Grid
      searchResults.length > 0
        ? React.createElement(
            'div',
            { className: 'grid md:grid-cols-2 gap-6' },
            searchResults.map((project) =>
              React.createElement(
                Link,
                {
                  key: project.id,
                  to: `/projects/${project.id}`,
                  className: 'bg-white dark:bg-[#1a1d23] rounded-xl border border-gray-200 dark:border-[#2d333d] shadow-sm hover:shadow-md transition-all duration-300 p-6 hover:border-[color:var(--accent)]'
                },
                React.createElement(
                  'div',
                  { className: 'flex items-start justify-between mb-4' },
                  React.createElement(
                    'div',
                    { className: 'w-10 h-10 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center' },
                    React.createElement(Folder, { size: '1em', className: 'text-lg text-[color:var(--accent)]' })
                  ),
                  React.createElement(
                    'span',
                    { className: 'text-xs px-2 py-1 bg-gray-100 dark:bg-[#242933] rounded-full text-gray-500 dark:text-[#9aa3af]' },
                    project.framework || 'MVC'
                  )
                ),
                React.createElement(
                  'h3',
                  { className: 'text-lg font-semibold text-gray-800 dark:text-[#f3f4f6] mb-2' },
                  project.project_name
                ),
                project.project_path &&
                  React.createElement(
                    'p',
                    { className: 'text-sm text-gray-500 dark:text-[#9aa3af] mb-4 truncate' },
                    project.project_path
                  ),
                React.createElement(
                  'div',
                  { className: 'flex items-center text-xs text-gray-400 dark:text-[#7b8494]' },
                  React.createElement(Clock, { size: '1em', className: 'mr-1 text-xs' }),
                  'Created: ',
                  new Date(project.created_at).toLocaleDateString()
                )
              )
            )
          )
        : searchTerm && !searching && React.createElement(
            'div',
            { className: 'text-center py-16 bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d]' },
            React.createElement(
              'div',
              { className: 'w-20 h-20 bg-gray-100 dark:bg-[#242933] rounded-full flex items-center justify-center mx-auto mb-4' },
              React.createElement(SearchIcon, { size: '1em', className: 'text-3xl text-gray-400 dark:text-[#7b8494]' })
            ),
            React.createElement('h3', { className: 'text-xl font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'No results found'),
            React.createElement('p', { className: 'text-gray-500 dark:text-[#9aa3af] text-sm' }, 'Try a different search term')
          ),

      // Recent Projects
      !searchTerm && !searching && React.createElement(
        'div',
        { className: 'mt-8' },
        React.createElement(
          'h2',
          { className: 'text-xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-6 flex items-center' },
          React.createElement(Clock, { size: '1em', className: 'text-[color:var(--accent)] mr-2' }),
          'Recent Projects'
        ),
        React.createElement(
          'div',
          { className: 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' },
          allProjects.slice(0, 6).map((project) =>
            React.createElement(
              Link,
              {
                key: project.id,
                to: `/projects/${project.id}`,
                className: 'bg-white dark:bg-[#1a1d23] rounded-xl border border-gray-200 dark:border-[#2d333d] shadow-sm hover:shadow-md transition-all duration-300 p-6 hover:border-[color:var(--accent)]'
              },
              React.createElement(
                'div',
                { className: 'flex items-start justify-between mb-4' },
                React.createElement(
                  'div',
                  { className: 'w-10 h-10 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center' },
                  React.createElement(Folder, { size: '1em', className: 'text-lg text-[color:var(--accent)]' })
                ),
                React.createElement(
                  'span',
                  { className: 'text-xs px-2 py-1 bg-gray-100 dark:bg-[#242933] rounded-full text-gray-500 dark:text-[#9aa3af]' },
                  project.framework || 'MVC'
                )
              ),
              React.createElement(
                'h3',
                { className: 'text-lg font-semibold text-gray-800 dark:text-[#f3f4f6] mb-2 truncate' },
                project.project_name
              ),
              React.createElement(
                'div',
                { className: 'flex items-center text-xs text-gray-400 dark:text-[#7b8494]' },
                React.createElement(Clock, { size: '1em', className: 'mr-1 text-xs' }),
                'Created: ',
                new Date(project.created_at).toLocaleDateString()
              )
            )
          )
        )
      )
    )
  );
};

export default Search;