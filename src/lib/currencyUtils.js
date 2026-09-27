
export const getLocalizedCurrency = (currencyCode, language) => {
    const code = currencyCode?.toUpperCase() || 'YER';

    if (language === 'ar') {
        const arCurrencies = {
            'YER': 'ريال يمني',
            'SAR': 'ر.س',
            'USD': 'دولار',
            'AED': 'د.إ',
            'KWD': 'د.ك',
            'EGP': 'ج.م'
        };
        return arCurrencies[code] || code;
    }

    return code;
};
