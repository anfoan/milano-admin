import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
    Save, Plus, Trash2, Edit2, Layout, CreditCard, 
    MessageCircle, MapPin, Award, Info, Banknote, 
    Building2, Wallet, Repeat, Smartphone, Check, X,
    Palette, Landmark, Coins, ArrowRightLeft, WalletCards, CircleDollarSign
} from 'lucide-react';

const FooterSettingsView = ({ lang }) => {
    const [activeSection, setActiveSection] = useState('store'); // 'store', 'payments', 'faq'
    const [footerData, setFooterData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'footer'), (docSnap) => {
            if (docSnap.exists()) {
                setFooterData(docSnap.data());
            } else {
                // Initialize with defaults if empty
                const defaults = {
                    paymentSection: {
                        title: "طرق الدفع",
                        items: [
                            { text: "الدفع عند الاستلام كاش", icon: "Banknote", color: "green", details: "يتم تسليم المبلغ للمندوب عند استلام الطلبية." },
                            { text: "تحويل بنك الكريمي", icon: "Building2", color: "blue", details: "رقم الحساب: 123456789 باسم متجر ميلانو." },
                            { text: "تحويل محفظة جيب", icon: "Wallet", color: "cyan", details: "رقم المحفظة: 777000000." },
                            { text: "تحويل صرافة محلية", icon: "Repeat", color: "purple", details: "يرجى إرسال صورة الحوالة عبر واتساب." }
                        ]
                    },
                    faqSection: {
                        title: "الأسئلة الشائعة",
                        items: [
                            { question: "خيارات التوصيل", answer: "نقدم خدمة التوصيل السريع لجميع المحافظات خلال 24-48 ساعة." },
                            { question: "سياسة الاستبدال", answer: "يمكن الاستبدال خلال 3 أيام من تاريخ الاستلام بشرط سلامة المنتج." },
                            { question: "اختيار المقاسات", answer: "يرجى مراجعة جدول المقاسات المرفق في وصف كل منتج." },
                            { question: "معلومات مهمة", answer: "جميع منتجاتنا ذات جودة عالية ونحرص على رضا العميل دائماً." }
                        ]
                    },
                    storeSection: {
                        title: "متجر ميلانو",
                        description: "لجميع المستلزمات الرياضية أونلاين.",
                        address: "شميلة شارع السفينة جوار فندق جدة",
                        qualityStatement: "تم شراء جميع البضاعة بأعلى جودة",
                        phone: "",
                        slogan: "لسنا الوحيدون ولكننا الأفضل"
                    }
                };
                setDoc(doc(db, 'settings', 'footer'), defaults);
                setFooterData(defaults);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async (updatedData = footerData) => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'footer'), updatedData);
            alert(lang === 'ar' ? "تم الحفظ بنجاح!" : "Saved successfully!");
        } catch (error) {
            console.error("Error saving footer settings:", error);
            alert(lang === 'ar' ? "حدث خطأ أثناء الحفظ" : "Error saving changes");
        } finally {
            setIsSaving(false);
        }
    };

    const updateStoreInfo = (field, value) => {
        setFooterData(prev => ({
            ...prev,
            storeSection: { ...prev.storeSection, [field]: value }
        }));
    };

    const addPaymentItem = () => {
        const newItem = { text: "طريقة جديدة", icon: "CreditCard", color: "gray", details: "" };
        const updated = {
            ...footerData,
            paymentSection: {
                ...footerData.paymentSection,
                items: [...footerData.paymentSection.items, newItem]
            }
        };
        setFooterData(updated);
        handleSave(updated);
    };

    const deletePaymentItem = (index) => {
        if (!window.confirm(lang === 'ar' ? "هل أنت متأكد من الحذف؟" : "Are you sure?")) return;
        const newItems = footerData.paymentSection.items.filter((_, i) => i !== index);
        const updated = {
            ...footerData,
            paymentSection: { ...footerData.paymentSection, items: newItems }
        };
        setFooterData(updated);
        handleSave(updated);
    };

    const addFaqItem = () => {
        const newItem = { question: "سؤال جديد", answer: "إجابة جديدة" };
        const updated = {
            ...footerData,
            faqSection: {
                ...footerData.faqSection,
                items: [...footerData.faqSection.items, newItem]
            }
        };
        setFooterData(updated);
        handleSave(updated);
    };

    const deleteFaqItem = (index) => {
        if (!window.confirm(lang === 'ar' ? "هل أنت متأكد من الحذف؟" : "Are you sure?")) return;
        const newItems = footerData.faqSection.items.filter((_, i) => i !== index);
        const updated = {
            ...footerData,
            faqSection: { ...footerData.faqSection, items: newItems }
        };
        setFooterData(updated);
        handleSave(updated);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    const isRTL = lang === 'ar';

    const iconMap = {
        Banknote: <Banknote size={20} strokeWidth={2.5} />,
        Building2: <Landmark size={20} strokeWidth={2.5} />,
        Wallet: <Wallet size={20} strokeWidth={2.5} />,
        Repeat: <CircleDollarSign size={20} strokeWidth={2.5} />,
        Smartphone: <Smartphone size={20} strokeWidth={2.5} />,
        CreditCard: <CreditCard size={20} strokeWidth={2.5} />,
        Info: <Info size={20} />
    };

    const colors = [
        { id: 'green', bg: 'bg-green-100', text: 'text-green-600' },
        { id: 'blue', bg: 'bg-blue-100', text: 'text-blue-600' },
        { id: 'cyan', bg: 'bg-cyan-100', text: 'text-cyan-600' },
        { id: 'purple', bg: 'bg-purple-100', text: 'text-purple-600' },
        { id: 'rose', bg: 'bg-rose-100', text: 'text-rose-600' },
        { id: 'amber', bg: 'bg-amber-100', text: 'text-amber-600' },
        { id: 'gray', bg: 'bg-gray-100', text: 'text-gray-600' }
    ];

    return (
        <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                    <Layout className="text-blue-500" />
                    {isRTL ? "إعدادات تذييل الموقع (Footer)" : "Footer Settings"}
                </h2>
                <button
                    onClick={() => handleSave()}
                    disabled={isSaving}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                    {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                    <span>{isRTL ? "حفظ التغييرات" : "Save Changes"}</span>
                </button>
            </div>

            <div className="flex border-b border-gray-100 dark:border-white/5 overflow-x-auto scrollbar-hide">
                {[
                    { id: 'store', label: isRTL ? "معلومات المتجر" : "Store Info", icon: <Award size={18} /> },
                    { id: 'payments', label: isRTL ? "طرق الدفع" : "Payments", icon: <CreditCard size={18} /> },
                    { id: 'faq', label: isRTL ? "الأسئلة الشائعة" : "FAQs", icon: <MessageCircle size={18} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id)}
                        className={`px-6 py-4 font-black text-sm flex items-center gap-2 whitespace-nowrap transition-all border-b-2 ${activeSection === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-[#1c1c1e] rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
                {activeSection === 'store' && (
                    <div className="space-y-4 max-w-2xl mx-auto">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 mr-1">{isRTL ? "عنوان القسم" : "Section Title"}</label>
                                <input
                                    type="text"
                                    value={footerData.storeSection.title}
                                    onChange={(e) => updateStoreInfo('title', e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:border-blue-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 mr-1">{isRTL ? "الوصف" : "Description"}</label>
                                <input
                                    type="text"
                                    value={footerData.storeSection.description}
                                    onChange={(e) => updateStoreInfo('description', e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:border-blue-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 mr-1">{isRTL ? "العنوان" : "Address"}</label>
                                <div className="relative">
                                    <MapPin size={18} className={`absolute ${isRTL ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-gray-400`} />
                                    <input
                                        type="text"
                                        value={footerData.storeSection.address}
                                        onChange={(e) => updateStoreInfo('address', e.target.value)}
                                        className={`w-full ${isRTL ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:border-blue-500 font-bold`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 mr-1">{isRTL ? "عبارة ضمان الجودة" : "Quality Statement"}</label>
                                <input
                                    type="text"
                                    value={footerData.storeSection.qualityStatement}
                                    onChange={(e) => updateStoreInfo('qualityStatement', e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:border-blue-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 mr-1">{isRTL ? "رقم الهاتف" : "Phone"}</label>
                                <div className="relative"><Smartphone size={18} className={`absolute ${isRTL ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-cyan-500`} /><input type="text" value={footerData.storeSection.phone || ''} onChange={(e) => updateStoreInfo('phone', e.target.value)} className={`w-full ${isRTL ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:border-blue-500 font-bold`} /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 mr-1">{isRTL ? "شعار المتجر (Slogan)" : "Slogan"}</label>
                                <input
                                    type="text"
                                    value={footerData.storeSection.slogan}
                                    onChange={(e) => updateStoreInfo('slogan', e.target.value)}
                                    className="w-full px-5 py-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:border-blue-500 font-bold"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'payments' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                             <input
                                    type="text"
                                    value={footerData.paymentSection.title}
                                    onChange={(e) => setFooterData({...footerData, paymentSection: {...footerData.paymentSection, title: e.target.value}})}
                                    className="bg-transparent border-none outline-none text-xl font-black text-gray-800 dark:text-white"
                                />
                                <button onClick={addPaymentItem} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition">
                                    <Plus size={20} />
                                </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {footerData.paymentSection.items.map((item, idx) => (
                                <div key={idx} className="p-5 border border-gray-100 dark:border-white/5 rounded-3xl space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors.find(c => c.id === item.color)?.bg || 'bg-gray-100'} ${colors.find(c => c.id === item.color)?.text || 'text-gray-600'}`}>
                                            {iconMap[item.icon] || <CreditCard size={20} />}
                                        </div>
                                        <input
                                            type="text"
                                            value={item.text}
                                            onChange={(e) => {
                                                const newItems = [...footerData.paymentSection.items];
                                                newItems[idx].text = e.target.value;
                                                setFooterData({...footerData, paymentSection: {...footerData.paymentSection, items: newItems}});
                                            }}
                                            className="flex-1 bg-transparent border-none outline-none font-black text-gray-800 dark:text-white"
                                        />
                                        <button onClick={() => deletePaymentItem(idx)} className="p-2 text-gray-300 hover:text-red-500 transition">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {Object.keys(iconMap).map(iconName => (
                                                <button
                                                    key={iconName}
                                                    onClick={() => {
                                                        const newItems = [...footerData.paymentSection.items];
                                                        newItems[idx].icon = iconName;
                                                        setFooterData({...footerData, paymentSection: {...footerData.paymentSection, items: newItems}});
                                                    }}
                                                    className={`p-2 rounded-lg transition-all ${item.icon === iconName ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                                >
                                                    {iconMap[iconName]}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {colors.map(color => (
                                                <button
                                                    key={color.id}
                                                    onClick={() => {
                                                        const newItems = [...footerData.paymentSection.items];
                                                        newItems[idx].color = color.id;
                                                        setFooterData({...footerData, paymentSection: {...footerData.paymentSection, items: newItems}});
                                                    }}
                                                    className={`w-6 h-6 rounded-full border-2 transition-all ${color.bg} ${item.color === color.id ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                                                />
                                            ))}
                                        </div>
                                        <textarea
                                            value={item.details}
                                            placeholder={isRTL ? "تفاصيل إضافية (تظهر عند النقر)" : "Additional details (shown on click)"}
                                            onChange={(e) => {
                                                const newItems = [...footerData.paymentSection.items];
                                                newItems[idx].details = e.target.value;
                                                setFooterData({...footerData, paymentSection: {...footerData.paymentSection, items: newItems}});
                                            }}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl outline-none text-xs font-bold min-h-[85px]"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeSection === 'faq' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                             <input
                                    type="text"
                                    value={footerData.faqSection.title}
                                    onChange={(e) => setFooterData({...footerData, faqSection: {...footerData.faqSection, title: e.target.value}})}
                                    className="bg-transparent border-none outline-none text-xl font-black text-gray-800 dark:text-white"
                                />
                                <button onClick={addFaqItem} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition">
                                    <Plus size={20} />
                                </button>
                        </div>

                        <div className="space-y-4">
                            {footerData.faqSection.items.map((item, idx) => (
                                <div key={idx} className="p-5 border border-gray-100 dark:border-white/5 rounded-3xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">{isRTL ? `سؤال ${idx + 1}` : `Question ${idx + 1}`}</span>
                                        <button onClick={() => deleteFaqItem(idx)} className="p-2 text-gray-300 hover:text-red-500 transition">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={item.question}
                                        placeholder={isRTL ? "عنوان السؤال" : "Question Title"}
                                        onChange={(e) => {
                                            const newItems = [...footerData.faqSection.items];
                                            newItems[idx].question = e.target.value;
                                            setFooterData({...footerData, faqSection: {...footerData.faqSection, items: newItems}});
                                        }}
                                        className="w-full bg-transparent border-b border-gray-100 dark:border-white/5 py-2 outline-none font-black text-gray-800 dark:text-white"
                                    />
                                    <textarea
                                        value={item.answer}
                                        placeholder={isRTL ? "الإجابة أو الوصف" : "Answer or Description"}
                                        onChange={(e) => {
                                            const newItems = [...footerData.faqSection.items];
                                            newItems[idx].answer = e.target.value;
                                            setFooterData({...footerData, faqSection: {...footerData.faqSection, items: newItems}});
                                        }}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl outline-none text-sm font-bold min-h-[80px]"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FooterSettingsView;
