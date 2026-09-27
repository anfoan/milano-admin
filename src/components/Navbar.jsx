import { useState, useEffect, useRef } from 'react';
import { Menu, X, ShoppingBag, ShoppingCart, Search, ArrowRight, CheckCircle2, Check, Home, LayoutGrid, BadgePercent, Package } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, onSnapshot, doc, limit } from 'firebase/firestore';

import ImageWithFallback from './ImageWithFallback';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { getLocalizedCurrency } from '../lib/currencyUtils';

const Navbar = () => {
    const { theme } = useTheme();
    const { t, language, direction } = useLanguage();
    const { generalSettings, imageSettings, interfaceSettings } = useSettings();
    const { activeCurrency, toggleCurrency, currencySymbol, formatPrice } = useCurrency();
    const currency = currencySymbol;
    const [isOpen, setIsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
    const cartRef = useRef(null);
    const currencyRef = useRef(null);
    const [categories, setCategories] = useState([]);
    // Search State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const isProductPage = location.pathname.startsWith('/product');

    // Close sidebar/cart on route change
    useEffect(() => {
        setIsOpen(false);
        setIsSearchOpen(false);
        setIsCartOpen(false);
    }, [location]);

    // Fetch categories from Firestore
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "categories"));
                const cats = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort by order field
                cats.sort((a, b) => (a.order || 9999) - (b.order || 9999));
                setCategories(cats);
            } catch (err) {
                console.error("Error fetching categories for navbar:", err);
                setCategories([]); // Fallback to empty
            }
        };
        fetchCategories();
    }, []);

    const [cartItems, setCartItems] = useState([]);

    // Listen for cart updates
    // Listen for cart updates
    const updateCartCount = () => {
        try {
            const stored = localStorage.getItem('cart');
            const cart = stored ? JSON.parse(stored) : [];
            if (!Array.isArray(cart)) throw new Error("Invalid cart format");

            const count = cart.reduce((total, item) => total + (item.quantity || 1), 0);
            setCartCount(count);
            setCartItems(cart);
        } catch (error) {
            console.error("Cart data corrupted, resetting:", error);
            localStorage.removeItem('cart');
            setCartCount(0);
            setCartItems([]);
        }
    };

    const cartTotal = cartItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);

    useEffect(() => {
        // Initial count
        updateCartCount();

        const handleCartUpdate = () => {
            updateCartCount();
            // setIsCartOpen(true); // Don't open popover automatically
        };

        window.addEventListener('cart-updated', handleCartUpdate);
        return () => window.removeEventListener('cart-updated', handleCartUpdate);
    }, []);

    // Search Handler
    const handleSearch = async (term) => {
        setSearchTerm(term);
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Fetch products (Optimization: In a real large app, use Algolia/ElasticSearch. 
            // For now, fetching recent products and filtering client-side is acceptable for < 1000 items)
            const q = query(collection(db, "products"), limit(200));
            const querySnapshot = await getDocs(q);

            const results = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(product => {
                if (product.hidden) return false; // Hide hidden products from search

                // New: respect hideOutOfStock setting
                const hideOutOfStock = interfaceSettings?.hideOutOfStock;
                const hasStock = hideOutOfStock ? (Number(product.stock || 0) > 0) : true;
                if (!hasStock) return false;

                const searchLower = term.toLowerCase();
                const nameMatch = product.name?.toLowerCase().includes(searchLower);
                // Check ID (SKU) exact match or prefix
                const idMatch = product.id?.toLowerCase().includes(searchLower);
                const codeMatch = product.code?.toLowerCase().includes(searchLower);
                return nameMatch || idMatch || codeMatch;
            });

            setSearchResults(results);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    // Close cart click-away
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isCartOpen && cartRef.current && !cartRef.current.contains(event.target)) {
                setIsCartOpen(false);
            }
            if (isCurrencyOpen && currencyRef.current && !currencyRef.current.contains(event.target)) {
                setIsCurrencyOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCartOpen, isCurrencyOpen]);


    return (
        <>
            <nav className="bg-white dark:bg-brand-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/5 sticky top-0 z-50 transition-colors duration-300">
                <div className="w-full px-3 md:px-4">
                    <div className="flex justify-between h-16 items-center">

                        {/* Right Section: Title (RTL Order) */}
                        <div className="flex items-center gap-0 pointer-events-auto">
                            {/* Store Title & Logo */}
                            <Link reloadDocument to="/" className="flex items-center gap-2 md:gap-3 font-black text-lg md:text-xl text-gray-900 dark:text-white hover:text-blue-500 transition-colors whitespace-nowrap pl-2">
                                <img
                                    src="/logo-rounded.png"
                                    alt="Milano Logo"
                                    className="w-9 h-9 md:w-10 md:h-10 object-contain rounded-xl shadow-sm"
                                    onError={(e) => {
                                        e.target.src = "/nav-logo.png";
                                    }}
                                    draggable="false"
                                />
                                <span className="pt-1">{generalSettings?.storeName || 'متجر ميلانو'}</span>
                            </Link>
                        </div>

                        {/* Left Section: Search & Theme & Categories (Reordered: Search Right, Theme Middle, Categories Left) */}
                        <div className="flex items-center gap-2 md:gap-3">
                            {/* Search (Restored Frame + Centered) */}
                            <div className="flex flex-col items-center gap-1 translate-y-[3.5px]">
                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    className="bg-gray-100 dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/10 rounded-2xl hover:bg-gray-200 dark:hover:bg-white/5 transition-all w-11 h-11 md:w-12 md:h-12 flex items-center justify-center text-gray-700 dark:text-gray-300 shadow-sm active:scale-95"
                                >
                                    <Search className="h-5 w-5 md:h-5.5 md:w-5.5 text-gray-600 dark:text-gray-400" strokeWidth={2.5} />
                                </button>
                                <span className="text-[9px] md:text-[10px] font-black opacity-0 leading-none select-none">.</span>
                            </div>

                            {/* Theme Toggle (Restored Frame + Centered) */}
                            <div className="flex flex-col items-center gap-1 translate-y-[3.5px]">
                                <div className="transition-all w-11 h-11 md:w-12 md:h-12 flex items-center justify-center">
                                    <ThemeToggle />
                                </div>
                                <span className="text-[9px] md:text-[10px] font-black opacity-0 leading-none select-none">.</span>
                            </div>

                            {/* Categories (Frameless + Leftmost) */}
                            <button 
                                onClick={() => setIsOpen(true)}
                                className="flex flex-col items-center gap-1 group -translate-y-[4.5px] cursor-pointer"
                                aria-label="Categories"
                            >
                                <div className="w-11 h-11 md:w-12 md:h-12 flex items-center justify-center text-purple-600 dark:text-purple-400 transition-all group-active:scale-90">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px] md:w-[24px] md:h-[24px]">
                                        <rect width="7" height="7" x="14" y="3" rx="1.5" />
                                        <rect width="7" height="7" x="3" y="14" rx="1.5" />
                                        <rect width="7" height="7" x="14" y="14" rx="1.5" />
                                        <path d="M8 8 L6.5 10.5 L5 8 L2.5 6.5 L5 5 L6.5 2.5 L8 5 L10.5 6.5 z" />
                                    </svg>
                                </div>
                                <span className="text-[11px] md:text-[12px] font-black text-black dark:text-white tracking-tighter leading-none mt-[-5px]">الفئات</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search Modal Overlay - Full Screen */}
                <AnimatePresence>
                    {isSearchOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-start justify-center pt-16 px-4"
                            onClick={() => setIsSearchOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: -20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: -20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-xl"
                                dir="rtl"
                            >
                                <div className="bg-white dark:bg-[#2a2e35] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10 min-h-[500px] flex flex-col">
                                    {/* Search Input */}
                                    <div className="p-4 border-b border-gray-100 dark:border-white/5">
                                        <div className="flex gap-2 items-center">
                                            <div className="relative flex-1">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => handleSearch(e.target.value)}
                                                    placeholder={t('nav.search_placeholder')}
                                                    className="w-full bg-gray-50 dark:bg-[#1a1d23] border border-gray-200 dark:border-white/10 rounded-xl py-3 pr-4 pl-12 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:border-[#5dade2] transition-colors"
                                                />
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                    {isSearching ? (
                                                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <Search className="h-5 w-5 text-gray-500" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Search Results */}
                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                        {searchTerm.length > 1 && searchResults.length === 0 && !isSearching ? (
                                            <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-center">
                                                <Search className="w-12 h-12 mb-2 opacity-20" />
                                                <p>لم يتم العثور على نتائج</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {searchResults.map((product) => (
                                                    <Link
                                                        key={product.id}
                                                        to={`/product/${product.id}`}
                                                        onClick={() => setIsSearchOpen(false)}
                                                        className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/5"
                                                    >
                                                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-white shrink-0">
                                                            <ImageWithFallback src={product.mainImage} className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="flex-1 text-right">
                                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{product.name}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[#4ade80] font-black text-xs">{formatPrice(product.price)}</span>
                                                                {!interfaceSettings?.hideSKU && (
                                                                    <span className="text-[10px] text-gray-400 bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono">
                                                                        {product.code || product.id.slice(0, 6).toUpperCase()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ArrowRight size={16} className="text-gray-400 flip-rtl" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Sidebar Drawer */}
                <AnimatePresence>
                    {isOpen && (
                        <div className="fixed inset-0 z-[150] flex justify-end">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                            />

                            <motion.div
                                initial={{ x: direction === 'rtl' ? '-100%' : '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: direction === 'rtl' ? '-100%' : '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative w-80 max-w-[85vw] bg-white dark:bg-zinc-950 h-full shadow-2xl overflow-y-auto"
                            >
                                <div className="p-4 sm:p-6 pb-32 flex flex-col min-h-full text-start">
                                    {/* Sidebar Header: Categories Icon & Text */}
                                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/5 pb-3 px-1">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[24px] h-[24px] md:w-[28px] md:h-[28px]">
                                                    <rect width="7" height="7" x="14" y="3" rx="1.5" />
                                                    <rect width="7" height="7" x="3" y="14" rx="1.5" />
                                                    <rect width="7" height="7" x="14" y="14" rx="1.5" />
                                                    <path d="M8 8 L6.5 10.5 L5 8 L2.5 6.5 L5 5 L6.5 2.5 L8 5 L10.5 6.5 z" />
                                                </svg>
                                            </div>
                                            <span className="text-black dark:text-white font-black text-xl md:text-2xl tracking-tight">الفئات</span>
                                        </div>
                                        <button onClick={() => setIsOpen(false)} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center hover:bg-brand-red/10 hover:text-brand-red rounded-full transition-all group">
                                            <X size={22} className="text-gray-600 dark:text-gray-300 transition-transform group-hover:rotate-90" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Dynamic Categories Section */}
                                        <div>
                                            <div className="flex flex-col mb-2 px-2 items-start">
                                                <div className="w-fit">
                                                    <h4 className="text-gray-500 dark:text-gray-400 text-[11px] font-black uppercase tracking-[0.2em]">{t('nav.browse_categories')}</h4>
                                                    <div className="h-1 w-full bg-red-600 mt-1 rounded-full"></div>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                {categories.length > 0 ? (
                                                    categories.map((cat, idx) => (
                                                        <Link
                                                            key={cat.id || idx}
                                                            to={`/category/${encodeURIComponent(cat.name)}`}
                                                            onClick={() => setIsOpen(false)}
                                                            className="block py-2 px-3.5 text-[13.5px] font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/5 transition-all rounded-[12px]"
                                                            draggable="false"
                                                        >
                                                            {cat.name}
                                                        </Link>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-2 text-xs text-gray-500 font-bold">{t('common.loading')}</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Contact & Extra Links */}
                                        <div>
                                            <div className="flex flex-col mb-2 px-2 items-start">
                                                <div className="w-fit">
                                                    <h4 className="text-gray-500 dark:text-gray-400 text-[11px] font-black uppercase tracking-[0.2em]">{t('nav.quick_links')}</h4>
                                                    <div className="h-1 w-full bg-blue-500 mt-1 rounded-full"></div>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <Link to="/contact" onClick={() => setIsOpen(false)} className="block py-2 px-3.5 text-[13.5px] font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all rounded-[12px]" draggable="false">{t('nav.contact')}</Link>
                                                <Link to="/reviews" onClick={() => setIsOpen(false)} className="block py-2 px-3.5 text-[13.5px] font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all rounded-[12px]" draggable="false">{t('nav.reviews')}</Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </nav>

            {/* --- Sticky Bottom Navigation Bar (Floating Watery Glass Pill) --- */}
            <div className={`fixed bottom-1 left-1.5 right-1.5 md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[440px] 
                bg-white/60 dark:bg-[#15171a]/70 backdrop-blur-2xl 
                border border-white/60 dark:border-white/10 
                shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] 
                rounded-[2.2rem] z-[100] pb-safe transition-all duration-500 hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)]`}>
                <div className="flex items-center justify-around h-[64px] md:h-[68px] px-2 relative" dir={direction === 'rtl' ? 'rtl' : 'ltr'}>
                    {/* Home */}
                    <Link to="/" className="relative flex flex-col items-center justify-center w-full h-full text-black hover:text-blue-600 dark:text-white dark:hover:text-blue-400 transition-colors group pointer-events-auto rounded-[1.8rem] py-1">
                        {location.pathname === '/' && (
                            <motion.div
                                layoutId="bottom-nav-watery-bg"
                                className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/15 rounded-[1.8rem] z-0"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                        )}
                        <div className="h-[48px] flex items-center justify-center relative z-10">
                            <img src="/nav-home.png" alt="Home" className="w-[38px] h-[38px] md:w-[42px] md:h-[42px] -translate-y-[3px] transition-transform group-hover:scale-110 object-contain" />
                        </div>
                        <span className="text-[10px] font-black tracking-wider leading-none relative z-10">الرئيسية</span>
                    </Link>

                    {/* Currency Switcher */}
                    <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-auto" ref={currencyRef}>
                        <button 
                            onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
                            className="relative flex flex-col items-center justify-center w-full h-full group rounded-[1.8rem] py-1"
                        >
                            {isCurrencyOpen && (
                                <motion.div
                                    layoutId="bottom-nav-watery-bg"
                                    className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/15 rounded-[1.8rem] z-0"
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                />
                            )}
                            <div className="h-[48px] flex items-center justify-center relative z-10">
                                <img 
                                    src="/nav-currency.png" 
                                    alt="Currency" 
                                    className="w-[50px] h-[50px] md:w-[54px] md:h-[54px] transition-transform group-hover:scale-110 object-contain drop-shadow-md" 
                                />
                            </div>
                            <span className="text-[10px] font-black tracking-wider text-black dark:text-white leading-none relative z-10">العملة</span>
                        </button>

                        <AnimatePresence>
                            {isCurrencyOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute bottom-[76px] w-32 bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-[110]"
                                >
                                    <div className="flex flex-col gap-1">
                                        <button 
                                            onClick={() => { toggleCurrency('YER'); setIsCurrencyOpen(false); }}
                                            className={`p-2 rounded-xl text-xs font-black transition-all ${activeCurrency === 'YER' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}
                                        >
                                            ريال يمني
                                        </button>
                                        <button 
                                            onClick={() => { toggleCurrency('SAR'); setIsCurrencyOpen(false); }}
                                            className={`p-2 rounded-xl text-xs font-black transition-all ${activeCurrency === 'SAR' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}
                                        >
                                            ريال سعودي
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Offers */}
                    <Link to="/offers" className="relative flex flex-col items-center justify-center w-full h-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors group pointer-events-auto rounded-[1.8rem] py-1">
                        {location.pathname === '/offers' && (
                            <motion.div
                                layoutId="bottom-nav-watery-bg"
                                className="absolute inset-0 bg-red-500/10 dark:bg-red-400/15 rounded-[1.8rem] z-0"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                        )}
                        <div className="h-[48px] flex items-center justify-center relative z-10">
                            <img src="/nav-offers.png" alt="Offers" className="w-[38px] h-[38px] md:w-[42px] md:h-[42px] transition-transform group-hover:scale-110 object-contain drop-shadow-md" />
                        </div>
                        <span className="text-[10px] font-black tracking-wider leading-none relative z-10">عروض</span>
                    </Link>

                    {/* Cart Section - Direct Link to /cart */}
                    <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-auto" ref={cartRef}> 
                        <Link to="/cart" className="relative w-full h-full flex flex-col items-center justify-center group rounded-[1.8rem] py-1">
                            {location.pathname === '/cart' && (
                                <motion.div
                                    layoutId="bottom-nav-watery-bg"
                                    className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/15 rounded-[1.8rem] z-0"
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                />
                            )}
                            <div className="h-[48px] flex items-center justify-center relative z-10 -translate-y-[3px]">
                                <div className="relative w-[58px] h-[58px] md:w-[62px] md:h-[62px] flex items-center justify-center">
                                    {/* The New Shopping Cart Image exactly as requested - Theme aware favicons */}
                                    <img 
                                        src={theme === 'dark' ? "/favicon-dark.png" : "/favicon-light.png"} 
                                        alt="Cart" 
                                        className="w-full h-full transition-transform group-hover:scale-[1.15] object-contain relative z-10" 
                                    />

                                    {/* Notification Badge - Positioned near the cart handle on the top-left */}
                                    <span className={`absolute top-[4px] left-[-3px] md:top-[6px] md:left-[-1px] ${cartCount > 0 ? 'bg-yellow-400 text-black' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white'} text-[10px] font-black rounded-full min-w-[17px] h-[17px] flex items-center justify-center shadow-lg border border-white dark:border-[#15171a] z-30 transition-colors`}>
                                        {cartCount}
                                    </span>
                                </div>
                            </div>
                            <span className="text-[10px] font-black tracking-wider text-black group-hover:text-blue-600 dark:text-white dark:hover:text-blue-400 transition-colors leading-none relative z-10">العربة</span>
                        </Link>

                        {/* Mini Cart Dropdown (Floats upwards from the bottom nav) */}
                        <AnimatePresence>
                            {isCartOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className={`absolute bottom-[76px] w-[340px] max-h-[70vh] flex flex-col bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/10 rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] p-5 z-[100] ${direction === 'rtl' ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'}`}
                                >
                                    <div className="flex justify-between items-center mb-6 flex-shrink-0">
                                        <h3 className="text-gray-900 dark:text-white font-black text-lg">{t('nav.cart_title')} {cartCount}</h3>
                                    </div>

                                    {cartItems.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500 font-bold flex-1">
                                            {t('nav.cart_empty')}
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
                                            {cartItems.map((item, idx) => (
                                                <div key={`${item.id}-${idx}`} className="flex items-start gap-4 mb-4 relative border-b border-gray-100 dark:border-white/5 pb-4 last:border-0 last:pb-0 last:mb-0">
                                                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-white/10">
                                                        <ImageWithFallback src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="text-gray-800 dark:text-white font-bold text-sm leading-tight mb-1 line-clamp-2">
                                                            {item.title} {item.size && `(${item.size})`}
                                                        </h4>
                                                        <div className="flex justify-between items-end mt-2">
                                                                <div>
                                                                    <span className="block text-[#16a34a] dark:text-[#4ade80] font-black text-sm">{formatPrice(item.price)}</span>
                                                                </div>
                                                                <div className="w-6 h-6 rounded-full bg-blue-600 dark:bg-[#1e88e5] text-white flex items-center justify-center text-xs font-bold shadow-lg">
                                                                    {item.quantity}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {cartItems.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex-shrink-0">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-gray-500 dark:text-gray-400 font-bold text-sm">{t('nav.cart_total')}</span>
                                                    <span className="text-xl font-black text-[#16a34a] dark:text-[#4ade80]">{formatPrice(cartTotal)}</span>
                                                </div>
                                            <Link
                                                to="/cart"
                                                onClick={() => setIsCartOpen(false)}
                                                className="w-full py-4 bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white rounded-2xl font-black text-base shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                            >
                                                {t('nav.checkout')}
                                                <ArrowRight className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Navbar;
