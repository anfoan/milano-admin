import { doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Reconciles an order that was safely created by a customer while public
 * Firestore rules correctly blocked direct inventory writes. This function
 * runs only from the authenticated admin dashboard and is idempotent.
 */
export const reconcilePendingCustomerOrder = async (orderId) => {
    const orderRef = doc(db, 'orders', orderId);
    return runTransaction(db, async transaction => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) return { reconciled: false, reason: 'order-missing' };
        const order = orderSnap.data();
        if (!order.inventorySyncPending) return { reconciled: false, reason: 'already-synced' };

        const grouped = new Map();
        (order.cartItems || []).forEach(item => {
            const current = grouped.get(item.id) || { items: [], total: 0 };
            current.items.push(item);
            current.total += Number(item.quantity || 0);
            grouped.set(item.id, current);
        });
        const productIds = [...grouped.keys()];
        const productRefs = productIds.map(id => doc(db, 'products', id));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        productSnaps.forEach((snap, index) => {
            const productId = productIds[index];
            const group = grouped.get(productId);
            if (!snap.exists()) throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
            const product = snap.data();
            const stock = Number(product.stock || 0);
            if (group.total <= 0 || group.total > stock) throw new Error(`INSUFFICIENT_STOCK:${productId}`);
            const updates = { stock: stock - group.total };
            if (product.sizeStocks && Object.keys(product.sizeStocks).length) {
                const nextSizes = { ...product.sizeStocks };
                group.items.forEach(item => {
                    if (item.size && Object.prototype.hasOwnProperty.call(nextSizes, item.size)) {
                        const amount = Number(item.quantity || 0);
                        const sizeStock = Number(nextSizes[item.size] || 0);
                        if (amount > sizeStock) throw new Error(`INSUFFICIENT_SIZE_STOCK:${productId}:${item.size}`);
                        nextSizes[item.size] = sizeStock - amount;
                    }
                });
                updates.sizeStocks = nextSizes;
            }
            transaction.update(productRefs[index], updates);
        });

        if (order.couponId) {
            const couponRef = doc(db, 'coupons', order.couponId);
            const couponSnap = await transaction.get(couponRef);
            if (couponSnap.exists() && !couponSnap.data().isUnlimited) {
                const used = Number(couponSnap.data().usedCount || 0);
                const max = Number(couponSnap.data().maxUses || 0);
                if (used >= max) throw new Error('COUPON_LIMIT_REACHED');
                transaction.update(couponRef, { usedCount: increment(1) });
            }
        }
        transaction.update(orderRef, {
            inventorySyncPending: false,
            inventorySyncStatus: 'synced-by-admin',
            inventorySyncedAt: serverTimestamp()
        });
        return { reconciled: true };
    });
};
