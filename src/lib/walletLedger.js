import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const numeric = value => Math.max(0, Number(value || 0));

const actionMeta = type => ({
    credit: { label: 'إضافة رصيد', direction: 'credit' },
    bonus: { label: 'رصيد تشجيعي', direction: 'credit' },
    debit: { label: 'خصم رصيد', direction: 'debit' },
}[type] || null);

/**
 * Performs an admin-only balance movement and mirrors it in the customer's
 * private wallet history. Each movement has one deterministic ID in both ledgers.
 */
export const adjustCustomerWalletBalance = async ({
    walletId,
    type,
    amount,
    note = '',
    customerName = '',
    phone = '',
}) => {
    const movement = actionMeta(type);
    const movementAmount = numeric(amount);
    if (!walletId || !movement || movementAmount <= 0) throw new Error('INVALID_WALLET_MOVEMENT');

    const walletRef = doc(db, 'customer_wallets', walletId);
    const transactionRef = doc(collection(db, 'wallet_transactions'));
    const customerTransactionRef = doc(walletRef, 'transactions', transactionRef.id);

    return runTransaction(db, async transaction => {
        const walletSnapshot = await transaction.get(walletRef);
        const wallet = walletSnapshot.exists() ? walletSnapshot.data() : {};
        const previousBalance = numeric(wallet.balance);
        const nextBalance = movement.direction === 'debit'
            ? previousBalance - movementAmount
            : previousBalance + movementAmount;
        if (nextBalance < 0) throw new Error('INSUFFICIENT_WALLET_BALANCE');

        const resolvedName = String(customerName || wallet.customerName || '').trim();
        const resolvedPhone = String(phone || wallet.phone || '').trim();
        const entry = {
            transactionId: transactionRef.id,
            walletId,
            type,
            amount: movementAmount,
            previousBalance,
            balanceAfter: nextBalance,
            customerName: resolvedName,
            phone: resolvedPhone,
            note: String(note || '').trim(),
            source: 'admin-wallet',
            createdAt: serverTimestamp(),
        };

        transaction.update(walletRef, {
            balance: nextBalance,
            customerName: resolvedName || wallet.customerName || '',
            phone: resolvedPhone || wallet.phone || '',
            updatedAt: serverTimestamp(),
        });
        transaction.set(transactionRef, entry);
        transaction.set(customerTransactionRef, entry);
        return { previousBalance, balance: nextBalance, type, amount: movementAmount };
    });
};

/**
 * Sets a customer wallet to an exact balance while retaining an auditable
 * credit or debit ledger entry for the difference.
 */
export const setCustomerWalletBalance = async ({
    walletId,
    balance,
    note = '',
    customerName = '',
    phone = '',
}) => {
    const targetBalance = numeric(balance);
    if (!walletId) throw new Error('INVALID_WALLET_MOVEMENT');

    const walletRef = doc(db, 'customer_wallets', walletId);
    const transactionRef = doc(collection(db, 'wallet_transactions'));
    const customerTransactionRef = doc(walletRef, 'transactions', transactionRef.id);

    return runTransaction(db, async transaction => {
        const walletSnapshot = await transaction.get(walletRef);
        if (!walletSnapshot.exists()) throw new Error('WALLET_NOT_FOUND');

        const wallet = walletSnapshot.data();
        const previousBalance = numeric(wallet.balance);
        const difference = targetBalance - previousBalance;
        const resolvedName = String(customerName || wallet.customerName || '').trim();
        const resolvedPhone = String(phone || wallet.phone || '').trim();

        const walletData = {
            walletId,
            balance: targetBalance,
            customerName: resolvedName || wallet.customerName || '',
            phone: resolvedPhone || wallet.phone || '',
            deviceBound: wallet.deviceBound ?? true,
            updatedAt: serverTimestamp(),
            ...(walletSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
        };
        if (walletSnapshot.exists()) transaction.update(walletRef, walletData);
        else transaction.set(walletRef, walletData);

        if (difference !== 0) {
            const entry = {
                transactionId: transactionRef.id,
                walletId,
                type: difference > 0 ? 'credit' : 'debit',
                amount: Math.abs(difference),
                previousBalance,
                balanceAfter: targetBalance,
                customerName: resolvedName,
                phone: resolvedPhone,
                note: String(note || 'تعديل مباشر للرصيد من الفاتورة').trim(),
                source: 'admin-wallet-direct-adjustment',
                createdAt: serverTimestamp(),
            };
            transaction.set(transactionRef, entry);
            transaction.set(customerTransactionRef, entry);
        }
        return { previousBalance, balance: targetBalance, changed: difference !== 0, difference };
    });
};

/**
 * Adds the immutable history entry for a checkout debit exactly once.
 * The checkout already applied the balance debit atomically; this records it
 * for administrators and the owning customer without altering the balance again.
 */
export const ensureWalletSpendLedgerForOrder = async orderId => {
    if (!orderId) return { created: false, reason: 'missing-order-id' };
    const orderRef = doc(db, 'orders', orderId);
    const transactionRef = doc(db, 'wallet_transactions', `spend-${orderId}`);

    return runTransaction(db, async transaction => {
        const [orderSnapshot, existingTransaction] = await Promise.all([
            transaction.get(orderRef),
            transaction.get(transactionRef),
        ]);
        if (!orderSnapshot.exists()) return { created: false, reason: 'order-missing' };
        const order = orderSnapshot.data();
        const amount = numeric(order.walletApplied);
        const walletId = order.customerWalletId || '';
        if (!walletId || amount <= 0) return { created: false, reason: 'no-wallet-spend' };

        const customerTransactionRef = doc(db, 'customer_wallets', walletId, 'transactions', transactionRef.id);
        if (existingTransaction.exists()) {
            if (!order.walletSpendLedgerCreated || order.walletDebitPending) {
                transaction.update(orderRef, { walletSpendLedgerCreated: true, walletDebitPending: false, updatedAt: serverTimestamp() });
            }
            return { created: false, reason: 'already-recorded' };
        }

        const entry = {
            transactionId: transactionRef.id,
            walletId,
            type: 'spend',
            amount,
            orderId: order.orderId || orderId,
            orderDocumentId: orderId,
            customerName: order.formData?.name || order.customer?.name || order.customerName || '',
            phone: order.formData?.fullPhone || order.formData?.phone || order.phone || '',
            source: 'checkout',
            createdAt: serverTimestamp(),
        };
        transaction.set(transactionRef, entry);
        transaction.set(customerTransactionRef, entry);
        transaction.update(orderRef, { walletSpendLedgerCreated: true, walletDebitPending: false, updatedAt: serverTimestamp() });
        return { created: true, amount, walletId };
    });
};
