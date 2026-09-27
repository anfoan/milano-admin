import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname } = useLocation();
    const navType = useNavigationType();

    // Save scroll position BEFORE leaving the page
    useEffect(() => {
        // Force manual scroll restoration to prevent browser interference (Crucial for iPhone)
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }

        const saveScrollPosition = () => {
            if (pathname === '/') {
                sessionStorage.setItem('home_scroll_position', window.scrollY.toString());
            }
        };

        // Save on any scroll
        window.addEventListener('scroll', saveScrollPosition);

        return () => {
            window.removeEventListener('scroll', saveScrollPosition);
            // Optional: reset to auto if needed, but keeping manual is safer for SPA
        };
    }, [pathname]);

    // Restore or reset scroll position
    useLayoutEffect(() => {
        // POP = Going back/forward
        if (navType === 'POP') {
            // Do nothing here, let individual pages (like Home) handle their own smart restoration
            // to ensure content is loaded first.
        } else {
            // PUSH or REPLACE = Going to a new page -> Scroll to top
            window.scrollTo(0, 0);
        }
    }, [pathname, navType]);

    return null;
};

export default ScrollToTop;

