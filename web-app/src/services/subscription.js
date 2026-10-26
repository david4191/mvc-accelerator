import api from './api';

class SubscriptionService {
    async getCurrentSubscription() {
        try {
            const apiKey = localStorage.getItem('apiKey');
            const response = await api.get('/subscription/status', {
                headers: { 'X-API-Key': apiKey }
            });
            return response;
        } catch (error) {
            throw error;
        }
    }

    async cancelSubscription() {
        try {
            const apiKey = localStorage.getItem('apiKey');
            const response = await api.post('/subscription/cancel', {}, {
                headers: { 'X-API-Key': apiKey }
            });

            if (response.subscription) {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.subscription = response.subscription;
                localStorage.setItem('user', JSON.stringify(user));
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    async verifyPayment(reference, planId) {
        try {
            const apiKey = localStorage.getItem('apiKey');
            const response = await api.post('/subscription/verify', {
                reference,
                plan: planId
            }, {
                headers: { 'X-API-Key': apiKey }
            });

            if (response.subscription) {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.subscription = response.subscription;
                localStorage.setItem('user', JSON.stringify(user));
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    async getBillingHistory() {
        try {
            const apiKey = localStorage.getItem('apiKey');
            const response = await api.get('/subscription/billing-history', {
                headers: { 'X-API-Key': apiKey }
            });
            return response.history || [];
        } catch (error) {
            throw error;
        }
    }

    async updatePaymentMethod(paymentMethodId) {
        const apiKey = localStorage.getItem('apiKey');
        return api.post('/subscription/payment-method', {
            payment_method_id: paymentMethodId
        }, {
            headers: { 'X-API-Key': apiKey }
        });
    }

    async getInvoices() {
        const apiKey = localStorage.getItem('apiKey');
        return api.get('/subscription/invoices', {
            headers: { 'X-API-Key': apiKey }
        });
    }

    async getInvoice(invoiceId) {
        const apiKey = localStorage.getItem('apiKey');
        return api.get(`/subscription/invoices/${invoiceId}`, {
            headers: { 'X-API-Key': apiKey },
            responseType: 'blob'
        });
    }

    async getPlans() {
        return api.get('/plans');
    }

    hasActiveSubscription() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const subscription = user.subscription;
        
        if (!subscription) return false;
        
        const endDate = new Date(subscription.end_date);
        const now = new Date();
        
        return subscription.payment_status === 'completed' && endDate > now;
    }

    getDaysRemaining() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const subscription = user.subscription;
        
        if (!subscription || !subscription.end_date) return 0;
        
        const endDate = new Date(subscription.end_date);
        const now = new Date();
        const diffTime = endDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays);
    }

    isOnTrial() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.subscription?.plan_type === 'trial';
    }

    async applyCoupon(couponCode) {
        const apiKey = localStorage.getItem('apiKey');
        return api.post('/subscription/coupon', { coupon: couponCode }, {
            headers: { 'X-API-Key': apiKey }
        });
    }
}

const subscriptionService = new SubscriptionService();
export default subscriptionService;

// Also export individual functions for direct use
export const getCurrentSubscription = () => subscriptionService.getCurrentSubscription();
export const cancelSubscription = () => subscriptionService.cancelSubscription();
export const verifyPayment = (reference, planId) => subscriptionService.verifyPayment(reference, planId);
export const getBillingHistory = () => subscriptionService.getBillingHistory();
export const getPlans = () => subscriptionService.getPlans();