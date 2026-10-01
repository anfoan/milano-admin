import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const isCompletedOrderStatus = (status) => {
    const value = String(status || '').toLowerCase();
    return value.includes('complete') || value.includes('مكتمل') || value.includes('تم التوصيل');
};

const amountOf = value => Math.max(0, Number(value || 0));
const customerDetails = (order, wallet = {}) => ({
    customerName: wallet.customerName || order.formData?.name || order.customer?.name || order.customerName || '',
    phone: wallet.phone || order.formData?.fullPhone || order.formData?.phone || order.phone || '',
});

/**
 * Credits a completed order's reward exactly once per completion cycle.
 * A later reversal leaves an audit record and permits a deliberate re-completion.
 */
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
            transaction.get(rewardRef),
        ]);
        const settings = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
        const rewardRecord = rewardSnapshot.exists() ? rewardSnapshot.data() : null;
        const amount = amountOf(order.walletRewardOverride ?? settings.defaultReward ?? 500);
        if (settings.enabled === false || amount === 0) return { granted: false, reason: 'rewards-disabled' };
        if ((order.walletRewardGranted && !order.walletRewardReversed) || (rewardRecord && !rewardRecord.reversed)) {
            // Repair older invoices whose reward ledger exists but whose order flags were not saved.
            if (rewardRecord && (!order.walletRewardGranted || order.walletRewardReversed)) {
                transaction.update(orderRef, {
                    walletRewardGranted: true,
                    walletRewardReversed: false,
                    walletRewardAmount: amountOf(rewardRecord.amount || order.walletRewardAmount),
                    walletRewardGrantedAt: rewardRecord.issuedAt || rewardRecord.createdAt || serverTimestamp(),
                    walletRewardReversedAt: null,
                    walletRewardReversalAmount: 0,
                    walletRewardReversalShortfall: 0,
                });
            }
            return { granted: false, reason: 'already-granted', amount: amountOf(rewardRecord?.amount || order.walletRewardAmount) };
        }

        const walletRef = doc(db, 'customer_wallets', order.customerWalletId);
        const customerRewardRef = doc(walletRef, 'transactions', rewardRef.id);
        const walletSnapshot = await transaction.get(walletRef);
        const existingWallet = walletSnapshot.exists() ? walletSnapshot.data() : {};
        const previousBalance = amountOf(existingWallet.balance);
        const cycle = Number(order.walletRewardCycle || 0) + 1;
        const { customerName, phone } = customerDetails(order, existingWallet);
        const rewardEntry = {
            transactionId: rewardRef.id,
            walletId: order.customerWalletId,
            type: 'reward',
            amount,
            previousBalance,
            balanceAfter: previousBalance + amount,
            orderId: order.orderId || orderId,
            orderDocumentId: orderId,
            customerName,
            phone,
            source: 'completed-order',
            cycle,
            reversed: false,
            issuedAt: serverTimestamp(),
            createdAt: rewardRecord?.createdAt || serverTimestamp(),
        };

        transaction.set(walletRef, {
            walletId: order.customerWalletId,
            customerName,
            phone,
            balance: previousBalance + amount,
            deviceBound: true,
            rewardCount: Number(existingWallet.rewardCount || 0) + 1,
            lastRewardOrderId: order.orderId || orderId,
            lastRewardAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdAt: existingWallet.createdAt || serverTimestamp(),
        }, { merge: true });
        transaction.set(rewardRef, rewardEntry, { merge: true });
        transaction.set(customerRewardRef, rewardEntry, { merge: true });
        transaction.update(orderRef, {
            walletRewardGranted: true,
            walletRewardReversed: false,
            walletRewardAmount: amount,
            walletRewardCycle: cycle,
            walletRewardGrantedAt: serverTimestamp(),
            walletRewardReversedAt: null,
            walletRewardReversalAmount: 0,
            walletRewardReversalShortfall: 0,
        });
        return { granted: true, amount, walletId: order.customerWalletId, cycle };
    });
};

/**
 * Reclaims a previously granted reward when a completed order is returned to
 * any non-completed state. The reversal is idempotent and leaves full audit
 * records in both the admin ledger and the customer's wallet history.
 */
