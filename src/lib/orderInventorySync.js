import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { isCompletedOrderStatus } from './walletRewards';

const itemSize = item => item?.selectedSize || item?.size || '';
const normalizeSize = value => String(value ?? '')
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/^\s*مقاس\s*/i, '')
    .replace(/[：:]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
const resolveSizeKey = (sizeStocks, requestedSize) => {
    if (Object.prototype.hasOwnProperty.call(sizeStocks, requestedSize)) return requestedSize;
    const normalized = normalizeSize(requestedSize);
    return Object.keys(sizeStocks).find(key => normalizeSize(key) === normalized) || null;
};
const groupedItems = items => {
    const groups = new Map();
    (items || []).forEach(item => {
        if (!item?.id) return;
        const group = groups.get(item.id) || { total: 0, bySize: {} };
        const quantity = Math.max(0, Number(item.quantity) || 0);
        group.total += quantity;
        const size = itemSize(item);
        if (size) group.bySize[size] = (group.bySize[size] || 0) + quantity;
        groups.set(item.id, group);
    });
    return groups;
};

/**
 * Inventory is committed only when an order becomes completed. A transition
 * away from completed reverses exactly the previous committed quantity.
 */
export const syncOrderInventoryForStatus = async (orderId, nextStatus) => {
    const orderRef = doc(db, 'orders', orderId);
    const shouldCommit = isCompletedOrderStatus(nextStatus);
    return runTransaction(db, async transaction => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) return { synced: false, reason: 'order-missing' };
        const order = orderSnap.data();
        const wasCommitted = order.inventoryCommitted === true ||
            (order.inventoryCommitted === undefined && isCompletedOrderStatus(order.status));

        if (wasCommitted === shouldCommit) {
            transaction.update(orderRef, { status: nextStatus, inventoryCommitted: shouldCommit, updatedAt: serverTimestamp() });
            return { synced: false, reason: 'already-in-target-state' };
        }

        const groups = groupedItems(order.cartItems);
        const productIds = [...groups.keys()];
        const productRefs = productIds.map(id => doc(db, 'products', id));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        productSnaps.forEach((snap, index) => {
            if (!snap.exists()) throw new Error(`PRODUCT_NOT_FOUND:${productIds[index]}`);
            const product = snap.data();
            const group = groups.get(productIds[index]);
            const hasSizes = product.sizeStocks && Object.keys(product.sizeStocks).length > 0;
            const currentSizes = hasSizes ? { ...product.sizeStocks } : null;
            const currentStock = hasSizes
                ? Object.values(currentSizes).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
                : Math.max(0, Number(product.stock) || 0);
            const direction = shouldCommit ? -1 : 1;

            if (hasSizes) {
                Object.entries(group.bySize).forEach(([size, quantity]) => {
                    const resolvedKey = resolveSizeKey(currentSizes, size);
                    if (!resolvedKey) throw new Error(`SIZE_NOT_FOUND:${productIds[index]}:${size}`);
                    const next = Number(currentSizes[resolvedKey] || 0) + direction * quantity;
                    if (next < 0) throw new Error(`INSUFFICIENT_SIZE_STOCK:${productIds[index]}:${resolvedKey}`);
                    currentSizes[resolvedKey] = next;
                });
                transaction.update(productRefs[index], {
                    sizeStocks: currentSizes,
                    stock: Object.values(currentSizes).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
                });
            } else {
                const nextStock = currentStock + direction * group.total;
                if (nextStock < 0) throw new Error(`INSUFFICIENT_STOCK:${productIds[index]}`);
                transaction.update(productRefs[index], { stock: nextStock });
            }
        });

        transaction.update(orderRef, {
            status: nextStatus,
            inventoryCommitted: shouldCommit,
            inventorySyncedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return { synced: true, committed: shouldCommit };
    });
};
