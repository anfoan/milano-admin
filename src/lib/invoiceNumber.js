import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const COUNTER_PATH = ['settings', 'counters'];

/**
 * Atomically reserves the next six-digit invoice number shared by all invoice sources.
 * Existing invoice/order IDs are never changed.
 */
export const getNextInvoiceNumber = async (db) => {
    const counterRef = doc(db, ...COUNTER_PATH);
    return runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(counterRef);
        const current = snapshot.exists() ? Number(snapshot.data()?.invoiceSequence || 119100) : 119100;
        const next = current + 1;
        transaction.set(counterRef, {
            invoiceSequence: next,
            updatedAt: serverTimestamp()
        }, { merge: true });
        return String(next).padStart(6, '0');
    });
};

export const getNextPurchaseInvoiceNumber = async (db) => {
    const counterRef = doc(db, ...COUNTER_PATH);
    return runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(counterRef);
        const current = snapshot.exists() ? Number(snapshot.data()?.purchaseInvoiceSequence || 18839) : 18839;
        const next = current + 1;
        transaction.set(counterRef, {
            purchaseInvoiceSequence: next,
            updatedAt: serverTimestamp()
        }, { merge: true });
        return String(next);
    });
};
