import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../context/LanguageContext';
import { 
    Banknote, Building2, Wallet, Repeat, Smartphone, 
    CreditCard, Info, ChevronRight, X, MapPin, 
    Award, Phone, Star, Landmark, Coins, ArrowRightLeft, WalletCards, CircleDollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Footer = () => {
    const { language, t } = useLanguage();
    const [footerData, setFooterData] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null); // { title: string, content: string }

    const isRTL = language === 'ar';

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'footer'), (docSnap) => {
            if (docSnap.exists()) {
                setFooterData(docSnap.data());
            }
        });
        return () => unsub();
    }, []);

    if (!footerData) return null;

    const iconMap = {
        Banknote: <Banknote size={20} strokeWidth={2.5} />,
        Building2: <Landmark size={20} strokeWidth={2.5} />,
        Wallet: <Wallet size={20} strokeWidth={2.5} />,
        Repeat: <CircleDollarSign size={20} strokeWidth={2.5} />,
        Smartphone: <Smartphone size={20} strokeWidth={2.5} />,
        CreditCard: <CreditCard size={20} strokeWidth={2.5} />,
        Info: <Info size={20} />
    };

    const colorClasses = {
        green: 'bg-green-100 text-green-600',
        blue: 'bg-blue-100 text-blue-600',
        cyan: 'bg-cyan-100 text-cyan-600',
        purple: 'bg-purple-100 text-purple-600',
        rose: 'bg-rose-100 text-rose-600',
        amber: 'bg-amber-100 text-amber-600',
        gray: 'bg-gray-100 text-gray-600'
    };

    const ColumnHeader = ({ title, className = "text-center" }) => (
        <div className={`mb-2 md:mb-8 w-full ${className}`}>
            <div className="inline-block">
                <h3 className="text-xs sm:text-base md:text-2xl font-black text-gray-900 dark:text-white mb-1 md:mb-2 tracking-wider whitespace-nowrap">
                    {title}
                </h3>
                <div className="h-0.5 md:h-1.5 w-full bg-red-600 rounded-full"></div>
            </div>
        </div>
    );

    return (
        <footer className="bg-white dark:bg-[#0d0d0e] border-t border-gray-100 dark:border-white/5 pt-0 pb-4 md:py-16 px-4 md:px-6 transition-colors duration-300 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
            <div className="max-w-7xl mx-auto grid grid-cols-3 gap-3 md:gap-16 items-start">
                
                {/* Section 1: Payment Methods */}
                <div className={`flex flex-col items-start md:items-center ${isRTL ? 'order-1' : 'order-3'} pe-3 md:pe-0 md:pl-8`}>
                    <ColumnHeader
                        title={footerData.paymentSection?.title || (isRTL ? "طرق الدفع" : "Payment Methods")}
                        className="text-end pl-5 md:pl-56"
                    />
                    <div className="flex flex-col space-y-0.5 md:space-y-2 items-start w-full">
                        {footerData.paymentSection?.items?.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedDetail({ title: item.text, content: item.details })}
                                className="flex items-center justify-start gap-1 md:gap-1.5 w-full min-h-[24px] md:min-h-[24px] md:min-h-[30px] text-gray-800 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-500 transition-colors group overflow-hidden"
                            >
                                <span className={`shrink-0 transition-transform group-hover:scale-110 ${colorClasses[item.color] ? colorClasses[item.color].split(' ')[1] : ''}`}>
                                     {iconMap[item.icon] ? React.cloneElement(iconMap[item.icon], { size: 14, className: "w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]" }) : <CreditCard size={14} className="w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]" />}
                                </span>
                                <span className="shrink font-bold text-[10px] sm:text-[11px] md:text-xs leading-snug tracking-tight text-right">{item.text}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Section 2: FAQ (MIDDLE) */}
                <div className={`flex flex-col order-2 items-center overflow-hidden`}>
                    <ColumnHeader 
                        title={footerData.faqSection?.title || (isRTL ? "الأسئلة الشائعة" : "FAQ")} 
                        className="text-center"
                    />
                    <div className="flex flex-col space-y-0.5 md:space-y-2 items-start w-full">
                        {footerData.faqSection?.items?.map((item, idx) => (
                            <button 
                                key={idx}
                                onClick={() => setSelectedDetail({ title: item.question, content: item.answer })}
                                className={`flex items-center justify-between w-full min-h-[24px] md:min-h-[30px] text-gray-800 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-500 transition-colors group overflow-hidden`}
                            >
                                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 shrink-0 rounded-full transition-all bg-gray-400 dark:bg-gray-500 group-hover:bg-red-600`}></div>
                                <span className="shrink font-bold text-[10px] sm:text-[11px] md:text-xs leading-snug tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${isRTL ? 'text-right' : 'text-left'}">{item.question}</span>
                                <ChevronRight size={12} className={`shrink-0 opacity-40 group-hover:opacity-100 transition-all ${isRTL ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Section 3: Store Info (LEFT in Arabic) */}
                <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'} md:items-end ${isRTL ? 'order-3' : 'order-1'} md:pr-24`}>
                    <div style={isRTL ? {paddingLeft: '20px'} : {}}>
                    <ColumnHeader 
                        title={footerData.storeSection?.title || (isRTL ? "متجر ميلانو" : "Milano Store")} 
                        className={`${isRTL ? 'text-start' : 'text-start pl-8 md:pl-24'}`}
                    />
                    </div>
                    <div className={`space-y-0.5 md:space-y-2 flex flex-col ${isRTL ? 'items-end' : 'items-start'} md:items-end w-full ps-3 md:ps-28`}>
                        <p className="text-gray-800 dark:text-gray-200 font-bold text-[10px] sm:text-[11px] md:text-xs leading-snug tracking-tight text-right w-full pr-4">
                            {footerData.storeSection?.description?.replace(/^[.،]+/, '')?.replace('أونلاين.', '')?.replace(' أونلاين', '')?.replace('أونلاين', '')?.trim()}
                        </p>
                        
                        <div className={`space-y-0.5 md:space-y-2 flex flex-col ${isRTL ? 'items-end' : 'items-start'} md:items-end w-full`}>
                            <div className={`flex items-center justify-between w-full min-h-[24px] md:min-h-[30px] gap-0.5 md:gap-2 group`}>
                                <MapPin size={13} className="shrink-0 text-red-600 sm:w-[16px] sm:h-[16px]" />
                                <span className="shrink text-gray-800 dark:text-gray-200 font-bold text-[10px] sm:text-[11px] md:text-xs leading-snug tracking-tight text-right flex-1">{footerData.storeSection?.address}</span>
                            </div>
                            <div className={`flex items-center justify-between w-full min-h-[24px] md:min-h-[30px] gap-0.5 md:gap-2 group`}>
                                <Award size={13} className="shrink-0 text-amber-500 sm:w-[16px] sm:h-[16px]" />
                                <span className="shrink text-gray-800 dark:text-gray-200 font-bold text-[10px] sm:text-[11px] md:text-xs leading-snug tracking-tight text-right flex-1">{footerData.storeSection?.qualityStatement}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Copyright Section */}
            <div className={`mt-3 md:mt-16 pt-3 md:pt-6 border-t border-gray-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8`}>
                <div className={`flex items-center gap-4 md:gap-8 text-xs md:text-sm font-bold text-gray-400`}>
                    <Link to="/terms" className="hover:text-red-600 transition-colors tracking-tight uppercase">{t('footer.terms')}</Link>
                    <Link to="/privacy" className="hover:text-red-600 transition-colors tracking-tight uppercase">{t('footer.privacy')}</Link>
                </div>
                <p className={`text-[9px] md:text-[10px] text-gray-400 dark:text-gray-600 font-bold tracking-widest uppercase text-center md:text-start`}>
                    © 2026 {t('footer.rights')}
                </p>
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedDetail && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDetail(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-[32px] overflow-hidden shadow-2xl border border-white/10"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <h4 className="text-lg font-black text-gray-900 dark:text-white">{selectedDetail.title}</h4>
                                <button 
                                    onClick={() => setSelectedDetail(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                                >
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto scrollbar-hide">
                                <p className={`text-gray-600 dark:text-gray-400 font-bold leading-loose whitespace-pre-line text-[11px] md:text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {selectedDetail.content || (isRTL ? "لا توجد تفاصيل إضافية متاحة حالياً." : "No additional details available.")}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-white/5 flex justify-center">
                                <button 
                                    onClick={() => setSelectedDetail(null)}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
                                >
                                    {isRTL ? "إغلاق" : "Close"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </footer>
    );
};

export default Footer;
