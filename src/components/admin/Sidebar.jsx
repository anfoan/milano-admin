import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    LayoutDashboard, Package, ShoppingCart, Percent,
    UserX, MessageSquare, Settings, CreditCard,
    Palette, Truck, Briefcase, Inbox, Users,
    PhoneCall, LogOut, ChevronDown, Star, ShoppingBag, Tag, Receipt, BarChart3, Wallet
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, onLogout, isOpen, setIsOpen, lang, toggleLang, unreadCount = 0, newOrdersCount = 0, restrictedTabs = null }) => {


    const t = {
        ar: {
            milano: 'ميلانو',
            panel: 'لوحة التحكم',
            overview: 'لوحة التحكم',
            purchases: 'المشتريات',
            products: 'المنتجات',
            add_product: 'إضافة منتج جديد',
            product_list: 'قائمة المنتجات',
            inventory: 'إدارة المخزون',
            orders: 'الطلبات',
            discount: 'الخصم',
            coupons: 'الكوبونات',
            limited_offers: 'عرض لفترة محدودة',
            reviews: 'آراء العملاء',
            inbox: 'صندوق الوارد',
            delivery: 'إعدادات التوصيل',
            payments: 'المدفوعات',
            store_settings: 'إعدادات المتجر',
            settings: 'الاعدادات',
            social_media: 'التواصل الاجتماعي',
            design: 'التصميم',
            footer_settings: 'إعدادات التذييل',
            logout: 'تسجيل الخروج',
            manual_order: 'إنشاء طلب خارجي',
            orders_list: 'قائمة الطلبات',
            expenses: 'المصروفات والسندات',
            financial_reports: 'التقارير المالية',
            wallet: 'المحفظة'
        },
        en: {
            milano: 'Milano',
            panel: 'Admin Panel',
            overview: 'Dashboard',
            purchases: 'Purchases',
            products: 'Products',
            add_product: 'Add Product',
            product_list: 'Product List',
            inventory: 'Inventory',
            orders: 'Orders',
            discount: 'Discount',
            coupons: 'Coupons',
            limited_offers: 'Limited Offers',
            reviews: 'Reviews',
            inbox: 'Inbox',
            delivery: 'Delivery',
            payments: 'Payments',
            store_settings: 'Store Settings',
            settings: 'Settings',
            social_media: 'Social Media',
            design: 'Design',
            footer_settings: 'Footer Settings',
            logout: 'Logout',
            manual_order: 'Create Manual Order',
            orders_list: 'All Orders',
            expenses: 'Expenses & Bonds',
            financial_reports: 'Financial Reports',
            wallet: 'Wallet'
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';
    // This wallet balance is deliberately separate from Jib Wallet payment activity.
    const [walletDisplayBalance, setWalletDisplayBalance] = useState(0);
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'customer_wallets'), snapshot => {
            const total = snapshot.docs.reduce((sum, item) => sum + Number(item.data().balance || 0), 0);
            setWalletDisplayBalance(total);
        }, error => console.error('Sidebar wallet listener:', error));
        return () => unsubscribe();
    }, []);

    const allMenuItems = [
        { id: 'overview', name: txt.overview, icon: <LayoutDashboard size={20} /> },
        { id: 'purchases', name: txt.purchases, icon: <ShoppingCart size={20} /> },
        {
            id: 'products',
            name: txt.products,
            icon: <Package size={20} />,
            subItems: [
                { id: 'add-product', name: txt.add_product },
                { id: 'product-list', name: txt.product_list },
                { id: 'inventory', name: txt.inventory },
            ]
        },
        {
            id: 'orders-section',
            name: txt.orders,
            icon: <ShoppingBag size={20} />,
            subItems: [
                { id: 'orders', name: txt.orders_list },
                { id: 'pos', name: isRTL ? 'نقطة البيع' : 'Point of Sale' },
                { id: 'manual-order', name: txt.manual_order }
            ]
        },
        { id: 'wallet', name: txt.wallet, icon: <Wallet size={20} /> },
        {
            id: 'discount',
            name: txt.discount,
            icon: <Tag size={20} />,
            subItems: [
                { id: 'coupons', name: txt.coupons },
                { id: 'limited-offers', name: txt.limited_offers }
            ]
        },
        { id: 'reviews', name: txt.reviews, icon: <Star size={20} /> },
        { id: 'design', name: txt.design, icon: <Palette size={20} /> },
        { id: 'inbox', name: txt.inbox, icon: <Inbox size={20} /> },
        { id: 'delivery', name: txt.delivery, icon: <Truck size={20} /> },
        { id: 'payments', name: txt.payments, icon: <CreditCard size={20} /> },
        { id: 'expenses', name: txt.expenses, icon: <Receipt size={20} /> },
        { id: 'financial-reports', name: txt.financial_reports, icon: <BarChart3 size={20} /> },
        {
            id: 'settings-section',
            name: txt.store_settings,
            icon: <Settings size={20} />,
            subItems: [
                { id: 'settings', name: txt.settings },
                { id: 'social-media', name: txt.social_media },
                { id: 'footer-settings', name: txt.footer_settings }
            ]
        },
    ];

    // Filter menu items for restricted users (workers)
    const menuItems = restrictedTabs ? allMenuItems.filter(item => {
        // Check if any sub-item of this item is in the restricted tabs
        if (item.subItems) {
            return item.subItems.some(sub => restrictedTabs.includes(sub.id));
        }
        // Check if the item itself is in restricted tabs
        return restrictedTabs.includes(item.id);
    }).map(item => {
        // If it has subItems, filter those too
        if (item.subItems) {
            return {
                ...item,
                subItems: item.subItems.filter(sub => restrictedTabs.includes(sub.id))
            };
        }
        return item;
    }) : allMenuItems;

    const isSectionActive = (item) => {
        if (activeTab === item.id) return true;
        if (item.subItems?.some(sub => sub.id === activeTab)) return true;
        if (item.id === 'products' && activeTab.includes('product')) return true;
        if (item.id === 'orders-section' && activeTab.includes('manual-order')) return true;
        return false;
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside className={`fixed inset-y-0 z-50 w-72 bg-white dark:bg-[#1c1c1e] h-screen border-gray-100 dark:border-white/5 flex flex-col pt-6 font-['Cairo'] overflow-y-auto scrollbar-hide transition-transform duration-300 ${isRTL ? 'right-0 border-l' : 'left-0 border-r'} ${isOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}`} dir={isRTL ? "rtl" : "ltr"}>
                <div className="px-5 mb-10 flex items-center justify-between">
                    <div
                        className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity translate-x-1"
                        onClick={() => window.location.reload()}
                        title={lang === 'ar' ? "تحديث الصفحة" : "Reload Page"}
                    >
                        <div className="w-11 h-11 bg-transparent rounded-[14px] flex items-center justify-center p-0.5 overflow-hidden">
                            <img src="/admin-new-icon.png" className="w-full h-full object-cover rounded-[12px] mix-blend-multiply dark:mix-blend-lighten" alt="Admin" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-[20px] font-black text-gray-800 dark:text-white leading-tight translate-y-0.5">{txt.milano}</span>
                            <span className="text-[10px] font-bold text-gray-400 capitalize tracking-wide translate-y-[-2px]">{txt.panel}</span>
                        </div>
                    </div>
                    {/* Close button for mobile */}
                    <button onClick={() => setIsOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <LogOut size={20} className="rotate-180" />
                    </button>
                </div>

                <nav className={`${restrictedTabs ? 'flex-1' : 'flex-none'} px-4 space-y-1`}>
                    {menuItems.map((item) => (
                        <div key={item.id} className="space-y-1">
                            {item.id === 'wallet' ? <button
                                onClick={() => setActiveTab(item.id)}
                                className={`relative flex h-12 w-full items-center gap-3 rounded-2xl px-4 font-black transition-all duration-300 ${isSectionActive(item) ? 'bg-[#f4f4f4] text-slate-900 shadow-inner dark:bg-white/10 dark:text-white' : 'bg-[#f7f7f7] text-slate-900 hover:bg-[#f1f1f1] dark:bg-white/5 dark:text-white dark:hover:bg-white/10'}`}
                            >
                                <span className="text-slate-400 dark:text-slate-300">{item.icon}</span>
                                <span className="flex-1 text-right text-[15px]">{item.name}</span>
                                <span dir="ltr" className="inline-flex h-6 min-w-[54px] items-center justify-between gap-1 rounded-md border border-emerald-300 bg-emerald-100 px-1.5 font-sans tabular-nums text-[10px] font-black text-emerald-700 shadow-sm dark:border-emerald-400/50 dark:bg-emerald-400/15 dark:text-emerald-200"><span>$</span><span>{Number(walletDisplayBalance || 0).toLocaleString('en-US')}</span></span>
                            </button> : <button
                                onClick={() => {
                                    if (item.subItems) {
                                        // Toggle logic or just set first sub-item
                                        setActiveTab(item.subItems[0].id);
                                    } else {
                                        setActiveTab(item.id);
                                    }
                                }}
                                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold group ${isSectionActive(item)
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-blue-500'
                                    }`}
                            >
                                <span className={`${isSectionActive(item) ? 'text-white' : 'text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400'}`}>
                                    {item.icon}
                                </span>
                                <span className="text-base font-black flex-1 flex items-center gap-3">
                                    <span>{item.name}</span>
                                    {item.id === 'inbox' && unreadCount > 0 && (
                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-[12px] rounded-full font-black shadow-md animate-pulse shrink-0">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </span>
                                    )}
                                    {item.id === 'orders-section' && newOrdersCount > 0 && (
                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-[12px] rounded-full font-black shadow-md animate-pulse shrink-0">
                                            {newOrdersCount > 99 ? '99+' : newOrdersCount}
                                        </span>
                                    )}
                                </span>
                                {item.subItems && (
                                    <ChevronDown size={16} className={`transition-transform duration-300 ${isSectionActive(item) ? 'rotate-180' : ''}`} />
                                )}
                            </button>}

                            {/* Sub Items */}
                            {item.subItems && isSectionActive(item) && (
                                <div className={`space-y-1 mt-1 mb-2 ${isRTL ? 'mr-6 pr-4 border-r-2' : 'ml-6 pl-4 border-l-2'} border-gray-100 dark:border-white/5`}>
                                    {item.subItems.map((sub) => (
                                        <button
                                            key={sub.id}
                                            onClick={() => setActiveTab(sub.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-extrabold ${activeTab === sub.id
                                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === sub.id ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                            {sub.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                <div className={`p-4 ${restrictedTabs ? 'mt-10 mb-6' : 'mt-6 mb-6'} border-t border-gray-50 dark:border-white/5`}>
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors font-black text-sm"
                    >
                        <LogOut size={20} />
                        <span>{txt.logout}</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
