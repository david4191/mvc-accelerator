import React, { useState } from 'react';
import {
  BookOpen, Rocket, Code2, ListChecks, History, ShieldCheck,
  Puzzle, ScanSearch, Timer, ArrowRight, Lock, KeyRound,
  Globe, Database, Trash2, Gauge, CheckCircle2
} from 'lucide-react';

const sections = [
  {
    title: 'Getting Started',
    icon: Rocket,
    content: [
      'Create a free account to get a 48-hour full-access trial, no card required',
      'Describe what you want to build in plain English from the Generator page',
      'Choose MVC, Laravel, Symfony, CodeIgniter, or a custom structure',
      'Pick a PHP version from 7.4 through 8.3',
      'Pick DeepSeek, ChatGPT, or Gemini as the generating model'
    ]
  },
  {
    title: 'AI Code Generation',
    icon: Code2,
    content: [
      'A single request returns a complete, working file structure, not snippets',
      'Every generated file comes with its own plain-language explanation',
      'Regenerating or editing a project updates that same project in place',
      'Up to 3 regenerations per response before you are guided to describe the change instead'
    ]
  },
  {
    title: 'Bulk & Plan Builds',
    icon: ListChecks,
    content: [
      'For large projects, "Plan a build" breaks the work into a foundation plus modules',
      'The foundation (layout, database connection, shared styles) is built first',
      'Each module is generated separately so it is never capped by a single response size',
      'Later modules automatically reuse the foundation\'s structure, styling, and tables'
    ]
  },
  {
    title: 'Continue Building',
    icon: History,
    content: [
      'Every project keeps a running file manifest across all of its generations',
      'Open any past project and continue adding to it instead of starting over',
      'New files are merged in, and any file that gets replaced is flagged before you move on',
      'Deleting a project is a soft delete: it disappears from your list but is not destroyed'
    ]
  },
  {
    title: 'VS Code Extension',
    icon: Puzzle,
    content: [
      'Sign in from the Command Palette with "MVC Accelerator: Login"',
      'Browse your projects in the Explorer sidebar under MVC Accelerator Projects',
      'Plan or continue a build without leaving the editor',
      'Sync generated files to your workspace with built-in conflict review, nothing is overwritten silently'
    ]
  },
  {
    title: 'Project Scanner',
    icon: ScanSearch,
    content: [
      'Scans an existing PHP project you point it at for issues',
      'Flags common security and syntax problems',
      'Keeps a history of past scans per project',
      'Requires an active subscription'
    ]
  }
];

const securityPoints = [
  {
    icon: KeyRound,
    title: 'Authentication',
    body: 'Sessions use signed JWT bearer tokens, verified with a constant-time signature check on every request. Sessions expire after 6 hours; a refresh token lasts 7 days. Passwords are hashed with bcrypt, never stored in plain text.'
  },
  {
    icon: Lock,
    title: 'Brute-force protection',
    body: 'Login is limited to 5 attempts per account and IP before a 15-minute lockout. Registration is capped at 5 attempts per hour per IP.'
  },
  {
    icon: Globe,
    title: 'Transport & headers',
    body: 'The API only accepts cross-origin requests from the official app domain. Every response carries a Content-Security-Policy, HSTS, X-Frame-Options, and X-Content-Type-Options header.'
  },
  {
    icon: ShieldCheck,
    title: 'Access control',
    body: 'Every project, file, and generation lookup checks server-side that the requesting account actually owns that record, not just that it holds a valid token.'
  },
  {
    icon: Trash2,
    title: 'Data handling',
    body: 'Deleting a project is a soft delete: the record is deactivated and removed from your view, never hard-deleted outright.'
  },
  {
    icon: Database,
    title: 'Database access',
    body: 'All database queries use parameterized statements, so user input is never concatenated directly into SQL.'
  },
  {
    icon: Gauge,
    title: 'Abuse prevention',
    body: 'Guest previews are capped at 2 per day by IP, free accounts at 10 generations per day, and premium models are gated behind an active subscription.'
  }
];

