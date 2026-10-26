import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, CreditCard, Bell, Save, Loader2 } from 'lucide-react';
import { updateUserProfile, changePassword, getUserProfile } from '../services/api';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [profileData, setProfileData] = useState({
    fullname: '',
    email: '',
    // Remove company as it doesn't exist in the database
  });
  
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    securityAlerts: true,
    marketing: false
  });
  
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  // Load user profile on mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setInitialLoading(true);
      console.log('Loading user profile...');
      
      const response = await getUserProfile();
      console.log('Profile loaded:', response);
      
      if (response && response.user) {
        setProfileData({
          fullname: response.user.fullname || response.user.username || '',
          email: response.user.email || '',
        });
        
        // Update auth context if needed
        if (updateUser) {
          updateUser(response.user);
        }
      } else if (user) {
        // Fallback to auth context
        setProfileData({
          fullname: user.fullname || user.username || '',
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      
      // Show specific error message
      if (error.message?.includes('401') || error.status === 401) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error(error.message || 'Failed to load profile data');
      }
    } finally {
      setInitialLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard }
  ];

  const validateProfile = () => {
    const errors = {};
    
    if (!profileData.fullname.trim()) {
      errors.fullname = 'Full name is required';
    }
    
    if (!profileData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      errors.email = 'Email is invalid';
    }
    
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePassword = () => {
    const errors = {};
    
    if (!passwordData.current) {
      errors.current = 'Current password is required';
    }
    
    if (!passwordData.new) {
      errors.new = 'New password is required';
    } else if (passwordData.new.length < 8) {
      errors.new = 'Password must be at least 8 characters';
    }
    
    if (passwordData.new !== passwordData.confirm) {
      errors.confirm = 'Passwords do not match';
    }
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateProfile()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Updating profile with data:', profileData);
      
      // Only send fields that exist in the database
      const updateData = {
        fullname: profileData.fullname,
        email: profileData.email
      };
      
      const response = await updateUserProfile(updateData);
      console.log('Profile update response:', response);
      
      if (response && (response.success || response.user)) {
        toast.success('Profile updated successfully!');
        
        // Update user in auth context
        if (response.user && updateUser) {
          updateUser(response.user);
        }
        
        // Reload profile to ensure we have latest data
        await loadUserProfile();
      } else {
        toast.error(response?.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      
      // Handle specific error messages
      if (error.message?.includes('409') || error.status === 409) {
        toast.error('Email already in use by another account');
      } else if (error.message?.includes('401') || error.status === 401) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error(error.message || 'Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!validatePassword()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Changing password');
      
      const response = await changePassword(passwordData.current, passwordData.new);
      console.log('Password change response:', response);
      
      if (response && (response.success || response.message)) {
        toast.success('Password changed successfully!');
        
        // Clear password fields
        setPasswordData({
          current: '',
          new: '',
          confirm: ''
        });
      } else {
        toast.error(response?.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Password change error:', error);
      
      // Handle specific error messages
      if (error.message?.includes('incorrect') || error.status === 401) {
        toast.error('Current password is incorrect');
      } else if (error.message?.includes('401')) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error(error.message || 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] flex items-center justify-center' },
      React.createElement(
        'div',
        { className: 'text-center' },
        React.createElement(Loader2, { size: '1em', className: 'animate-spin text-4xl text-[color:var(--accent)] mx-auto mb-4' }),
        React.createElement('p', { className: 'text-gray-600 dark:text-[#b0b8c2]' }, 'Loading your profile...')
      )
    );
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] py-20' },
    React.createElement(
      'div',
      { className: 'container mx-auto px-4 max-w-5xl' },
      
      // Header
      React.createElement(
        'div',
        { className: 'mb-8' },
        React.createElement(
          'h1',
          { className: 'text-3xl md:text-4xl font-bold bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-hover)] bg-clip-text text-transparent' },
          'Settings'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-600 dark:text-[#b0b8c2] mt-2' },
          'Manage your account settings and preferences'
        )
      ),

      // Main Content
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-[#242933]' },
        
        // Tabs
        React.createElement(
          'div',
          { className: 'border-b border-gray-200 dark:border-[#2d333d] bg-gray-50 dark:bg-[#0f1115]' },
          React.createElement(
            'div',
            { className: 'flex overflow-x-auto' },
            tabs.map((tab) => {
              const Icon = tab.icon;
              return React.createElement(
                'button',
                {
                  key: tab.id,
                  onClick: () => setActiveTab(tab.id),
                  className: `flex items-center px-6 py-4 text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'border-b-2 border-[color:var(--accent)] text-[color:var(--accent)] bg-white dark:bg-[#1a1d23]'
                      : 'text-gray-500 dark:text-[#9aa3af] hover:text-gray-700 dark:text-[#d1d5db] hover:bg-white dark:hover:bg-[#1a1d23]/50'
                  }`
                },
                React.createElement(Icon, { size: '1em', className: 'mr-2' }),
                tab.label
              );
            })
          )
        ),

        // Content
        React.createElement(
          'div',
          { className: 'p-8' },
          
          // Profile Tab
          activeTab === 'profile' && React.createElement(
            'form',
            { onSubmit: handleProfileSubmit, className: 'space-y-6' },
            
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Full Name'),
              React.createElement('input', {
                type: 'text',
                value: profileData.fullname,
                onChange: (e) => {
                  setProfileData({ ...profileData, fullname: e.target.value });
                  if (profileErrors.fullname) setProfileErrors({ ...profileErrors, fullname: null });
                },
                className: `w-full px-4 py-3 border ${profileErrors.fullname ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all`
              }),
              profileErrors.fullname && React.createElement(
                'p',
                { className: 'mt-1 text-sm text-red-600' },
                profileErrors.fullname
              )
            ),
            
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Email'),
              React.createElement('input', {
                type: 'email',
                value: profileData.email,
                onChange: (e) => {
                  setProfileData({ ...profileData, email: e.target.value });
                  if (profileErrors.email) setProfileErrors({ ...profileErrors, email: null });
                },
                className: `w-full px-4 py-3 border ${profileErrors.email ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all`
              }),
              profileErrors.email && React.createElement(
                'p',
                { className: 'mt-1 text-sm text-red-600' },
                profileErrors.email
              )
            ),
            
            // Company field removed - it doesn't exist in the database
            
            React.createElement(
              'button',
              {
                type: 'submit',
                disabled: loading,
                className: 'px-6 py-3 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-hover)] text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center space-x-2'
              },
              loading 
                ? [
                    React.createElement(Loader2, { key: 'spinner', className: 'animate-spin mr-2' }),
                    React.createElement('span', { key: 'text' }, 'Saving...')
                  ]
                : [
                    React.createElement(Save, { key: 'save', className: 'mr-2' }),
                    React.createElement('span', { key: 'text' }, 'Save Changes')
                  ]
            )
          ),

          // Security Tab
          activeTab === 'security' && React.createElement(
            'form',
            { onSubmit: handlePasswordSubmit, className: 'space-y-6' },
            
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Current Password'),
              React.createElement('input', {
                type: 'password',
                value: passwordData.current,
                onChange: (e) => {
                  setPasswordData({ ...passwordData, current: e.target.value });
                  if (passwordErrors.current) setPasswordErrors({ ...passwordErrors, current: null });
                },
                className: `w-full px-4 py-3 border ${passwordErrors.current ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all`
              }),
              passwordErrors.current && React.createElement(
                'p',
                { className: 'mt-1 text-sm text-red-600' },
                passwordErrors.current
              )
            ),
            
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'New Password'),
              React.createElement('input', {
                type: 'password',
                value: passwordData.new,
                onChange: (e) => {
                  setPasswordData({ ...passwordData, new: e.target.value });
                  if (passwordErrors.new) setPasswordErrors({ ...passwordErrors, new: null });
                },
                className: `w-full px-4 py-3 border ${passwordErrors.new ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all`
              }),
              passwordErrors.new && React.createElement(
                'p',
                { className: 'mt-1 text-sm text-red-600' },
                passwordErrors.new
              ),
              React.createElement(
                'p',
                { className: 'mt-1 text-xs text-gray-500 dark:text-[#9aa3af]' },
                'Password must be at least 8 characters'
              )
            ),
            
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-[#d1d5db] mb-2' }, 'Confirm New Password'),
              React.createElement('input', {
                type: 'password',
                value: passwordData.confirm,
                onChange: (e) => {
                  setPasswordData({ ...passwordData, confirm: e.target.value });
                  if (passwordErrors.confirm) setPasswordErrors({ ...passwordErrors, confirm: null });
                },
                className: `w-full px-4 py-3 border ${passwordErrors.confirm ? 'border-red-500' : 'border-gray-200 dark:border-[#2d333d]'} rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent transition-all`
              }),
              passwordErrors.confirm && React.createElement(
                'p',
                { className: 'mt-1 text-sm text-red-600' },
                passwordErrors.confirm
              )
            ),
            
            React.createElement(
              'button',
              {
                type: 'submit',
                disabled: loading,
                className: 'px-6 py-3 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-hover)] text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center space-x-2'
              },
              loading 
                ? [
                    React.createElement(Loader2, { key: 'spinner', className: 'animate-spin mr-2' }),
                    React.createElement('span', { key: 'text' }, 'Updating...')
                  ]
                : [
                    React.createElement(Lock, { key: 'lock', className: 'mr-2' }),
                    React.createElement('span', { key: 'text' }, 'Change Password')
                  ]
            )
          ),

          // Notifications Tab
          activeTab === 'notifications' && React.createElement(
            'div',
            { className: 'space-y-4' },
            [
              { id: 'emailAlerts', label: 'Email Alerts', desc: 'Receive email notifications about your projects' },
              { id: 'securityAlerts', label: 'Security Alerts', desc: 'Get notified about security updates and vulnerabilities' },
              { id: 'marketing', label: 'Marketing', desc: 'Receive product updates and promotional offers' }
            ].map((item) =>
              React.createElement(
                'div',
                { key: item.id, className: 'flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0f1115] rounded-xl border border-gray-100 dark:border-[#242933] hover:shadow-md transition-shadow' },
                React.createElement(
                  'div',
                  null,
                  React.createElement('h4', { className: 'font-medium text-gray-800 dark:text-[#f3f4f6]' }, item.label),
                  React.createElement('p', { className: 'text-sm text-gray-600 dark:text-[#b0b8c2]' }, item.desc)
                ),
                React.createElement('input', {
                  type: 'checkbox',
                  checked: notifications[item.id],
                  onChange: (e) => setNotifications({ ...notifications, [item.id]: e.target.checked }),
                  className: 'w-5 h-5 text-[color:var(--accent)] rounded focus:ring-[color:var(--accent)] cursor-pointer'
                })
              )
            )
          ),

          // Billing Tab
          activeTab === 'billing' && React.createElement(
            'div',
            { className: 'text-center py-12' },
            React.createElement(
              'p',
              { className: 'text-gray-600 dark:text-[#b0b8c2] mb-4' },
              'Manage your subscription and payment methods'
            ),
            React.createElement(
              'button',
              {
                onClick: () => window.location.href = '/subscription',
                className: 'px-6 py-3 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-hover)] text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105'
              },
              'View Subscription'
            )
          )
        )
      )
    )
  );
};

export default Settings;