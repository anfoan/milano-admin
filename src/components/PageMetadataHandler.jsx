import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useSettings } from '../hooks/useSettings';

const PageMetadataHandler = () => {
    const location = useLocation();
    const { generalSettings, imageSettings, storeUrl } = useSettings();

    useEffect(() => {
        // Initial Routing Labels
        let pageTitle = "";
        let pageDesc = "";

        const path = location.pathname;
        if (path === '/') {
           const storeName = generalSettings?.storeName || "متجر ميلانو";
            pageTitle = storeName; // Added this line to ensure pageTitle is set
            pageDesc = "متجر ميلانو لجميع المستلزمات الرياضية للاعبين كرة القدم. بضاعة فيتنامية أعلى خامة في العالم، بواتي حبوب وطرح، فنايل نسخة اللاعبين، وتوصيل لجميع محافظات اليمن.";
        } else if (path === '/offers') {
            pageTitle = `عروض المستلزمات الرياضية - ${generalSettings?.storeName || "متجر ميلانو"}`;
            pageDesc = "أقوى العروض على الأحذية الرياضية (البواتي)، الترنجات، والفنايل من نايك وأديداس وبوما حصرياً في متجر ميلانو.";
        } else if (path.startsWith('/category/')) {
            const catName = decodeURIComponent(path.split('/')[2] || "");
            pageTitle = `${catName} درجة أولى - ${generalSettings?.storeName || "متجر ميلانو"}`;
            pageDesc = `تسوق أفضل ${catName} بخامة فيتنامية وتوصيل سريع في متجر ميلانو للمستلزمات الرياضية.`;
        } else if (path === '/cart') {
            pageTitle = `سلة التسوق - ${generalSettings?.storeName || "متجر ميلانو"}`;
        } else if (path.startsWith('/product/')) {
            // For products, ProductDetail sets the title.
            // We only set a fallback if title is not yet specific.
            if (!document.title.includes(" - ")) {
                pageTitle = `شراء منتج رياضي - ${generalSettings?.storeName || "متجر ميلانو"}`;
            } else {
                pageTitle = document.title;
            }
            pageDesc = "تسوق أفضل المستلزمات الرياضية لكرة القدم (بواتي، فنايل نسخة اللاعبين، ترنكات صوف) بخامة فيتنامية في متجر ميلانو. جودة عالمية وتوصيل لكل اليمن.";
        } else if (path.startsWith('/milano-secure-gate-99') || path.startsWith('/milano-dashboard-vault-77')) {
            pageTitle = "إعدادات ميلانو";
            pageDesc = "لوحة تحكم مدير متجر ميلانو.";
        } else {
            pageTitle = generalSettings?.storeName || "متجر ميلانو";
        }

        // Apply Metadata
        document.title = pageTitle;

        const updateMeta = (name, content, isProperty = false) => {
            if (!content) return;
            let meta = document.querySelector(isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                if (isProperty) meta.setAttribute('property', name);
                else meta.name = name;
                document.head.appendChild(meta);
            }
            meta.content = content;
        };

        // Basic Meta
        updateMeta('description', pageDesc);

        // Open Graph (Facebook, WhatsApp)
        updateMeta('og:title', pageTitle, true);
        updateMeta('og:description', pageDesc, true);
        updateMeta('og:type', 'website', true);
        updateMeta('og:url', storeUrl + location.pathname, true);
        updateMeta('og:site_name', generalSettings?.storeName || "متجر ميلانو", true);

        // Image Handling: Don't overwrite if product page already has an image
        const currentOgImage = document.querySelector('meta[property="og:image"]')?.content;
        const isProductPath = path.startsWith('/product/');
        if (!isProductPath || !currentOgImage || currentOgImage.includes('logo.jpg')) {
            const defaultImg = storeUrl + "/logo.jpg";
            updateMeta('og:image', defaultImg, true);
            updateMeta('twitter:image', defaultImg);
        }

        // Twitter Cards
        updateMeta('twitter:card', 'summary_large_image');
        updateMeta('twitter:title', pageTitle);
        updateMeta('twitter:description', pageDesc);

        // Canonical URL
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.appendChild(canonical);
        }
        canonical.href = storeUrl + location.pathname;

        // JSON-LD Schema (Organization/LocalBusiness)
        let schemaScript = document.querySelector('#schema-org');
        if (!schemaScript) {
            schemaScript = document.createElement('script');
            schemaScript.id = 'schema-org';
            schemaScript.type = 'application/ld+json';
            document.head.appendChild(schemaScript);
        }

        const schemaData = {
            "@context": "https://schema.org",
            "@type": "Store",
            "name": generalSettings?.storeName || "متجر ميلانو",
            "description": "متجر ميلانو لجميع المستلزمات الرياضية للاعبين كرة القدم من شركات (نايك، أديداس، بوما، لاكوست). بضاعة صناعة فيتنامية نضمن لك الحصول على أعلى خامة وجودة في العالم.",
            "url": storeUrl,
            "telephone": generalSettings?.storePhone || "",
            "image": storeUrl + "/logo.jpg",
            "priceRange": "$$",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "اليمن",
                "addressCountry": "YE"
            },
            "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "مستلزمات كرة قدم",
                "itemListElement": [
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "بواتي حبوب وطرح درجة أولى" } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "فنايل نسخة اللاعبين وكلاسيك" } },
                    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "ترنكات وبجايم صوف تركي" } }
                ]
            }
        };
        schemaScript.textContent = JSON.stringify(schemaData);

        // Security: Inject noindex for admin routes
        const isAdminRoute = path.startsWith('/milano-secure-gate-99') || path.startsWith('/milano-dashboard-vault-77');
        if (isAdminRoute) {
            updateMeta('robots', 'noindex, nofollow');
        } else {
            // Remove noindex if moving away from admin (to be safe)
            const existingRobots = document.querySelector('meta[name="robots"]');
            if (existingRobots && existingRobots.content === 'noindex, nofollow') {
                existingRobots.remove();
            }
        }

        // Handle Icon Selection (Reverted to stable logo.jpg as requested)
        const updateFavicon = () => {
            const iconHref = isAdminRoute ? '/admin-icon-192.png' : '/favicon.ico.png';

            // Update Favicon Link
            let link = document.querySelector("link[rel*='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.type = iconHref.endsWith('.png') ? 'image/png' : 'image/jpeg';
            link.href = iconHref;
        };

        // Initial Call
        updateFavicon();

        // 3. Dynamic PWA Manifest Selection
        const updateManifest = () => {
            const isAdmin = location.pathname.startsWith('/milano-secure-gate-99') ||
                location.pathname.startsWith('/milano-dashboard-vault-77');

            let manifestLink = document.querySelector('link[rel="manifest"]');
            if (!manifestLink) {
                manifestLink = document.createElement('link');
                manifestLink.rel = 'manifest';
                document.head.appendChild(manifestLink);
            }
            manifestLink.href = isAdmin ? '/admin-manifest.json' : '/manifest.json';
        };
        updateManifest();

        // Listen for system theme changes
        const matcher = window.matchMedia('(prefers-color-scheme: dark)');
        matcher.addEventListener('change', updateFavicon);

        return () => {
            matcher.removeEventListener('change', updateFavicon);
        };
    }, [location, generalSettings, imageSettings]);

    return null; // This component renders nothing
};

export default PageMetadataHandler;