const apiGroups = [
  {
    name: 'Authentication',
    endpoints: [
      { method: 'POST', path: '/register', auth: false, desc: 'Create a new account' },
      { method: 'POST', path: '/login', auth: false, desc: 'Authenticate and receive a session token' },
      { method: 'POST', path: '/logout', auth: false, desc: 'Invalidate the current session' },
      { method: 'POST', path: '/refresh-token', auth: false, desc: 'Exchange a refresh token for a new session' },
      { method: 'POST', path: '/forgot-password', auth: false, desc: 'Request a password reset email' },
      { method: 'POST', path: '/reset-password', auth: false, desc: 'Complete a password reset' }
    ]
  },
  {
    name: 'Projects',
    endpoints: [
      { method: 'GET', path: '/projects', auth: true, desc: 'List your projects' },
      { method: 'GET', path: '/projects/{id}', auth: true, desc: 'Get one project and its generation history' },
      { method: 'POST', path: '/projects', auth: true, desc: 'Create a project' },
      { method: 'PUT', path: '/projects/{id}', auth: true, desc: 'Update a project' },
      { method: 'DELETE', path: '/projects/{id}', auth: true, desc: 'Soft-delete a project' },
      { method: 'GET', path: '/projects/{id}/files', auth: true, desc: 'Get the accumulated file manifest' },
      { method: 'POST', path: '/projects/{id}/scan', auth: true, desc: 'Scan a project for issues (subscription required)' }
    ]
  },
  {
    name: 'Generation',
    endpoints: [
      { method: 'POST', path: '/generate', auth: true, desc: 'Generate or continue a project from a prompt' },
      { method: 'POST', path: '/generate/plan', auth: true, desc: 'Break a large build into a foundation and modules' },
      { method: 'POST', path: '/generate/preview', auth: false, desc: 'Ask a question or try a generation without an account (rate-limited by IP)' },
      { method: 'GET', path: '/generations', auth: true, desc: 'List past generations' }
    ]
  },
  {
    name: 'Subscription',
    endpoints: [
      { method: 'GET', path: '/plans', auth: false, desc: 'List available plans' },
      { method: 'GET', path: '/subscription/status', auth: true, desc: 'Get current subscription status' },
      { method: 'POST', path: '/subscription/verify', auth: true, desc: 'Verify a completed payment' },
      { method: 'POST', path: '/subscription/cancel', auth: true, desc: 'Cancel the active subscription' },
      { method: 'GET', path: '/subscription/billing-history', auth: true, desc: 'List past billing records' }
    ]
  }
];

const methodColor = {
  GET: 'bg-blue-500',
  POST: 'bg-[color:var(--accent)]',
  PUT: 'bg-amber-500',
  DELETE: 'bg-red-500'
};

