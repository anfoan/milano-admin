import { collection, doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getSizeStock, getSizeStocksTotal } from './stockUtils';

/**
 * Validates an order that was safely created by a customer while public
 * Firestore rules correctly blocked direct inventory writes. Inventory is
 * intentionally committed only by the completed-status transaction, so this
 * function cannot create an early deduction or a later double deduction.
 */
export const reconcilePendingCustomerOrder = async (orderId) => {
    const orderRef = doc(db, 'orders', orderId);
    return runTransaction(db, async transaction => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) return { reconciled: false, reason: 'order-missing' };
        const order = orderSnap.data();
        if (!order.inventorySyncPending && !order.couponUsagePending) return { reconciled: false, reason: 'already-synced' };

        if (!order.inventorySyncPending && order.couponUsagePending && order.couponId) {
            const couponRef = doc(db, 'coupons', order.couponId);
            const couponSnap = await transaction.get(couponRef);
            if (couponSnap.exists() && !couponSnap.data().isUnlimited) {
                const used = Number(couponSnap.data().usedCount || 0);
                const max = Number(couponSnap.data().maxUses || 0);
                if (used >= max) throw new Error('COUPON_LIMIT_REACHED');
                transaction.update(couponRef, { usedCount: increment(1) });
            }
            transaction.update(orderRef, { couponUsagePending: false, couponUsageSyncedAt: serverTimestamp() });
            return { reconciled: true, couponOnly: true };
        }

        const grouped = new Map();
        (order.cartItems || []).forEach(item => {
            const current = grouped.get(item.id) || { items: [], total: 0 };
            current.items.push(item);
            current.total += Number(item.quantity || 0);
            grouped.set(item.id, current);
        });
        const productIds = [...grouped.keys()];
        const productRefs = productIds.map(id => doc(db, 'products', id));
        // Read product documents sequentially before any writes so the transaction
        // remains reliable on browsers that reject concurrent transaction reads.
        const productSnaps = [];
        for (const productRef of productRefs) {
            productSnaps.push(await transaction.get(productRef));
        }

        productSnaps.forEach((snap, index) => {
            const productId = productIds[index];
            const group = grouped.get(productId);
            if (!snap.exists()) throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
            const product = snap.data();
            const hasSizeStocks = product.sizeStocks && Object.keys(product.sizeStocks).length > 0;
            const stock = hasSizeStocks
                ? getSizeStocksTotal(product) ?? Object.values(product.sizeStocks).reduce((sum, quantity) => sum + Math.max(0, Number(quantity) || 0), 0)
                : Math.max(0, Number(product.stock || 0));
            if (group.total <= 0 || group.total > stock) throw new Error(`INSUFFICIENT_STOCK:${productId}`);
            if (hasSizeStocks) {
                group.items.forEach(item => {
                    if (!item.size) throw new Error(`SIZE_REQUIRED:${productId}`);
                    const amount = Number(item.quantity || 0);
                    const sizeStock = getSizeStock(product, item.size);
                    if (amount > sizeStock) throw new Error(`INSUFFICIENT_SIZE_STOCK:${productId}:${item.size}`);
                });
            }
        });

        if (order.couponId && (order.couponUsagePending || order.inventorySyncPending)) {
            const couponRef = doc(db, 'coupons', order.couponId);
            const couponSnap = await transaction.get(couponRef);
            if (couponSnap.exists() && !couponSnap.data().isUnlimited) {
                const used = Number(couponSnap.data().usedCount || 0);
                const max = Number(couponSnap.data().maxUses || 0);
                if (used >= max) throw new Error('COUPON_LIMIT_REACHED');
                transaction.update(couponRef, { usedCount: increment(1) });
            }
        }
        if (order.walletDebitPending && Number(order.walletApplied || 0) > 0) {
            const walletTransactionRef = doc(collection(db, 'wallet_transactions'));
            transaction.set(walletTransactionRef, {
                walletId: order.customerWalletId || '',
                type: 'spend',
                amount: Number(order.walletApplied || 0),
                orderId: order.orderId || order.id || orderId,
                customerName: order.formData?.name || '',
                phone: order.formData?.fullPhone || order.formData?.phone || '',
                source: 'checkout',
                createdAt: serverTimestamp()
            });
        }
        transaction.update(orderRef, {
            inventorySyncPending: false,
            inventorySyncStatus: 'awaiting-completion',
            couponUsagePending: false,
            walletDebitPending: false,
            inventorySyncedAt: serverTimestamp()
        });
        return { reconciled: true };
    });
};
