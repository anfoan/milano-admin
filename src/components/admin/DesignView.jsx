import React, { useState, useEffect } from 'react';
import { Palette, CheckCircle2, Monitor, Moon, Sun, Layout } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const DesignView = ({ lang = 'ar' }) => {
    const [activeDesign, setActiveDesign] = useState('light'); // 'light' or 'dark'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "settings", "design"), (docSnap) => {
            if (docSnap.exists()) {
                setActiveDesign(docSnap.data().defaultTheme || 'light');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async (theme) => {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "design"), {
                defaultTheme: theme,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            setActiveDesign(theme);
            alert(lang === 'ar' ? "تم تفعيل التصميم بنجاح ✅" : "Design activated successfully ✅");
        } catch (error) {
            console.error("Error saving design settings:", error);
            alert(lang === 'ar' ? "حدث خطأ أثناء الحفظ" : "Error saving settings");
        } finally {
            setSaving(false);
        }
    };

    const t = {
        ar: {
            title: "تصميم المتجر",
            subtitle: "اختر التصميم الافتراضي الذي سيظهر للعملاء عند فتح المتجر لأول مرة",
            design1: "التصميم 1 (داكن)",
            design2: "التصميم 2 (فاتح)",
            activate: "تفعيل",
            active: "مفعل حالياً",
            note: "ملاحظة: يمكن للعميل دائماً تغيير المود يدوياً عبر أيقونة الشمس/القمر، لكن هذا الخيار يحدد المظهر الافتراضي للمتجر."
        },
        en: {
            title: "Store Design",
            subtitle: "Choose the default theme that customers see when they first open the store",
            design1: "Design 1 (Dark)",
            design2: "Design 2 (Light)",
            activate: "Activate",
            active: "Currently Active",
            note: "Note: Customers can always toggle light/dark mode manually, but this setting defines the default appearance."
        }
    };

    const txt = t[lang];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                    <Palette className="text-blue-600" size={32} />
                    {txt.title}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 font-bold">{txt.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Design 1: Dark */}
                <div className={`relative bg-white dark:bg-[#1c1c1e] rounded-[32px] border-4 transition-all duration-300 overflow-hidden shadow-xl ${activeDesign === 'dark' ? 'border-blue-500 scale-[1.02]' : 'border-transparent hover:border-gray-200 dark:hover:border-white/10'}`}>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-black text-gray-800 dark:text-white">{txt.design1}</span>
                            {activeDesign === 'dark' && <CheckCircle2 className="text-blue-500" size={24} />}
                        </div>

                        {/* Preview UI - Dark */}
                        <div className="aspect-[4/3] bg-[#111317] rounded-2xl p-4 border border-white/5 space-y-3 relative overflow-hidden shadow-inner">
                            <div className="h-6 w-full bg-blue-600/20 rounded-lg flex items-center px-2">
                                <div className="w-12 h-1.5 bg-blue-500 rounded-full"></div>
                                <div className="flex-1"></div>
                                <div className="w-4 h-4 bg-yellow-500/20 rounded-full"></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="aspect-square bg-white/5 rounded-xl border border-white/5 flex flex-col p-1.5 gap-1.5">
                                        <div className="flex-1 bg-white/5 rounded-lg"></div>
                                        <div className="h-1 w-full bg-white/10 rounded-full"></div>
                                        <div className="h-1 w-2/3 bg-blue-500/20 rounded-full"></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => handleSave('dark')}
                            disabled={saving || activeDesign === 'dark'}
                            className={`w-full py-4 rounded-2xl font-black text-lg transition-all transform active:scale-95 ${activeDesign === 'dark'
                                ? 'bg-blue-50 text-blue-600 cursor-default'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'}`}
                        >
                            {activeDesign === 'dark' ? txt.active : txt.activate}
                        </button>
                    </div>
                </div>

                {/* Design 2: Light */}
                <div className={`relative bg-white dark:bg-[#1c1c1e] rounded-[32px] border-4 transition-all duration-300 overflow-hidden shadow-xl ${activeDesign === 'light' ? 'border-blue-500 scale-[1.02]' : 'border-transparent hover:border-gray-200 dark:hover:border-white/10'}`}>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-black text-gray-800 dark:text-white">{txt.design2}</span>
                            {activeDesign === 'light' && <CheckCircle2 className="text-blue-500" size={24} />}
                        </div>

                        {/* Preview UI - Light */}
                        <div className="aspect-[4/3] bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3 relative overflow-hidden shadow-inner">
                            <div className="h-6 w-full bg-white rounded-lg border border-gray-100 flex items-center px-2 shadow-sm">
                                <div className="w-12 h-1.5 bg-blue-600/30 rounded-full"></div>
                                <div className="flex-1"></div>
                                <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="aspect-square bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col p-1.5 gap-1.5">
                                        <div className="flex-1 bg-gray-50 rounded-lg"></div>
                                        <div className="h-1 w-full bg-gray-100 rounded-full"></div>
                                        <div className="h-1 w-2/3 bg-blue-600/10 rounded-full"></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => handleSave('light')}
                            disabled={saving || activeDesign === 'light'}
                            className={`w-full py-4 rounded-2xl font-black text-lg transition-all transform active:scale-95 ${activeDesign === 'light'
                                ? 'bg-blue-50 text-blue-600 cursor-default'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'}`}
                        >
                            {activeDesign === 'light' ? txt.active : txt.activate}
                        </button>
                    </div>
                </div>
            </div>

            {/* Note */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-[24px] p-6 flex items-start gap-4">
                <Monitor className="text-blue-600 mt-1 shrink-0" size={20} />
                <p className="text-blue-800 dark:text-blue-400 font-bold text-sm leading-relaxed">
                    {txt.note}
                </p>
            </div>
        </div>
    );
};

export default DesignView;
