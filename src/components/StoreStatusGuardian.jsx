import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const StoreStatusGuardian = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Listen to global store status
        const unsub = onSnapshot(doc(db, "settings", "store"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setIsOpen(data.isOpen);

                // If it's busy and we haven't dismissed it this session, show it
                if (!data.isOpen && !dismissed) {
                    setShowModal(true);
                }
            }
        });

        return () => unsub();
    }, [dismissed]);

    const handleDismiss = () => {
        setShowModal(false);
        setDismissed(true);
    };

    if (!showModal) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white dark:bg-[#1c1c1e] rounded-[28px] shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden border border-white/10"
                >
                    {/* Background Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-orange-500/10 blur-[50px] rounded-full pointer-events-none" />

                    <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-500 mx-auto flex items-center justify-center mb-6 ring-4 ring-orange-50 dark:ring-orange-500/10">
                        <AlertCircle size={40} />
                    </div>

                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                        المتجر مشغول حالياً
                    </h3>

                    <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
                        لا يزال بإمكانك التصفح وتجهيز عربة التسوق، ولكن تم إيقاف استقبال الطلبات مؤقتاً.
                    </p>

                    <button
                        onClick={handleDismiss}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-400 to-blue-300 hover:from-blue-300 hover:to-blue-200 text-white font-black text-lg shadow-lg shadow-blue-400/30 transition-all transform active:scale-95"
                    >
                        نعم
                    </button>

                    {/* Close button - subtle */}
                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default StoreStatusGuardian;
