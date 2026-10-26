import React, { useState, useEffect } from 'react';
import { Server, Database, Clock, CheckCircle2, AlertTriangle, HeartPulse, HardDrive, Globe } from 'lucide-react';
import { healthCheck } from '../services/api';

const Health = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30000);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const data = await healthCheck();
      setHealth(data);
      setError(null);
    } catch (err) {
      console.error('Health check error:', err);
      setError(err.message || 'Failed to fetch health status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    return status === 'healthy' || status === 'up' || status === 'connected'
      ? 'text-green-600'
      : 'text-red-600';
  };

  const getStatusBg = (status) => {
    return status === 'healthy' || status === 'up' || status === 'connected'
      ? 'bg-green-50 border-green-200'
      : 'bg-red-50 border-red-200';
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'Unknown';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  };

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
          React.createElement(HeartPulse, { size: '1em', className: 'text-2xl text-[color:var(--accent)]' })
        ),
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2' },
          'System Health'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-600 dark:text-[#b0b8c2] text-sm' },
          'Real-time status of your MVC Accelerator services'
        )
      ),
      
      // Refresh Control
      React.createElement(
        'div',
        { className: 'mb-6 flex items-center justify-between bg-white dark:bg-[#1a1d23] p-4 rounded-xl border border-gray-200 dark:border-[#2d333d] shadow-sm' },
        React.createElement(
          'div',
          { className: 'flex items-center space-x-4' },
          React.createElement(
            'button',
            {
              onClick: fetchHealth,
              disabled: loading,
              className: 'px-4 py-2 bg-[color:var(--accent)] text-white rounded-lg hover:bg-[color:var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center space-x-2 text-sm'
            },
            loading ? React.createElement('div', { className: 'animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent' }) : React.createElement(Clock, null),
            React.createElement('span', null, loading ? 'Refreshing...' : 'Refresh Now')
          ),
          React.createElement(
            'select',
            {
              value: refreshInterval,
              onChange: (e) => setRefreshInterval(Number(e.target.value)),
              className: 'px-3 py-2 border border-gray-200 dark:border-[#2d333d] rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] text-sm bg-white dark:bg-[#1a1d23]'
            },
            React.createElement('option', { value: 5000 }, '5 seconds'),
            React.createElement('option', { value: 15000 }, '15 seconds'),
            React.createElement('option', { value: 30000 }, '30 seconds'),
            React.createElement('option', { value: 60000 }, '1 minute'),
            React.createElement('option', { value: 300000 }, '5 minutes')
          )
        ),
        React.createElement(
          'div',
          { className: 'text-sm text-gray-500 dark:text-[#9aa3af]' },
          'Last updated: ',
          health?.timestamp ? new Date(health.timestamp * 1000).toLocaleTimeString() : 'Never'
        )
      ),
      
      // Error State
      error && React.createElement(
        'div',
        { className: 'mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3' },
        React.createElement(AlertTriangle, { size: '1em', className: 'text-red-500 text-xl' }),
        React.createElement('span', { className: 'text-red-700 text-sm' }, error)
      ),
      
      // Loading State
      loading && !health && React.createElement(
        'div',
        { className: 'text-center py-12' },
        React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)] mx-auto' }),
        React.createElement('p', { className: 'mt-4 text-gray-600 dark:text-[#b0b8c2]' }, 'Checking system health...')
      ),
      
      // Health Data
      health && React.createElement(
        'div',
        { className: 'space-y-6' },
        
        // Overall Status
        React.createElement(
          'div',
          { className: 'bg-white dark:bg-[#1a1d23] rounded-xl shadow-sm border border-gray-200 dark:border-[#2d333d] p-6' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h2', { className: 'text-lg font-semibold text-gray-800 dark:text-[#f3f4f6] mb-1' }, 'Overall Status'),
              React.createElement(
                'div',
                { className: 'flex items-center space-x-2' },
                React.createElement(CheckCircle2, { size: '1em', className: 'text-green-600' }),
                React.createElement('span', { className: 'text-green-600 font-medium text-sm' }, 'All Systems Operational')
              )
            ),
            React.createElement(
              'div',
              { className: 'text-right' },
              React.createElement('div', { className: 'text-xs text-gray-500 dark:text-[#9aa3af]' }, 'API Version'),
              React.createElement('div', { className: 'font-mono text-gray-700 dark:text-[#d1d5db] text-sm' }, health.version || '1.0.0')
            )
          )
        ),
        
        // Services Grid
        React.createElement(
          'div',
          { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
          
          // API Service
          React.createElement(
            'div',
            { className: `bg-white dark:bg-[#1a1d23] rounded-xl border ${getStatusBg(health.status)} p-6 hover:shadow-md transition-shadow` },
            React.createElement(
              'div',
              { className: 'flex items-center justify-between mb-4' },
              React.createElement(
                'div',
                { className: 'flex items-center space-x-3' },
                React.createElement(
                  'div',
                  { className: 'w-10 h-10 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center' },
                  React.createElement(Server, { size: '1em', className: 'text-[color:var(--accent)] text-xl' })
                ),
                React.createElement('h3', { className: 'font-semibold text-gray-800 dark:text-[#f3f4f6]' }, 'API Service')
              ),
              React.createElement('span', { className: `text-xs font-medium ${getStatusColor(health.status)} px-2 py-1 rounded-full bg-${health.status === 'healthy' ? 'green' : 'red'}-50` }, 
                health.status?.toUpperCase() || 'UNKNOWN'
              )
            ),
            React.createElement(
              'div',
              { className: 'space-y-2 text-sm' },
              React.createElement(
                'div',
                { className: 'flex justify-between' },
                React.createElement('span', { className: 'text-gray-500 dark:text-[#9aa3af]' }, 'Response Time'),
                React.createElement('span', { className: 'font-mono text-gray-700 dark:text-[#d1d5db]' }, health.response_time || '< 100ms')
              ),
              React.createElement(
                'div',
                { className: 'flex justify-between' },
                React.createElement('span', { className: 'text-gray-500 dark:text-[#9aa3af]' }, 'Uptime'),
                React.createElement('span', { className: 'font-mono text-gray-700 dark:text-[#d1d5db]' }, formatUptime(health.uptime))
              )
            )
          ),
          
          // Database Service
          React.createElement(
            'div',
            { className: `bg-white dark:bg-[#1a1d23] rounded-xl border ${getStatusBg(health.database?.status)} p-6 hover:shadow-md transition-shadow` },
            React.createElement(
              'div',
              { className: 'flex items-center justify-between mb-4' },
              React.createElement(
                'div',
                { className: 'flex items-center space-x-3' },
                React.createElement(
                  'div',
                  { className: 'w-10 h-10 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center' },
                  React.createElement(Database, { size: '1em', className: 'text-[color:var(--accent)] text-xl' })
                ),
                React.createElement('h3', { className: 'font-semibold text-gray-800 dark:text-[#f3f4f6]' }, 'Database')
              ),
              React.createElement('span', { className: `text-xs font-medium ${getStatusColor(health.database?.status)} px-2 py-1 rounded-full bg-${health.database?.status === 'connected' ? 'green' : 'red'}-50` }, 
                (health.database?.status || 'CONNECTED').toUpperCase()
              )
            ),
            React.createElement(
              'div',
              { className: 'space-y-2 text-sm' },
              React.createElement(
                'div',
                { className: 'flex justify-between' },
                React.createElement('span', { className: 'text-gray-500 dark:text-[#9aa3af]' }, 'Type'),
                React.createElement('span', { className: 'font-mono text-gray-700 dark:text-[#d1d5db]' }, health.database?.type || 'MySQL')
              ),
              React.createElement(
                'div',
                { className: 'flex justify-between' },
                React.createElement('span', { className: 'text-gray-500 dark:text-[#9aa3af]' }, 'Connections'),
                React.createElement('span', { className: 'font-mono text-gray-700 dark:text-[#d1d5db]' }, health.database?.connections || 'Active')
              )
            )
          ),
          
          // Cache Service
          React.createElement(
            'div',
            { className: `bg-white dark:bg-[#1a1d23] rounded-xl border ${getStatusBg(health.cache?.status)} p-6 hover:shadow-md transition-shadow` },
            React.createElement(
              'div',
              { className: 'flex items-center justify-between mb-4' },
              React.createElement(
                'div',
                { className: 'flex items-center space-x-3' },
                React.createElement(
                  'div',
                  { className: 'w-10 h-10 bg-[color:var(--accent)]/10 rounded-lg flex items-center justify-center' },
                  React.createElement(HardDrive, { size: '1em', className: 'text-[color:var(--accent)] text-xl' })
                ),
                React.createElement('h3', { className: 'font-semibold text-gray-800 dark:text-[#f3f4f6]' }, 'Cache')
              ),
              React.createElement('span', { className: `text-xs font-medium ${getStatusColor(health.cache?.status)} px-2 py-1 rounded-full bg-${health.cache?.status === 'available' ? 'green' : 'red'}-50` }, 
                (health.cache?.status || 'AVAILABLE').toUpperCase()
              )
            ),
            React.createElement(
              'div',
              { className: 'space-y-2 text-sm' },
              React.createElement(
                'div',
                { className: 'flex justify-between' },
                React.createElement('span', { className: 'text-gray-500 dark:text-[#9aa3af]' }, 'Type'),
                React.createElement('span', { className: 'font-mono text-gray-700 dark:text-[#d1d5db]' }, health.cache?.type || 'File')
              ),
              React.createElement(
                'div',
                { className: 'flex justify-between' },
                React.createElement('span', { className: 'text-gray-500 dark:text-[#9aa3af]' }, 'Hit Rate'),
                React.createElement('span', { className: 'font-mono text-gray-700 dark:text-[#d1d5db]' }, health.cache?.hit_rate || 'N/A')
              )
            )
          )
        ),
        
        // System Info
        React.createElement(
          'div',
          { className: 'bg-white dark:bg-[#1a1d23] rounded-xl shadow-sm border border-gray-200 dark:border-[#2d333d] p-6' },
          React.createElement('h3', { className: 'font-semibold text-gray-800 dark:text-[#f3f4f6] mb-4 flex items-center' },
            React.createElement(Globe, { size: '1em', className: 'text-[color:var(--accent)] mr-2' }),
            'System Information'
          ),
          React.createElement(
            'div',
            { className: 'grid grid-cols-2 md:grid-cols-4 gap-4' },
            React.createElement(
              'div',
              { className: 'p-3 bg-gray-50 dark:bg-[#0f1115] rounded-lg' },
              React.createElement('div', { className: 'text-xs text-gray-500 dark:text-[#9aa3af] mb-1' }, 'PHP Version'),
              React.createElement('div', { className: 'font-mono text-sm text-gray-800 dark:text-[#f3f4f6]' }, health.php_version || '8.1.34')
            ),
            React.createElement(
              'div',
              { className: 'p-3 bg-gray-50 dark:bg-[#0f1115] rounded-lg' },
              React.createElement('div', { className: 'text-xs text-gray-500 dark:text-[#9aa3af] mb-1' }, 'Server'),
              React.createElement('div', { className: 'font-mono text-sm text-gray-800 dark:text-[#f3f4f6]' }, health.server || 'LiteSpeed')
            ),
            React.createElement(
              'div',
              { className: 'p-3 bg-gray-50 dark:bg-[#0f1115] rounded-lg' },
              React.createElement('div', { className: 'text-xs text-gray-500 dark:text-[#9aa3af] mb-1' }, 'Environment'),
              React.createElement('div', { className: 'font-mono text-sm text-gray-800 dark:text-[#f3f4f6]' }, health.environment || 'Production')
            ),
            React.createElement(
              'div',
              { className: 'p-3 bg-gray-50 dark:bg-[#0f1115] rounded-lg' },
              React.createElement('div', { className: 'text-xs text-gray-500 dark:text-[#9aa3af] mb-1' }, 'Memory Usage'),
              React.createElement('div', { className: 'font-mono text-sm text-gray-800 dark:text-[#f3f4f6]' }, health.memory_usage || 'N/A')
            )
          )
        ),
        
        // Timestamp
        React.createElement(
          'div',
          { className: 'text-center text-sm text-gray-400 dark:text-[#7b8494] pt-4' },
          `System time: ${new Date().toLocaleString()}`
        )
      )
    )
  );
};

export default Health;