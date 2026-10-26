import React, { useState } from 'react';
import { X, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { verifyPayment } from '../services/subscription';
import toast from 'react-hot-toast';

const formatNaira = (amount) =>
  `₦${Number(amount).toLocaleString('en-NG')}`;

const PaymentModal = ({ isOpen, onClose, plan, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePay = () => {
    if (!window.PaystackPop) {
      toast.error('Payment system failed to load. Refresh and try again.');
      return;
    }

    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      toast.error('Payments are not configured yet. Contact support.');
      return;
    }

    setLoading(true);

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: user?.email,
      amount: Math.round(plan.price * 100), // Paystack takes kobo
      currency: 'NGN',
      ref: `mvc_${plan.id}_${Date.now()}`,
      metadata: {
        plan: plan.id,
        user_id: user?.id
      },
      callback: (response) => {
        // Paystack confirmed the charge client-side, but we never trust that
        // alone - verify the reference server-side before activating anything.
        (async () => {
          const verifyToast = toast.loading('Confirming your payment...');
          try {
            const result = await verifyPayment(response.reference, plan.id);
            toast.dismiss(verifyToast);
            toast.success(`Successfully subscribed to ${plan.name}!`, {
              duration: 5000,
              icon: React.createElement(CheckCircle2, { size: 18 })
            });
            onSuccess(result);
            onClose();
          } catch (error) {
            toast.dismiss(verifyToast);
            toast.error(error.message || 'Payment verification failed. Contact support with your reference: ' + response.reference);
          } finally {
            setLoading(false);
          }
        })();
      },
      onClose: () => {
        setLoading(false);
      }
    });

    handler.openIframe();
  };

  if (!isOpen) return null;

  return React.createElement(
    'div',
    { className: 'fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm' },
    React.createElement(
      'div',
      { className: 'bg-white dark:bg-[#1a1d23] rounded-2xl max-w-md w-full transform transition-all duration-300 scale-100' },
      // Header
      React.createElement(
        'div',
        { className: 'flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#2d333d]' },
        React.createElement(
          'div',
          null,
          React.createElement('h3', { className: 'text-xl font-bold text-gray-800 dark:text-[#f3f4f6]' }, 'Complete Subscription'),
          React.createElement('p', { className: 'text-sm text-gray-600 dark:text-[#b0b8c2]' }, `Subscribe to ${plan?.name}`)
        ),
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: 'text-gray-400 dark:text-[#7b8494] hover:text-gray-600 dark:hover:text-[#b0b8c2] p-2 hover:bg-gray-100 dark:hover:bg-[#242933] rounded-full transition-colors'
          },
          React.createElement(X, { size: 20 })
        )
      ),
      // Summary + Pay
      React.createElement(
        'div',
        { className: 'p-6 space-y-4' },
        React.createElement(
          'div',
          { className: 'bg-gray-50 dark:bg-[#0f1115] p-4 rounded-lg' },
          React.createElement(
            'div',
            { className: 'flex justify-between items-center' },
            React.createElement('span', { className: 'text-gray-600 dark:text-[#b0b8c2]' }, 'Plan:'),
            React.createElement('span', { className: 'font-semibold text-gray-800 dark:text-[#f3f4f6]' }, plan?.name)
          ),
          React.createElement(
            'div',
            { className: 'flex justify-between items-center mt-2' },
            React.createElement('span', { className: 'text-gray-600 dark:text-[#b0b8c2]' }, 'Amount:'),
            React.createElement('span', { className: 'text-xl font-bold text-[color:var(--accent)]' }, plan ? formatNaira(plan.price) : '')
          ),
          React.createElement(
            'div',
            { className: 'flex justify-between items-center mt-2 text-sm text-gray-500 dark:text-[#9aa3af]' },
            React.createElement('span', null, 'Billing period:'),
            React.createElement('span', null, plan?.period)
          )
        ),
        React.createElement(
          'div',
          { className: 'flex items-center space-x-2 text-sm text-gray-600 dark:text-[#b0b8c2] bg-[color:var(--accent)]/5 p-3 rounded-lg' },
          React.createElement(ShieldCheck, { size: '1em', className: 'text-[color:var(--accent)] shrink-0' }),
          React.createElement('span', null, "You'll enter your card details on Paystack's secure checkout - we never see or store your card information.")
        ),
        React.createElement(
          'button',
          {
            onClick: handlePay,
            disabled: loading,
            className: 'w-full py-3 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-hover)] text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100'
          },
          loading ? 'Processing...' : `Pay ${plan ? formatNaira(plan.price) : ''} with Paystack`
        ),
        React.createElement(
          'div',
          { className: 'flex items-center justify-center text-xs text-gray-500 dark:text-[#9aa3af]' },
          React.createElement(Lock, { size: '1em', className: 'mr-1' }),
          'Payments are secure and encrypted'
        )
      )
    )
  );
};

export default PaymentModal;
