import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { generateCode, createProject, planProject, getProjectFiles } from '../services/api';
import {
  Code2, Settings2, Loader2,
  Copy, Check, File, Folder, ArrowUp,
  Mic, ArrowRight, X, Clock,
  Database, ShieldCheck,
  FolderOpen, Trash2, RotateCw,
  Pencil, Bot, Save,
  MoreVertical, Palette, FileCode,
  AlertTriangle, ListChecks, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { memo } from 'react';
import useStagedReveal from '../hooks/useStagedReveal';

// ==================== MEMOIZED COMPONENTS ====================

// Memoized Directory Structure component
const DirectoryStructure = memo(({ content }) => {
  const isDirectoryStructure = (text) => {
    return /[├└│]/.test(text) || text.includes('─') || /^\s*[a-zA-Z0-9_\-.]+\/$/.test(text);
  };

  if (!content || typeof content !== 'string') return null;

  const lines = content.split('\n').filter(line => line.trim());

  return React.createElement(
    'div',
    { className: 'bg-white dark:bg-[#1a1d23] rounded-lg p-3 font-mono text-xs border border-gray-200 dark:border-[#2d333d] overflow-x-auto' },
    lines.map((line, index) => {
      const isDirectory = line.trim().endsWith('/') || line.includes('├') || line.includes('└');
      
      return React.createElement(
        'div',
        { 
          key: index,
          className: `whitespace-pre ${isDirectory ? 'text-[color:var(--accent)] font-medium' : 'text-gray-600 dark:text-[#b0b8c2]'}`
        },
        line
      );
    })
  );
});

// Memoized Code Block component with minimal copy button
const CodeBlock = memo(({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  }, [code]);
  
  return React.createElement(
    'div',
    { className: 'relative group my-3' },
    React.createElement(
      'button',
      {
        onClick: handleCopy,
        className: 'absolute top-2 right-2 p-1.5 bg-white dark:bg-[#1a1d23] text-gray-500 dark:text-[#9aa3af] rounded hover:bg-gray-100 dark:hover:bg-[#242933] transition-all duration-200 opacity-0 group-hover:opacity-100 z-10 border border-gray-200 dark:border-[#2d333d] shadow-sm'
      },
      copied 
        ? React.createElement(Check, { size: 11, className: 'text-green-600' })
        : React.createElement(Copy, { size: 11 })
    ),
    React.createElement(
      SyntaxHighlighter,
      {
        style: theme === 'dark' ? oneDark : oneLight,
        language: language,
        PreTag: 'div',
        className: 'rounded-lg !mt-0 !mb-0 border border-gray-200 dark:border-[#2d333d] bg-white dark:bg-[#1a1d23] text-sm'
      },
      code
    )
  );
});

const FILE_ICONS = {
  php: { icon: Code2, color: '#777BB4' },
  javascript: { icon: Code2, color: '#F0DB4F' },
  html: { icon: Code2, color: '#E34C26' },
  css: { icon: Palette, color: '#2965F1' },
  sql: { icon: Database, color: '#00758F' },
  markdown: { icon: FileCode, color: '#6b7280' },
  bash: { icon: File, color: '#4A5C3A' }
};

// Memoized File Item component
const FileItem = memo(({ filename, code, isExpanded, onToggle, onCopy }) => {
  const language = useMemo(() => {
    if (filename.endsWith('.php')) return 'php';
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.html')) return 'html';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.sql')) return 'sql';
    if (filename.endsWith('.md')) return 'markdown';
    return 'bash';
  }, [filename]);

  const { icon: FileIcon, color: fileIconColor } = FILE_ICONS[language] || FILE_ICONS.bash;

  return React.createElement(
    'div',
    { className: 'bg-white dark:bg-[#1a1d23] rounded-lg overflow-hidden border border-gray-200 dark:border-[#2d333d] shadow-sm mb-2' },
    React.createElement(
      'div',
      {
        onClick: onToggle,
        className: 'flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0f1115] transition-colors bg-white dark:bg-[#1a1d23]'
      },
      React.createElement(
        'div',
        { className: 'flex items-center space-x-2' },
        React.createElement(FileIcon, { size: '1em', className: 'text-xs', style: { color: fileIconColor } }),
        React.createElement('span', { className: 'font-mono text-xs font-medium text-gray-700 dark:text-[#d1d5db]' }, filename)
      ),
      React.createElement(
        'div',
        { className: 'flex items-center space-x-2' },
        React.createElement(
          'button',
          {
            onClick: (e) => {
              e.stopPropagation();
              onCopy();
            },
            className: 'p-1 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)] transition-colors'
          },
          React.createElement(Copy, { size: 11 })
        ),
        React.createElement('span', { className: 'text-gray-400 dark:text-[#7b8494] text-xs' }, isExpanded ? '−' : '+')
      )
    ),
    isExpanded && React.createElement(
      'div',
      { className: 'border-t border-gray-200 dark:border-[#2d333d]' },
      React.createElement(CodeBlock, { language: language, code: code })
    )
  );
});

