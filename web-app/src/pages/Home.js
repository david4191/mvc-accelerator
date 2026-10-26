import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Mic, ArrowRight, X, Loader2, Clock,
  Copy, Check, File, ArrowUp, Trash2,
  RotateCw, Pencil, Bot, Save, MoreVertical,
  Brain, Gem, Database, Palette, FileCode,
  Code2, BookOpen, Layers
} from 'lucide-react';
import { generatePreview } from '../services/api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { memo } from 'react';
import useStagedReveal from '../hooks/useStagedReveal';

// ==================== MEMOIZED COMPONENTS ====================

// Memoized Code Block component with minimal copy button - NO BLACK BACKGROUNDS
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
    { className: 'relative group my-4' },
    React.createElement(
      'button',
      {
        onClick: handleCopy,
        className: 'absolute top-2 right-2 p-1.5 bg-white dark:bg-[#1a1d23] text-gray-500 dark:text-[#9aa3af] rounded hover:bg-gray-100 dark:hover:bg-[#242933] transition-all duration-200 opacity-0 group-hover:opacity-100 z-10 border border-gray-200 dark:border-[#2d333d] shadow-sm'
      },
      copied
        ? React.createElement(Check, { size: 12, className: 'text-green-600' })
        : React.createElement(Copy, { size: 12 })
    ),
    React.createElement(
      SyntaxHighlighter,
      {
        style: theme === 'dark' ? oneDark : oneLight,
        language: language,
        PreTag: 'div',
        className: 'rounded-xl !mt-0 !mb-0 border border-gray-200 dark:border-[#2d333d] bg-white dark:bg-[#1a1d23] text-sm'
      },
      code
    )
  );
});

