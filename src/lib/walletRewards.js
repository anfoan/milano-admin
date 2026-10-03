import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const isCompletedOrderStatus = (status) => {
    const value = String(status || '').toLowerCase();
    return value.includes('complete') || value.includes('مكتمل') || value.includes('تم التوصيل');
};

const amountOf = value => Math.max(0, Number(value || 0));
// Wallet rewards are only earned by orders worth at least 4,000 Yemeni riyals.
// Wallet balances are stored in YER; SAR invoices are converted using the same
// displayed wallet conversion rate before the eligibility comparison.
export const WALLET_REWARD_MINIMUM_YER = 4000;
export const WALLET_SAR_TO_YER_RATE = 140;
export const orderTotalInYER = (order = {}) => {
    const total = amountOf(order.total ?? order.grandTotal ?? order.totalAmount ?? order.amountDue);
    const currency = String(order.currency || order.currencyCode || order.formData?.currency || 'YER').trim().toUpperCase();
    return currency === 'SAR' ? total * WALLET_SAR_TO_YER_RATE : total;
};
export const isOrderEligibleForWalletReward = (order = {}) => orderTotalInYER(order) >= WALLET_REWARD_MINIMUM_YER;
export const orderCustomerPhone = (order = {}) => String(order.formData?.fullPhone || order.formData?.phone || order.customer?.phone || order.phone || '').trim();
export const normalizeWalletPhone = (value = '') => {
    const digits = orderCustomerPhone({ phone: value })
        .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
        .replace(/[^0-9]/g, '');
    // Store checkout saves Yemen numbers as +967XXXXXXXXX while POS/manual
    // invoices commonly use the local nine-digit form. Both identify one wallet.
    return digits.startsWith('967') && digits.length === 12 ? digits.slice(3) : digits;
};
export const getOrderRewardWalletId = (order = {}) => {
    const normalizedPhone = normalizeWalletPhone(orderCustomerPhone(order));
    return normalizedPhone.length >= 7 ? `phone-${normalizedPhone}` : (order.walletRewardWalletId || order.customerWalletId || '');
};
const customerDetails = (order, wallet = {}) => ({
    customerName: order.formData?.name || order.customer?.name || order.customerName || wallet.customerName || '',
    phone: orderCustomerPhone(order) || wallet.phone || '',
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
        if (!isOrderEligibleForWalletReward(order)) {
            return {
                granted: false,
                eligible: false,
                reason: 'below-minimum-order-total',
                minimum: WALLET_REWARD_MINIMUM_YER,
                totalYER: orderTotalInYER(order),
            };
        }
        const resolvedWalletId = getOrderRewardWalletId(order);
        if (!resolvedWalletId) return { granted: false, reason: 'no-customer-phone' };

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
                    customerWalletId: rewardRecord.walletId || resolvedWalletId,
                    walletRewardWalletId: rewardRecord.walletId || resolvedWalletId,
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

        const walletRef = doc(db, 'customer_wallets', resolvedWalletId);
        const customerRewardRef = doc(walletRef, 'transactions', rewardRef.id);
        const walletSnapshot = await transaction.get(walletRef);
        const existingWallet = walletSnapshot.exists() ? walletSnapshot.data() : {};
        const previousBalance = amountOf(existingWallet.balance);
        const cycle = Number(order.walletRewardCycle || 0) + 1;
        const { customerName, phone } = customerDetails(order, existingWallet);
        const rewardEntry = {
            transactionId: rewardRef.id,
            walletId: resolvedWalletId,
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
            walletId: resolvedWalletId,
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
            customerWalletId: resolvedWalletId,
            walletRewardWalletId: resolvedWalletId,
            walletRewardGranted: true,
            walletRewardReversed: false,
            walletRewardAmount: amount,
            walletRewardCycle: cycle,
            walletRewardGrantedAt: serverTimestamp(),
            walletRewardReversedAt: null,
            walletRewardReversalAmount: 0,
            walletRewardReversalShortfall: 0,
        });
        return { granted: true, amount, walletId: resolvedWalletId, cycle };
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
        const rewardRecord = rewardSnapshot.exists() ? rewardSnapshot.data() : {};
        const resolvedWalletId = rewardRecord.walletId || order.walletRewardWalletId || getOrderRewardWalletId(order);
        if (!resolvedWalletId) return { reversed: false, reason: 'no-customer-phone' };
        if (!order.walletRewardGranted && (!rewardSnapshot.exists() || rewardRecord.reversed)) {
            return { reversed: false, reason: 'no-active-reward' };
        }

        const amount = amountOf(order.walletRewardAmount || rewardRecord.amount);
        if (amount <= 0) return { reversed: false, reason: 'empty-reward' };
        const cycle = Number(order.walletRewardCycle || rewardRecord.cycle || 1);
        const reversalRef = doc(db, 'wallet_transactions', `reward-reversal-${orderId}-${cycle}`);
        const reversalSnapshot = await transaction.get(reversalRef);
        if (reversalSnapshot.exists()) return { reversed: false, reason: 'already-reversed' };

        const walletRef = doc(db, 'customer_wallets', resolvedWalletId);
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
            walletId: resolvedWalletId,
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
            walletId: resolvedWalletId,
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
            walletId: resolvedWalletId,
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
            customerWalletId: resolvedWalletId,
            walletRewardWalletId: resolvedWalletId,
            walletRewardGranted: false,
            walletRewardReversed: true,
            walletRewardReversedAt: serverTimestamp(),
            walletRewardReversalAmount: amount,
            walletRewardReversalShortfall: shortfall,
        });
        return { reversed: true, amount, balanceAfter, shortfall, walletId: resolvedWalletId };
    });
};

export const syncWalletRewardForOrderStatus = async (orderId, status) => {
    if (!isCompletedOrderStatus(status)) return reverseWalletRewardForOrder(orderId);

    const orderRef = doc(db, 'orders', orderId);
    const orderSnapshot = await getDoc(orderRef);
    if (!orderSnapshot.exists()) return { granted: false, reason: 'order-missing' };

    const order = orderSnapshot.data();
    if (isOrderEligibleForWalletReward(order)) return grantWalletRewardForCompletedOrder(orderId);

    // Correct any earlier reward that may have been issued before the minimum
    // invoice-total policy existed, then leave this invoice without a reward.
    const reversal = await reverseWalletRewardForOrder(orderId);
    return {
        ...reversal,
        granted: false,
        eligible: false,
        reason: 'below-minimum-order-total',
        minimum: WALLET_REWARD_MINIMUM_YER,
        totalYER: orderTotalInYER(order),
    };
};
