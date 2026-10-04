export const DEFAULT_STORE_URL = 'https://5174-iyq0fcwprqoi0zug675oy-96801a4a.sg2.manus.computer';

export const normalizeStoreUrl = (value = '') => String(value).trim().replace(/\/$/, '');
