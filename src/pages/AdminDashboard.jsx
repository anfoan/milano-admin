import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import Sidebar from '../components/admin/Sidebar';
import SettingsView from '../components/admin/SettingsView';
import AccountSettingsView from '../components/admin/AccountSettingsView'; // Account Settings
import OrdersView from '../components/admin/OrdersView';
import ProductsView from '../components/admin/ProductsView';
import ProductForm from '../components/admin/ProductForm';
import InventoryView from '../components/admin/InventoryView';
import DashboardHome from '../components/admin/DashboardHome';
import ReviewsView from '../components/admin/ReviewsView';
import CouponsView from '../components/admin/CouponsView';
import LimitedOffersView from '../components/admin/LimitedOffersView';
import PaymentsView from '../components/admin/PaymentsView';
import DeliveryView from '../components/admin/DeliveryView'; // New
import ExpensesView from '../components/admin/ExpensesView';
import PurchasesView from '../components/admin/PurchasesView';
import FinancialReportsView from '../components/admin/FinancialReportsView';
import WalletView from '../components/admin/WalletView';
import InboxView from '../components/admin/InboxView'; // New
import AdminChatView from '../components/admin/AdminChatView'; // New Chat View
import OrderDetailsView from '../components/admin/OrderDetailsView'; // New Detail Page
import SocialMediaView from '../components/admin/SocialMediaView'; // New Social Media Page
import ThemeToggle from '../components/ThemeToggle'; // Theme Toggle
import AdminNotifications from '../components/admin/AdminNotifications'; // New Notifications Component
import AdminSidePanel from '../components/admin/AdminSidePanel'; // Side Panel
import DesignView from '../components/admin/DesignView'; // New Design View
import ManualOrderView from '../components/admin/ManualOrderView'; // New Manual Order View
import FooterSettingsView from '../components/admin/FooterSettingsView'; // New Footer Settings
import POSView from '../components/admin/POSView';
import { Menu, Search, Bell, User, PanelRight, ArrowRightFromLine, Store, Settings, LogOut, ShoppingBag, MessageSquare, Wallet, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminDashboard = () => {
    const navigate = useNavigate();
    // Determine worker access before the first render so no empty view flashes briefly.
    const isWorker = sessionStorage.getItem('isPOSWorkerAuthenticated') === 'true';
    const workerPerms = isWorker ? JSON.parse(sessionStorage.getItem('posWorkerPermissions') || '{}') : {};
    const workerAllowedTabs = [];
    if (isWorker) {
        if (workerPerms.allowViewHistory || workerPerms.allowOnlyPrint || workerPerms.allowDiscount || workerPerms.allowChangePayment) workerAllowedTabs.push('pos');
        if (workerPerms.allowExpenses || workerPerms.allowBonds) workerAllowedTabs.push('expenses');
        if (workerPerms.allowManualOrder) workerAllowedTabs.push('manual-order');
    }
    const [activeTab, setActiveTab] = useState(() => isWorker ? (workerAllowedTabs[0] || '') : 'overview');
    const [showRightPanel, setShowRightPanel] = useState(false); // Right Panel State
    const [showProfileMenu, setShowProfileMenu] = useState(false); // Profile Menu State
    const [settingsSection, setSettingsSection] = useState(null); // Settings Section State
    const [editingProduct, setEditingProduct] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null); // For Detail Page
    const [isEditMode, setIsEditMode] = useState(false); // For Detail Page Edit Mode
    const [selectedChatId, setSelectedChatId] = useState(null); // For Admin Chat
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 1280); // Drawer on phones and iPads; fixed rail only on large desktop
    const [lang, setLang] = useState(localStorage.getItem('adminLang') || 'ar'); // Admin Language
    const [generalSettings, setGeneralSettings] = useState({ currency: 'YER' });
    const [unreadCount, setUnreadCount] = useState(0); // For Inbox Badge
    const [newOrdersCount, setNewOrdersCount] = useState(0); // For New Orders Badge
    const [globalSearch, setGlobalSearch] = useState(''); // Global Search State
    const [searchResults, setSearchResults] = useState([]); // Search Results State
    const [isSearchFocused, setIsSearchFocused] = useState(false); // Search Focus State
    const [searchIndex, setSearchIndex] = useState({ products: [], orders: [] }); // Data Index

    // Keep the navigation drawer from consuming tablet content space after a rotation or resize.
    useEffect(() => {
        const closeDrawerOnCompactScreens = () => {
            if (window.innerWidth < 1280) setIsSidebarOpen(false);
        };
        window.addEventListener('resize', closeDrawerOnCompactScreens);
        return () => window.removeEventListener('resize', closeDrawerOnCompactScreens);
    }, []);

    const allNavShortcuts = [
        { id: 'overview', label: lang === 'ar' ? 'نظرة عامة' : 'Overview', icon: <PanelRight size={16}/>, category: 'nav' },
        { id: 'purchases', label: lang === 'ar' ? 'المشتريات' : 'Purchases', icon: <ShoppingBag size={16}/>, category: 'nav' },
        { id: 'financial-reports', label: lang === 'ar' ? 'التقارير المالية' : 'Financial Reports', icon: <PanelRight size={16}/>, category: 'nav' },
        { id: 'product-list', label: lang === 'ar' ? 'قائمة المنتجات' : 'Products List', icon: <ShoppingBag size={16}/>, category: 'nav' },
        { id: 'inventory', label: lang === 'ar' ? 'إدارة المخزون' : 'Inventory Management', icon: <Store size={16}/>, category: 'nav' },
        { id: 'orders', label: lang === 'ar' ? 'الطلبات' : 'Orders', icon: <ShoppingBag size={16}/>, category: 'nav' },
        { id: 'wallet', label: lang === 'ar' ? 'المحفظة' : 'Wallet', icon: <Wallet size={16}/>, category: 'nav' },
        { id: 'inbox', label: lang === 'ar' ? 'الرسائل' : 'Messages/Inbox', icon: <MessageSquare size={16}/>, category: 'nav' },
        { id: 'settings', label: lang === 'ar' ? 'إعدادات المتجر' : 'Store Settings', icon: <Settings size={16}/>, category: 'nav' },
        { id: 'delivery', label: lang === 'ar' ? 'إعدادات التوصيل' : 'Delivery Settings', icon: <Store size={16}/>, category: 'nav' },
        { id: 'payments', label: lang === 'ar' ? 'طرق الدفع' : 'Payment Methods', icon: <Settings size={16}/>, category: 'nav' },
        { id: 'expenses', label: lang === 'ar' ? 'المصروفات والسندات' : 'Expenses & Bonds', icon: <Settings size={16}/>, category: 'nav' },
        { id: 'design', label: lang === 'ar' ? 'تصميم المتجر' : 'Store Design', icon: <PanelRight size={16}/>, category: 'nav' },
        { id: 'coupons', label: lang === 'ar' ? 'الكوبونات' : 'Coupons', icon: <Settings size={16}/>, category: 'nav' },
        { id: 'limited-offers', label: lang === 'ar' ? 'العروض المحدودة' : 'Limited Offers', icon: <Settings size={16}/>, category: 'nav' },
        { id: 'social-media', label: lang === 'ar' ? 'روابط التواصل' : 'Social Media', icon: <MessageSquare size={16}/>, category: 'nav' },
        { id: 'account-settings', label: lang === 'ar' ? 'إعدادات الحساب' : 'Account Settings', icon: <User size={16}/>, category: 'nav' },
        { id: 'manual-order', label: lang === 'ar' ? 'إنشاء طلب خارجي' : 'Manual Order', icon: <ShoppingBag size={16}/>, category: 'nav' },
        { id: 'pos', label: lang === 'ar' ? 'نقطة البيع' : 'Point of Sale', icon: <Store size={16}/>, category: 'nav' },
    ];
    
    const navShortcuts = isWorker 
        ? allNavShortcuts.filter(item => workerAllowedTabs.includes(item.id))
        : allNavShortcuts;

    useEffect(() => {
        // Real-time listener for general settings (currency)
        const unsubscribe = onSnapshot(doc(db, "settings", "general"), (docSnap) => {
            if (docSnap.exists()) setGeneralSettings(docSnap.data());
        });
        const unsubscribeImages = onSnapshot(doc(db, "settings", "images"), (docSnap) => {
            if (docSnap.exists()) setGeneralSettings(prev => ({ ...prev, invoiceLogo: docSnap.data().invoiceLogo || '' }));
        });
        return () => { unsubscribe(); unsubscribeImages(); };
    }, []);

    // Search Indexer (Fetch basic data for instant search)
    useEffect(() => {
        const prodQ = query(collection(db, "products"));
        const unsubProd = onSnapshot(prodQ, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, label: doc.data().name, category: 'product', code: doc.data().code }));
            setSearchIndex(prev => ({ ...prev, products: data }));
        });

        const orderQ = query(collection(db, "orders"));
        const unsubOrder = onSnapshot(orderQ, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, label: `Order #${doc.id.slice(-6)} - ${doc.data().customerName}`, category: 'order', raw: { id: doc.id, ...doc.data() } }));
            setSearchIndex(prev => ({ ...prev, orders: data }));
        });

        return () => { unsubProd(); unsubOrder(); };
    }, []);

    // Global Search Logic
    useEffect(() => {
        if (!globalSearch.trim()) {
            setSearchResults([]);
            return;
        }

        const queryStr = globalSearch.toLowerCase();
        
        // 1. Filter Navigation
        const filteredNav = navShortcuts.filter(item => 
            item.label.toLowerCase().includes(queryStr)
        );

        // 2. Filter Products
        const filteredProds = searchIndex.products.filter(p => 
            p.label.toLowerCase().includes(queryStr) || (p.code && p.code.toLowerCase().includes(queryStr))
        ).slice(0, 5);

        // 3. Filter Orders
        const filteredOrders = searchIndex.orders.filter(o => 
            o.id.toLowerCase().includes(queryStr) || o.label.toLowerCase().includes(queryStr)
        ).slice(0, 5);

        setSearchResults([...filteredNav, ...filteredProds, ...filteredOrders]);
    }, [globalSearch, searchIndex, lang]);

    // Helper to fetch full product for editing from search
    const handleSearchProductClick = async (productId) => {
        try {
            const docSnap = await getDoc(doc(db, "products", productId));
            if (docSnap.exists()) {
                setEditingProduct({ id: docSnap.id, ...docSnap.data() });
                handleTabChange('add-product');
            }
        } catch (error) {
            console.error("Error fetching product from search:", error);
        }
    };

    // Listener for unread messages count only (for sidebar badge)
    useEffect(() => {
        const msgQ = query(collection(db, "contact_messages"), where("status", "==", "new"));
        const unsubMsg = onSnapshot(msgQ, (snapshot) => {
            setUnreadCount(snapshot.size);
        });
        return () => unsubMsg();
    }, []);

    // Count unread storefront, POS, and external orders in the same Orders badge.
    useEffect(() => {
        const ordersQ = query(collection(db, "orders"));
        const unsubOrders = onSnapshot(ordersQ, (snapshot) => {
            const unreadOrders = snapshot.docs.filter(orderDoc => {
                const order = orderDoc.data();
                return (order.status === 'new' && !order.adminViewed) || ((order.isPOS === true || order.isExternal === true) && order.adminViewed === false);
            });
            setNewOrdersCount(unreadOrders.length);
        });
        return () => unsubOrders();
    }, []);

    const toggleLang = () => {
        const newLang = lang === 'ar' ? 'en' : 'ar';
        setLang(newLang);
        localStorage.setItem('adminLang', newLang);
        // Optional: Dispatch event if other components listed need it, though props flow is better
        window.dispatchEvent(new Event('adminLangChange'));
    };

    const t = {
        ar: {
            search_placeholder: "بحث...",
            admin_name: "أدمن ميلانو",
            admin_role: "المشرف العام",
            your_store: "متجرك",
            settings: "الاعدادات",
            logout: "تسجيل خروج"
        },
        en: {
            search_placeholder: "Search...",
            admin_name: "Admin Milano",
            admin_role: "General Manager",
            your_store: "Your Store",
            settings: "Settings",
            logout: "Logout"
        }
    };

    const txt = t[lang];




    // Click Outside Listener for Profile Menu
    const profileMenuRef = React.useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);



    // Strict Access Control
    useEffect(() => {
        const isWorker = sessionStorage.getItem('isPOSWorkerAuthenticated') === 'true';
        if (isWorker) return; // Allow workers through session

        const unsubscribe = auth.onAuthStateChanged(user => {
            if (!user) {
                navigate('/milano-secure-gate-99');
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    // ... (existing imports, but make sure to include auth and signOut if not just relying on local storage)

    const handleLogout = async () => {
        const isWorker = sessionStorage.getItem('isPOSWorkerAuthenticated') === 'true';
        
        if (isWorker) {
            sessionStorage.removeItem('isPOSWorkerAuthenticated');
            sessionStorage.removeItem('posWorkerId');
            sessionStorage.removeItem('posWorkerName');
            sessionStorage.removeItem('posWorkerPermissions');
            // Sign out from Firebase Auth too so it doesn't conflict with admin
            try { await signOut(auth); } catch(e) {}
            navigate('/milano-secure-gate-99');
            return;
        }

        try {
            await signOut(auth);
            localStorage.removeItem('isAdminAuthenticated');
            navigate('/milano-secure-gate-99');
        } catch (error) {
            console.error("Logout Error:", error);
        }
    };

    const handleTabChange = (tab) => {
        if (!tab || tab === activeTab) {
            if (window.innerWidth < 1280) setIsSidebarOpen(false);
            return;
        }
        if (tab === 'settings') setSettingsSection(null);
        setActiveTab(tab);
        // A drawer should never remain layered over the newly selected view on phone/tablet.
        if (window.innerWidth < 1280) setIsSidebarOpen(false);
    };

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setActiveTab('add-product');
    };

    const handleViewOrder = (order, edit = false) => {
        setSelectedOrder(order);
        setIsEditMode(edit);
        setActiveTab('order-details');
    };

    const handleOpenChat = (chatId) => {
        setSelectedChatId(chatId);
        setActiveTab('admin-chat');
    };
    // Keep the global notification navigation listener after its handlers are defined.
    useEffect(() => {
        const handleNavigation = (e) => {
            if (e.detail?.view === 'order-details' && e.detail?.data) handleViewOrder(e.detail.data);
            if (e.detail?.view === 'admin-chat' && e.detail?.chatId) handleOpenChat(e.detail.chatId);
        };
        window.addEventListener('admin-navigate', handleNavigation);
        return () => window.removeEventListener('admin-navigate', handleNavigation);
    }, []);

    const renderView = () => {
        // Guard: restrict workers to allowed tabs only
        if (isWorker && !workerAllowedTabs.includes(activeTab)) {
            return (
                <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4 font-black text-2xl">!</div>
                    <h2 className="text-xl font-black text-gray-800 mb-2">غير مصرح بالوصول</h2>
                    <p className="text-gray-400 text-sm font-bold">لا تملك صلاحية الوصول لهذه الصفحة</p>
                </div>
            );
        }

        switch (activeTab) {
            case 'overview':
                return <DashboardHome setActiveTab={setActiveTab} onViewOrder={handleViewOrder} lang={lang} generalSettings={generalSettings} searchQuery={globalSearch} setSearchQuery={setGlobalSearch} />;
            case 'add-product':
                return <ProductForm editingProduct={editingProduct} setEditingProduct={setEditingProduct} setActiveTab={setActiveTab} lang={lang} />;
            case 'purchases':
                return <PurchasesView lang={lang} generalSettings={generalSettings} />;
            case 'financial-reports':
                return <FinancialReportsView lang={lang} generalSettings={generalSettings} />;
            case 'wallet':
                return <WalletView lang={lang} generalSettings={generalSettings} />;
            case 'product-list':
                return <ProductsView onEdit={handleEditProduct} lang={lang} generalSettings={generalSettings} searchQuery={globalSearch} setSearchQuery={setGlobalSearch} />;
            case 'inventory':
                return <InventoryView lang={lang} generalSettings={generalSettings} searchQuery={globalSearch} setSearchQuery={setGlobalSearch} />;
            case 'inbox': return <InboxView onOpenChat={handleOpenChat} lang={lang} />; // Updated to support chat
            case 'admin-chat': return <AdminChatView chatId={selectedChatId} onBack={() => setActiveTab('inbox')} lang={lang} />;
            case 'delivery': return <DeliveryView lang={lang} generalSettings={generalSettings} />; // New Delivery View
            case 'payments':
                return <PaymentsView lang={lang} generalSettings={generalSettings} />;
            case 'expenses':
                return <ExpensesView lang={lang} generalSettings={generalSettings} />;
            case 'settings':
                return <SettingsView activeSection={settingsSection} setActiveSection={setSettingsSection} lang={lang} />; // Store Grid Layout Settings
            case 'account-settings':
                return <AccountSettingsView lang={lang} />; // Account Details Settings
            case 'social-media':
                return <SocialMediaView lang={lang} />; // New Social Media View
            case 'design':
                return <DesignView lang={lang} />; // New Design View
            case 'footer-settings':
                return <FooterSettingsView lang={lang} />;
            case 'orders':
                return <OrdersView onViewOrder={handleViewOrder} lang={lang} generalSettings={generalSettings} searchQuery={globalSearch} setSearchQuery={setGlobalSearch} />;
            case 'order-details':
                return <OrderDetailsView
                    order={selectedOrder}
                    onBack={() => setActiveTab('orders')}
                    lang={lang}
                    generalSettings={generalSettings}
                    initialEditMode={isEditMode}
                    onUpdate={(updatedData) => setSelectedOrder({ ...selectedOrder, ...updatedData })}
                />;
            case 'reviews':
                return <ReviewsView lang={lang} />;
            case 'coupons':
            case 'coupons-list':
                return <CouponsView lang={lang} generalSettings={generalSettings} />;
            case 'limited-offers':
                return <LimitedOffersView lang={lang} generalSettings={generalSettings} />;
            case 'manual-order':
                return <ManualOrderView lang={lang} generalSettings={generalSettings} searchQuery={globalSearch} setSearchQuery={setGlobalSearch} />;
            case 'pos':
                return <POSView lang={lang} generalSettings={generalSettings} />;

            case 'products':
                return <ProductsView onEdit={handleEditProduct} lang={lang} generalSettings={generalSettings} />;
            default:
                return (
                    <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[32px] border border-gray-100 shadow-sm">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4 font-black text-2xl">!</div>
                        <h2 className="text-xl font-black text-gray-800 mb-2">هذه الصفحة قيد الإنشاء</h2>
                        <p className="text-gray-400 font-bold">نعمل حالياً على تطوير قسم ({activeTab})</p>
                    </div>
                );
        }
    };

    return (
        <div className="admin-dashboard-root min-h-screen min-w-0 bg-[#f8f9fa] dark:bg-[#0a0a0b] flex font-['Cairo'] overflow-x-clip transition-colors duration-300" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {/* Sidebar: overlay drawer through iPad widths, fixed rail on large desktops. */}
                <div className={`fixed inset-y-0 ${lang === 'ar' ? 'right-0' : 'left-0'} z-50 xl:relative transition-[width] duration-300 transform no-print ${isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
                <Sidebar
                    activeTab={activeTab}
                    setActiveTab={handleTabChange}
                    onLogout={handleLogout}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    lang={lang}
                    toggleLang={toggleLang}
                    unreadCount={unreadCount}
                    newOrdersCount={newOrdersCount}
                    restrictedTabs={isWorker ? workerAllowedTabs : null}
                />
            </div>

            {/* Side Panel Component */}
            <AdminSidePanel isOpen={showRightPanel} onClose={() => setShowRightPanel(false)} lang={lang} />

            {/* Main Content Area */}
            <div className="flex-1 flex min-w-0 flex-col h-screen overflow-hidden">
                {/* Top Header Bar (Matching Screenshots) - Add no-print */}
                <header className="h-16 lg:h-20 bg-white dark:bg-[#1c1c1e] border-b border-gray-100 dark:border-white/5 flex items-center justify-between px-3 sm:px-4 lg:px-6 shadow-sm dark:shadow-none z-30 transition-colors duration-300 no-print">
                    <div className="flex min-w-0 items-center gap-3 lg:gap-6">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        >
                            <Menu size={24} className="text-gray-600 dark:text-gray-300" />
                        </button>

                        <div className="hidden lg:flex items-center bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-2 w-80 relative">
                            <Search size={18} className={`text-gray-400 ${lang === 'ar' ? 'ml-2' : 'mr-2'}`} />
                            <input
                                type="text"
                                value={globalSearch}
                                onChange={(e) => setGlobalSearch(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                placeholder={txt.search_placeholder}
                                className="bg-transparent border-none outline-none text-sm font-bold w-full text-gray-900 dark:text-white"
                            />

                            {/* --- GLOBAL SEARCH DROPDOWN --- */}
                            <AnimatePresence>
                                {isSearchFocused && searchResults.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden z-[100] max-h-[400px] overflow-y-auto"
                                    >
                                        <div className="p-2 flex flex-col gap-1">
                                            {searchResults.map((result, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        if (result.category === 'nav') handleTabChange(result.id);
                                                        if (result.category === 'product') handleSearchProductClick(result.id);
                                                        if (result.category === 'order') handleViewOrder(result.raw);
                                                        setGlobalSearch('');
                                                    }}
                                                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors text-right"
                                                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400">
                                                        {result.category === 'nav' ? result.icon : (result.category === 'product' ? <ShoppingBag size={16}/> : <PanelRight size={16}/>)}
                                                    </div>
                                                    <div className="flex flex-col items-start flex-1 overflow-hidden">
                                                        <span className="text-xs font-black text-gray-800 dark:text-white truncate w-full">{result.label}</span>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                            {result.category === 'nav' ? (lang === 'ar' ? 'قسم' : 'Section') : (result.category === 'product' ? (lang === 'ar' ? 'منتج' : 'Product') : (lang === 'ar' ? 'طلب' : 'Order'))}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 lg:gap-3">
                        <div className="flex items-center gap-2 lg:gap-3 ms-0 lg:ms-6">
                            <ThemeToggle />

                            <AdminNotifications lang={lang} />

                            <a
                                href="https://milano2.netlify.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                title={txt.your_store}
                                className="relative p-2.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors translate-y-[3px]"
                            >
                                <Store size={24} className="text-gray-600 dark:text-gray-300" />
                            </a>
                        </div>

                        <div className="h-px w-6 bg-gray-200 dark:bg-white/10 rotate-90 mx-0 hidden lg:block"></div>

                        {!isWorker && <div className="relative" ref={profileMenuRef}>
                            <button
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 p-2 rounded-xl transition-colors"
                            >
                                <div className="hidden lg:flex flex-col items-end">
                                    <span className="text-sm font-black text-gray-800 dark:text-white">{txt.admin_name}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{txt.admin_role}</span>
                                </div>
                                <div className="w-10 h-10 rounded-[14px] overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm relative bg-white flex items-center justify-center p-0.5">
                                    <img src="/admin-new-icon.png" alt="Admin" className="w-full h-full object-cover rounded-[12px]" onError={(e) => e.target.src = '/nav-logo.png'} />
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                                </div>
                            </button>

                            {showProfileMenu && (
                                <div className={`absolute top-full mt-2 w-56 bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-[60] flex flex-col py-2 ${lang === 'ar' ? 'left-0' : 'right-0'}`}>
                                    <a href="https://milano2.netlify.app/" target="_blank" className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors">
                                        <Store size={18} className="text-gray-400" />
                                        <span>{txt.your_store}</span>
                                    </a>
                                    <button onClick={() => { setActiveTab('account-settings'); setShowProfileMenu(false); }} className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors">
                                        <Settings size={18} className="text-gray-400" />
                                        <span>{txt.settings}</span>
                                    </button>
                                    <button onClick={toggleLang} className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors">
                                        <img src={lang === 'ar' ? "https://flagcdn.com/w40/gb.png" : "https://flagcdn.com/w40/sa.png"} alt="Lang" className="w-5 h-auto rounded-sm shadow-sm" />
                                        <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
                                    </button>
                                    <div className="h-px bg-gray-100 dark:bg-white/5 my-1"></div>
                                    <button onClick={handleLogout} className="px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition-colors">
                                        <LogOut size={18} />
                                        <span>{txt.logout}</span>
                                    </button>
                                </div>
                            )}
                        </div>}

                        {!isWorker && <button
                            onClick={() => setShowRightPanel(true)}
                            className="relative p-2.5 bg-green-500/15 dark:bg-green-400/10 hover:bg-green-500/25 rounded-xl transition-colors"
                            title={lang === 'ar' ? 'فتح صندوق الوارد' : 'Open Inbox'}
                        >
                            <MessageSquare size={20} className="text-green-600 dark:text-green-300" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-[#0a0a0b]">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>}
                    </div>
                </header>

                {/* View Content (Scrollable) */}
                <main className="flex-1 min-w-0 overflow-y-auto pt-3 px-3 sm:px-4 lg:pt-4 lg:px-8 xl:px-10 relative">
                    {renderView()}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