export const reverseWalletRewardForOrder = async (orderId) => {
    const orderRef = doc(db, 'orders', orderId);
    const rewardRef = doc(db, 'wallet_transactions', `reward-${orderId}`);

    return runTransaction(db, async transaction => {
        const [orderSnapshot, rewardSnapshot] = await Promise.all([
            transaction.get(orderRef),
            transaction.get(rewardRef),
        ]);
        if (!orderSnapshot.exists()) return { reversed: false, reason: 'order-missing' };
        const order = orderSnapshot.data();
        if (!order.customerWalletId) return { reversed: false, reason: 'no-customer-wallet' };
        if (!order.walletRewardGranted && (!rewardSnapshot.exists() || rewardSnapshot.data().reversed)) {
            return { reversed: false, reason: 'no-active-reward' };
        }

        const rewardRecord = rewardSnapshot.exists() ? rewardSnapshot.data() : {};
        const amount = amountOf(order.walletRewardAmount || rewardRecord.amount);
        if (amount <= 0) return { reversed: false, reason: 'empty-reward' };
        const cycle = Number(order.walletRewardCycle || rewardRecord.cycle || 1);
        const reversalRef = doc(db, 'wallet_transactions', `reward-reversal-${orderId}-${cycle}`);
        const reversalSnapshot = await transaction.get(reversalRef);
        if (reversalSnapshot.exists()) return { reversed: false, reason: 'already-reversed' };

        const walletRef = doc(db, 'customer_wallets', order.customerWalletId);
        const [walletSnapshot, customerRewardSnapshot] = await Promise.all([
            transaction.get(walletRef),
            transaction.get(doc(walletRef, 'transactions', rewardRef.id)),
        ]);
        const wallet = walletSnapshot.exists() ? walletSnapshot.data() : {};
        const previousBalance = amountOf(wallet.balance);
        const balanceAfter = Math.max(0, previousBalance - amount);
        const shortfall = Math.max(0, amount - previousBalance);
        const { customerName, phone } = customerDetails(order, wallet);
        const customerRewardRef = doc(walletRef, 'transactions', rewardRef.id);
        const customerReversalRef = doc(walletRef, 'transactions', reversalRef.id);
        const rewardEntry = {
            transactionId: rewardRef.id,
            walletId: order.customerWalletId,
            type: 'reward',
            amount,
            previousBalance: Math.max(0, balanceAfter - amount),
            balanceAfter: previousBalance,
            orderId: order.orderId || orderId,
            orderDocumentId: orderId,
            customerName,
            phone,
            source: 'completed-order',
            cycle,
            reversed: true,
            reversedAt: serverTimestamp(),
            createdAt: rewardRecord.createdAt || serverTimestamp(),
        };
        const reversalEntry = {
            transactionId: reversalRef.id,
            walletId: order.customerWalletId,
            type: 'reward_reversal',
            amount,
            previousBalance,
            balanceAfter,
            shortfall,
            orderId: order.orderId || orderId,
            orderDocumentId: orderId,
            customerName,
            phone,
            source: 'status-correction',
            cycle,
            note: 'تم استرجاع مكافأة الطلب بعد تغيير الحالة من مكتمل.',
            createdAt: serverTimestamp(),
        };

        transaction.set(walletRef, {
            walletId: order.customerWalletId,
            customerName,
            phone,
            balance: balanceAfter,
            updatedAt: serverTimestamp(),
        }, { merge: true });
        transaction.set(rewardRef, { ...rewardEntry, reversed: true }, { merge: true });
        transaction.set(customerRewardRef, customerRewardSnapshot.exists() ? { ...rewardEntry, reversed: true } : rewardEntry, { merge: true });
        transaction.set(reversalRef, reversalEntry);
        transaction.set(customerReversalRef, reversalEntry);
        transaction.update(orderRef, {
            walletRewardGranted: false,
            walletRewardReversed: true,
            walletRewardReversedAt: serverTimestamp(),
            walletRewardReversalAmount: amount,
            walletRewardReversalShortfall: shortfall,
        });
        return { reversed: true, amount, balanceAfter, shortfall, walletId: order.customerWalletId };
    });
};

export const syncWalletRewardForOrderStatus = async (orderId, status) => (
    isCompletedOrderStatus(status)
        ? grantWalletRewardForCompletedOrder(orderId)
        : reverseWalletRewardForOrder(orderId)
);
