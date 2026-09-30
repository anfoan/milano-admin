import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const isCompletedOrderStatus = (status) => {
    const value = String(status || '').toLowerCase();
    return value.includes('complete') || value.includes('مكتمل') || value.includes('تم التوصيل');
};

export const grantWalletRewardForCompletedOrder = async (orderId) => {
    const orderRef = doc(db, 'orders', orderId);
    const walletSettingsRef = doc(db, 'settings', 'wallet');
    const rewardRef = doc(db, 'wallet_transactions', `reward-${orderId}`);

    return runTransaction(db, async transaction => {
        const orderSnapshot = await transaction.get(orderRef);
        if (!orderSnapshot.exists()) return { granted: false, reason: 'order-missing' };
        const order = orderSnapshot.data();
        if (!isCompletedOrderStatus(order.status)) return { granted: false, reason: 'not-completed' };
        if (!order.customerWalletId) return { granted: false, reason: 'no-customer-wallet' };

        const [settingsSnapshot, rewardSnapshot] = await Promise.all([
            transaction.get(walletSettingsRef),
            transaction.get(rewardRef)
        ]);
        const settings = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
        const amount = Math.max(0, Number(order.walletRewardOverride ?? settings.defaultReward ?? 500));
        if (settings.enabled === false || amount === 0) return { granted: false, reason: 'rewards-disabled' };
        if (rewardSnapshot.exists() || order.walletRewardGranted) return { granted: false, reason: 'already-granted' };

        const walletRef = doc(db, 'customer_wallets', order.customerWalletId);
        const walletSnapshot = await transaction.get(walletRef);
        const existingWallet = walletSnapshot.exists() ? walletSnapshot.data() : {};
        const customerPhone = existingWallet.phone || order.formData?.fullPhone || order.formData?.phone || order.phone || '';
        const customerName = existingWallet.customerName || order.formData?.name || order.customer?.name || order.customerName || '';
        const previousBalance = Number(existingWallet.balance || 0);

        transaction.set(walletRef, {
            walletId: order.customerWalletId,
            customerName,
            phone: customerPhone,
            balance: previousBalance + amount,
            deviceBound: true,
            rewardCount: Number(existingWallet.rewardCount || 0) + 1,
            lastRewardOrderId: order.orderId || orderId,
            lastRewardAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdAt: existingWallet.createdAt || serverTimestamp()
        }, { merge: true });
        transaction.set(rewardRef, {
            walletId: order.customerWalletId,
            type: 'reward',
            amount,
            orderId: order.orderId || orderId,
            orderDocumentId: orderId,
            customerName,
            phone: customerPhone,
            source: 'completed-order',
            createdAt: serverTimestamp()
        });
        transaction.update(orderRef, {
            walletRewardGranted: true,
            walletRewardAmount: amount,
            walletRewardGrantedAt: serverTimestamp()
        });
        return { granted: true, amount, walletId: order.customerWalletId };
    });
};
