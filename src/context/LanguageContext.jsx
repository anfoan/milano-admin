import React, { createContext, useState, useContext, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('ar'); // Default to Arabic
    const [direction, setDirection] = useState('rtl');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Real-time listener for language settings
        const unsubscribe = onSnapshot(doc(db, "settings", "language"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const newLang = data.currentLanguage || 'ar';
                setLanguage(newLang);
                setDirection(newLang === 'ar' ? 'rtl' : 'ltr');

                // Update Document Attributes
                document.documentElement.lang = newLang;
                document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
            } else {
                // Default fallback
                setLanguage('ar');
                setDirection('rtl');
                document.documentElement.lang = 'ar';
                document.documentElement.dir = 'rtl';
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching language settings:", error);
            // Default Fallback on Error
            setLanguage('ar');
            setDirection('rtl');
            document.documentElement.lang = 'ar';
            document.documentElement.dir = 'rtl';
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const t = (key) => {
        const langDict = translations[language] || translations['ar'];
        return langDict[key] || key;
    };

    const value = {
        language,
        direction,
        t,
        loading
    };

    return (
        <LanguageContext.Provider value={value}>
            {!loading && children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