// Memoized File component - NO BLACK BACKGROUNDS
const FILE_ICONS = {
  php: { icon: Code2, color: '#777BB4' },
  javascript: { icon: Code2, color: '#F0DB4F' },
  html: { icon: Code2, color: '#E34C26' },
  css: { icon: Palette, color: '#2965F1' },
  sql: { icon: Database, color: '#00758F' },
  markdown: { icon: FileCode, color: '#6b7280' },
  bash: { icon: File, color: '#4A5C3A' }
};

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
    { className: 'bg-white dark:bg-[#1a1d23] rounded-xl overflow-hidden border border-gray-200 dark:border-[#2d333d] shadow-sm mb-2' },
    React.createElement(
      'div',
      {
        onClick: onToggle,
        className: 'flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0f1115] transition-colors bg-white dark:bg-[#1a1d23]'
      },
      React.createElement(
        'div',
        { className: 'flex items-center space-x-2' },
        React.createElement(FileIcon, { size: '1em', className: 'text-sm', style: { color: fileIconColor } }),
        React.createElement('span', { className: 'font-mono text-sm font-medium text-gray-700 dark:text-[#d1d5db]' }, filename)
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
          React.createElement(Copy, { size: 12 })
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

// Memoized Action Bar
const ActionBar = memo(({ onRegenerate, onCopy, isRetrying }) => {
  const [showActions, setShowActions] = useState(false);
  
  return React.createElement(
    'div',
    { className: 'absolute top-3 right-3 flex items-center space-x-1 z-10' },
    
    React.createElement(
      'button',
      {
        onClick: onCopy,
        className: 'p-1.5 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)] rounded-lg hover:bg-gray-100 dark:hover:bg-[#242933] transition-all duration-200',
        title: 'Copy response'
      },
      React.createElement(Copy, { size: 14 })
    ),
    
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement(
        'button',
        {
          onClick: () => setShowActions(!showActions),
          className: 'p-1.5 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)] rounded-lg hover:bg-gray-100 dark:hover:bg-[#242933] transition-all duration-200',
          title: 'More actions'
        },
        React.createElement(MoreVertical, { size: 14 })
      ),
      
      showActions && React.createElement(
        'div',
        { className: 'absolute right-0 mt-1 w-32 bg-white dark:bg-[#1a1d23] rounded-lg shadow-lg border border-gray-200 dark:border-[#2d333d] py-1 z-20' },
        React.createElement(
          'button',
          {
            onClick: () => {
              onRegenerate();
              setShowActions(false);
            },
            disabled: isRetrying,
            className: 'w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-[#d1d5db] hover:bg-gray-50 dark:hover:bg-[#0f1115] flex items-center space-x-2 disabled:opacity-50'
          },
          isRetrying 
            ? React.createElement(Loader2, { size: 12, className: 'animate-spin' })
            : React.createElement(RotateCw, { size: 12 }),
          React.createElement('span', null, 'Regenerate')
        )
      )
    )
  );
});

// Memoized AI Response component - NO BLACK BACKGROUNDS
const AIResponse = memo(({
  entry,
  onRegenerate,
  onCopy,
  isRetrying,
  copiedCode,
  onCopyCode,
  animate,
  onRevealDone
}) => {
  const [expandedFiles, setExpandedFiles] = useState({});
  const { theme } = useTheme();

  const toggleFile = useCallback((filename) => {
    setExpandedFiles(prev => ({ ...prev, [filename]: !prev[filename] }));
  }, []);

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

  const handleCopyFile = useCallback((filename, code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${filename}`);
  }, []);

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
              className: 'absolute top-2 right-2 p-1 bg-white dark:bg-[#1a1d23] text-gray-500 dark:text-[#9aa3af] rounded hover:bg-gray-100 dark:hover:bg-[#242933] transition-all duration-200 opacity-0 group-hover:opacity-100 z-10 border border-gray-200 dark:border-[#2d333d] shadow-sm'
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
      
      return React.createElement(
        'code',
        Object.assign({
          className: 'bg-gray-100 dark:bg-[#242933] text-gray-800 dark:text-[#f3f4f6] px-1 py-0.5 rounded text-xs'
        }, props),
        children
      );
    },
    
    pre: ({ children }) => React.createElement(
      'pre',
      { className: 'bg-white dark:bg-[#1a1d23] p-3 rounded-lg overflow-x-auto border border-gray-200 dark:border-[#2d333d] text-sm text-gray-800 dark:text-[#f3f4f6]' },
      children
    ),
    
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
    { className: `bg-white dark:bg-[#1a1d23] rounded-xl shadow-md p-5 border ${entry.isError ? 'border-red-200' : 'border-gray-200 dark:border-[#2d333d]'} relative hover:shadow-lg transition-shadow` },
    
    React.createElement(ActionBar, {
      onRegenerate: () => onRegenerate(entry),
      onCopy: () => onCopy(entry),
      isRetrying: isRetrying
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

    React.createElement(
      'div',
      { className: 'mt-1 prose prose-sm max-w-none chat-bubble-tail' },
      // Always show the full narrative (framing, structure breakdown, schema,
      // code, setup) - it's the source of truth regardless of whether file
      // extraction below also found individually-named files.
      React.createElement(
        'div',
        { className: entry.isError ? 'text-red-600' : 'text-gray-700 dark:text-[#d1d5db]' },
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
        { className: 'space-y-2 mt-6 animate-revealIn' },
        React.createElement('h3', { className: 'text-base font-semibold text-[color:var(--accent)] mb-3 flex items-center' },
          React.createElement(File, { size: '1em', className: 'mr-2 text-sm' }), 'Quick File Browser'
        ),
        fileEntries.map(([filename, code]) =>
          React.createElement(FileItem, {
            key: filename,
            filename: filename,
            code: code,
            isExpanded: expandedFiles[filename],
            onToggle: () => toggleFile(filename),
            onCopy: () => handleCopyFile(filename, code)
          })
        )
      )
    )
  );
});

// ==================== MAIN HOME COMPONENT ====================
const Home = () => {
  const [prompt, setPrompt] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [retryingId, setRetryingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('deepseek');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [animatingIds, setAnimatingIds] = useState(() => new Set());
  const [viewingNew, setViewingNew] = useState(false);

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

  const answersEndRef = useRef(null);
  const textareaRef = useRef(null);
  const formRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const entryRefs = useRef(new Map());

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const showLimitToast = useCallback((reason, serverMessage) => {
    const isGuest = reason === 'guest_limit';
    const message = reason === 'guest_limit'
      ? "You've used your 2 free trial responses. Sign in or sign up to keep going."
      : reason === 'free_limit'
        ? "You've used all 10 free responses for today. Upgrade to Premium for unlimited access."
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

  // Expanded AI Models
  const aiModels = useMemo(() => [
    { id: 'deepseek', name: 'DeepSeek', description: 'Fast, good for most tasks', icon: Bot, color: '#4A5C3A' },
    { id: 'openai', name: 'ChatGPT', description: 'High quality, detailed', icon: Brain, color: '#F59E0B' },
    { id: 'gemini', name: 'Gemini', description: 'Balanced performance', icon: Gem, color: '#8B5CF6' }
  ], []);

  // Load data on mount
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      setShowWelcomeModal(true);
      localStorage.setItem('hasSeenWelcome', 'true');
    }
    
    const savedHistory = localStorage.getItem('homeConversationHistory');
    if (savedHistory) {
      try {
        setConversationHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load conversation history:', e);
      }
    }
    
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  // Save to localStorage with debounce
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (conversationHistory.length > 0) {
        localStorage.setItem('homeConversationHistory', JSON.stringify(conversationHistory));
        window.dispatchEvent(new Event('conversation-history-changed'));
      }
    }, 1000);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [conversationHistory]);

  // "Start a new chat" from the sidebar should look fresh even if there's
  // saved history - don't delete the history, just don't show it right now.
  useEffect(() => {
    if (!location.state?.newChat) return;
    setViewingNew(true);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.newChat]);

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

  useEffect(() => {
    localStorage.setItem('selectedModel', selectedModel);
  }, [selectedModel]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (conversationHistory.length > 0 && answersEndRef.current) {
      answersEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationHistory.length]);

  // Auto-grow the prompt textarea as the user types, capped before it needs internal scroll
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const maxHeight = 240;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [prompt]);

  const getLoadingMessage = useCallback(() => {
    if (!loadingStartTime) return 'Processing...';
    
    const elapsedSeconds = Math.floor((Date.now() - loadingStartTime) / 1000);
    
    if (elapsedSeconds < 10) return 'Thinking...';
    if (elapsedSeconds < 20) return 'Still working...';
    if (elapsedSeconds < 30) return 'Almost there...';
    return 'Just a moment...';
  }, [loadingStartTime]);

  const handleCopyEntry = useCallback(async (entry) => {
    const content = typeof entry.response === 'string' ? entry.response : JSON.stringify(entry.response, null, 2);
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied!');
    } catch {
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

  const handleRegenerate = useCallback(async (entry) => {
    setRetryingId(entry.id);
    setLoading(true);
    setLoadingStartTime(Date.now());

    try {
      const response = await generatePreview(entry.prompt, entry.model || selectedModel);
      
      setConversationHistory(prev => 
        prev.map(item => 
          item.id === entry.id 
            ? {
                ...item,
                response: response.answer || response,
                type: response.type || 'answer',
                files: response.files || {},
                timestamp: new Date().toISOString(),
                isError: false,
                model: response.model || entry.model
              }
            : item
        )
      );
      markAnimating(entry.id);

      toast.success('Regenerated!');
      
    } catch (error) {
      toast.error(error.message || 'Failed');
      setConversationHistory(prev => 
        prev.map(item => 
          item.id === entry.id 
            ? { ...item, isError: true, timestamp: new Date().toISOString() }
            : item
        )
      );
    } finally {
      setRetryingId(null);
      setLoading(false);
      setLoadingStartTime(null);
    }
  }, [selectedModel]);

  const handleEdit = useCallback((entry) => {
    setEditingId(entry.id);
    setEditPrompt(entry.prompt);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditPrompt('');
  }, []);

  const handleSubmitEdit = useCallback(async (entry) => {
    if (!editPrompt.trim()) {
      toast.error('Please enter your question');
      return;
    }

    setRetryingId(entry.id);
    setLoading(true);
    setLoadingStartTime(Date.now());

    try {
      const response = await generatePreview(editPrompt, entry.model || selectedModel);
      
      setConversationHistory(prev => 
        prev.map(item => 
          item.id === entry.id 
            ? {
                ...item,
                prompt: editPrompt,
                response: response.answer || response,
                type: response.type || 'answer',
                files: response.files || {},
                timestamp: new Date().toISOString(),
                isError: false,
                model: response.model || entry.model
              }
            : item
        )
      );
      markAnimating(entry.id);

      setEditingId(null);
      setEditPrompt('');
      toast.success('Updated!');
      
    } catch (error) {
      toast.error(error.message || 'Failed');
    } finally {
      setRetryingId(null);
      setLoading(false);
      setLoadingStartTime(null);
    }
  }, [editPrompt, selectedModel]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      toast.error('Please enter your question');
      return;
    }

    setLoading(true);
    setLoadingStartTime(Date.now());
    setViewingNew(false);

    const currentPrompt = prompt;
    const currentModel = selectedModel;
    setPrompt('');

    try {
      const response = await generatePreview(currentPrompt, currentModel);

      const newEntry = {
        id: Date.now(),
        prompt: currentPrompt,
        response: response.answer || response,
        type: response.type || 'answer',
        files: response.files || {},
        timestamp: new Date().toISOString(),
        model: response.model || currentModel
      };
      
      setConversationHistory(prev => [...prev, newEntry]);
      markAnimating(newEntry.id);

    } catch (error) {
      if (error.data?.limitReached) {
        setPrompt(currentPrompt);
        showLimitToast(error.data.reason, error.data.error);
      } else {
        toast.error(error.message || 'Failed');

        const errorEntry = {
          id: Date.now(),
          prompt: currentPrompt,
          response: `**Error:** ${error.message || 'Failed to generate'}`,
          type: 'answer',
          timestamp: new Date().toISOString(),
          isError: true,
          model: currentModel
        };

        setConversationHistory(prev => [...prev, errorEntry]);
      }
    } finally {
      setLoading(false);
      setLoadingStartTime(null);
    }
  }, [prompt, selectedModel, showLimitToast]);

  const clearHistory = useCallback(() => {
    if (window.confirm('Clear all history?')) {
      setConversationHistory([]);
      localStorage.removeItem('homeConversationHistory');
      window.dispatchEvent(new Event('conversation-history-changed'));
      toast.success('History cleared');
    }
  }, []);

  const scrollToEntry = useCallback((id) => {
    entryRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ==================== RENDER ====================
  const isEmpty = viewingNew || conversationHistory.length === 0;

  const featureCards = [
    { icon: Code2, title: 'Instant Code', desc: 'Get a working PHP MVC project generated from a plain description in seconds.' },
    { icon: BookOpen, title: 'Clear Teaching', desc: 'Every generation comes with a friendly explanation of how the code works.' },
    { icon: Layers, title: 'Built to Scale', desc: 'A clean, conventional structure you can keep building on as your project grows.' }
  ];

  const modelSelector = React.createElement(
    'div',
    { className: 'relative' },
    React.createElement(
      'button',
      {
        onClick: () => setShowModelSelector(!showModelSelector),
        className: 'px-3 py-1.5 bg-white dark:bg-[#1a1d23] border border-gray-200 dark:border-[#2d333d] rounded-lg text-sm flex items-center space-x-1 hover:border-[color:var(--accent)] transition-colors shadow-sm'
      },
      (() => {
        const currentModel = aiModels.find(m => m.id === selectedModel);
        const Icon = currentModel?.icon || Bot;
        return React.createElement(Icon, { size: '1em', className: 'text-[color:var(--accent)] text-xs' });
      })(),
      React.createElement('span', { className: 'ml-1' }, aiModels.find(m => m.id === selectedModel)?.name || 'Select')
    ),
    showModelSelector && React.createElement(
      'div',
      { className: 'absolute right-0 mt-1 w-48 bg-white dark:bg-[#1a1d23] rounded-lg shadow-lg border border-gray-200 dark:border-[#2d333d] py-1 z-50' },
      aiModels.map(model => {
        const Icon = model.icon;
        return React.createElement(
          'button',
          {
            key: model.id,
            onClick: () => {
              setSelectedModel(model.id);
              setShowModelSelector(false);
            },
            className: `w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#0f1115] flex items-center space-x-2 ${
              selectedModel === model.id ? 'bg-[color:var(--accent)]/5 text-[color:var(--accent)]' : 'text-gray-700 dark:text-[#d1d5db]'
            }`
          },
          React.createElement(Icon, { size: '1em', className: 'text-xs', style: { color: model.color } }),
          React.createElement('span', null, model.name)
        );
      })
    )
  );

  const inputForm = React.createElement(
    'form',
    {
      ref: formRef,
      onSubmit: handleSubmit,
      className: isEmpty
        ? 'relative flex items-center bg-white/90 dark:bg-white/5 rounded-full shadow-lg border border-gray-200 dark:border-white/10 pl-5 pr-2 py-2'
        : 'sticky bottom-4 bg-white dark:bg-[#1a1d23] rounded-lg shadow-md border border-gray-200 dark:border-[#2d333d]'
    },
    React.createElement('textarea', {
      ref: textareaRef,
      value: prompt,
      onChange: (e) => setPrompt(e.target.value),
      placeholder: isEmpty ? 'Example: "Build a blog with user comments"' : 'Ask a question...',
      rows: '1',
      className: isEmpty
        ? 'flex-1 bg-transparent focus:outline-none resize-none text-sm py-1.5'
        : 'w-full px-4 py-3 pr-20 border-0 rounded-lg focus:outline-none resize-none text-sm'
    }),
    isEmpty
      ? React.createElement(
          'button',
          {
            type: 'submit',
            disabled: loading,
            className: 'shrink-0 w-9 h-9 flex items-center justify-center bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)] text-white rounded-full transition-colors disabled:opacity-50'
          },
          loading ? React.createElement(Loader2, { size: 14, className: 'animate-spin' }) : React.createElement(ArrowRight, { size: 14 })
        )
      : React.createElement(
          'div',
          { className: 'absolute bottom-2 right-2 flex items-center space-x-1' },
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
              disabled: loading,
              className: 'p-2 bg-[color:var(--accent)] text-white rounded-md hover:bg-[color:var(--accent-hover)] disabled:opacity-50 transition-colors'
            },
            loading ? React.createElement(Loader2, { size: 14, className: 'animate-spin' }) : React.createElement(ArrowRight, { size: 14 })
          )
        )
  );

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent pb-32 relative' },

    conversationHistory.length > 0 && React.createElement(
      'button',
      {
        onClick: scrollToTop,
        className: 'fixed bottom-20 right-4 p-2 bg-[color:var(--accent)] text-white rounded-full shadow-md hover:bg-[color:var(--accent-hover)] transition-all z-40'
      },
      React.createElement(ArrowUp, { size: 16 })
    ),

    React.createElement(
      'div',
      { className: 'pt-8 px-4' },
      React.createElement(
        'div',
        { className: 'container mx-auto max-w-3xl' },

        isEmpty
          ? React.createElement(
              'div',
              { className: 'text-center pt-10 pb-4' },
              React.createElement(
                'h1',
                { className: 'text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-3' },
                'Welcome to ',
                React.createElement('span', { className: 'inline-block bg-[color:var(--accent)] text-white px-2 rounded-lg' }, 'MVC Accelerator')
              ),
              React.createElement(
                'p',
                { className: 'text-sm md:text-base text-gray-500 dark:text-gray-400 mb-6' },
                "Describe your idea, and we'll generate the code and teach you how it works."
              ),
              React.createElement(
                'div',
                { className: 'flex justify-center mb-6' },
                modelSelector
              )
            )
          : React.createElement(
              'div',
              { className: 'flex items-center justify-between mb-6' },
              React.createElement(
                'h1',
                { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6]' },
                'MVC Accelerator'
              ),
              React.createElement(
                'div',
                { className: 'flex items-center space-x-2' },

                // Model Selector
                modelSelector,

                // Clear History Button
                React.createElement(
                  'button',
                  {
                    onClick: clearHistory,
                    className: 'p-1.5 text-gray-400 dark:text-[#7b8494] hover:text-red-500 transition-colors'
                  },
                  React.createElement(Trash2, { size: 14 })
                )
              )
            ),

        !isEmpty && React.createElement(
          'div',
          { className: 'mb-6 space-y-6' },
          conversationHistory.map((entry) =>
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
                  editingId === entry.id
                    ? React.createElement(
                        'div',
                        { className: 'flex space-x-1 ml-2' },
                        React.createElement(
                          'button',
                          { onClick: handleCancelEdit, className: 'p-1 text-gray-400 dark:text-[#7b8494] hover:text-red-500' },
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
                      )
                    : React.createElement(
                        'button',
                        { onClick: () => handleEdit(entry), className: 'p-1 text-gray-400 dark:text-[#7b8494] hover:text-[color:var(--accent)]' },
                        React.createElement(Pencil, { size: 12 })
                      )
                ),

                editingId === entry.id && React.createElement('textarea', {
                  value: editPrompt,
                  onChange: (e) => setEditPrompt(e.target.value),
                  className: 'w-full mt-2 p-2 text-sm border border-[color:var(--accent)] rounded-lg',
                  rows: 2
                }),

                React.createElement(
                  'div',
                  { className: 'flex justify-between items-center mt-1' },
                  React.createElement(
                    'div',
                    { className: 'flex items-center space-x-1 text-xs text-gray-400 dark:text-[#7b8494]' },
                    React.createElement(Bot, { size: 10 }),
                    React.createElement('span', null, aiModels.find(m => m.id === entry.model)?.name || entry.model || 'DeepSeek')
                  ),
                  React.createElement('span', { className: 'text-xs text-gray-400 dark:text-[#7b8494]' },
                    new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  )
                )
              ),

              // AI Response
              React.createElement(AIResponse, {
                entry: entry,
                onRegenerate: handleRegenerate,
                onCopy: handleCopyEntry,
                isRetrying: retryingId === entry.id,
                copiedCode: copiedCode,
                onCopyCode: handleCopyCode,
                animate: animatingIds.has(entry.id),
                onRevealDone: () => handleRevealDone(entry.id)
              })
            )
          ),
          React.createElement('div', { ref: answersEndRef })
        ),

        inputForm,

        isEmpty && React.createElement(
          'div',
          { className: 'grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-10 text-center' },
          featureCards.map((card, idx) => React.createElement(
            'div',
            { key: idx },
            React.createElement(card.icon, { className: 'mx-auto text-xl text-gray-400 dark:text-gray-500 mb-3' }),
            React.createElement('h3', { className: 'text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1' }, card.title),
            React.createElement('p', { className: 'text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-[220px] mx-auto' }, card.desc)
          ))
        ),

        // Loading indicator
        loading && React.createElement(
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
        ),

        // Welcome Modal
        showWelcomeModal && React.createElement(
          'div',
          { className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4' },
          React.createElement(
            'div',
            { className: 'bg-white dark:bg-[#1a1d23] rounded-lg p-6 max-w-sm w-full relative' },
            React.createElement(
              'button',
              { onClick: () => setShowWelcomeModal(false), className: 'absolute top-3 right-3 text-gray-400 dark:text-[#7b8494] hover:text-gray-600 dark:text-[#b0b8c2]' },
              React.createElement(X, { size: 16 })
            ),
            React.createElement('h3', { className: 'text-lg font-bold text-[color:var(--accent)] mb-3' }, 'Welcome!'),
            React.createElement('p', { className: 'text-sm text-gray-600 dark:text-[#b0b8c2] mb-4' }, 'Your AI development assistant'),
            React.createElement(
              'button',
              {
                onClick: () => setShowWelcomeModal(false),
                className: 'w-full py-2 bg-[color:var(--accent)] text-white rounded-md text-sm hover:bg-[color:var(--accent-hover)] transition-colors'
              },
              'Get Started'
            )
          )
        )
      )
    )
  );
};

export default Home;