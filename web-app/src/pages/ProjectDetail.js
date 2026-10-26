import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getProject, getGenerations, getProjectFiles } from '../services/api';
import { Folder, Code2, Clock, ArrowLeft, Copy, Check, File, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [project, setProject] = useState(null);
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGeneration, setExpandedGeneration] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [error, setError] = useState(null);
  const [projectFiles, setProjectFiles] = useState({});
  const [expandedFile, setExpandedFile] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to view project details');
      navigate('/login');
      return;
    }
    
    fetchProjectDetails();
  }, [id, isAuthenticated, navigate]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const projectResponse = await getProject(id);
      
      if (projectResponse && projectResponse.data) {
        setProject(projectResponse.data.project || projectResponse.data);
        
        if (projectResponse.data.generations && projectResponse.data.generations.length > 0) {
          setGenerations(projectResponse.data.generations);
        }
      } else if (projectResponse && projectResponse.project) {
        setProject(projectResponse.project);
        if (projectResponse.generations) {
          setGenerations(projectResponse.generations);
        }
      } else {
        setProject(projectResponse);
      }
      
      try {
        const gensResponse = await getGenerations();
        
        if (gensResponse && gensResponse.data) {
          const projectGens = gensResponse.data.filter(gen => gen.project_id == id);
          if (projectGens.length > 0) {
            setGenerations(projectGens);
          }
        } else if (Array.isArray(gensResponse)) {
          const projectGens = gensResponse.filter(gen => gen.project_id == id);
          if (projectGens.length > 0) {
            setGenerations(projectGens);
          }
        }
      } catch (genError) {
        console.error('Error fetching generations:', genError);
      }

      try {
        const filesResponse = await getProjectFiles(id);
        setProjectFiles(filesResponse?.data?.files || {});
      } catch (filesError) {
        console.error('Error fetching project files:', filesError);
      }

    } catch (error) {
      console.error('Failed to fetch project details:', error);
      setError(error.message || 'Failed to load project details');
      toast.error(error.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code.substring(0, 50));
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  const parseJsonField = (field) => {
    if (!field) return null;
    try {
      return typeof field === 'string' ? JSON.parse(field) : field;
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return null;
    }
  };

  if (loading) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] flex items-center justify-center' },
      React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]' })
    );
  }

  if (error) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] flex items-center justify-center' },
      React.createElement(
        'div',
        { className: 'text-center' },
        React.createElement(
          'div',
          { className: 'w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4' },
          React.createElement(AlertTriangle, { size: '1em', className: 'text-3xl text-red-500' })
        ),
        React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2' }, 'Error Loading Project'),
        React.createElement('p', { className: 'text-gray-500 dark:text-[#9aa3af] text-sm mb-6' }, error),
        React.createElement(
          'button',
          {
            onClick: () => navigate('/projects'),
            className: 'px-6 py-3 bg-[color:var(--accent)] text-white rounded-xl hover:bg-[color:var(--accent-hover)] transition-colors'
          },
          'Back to Projects'
        )
      )
    );
  }

  if (!project) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] flex items-center justify-center' },
      React.createElement(
        'div',
        { className: 'text-center' },
        React.createElement(
          'div',
          { className: 'w-20 h-20 bg-gray-100 dark:bg-[#242933] rounded-full flex items-center justify-center mx-auto mb-4' },
          React.createElement(Folder, { size: '1em', className: 'text-3xl text-gray-400 dark:text-[#7b8494]' })
        ),
        React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2' }, 'Project Not Found'),
        React.createElement('p', { className: 'text-gray-500 dark:text-[#9aa3af] text-sm mb-6' }, 'The project you\'re looking for doesn\'t exist or has been deleted.'),
        React.createElement(
          'button',
          {
            onClick: () => navigate('/projects'),
            className: 'px-6 py-3 bg-[color:var(--accent)] text-white rounded-xl hover:bg-[color:var(--accent-hover)] transition-colors'
          },
          'Back to Projects'
        )
      )
    );
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] py-20 px-4' },
    React.createElement(
      'div',
      { className: 'container mx-auto max-w-5xl' },
      
      // Back button
      React.createElement(
        'button',
        {
          onClick: () => navigate('/projects'),
          className: 'flex items-center text-gray-500 dark:text-[#9aa3af] hover:text-[color:var(--accent)] mb-6 transition-colors text-sm'
        },
        React.createElement(ArrowLeft, { size: '1em', className: 'mr-2 text-xs' }),
        'Back to Projects'
      ),

      // Project Header
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] shadow-sm p-8 mb-8 hover:shadow-md transition-shadow' },
        React.createElement(
          'div',
          { className: 'flex flex-col md:flex-row md:items-start justify-between' },
          React.createElement(
            'div',
            { className: 'flex items-center space-x-4 mb-4 md:mb-0' },
            React.createElement(
              'div',
              { className: 'w-14 h-14 bg-[color:var(--accent)]/10 rounded-xl flex items-center justify-center' },
              React.createElement(Folder, { size: '1em', className: 'text-2xl text-[color:var(--accent)]' })
            ),
            React.createElement(
              'div',
              null,
              React.createElement(
                'h1',
                { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2' },
                project.project_name || 'Untitled Project'
              ),
              React.createElement(
                'div',
                { className: 'flex flex-wrap gap-4 text-sm text-gray-500 dark:text-[#9aa3af]' },
                React.createElement(
                  'span',
                  { className: 'flex items-center' },
                  React.createElement(Code2, { size: '1em', className: 'mr-1 text-xs' }),
                  project.framework || 'MVC'
                ),
                React.createElement(
                  'span',
                  { className: 'flex items-center' },
                  React.createElement(Clock, { size: '1em', className: 'mr-1 text-xs' }),
                  'Created: ',
                  formatDate(project.created_at)
                )
              )
            )
          ),
          React.createElement(
            Link,
            {
              to: '/generator',
              state: { continueProjectId: project.id, continueProjectName: project.project_name },
              className: 'inline-flex items-center px-4 py-2 bg-[color:var(--accent)] text-white rounded-lg hover:bg-[color:var(--accent-hover)] transition-colors text-sm shrink-0'
            },
            React.createElement(Code2, { size: '1em', className: 'mr-2 text-xs' }),
            'Continue Building'
          )
        ),
        
        // Project Path if available
        project.project_path && React.createElement(
          'div',
          { className: 'mt-4 p-3 bg-gray-50 dark:bg-[#0f1115] rounded-lg border border-gray-200 dark:border-[#2d333d]' },
          React.createElement(
            'p',
            { className: 'text-sm text-gray-500 dark:text-[#9aa3af]' },
            React.createElement('span', { className: 'font-medium text-gray-600 dark:text-[#b0b8c2]' }, 'Path: '),
            project.project_path
          )
        )
      ),

      // Current Project Files Section - the merged tree accumulated across
      // every generation made into this project, not just the latest one.
      Object.keys(projectFiles).length > 0 && React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] shadow-sm p-8 mb-8 hover:shadow-md transition-shadow' },
        React.createElement(
          'h2',
          { className: 'text-xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-6 flex items-center' },
          React.createElement(File, { size: '1em', className: 'text-[color:var(--accent)] mr-2' }),
          `Current Project Files (${Object.keys(projectFiles).length})`
        ),
        React.createElement(
          'div',
          { className: 'space-y-2' },
          Object.entries(projectFiles).map(([filename, code]) => {
            const isExpanded = expandedFile === filename;
            return React.createElement(
              'div',
              { key: filename, className: 'border border-gray-200 dark:border-[#2d333d] rounded-lg overflow-hidden' },
              React.createElement(
                'div',
                {
                  onClick: () => setExpandedFile(isExpanded ? null : filename),
                  className: 'flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0f1115] transition-colors'
                },
                React.createElement('span', { className: 'font-mono text-sm text-[color:var(--accent)]' }, filename),
                React.createElement(
                  'div',
                  { className: 'flex items-center space-x-2' },
                  React.createElement(
                    'button',
                    {
                      onClick: (e) => { e.stopPropagation(); handleCopyCode(code); },
                      className: 'p-1 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)] transition-colors'
                    },
                    copiedCode === (typeof code === 'string' ? code.substring(0, 50) : '')
                      ? React.createElement(Check, { size: 12, className: 'text-green-600' })
                      : React.createElement(Copy, { size: 12 })
                  ),
                  isExpanded ? React.createElement(ChevronDown, { size: 12, className: 'text-gray-400' }) : React.createElement(ChevronRight, { size: 12, className: 'text-gray-400' })
                )
              ),
              isExpanded && React.createElement(
                SyntaxHighlighter,
                {
                  language: filename.endsWith('.php') ? 'php' :
                    filename.endsWith('.js') ? 'javascript' :
                    filename.endsWith('.css') ? 'css' :
                    filename.endsWith('.sql') ? 'sql' :
                    filename.endsWith('.html') ? 'html' : 'bash',
                  style: oneLight,
                  className: '!mt-0 text-sm'
                },
                typeof code === 'string' ? code : JSON.stringify(code, null, 2)
              )
            );
          })
        )
      ),

      // Generations Section
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] shadow-sm p-8 hover:shadow-md transition-shadow' },
        React.createElement(
          'h2',
          { className: 'text-xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-6 flex items-center' },
          React.createElement(Code2, { size: '1em', className: 'text-[color:var(--accent)] mr-2' }),
          'Generated Code History'
        ),

        generations.length === 0
          ? React.createElement(
              'div',
              { className: 'text-center py-12' },
              React.createElement(
                'div',
                { className: 'w-20 h-20 bg-gray-100 dark:bg-[#242933] rounded-full flex items-center justify-center mx-auto mb-4' },
                React.createElement(Code2, { size: '1em', className: 'text-3xl text-gray-400 dark:text-[#7b8494]' })
              ),
              React.createElement('p', { className: 'text-gray-500 dark:text-[#9aa3af] mb-2' }, 'No generations found for this project'),
              React.createElement('p', { className: 'text-sm text-gray-400 dark:text-[#7b8494] mb-6' }, 'Generate code to see it appear here'),
              React.createElement(
                Link,
                {
                  to: '/generator',
                  state: { continueProjectId: project.id, continueProjectName: project.project_name },
                  className: 'inline-block px-6 py-3 bg-[color:var(--accent)] text-white rounded-xl hover:bg-[color:var(--accent-hover)] transition-colors text-sm'
                },
                'Generate New Code'
              )
            )
          : React.createElement(
              'div',
              { className: 'space-y-4' },
              generations.map((gen) => {
                const files = parseJsonField(gen.generated_files);
                const structure = parseJsonField(gen.generated_structure);
                const isExpanded = expandedGeneration === gen.id;
                
                return React.createElement(
                  'div',
                  {
                    key: gen.id,
                    className: 'border border-gray-200 dark:border-[#2d333d] rounded-xl overflow-hidden bg-white dark:bg-[#1a1d23]'
                  },
                  React.createElement(
                    'div',
                    {
                      onClick: () => setExpandedGeneration(isExpanded ? null : gen.id),
                      className: 'flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0f1115] transition-colors'
                    },
                    React.createElement(
                      'div',
                      { className: 'flex items-center space-x-3 flex-1' },
                      React.createElement(
                        'div',
                        { className: 'w-8 h-8 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center' },
                        React.createElement(Code2, { size: '1em', className: 'text-sm text-[color:var(--accent)]' })
                      ),
                      React.createElement(
                        'div',
                        { className: 'flex-1' },
                        React.createElement(
                          'p',
                          { className: 'font-medium text-gray-800 dark:text-[#f3f4f6] text-sm' },
                          gen.prompt_text ? gen.prompt_text.substring(0, 80) + (gen.prompt_text.length > 80 ? '...' : '') : 'Generation ' + gen.id
                        ),
                        React.createElement(
                          'div',
                          { className: 'flex items-center space-x-3 mt-1' },
                          React.createElement('span', { className: 'text-xs text-gray-400 dark:text-[#7b8494]' }, formatDate(gen.created_at)),
                          gen.file_count && React.createElement('span', { className: 'text-xs text-gray-400 dark:text-[#7b8494]' }, `${gen.file_count} files`)
                        )
                      )
                    ),
                    React.createElement(
                      'div',
                      { className: 'text-gray-400 dark:text-[#7b8494]' },
                      isExpanded ? React.createElement(ChevronDown, { size: 14 }) : React.createElement(ChevronRight, { size: 14 })
                    )
                  ),
                  isExpanded && React.createElement(
                    'div',
                    { className: 'border-t border-gray-200 dark:border-[#2d333d] p-5 bg-gray-50 dark:bg-[#0f1115]' },
                    
                    // Full Prompt
                    React.createElement(
                      'div',
                      { className: 'mb-6' },
                      React.createElement(
                        'h4',
                        { className: 'font-semibold text-gray-700 dark:text-[#d1d5db] mb-2 text-sm' },
                        'Prompt'
                      ),
                      React.createElement(
                        'div',
                        { className: 'bg-white dark:bg-[#1a1d23] p-4 rounded-lg border border-gray-200 dark:border-[#2d333d] text-gray-600 dark:text-[#b0b8c2] text-sm' },
                        gen.prompt_text
                      )
                    ),
                    
                    // Files
                    files && Object.keys(files).length > 0 && React.createElement(
                      'div',
                      { className: 'mb-4' },
                      React.createElement(
                        'h4',
                        { className: 'font-semibold text-gray-700 dark:text-[#d1d5db] mb-3 flex items-center text-sm' },
                        React.createElement(File, { size: '1em', className: 'mr-2 text-[color:var(--accent)] text-xs' }),
                        'Generated Files'
                      ),
                      Object.entries(files).map(([filename, code]) =>
                        React.createElement(
                          'div',
                          { key: filename, className: 'mb-4 last:mb-0' },
                          React.createElement(
                            'div',
                            { className: 'flex justify-between items-center mb-2' },
                            React.createElement(
                              'h5',
                              { className: 'font-mono text-sm font-semibold text-[color:var(--accent)]' },
                              filename
                            ),
                            React.createElement(
                              'button',
                              {
                                onClick: () => handleCopyCode(code),
                                className: 'p-1.5 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)] transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-[#242933]'
                              },
                              copiedCode === (typeof code === 'string' ? code.substring(0, 50) : '')
                                ? React.createElement(Check, { size: 12, className: 'text-green-600' })
                                : React.createElement(Copy, { size: 12 })
                            )
                          ),
                          React.createElement(
                            SyntaxHighlighter,
                            {
                              language: filename.endsWith('.php') ? 'php' : 
                                       filename.endsWith('.js') ? 'javascript' :
                                       filename.endsWith('.html') ? 'html' : 'bash',
                              style: oneLight,
                              className: 'rounded-lg border border-gray-200 dark:border-[#2d333d] text-sm'
                            },
                            typeof code === 'string' ? code : JSON.stringify(code, null, 2)
                          )
                        )
                      )
                    ),
                    
                    // Structure fallback
                    !files && structure && React.createElement(
                      'div',
                      { className: 'mb-4' },
                      React.createElement(
                        'h4',
                        { className: 'font-semibold text-gray-700 dark:text-[#d1d5db] mb-2 text-sm' },
                        'Generated Structure'
                      ),
                      React.createElement(
                        'pre',
                        { className: 'bg-white dark:bg-[#1a1d23] p-4 rounded-lg border border-gray-200 dark:border-[#2d333d] overflow-x-auto text-sm text-gray-600 dark:text-[#b0b8c2]' },
                        JSON.stringify(structure, null, 2)
                      )
                    ),
                    
                    // Raw response fallback
                    !files && !structure && gen.generated_files && React.createElement(
                      'div',
                      { className: 'mb-4' },
                      React.createElement(
                        'h4',
                        { className: 'font-semibold text-gray-700 dark:text-[#d1d5db] mb-2 text-sm' },
                        'Raw Response'
                      ),
                      React.createElement(
                        'pre',
                        { className: 'bg-white dark:bg-[#1a1d23] p-4 rounded-lg border border-gray-200 dark:border-[#2d333d] overflow-x-auto text-sm text-gray-600 dark:text-[#b0b8c2] whitespace-pre-wrap' },
                        gen.generated_files
                      )
                    )
                  )
                );
              })
            )
      )
    )
  );
};

export default ProjectDetail;