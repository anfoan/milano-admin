import { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Check, ShoppingBag, Clock, MessageSquare, X } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, limit, updateDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '../../context/CurrencyContext';

const AdminNotifications = ({ lang: propLang }) => {
    const { formatPrice } = useCurrency();
    const [isOpen, setIsOpen] = useState(false);
    const [activeToast, setActiveToast] = useState(null);
    
    // Counters to prevent sound/toast looping
    const lastOrderCount = useRef(0);
    const lastMessageCount = useRef(0);
    const lastNotifiedId = useRef(localStorage.getItem('milano_last_notified_order_id') || '');

    const lang = propLang || localStorage.getItem('adminLang') || 'ar';
    const isRTL = lang === 'ar';
    const dropdownRef = useRef(null);
    const toastTimerRef = useRef(null);

    const [orderNotifications, setOrderNotifications] = useState([]);
    const [messageNotifications, setMessageNotifications] = useState([]);
    const [authReady, setAuthReady] = useState(false);
    const notificationAudioRef = useRef(null);

    // Workers use a local login, so prepare their Firebase anonymous session
    // before starting the notification listeners.
    useEffect(() => {
        let mounted = true;
        const isWorker = sessionStorage.getItem('isPOSWorkerAuthenticated') === 'true';
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (isWorker && !user) {
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error('Worker notification auth failed', error);
                    return;
                }
            }
            if (mounted) setAuthReady(true);
        });
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    // Browsers require a user gesture before allowing later notification audio.
    useEffect(() => {
        const unlockAudio = () => {
            if (!notificationAudioRef.current) {
                notificationAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                notificationAudioRef.current.volume = 0.01;
            }
            const audio = notificationAudioRef.current;
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1;
            }).catch(() => {});
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
        window.addEventListener('pointerdown', unlockAudio, { once: true });
        window.addEventListener('keydown', unlockAudio, { once: true });
        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // New Listeners for both Orders and Messages
    useEffect(() => {
        if (!authReady) return undefined;
        const orderQ = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(1));
        const messageQ = query(collection(db, "contact_messages"), where("status", "==", "new"), orderBy("createdAt", "desc"), limit(1));

        const playNotificationSound = () => {
             const audio = notificationAudioRef.current || new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
             notificationAudioRef.current = audio;
             audio.volume = 1;
             audio.currentTime = 0;
             audio.play().catch(e => console.log("Audio play failed", e));
        };

        const showToast = (item) => {
            window.clearTimeout(toastTimerRef.current);
            setActiveToast(item);
            playNotificationSound();
            // Keep one controlled timer so repeated snapshots cannot stack visual toasts.
            toastTimerRef.current = window.setTimeout(() => setActiveToast(null), 6000);
        };

        const unsubscribeOrders = onSnapshot(orderQ, (snapshot) => {
            if (snapshot.empty) return;
            
            const latestDoc = snapshot.docs[0];
            const latestOrder = { id: latestDoc.id, type: 'order', ...latestDoc.data() };

            // Show toast if this is a genuinely new order (different from last notified)
            if (latestOrder.id !== lastNotifiedId.current) {
                showToast(latestOrder);
                lastNotifiedId.current = latestOrder.id;
                localStorage.setItem('milano_last_notified_order_id', latestOrder.id);
            }
            lastOrderCount.current = snapshot.size;

            // Also update the full list (separately if needed, or we can just fetch more)
            // For the dropdown, we need the last 10
        });

        // Separate listener for the full list (to keep logic clean)
        const fullOrdersQ = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(10));
        const unsubscribeFullOrders = onSnapshot(fullOrdersQ, (snap) => {
             setOrderNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeMessages = onSnapshot(messageQ, (snapshot) => {
            if (snapshot.empty) return;

            const latestDoc = snapshot.docs[0];
            const latestMsg = { id: latestDoc.id, type: 'message', ...latestDoc.data() };
            
            // Sound/Toast logic for Messages
            if (lastMessageCount.current !== 0 && snapshot.size > lastMessageCount.current) {
                 showToast(latestMsg);
            }
            lastMessageCount.current = snapshot.size;

            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                type: 'message',
                ...doc.data()
            }));
            setMessageNotifications(messages);
        });

        return () => {
            unsubscribeOrders();
            unsubscribeFullOrders();
            unsubscribeMessages();
            window.clearTimeout(toastTimerRef.current);
        };
    }, [authReady]);

    // These values are fully derived from the two realtime sources. Keeping them out
    // of a second effect avoids an extra header render after every snapshot.
    const { notifications, unreadCount } = useMemo(() => {
        const notifications = [
            ...orderNotifications.map(o => ({ ...o, type: 'order', sortDate: o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.date) })),
            ...messageNotifications.map(m => ({ ...m, type: 'message', sortDate: m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.date) }))
        ].sort((a, b) => b.sortDate - a.sortDate);
        const unreadCount = notifications.filter(n => ((n.type === 'order' && (n.status === 'new' || n.isPOS === true || n.isExternal === true) && !n.adminViewed) || (n.type === 'message' && n.status === 'new'))).length;
        return { notifications, unreadCount };
    }, [orderNotifications, messageNotifications]);

    const handleMarkAsRead = async () => {
        // This is tricky if we don't have a 'read' field.
        // User asked for "Mark all as read". 
        // If we change status to 'processing', it moves them out of 'new' bucket.
        // Let's ask user or just implement it as changing status to 'processing'?
        // No, that changes business logic. 
        // Let's implement a local "viewed" state or a separate field `adminViewed: true`.

        // For now, "Mark as read" might just be a visual clear if we don't update DB.
        // But to be "Real", we should probably update a field `adminViewed`.
        // Let's check if we can update documents.

        const unreadDocs = notifications.filter(n => n.type === 'order' && (n.status === 'new' || n.isPOS === true || n.isExternal === true) && !n.adminViewed);

        unreadDocs.forEach(async (order) => {
            try {
                const orderRef = doc(db, "orders", order.id);
                await updateDoc(orderRef, { adminViewed: true });
            } catch (e) {
                console.error("Error marking read", e);
            }
        });
        setIsOpen(false);
    };

    // Translation Object
    const t = {
        ar: {
            title: "إشعارات",
            mark_read: "وضع الكل كمقروءة",
            no_notifs: "لا توجد إشعارات جديدة",
            new_order: "تلقيت طلب جديد بقيمة",
            moments: "منذ لحظات",
            minute: "دقيقة",
            hour: "ساعة",
            day: "يوم",
            ago: "منذ"
        },
        en: {
            title: "Notifications",
            mark_read: "Mark all as read",
            no_notifs: "No new notifications",
            new_order: "New order received: ",
            moments: "Just now",
            minute: "m",
            hour: "h",
            day: "d",
            ago: "ago"
        }
    };
    const txt = t[lang];
    const getOrderImage = (order) => order?.cartItems?.[0]?.image || order?.items?.[0]?.image || order?.productImage || '';
    const isUnreadOrder = (order) => order?.type === 'order' && (order.status === 'new' || order.isPOS === true || order.isExternal === true) && !order.adminViewed;

    // Helper to format time "2 days ago" etc
    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return txt.moments;
        const minutes = Math.floor(seconds / 60);

        if (lang === 'ar') {
            if (minutes < 60) return `منذ ${minutes} دقيقة`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `منذ ${hours} ساعة`;
            const days = Math.floor(hours / 24);
            return `منذ ${days} يوم`;
        } else {
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            return `${days}d ago`;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* --- Premium Floating Toast --- */}
            <AnimatePresence>
                {activeToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, x: '-50%', scale: 0.8 }}
                        animate={{ opacity: 1, y: 20, x: '-50%', scale: 1 }}
                        exit={{ opacity: 0, y: -20, x: '-50%', scale: 0.8 }}
                        className="fixed top-0 left-1/2 z-[9999] w-[90%] max-w-sm"
                    >
                        <div 
                            onClick={() => {
                                if (activeToast.type === 'order') {
                                    window.dispatchEvent(new CustomEvent('admin-navigate', { detail: { view: 'order-details', data: activeToast } }));
                                } else {
                                    window.dispatchEvent(new CustomEvent('admin-navigate', { detail: { view: 'admin-chat', chatId: activeToast.id } }));
                                }
                                setActiveToast(null);
                            }}
                            className="bg-white dark:bg-[#1c1c1e] border-2 border-[#10b981] shadow-[0_20px_50px_rgba(16,185,129,0.2)] rounded-2xl p-4 flex items-center gap-4 cursor-pointer active:scale-95 transition-transform"
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${activeToast.type === 'order' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-blue-100 text-blue-600'}`}>
                                {activeToast.type === 'order' && getOrderImage(activeToast) ? <img src={getOrderImage(activeToast)} alt="" className="h-full w-full object-cover" /> : activeToast.type === 'order' ? <ShoppingBag size={24} className="animate-bounce" /> : <MessageSquare size={24} className="animate-pulse" />}
                            </div>
                            <div className="flex-1 min-w-0 text-start">
                                <h4 className="font-black text-gray-900 dark:text-white text-sm">
                                    {activeToast.type === 'order' ? (lang === 'ar' ? 'طلب جديد وصل! 🎉' : 'New Order! 🎉') : (lang === 'ar' ? 'رسالة جديدة ✉️' : 'New Message ✉️')}
                                </h4>
                                <p className="text-xs text-gray-500 truncate">
                                    {activeToast.type === 'order' ? 
                                        `${formatPrice(activeToast.total !== undefined ? activeToast.total : ((activeToast.subTotal || 0) - (activeToast.discount || 0) + (activeToast.deliveryCost || 0)), activeToast.currency || 'YER')} - ${activeToast.formData?.name || (lang === 'ar' ? 'زائر' : 'Guest')}` : 
                                        `${activeToast.name}: ${activeToast.message?.substring(0, 30)}...`}
                                </p>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setActiveToast(null); }}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors translate-y-[3px]"
                title={txt.title}
            >
                <Bell size={24} className="text-gray-600 dark:text-gray-300" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[10px] font-black min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center border border-white dark:border-[#1c1c1e] shadow-sm">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`absolute mt-2 w-80 md:w-96 bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden z-[100] ${isRTL ? 'left-0' : 'right-0'}`}
                    >
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                            <h3 className="font-black text-gray-800 dark:text-white">{txt.title}</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAsRead}
                                    className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                >
                                    <Check size={14} />
                                    {txt.mark_read}
                                </button>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <Bell size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="font-bold text-sm">{txt.no_notifs}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 dark:divide-white/5">
                                    {notifications.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                setIsOpen(false);
                                                if (item.type === 'order') {
                                                    window.dispatchEvent(new CustomEvent('admin-navigate', { detail: { view: 'order-details', data: item } }));
                                                } else {
                                                    window.dispatchEvent(new CustomEvent('admin-navigate', { detail: { view: 'admin-chat', chatId: item.id } }));
                                                }
                                            }}
                                            className={`p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer flex gap-3 ${isRTL ? 'text-right' : 'text-left'} ${((item.type === 'order' && isUnreadOrder(item)) || (item.type === 'message' && item.status === 'new')) ? 'bg-blue-50/30' : ''}`}
                                        >
                                            <div className="shrink-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isUnreadOrder(item) || item.status === 'new' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                                    {item.type === 'order' && getOrderImage(item) ? <img src={getOrderImage(item)} alt="" className="h-full w-full object-cover" /> : item.type === 'order' ? <ShoppingBag size={18} /> : <MessageSquare size={18} />}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {item.type === 'order' ? (
                                                    <p className="text-sm font-bold text-gray-800 dark:text-white mb-1">
                                                        {txt.new_order} <span dir="ltr" className="font-black">{formatPrice(item.total !== undefined ? item.total : ((item.subTotal || 0) - (item.discount || 0) + (item.deliveryCost || 0)), item.currency || 'YER')}</span>
                                                    </p>
                                                ) : (
                                                    <p className="text-sm font-bold text-gray-800 dark:text-white mb-1">
                                                        رسالة جديدة من: <span className="text-blue-600">{item.name}</span>
                                                    </p>
                                                )}
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-gray-500 font-mono">
                                                        {item.type === 'order' ? item.orderId : (item.subject || 'بدون موضوع')}
                                                    </span>
                                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {formatTimeAgo(item.createdAt?.toDate ? item.createdAt.toDate() : (item.date || new Date()))}
                                                    </span>
                                                </div>
                                            </div>
                                            {((item.type === 'order' && isUnreadOrder(item)) || (item.type === 'message' && item.status === 'new')) && (
                                                <div className="shrink-0 self-center">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white dark:ring-[#1c1c1e]"></div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminNotifications;
