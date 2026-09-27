import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CACHE_KEYS = {
    INTERFACE: 'settings_interface',
    GENERAL: 'settings_general',
    IMAGES: 'settings_images',
    CART: 'settings_cart',
    SOCIAL: 'settings_social'
};

const getCached = (key, defaultValue) => {
    try {
        const cached = localStorage.getItem(key);
        return cached ? JSON.parse(cached) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

export const useSettings = () => {
    const [interfaceSettings, setInterfaceSettings] = useState(() => getCached(CACHE_KEYS.INTERFACE, {
        lastSeen: true,
        hideOutOfStock: false,
        hideSKU: false,
        hideExtraOptions: false,
        showCountryFlag: true,
        showOffersSection: false,
        showCategories: true,
        productSharing: true,
        contactForm: true
    }));

    const [generalSettings, setGeneralSettings] = useState(() => getCached(CACHE_KEYS.GENERAL, {
        storeName: '',
        currency: 'YER',
        countryFlag: 'ye'
    }));

    const [imageSettings, setImageSettings] = useState(() => getCached(CACHE_KEYS.IMAGES, {
        profileImage: '',
        coverImage: '',
        logoImage: ''
    }));

    const [cartSettings, setCartSettings] = useState(() => getCached(CACHE_KEYS.CART, {
        minOrderAmount: '',
        enableMinAmount: false,
        maxOrderAmount: '',
        enableMaxAmount: false,
        maxProductCount: '',
        enableMaxCount: false
    }));

    const [socialLinks, setSocialLinks] = useState(() => getCached(CACHE_KEYS.SOCIAL, {}));

    const [loading, setLoading] = useState(false); // Default to false since we likely have cache

    useEffect(() => {
        // Real-time listener for interface settings
        const unsubInterface = onSnapshot(doc(db, "settings", "interface"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setInterfaceSettings(prev => ({ ...prev, ...data }));
                localStorage.setItem(CACHE_KEYS.INTERFACE, JSON.stringify(data));
            }
        }, (error) => console.error("Interface settings error:", error));

        // Real-time listener for general settings
        const unsubGeneral = onSnapshot(doc(db, "settings", "general"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setGeneralSettings(prev => ({ ...prev, ...data }));
                localStorage.setItem(CACHE_KEYS.GENERAL, JSON.stringify(data));
            }
        }, (error) => console.error("General settings error:", error));

        // Real-time listener for image settings
        const unsubImages = onSnapshot(doc(db, "settings", "images"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setImageSettings(prev => ({ ...prev, ...data }));
                localStorage.setItem(CACHE_KEYS.IMAGES, JSON.stringify(data));
            }
        }, (error) => console.error("Image settings error:", error));

        // Real-time listener for cart settings
        const unsubCart = onSnapshot(doc(db, "settings", "cart"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setCartSettings(prev => ({ ...prev, ...data }));
                localStorage.setItem(CACHE_KEYS.CART, JSON.stringify(data));
            }
        }, (error) => console.error("Cart settings error:", error));

        // Real-time listener for social links
        const unsubSocial = onSnapshot(doc(db, "settings", "social_links"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setSocialLinks(data);
                localStorage.setItem(CACHE_KEYS.SOCIAL, JSON.stringify(data));
            }
        }, (error) => console.error("Social links error:", error));

        return () => {
            unsubInterface();
            unsubGeneral();
            unsubImages();
            unsubCart();
            unsubSocial();
        };
    }, []);

    const getStoreUrl = () => {
        const url = generalSettings?.storeUrl || window.location.origin;
        return url.replace(/\/$/, ''); // Remove trailing slash if exists
    };

    const getOrderedSocialLinks = () => {
        if (!socialLinks) return [];
        const order = socialLinks.linkOrder || [
            'whatsapp', 'instagram', 'tiktok', 'facebook', 'snapchat', 'youtube', 'twitter', 'googlemap'
        ];
        
        const iconMap = {
            facebook: "https://b3na.com/Store-assets/img/Facebook.webp",
            instagram: "https://b3na.com/Store-assets/img/Instagram.webp",
            tiktok: "https://b3na.com/Store-assets/img/Tiktok.webp",
            whatsapp: "https://b3na.com/Store-assets/img/Whatsapp.webp",
            snapchat: "https://b3na.com/Store-assets/img/Snapchat.webp",
            youtube: "https://b3na.com/Store-assets/img/Youtube.webp",
            twitter: "/twitter.png",
            googlemap: "https://b3na.com/Store-assets/img/GoogleMap.webp"
        };

        const labelMap = {
            facebook: "Facebook",
            instagram: "Instagram",
            tiktok: "TikTok",
            whatsapp: "WhatsApp",
            snapchat: "Snapchat",
            youtube: "YouTube",
            twitter: "Twitter",
            googlemap: "Google Map"
        };

        return order
            .filter(id => socialLinks[id]) // Only include icons with links
            .map(id => ({
                id,
                name: labelMap[id],
                img: iconMap[id],
                link: socialLinks[id],
                size: (id === 'googlemap' || id === 'twitter') ? '38px' : '42px'
            }));
    };

    return { 
        interfaceSettings, 
        generalSettings, 
        imageSettings, 
        cartSettings, 
        socialLinks, 
        orderedSocialLinks: getOrderedSocialLinks(),
        loading,
        storeUrl: getStoreUrl()
    };
};
