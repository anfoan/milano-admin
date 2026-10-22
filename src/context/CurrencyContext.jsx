import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CurrencyContext = createContext(null);
// Store reference rates for Sana'a: 1 SAR = 140 YER and 1 USD = 532 YER.
// Values are stored as target-currency units per 1 YER.
const FALLBACK_RATES = { YER: 1, SAR: 1 / 140, USD: 1 / 532 };
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
            const usesOldGlobalSource = String(settings.exchangeRateSource || '').includes('ExchangeRate-API');
            const nextRates = usesOldGlobalSource || !settings.exchangeRates ? FALLBACK_RATES : asRates(settings.exchangeRates);
            setRates(nextRates);

            // Replace the previously stored global mid-market values once; do not fetch them again.
            if ((usesOldGlobalSource || !settings.exchangeRates) && !refreshInFlight.current) {
                refreshInFlight.current = true;
                setDoc(doc(db, 'settings', 'general'), {
                    exchangeRates: FALLBACK_RATES,
                    exchangeRateUpdatedAt: new Date().toISOString(),
                    exchangeRateSource: 'Sana\'a local reference rates: 1 SAR = 140 YER; 1 USD = 532 YER'
                }, { merge: true })
                    .catch(error => console.warn('Unable to save local exchange-rate reference.', error))
                    .finally(() => { refreshInFlight.current = false; });
            }
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
