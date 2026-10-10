export const toStockNumber = value => {
    const normalized = String(value ?? '')
        .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
        .replace(/,/g, '')
        .trim();
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
};

export const normalizeSize = value => String(value ?? '')
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/^\s*مقاس\s*/i, '')
    .replace(/[：:]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

export const getSizeStock = (product, requestedSize) => {
    const stocks = product?.sizeStocks;
    if (!stocks || typeof stocks !== 'object') return toStockNumber(product?.stock);
    const key = Object.prototype.hasOwnProperty.call(stocks, requestedSize)
        ? requestedSize
        : Object.keys(stocks).find(candidate => normalizeSize(candidate) === normalizeSize(requestedSize));
    return key == null ? 0 : Math.max(0, toStockNumber(stocks[key]));
};

export const resolveSizeKey = (sizeStocks, requestedSize) => {
    if (Object.prototype.hasOwnProperty.call(sizeStocks || {}, requestedSize)) return requestedSize;
    return Object.keys(sizeStocks || {}).find(candidate => normalizeSize(candidate) === normalizeSize(requestedSize)) || null;
};

export const getAvailableProductStock = product => {
    const stocks = product?.sizeStocks;
    if (stocks && typeof stocks === 'object' && Object.keys(stocks).length > 0) {
        return Object.values(stocks).reduce((sum, value) => sum + Math.max(0, toStockNumber(value)), 0);
    }
    return Math.max(0, toStockNumber(product?.stock));
};
