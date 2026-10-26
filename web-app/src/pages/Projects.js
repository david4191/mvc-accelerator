import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Folder, Code2, Clock, Plus, Loader2, ArrowRight, Trash2 } from 'lucide-react';
import { getProjects, deleteProject } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to view your projects');
      navigate('/login');
      return;
    }
    
    fetchProjects();
  }, [isAuthenticated, navigate]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await getProjects();
      
      if (response && response.data) {
        setProjects(response.data);
      } else if (Array.isArray(response)) {
        setProjects(response);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      
      if (error.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      } else {
        toast.error(error.message || 'Failed to load projects');
      }
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, project) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm(`Delete "${project.project_name}"? This can be undone by contacting support, but it will disappear from your project list.`)) {
      return;
    }

    setDeletingId(project.id);
    try {
      await deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success(`"${project.project_name}" deleted`);
    } catch (error) {
      toast.error(error.message || 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] flex items-center justify-center' },
      React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]' })
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] py-20 px-4' },
    React.createElement(
      'div',
      { className: 'container mx-auto max-w-6xl' },
      
      // Header
      React.createElement(
        'div',
        { className: 'text-center mb-8' },
        React.createElement(
          'div',
          { className: 'inline-flex items-center justify-center w-16 h-16 bg-[color:var(--accent)]/10 rounded-full mb-4' },
          React.createElement(Folder, { size: '1em', className: 'text-2xl text-[color:var(--accent)]' })
        ),
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2' },
          'My Projects'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-500 dark:text-[#9aa3af] text-sm' },
          `Welcome back, ${user?.fullname?.split(' ')[0] || user?.username || 'User'}! Here are your saved projects.`
        )
      ),

      // New Project Button
      React.createElement(
        'div',
        { className: 'mb-8 flex justify-center' },
        React.createElement(
          Link,
          {
            to: '/generator',
            state: { newProject: true },
            className: 'inline-flex items-center px-6 py-3 bg-[color:var(--accent)] text-white rounded-xl hover:bg-[color:var(--accent-hover)] transition-all duration-300 transform hover:scale-[1.02] shadow-sm'
          },
          React.createElement(Plus, { size: '1em', className: 'mr-2 text-sm' }),
          'Create New Project',
          React.createElement(ArrowRight, { size: '1em', className: 'ml-2 text-sm' })
        )
      ),

      // Projects Grid
      projects.length === 0
        ? React.createElement(
            'div',
            { className: 'text-center py-16 bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d]' },
            React.createElement(
              'div',
              { className: 'w-20 h-20 bg-gray-100 dark:bg-[#242933] rounded-full flex items-center justify-center mx-auto mb-4' },
              React.createElement(Folder, { size: '1em', className: 'text-3xl text-gray-400 dark:text-[#7b8494]' })
            ),
            React.createElement('h3', { className: 'text-xl font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'No projects yet'),
            React.createElement('p', { className: 'text-gray-500 dark:text-[#9aa3af] text-sm mb-6' }, 'Start by creating your first project'),
            React.createElement(
              Link,
              {
                to: '/generator',
                state: { newProject: true },
                className: 'inline-flex items-center px-6 py-3 bg-[color:var(--accent)] text-white rounded-xl hover:bg-[color:var(--accent-hover)] transition-all duration-300'
              },
              React.createElement(Code2, { size: '1em', className: 'mr-2 text-sm' }),
              'Create Your First Project'
            )
          )
        : React.createElement(
            'div',
            { className: 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' },
            projects.map((project) =>
              React.createElement(
                Link,
                {
                  key: project.id,
                  to: `/projects/${project.id}`,
                  className: 'bg-white dark:bg-[#1a1d23] rounded-xl border border-gray-200 dark:border-[#2d333d] shadow-sm hover:shadow-md transition-all duration-300 p-6 hover:border-[color:var(--accent)] group'
                },
                React.createElement(
                  'div',
                  { className: 'flex items-start justify-between mb-4' },
                  React.createElement(
                    'div',
                    { className: 'w-10 h-10 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center group-hover:bg-[color:var(--accent)]/20 transition-colors' },
                    React.createElement(Folder, { size: '1em', className: 'text-lg text-[color:var(--accent)]' })
                  ),
                  React.createElement(
                    'div',
                    { className: 'flex items-center space-x-2' },
                    React.createElement(
                      'span',
                      { className: 'text-xs px-2 py-1 bg-gray-100 dark:bg-[#242933] rounded-full text-gray-500 dark:text-[#9aa3af]' },
                      project.framework || 'MVC'
                    ),
                    React.createElement(
                      'button',
                      {
                        onClick: (e) => handleDelete(e, project),
                        disabled: deletingId === project.id,
                        title: 'Delete project',
                        className: 'p-1.5 text-gray-400 dark:text-[#7b8494] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50'
                      },
                      deletingId === project.id
                        ? React.createElement(Loader2, { className: 'animate-spin', size: 12 })
                        : React.createElement(Trash2, { size: 12 })
                    )
                  )
                ),
                React.createElement(
                  'h3',
                  { className: 'text-lg font-semibold text-gray-800 dark:text-[#f3f4f6] mb-2 truncate' },
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
                  { className: 'flex items-center justify-between text-xs text-gray-400 dark:text-[#7b8494]' },
                  React.createElement(
                    'span',
                    { className: 'flex items-center' },
                    React.createElement(Clock, { size: '1em', className: 'mr-1 text-xs' }),
                    new Date(project.created_at).toLocaleDateString()
                  ),
                  project.last_generated &&
                    React.createElement(
                      'span',
                      { className: 'flex items-center' },
                      React.createElement(Code2, { size: '1em', className: 'mr-1 text-xs' }),
                      'Generated'
                    )
                )
              )
            )
          )
    )
  );
};

export default Projects;