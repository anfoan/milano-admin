import React, { useState, useEffect } from 'react';
import { Save, ShoppingCart, ArrowRight, Loader2, DollarSign, Package } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const StoreCartSettings = ({ onBack, lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [settings, setSettings] = useState({
        minOrderAmount: '',
        enableMinAmount: false,
        maxOrderAmount: '',
        enableMaxAmount: false,
        maxProductCount: '',
        enableMaxCount: false
    });

    const t = {
        ar: {
            min_amount: "الحد الأدنى للمبلغ (YER)",
            max_amount: "الحد الأقصى للمبلغ (YER)",
            max_count: "الحد الأقصى لعدد المنتجات",
            placeholder: "غير محدد",
            enable_min: "تفعيل الحد الأدنى",
            enable_max: "تفعيل الحد الأقصى",
            enable_count: "تفعيل حد المنتجات",
            save_btn: "حفظ التغييرات",
            saving: "جاري الحفظ...",
            success: "تم حفظ إعدادات السلة بنجاح!",
            error: "حدث خطأ أثناء الحفظ",
            loading: "جاري التحميل...",
            validation_min_max: "الحد الأدنى للمبلغ يجب أن يكون أقل من الحد الأقصى"
        },
        en: {
            min_amount: "Minimum Order Amount (YER)",
            max_amount: "Maximum Order Amount (YER)",
            max_count: "Maximum Product Count",
            placeholder: "Not set",
            enable_min: "Enable Minimum Amount",
            enable_max: "Enable Maximum Amount",
            enable_count: "Enable Product Limit",
            save_btn: "Save Changes",
            saving: "Saving...",
            success: "Cart settings saved successfully!",
            error: "An error occurred while saving",
            loading: "Loading...",
            validation_min_max: "Minimum amount must be less than maximum amount"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "cart");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data());
                }
            } catch (error) {
                console.error("Error fetching cart settings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleChange = (key, value) => {
        // Prevent negative numbers
        if (typeof value === 'number' && value < 0) return;

        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSave = async () => {
        // Security Validation
        if (settings.enableMinAmount && settings.enableMaxAmount) {
            if (Number(settings.minOrderAmount) > Number(settings.maxOrderAmount)) {
                alert(txt.validation_min_max);
                return;
            }
        }

        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "cart"), settings);
            alert(txt.success);
        } catch (error) {
            console.error("Error saving cart settings:", error);
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

            {/* Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Min Order Amount */}
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <DollarSign size={20} />
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm">{txt.min_amount}</h3>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="number"
                            value={settings.minOrderAmount}
                            onChange={(e) => handleChange('minOrderAmount', Number(e.target.value))}
                            placeholder={txt.placeholder}
                            disabled={!settings.enableMinAmount}
                            className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isRTL ? 'text-right' : 'text-left'}`}
                        />

                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400">{txt.enable_min}</span>
                            <button
                                onClick={() => handleChange('enableMinAmount', !settings.enableMinAmount)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${settings.enableMinAmount ? 'bg-blue-500 justify-end' : 'bg-gray-200 justify-start'}`}
                            >
                                <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Max Order Amount */}
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                            <DollarSign size={20} />
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm">{txt.max_amount}</h3>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="number"
                            value={settings.maxOrderAmount}
                            onChange={(e) => handleChange('maxOrderAmount', Number(e.target.value))}
                            placeholder={txt.placeholder}
                            disabled={!settings.enableMaxAmount}
                            className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isRTL ? 'text-right' : 'text-left'}`}
                        />

                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400">{txt.enable_max}</span>
                            <button
                                onClick={() => handleChange('enableMaxAmount', !settings.enableMaxAmount)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${settings.enableMaxAmount ? 'bg-blue-500 justify-end' : 'bg-gray-200 justify-start'}`}
                            >
                                <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Max Product Count */}
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                            <Package size={20} />
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm">{txt.max_count}</h3>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="number"
                            value={settings.maxProductCount}
                            onChange={(e) => handleChange('maxProductCount', Number(e.target.value))}
                            placeholder="5"
                            disabled={!settings.enableMaxCount}
                            className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isRTL ? 'text-right' : 'text-left'}`}
                        />

                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400">{txt.enable_count}</span>
                            <button
                                onClick={() => handleChange('enableMaxCount', !settings.enableMaxCount)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${settings.enableMaxCount ? 'bg-blue-500 justify-end' : 'bg-gray-200 justify-start'}`}
                            >
                                <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                            </button>
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
                    {saving ? txt.saving : txt.save_btn}
                </button>
            </div>
        </div>
    );
};

export default StoreCartSettings;
