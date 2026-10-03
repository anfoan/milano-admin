import React, { createContext, useContext, useState, useEffect } from 'react';

const CurrencyContext = createContext();

export const useCurrency = () => {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
};

export const CurrencyProvider = ({ children }) => {
    // Default to YER as requested
    const [activeCurrency, setActiveCurrency] = useState(() => {
        return localStorage.getItem('activeCurrency') || 'YER';
    });

    // Exchange rate: 1 SAR = 140 YER
    const exchangeRate = 140;

    useEffect(() => {
        localStorage.setItem('activeCurrency', activeCurrency);
    }, [activeCurrency]);

    const toggleCurrency = (code) => {
        if (code === 'YER' || code === 'SAR') {
            setActiveCurrency(code);
        }
    };

    /**
     * Converts a YER price (from DB) to a target currency
     * @param {number} priceInYER - The base price from database (assumed YER)
     * @param {string} [targetCurrency] - Optional currency code (defaults to activeCurrency)
     * @returns {number}
     */
    const convertPrice = (priceInYER, targetCurrency) => {
        const currency = targetCurrency || activeCurrency || 'YER';
        const price = Number(priceInYER) || 0;
        if (currency === 'SAR') {
            return price / exchangeRate;
        }
        return price;
    };

    /**
     * Formats a price according to a target currency with commas and precision
     * @param {number} priceInYER - The base price from database
     * @param {string} [targetCurrency] - Optional currency code (defaults to activeCurrency)
     * @returns {string}
     */
    const formatPrice = (priceInYER, targetCurrency) => {
        const currency = targetCurrency || activeCurrency || 'YER';
        const converted = convertPrice(priceInYER, currency);
        const isRTL = document.documentElement.dir === 'rtl' || localStorage.getItem('adminLang') === 'ar' || localStorage.getItem('i18nextLng') === 'ar';
        const symbol = currency === 'SAR' ? (isRTL ? 'ريال سعودي' : 'SAR') : (isRTL ? 'ريال يمني' : 'YER');
        
        // Customer-facing prices use complete currency units only. Calculations
        // retain their original precision; only the displayed amount is rounded.
        const formatted = Math.round(converted).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        return isRTL ? `${formatted} ${symbol}` : `${symbol} ${formatted}`;
    };

    const value = {
        activeCurrency,
        toggleCurrency,
        formatPrice,
        convertPrice,
        exchangeRate,
        currencySymbol: activeCurrency === 'SAR' ? 'ر.س' : 'ر.ي'
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
};
