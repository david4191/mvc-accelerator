import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Rocket, Star, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPlans, getCurrentSubscription } from '../services/subscription';

const PLAN_META = {
  trial: { icon: Rocket, color: '#4A5C3A', highlighted: false, buttonText: 'Start Free Trial' },
  monthly: { icon: Star, color: '#F59E0B', highlighted: true, buttonText: 'Subscribe Monthly' },
  yearly: { icon: Crown, color: '#8B5CF6', highlighted: false, buttonText: 'Subscribe Yearly' }
};

const formatNaira = (amount) =>
  amount === 0 ? '₦0' : `₦${Number(amount).toLocaleString('en-NG')}`;

const Pricing = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      getPlans()
        .then((res) => setPlans(res?.plans || []))
        .catch(() => setPlans([]))
        .finally(() => setLoading(false));
      return;
    }

    // Already-subscribed users land on /subscription instead of re-seeing
    // the same marketing plan list with nonsensical "Subscribe" buttons for
    // a plan they already have.
    getCurrentSubscription()
      .then((sub) => {
        if (sub?.status === 'active' && sub?.plan_type !== 'trial') {
          navigate('/subscription', { replace: true });
          return;
        }
        return getPlans().then((res) => setPlans(res?.plans || []));
      })
      .catch(() => getPlans().then((res) => setPlans(res?.plans || [])).catch(() => setPlans([])))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-transparent dark:bg-[#0f1115] py-20' },
    React.createElement(
      'div',
      { className: 'container mx-auto px-4 max-w-6xl' },

      // Header
      React.createElement(
        'div',
        { className: 'text-center mb-12' },
        React.createElement(
          'div',
          { className: 'inline-flex items-center justify-center w-16 h-16 bg-[color:var(--accent)]/10 rounded-full mb-4' },
          React.createElement(Crown, { size: '1em', className: 'text-2xl text-[color:var(--accent)]' })
        ),
        React.createElement(
          'h1',
          { className: 'text-4xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-4' },
          'Simple, Transparent Pricing'
        ),
        React.createElement(
          'p',
          { className: 'text-xl text-gray-600 dark:text-[#b0b8c2]' },
          'Start with a 48-hour free trial. No credit card required.'
        )
      ),

      loading
        ? React.createElement(
            'div',
            { className: 'flex justify-center py-12' },
            React.createElement('div', { className: 'animate-spin rounded-full h-10 w-10 border-b-2 border-[color:var(--accent)]' })
          )
        : React.createElement(
            'div',
            { className: 'grid md:grid-cols-3 gap-8' },
            plans.map((plan) => {
              const meta = PLAN_META[plan.id] || PLAN_META.trial;
              const Icon = meta.icon;
              return React.createElement(
                'div',
                {
                  key: plan.id,
                  className: `bg-white dark:bg-[#1a1d23] rounded-2xl border ${meta.highlighted ? 'border-[color:var(--accent)] shadow-xl' : 'border-gray-200 dark:border-[#2d333d] shadow-sm'} overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`
                },
                meta.highlighted && React.createElement(
                  'div',
                  { className: 'bg-[color:var(--accent)] text-white text-center py-2 text-sm font-medium' },
                  'Most Popular'
                ),
                React.createElement(
                  'div',
                  { className: 'p-8' },
                  React.createElement(
                    'div',
                    { className: 'flex justify-center mb-4' },
                    React.createElement(
                      'div',
                      { className: 'w-16 h-16 rounded-full flex items-center justify-center', style: { backgroundColor: `${meta.color}20` } },
                      React.createElement(Icon, { size: '1em', className: 'text-2xl', style: { color: meta.color } })
                    )
                  ),
                  React.createElement(
                    'h3',
                    { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6] text-center mb-2' },
                    plan.name
                  ),
                  React.createElement(
                    'div',
                    { className: 'text-center mb-6' },
                    React.createElement('span', { className: 'text-4xl font-bold text-gray-800 dark:text-[#f3f4f6]' }, formatNaira(plan.price)),
                    React.createElement('span', { className: 'text-gray-500 dark:text-[#9aa3af] ml-2' }, `/ ${plan.period}`)
                  ),
                  React.createElement(
                    'ul',
                    { className: 'space-y-3 mb-8' },
                    (plan.features || []).map((feature) =>
                      React.createElement(
                        'li',
                        { key: feature, className: 'flex items-center text-gray-600 dark:text-[#b0b8c2] text-sm' },
                        React.createElement(Check, { size: '1em', className: 'text-[color:var(--accent)] mr-3 flex-shrink-0' }),
                        feature
                      )
                    )
                  ),
                  React.createElement(
                    Link,
                    {
                      to: plan.id === 'trial' ? '/register' : '/subscription',
                      className: `block w-full py-3 text-center rounded-lg font-medium transition-all duration-300 ${
                        meta.highlighted
                          ? 'bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)] shadow-md'
                          : 'border-2 border-[color:var(--accent)] text-[color:var(--accent)] hover:bg-[color:var(--accent)] hover:text-white'
                      }`
                    },
                    meta.buttonText
                  )
                )
              );
            }),
            plans.every((p) => p.id !== 'yearly') && React.createElement(
              'div',
              { className: 'bg-white/60 dark:bg-[#1a1d23]/60 rounded-2xl border border-dashed border-gray-300 dark:border-[#2d333d] flex flex-col items-center justify-center p-8 text-center' },
              React.createElement(Crown, { size: '1em', className: 'text-3xl text-gray-300 dark:text-[#4a5160] mb-3' }),
              React.createElement('h3', { className: 'text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2' }, 'Yearly Pro'),
              React.createElement('p', { className: 'text-sm text-gray-400 dark:text-[#7b8494]' }, 'Subscribe to Monthly Pro first to unlock the Yearly plan and its savings.')
            )
          ),

      // Additional Info
      React.createElement(
        'div',
        { className: 'text-center mt-12 pt-8 border-t border-gray-200 dark:border-[#2d333d]' },
        React.createElement(
          'p',
          { className: 'text-gray-500 dark:text-[#9aa3af] text-sm' },
          'All plans include 24/7 support. Cancel anytime. No hidden fees.'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-400 dark:text-[#7b8494] text-xs mt-2' },
          'Secure payments powered by Paystack'
        )
      )
    )
  );
};

export default Pricing;
