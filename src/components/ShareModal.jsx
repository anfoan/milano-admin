import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, FileText, Link2, Share2 } from 'lucide-react';

const ShareModal = ({ isOpen, onClose, product }) => {
    if (!isOpen) return null;

    const shareOptions = [
        {
            title: "صور المنتج",
            subtitle: `عدد الصور: ${[product?.mainImage, ...(product?.gallery || [])].filter(Boolean).length}`,
            badge: `${[product?.mainImage, ...(product?.gallery || [])].filter(Boolean).length}`,
            icon: <ImageIcon className="w-6 h-6" />,
            onClick: () => {
                if (product?.mainImage) {
                    window.open(product.mainImage, '_blank');
                }
            }
        },
        {
            title: "مشاركة النص",
            subtitle: "مشاركة وصف المنتج",
            icon: <FileText className="w-6 h-6" />,
            onClick: () => {
                const text = `${product?.name || 'منتج ميلانو'}\nالسعر: ${product?.price || ''} YER\n${window.location.href}`;
                if (navigator.share) {
                    navigator.share({ text }).catch(() => { });
                } else {
                    navigator.clipboard.writeText(text);
                    alert("تم نسخ الوصف!");
                }
            }
        },
        {
            title: "رابط المنتج",
            subtitle: "مشاركة أو نسخ الرابط",
            icon: <Link2 className="w-6 h-6" />,
            onClick: () => {
                const url = window.location.href;
                if (navigator.share) {
                    navigator.share({ url }).catch(() => { });
                } else {
                    navigator.clipboard.writeText(url);
                    alert("تم نسخ الرابط!");
                }
            }
        }
    ];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-2xl bg-[#1c1c1e] rounded-[28px] overflow-hidden shadow-2xl border border-white/5"
                    dir="rtl"
                >
                    {/* Header */}
                    <div className="relative p-6 pt-8 bg-[#252529]">
                        <button
                            onClick={onClose}
                            className="absolute top-6 left-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center justify-center gap-3 mb-2">
                            <h2 className="text-white text-2xl font-black">مشاركة</h2>
                            <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[15px] border-r-blue-500"></div>
                        </div>
                        <p className="text-gray-400 text-center font-bold text-sm">اختر طريقة واحدة للمشاركة.</p>
                    </div>

                    {/* Options Grid */}
                    <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#1c1c1e]">
                        {shareOptions.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={opt.onClick}
                                className="flex flex-col items-center justify-center p-6 rounded-[24px] bg-[#252529] border border-white/5 hover:border-blue-500/50 hover:bg-[#2a2a2e] transition-all group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                                    {opt.icon}
                                </div>
                                <span className="text-white font-black text-lg mb-1">{opt.title}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs font-bold">{opt.subtitle}</span>
                                    {opt.badge && (
                                        <span className="bg-blue-600 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center">
                                            {opt.badge}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ShareModal;
