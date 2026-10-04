import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const asText = value => String(value ?? '').trim();
const asAmount = value => Math.max(0, Number(value || 0));

export const isStorefrontCustomerOrder = order => !order?.isPOS && !order?.isExternal && !order?.manualOrder;

export const getCustomerOrderWalletId = order => {
    const directId = asText(order?.customerWalletId || order?.walletId);
    if (directId) return directId;

    const digits = asText(order?.formData?.fullPhone || order?.formData?.phone || order?.phone)
        .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
        .replace(/[^0-9]/g, '');
    const localPhone = digits.startsWith('967') && digits.length === 12 ? digits.slice(3) : digits;
    return localPhone.length >= 7 ? `phone-${localPhone}` : '';
};

export const customerOrderHistoryRef = (walletId, sourceOrderId) =>
    doc(db, 'customer_wallets', walletId, 'orders', sourceOrderId);

export const buildCustomerOrderHistory = (order, sourceOrderId = order?.id) => {
    const walletId = getCustomerOrderWalletId(order);
    const sourceId = asText(sourceOrderId);
    if (!isStorefrontCustomerOrder(order) || !walletId || !sourceId) return null;

    const form = order?.formData || {};
    const history = {
        historyVersion: 1,
        orderType: 'storefront',
        customerWalletId: walletId,
        sourceOrderId: sourceId,
        orderId: asText(order?.orderId || order?.id),
        formData: {
            name: asText(form.name || order?.customerName),
            phone: asText(form.phone || order?.phone),
            fullPhone: asText(form.fullPhone || form.phone || order?.phone),
            country: asText(form.country),
            city: asText(form.city),
            address: asText(form.address),
            notes: asText(form.notes),
            deliveryType: asText(form.deliveryType),
            paymentMethod: asText(form.paymentMethod || order?.paymentMethod),
        },
        cartItems: Array.isArray(order?.cartItems) ? order.cartItems.map(item => ({
            id: asText(item?.id),
            title: asText(item?.title || item?.name),
            image: asText(item?.image || item?.mainImage),
            size: asText(item?.size || item?.selectedSize),
            quantity: Math.max(1, Number(item?.quantity || 1)),
            price: asAmount(item?.price),
        })) : [],
        total: asAmount(order?.total),
        subTotal: asAmount(order?.subTotal),
        discount: asAmount(order?.discount),
        couponDiscount: asAmount(order?.couponDiscount),
        couponCode: asText(order?.couponCode),
        deliveryCost: asAmount(order?.deliveryCost),
        paymentMethod: asText(order?.paymentMethod || form.paymentMethod),
        status: asText(order?.status || 'new') || 'new',
        currency: asText(order?.currency || order?.currencyCode || 'YER') || 'YER',
        date: asText(order?.date),
        walletApplied: asAmount(order?.walletApplied),
        amountDueAfterWallet: asAmount(order?.amountDueAfterWallet),
        walletRewardAmount: asAmount(order?.walletRewardAmount ?? order?.rewardAmount),
        walletRewardGranted: Boolean(order?.walletRewardGranted),
        walletRewardReversed: Boolean(order?.walletRewardReversed),
        createdAt: order?.createdAt || order?.timestamp || serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    if (order?.completedAt) history.completedAt = order.completedAt;
    return history;
};

export const syncCustomerOrderHistory = async (order, sourceOrderId = order?.id) => {
    const history = buildCustomerOrderHistory(order, sourceOrderId);
    if (!history) return false;
    await setDoc(customerOrderHistoryRef(history.customerWalletId, history.sourceOrderId), history, { merge: true });
    return true;
};

export const syncCustomerOrderHistoryById = async sourceOrderId => {
    const snapshot = await getDoc(doc(db, 'orders', sourceOrderId));
    if (!snapshot.exists()) return false;
    return syncCustomerOrderHistory({ id: snapshot.id, ...snapshot.data() }, snapshot.id);
};

export const deleteCustomerOrderHistory = async order => {
    const history = buildCustomerOrderHistory(order, order?.id || order?.sourceOrderId);
    if (!history) return false;
    // Keep a tiny deletion marker instead of removing the history document outright.
    // This guarantees a cached local invoice cannot reappear after an administrator
    // has deleted the matching order from the control panel.
    await setDoc(customerOrderHistoryRef(history.customerWalletId, history.sourceOrderId), {
        ...history,
        deleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
};
