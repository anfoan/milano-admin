const getBrowserStorage = (kind) => {
    if (typeof window === 'undefined') return null;
    try {
        return kind === 'session' ? window.sessionStorage : window.localStorage;
    } catch {
        // Some privacy modes expose window but deny storage access entirely.
        return null;
    }
};

const readStorage = (storage, key, fallback = null) => {
    try {
        return storage?.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
};

const writeStorage = (storage, key, value) => {
    try {
        storage?.setItem(key, value);
        return true;
    } catch {
        return false;
    }
};

const removeStorage = (storage, key) => {
    try {
        storage?.removeItem(key);
    } catch {
        // Storage is optional and may be blocked by private browsing policies.
    }
};

export const safeLocalGet = (key, fallback = null) => readStorage(getBrowserStorage('local'), key, fallback);
export const safeSessionGet = (key, fallback = null) => readStorage(getBrowserStorage('session'), key, fallback);
export const safeLocalSet = (key, value) => writeStorage(getBrowserStorage('local'), key, value);
export const safeSessionSet = (key, value) => writeStorage(getBrowserStorage('session'), key, value);
export const safeLocalRemove = (key) => removeStorage(getBrowserStorage('local'), key);
export const safeSessionRemove = (key) => removeStorage(getBrowserStorage('session'), key);

export const safeJsonParse = (value, fallback) => {
    if (value == null || value === '') return fallback;
    try {
        const parsed = JSON.parse(value);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
};
