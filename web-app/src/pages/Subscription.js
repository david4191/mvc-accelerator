import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Check, CreditCard, History, Calendar, Star, Crown, Rocket } from 'lucide-react';
import { getCurrentSubscription, cancelSubscription, getPlans, getBillingHistory } from '../services/subscription';
import PaymentModal from '../components/PaymentModal';
import toast from 'react-hot-toast';

const PLAN_META = {
  trial: { icon: Rocket, color: '#4A5C3A' },
  monthly: { icon: Star, color: '#F59E0B' },
  yearly: { icon: Crown, color: '#8B5CF6' }
};

const formatNaira = (amount) =>
  amount === 0 || amount == null ? '₦0' : `₦${Number(amount).toLocaleString('en-NG')}`;

const Subscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [billingHistory, setBillingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, plan: null });

  const loadAll = useCallback(async () => {
    try {
      const [subData, plansData, historyData] = await Promise.all([
        getCurrentSubscription(),
        getPlans(),
        getBillingHistory().catch(() => [])
      ]);
      setSubscription(subData);
      setPlans(plansData?.plans || []);
      setBillingHistory(historyData || []);
    } catch (error) {
      toast.error('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) return;

    setCancelling(true);
    try {
      await cancelSubscription();
      toast.success('Subscription cancelled successfully');
      loadAll();
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handlePaymentSuccess = () => {
    loadAll();
  };

  const currentPlanId = subscription?.plan_type || 'trial';
  const currentMeta = PLAN_META[currentPlanId] || PLAN_META.trial;
  const CurrentIcon = currentMeta.icon;
  const currentPlanName = plans.find((p) => p.id === currentPlanId)?.name
    || (currentPlanId === 'trial' ? 'Free Trial' : currentPlanId);

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
      { className: 'container mx-auto max-w-5xl' },

      // Header
      React.createElement(
        'div',
        { className: 'text-center mb-8' },
        React.createElement(
          'div',
          { className: 'inline-flex items-center justify-center w-16 h-16 bg-[color:var(--accent)]/10 rounded-full mb-4' },
          React.createElement(CreditCard, { size: '1em', className: 'text-2xl text-[color:var(--accent)]' })
        ),
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-2' },
          'Subscription'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-500 dark:text-[#9aa3af] text-sm' },
          'Manage your plan and billing'
        )
      ),

      // Current Subscription
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] shadow-sm p-8 mb-8 hover:shadow-md transition-shadow' },
        React.createElement(
          'h2',
          { className: 'text-xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-6 flex items-center' },
          React.createElement(Calendar, { size: '1em', className: 'text-[color:var(--accent)] mr-2' }),
          'Current Subscription'
        ),
        React.createElement(
          'div',
          { className: 'flex flex-col md:flex-row items-center justify-between p-6 bg-[color:var(--accent)]/5 rounded-xl border border-[color:var(--accent)]/20' },
          React.createElement(
            'div',
            { className: 'flex items-center space-x-4 mb-4 md:mb-0' },
            React.createElement(
              'div',
              { className: 'w-12 h-12 rounded-full flex items-center justify-center', style: { backgroundColor: `${currentMeta.color}20` } },
              React.createElement(CurrentIcon, { size: '1em', className: 'text-xl', style: { color: currentMeta.color } })
            ),
            React.createElement(
              'div',
              null,
              React.createElement(
                'h3',
                { className: 'text-xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-1' },
                currentPlanName
              ),
              React.createElement(
                'div',
                { className: 'flex items-center text-gray-500 dark:text-[#9aa3af] text-sm' },
                React.createElement(Calendar, { size: '1em', className: 'mr-1 text-xs' }),
                subscription?.end_date
                  ? `Active until ${new Date(subscription.end_date).toLocaleDateString()}`
                  : 'No active paid plan'
              )
            )
          ),
          React.createElement(
            'div',
            { className: 'text-right' },
            React.createElement(
              'div',
              { className: 'text-2xl font-bold text-[color:var(--accent)]' },
              formatNaira(subscription?.amount),
              subscription?.plan_type && subscription.plan_type !== 'trial' && React.createElement('span', { className: 'text-sm text-gray-500 dark:text-[#9aa3af] font-normal' }, ` / ${subscription.plan_type === 'yearly' ? 'year' : 'month'}`)
            ),
            subscription?.status === 'active' && subscription?.plan_type !== 'trial' && React.createElement(
              'button',
              {
                onClick: handleCancel,
                disabled: cancelling,
                className: 'mt-2 px-4 py-1.5 text-sm border border-red-500 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors'
              },
              cancelling ? 'Cancelling...' : 'Cancel Subscription'
            )
          )
        )
      ),

      // Available Plans
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] shadow-sm p-8 mb-8 hover:shadow-md transition-shadow' },
        React.createElement(
          'h2',
          { className: 'text-xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-6' },
          'Available Plans'
        ),
        React.createElement(
          'div',
          { className: 'grid md:grid-cols-3 gap-6' },
          plans.map((plan) => {
            const meta = PLAN_META[plan.id] || PLAN_META.trial;
            const Icon = meta.icon;
            const isCurrent = plan.id === currentPlanId;
            return React.createElement(
              'div',
              {
                key: plan.id,
                className: `p-6 rounded-xl transition-all duration-300 ${
                  isCurrent
                    ? 'border-2 border-[color:var(--accent)] bg-[color:var(--accent)]/5 shadow-md'
                    : 'border border-gray-200 dark:border-[#2d333d] hover:shadow-md hover:border-[color:var(--accent)]/50'
                }`
              },
              React.createElement(
                'div',
                { className: 'flex items-center justify-between mb-4' },
                React.createElement(
                  'div',
                  { className: 'w-10 h-10 rounded-full flex items-center justify-center', style: { backgroundColor: `${meta.color}20` } },
                  React.createElement(Icon, { size: '1em', className: 'text-lg', style: { color: meta.color } })
                ),
                isCurrent && React.createElement(
                  'span',
                  { className: 'text-xs px-2 py-1 bg-[color:var(--accent)] text-white rounded-full' },
                  'Current'
                )
              ),
              React.createElement(
                'h3',
                { className: 'text-lg font-bold text-gray-800 dark:text-[#f3f4f6] mb-1' },
                plan.name
              ),
              React.createElement(
                'div',
                { className: 'mb-4' },
                React.createElement('span', { className: 'text-2xl font-bold text-gray-800 dark:text-[#f3f4f6]' }, formatNaira(plan.price)),
                React.createElement('span', { className: 'text-gray-400 dark:text-[#7b8494] ml-1 text-sm' }, `/ ${plan.period}`)
              ),
              React.createElement(
                'ul',
                { className: 'space-y-2 mb-6' },
                (plan.features || []).map((feature, i) =>
                  React.createElement(
                    'li',
                    { key: i, className: 'flex items-start text-sm text-gray-600 dark:text-[#b0b8c2]' },
                    React.createElement(Check, { size: '1em', className: 'text-[color:var(--accent)] mt-0.5 mr-2 flex-shrink-0 text-xs' }),
                    feature
                  )
                )
              ),
              !isCurrent && React.createElement(
                'button',
                {
                  onClick: () => setPaymentModal({ isOpen: true, plan }),
                  disabled: plan.id === 'trial',
                  className: 'w-full py-2 bg-[color:var(--accent)] text-white rounded-lg hover:bg-[color:var(--accent-hover)] transition-colors text-sm font-medium disabled:opacity-50'
                },
                plan.id === 'trial' ? 'Trial Used' : 'Subscribe Now'
              )
            );
          }),
          plans.every((p) => p.id !== 'yearly') && React.createElement(
            'div',
            { className: 'p-6 rounded-xl border border-dashed border-gray-300 dark:border-[#2d333d] flex flex-col items-center justify-center text-center' },
            React.createElement(Crown, { size: '1em', className: 'text-2xl text-gray-300 dark:text-[#4a5160] mb-2' }),
            React.createElement('h3', { className: 'text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1' }, 'Yearly Pro'),
            React.createElement('p', { className: 'text-xs text-gray-400 dark:text-[#7b8494]' }, 'Unlocks after your first Monthly subscription.')
          )
        )
      ),

      // Billing History
      React.createElement(
        'div',
        { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl border border-gray-200 dark:border-[#2d333d] shadow-sm p-8 hover:shadow-md transition-shadow' },
        React.createElement(
          'h2',
          { className: 'text-xl font-bold text-gray-800 dark:text-[#f3f4f6] mb-6 flex items-center' },
          React.createElement(History, { size: '1em', className: 'text-[color:var(--accent)] mr-2' }),
          'Billing History'
        ),
        billingHistory.length === 0
          ? React.createElement(
              'div',
              { className: 'text-center py-8' },
              React.createElement(
                'div',
                { className: 'w-16 h-16 bg-gray-100 dark:bg-[#242933] rounded-full flex items-center justify-center mx-auto mb-4' },
                React.createElement(History, { size: '1em', className: 'text-2xl text-gray-400 dark:text-[#7b8494]' })
              ),
              React.createElement('p', { className: 'text-gray-500 dark:text-[#9aa3af]' }, 'No billing history available'),
              React.createElement('p', { className: 'text-xs text-gray-400 dark:text-[#7b8494] mt-1' }, 'Your first invoice will appear here after your next billing cycle')
            )
          : React.createElement(
              'div',
              { className: 'overflow-x-auto' },
              React.createElement(
                'table',
                { className: 'w-full text-sm' },
                React.createElement(
                  'thead',
                  null,
                  React.createElement(
                    'tr',
                    { className: 'border-b border-gray-200 dark:border-[#2d333d] text-left text-gray-500 dark:text-[#9aa3af]' },
                    React.createElement('th', { className: 'py-2 pr-4 font-medium' }, 'Date'),
                    React.createElement('th', { className: 'py-2 pr-4 font-medium' }, 'Amount'),
                    React.createElement('th', { className: 'py-2 pr-4 font-medium' }, 'Method'),
                    React.createElement('th', { className: 'py-2 font-medium' }, 'Status')
                  )
                ),
                React.createElement(
                  'tbody',
                  null,
                  billingHistory.map((row, i) =>
                    React.createElement(
                      'tr',
                      { key: i, className: 'border-b border-gray-100 dark:border-[#242933] text-gray-700 dark:text-[#d1d5db]' },
                      React.createElement('td', { className: 'py-2 pr-4' }, new Date(row.created_at).toLocaleDateString()),
                      React.createElement('td', { className: 'py-2 pr-4 font-medium' }, formatNaira(row.amount)),
                      React.createElement('td', { className: 'py-2 pr-4 capitalize' }, row.payment_method || 'N/A'),
                      React.createElement(
                        'td',
                        { className: 'py-2' },
                        React.createElement(
                          'span',
                          {
                            className: `px-2 py-0.5 rounded-full text-xs capitalize ${
                              row.status === 'completed'
                                ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`
                          },
                          row.status
                        )
                      )
                    )
                  )
                )
              )
            )
      )
    ),
    // Payment Modal
    React.createElement(PaymentModal, {
      isOpen: paymentModal.isOpen,
      onClose: () => setPaymentModal({ isOpen: false, plan: null }),
      plan: paymentModal.plan,
      onSuccess: handlePaymentSuccess
    })
  );
};

export default Subscription;
