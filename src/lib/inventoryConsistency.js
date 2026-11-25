import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { getCanonicalSizeStocks, getSizeStocksTotal, toStockNumber } from './stockUtils';

const sameObject = (left, right) => {
    const leftKeys = Object.keys(left || {});
    const rightKeys = Object.keys(right || {});
    if (leftKeys.length !== rightKeys.length) return false;
    return rightKeys.every(key => toStockNumber(left?.[key]) === toStockNumber(right?.[key]));
};

/**
 * Repairs only products whose declared size rows and aggregate stock disagree.
 * It intentionally leaves products without a size variant untouched.
 */
export const reconcileInventoryConsistency = async () => {
    const snapshot = await getDocs(collection(db, 'products'));
    let repaired = 0;

    for (const productDoc of snapshot.docs) {
        const productRef = doc(db, 'products', productDoc.id);
        const changed = await runTransaction(db, async transaction => {
            const latest = await transaction.get(productRef);
            if (!latest.exists()) return false;
            const product = latest.data();
            const canonicalSizes = getCanonicalSizeStocks(product);
            if (!canonicalSizes) return false;
            const expectedStock = getSizeStocksTotal(product, canonicalSizes) || 0;
            const currentStock = toStockNumber(product.stock);
            if (currentStock === expectedStock && sameObject(product.sizeStocks, canonicalSizes)) return false;
            transaction.update(productRef, {
                sizeStocks: canonicalSizes,
                stock: expectedStock
            });
            return true;
        });
        if (changed) repaired += 1;
    }

    return { scanned: snapshot.size, repaired };
};