// Memoized Files Section
const FilesSection = memo(({ files }) => {
  const [localExpanded, setLocalExpanded] = useState({});

  const toggleLocalFile = useCallback((filename) => {
    setLocalExpanded(prev => ({
      ...prev,
      [filename]: !prev[filename]
    }));
  }, []);

  const handleCopyFile = useCallback((filename, code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${filename}`);
  }, []);

  return React.createElement(
    'div',
    { className: 'space-y-3' },
    React.createElement(
      'h3',
      { className: 'text-base font-semibold text-[color:var(--accent)] mb-3 flex items-center' },
      React.createElement(File, { size: '1em', className: 'mr-2 text-sm' }),
      'Generated Files'
    ),
    Object.entries(files).map(([filename, code]) =>
      React.createElement(
        'div',
        { key: filename, className: 'animate-revealIn' },
        React.createElement(FileItem, {
          filename: filename,
          code: code,
          isExpanded: localExpanded[filename],
          onToggle: () => toggleLocalFile(filename),
          onCopy: () => handleCopyFile(filename, code)
        })
      )
    )
  );
});

// Memoized Action Bar - Minimal design
const ActionBar = memo(({ onRegenerate, onCopy, isRetrying, copied }) => {
  const [showActions, setShowActions] = useState(false);
  
  return React.createElement(
    'div',
    { className: 'absolute top-3 right-3 flex items-center space-x-1 z-10' },
    
    // Copy button - always visible, minimal
    React.createElement(
      'button',
      {
        onClick: onCopy,
        className: 'p-1.5 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)] rounded hover:bg-gray-100 dark:hover:bg-[#242933] transition-all duration-200',
        title: 'Copy response'
      },
      copied
        ? React.createElement(Check, { size: 12, className: 'text-green-600' })
        : React.createElement(Copy, { size: 12 })
    ),
    
    // Three dots menu for more actions
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement(
        'button',
        {
          onClick: () => setShowActions(!showActions),
          className: 'p-1.5 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)] rounded hover:bg-gray-100 dark:hover:bg-[#242933] transition-all duration-200',
          title: 'More actions'
        },
        React.createElement(MoreVertical, { size: 12 })
      ),
      
      // Dropdown menu
      showActions && React.createElement(
        'div',
        { className: 'absolute right-0 mt-1 w-32 bg-white dark:bg-[#1a1d23] rounded-md shadow-lg border border-gray-200 dark:border-[#2d333d] py-1 z-20' },
        React.createElement(
          'button',
          {
            onClick: () => {
              onRegenerate();
              setShowActions(false);
            },
            disabled: isRetrying,
            className: 'w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-[#d1d5db] hover:bg-gray-50 dark:hover:bg-[#0f1115] flex items-center space-x-2 disabled:opacity-50'
          },
          isRetrying 
            ? React.createElement(Loader2, { size: 10, className: 'animate-spin' })
            : React.createElement(RotateCw, { size: 10 }),
          React.createElement('span', null, 'Regenerate')
        )
      )
    )
  );
});

// Memoized AI Response component with redesigned actions
const AIResponse = memo(({
  entry,
  onRegenerate,
  onCopy,
  isRetrying,
  copiedId,
  onCopyEntry,
  onCopyCode,
  copiedCode,
  animate,
  onRevealDone
}) => {
  const [expandedFiles, setExpandedFiles] = useState({});
  const { theme } = useTheme();

  // Split the full response (narrative + inline code blocks, for both plain
  // answers and build/code responses) into segments so it can be revealed
  // piece by piece instead of dumped on screen all at once. The raw response
  // already contains everything - framing, schema, breakdown, code - so it's
  // the source of truth, not just a fallback for when file extraction fails.
  const answerChunks = useMemo(() => {
    if (typeof entry.response !== 'string') return [];
    return entry.response
      .split(/(```[\s\S]*?```)/g)
      .filter(chunk => chunk && chunk.trim().length > 0);
  }, [entry.response]);

  const fileEntries = useMemo(
    () => (entry.files ? Object.entries(entry.files) : []),
    [entry.files]
  );

  const totalStages = Math.max(answerChunks.length, 1) + (fileEntries.length > 0 ? 1 : 0);

  const visibleCount = useStagedReveal(totalStages, !!animate, onRevealDone);

  const toggleFile = useCallback((filename) => {
    setExpandedFiles(prev => ({
      ...prev,
      [filename]: !prev[filename]
    }));
  }, []);

  // Memoized markdown components
  const markdownComponents = useMemo(() => ({
    code: function CodeComponent({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');
      
      if (!inline && match) {
        return React.createElement(
          'div',
          { className: 'relative group my-3' },
          React.createElement(
            'button',
            {
              onClick: () => onCopyCode(code),
              className: 'absolute top-2 right-2 p-1.5 bg-white dark:bg-[#1a1d23] text-gray-500 dark:text-[#9aa3af] rounded hover:bg-gray-100 dark:hover:bg-[#242933] transition-all duration-200 opacity-0 group-hover:opacity-100 z-10 border border-gray-200 dark:border-[#2d333d] shadow-sm'
            },
            copiedCode === code.substring(0, 50)
              ? React.createElement(Check, { size: 11, className: 'text-green-600' })
              : React.createElement(Copy, { size: 11 })
          ),
          React.createElement(
            SyntaxHighlighter,
            Object.assign({
              style: theme === 'dark' ? oneDark : oneLight,
              language: match[1],
              PreTag: 'div',
              className: 'rounded-lg !mt-0 !mb-0 border border-gray-200 dark:border-[#2d333d] bg-white dark:bg-[#1a1d23] text-sm'
            }, props),
            code
          )
        );
      }

      const isDirectoryStructure = (text) => {
        return /[├└│]/.test(text) || text.includes('─') || /^\s*[a-zA-Z0-9_\-.]+\/$/.test(text);
      };

      if (!inline && typeof children === 'string' && isDirectoryStructure(children)) {
        return React.createElement(DirectoryStructure, { content: children });
      }
      
      return React.createElement(
        'code',
        Object.assign({
          className: 'bg-gray-100 dark:bg-[#242933] text-gray-800 dark:text-[#f3f4f6] px-1 py-0.5 rounded text-xs'
        }, props),
        children
      );
    },
    
    pre: ({ children }) => {
      const content = children?.props?.children;
      if (typeof content === 'string' && /[├└│]/.test(content)) {
        return React.createElement(DirectoryStructure, { content });
      }
      return React.createElement('pre', { className: 'bg-white dark:bg-[#1a1d23] p-3 rounded-lg overflow-x-auto border border-gray-200 dark:border-[#2d333d] text-sm text-gray-800 dark:text-[#f3f4f6]' }, children);
    },
    
    p: ({ children }) => React.createElement('p', { className: 'text-gray-700 dark:text-[#d1d5db] leading-relaxed mb-3 text-sm' }, children),
    h1: ({ children }) => React.createElement('h1', { className: 'text-xl font-bold text-[color:var(--accent)] mt-5 mb-3' }, children),
    h2: ({ children }) => React.createElement('h2', { className: 'text-lg font-bold text-[color:var(--accent)] mt-4 mb-2' }, children),
    h3: ({ children }) => React.createElement('h3', { className: 'text-base font-semibold text-gray-800 dark:text-[#f3f4f6] mt-3 mb-2' }, children),
    ul: ({ children }) => React.createElement('ul', { className: 'list-disc pl-5 mb-3 space-y-1 text-sm' }, children),
    ol: ({ children }) => React.createElement('ol', { className: 'list-decimal pl-5 mb-3 space-y-1 text-sm' }, children),
    li: ({ children }) => React.createElement('li', { className: 'text-gray-700 dark:text-[#d1d5db] text-sm' }, children),
    blockquote: ({ children }) => React.createElement('blockquote', { className: 'border-l-3 border-[color:var(--accent)] pl-3 italic text-gray-600 dark:text-[#b0b8c2] my-3 text-sm' }, children),
    table: ({ children }) => React.createElement(
      'div',
      { className: 'overflow-x-auto my-3 bg-white dark:bg-[#1a1d23] rounded-lg border border-gray-200 dark:border-[#2d333d]' },
      React.createElement('table', { className: 'min-w-full text-sm' }, children)
    ),
    th: ({ children }) => React.createElement('th', { className: 'px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-[#d1d5db] bg-gray-50 dark:bg-[#0f1115]' }, children),
    td: ({ children }) => React.createElement('td', { className: 'px-3 py-2 text-sm text-gray-600 dark:text-[#b0b8c2] border-t border-gray-200 dark:border-[#2d333d]' }, children)
  }), [copiedCode, onCopyCode, theme]);

  return React.createElement(
    'div',
    { className: `bg-white dark:bg-[#1a1d23] rounded-lg shadow-md p-5 border ${entry.isError ? 'border-red-200' : 'border-gray-200 dark:border-[#2d333d]'} relative hover:shadow-lg transition-shadow` },
    
    // Minimal Action Bar
    React.createElement(ActionBar, {
      onRegenerate: () => onRegenerate(entry),
      onCopy: () => onCopyEntry(entry),
      isRetrying: isRetrying,
      copied: copiedId === entry.id
    }),

    // A cartoon mascot "speaking" the explanation, not just a wall of text
    React.createElement(
      'div',
      { className: 'flex items-center space-x-2 mb-2' },
      React.createElement(
        'div',
        { className: 'w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-hover)] flex items-center justify-center shadow-sm text-white' },
        React.createElement(Bot, { size: 18 })
      ),
      React.createElement('span', { className: 'text-xs font-semibold text-gray-500 dark:text-gray-400' }, 'Codey the PHP Wizard')
    ),

    // Response Content
    React.createElement(
      'div',
      { className: 'mt-1' },
      // Always show the full narrative (framing, structure breakdown, schema,
      // code, setup) - it's the source of truth regardless of whether file
      // extraction below also found individually-named files.
      React.createElement(
        'div',
        { className: `prose prose-sm max-w-none chat-bubble-tail ${entry.isError ? 'text-red-600' : ''}` },
        answerChunks.slice(0, Math.min(visibleCount, answerChunks.length)).map((chunk, idx) =>
          React.createElement(
            'div',
            { key: idx, className: 'animate-revealIn' },
            React.createElement(ReactMarkdown, {
              remarkPlugins: [[remarkGfm, { singleTilde: false }]],
              components: markdownComponents,
              children: chunk
            })
          )
        )
      ),

      // Quick file browser - a convenience re-listing of the same code already
      // shown above, with per-file copy buttons. Appears once the narrative
      // has fully revealed.
      entry.type === 'code' && fileEntries.length > 0 && visibleCount > answerChunks.length && React.createElement(
        'div',
        { className: 'mt-6 animate-revealIn' },
        React.createElement(FilesSection, { files: entry.files })
      )
    )
  );
});

// ==================== HELPER FUNCTION ====================

const extractFilesFromMarkdown = (markdownText) => {
  const files = {};
  
  if (!markdownText || typeof markdownText !== 'string') return files;
  
  // Pattern 1: Code blocks with filename comments: ```language\n// path/to/file.php\ncode```
  const pattern1 = /```(?:\w+)\n\/\/\s*([^\n]+\.(?:php|html|js|css|sql|json|xml|txt|md|htaccess|env|sh))\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern1.exec(markdownText)) !== null) {
    const filename = match[1].trim();
    const code = match[2].trim();
    if (filename && code && !files[filename]) {
      files[filename] = code;
    }
  }
  
  // Pattern 2: ### filename.php format
  const pattern2 = /###\s+([^\n]+\.(?:php|html|js|css|sql|json|xml|txt|md|htaccess|env|sh))\s*\n```(?:\w+)?\n([\s\S]*?)```/g;
  while ((match = pattern2.exec(markdownText)) !== null) {
    const filename = match[1].trim();
    const code = match[2].trim();
    if (filename && code && !files[filename]) {
      files[filename] = code;
    }
  }
  
  // Pattern 3: **filename.php** format
  const pattern3 = /\*\*([^\*]+\.(?:php|html|js|css|sql|json|xml|txt|md|htaccess|env|sh))\*\*\s*\n```(?:\w+)?\n([\s\S]*?)```/g;
  while ((match = pattern3.exec(markdownText)) !== null) {
    const filename = match[1].trim();
    const code = match[2].trim();
    if (filename && code && !files[filename]) {
      files[filename] = code;
    }
  }
  
  // Pattern 4: Code blocks with language and inline filename
  const pattern4 = /```(?:php|html|js|css|sql|xml)\n(?:.*?\/\/\s*([^\n]+\.(?:php|html|js|css|sql|json|xml|txt|md)))\s*\n([\s\S]*?)```/g;
  while ((match = pattern4.exec(markdownText)) !== null) {
    const filename = match[1].trim();
    const code = match[2].trim();
    if (filename && code && !files[filename]) {
      files[filename] = code;
    }
  }
  
  // Pattern 5: Any PHP code block with class name extraction
  if (Object.keys(files).length === 0) {
    const phpPattern = /```php\n([\s\S]*?)```/g;
    let counter = 1;
    while ((match = phpPattern.exec(markdownText)) !== null) {
      const code = match[1].trim();
      if (code && code.includes('<?php')) {
        // Try to extract class name
        const classMatch = code.match(/class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          let filename = '';
          if (className.endsWith('Controller')) {
            filename = `controllers/${className}.php`;
          } else if (className.endsWith('Model') || className === 'User' || className === 'Product' || className === 'Order') {
            filename = `models/${className}.php`;
          } else {
            filename = `core/${className}.php`;
          }
          if (!files[filename]) {
            files[filename] = code;
          }
        } else {
          const filename = `file_${counter}.php`;
          if (!files[filename]) {
            files[filename] = code;
          }
          counter++;
        }
      }
    }
  }
  
  return files;
};

// ==================== MAIN COMPONENT ====================

const Generator = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const showLimitToast = useCallback((reason, serverMessage) => {
    const isGuest = reason === 'guest_limit';
    const message = reason === 'guest_limit'
      ? "You've used your 2 free trial generations. Sign in or sign up to keep going."
      : reason === 'free_limit'
        ? "You've used all 10 free generations for today. Upgrade to Premium for unlimited access."
        : (serverMessage || "That model needs a Premium plan. Upgrade, or switch models in the selector above.");
    const primaryPath = isGuest ? '/register' : '/pricing';
    const primaryLabel = isGuest ? 'Sign up' : 'Upgrade to Pro';

    toast((t) => React.createElement(
      'div',
      { className: 'flex flex-col space-y-2' },
      React.createElement('span', { className: 'text-sm text-gray-700 dark:text-gray-200' }, message),
      React.createElement(
        'div',
        { className: 'flex space-x-2' },
        React.createElement(
          'button',
          {
            onClick: () => { toast.dismiss(t.id); navigate(primaryPath); },
            className: 'px-3 py-1.5 text-xs font-medium bg-[color:var(--accent)] text-white rounded-lg hover:bg-[color:var(--accent-hover)] transition-colors'
          },
          primaryLabel
        ),
        isGuest && React.createElement(
          'button',
          {
            onClick: () => { toast.dismiss(t.id); navigate('/login'); },
            className: 'px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
          },
          'Log in'
        )
      )
    ), { duration: 8000 });
  }, [navigate]);

  // Surfaces the backend's overwritten_files list (a generation that landed
  // into an existing project replaced one or more paths that already had
  // content) - informational only, the merge already happened server-side.
  const warnOverwrittenFiles = useCallback((overwrittenFiles) => {
    if (!overwrittenFiles || overwrittenFiles.length === 0) return;
    toast((t) => React.createElement(
      'div',
      { className: 'text-sm' },
      React.createElement(
        'p',
        { className: 'font-medium text-gray-800 dark:text-gray-100 mb-1' },
        `Replaced ${overwrittenFiles.length} existing file${overwrittenFiles.length > 1 ? 's' : ''} in this project:`
      ),
      React.createElement(
        'p',
        { className: 'text-xs font-mono text-gray-500 dark:text-gray-400' },
        overwrittenFiles.join(', ')
      )
    ), { duration: 7000, icon: React.createElement(AlertTriangle, { size: 18, className: 'text-amber-500' }) });
  }, []);

  const [prompt, setPrompt] = useState(location.state?.prompt || '');
  const [projectName, setProjectName] = useState('');
  const [framework, setFramework] = useState('mvc');
  const [phpVersion, setPhpVersion] = useState('8.1');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [hasAnswers, setHasAnswers] = useState(false);
  const [viewingNew, setViewingNew] = useState(false);
  const [contentType, setContentType] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [retryingId, setRetryingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [animatingIds, setAnimatingIds] = useState(() => new Set());

  const markAnimating = useCallback((id) => {
    setAnimatingIds(prev => new Set(prev).add(id));
  }, []);

  const handleRevealDone = useCallback((id) => {
    setAnimatingIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const [editPrompt, setEditPrompt] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [selectedModel, setSelectedModel] = useState('deepseek');
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Bulk/heavy-build support: a plan breaks one big prompt into a foundation
  // + ordered modules, each generated separately into the same project so
  // the accumulated result isn't capped by a single generation's token budget.
  const [buildPlan, setBuildPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [planProjectId, setPlanProjectId] = useState(null);
  const [builtPlanKeys, setBuiltPlanKeys] = useState(() => new Set());
  const [generatingModuleId, setGeneratingModuleId] = useState(null);

  // Set when arriving here via ProjectDetail's "Continue Building" button -
  // every generation during this visit is added into that existing project
  // instead of always starting a brand new one.
  const [continuedProjectId, setContinuedProjectId] = useState(null);

  // conversationHistory in storage is one flat list across every project
  // ever generated in this browser (by design, for the sidebar's global
  // "recent conversations" list) - but once this visit is scoped to a
  // specific project (via "Continue Building" or a plan-build's own created
  // project), only THAT project's entries belong on screen. Without this,
  // every unrelated project's past entries show mixed in together.
  const activeProjectId = continuedProjectId || planProjectId;
  const visibleHistory = useMemo(
    () => (activeProjectId
      ? conversationHistory.filter(entry => String(entry.projectId) === String(activeProjectId))
      : conversationHistory),
    [conversationHistory, activeProjectId]
  );

  const answersEndRef = useRef(null);
  const textareaRef = useRef(null);
  const formRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const entryRefs = useRef(new Map());

  // Memoized static data
  const frameworks = useMemo(() => [
    { id: 'mvc', name: 'MVC Pattern' },
    { id: 'laravel', name: 'Laravel Framework' },
    { id: 'symfony', name: 'Symfony' },
    { id: 'codeigniter', name: 'CodeIgniter' },
    { id: 'custom', name: 'Custom Structure' }
  ], []);

  const phpVersions = useMemo(() => ['7.4', '8.0', '8.1', '8.2', '8.3'], []);

  const AI_MODELS = useMemo(() => [
    { id: 'deepseek', name: 'DeepSeek', description: 'Fast, good for most tasks', icon: '', color: '#4A5C3A' },
    { id: 'openai', name: 'ChatGPT', description: 'High quality, detailed', icon: '', color: '#F59E0B' },
    { id: 'gemini', name: 'Gemini', description: 'Balanced performance', icon: '', color: '#8B5CF6' }
  ], []);

  // Load data on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('generatorConversationHistory');
    if (savedHistory) {
      try {
        setConversationHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load conversation history:', e);
      }
    }
    
    const savedModel = localStorage.getItem('generatorSelectedModel');
    if (savedModel) {
      setSelectedModel(savedModel);
    }

    // Restore an in-progress build plan too - otherwise a page refresh
    // (the only way viewingNew currently resets) wipes the remaining-builds
    // checklist along with it, even though the project itself is untouched.
    // plan/projectId/builtKeys are saved and restored as ONE atomic blob
    // (see the save effect below) specifically so they can never desync -
    // e.g. the plan surviving a reload while which keys were already built
    // does not, which previously showed Foundation as unbuilt again after
    // simply leaving and coming back to a project.
    let savedState = localStorage.getItem('generatorBuildState');

    // One-time migration from the old separate-keys scheme (pre-dates the
    // atomic blob above) - without this, a plan saved before this change
    // shipped is silently invisible forever, since nothing ever reads those
    // old keys anymore.
    if (!savedState) {
      const oldPlan = localStorage.getItem('generatorBuildPlan');
      if (oldPlan) {
        try {
          const migrated = {
            plan: JSON.parse(oldPlan),
            projectId: localStorage.getItem('generatorPlanProjectId') || null,
            builtKeys: JSON.parse(localStorage.getItem('generatorBuiltPlanKeys') || '[]')
          };
          savedState = JSON.stringify(migrated);
          localStorage.setItem('generatorBuildState', savedState);
        } catch (e) {
          console.error('Failed to migrate old build plan state:', e);
        }
      }
      localStorage.removeItem('generatorBuildPlan');
      localStorage.removeItem('generatorPlanProjectId');
      localStorage.removeItem('generatorBuiltPlanKeys');
    }

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.plan) setBuildPlan(parsed.plan);
        if (parsed.projectId) setPlanProjectId(parsed.projectId);
        if (Array.isArray(parsed.builtKeys)) setBuiltPlanKeys(new Set(parsed.builtKeys));
      } catch (e) {
        console.error('Failed to load build plan state:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (buildPlan) {
      localStorage.setItem('generatorBuildState', JSON.stringify({
        plan: buildPlan,
        projectId: planProjectId,
        builtKeys: Array.from(builtPlanKeys)
      }));
    } else {
      localStorage.removeItem('generatorBuildState');
    }
  }, [buildPlan, planProjectId, builtPlanKeys]);

  // Debounced save to localStorage
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (conversationHistory.length > 0) {
        localStorage.setItem('generatorConversationHistory', JSON.stringify(conversationHistory));
        window.dispatchEvent(new Event('conversation-history-changed'));
      }
    }, 1000);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [conversationHistory]);

  // Jump to a specific entry when navigated here from the sidebar's history list
  useEffect(() => {
    const targetId = location.state?.scrollToId;
    if (targetId == null) return;
    const raf = requestAnimationFrame(() => {
      entryRefs.current.get(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navigate(location.pathname, { replace: true, state: {} });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.scrollToId]);

  // "Create New Project" from the Projects page should look fresh even if
  // there's saved history from a previous project - don't delete the
  // history, just don't show it right now.
  useEffect(() => {
    if (!location.state?.newProject) return;
    setViewingNew(true);
    // A build plan left over from whatever project was open before must not
    // leak into this one - it belongs to a different project_id, so its
    // "Build" buttons would silently generate into the wrong project.
    setBuildPlan(null);
    setPlanProjectId(null);
    setBuiltPlanKeys(new Set());
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.newProject]);

  // Arrived here from ProjectDetail's "Continue Building" button
  useEffect(() => {
    const continueId = location.state?.continueProjectId;
    if (!continueId) return;
    setContinuedProjectId(continueId);
    if (location.state?.continueProjectName) {
      setProjectName(location.state.continueProjectName);
    }

    // The build-plan checklist just restored from localStorage (mount effect
    // above) belongs to whichever project was open last. If that's not THIS
    // project, drop it - otherwise clicking "Build" on it keeps re-running
    // the old project's foundation (planProjectId wins over continuedProjectId
    // in handleGenerateModule) and this project's own modules never show.
    try {
      const savedState = JSON.parse(localStorage.getItem('generatorBuildState') || 'null');
      if (savedState?.projectId && String(savedState.projectId) !== String(continueId)) {
        setBuildPlan(null);
        setPlanProjectId(null);
        setBuiltPlanKeys(new Set());
      }
    } catch (e) {
      // Malformed saved state can't be trusted either way - clear it.
      setBuildPlan(null);
      setPlanProjectId(null);
      setBuiltPlanKeys(new Set());
    }

    toast.success(`Continuing "${location.state?.continueProjectName || 'this project'}" - new generations will be added to it.`);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save selected model
  useEffect(() => {
    localStorage.setItem('generatorSelectedModel', selectedModel);
  }, [selectedModel]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (visibleHistory.length > 0 && answersEndRef.current) {
      answersEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleHistory.length]);

  // Auto-grow the prompt textarea as the user types. Capped at a generous
  // share of the viewport height (not a small fixed number) so a long
  // prompt keeps growing instead of forcing the user to scroll inside it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const maxHeight = Math.max(240, window.innerHeight * 0.6);
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [prompt]);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to use the generator');
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const getLoadingMessage = useCallback(() => {
    if (!loadingStartTime) return 'Generating...';
    
    const elapsedSeconds = Math.floor((Date.now() - loadingStartTime) / 1000);
    
    if (elapsedSeconds < 10) return 'Generating your project...';
    if (elapsedSeconds < 20) return 'Building architecture...';
    if (elapsedSeconds < 30) return 'Creating controllers...';
    if (elapsedSeconds < 45) return 'Generating views...';
    if (elapsedSeconds < 60) return 'Complex project...';
    return 'Finalizing...';
  }, [loadingStartTime]);

  const handleCopyEntry = useCallback(async (entry) => {
    const content = typeof entry.response === 'string' 
      ? entry.response 
      : JSON.stringify(entry.response, null, 2);
    
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(entry.id);
      toast.success('Copied!');
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  }, []);

  const handleCopyCode = useCallback((code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code.substring(0, 50));
    toast.success('Code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const startListening = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        setPrompt(event.results[0][0].transcript);
        setIsListening(false);
      };
      recognition.onerror = () => {
        setIsListening(false);
        toast.error('Voice input failed');
      };
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } else {
      toast.error('Voice input not supported');
    }
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const clearHistory = useCallback(() => {
    if (window.confirm('Clear all history?')) {
      setConversationHistory([]);
      setHasAnswers(false);
      localStorage.removeItem('generatorConversationHistory');
      window.dispatchEvent(new Event('conversation-history-changed'));
      toast.success('History cleared');
    }
  }, []);

  const scrollToEntry = useCallback((id) => {
    entryRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleEdit = useCallback((entry) => {
    setEditingId(entry.id);
    setEditPrompt(entry.prompt);
    setEditProjectName(entry.projectName);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditPrompt('');
    setEditProjectName('');
  }, []);

  const REGENERATE_LIMIT = 3;

  const showRegenerateLimitModal = useCallback((entry) => {
    toast((t) => React.createElement(
      'div',
      { className: 'flex flex-col space-y-2' },
      React.createElement(
        'span',
        { className: 'text-sm text-gray-700 dark:text-gray-200' },
        `You've regenerated this ${REGENERATE_LIMIT} times already. To save tokens, describe exactly what you want changed instead of regenerating blindly.`
      ),
      React.createElement(
        'button',
        {
          onClick: () => { toast.dismiss(t.id); handleEdit(entry); },
          className: 'px-3 py-1.5 text-xs font-medium bg-[color:var(--accent)] text-white rounded-lg hover:bg-[color:var(--accent-hover)] transition-colors self-start'
        },
        'Describe the change instead'
      )
    ), { duration: 10000 });
  }, [handleEdit]);

  const handleRegenerate = useCallback(async (entry) => {
    if ((entry.regenerateCount || 0) >= REGENERATE_LIMIT) {
      showRegenerateLimitModal(entry);
      return;
    }

    setRetryingId(entry.id);
    setGenerating(true);
    setLoadingStartTime(Date.now());

    try {
      // Regenerate must land back in the SAME project this entry already
      // belongs to - calling createProject() here (as before) silently
      // spawned a brand new duplicate project on every single regenerate.
      let newProjectId = entry.projectId;
      if (!newProjectId) {
        const projectResponse = await createProject({
          project_name: entry.projectName,
          framework: entry.framework || framework,
          php_version: entry.phpVersion || phpVersion
        });
        newProjectId = projectResponse.id || projectResponse.project_id || projectResponse.data?.id;
      }

      if (!newProjectId) {
        throw new Error('Failed to resolve a project for this regeneration');
      }

      const enhancedPrompt = `Generate a complete, production-ready ${entry.framework || framework} project for: ${entry.prompt}

Project Name: ${entry.projectName}
PHP Version: ${entry.phpVersion || phpVersion}
Framework: ${entry.framework || framework}

Please provide:
1. Complete project structure with all necessary files (show as a tree diagram)
2. Full database schema with migrations
3. Complete controller code with all CRUD operations
4. Model classes with relationships and validation
5. View templates with proper UI/UX
6. Configuration files for database, routes, middleware
7. Security best practices (CSRF, XSS protection, SQL injection prevention)
8. Authentication and authorization if applicable
9. API endpoints if needed
10. Step-by-step setup instructions

Format the response with clear sections, code blocks, and explanations.`;

      const result = await generateCode({
        prompt: enhancedPrompt,
        concept: entry.framework || framework,
        php_version: entry.phpVersion || phpVersion,
        project_id: newProjectId,
        model: entry.model || selectedModel
      });

      let newContentType = 'answer';
      let newContent = result;
      let files = {};
      let database = null;
      let responseProjectName = null;
      let fileCount = 0;
      
      if (result.files && Object.keys(result.files).length > 0) {
        newContentType = 'code';
        files = result.files;
        fileCount = Object.keys(files).length;
        newContent = result.answer || result.structure || result;
      } 
      else if (result.answer && typeof result.answer === 'string') {
        const extractedFiles = extractFilesFromMarkdown(result.answer);
        if (Object.keys(extractedFiles).length > 0) {
          newContentType = 'code';
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
        newContent = result.answer;
      }
      else if (result.structure) {
        newContentType = 'code';
        newContent = result.structure;
        files = result.structure.files || result.files || {};
        database = result.structure.database || null;
        responseProjectName = result.structure.project_name || null;
        fileCount = Object.keys(files).length;
      }
      else if (typeof result === 'string') {
        const extractedFiles = extractFilesFromMarkdown(result);
        if (Object.keys(extractedFiles).length > 0) {
          newContentType = 'code';
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
        newContent = result;
      }
      else if (result.data) {
        newContentType = 'code';
        newContent = result.data;
        files = result.data.files || {};
        fileCount = Object.keys(files).length;
      }
      
      if (newContentType === 'code' && fileCount === 0 && typeof newContent === 'string') {
        const extractedFiles = extractFilesFromMarkdown(newContent);
        if (Object.keys(extractedFiles).length > 0) {
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
      }
      
      console.log(`📁 Regenerated with ${fileCount} files`);

      setConversationHistory(prev =>
        prev.map(item =>
          item.id === entry.id
            ? {
                ...item,
                response: newContent,
                type: newContentType,
                timestamp: new Date().toISOString(),
                projectId: newProjectId,
                files: files,
                database: database,
                isError: false,
                model: result.model || entry.model || selectedModel,
                fileCount: fileCount,
                regenerateCount: (item.regenerateCount || 0) + 1
              }
            : item
        )
      );
      markAnimating(entry.id);

      setContentType(newContentType);
      setGeneratedContent(newContent);

      const remaining = REGENERATE_LIMIT - ((entry.regenerateCount || 0) + 1);
      if (fileCount > 0) {
        toast.success(`Regenerated ${fileCount} files!${remaining > 0 ? ` (${remaining} regenerate${remaining === 1 ? '' : 's'} left)` : ''}`);
      } else {
        toast.success('Regenerated!');
      }

    } catch (error) {
      console.error('Regeneration error:', error);
      
      const errorMessage = error.message || 'Regeneration failed';
      
      setConversationHistory(prev => 
        prev.map(item => 
          item.id === entry.id 
            ? {
                ...item,
                response: errorMessage,
                timestamp: new Date().toISOString(),
                isError: true
              }
            : item
        )
      );
      
      toast.error(errorMessage);
    } finally {
      setRetryingId(null);
      setGenerating(false);
      setLoadingStartTime(null);
    }
  }, [framework, phpVersion, selectedModel, showRegenerateLimitModal]);

  const handleSubmitEdit = useCallback(async (entry) => {
    if (!editPrompt.trim()) {
      toast.error('Please describe what you want to build');
      return;
    }

    if (!editProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setRetryingId(entry.id);
    setGenerating(true);
    setLoadingStartTime(Date.now());

    try {
      // Same fix as handleRegenerate - editing and resubmitting must update
      // the SAME project this entry already belongs to, not fork a new one.
      let newProjectId = entry.projectId;
      if (!newProjectId) {
        const projectResponse = await createProject({
          project_name: editProjectName,
          framework: entry.framework || framework,
          php_version: entry.phpVersion || phpVersion
        });
        newProjectId = projectResponse.id || projectResponse.project_id || projectResponse.data?.id;
      }

      if (!newProjectId) {
        throw new Error('Failed to create project');
      }

      const enhancedPrompt = `Generate a complete, production-ready ${entry.framework || framework} project for: ${editPrompt}

Project Name: ${editProjectName}
PHP Version: ${entry.phpVersion || phpVersion}
Framework: ${entry.framework || framework}

Please provide:
1. Complete project structure with all necessary files (show as a tree diagram)
2. Full database schema with migrations
3. Complete controller code with all CRUD operations
4. Model classes with relationships and validation
5. View templates with proper UI/UX
6. Configuration files for database, routes, middleware
7. Security best practices (CSRF, XSS protection, SQL injection prevention)
8. Authentication and authorization if applicable
9. API endpoints if needed
10. Step-by-step setup instructions

Format the response with clear sections, code blocks, and explanations.`;

      const result = await generateCode({
        prompt: enhancedPrompt,
        concept: entry.framework || framework,
        php_version: entry.phpVersion || phpVersion,
        project_id: newProjectId,
        model: entry.model || selectedModel
      });

      let newContentType = 'answer';
      let newContent = result;
      let files = {};
      let database = null;
      let responseProjectName = null;
      let fileCount = 0;
      
      if (result.files && Object.keys(result.files).length > 0) {
        newContentType = 'code';
        files = result.files;
        fileCount = Object.keys(files).length;
        newContent = result.answer || result.structure || result;
      } 
      else if (result.answer && typeof result.answer === 'string') {
        const extractedFiles = extractFilesFromMarkdown(result.answer);
        if (Object.keys(extractedFiles).length > 0) {
          newContentType = 'code';
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
        newContent = result.answer;
      }
      else if (result.structure) {
        newContentType = 'code';
        newContent = result.structure;
        files = result.structure.files || result.files || {};
        database = result.structure.database || null;
        responseProjectName = result.structure.project_name || null;
        fileCount = Object.keys(files).length;
      }
      else if (typeof result === 'string') {
        const extractedFiles = extractFilesFromMarkdown(result);
        if (Object.keys(extractedFiles).length > 0) {
          newContentType = 'code';
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
        newContent = result;
      }
      else if (result.data) {
        newContentType = 'code';
        newContent = result.data;
        files = result.data.files || {};
        fileCount = Object.keys(files).length;
      }
      
      if (newContentType === 'code' && fileCount === 0 && typeof newContent === 'string') {
        const extractedFiles = extractFilesFromMarkdown(newContent);
        if (Object.keys(extractedFiles).length > 0) {
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
      }
      
      console.log(`📁 Updated with ${fileCount} files`);
      
      setConversationHistory(prev => 
        prev.map(item => 
          item.id === entry.id 
            ? {
                ...item,
                prompt: editPrompt,
                projectName: responseProjectName || editProjectName,
                response: newContent,
                type: newContentType,
                timestamp: new Date().toISOString(),
                projectId: newProjectId,
                files: files,
                database: database,
                isError: false,
                model: result.model || entry.model || selectedModel,
                fileCount: fileCount
              }
            : item
        )
      );
      markAnimating(entry.id);

      setContentType(newContentType);
      setGeneratedContent(newContent);
      setEditingId(null);
      setEditPrompt('');
      setEditProjectName('');
      
      if (fileCount > 0) {
        toast.success(`Updated with ${fileCount} files!`);
      } else {
        toast.success('Updated!');
      }
      
    } catch (error) {
      console.error('Edit error:', error);
      
      const errorMessage = error.message || 'Update failed';
      
      setConversationHistory(prev => 
        prev.map(item => 
          item.id === entry.id 
            ? {
                ...item,
                response: errorMessage,
                timestamp: new Date().toISOString(),
                isError: true
              }
            : item
        )
      );
      
      toast.error(errorMessage);
    } finally {
      setRetryingId(null);
      setGenerating(false);
      setLoadingStartTime(null);
    }
  }, [framework, phpVersion, selectedModel, editPrompt, editProjectName]);

  // Shared result-shape parsing used by the module-plan build flow below.
  // (handleGenerate/handleRegenerate/handleSubmitEdit keep their own inline
  // copies of this logic untouched, to avoid touching verified behavior.)
  const parseGenerationResult = useCallback((result) => {
    let newContentType = 'answer';
    let newContent = result;
    let files = {};
    let database = null;
    let fileCount = 0;

    if (result.files && Object.keys(result.files).length > 0) {
      newContentType = 'code';
      files = result.files;
      fileCount = Object.keys(files).length;
      newContent = result.answer || result.structure || result;
    } else if (result.answer && typeof result.answer === 'string') {
      const extractedFiles = extractFilesFromMarkdown(result.answer);
      if (Object.keys(extractedFiles).length > 0) {
        newContentType = 'code';
        files = extractedFiles;
        fileCount = Object.keys(files).length;
      }
      newContent = result.answer;
    } else if (result.structure) {
      newContentType = 'code';
      newContent = result.structure;
      files = result.structure.files || result.files || {};
      database = result.structure.database || null;
      fileCount = Object.keys(files).length;
    } else if (typeof result === 'string') {
      const extractedFiles = extractFilesFromMarkdown(result);
      if (Object.keys(extractedFiles).length > 0) {
        newContentType = 'code';
        files = extractedFiles;
        fileCount = Object.keys(files).length;
      }
      newContent = result;
    } else if (result.data) {
      newContentType = 'code';
      newContent = result.data;
      files = result.data.files || {};
      fileCount = Object.keys(files).length;
    }

    if (newContentType === 'code' && fileCount === 0 && typeof newContent === 'string') {
      const extractedFiles = extractFilesFromMarkdown(newContent);
      if (Object.keys(extractedFiles).length > 0) {
        files = extractedFiles;
        fileCount = Object.keys(files).length;
      }
    }

    return { newContentType, newContent, files, database, fileCount };
  }, []);

  const handlePlanBuild = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('Describe what you want to build first');
      return;
    }

    setPlanning(true);
    try {
      const result = await planProject(prompt, selectedModel);
      if (!result.plan) {
        throw new Error(result.error || "Couldn't plan that build");
      }
      setBuildPlan(result.plan);

      // Re-planning a project that already has a foundation generated (e.g.
      // after leaving and coming back) must not present Foundation as
      // unbuilt again - a fresh plan object has no memory of earlier
      // generations, but the project's own file history does.
      const existingProjectId = continuedProjectId;
      setPlanProjectId(existingProjectId || null);
      if (existingProjectId) {
        try {
          const filesResult = await getProjectFiles(existingProjectId);
          if (filesResult?.data?.has_foundation) {
            setBuiltPlanKeys(new Set(['foundation']));
          } else {
            setBuiltPlanKeys(new Set());
          }
        } catch (e) {
          setBuiltPlanKeys(new Set());
        }
      } else {
        setBuiltPlanKeys(new Set());
      }
    } catch (error) {
      toast.error(error.message || 'Failed to plan this build');
    } finally {
      setPlanning(false);
    }
  }, [prompt, selectedModel, continuedProjectId]);

  const handleGenerateModule = useCallback(async (key, moduleName, moduleDescription, isFoundation) => {
    if (generating || generatingModuleId) {
      toast.error('Already generating...');
      return;
    }

    setGeneratingModuleId(key);
    setGenerating(true);
    setLoadingStartTime(Date.now());

    try {
      // If this visit is already continuing a specific project (via
      // ProjectDetail's "Continue Building"), plan-built modules must land
      // in that same project too - not spin up an unrelated new one.
      let currentProjectId = planProjectId || continuedProjectId;

      if (!currentProjectId) {
        const name = projectName.trim() || 'Bulk Project';
        const projectResponse = await createProject({
          project_name: name,
          framework,
          php_version: phpVersion
        });

        currentProjectId = projectResponse.id || projectResponse.project_id || projectResponse.data?.id;
        if (!currentProjectId) {
          throw new Error('Failed to create project');
        }

        if (!projectName.trim()) setProjectName(name);
      }

      if (currentProjectId !== planProjectId) {
        setPlanProjectId(currentProjectId);
      }

      const modulePrompt = isFoundation
        ? `Build the shared foundation for this project: ${prompt}\n\nFoundation scope: ${moduleDescription}\n\nOnly build the shared/foundation pieces described above (e.g. layout, DB connection, shared CSS/design tokens, base config) - not the feature-specific modules themselves. Later requests will add those one at a time into this same project and will reuse what you build here.`
        : `This project already has a foundation generated. Now build ONLY this one module: "${moduleName}" - ${moduleDescription}\n\nOriginal project goal, for context: ${prompt}\n\nDo not redo the foundation or any other module - just this one.`;

      const result = await generateCode({
        prompt: modulePrompt,
        concept: framework,
        php_version: phpVersion,
        project_id: currentProjectId,
        model: selectedModel
      });

      const { newContentType, newContent, files, database, fileCount } = parseGenerationResult(result);

      const newEntry = {
        id: Date.now(),
        prompt: `${moduleName}: ${moduleDescription}`,
        projectName: projectName.trim() || 'Bulk Project',
        framework,
        phpVersion,
        response: newContent,
        type: newContentType,
        timestamp: new Date().toISOString(),
        projectId: currentProjectId,
        files,
        database,
        model: result.model || selectedModel,
        fileCount
      };

      setConversationHistory(prev => [...prev, newEntry]);
      // No staged-reveal animation here (unlike a normal single generate) -
      // plan-build results must be fully visible immediately so a completed
      // build stays readable while the next one hasn't been clicked yet.
      setHasAnswers(true);
      // Without this, a build started from the "New Project" entry point
      // (viewingNew still true) stays stuck rendering the pre-build empty
      // layout - which never maps conversationHistory - so the just-built
      // entry silently fails to appear until something else (e.g. a page
      // refresh) resets viewingNew back to false.
      setViewingNew(false);
      setBuiltPlanKeys(prev => new Set(prev).add(key));
      toast.success(fileCount > 0 ? `Built "${moduleName}" - ${fileCount} files!` : `Built "${moduleName}"!`);
      warnOverwrittenFiles(result.overwritten_files);

      // Bring this specific build's result into view immediately - without
      // this, it lands above the still-visible build-plan checklist and the
      // user has to scroll up to notice anything happened.
      requestAnimationFrame(() => {
        entryRefs.current.get(newEntry.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

    } catch (error) {
      console.error('Module generation error:', error);
      if (error.data?.limitReached) {
        showLimitToast(error.data.reason, error.data.error);
      } else {
        toast.error(error.message || `Failed to build "${moduleName}"`);
      }
    } finally {
      setGeneratingModuleId(null);
      setGenerating(false);
      setLoadingStartTime(null);
    }
  }, [generating, generatingModuleId, planProjectId, continuedProjectId, projectName, prompt, framework, phpVersion, selectedModel, parseGenerationResult, showLimitToast, warnOverwrittenFiles]);

  const handleGenerate = useCallback(async (e) => {
    e.preventDefault();
    
    if (generating) {
      toast.error('Already generating...');
      return;
    }
    
    if (!prompt.trim()) {
      toast.error('Please describe what you want to build');
      return;
    }

    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setGenerating(true);
    setLoadingStartTime(Date.now());
    setViewingNew(false);

    const currentPrompt = prompt;
    const currentProjectName = projectName;
    const currentFramework = framework;
    const currentPhpVersion = phpVersion;
    const currentModel = selectedModel;
    
    setPrompt('');
    setProjectName('');

    try {
      const projectResponse = continuedProjectId ? null : await createProject({
        project_name: currentProjectName,
        framework: currentFramework,
        php_version: currentPhpVersion
      });

      const newProjectId = continuedProjectId || projectResponse.id || projectResponse.project_id || projectResponse.data?.id;

      if (!newProjectId) {
        throw new Error('Failed to get project ID');
      }

      const enhancedPrompt = `Generate a complete, production-ready ${currentFramework} project for: ${currentPrompt}

Project Name: ${currentProjectName}
PHP Version: ${currentPhpVersion}
Framework: ${currentFramework}

Please provide:
1. Complete project structure with all necessary files (show as a tree diagram)
2. Full database schema with migrations
3. Complete controller code with all CRUD operations
4. Model classes with relationships and validation
5. View templates with proper UI/UX
6. Configuration files for database, routes, middleware
7. Security best practices (CSRF, XSS protection, SQL injection prevention)
8. Authentication and authorization if applicable
9. API endpoints if needed
10. Step-by-step setup instructions

Format the response with clear sections, code blocks, and explanations.`;

      const result = await generateCode({
        prompt: enhancedPrompt,
        concept: currentFramework,
        php_version: currentPhpVersion,
        project_id: newProjectId,
        model: currentModel
      });

      let newContentType = 'answer';
      let newContent = result;
      let files = {};
      let database = null;
      let responseProjectName = null;
      let fileCount = 0;
      
      if (result.files && Object.keys(result.files).length > 0) {
        newContentType = 'code';
        files = result.files;
        fileCount = Object.keys(files).length;
        newContent = result.answer || result.structure || result;
      } 
      else if (result.answer && typeof result.answer === 'string') {
        const extractedFiles = extractFilesFromMarkdown(result.answer);
        if (Object.keys(extractedFiles).length > 0) {
          newContentType = 'code';
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
        newContent = result.answer;
      }
      else if (result.structure) {
        newContentType = 'code';
        newContent = result.structure;
        files = result.structure.files || result.files || {};
        database = result.structure.database || null;
        responseProjectName = result.structure.project_name || null;
        fileCount = Object.keys(files).length;
      }
      else if (typeof result === 'string') {
        const extractedFiles = extractFilesFromMarkdown(result);
        if (Object.keys(extractedFiles).length > 0) {
          newContentType = 'code';
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
        newContent = result;
      }
      else if (result.data) {
        newContentType = 'code';
        newContent = result.data;
        files = result.data.files || {};
        fileCount = Object.keys(files).length;
      }
      
      if (newContentType === 'code' && fileCount === 0 && typeof newContent === 'string') {
        const extractedFiles = extractFilesFromMarkdown(newContent);
        if (Object.keys(extractedFiles).length > 0) {
          files = extractedFiles;
          fileCount = Object.keys(files).length;
        }
      }
      
      console.log(`📁 Extracted ${fileCount} files from response`);
      
      const newEntry = {
        id: Date.now(),
        prompt: currentPrompt,
        projectName: responseProjectName || currentProjectName,
        framework: currentFramework,
        phpVersion: currentPhpVersion,
        response: newContent,
        type: newContentType,
        timestamp: new Date().toISOString(),
        projectId: newProjectId,
        files: files,
        database: database,
        model: result.model || currentModel,
        fileCount: fileCount
      };
      
      setConversationHistory(prev => [...prev, newEntry]);
      markAnimating(newEntry.id);
      setContentType(newContentType);
      setGeneratedContent(newContent);
      setHasAnswers(true);
      
      if (fileCount > 0) {
        toast.success(`Generated ${fileCount} files!`);
      } else {
        toast.success('Generated!');
      }
      warnOverwrittenFiles(result.overwritten_files);

    } catch (error) {
      console.error('Generation error:', error);

      if (error.data?.limitReached) {
        setPrompt(currentPrompt);
        setProjectName(currentProjectName);
        showLimitToast(error.data.reason, error.data.error);
      } else {
        const errorMessage = error.response?.data?.error || error.message || 'Generation failed';

        const errorEntry = {
          id: Date.now(),
          prompt: currentPrompt,
          projectName: currentProjectName,
          framework: currentFramework,
          phpVersion: currentPhpVersion,
          response: errorMessage,
          type: 'answer',
          timestamp: new Date().toISOString(),
          isError: true,
          model: currentModel
        };

        setConversationHistory(prev => [...prev, errorEntry]);
        setContentType('answer');
        setGeneratedContent(errorMessage);
        setHasAnswers(true);
        toast.error(errorMessage);
      }
    } finally {
      setGenerating(false);
      setLoadingStartTime(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [prompt, projectName, framework, phpVersion, selectedModel, generating, continuedProjectId, showLimitToast, warnOverwrittenFiles]);

  const handleNewProject = useCallback(() => {
    setPrompt('');
    setProjectName('');
    setGeneratedContent(null);
    setHasAnswers(false);
    setViewingNew(true);
    setProjectId(null);
    setGenerating(false);
    setRetryingId(null);
    setEditingId(null);
    setContinuedProjectId(null);
    setBuildPlan(null);
    setPlanProjectId(null);
    setBuiltPlanKeys(new Set());
    textareaRef.current?.focus();
  }, []);

  // ==================== RENDER ====================

  // Build-plan checklist - shown above the form in both the empty-state and
  // conversation views whenever a plan exists, so modules can keep being
  // built mid-conversation.
  const buildPlanPanel = buildPlan && React.createElement(
    'div',
    { className: 'bg-white dark:bg-[#1a1d23] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#2d333d] mb-4 space-y-2' },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between mb-1' },
      React.createElement(
        'h3',
        { className: 'text-sm font-semibold text-gray-800 dark:text-[#f3f4f6] flex items-center' },
        React.createElement(ListChecks, { size: 14, className: 'mr-1.5 text-[color:var(--accent)]' }),
        'Build plan'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => { setBuildPlan(null); setPlanProjectId(null); setBuiltPlanKeys(new Set()); },
          className: 'text-xs text-gray-400 dark:text-[#7b8494] hover:text-red-500'
        },
        'Dismiss'
      )
    ),
    buildPlan.foundation && React.createElement(
      'div',
      { className: 'flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-[#0f1115]' },
      React.createElement(
        'div',
        { className: 'min-w-0 pr-2' },
        React.createElement(
          'p',
          { className: 'text-sm font-medium text-gray-800 dark:text-[#f3f4f6] flex items-center' },
          React.createElement(Layers, { size: 13, className: 'mr-1.5 text-[color:var(--accent)]' }),
          'Foundation'
        ),
        React.createElement('p', { className: 'text-xs text-gray-500 dark:text-[#9aa3af]' }, buildPlan.foundation.description)
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          disabled: generating || builtPlanKeys.has('foundation'),
          onClick: () => handleGenerateModule('foundation', 'Foundation', buildPlan.foundation.description, true),
          className: `shrink-0 px-3 py-1.5 text-xs rounded-md font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center space-x-1 ${
            builtPlanKeys.has('foundation')
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)]'
          }`
        },
        builtPlanKeys.has('foundation')
          ? [React.createElement(Check, { key: 'c', size: 11 }), React.createElement('span', { key: 't' }, 'Built')]
          : (generatingModuleId === 'foundation' ? React.createElement(Loader2, { size: '1em', className: 'animate-spin', size: 11 }) : 'Build')
      )
    ),
    (buildPlan.modules || []).map((mod) =>
      React.createElement(
        'div',
        { key: mod.id, className: 'flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-[#0f1115]' },
        React.createElement(
          'div',
          { className: 'min-w-0 pr-2' },
          React.createElement('p', { className: 'text-sm font-medium text-gray-800 dark:text-[#f3f4f6]' }, mod.name),
          React.createElement('p', { className: 'text-xs text-gray-500 dark:text-[#9aa3af]' }, mod.description)
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            disabled: generating || !builtPlanKeys.has('foundation') || builtPlanKeys.has(mod.id),
            title: !builtPlanKeys.has('foundation') ? 'Build the foundation first' : '',
            onClick: () => handleGenerateModule(mod.id, mod.name, mod.description, false),
            className: `shrink-0 px-3 py-1.5 text-xs rounded-md font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center space-x-1 ${
              builtPlanKeys.has(mod.id)
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)]'
            }`
          },
          builtPlanKeys.has(mod.id)
            ? [React.createElement(Check, { key: 'c', size: 11 }), React.createElement('span', { key: 't' }, 'Built')]
            : (generatingModuleId === mod.id ? React.createElement(Loader2, { size: '1em', className: 'animate-spin', size: 11 }) : 'Build')
        )
      )
    )
  );

  // If there are answers, show conversation history
  if (!viewingNew && (hasAnswers || visibleHistory.length > 0)) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-transparent pb-24 relative' },

      // Scroll to top button
      visibleHistory.length > 0 && React.createElement(
        'button',
        {
          onClick: scrollToTop,
          className: 'fixed bottom-20 right-4 p-2 bg-[color:var(--accent)] text-white rounded-full shadow-md hover:bg-[color:var(--accent-hover)] transition-all z-40'
        },
        React.createElement(ArrowUp, { size: 16 })
      ),

      React.createElement(
        'div',
        { className: 'flex-1 min-w-0 pt-8 px-4' },
        React.createElement(
        'div',
        { className: 'container mx-auto max-w-4xl' },

        // Header
        React.createElement(
          'div',
          { className: 'flex items-center justify-between mb-6' },
          React.createElement(
            'h1',
            { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6]' },
            'Project Generator'
          ),
          React.createElement(
            'div',
            { className: 'flex items-center space-x-2' },
            
            // Model Selector
            React.createElement(
              'div',
              { className: 'relative' },
              React.createElement(
                'button',
                {
                  onClick: () => setShowModelSelector(!showModelSelector),
                  className: 'px-3 py-1.5 bg-white dark:bg-[#1a1d23] border border-gray-200 dark:border-[#2d333d] rounded-md text-sm flex items-center space-x-1 hover:border-[color:var(--accent)] transition-colors'
                },
                React.createElement(Bot, { size: '1em', className: 'text-[color:var(--accent)] text-xs' }),
                React.createElement('span', null, AI_MODELS.find(m => m.id === selectedModel)?.name || 'Select')
              ),
              showModelSelector && React.createElement(
                'div',
                { className: 'absolute right-0 mt-1 w-36 bg-white dark:bg-[#1a1d23] rounded-md shadow-lg border border-gray-200 dark:border-[#2d333d] py-1 z-50' },
                AI_MODELS.map(model =>
                  React.createElement(
                    'button',
                    {
                      key: model.id,
                      onClick: () => {
                        setSelectedModel(model.id);
                        setShowModelSelector(false);
                      },
                      className: `w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-[#0f1115] ${
                        selectedModel === model.id ? 'bg-[color:var(--accent)]/5 text-[color:var(--accent)]' : 'text-gray-700 dark:text-[#d1d5db]'
                      }`
                    },
                    model.name
                  )
                )
              )
            ),
            
            // Clear History Button
            visibleHistory.length > 0 && React.createElement(
              'button',
              {
                onClick: clearHistory,
                className: 'p-1.5 text-gray-400 dark:text-[#7b8494] hover:text-red-500 transition-colors'
              },
              React.createElement(Trash2, { size: 14 })
            )
          )
        ),

        // Conversation History
        React.createElement(
          'div',
          { className: 'mb-6 space-y-6' },
          visibleHistory.map((entry) =>
            React.createElement(
              'div',
              { key: entry.id, ref: (el) => { if (el) entryRefs.current.set(entry.id, el); }, className: 'space-y-3 scroll-mt-6' },

              // User Prompt
              React.createElement(
                'div',
                { className: 'bg-gray-100 dark:bg-[#242933] rounded-lg p-3 ml-auto max-w-2xl' },
                React.createElement(
                  'div',
                  { className: 'flex justify-between items-start' },
                  React.createElement(
                    'p',
                    { className: 'text-sm text-gray-800 dark:text-[#f3f4f6]' },
                    entry.prompt
                  ),
                  editingId === entry.id ? React.createElement(
                    'div',
                    { className: 'flex space-x-1 ml-2' },
                    React.createElement(
                      'button',
                      {
                        onClick: handleCancelEdit,
                        className: 'p-1 text-gray-400 dark:text-[#7b8494] hover:text-red-500'
                      },
                      React.createElement(X, { size: 12 })
                    ),
                    React.createElement(
                      'button',
                      {
                        onClick: () => handleSubmitEdit(entry),
                        disabled: retryingId === entry.id,
                        className: 'p-1 text-gray-400 dark:text-[#7b8494] hover:text-green-600'
                      },
                      React.createElement(Save, { size: 12 })
                    )
                  ) : React.createElement(
                    'button',
                    {
                      onClick: () => handleEdit(entry),
                      className: 'p-1 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)]'
                    },
                    React.createElement(Pencil, { size: 12 })
                  )
                ),
                
                editingId === entry.id && React.createElement(
                  'div',
                  { className: 'space-y-2 mt-2' },
                  React.createElement('input', {
                    type: 'text',
                    value: editProjectName,
                    onChange: (e) => setEditProjectName(e.target.value),
                    placeholder: 'Project Name',
                    className: 'w-full px-2 py-1 text-sm border border-[color:var(--accent)] rounded-md'
                  }),
                  React.createElement('textarea', {
                    value: editPrompt,
                    onChange: (e) => setEditPrompt(e.target.value),
                    placeholder: 'Project Description',
                    rows: 2,
                    className: 'w-full px-2 py-1 text-sm border border-[color:var(--accent)] rounded-md'
                  })
                ),
                
                React.createElement(
                  'div',
                  { className: 'flex justify-end mt-1' },
                  React.createElement('span', { className: 'text-xs text-gray-400 dark:text-[#7b8494]' },
                    new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  )
                )
              ),
              
              // AI Response
              React.createElement(AIResponse, {
                entry: entry,
                onRegenerate: handleRegenerate,
                onCopyEntry: handleCopyEntry,
                onCopyCode: handleCopyCode,
                isRetrying: retryingId === entry.id,
                copiedId: copiedId,
                copiedCode: copiedCode,
                animate: animatingIds.has(entry.id),
                onRevealDone: () => handleRevealDone(entry.id)
              })
            )
          ),
          React.createElement('div', { ref: answersEndRef })
        ),

        buildPlanPanel,

        // New Project Button
        visibleHistory.length > 0 && React.createElement(
          'div',
          { className: 'flex justify-center mb-4' },
          React.createElement(
            'button',
            {
              onClick: handleNewProject,
              className: 'px-4 py-2 bg-[color:var(--accent)] text-white rounded-md text-sm hover:bg-[color:var(--accent-hover)] transition-colors flex items-center space-x-2'
            },
            React.createElement(Code2, { size: 14 }),
            React.createElement('span', null, 'New Project')
          )
        ),

        // What this box actually does, and for which project - without this
        // the project-name field and prompt box look like a brand new,
        // unrelated project rather than "add more to the thing I'm already
        // continuing".
        activeProjectId && React.createElement(
          'div',
          { className: 'flex items-center justify-between text-xs text-gray-500 dark:text-[#9aa3af] mb-2 px-1' },
          React.createElement('span', null, `Continuing "${projectName || 'this project'}" - describe what to add next, then Generate or Plan a build.`)
        ),

        // Input Form
        React.createElement(
          'form',
          {
            key: 'generator-input-form',
            ref: formRef,
            onSubmit: handleGenerate,
            className: 'sticky bottom-4 bg-white dark:bg-[#1a1d23] rounded-lg shadow-md border border-gray-200 dark:border-[#2d333d]'
          },
          React.createElement('input', {
            type: 'text',
            value: projectName,
            onChange: (e) => setProjectName(e.target.value),
            placeholder: 'Project name',
            className: 'w-full px-4 py-2 border-b border-gray-200 dark:border-[#2d333d] focus:outline-none rounded-t-lg text-sm'
          }),
          React.createElement('textarea', {
            ref: textareaRef,
            value: prompt,
            onChange: (e) => setPrompt(e.target.value),
            placeholder: activeProjectId ? 'Describe what to add to this project...' : 'Describe your project...',
            rows: '2',
            className: 'w-full px-4 py-2 pr-20 border-0 focus:outline-none resize-none text-sm rounded-b-lg'
          }),
          React.createElement(
            'div',
            { className: 'absolute bottom-2 right-2 flex items-center space-x-1' },
            !buildPlan && React.createElement(
              'button',
              {
                type: 'button',
                onClick: handlePlanBuild,
                disabled: planning || generating || !prompt.trim(),
                title: 'Break this into a foundation + modules you build one at a time, instead of one single generate',
                className: 'p-2 rounded-md text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)] transition-colors disabled:opacity-50'
              },
              planning ? React.createElement(Loader2, { size: 14, className: 'animate-spin' }) : React.createElement(FolderOpen, { size: 14 })
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: startListening,
                className: `p-2 rounded-md transition-colors ${
                  isListening ? 'bg-red-500 text-white' : 'text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)]'
                }`
              },
              React.createElement(Mic, { size: 14 })
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                disabled: generating,
                className: 'p-2 bg-[color:var(--accent)] text-white rounded-md hover:bg-[color:var(--accent-hover)] disabled:opacity-50 transition-colors'
              },
              generating ? React.createElement(Loader2, { size: 14, className: 'animate-spin' }) : React.createElement(ArrowRight, { size: 14 })
            )
          )
        )
      )
      )
    );
  }

  // Initial form layout
  const featureCards = [
    { icon: Folder, title: 'Complete MVC structure', desc: 'Controllers, models, and views scaffolded and wired together, ready to run.' },
    { icon: Database, title: 'Database & migrations', desc: 'A schema generated from your description, with migration files included.' },
    { icon: ShieldCheck, title: 'Security best practices', desc: 'CSRF, XSS, and SQL-injection protections built into the generated code.' }
  ];

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent pb-16 relative' },
    React.createElement(
      'div',
      { className: 'pt-8 px-4' },
    React.createElement(
      'div',
      { className: 'container mx-auto max-w-3xl' },

      // Header
      React.createElement(
        'div',
        { className: 'text-center mb-8' },
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2' },
          'Build your ',
          React.createElement('span', { className: 'inline-block bg-[color:var(--accent)] text-white px-2 rounded-lg' }, 'Project')
        ),
        React.createElement(
          'p',
          { className: 'text-sm text-gray-500 dark:text-gray-400' },
          'Describe what you want to build and get a complete, working codebase.'
        )
      ),

      // Feature cards
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-3 gap-3 mb-8' },
        featureCards.map((card, idx) => {
          const Icon = card.icon;
          return React.createElement(
            'div',
            { key: idx, className: 'p-4 rounded-xl border border-gray-200 dark:border-[#2d333d] bg-white dark:bg-[#1a1d23]' },
            React.createElement(
              'div',
              { className: 'w-8 h-8 rounded-lg bg-[color:var(--accent)]/10 flex items-center justify-center mb-2' },
              React.createElement(Icon, { size: '1em', className: 'text-[color:var(--accent)] text-sm' })
            ),
            React.createElement('h3', { className: 'text-sm font-semibold text-gray-800 dark:text-[#f3f4f6] mb-1' }, card.title),
            React.createElement('p', { className: 'text-xs text-gray-500 dark:text-[#9aa3af] leading-relaxed' }, card.desc)
          );
        })
      ),

      buildPlanPanel,

      // Generator Form
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#2d333d]' },
        React.createElement(
          'form',
          { onSubmit: handleGenerate, className: 'space-y-4' },
          
          // Model Selection
          React.createElement(
            'div',
            { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2' },
            AI_MODELS.map(model =>
              React.createElement(
                'button',
                {
                  key: model.id,
                  type: 'button',
                  onClick: () => setSelectedModel(model.id),
                  className: `p-2 border rounded-md text-xs transition-all ${
                    selectedModel === model.id 
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/5 text-[color:var(--accent)]' 
                      : 'border-gray-200 dark:border-[#2d333d] hover:border-gray-300'
                  }`
                },
                React.createElement('div', { className: 'text-center' }, model.icon),
                React.createElement('div', { className: 'font-medium mt-1' }, model.name)
              )
            )
          ),
          
          // Project Name
          React.createElement('input', {
            type: 'text',
            value: projectName,
            onChange: (e) => setProjectName(e.target.value),
            placeholder: 'Project name (e.g., my-blog)',
            className: 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2d333d] rounded-md focus:outline-none'
          }),

          // Prompt
          React.createElement('textarea', {
            ref: textareaRef,
            value: prompt,
            onChange: (e) => setPrompt(e.target.value),
            rows: 4,
            placeholder: 'Describe your project in detail...',
            className: 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2d333d] rounded-md focus:outline-none resize-none'
          }),
          
          // Framework and PHP Version
          React.createElement(
            'div',
            { className: 'grid grid-cols-2 gap-3' },
            React.createElement(
              'select',
              {
                value: framework,
                onChange: (e) => setFramework(e.target.value),
                className: 'px-3 py-2 text-sm border border-gray-200 dark:border-[#2d333d] rounded-md focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]'
              },
              frameworks.map(f => 
                React.createElement('option', { key: f.id, value: f.id }, f.name)
              )
            ),
            React.createElement(
              'select',
              {
                value: phpVersion,
                onChange: (e) => setPhpVersion(e.target.value),
                className: 'px-3 py-2 text-sm border border-gray-200 dark:border-[#2d333d] rounded-md focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]'
              },
              phpVersions.map(v => 
                React.createElement('option', { key: v, value: v }, `PHP ${v}`)
              )
            )
          ),

          // Advanced Options Toggle
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => setShowAdvanced(!showAdvanced),
              className: 'flex items-center text-xs text-[color:var(--accent)] hover:text-[color:var(--accent-hover)] transition-colors'
            },
            React.createElement(Settings2, { size: '1em', className: `mr-1 transition-transform duration-300 ${showAdvanced ? 'rotate-90' : ''}` }),
            showAdvanced ? 'Hide options' : 'More options'
          ),
          
          // Advanced Options
          showAdvanced && React.createElement(
            'div',
            { className: 'bg-gray-50 dark:bg-[#0f1115] p-3 rounded-md space-y-3' },
            React.createElement(
              'div',
              { className: 'grid grid-cols-2 gap-3' },
              React.createElement(
                'select',
                { className: 'w-full px-2 py-1 text-xs border border-gray-200 dark:border-[#2d333d] rounded-md' },
                React.createElement('option', { value: 'jwt' }, 'JWT Auth'),
                React.createElement('option', { value: 'session' }, 'Session')
              ),
              React.createElement(
                'select',
                { className: 'w-full px-2 py-1 text-xs border border-gray-200 dark:border-[#2d333d] rounded-md' },
                React.createElement('option', { value: 'mysql' }, 'MySQL'),
                React.createElement('option', { value: 'postgresql' }, 'PostgreSQL')
              )
            )
          ),

          // Submit Buttons
          React.createElement(
            'div',
            { className: 'flex items-center space-x-2' },
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: handlePlanBuild,
                disabled: planning || generating || !prompt.trim(),
                title: 'For a big/bulk build (e.g. a hospital management system) - breaks it into modules you build one at a time',
                className: 'shrink-0 px-3 py-2 text-sm font-medium border border-[color:var(--accent)] text-[color:var(--accent)] rounded-md hover:bg-[color:var(--accent)]/5 disabled:opacity-50 transition-colors flex items-center space-x-2'
              },
              planning ? [
                React.createElement(Loader2, { key: 'spinner', size: '1em', className: 'animate-spin' }),
                React.createElement('span', { key: 'text' }, 'Planning...')
              ] : [
                React.createElement(FolderOpen, { key: 'icon', size: '1em' }),
                React.createElement('span', { key: 'text' }, 'Plan this build')
              ]
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                disabled: generating,
                className: 'flex-1 py-2 bg-[color:var(--accent)] text-white rounded-md text-sm hover:bg-[color:var(--accent-hover)] disabled:opacity-50 transition-colors flex items-center justify-center space-x-2'
              },
              generating ? [
                React.createElement(Loader2, { key: 'spinner', size: '1em', className: 'animate-spin' }),
                React.createElement('span', { key: 'text' }, getLoadingMessage())
              ] : [
                React.createElement(Code2, { key: 'icon', size: '1em' }),
                React.createElement('span', { key: 'text' }, 'Generate')
              ]
            )
          )
        )
      ),

      // Loading State
      generating && React.createElement(
        'div',
        { className: 'flex items-center justify-center space-x-2 py-4' },
        React.createElement(
          'div',
          { className: 'flex items-center space-x-1' },
          [0, 1, 2].map(i => React.createElement('span', {
            key: i,
            className: 'loading-dot w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]',
            style: { animationDelay: `${i * 0.15}s` }
          }))
        ),
        React.createElement('span', { className: 'text-sm text-gray-600 dark:text-[#b0b8c2]' }, getLoadingMessage())
      )
    )
    )
  );
};

export default Generator;