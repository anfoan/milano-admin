import { useState, useEffect } from 'react';
import { X, Search, Mail, Bell, Settings, ToggleLeft, ToggleRight, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const AdminSidePanel = ({ isOpen, onClose, lang = 'ar' }) => {
    const isRTL = lang === 'ar';
    const [activeTab, setActiveTab] = useState('messages'); // 'messages' or 'notifications'
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    const t = {
        ar: {
            messages: "رسائل",
            notifications: "إشعارات",
            search: "بحث",
            unread_messages: "الرسائل غير المقروءة",
            no_messages: "لا توجد رسائل جديدة",
            now: "الآن",
            minutes: "دقائق",
            hour: "ساعة",
            day: "يوم",
            new: "جديد",
            read: "مقرؤة",
            email_notifs: "إشعارات البريد الإلكتروني",
            out_of_stock: "المنتج نفذ من المخزون",
            order_complete: "اكتمال الطلبات", // Typo fix from user code
            customer_messages: "رسائل العميل",
            ads: "دعايات"
        },
        en: {
            messages: "Messages",
            notifications: "Notifications",
            search: "Search",
            unread_messages: "Unread Messages",
            no_messages: "No new messages",
            now: "Now",
            minutes: "min",
            hour: "hr",
            day: "day",
            new: "New",
            read: "Read",
            email_notifs: "Email Notifications",
            out_of_stock: "Product Out of Stock",
            order_complete: "Order Completed",
            customer_messages: "Customer Messages",
            ads: "promotions"
        }
    };
    const txt = t[lang];

    // Notification Settings State
    const [notifSettings, setNotifSettings] = useState({
        productOutOfStock: true,
        orderComplete: true,
        customerMessages: true,
        ads: false
    });

    // 1. Fetch Messages Realtime
    useEffect(() => {
        if (!isOpen) return;

        const q = query(
            collection(db, "contact_messages"),
            orderBy("createdAt", "desc"),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(msg => !msg.readByAdmin));
        });

        return () => unsubscribe();
    }, [isOpen]);

    // 2. Fetch Notification Settings
    useEffect(() => {
        if (!isOpen) return;

        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "notifications");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setNotifSettings(docSnap.data());
                }
            } catch (err) {
                console.error("Error fetching notification settings", err);
            }
        };
        fetchSettings();
    }, [isOpen]);

    // Handle Toggle Change
    const handleToggle = async (key) => {
        const newSettings = { ...notifSettings, [key]: !notifSettings[key] };
        setNotifSettings(newSettings); // Optimistic update
        try {
            await setDoc(doc(db, "settings", "notifications"), newSettings);
        } catch (err) {
            console.error("Error updating settings", err);
            // Revert on error could be added here
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
                    />

                    {/* Side Panel */}
                    <motion.div
                        initial={{ x: isRTL ? '-100%' : '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: isRTL ? '-100%' : '100%' }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className={`fixed top-0 ${isRTL ? 'left-0' : 'right-0'} h-full w-full md:w-[400px] bg-white dark:bg-[#111317] shadow-2xl z-[70] flex flex-col font-['Cairo']`}
                        dir={isRTL ? "rtl" : "ltr"}
                    >
                        {/* Header Tabs */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                            <button onClick={onClose} className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                            <div className="flex bg-gray-200 dark:bg-white/10 rounded-lg p-1">
                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'messages' ? 'bg-white dark:bg-[#1c1c1e] text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {txt.messages}
                                </button>
                                <button
                                    onClick={() => setActiveTab('notifications')}
                                    className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'notifications' ? 'bg-white dark:bg-[#1c1c1e] text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {txt.notifications}
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* MESSAGES TAB */}
                            {activeTab === 'messages' && (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={txt.search}
                                            className="w-full bg-gray-100 dark:bg-white/5 border-none rounded-xl px-4 py-3 pr-10 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/50"
                                        />
                                        <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`} size={18} />
                                    </div>

                                    <h3 className="text-sm font-bold text-gray-400 pt-2">{txt.unread_messages}</h3>

                                    <div className="space-y-2">
                                        {messages.length === 0 ? (
                                            <div className="text-center py-10 text-gray-400">
                                                <Mail size={40} className="mx-auto mb-2 opacity-50" />
                                                <p>{txt.no_messages}</p>
                                            </div>
                                        ) : (
                                            messages.map(msg => {
                                                const date = msg.createdAt ? new Date(msg.createdAt.seconds * 1000) : new Date();
                                                const timeDiff = Math.floor((new Date() - date) / 60000); // minutes
                                                let timeDisplay = timeDiff < 60 ? `${timeDiff} ${txt.minutes}` : (timeDiff < 1440 ? `${Math.floor(timeDiff / 60)} ${txt.hour}` : `${Math.floor(timeDiff / 1440)} ${txt.day}`);
                                                if (timeDiff < 1) timeDisplay = txt.now;

                                                return (
                                                    <div
                                                        key={msg.id}
                                                        onClick={async () => {
                                                            window.dispatchEvent(new CustomEvent('admin-navigate', { detail: { view: 'admin-chat', chatId: msg.id } }));
                                                            onClose();
                                                            try {
                                                                await updateDoc(doc(db, "contact_messages", msg.id), { readByAdmin: true });
                                                            } catch (e) {
                                                                console.error("Error marking read", e);
                                                            }
                                                        }}
                                                        className="relative p-4 bg-white dark:bg-white/5 rounded-[20px] hover:shadow-md cursor-pointer transition-all border border-gray-100 dark:border-white/5 group mb-3"
                                                    >
                                                        {/* Date Top Corner */}
                                                        <span className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} text-[10px] text-gray-400 font-bold bg-gray-50 dark:bg-white/10 px-2 py-0.5 rounded-lg`}>
                                                            {date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                                                        </span>

                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 overflow-hidden shrink-0 border-2 border-white dark:border-[#1c1c1e] shadow-sm">
                                                                <img
                                                                    src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${msg.name}`}
                                                                    alt="Avatar"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <h4 className="font-bold text-gray-800 dark:text-white text-sm">{msg.name}</h4>
                                                                <span className="text-xs text-gray-400 font-medium mt-0.5">{timeDisplay}</span>
                                                            </div>
                                                        </div>

                                                        {/* Status Badge Bottom Left */}
                                                        <div className={`absolute bottom-4 ${isRTL ? 'left-4' : 'right-4'}`}>
                                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${msg.status === 'new' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                                                                {msg.status === 'new' ? txt.new : txt.read}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* NOTIFICATIONS TAB */}
                            {activeTab === 'notifications' && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black text-gray-800 dark:text-white text-center pb-4 border-b border-gray-100 dark:border-white/5">
                                        {txt.email_notifs}
                                    </h3>

                                    <div className="space-y-4">
                                        {/* Toggle Item */}
                                        <div className="flex items-center justify-between p-2">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">{txt.out_of_stock}</span>
                                            <button
                                                onClick={() => handleToggle('productOutOfStock')}
                                                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${notifSettings.productOutOfStock ? 'bg-red-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`absolute top-1 right-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${notifSettings.productOutOfStock ? '-translate-x-[20px]' : 'translate-x-0'}`}></span>
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-2">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">{txt.order_complete}</span>
                                            <button
                                                onClick={() => handleToggle('orderComplete')}
                                                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${notifSettings.orderComplete ? 'bg-red-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`absolute top-1 right-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${notifSettings.orderComplete ? '-translate-x-[20px]' : 'translate-x-0'}`}></span>
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-2">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">{txt.customer_messages}</span>
                                            <button
                                                onClick={() => handleToggle('customerMessages')}
                                                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${notifSettings.customerMessages ? 'bg-red-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`absolute top-1 right-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${notifSettings.customerMessages ? '-translate-x-[20px]' : 'translate-x-0'}`}></span>
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-2">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">{txt.ads}</span>
                                            <button
                                                onClick={() => handleToggle('ads')}
                                                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${notifSettings.ads ? 'bg-red-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`absolute top-1 right-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${notifSettings.ads ? '-translate-x-[20px]' : 'translate-x-0'}`}></span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default AdminSidePanel;
