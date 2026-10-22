import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CurrencyContext = createContext(null);
const RATES_URL = 'https://open.er-api.com/v6/latest/YER';
const FALLBACK_RATES = { YER: 1, SAR: 1 / 140, USD: 1 / 236 };
const SUPPORTED_CURRENCIES = ['YER', 'SAR', 'USD'];

const asRates = (value) => {
    const source = value && typeof value === 'object' ? value : {};
    return SUPPORTED_CURRENCIES.reduce((result, code) => {
        const rate = Number(source[code]);
        result[code] = Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_RATES[code];
        return result;
    }, {});
};

export const useCurrency = () => {
    const context = useContext(CurrencyContext);
    if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
    return context;
};

export const CurrencyProvider = ({ children }) => {
    const [activeCurrency, setActiveCurrency] = useState('YER');
    const [rates, setRates] = useState(FALLBACK_RATES);
    const refreshInFlight = useRef(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'settings', 'general'), (snapshot) => {
            if (!snapshot.exists()) return;
            const settings = snapshot.data();
            if (SUPPORTED_CURRENCIES.includes(settings.currency)) setActiveCurrency(settings.currency);
            setRates(asRates(settings.exchangeRates));

            const updatedAt = settings.exchangeRateUpdatedAt ? new Date(settings.exchangeRateUpdatedAt).getTime() : 0;
            const stale = !updatedAt || (Date.now() - updatedAt) >= 24 * 60 * 60 * 1000;
            if (!stale || refreshInFlight.current) return;
            refreshInFlight.current = true;

            fetch(RATES_URL)
                .then(response => {
                    if (!response.ok) throw new Error(`Exchange-rate request failed: ${response.status}`);
                    return response.json();
                })
                .then(payload => {
                    if (payload?.result !== 'success') throw new Error('Exchange-rate provider returned an error');
                    const nextRates = asRates(payload.rates);
                    setRates(nextRates);
                    return setDoc(doc(db, 'settings', 'general'), {
                        exchangeRates: nextRates,
                        exchangeRateUpdatedAt: new Date().toISOString(),
                        exchangeRateSource: 'ExchangeRate-API Open Access (https://www.exchangerate-api.com)'
                    }, { merge: true });
                })
                .catch(error => console.warn('Daily exchange-rate refresh skipped; using cached rates.', error))
                .finally(() => { refreshInFlight.current = false; });
        }, error => console.warn('Unable to subscribe to general currency settings.', error));

        return unsubscribe;
    }, []);

    const toggleCurrency = (code) => {
        if (SUPPORTED_CURRENCIES.includes(code)) setActiveCurrency(code);
    };

    // Firestore amounts stay in YER; only presentation values are converted.
    const convertPrice = (priceInYER, targetCurrency = activeCurrency) => {
        const price = Number(priceInYER);
        const rate = rates[targetCurrency] || 1;
        return (Number.isFinite(price) ? price : 0) * rate;
    };

    const convertFromCurrency = (amount, sourceCurrency = 'YER', targetCurrency = activeCurrency) => {
        const value = Number(amount);
        if (!Number.isFinite(value)) return 0;
        return (value / (rates[sourceCurrency] || 1)) * (rates[targetCurrency] || 1);
    };

    const formatPrice = (priceInYER, targetCurrency = activeCurrency) => {
        const currency = targetCurrency || activeCurrency || 'YER';
        const converted = convertPrice(priceInYER, currency);
        const isRTL = document.documentElement.dir === 'rtl' || localStorage.getItem('adminLang') === 'ar';
        const labels = isRTL
            ? { YER: 'ريال يمني', SAR: 'ريال سعودي', USD: 'دولار أمريكي' }
            : { YER: 'YER', SAR: 'SAR', USD: 'USD' };
        const formatted = Math.round(converted).toLocaleString('en-US', { maximumFractionDigits: 0 });
        return isRTL ? `${formatted} ${labels[currency] || currency}` : `${labels[currency] || currency} ${formatted}`;
    };

    return (
        <CurrencyContext.Provider value={{
            activeCurrency,
            rates,
            toggleCurrency,
            formatPrice,
            convertPrice,
            convertFromCurrency,
            exchangeRate: rates.SAR ? 1 / rates.SAR : 140,
            currencySymbol: activeCurrency === 'SAR' ? 'ريال سعودي' : activeCurrency === 'USD' ? 'دولار أمريكي' : 'ريال يمني'
        }}>
            {children}
        </CurrencyContext.Provider>
    );
};
