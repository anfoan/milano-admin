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

export const safeLocalGet = (key, fallback = null) => readStorage(typeof window !== 'undefined' ? window.localStorage : null, key, fallback);
export const safeSessionGet = (key, fallback = null) => readStorage(typeof window !== 'undefined' ? window.sessionStorage : null, key, fallback);
export const safeLocalSet = (key, value) => writeStorage(typeof window !== 'undefined' ? window.localStorage : null, key, value);
export const safeSessionSet = (key, value) => writeStorage(typeof window !== 'undefined' ? window.sessionStorage : null, key, value);
export const safeLocalRemove = (key) => removeStorage(typeof window !== 'undefined' ? window.localStorage : null, key);
export const safeSessionRemove = (key) => removeStorage(typeof window !== 'undefined' ? window.sessionStorage : null, key);

export const safeJsonParse = (value, fallback) => {
    if (value == null || value === '') return fallback;
    try {
        const parsed = JSON.parse(value);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
};