const Documentation = () => {
  const [activeGroup, setActiveGroup] = useState(apiGroups[0].name);

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] py-20' },
    React.createElement(
      'div',
      { className: 'container mx-auto px-4 max-w-5xl' },

      // Header
      React.createElement(
        'div',
        { className: 'text-center mb-12' },
        React.createElement(
          'div',
          { className: 'inline-flex items-center justify-center w-16 h-16 bg-[color:var(--accent)]/10 rounded-full mb-4' },
          React.createElement(BookOpen, { size: 28, className: 'text-[color:var(--accent)]' })
        ),
        React.createElement(
          'h1',
          { className: 'text-4xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-4' },
          'Documentation'
        ),
        React.createElement(
          'p',
          { className: 'text-xl text-gray-600 dark:text-[#b0b8c2]' },
          'How MVC Accelerator works, and how it keeps your account and projects safe'
        )
      ),

      // Quick Start
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl shadow-sm border border-gray-200 dark:border-[#2d333d] p-8 mb-12' },
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-4 flex items-center' },
          React.createElement(Rocket, { size: 20, className: 'text-[color:var(--accent)] mr-3' }),
          'Quick Start'
        ),
        React.createElement(
          'ol',
          { className: 'list-decimal list-inside space-y-3 text-gray-600 dark:text-[#b0b8c2]' },
          React.createElement('li', { className: 'text-sm' }, 'Sign up for a free account and get a 48-hour full-access trial'),
          React.createElement('li', { className: 'text-sm' }, 'Describe what you want to build, for example "a blog with user authentication"'),
          React.createElement('li', { className: 'text-sm' }, 'For a large project, click "Plan a build" to break it into a foundation and modules'),
          React.createElement('li', { className: 'text-sm' }, 'Review the generated files, then download them or sync to a workspace with the VS Code extension'),
          React.createElement('li', { className: 'text-sm' }, 'Come back any time and continue building the same project from where you left off')
        )
      ),

      // Features Grid
      React.createElement(
        'div',
        { className: 'grid md:grid-cols-2 gap-6 mb-12' },
        sections.map((section) => {
          const Icon = section.icon;
          return React.createElement(
            'div',
            { key: section.title, className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] p-6 hover:shadow-md transition-all duration-300 hover:border-[color:var(--accent)]/30' },
            React.createElement(
              'div',
              { className: 'flex items-center mb-4' },
              React.createElement(
                'div',
                { className: 'w-10 h-10 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center mr-3' },
                React.createElement(Icon, { size: 18, className: 'text-[color:var(--accent)]' })
              ),
              React.createElement(
                'h3',
                { className: 'text-lg font-bold text-gray-800 dark:text-[#f3f4f6]' },
                section.title
              )
            ),
            React.createElement(
              'ul',
              { className: 'space-y-2' },
              section.content.map((item, index) =>
                React.createElement(
                  'li',
                  { key: index, className: 'text-gray-600 dark:text-[#b0b8c2] text-sm flex items-start' },
                  React.createElement(ArrowRight, { size: 12, className: 'text-[color:var(--accent)] mr-2 mt-1 shrink-0' }),
                  item
                )
              )
            )
          );
        })
      ),

      // Security
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] p-8 mb-12' },
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2 flex items-center' },
          React.createElement(ShieldCheck, { size: 20, className: 'text-[color:var(--accent)] mr-3' }),
          'Security'
        ),
        React.createElement(
          'p',
          { className: 'text-sm text-gray-500 dark:text-[#9aa3af] mb-6' },
          'A practical summary of what protects your account and data. None of this depends on the API paths below staying secret.'
        ),
        React.createElement(
          'div',
          { className: 'grid md:grid-cols-2 gap-5' },
          securityPoints.map((point) => {
            const Icon = point.icon;
            return React.createElement(
              'div',
              { key: point.title, className: 'flex items-start' },
              React.createElement(
                'div',
                { className: 'w-9 h-9 shrink-0 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center mr-3' },
                React.createElement(Icon, { size: 16, className: 'text-[color:var(--accent)]' })
              ),
              React.createElement(
                'div',
                null,
                React.createElement('h4', { className: 'text-sm font-semibold text-gray-800 dark:text-[#f3f4f6] mb-1' }, point.title),
                React.createElement('p', { className: 'text-sm text-gray-600 dark:text-[#b0b8c2]' }, point.body)
              )
            );
          })
        )
      ),

      // API Reference
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] p-8' },
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2 flex items-center' },
          React.createElement(Timer, { size: 20, className: 'text-[color:var(--accent)] mr-3' }),
          'API Reference'
        ),
        React.createElement(
          'p',
          { className: 'text-sm text-gray-500 dark:text-[#9aa3af] mb-6' },
          'Base URL: ',
          React.createElement('code', { className: 'font-mono text-[color:var(--accent)]' }, 'https://mvc-accelerator.onrender.com/api'),
          '. Endpoints marked "Auth" require a bearer token from /login; everything else is either public by design or rate-limited by IP.'
        ),

        // Group tabs
        React.createElement(
          'div',
          { className: 'flex flex-wrap gap-2 mb-5' },
          apiGroups.map((group) =>
            React.createElement(
              'button',
              {
                key: group.name,
                onClick: () => setActiveGroup(group.name),
                className: `px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  activeGroup === group.name
                    ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)]'
                    : 'border-gray-200 dark:border-[#2d333d] text-gray-600 dark:text-[#b0b8c2] hover:border-[color:var(--accent)]/50'
                }`
              },
              group.name
            )
          )
        ),

        React.createElement(
          'div',
          { className: 'space-y-2' },
          apiGroups
            .find((g) => g.name === activeGroup)
            .endpoints.map((endpoint) =>
              React.createElement(
                'div',
                { key: endpoint.method + endpoint.path, className: 'flex items-center p-3 bg-gray-50 dark:bg-[#0f1115] rounded-lg hover:bg-gray-100 dark:hover:bg-[#242933] transition-colors' },
                React.createElement(
                  'span',
                  { className: `px-2 py-1 ${methodColor[endpoint.method]} text-white text-xs rounded mr-3 w-16 text-center font-mono shrink-0` },
                  endpoint.method
                ),
                React.createElement(
                  'code',
                  { className: 'text-[color:var(--accent)] font-mono text-sm mr-4 shrink-0' },
                  endpoint.path
                ),
                React.createElement(
                  'span',
                  { className: 'text-gray-600 dark:text-[#b0b8c2] text-sm flex-1' },
                  endpoint.desc
                ),
                endpoint.auth
                  ? React.createElement(
                      'span',
                      { className: 'flex items-center text-xs text-gray-400 dark:text-[#7b8494] shrink-0' },
                      React.createElement(Lock, { size: 11, className: 'mr-1' }),
                      'Auth'
                    )
                  : React.createElement(
                      'span',
                      { className: 'flex items-center text-xs text-gray-400 dark:text-[#7b8494] shrink-0' },
                      React.createElement(CheckCircle2, { size: 11, className: 'mr-1' }),
                      'Public'
                    )
              )
            )
        )
      )
    )
  );
};

export default Documentation;
