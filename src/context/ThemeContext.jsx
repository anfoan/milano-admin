import { safeLocalGet, safeLocalSet } from '../lib/safeStorage';
import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    // 1. User Theme (Initial state from local storage or null)
    const [userTheme, setUserTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return safeLocalGet('theme');
        }
        return null;
    });

    // 2. Admin Theme (Default: Light)
    const [adminTheme, setAdminTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return safeLocalGet('admin-theme') || 'light';
        }
        return 'light';
    });

    const location = useLocation();
    const isAdmin = location.pathname.startsWith('/milano-secure-gate-99') || location.pathname.startsWith('/milano-dashboard-vault-77');

    // Sync with Firestore for default site theme (Design Settings)
    useEffect(() => {
        if (isAdmin) return;

        const unsubscribe = onSnapshot(doc(db, "settings", "design"), (docSnap) => {
            if (docSnap.exists()) {
                const defaultTheme = docSnap.data().defaultTheme;
                const storedPref = safeLocalGet('theme_manually_set');

                if (!storedPref && defaultTheme) {
                    setUserTheme(defaultTheme);
                    safeLocalSet('theme', defaultTheme);
                }
            }
        });

        return () => unsubscribe();
    }, [isAdmin]);

    // Determine effective theme
    const currentTheme = isAdmin ? adminTheme : (userTheme || 'light');

    // Apply EFFECTIVE theme to document root
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(currentTheme);

        // Persist local storage
        if (isAdmin) {
            safeLocalSet('admin-theme', adminTheme);
        } else if (userTheme) {
            safeLocalSet('theme', userTheme);
        }

    }, [currentTheme, userTheme, adminTheme, isAdmin]);

    // Toggle specific to the current context
    const toggleTheme = () => {
        if (isAdmin) {
            setAdminTheme(prev => prev === 'dark' ? 'light' : 'dark');
        } else {
            const next = currentTheme === 'dark' ? 'light' : 'dark';
            setUserTheme(next);
            safeLocalSet('theme_manually_set', 'true');
        }
    };

    return (
        <ThemeContext.Provider value={{ theme: currentTheme, toggleTheme, isAdmin }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
