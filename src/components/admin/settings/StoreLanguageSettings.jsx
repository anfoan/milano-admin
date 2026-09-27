import React, { useState, useEffect } from 'react';
import { Save, ArrowRight, Loader2, Languages } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const StoreLanguageSettings = ({ onBack, lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState('ar');

    const t = {
        ar: {
            title: "اختر لغة المتجر",
            save: "حفظ",
            saving: "جاري الحفظ...",
            success: "تم تحديث لغة المتجر بنجاح!",
            error: "حدث خطأ أثناء الحفظ",
            loading: "جاري التحميل...",
            arabic: "العربية",
            english: "English"
        },
        en: {
            title: "Choose Store Language",
            save: "Save",
            saving: "Saving...",
            success: "Store language updated successfully!",
            error: "An error occurred while saving",
            loading: "Loading...",
            arabic: "Arabic",
            english: "English"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "language");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setCurrentLanguage(docSnap.data().currentLanguage || 'ar');
                }
            } catch (error) {
                console.error("Error fetching language settings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "language"), {
                currentLanguage
            });
            alert(txt.success);
            // Force reload to apply direction changes cleanly if needed, though Context handles it dynamically
        } catch (error) {
            console.error("Error saving language settings:", error);
            alert(txt.error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64 text-gray-500">
            {txt.loading}
        </div>
    );

    return (
        <div className="space-y-6 font-['Cairo'] pb-20" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header managed by SettingsView */}

            <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 relative overflow-hidden">
                <div className={`flex items-center gap-3 mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <Languages size={20} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-base">{txt.title}</h3>
                </div>

                <div className="space-y-3">
                    {/* Arabic Option */}
                    <div
                        onClick={() => setCurrentLanguage('ar')}
                        className={`cursor-pointer rounded-xl border p-4 flex items-center justify-between transition-all ${currentLanguage === 'ar' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-3">
                            <img src="https://flagcdn.com/w40/sa.png" alt="Arabic" className="w-6 h-4 object-cover rounded-sm shadow-sm" />
                            <span className={`font-bold ${currentLanguage === 'ar' ? 'text-blue-700' : 'text-gray-700'}`}>{txt.arabic}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${currentLanguage === 'ar' ? 'border-blue-500' : 'border-gray-300'}`}>
                            {currentLanguage === 'ar' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                        </div>
                    </div>

                    {/* English Option */}
                    <div
                        onClick={() => setCurrentLanguage('en')}
                        className={`cursor-pointer rounded-xl border p-4 flex items-center justify-between transition-all ${currentLanguage === 'en' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-3">
                            <img src="https://flagcdn.com/w40/us.png" alt="English" className="w-6 h-4 object-cover rounded-sm shadow-sm" />
                            <span className={`font-bold ${currentLanguage === 'en' ? 'text-blue-700' : 'text-gray-700'}`}>{txt.english}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${currentLanguage === 'en' ? 'border-blue-500' : 'border-gray-300'}`}>
                            {currentLanguage === 'en' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Save Button */}
            <div className={`flex mt-8 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-500 text-white px-12 py-3.5 rounded-xl font-black text-base shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {saving ? txt.saving : txt.save}
                </button>
            </div>
        </div>
    );
};

export default StoreLanguageSettings;
