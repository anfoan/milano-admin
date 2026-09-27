import React, { useState } from 'react';
import { Settings, Image, Languages, Store, ShoppingBag, ShoppingCart, Globe, CreditCard, ChevronLeft } from 'lucide-react';
import GeneralSettingsForm from './settings/GeneralSettingsForm';
import StoreInterfaceSettings from './settings/StoreInterfaceSettings';
import StoreImageSettings from './settings/StoreImageSettings';
import StoreLanguageSettings from './settings/StoreLanguageSettings';
import OrderPageSettings from './settings/OrderPageSettings';
import StoreCartSettings from './settings/StoreCartSettings';
import StoreDomainSettings from './settings/StoreDomainSettings';
import POSSettings from './settings/POSSettings';

const SettingsView = ({ activeSection, setActiveSection, lang = 'ar' }) => {
    // activeSection and setActiveSection are now passed from AdminDashboard

    const t = {
        ar: {
            title: "إعدادات المتجر",
            home: "الرئيسية",
            settings: "إعدادات المتجر",
            general: { title: 'الإعدادات العامة', description: 'إدارة إعدادات المتجر الأساسية' },
            interface: { title: 'واجهة المتجر', description: 'إعدادات واجهة المتجر' },
            images: { title: 'الصور', description: 'رفع وتنظيم صور متجرك' },
            language: { title: 'لغة المتجر', description: 'تغيير لغة واجهة المتجر' },
            orders: { title: 'إعدادات صفحة الطلب', description: 'تخصيص إعدادات الطلب' },
            cart: { title: 'إعدادات السلة', description: 'تخصيص إعدادات السلة' },
            domain: { title: 'إعدادات النطاق', description: 'ربط وإدارة نطاق المتجر' },
            soon: "قريباً"
        },
        en: {
            title: "Store Settings",
            home: "Home",
            settings: "Store Settings",
            general: { title: 'General Settings', description: 'Manage basic store settings' },
            interface: { title: 'Store Interface', description: 'Store interface settings' },
            images: { title: 'Images', description: 'Upload and organize store images' },
            language: { title: 'Store Language', description: 'Change store interface language' },
            orders: { title: 'Order Page', description: 'Customize order settings' },
            cart: { title: 'Cart Settings', description: 'Customize cart settings' },
            domain: { title: 'Domain Settings', description: 'Connect and manage store domain' },
            soon: "Coming Soon"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    const settingCards = [
        { id: 'general', title: txt.general.title, description: txt.general.description, icon: Settings, component: GeneralSettingsForm },
        { id: 'interface', title: txt.interface.title, description: txt.interface.description, icon: Store, component: StoreInterfaceSettings },
        { id: 'images', title: txt.images.title, description: txt.images.description, icon: Image, component: StoreImageSettings },
        { id: 'language', title: txt.language.title, description: txt.language.description, icon: Languages, component: StoreLanguageSettings },
        { id: 'orders', title: txt.orders.title, description: txt.orders.description, icon: ShoppingBag, component: OrderPageSettings },
        { id: 'cart', title: txt.cart.title, description: txt.cart.description, icon: ShoppingCart, component: StoreCartSettings },
        { id: 'domain', title: txt.domain.title, description: txt.domain.description, icon: Globe, component: StoreDomainSettings },
        { id: 'pos-settings', title: isRTL ? 'المستخدمين والصلاحيات' : 'Users & Permissions', description: isRTL ? 'إدارة صلاحيات دخول العامل' : 'Manage worker credentials', icon: CreditCard, component: POSSettings },
    ];

    if (activeSection) {
        const currentSection = settingCards.find(c => c.id === activeSection);
        const SectionComponent = currentSection?.component;
        return (
            <div className={`max-w-6xl mx-auto font-['Cairo'] pb-10 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? "rtl" : "ltr"}>
                {/* Header managed by SettingsView */}
                <div className="mb-8 flex items-center gap-4 bg-white/50 p-4 rounded-2xl backdrop-blur-sm border border-white/20">
                    <button
                        onClick={() => setActiveSection(null)}
                        className="p-2 hover:bg-white rounded-xl transition-all hover:shadow-sm text-gray-400 hover:text-blue-600"
                    >
                        {isRTL ? <ChevronLeft className="rotate-180" size={24} /> : <ChevronLeft size={24} />}
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
                            <span>{txt.title}</span>
                            <span className="opacity-50">/</span>
                            <span className="text-blue-600">{currentSection?.title}</span>
                        </div>
                        <h1 className="text-xl font-black text-gray-800">{currentSection?.title}</h1>
                    </div>
                </div>
                <SectionComponent lang={lang} onBack={() => setActiveSection(null)} />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto font-['Cairo'] pb-10 px-4" dir={isRTL ? "rtl" : "ltr"}>

            <div className="flex justify-between items-center mb-8">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">{txt.title}</h2>
                    <div className="flex items-center text-sm text-gray-400 font-bold gap-2">
                        <span>{txt.home}</span>
                        <span>{isRTL ? '›' : '‹'}</span>
                        <span>{txt.settings}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {settingCards.map((card) => (
                    <button
                        key={card.id}
                        onClick={() => setActiveSection(card.id)}
                        className="bg-white dark:bg-[#1c1c1e] p-8 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/30 transition-all group flex flex-col items-center text-center h-[200px] justify-center"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-500 group-hover:scale-110 transition-transform mb-4">
                            <card.icon size={24} />
                        </div>
                        <h3 className="font-bold text-gray-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{card.title}</h3>
                        <p className="text-xs text-gray-400 font-bold">{card.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SettingsView;
