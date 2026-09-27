import React, { useState, useEffect } from 'react';
import { Save, Truck, MapPin, Trash2, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { getLocalizedCurrency } from '../../lib/currencyUtils';

const DeliveryView = ({ lang = 'ar', generalSettings }) => {
    const [settings, setSettings] = useState({
        freeDeliveryAll: false,
        splitFees: false,
        freeAboveLimit: false,
        limitAmount: 500,
        dynamicPricing: false,
        dynamicThreshold: 20,
        regions: [
            { id: 1, name: 'صنعاء', cost: 1500 },
            { id: 2, name: 'إب', cost: 1500 },
            { id: 3, name: 'عدن', cost: 2000 },
            { id: 4, name: 'تعز', cost: 2000 },
            { id: 5, name: 'حضرموت', cost: 3000 },
            { id: 6, name: 'شبوة', cost: 3000 },
            { id: 7, name: 'ذمار', cost: 1500 },
            { id: 8, name: 'عمران', cost: 1500 },
            { id: 9, name: 'البيضاء', cost: 2500 }
        ]
    });
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isAddingRegion, setIsAddingRegion] = useState(false);
    const [newRegionName, setNewRegionName] = useState('');

    const t = {
        ar: {
            title: "إعدادات التوصيل",
            subtitle: "التحكم في تكاليف وخيارات الشحن",
            save_btn: "حفظ التغييرات",
            saving: "جاري الحفظ...",
            free_delivery_all: "تفعيل: التوصيل مجاني للجميع",
            split_fees: "تقسيم الرسوم: منزلي / مكتبي",
            free_above_limit: "تفعيل: مجاني عند وصول إجمالي الطلب إلى مبلغ محدد",
            dynamic_pricing: "تفعيل التسعير حسب قيمة السلة",
            free_delivery_active: "التوصيل مجاني مفعل الآن للجميع",
            min_amount_placeholder: "الحد الأدنى للمبلغ",
            threshold_placeholder: "الحد الفاصل (مثلاً 20)",
            threshold_hint: "شريحتان: أقل من الحد والحد فأعلى",
            regions_title: "المناطق والمدن",
            add_region: "إضافة منطقة",
            region_col: "المناطق",
            price_less_than: "سعر أقل من",
            price_more_than: "سعر أكبر من",
            office_fee: `رسوم المكتب (${getLocalizedCurrency(generalSettings?.currency || 'YER', 'ar')})`,
            home_fee: `رسوم المنزل (${getLocalizedCurrency(generalSettings?.currency || 'YER', 'ar')})`,
            delivery_val: `قيمة التوصيل (${getLocalizedCurrency(generalSettings?.currency || 'YER', 'ar')})`,
            delete_col: "حذف",
            region_name_placeholder: "اسم المنطقة...",
            free_delivery_badge: "توصيل مجاني",
            office_placeholder: "المكتب",
            home_placeholder: "المنزل",
            delete_confirm: "هل أنت متأكد من حذف هذه المنطقة؟",
            save_success: "تم حفظ إعدادات التوصيل بنجاح!",
            save_error: "حدث خطأ أثناء الحفظ.",
            add_region_title: "إضافة منطقة جديدة",
            add_region_btn: "إضافة",
            cancel: "إلغاء",
            new_region_placeholder: "أدخل اسم المنطقة"
        },
        en: {
            title: "Delivery Settings",
            subtitle: "Manage shipping costs and options",
            save_btn: "Save Changes",
            saving: "Saving...",
            free_delivery_all: "Enable: Free Delivery for All",
            split_fees: "Split Fees: Home / Office",
            free_above_limit: "Enable: Free Above Order Limit",
            dynamic_pricing: "Enable: Dynamic Pricing by Cart Value",
            free_delivery_active: "Free Delivery is currently active for everyone",
            min_amount_placeholder: "Minimum Amount",
            threshold_placeholder: "Threshold (e.g., 20)",
            threshold_hint: "Two tiers: Below threshold and Above threshold",
            regions_title: "Regions & Cities",
            add_region: "Add Region",
            region_col: "Regions",
            price_less_than: "Price < ",
            price_more_than: "Price >= ",
            office_fee: `Office Fee (${getLocalizedCurrency(generalSettings?.currency || 'YER', 'en')})`,
            home_fee: `Home Fee (${getLocalizedCurrency(generalSettings?.currency || 'YER', 'en')})`,
            delivery_val: `Delivery Cost (${getLocalizedCurrency(generalSettings?.currency || 'YER', 'en')})`,
            delete_col: "Delete",
            region_name_placeholder: "Region Name...",
            free_delivery_badge: "Free Delivery",
            office_placeholder: "Office",
            home_placeholder: "Home",
            delete_confirm: "Are you sure you want to delete this region?",
            save_success: "Settings saved successfully!",
            save_error: "Error saving settings.",
            add_region_title: "Add New Region",
            add_region_btn: "Add",
            cancel: "Cancel",
            new_region_placeholder: "Enter region name"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';
    const currency = getLocalizedCurrency(generalSettings?.currency || 'YER', lang);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "delivery");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings({ ...settings, ...docSnap.data() });
                }
            } catch (error) {
                console.error("Error fetching delivery settings:", error);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            await setDoc(doc(db, "settings", "delivery"), settings);
            alert(txt.save_success);
        } catch (error) {
            console.error("Error saving settings:", error);
            alert(txt.save_error);
        } finally {
            setLoading(false);
        }
    };

    const updateRegionCost = (id, field, value) => {
        const numValue = Math.max(0, Number(value)); // Prevent negative values
        const updatedRegions = settings.regions.map(r =>
            r.id === id ? { ...r, [field]: numValue } : r
        );
        setSettings({ ...settings, regions: updatedRegions });
    };

    const updateRegionName = (id, value) => {
        const updatedRegions = settings.regions.map(r =>
            r.id === id ? { ...r, name: value } : r
        );
        setSettings({ ...settings, regions: updatedRegions });
    };

    const removeRegion = (id) => {
        if (!window.confirm(txt.delete_confirm)) return;
        setSettings({ ...settings, regions: settings.regions.filter(r => r.id !== id) });
    };

    const handleAddRegion = (e) => {
        e.preventDefault();
        if (!newRegionName.trim()) return;

        const newRegion = {
            id: Date.now(),
            name: newRegionName,
            cost: 1500,
            officeCost: 1500,
            costLessThan: 1500,
            costGreaterThan: 1500
        };
        setSettings({ ...settings, regions: [...settings.regions, newRegion] });
        setNewRegionName('');
        setIsAddingRegion(false);
    };

    return (
        <div className="space-y-6 font-['Cairo'] pb-20" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header */}
            <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Truck size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">{txt.title}</h2>
                        <p className="text-sm text-gray-400 font-bold">{txt.subtitle}</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                    <Save size={18} />
                    {loading ? txt.saving : txt.save_btn}
                </button>
            </div>

            {/* Toggles Card */}
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
                {[
                    { key: 'freeDeliveryAll', label: txt.free_delivery_all },
                    { key: 'splitFees', label: txt.split_fees },
                    { key: 'freeAboveLimit', label: txt.free_above_limit },
                    { key: 'dynamicPricing', label: txt.dynamic_pricing },
                ].map((item) => (
                    <div key={item.key} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between py-2">
                            <span className="text-gray-700 font-black text-sm">{item.label}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings[item.key]}
                                    onChange={() => setSettings({ ...settings, [item.key]: !settings[item.key] })}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] rtl:after:right-[2px] rtl:after:left-auto after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {/* Conditional Usage Banner for Free Delivery */}
                        {item.key === 'freeDeliveryAll' && settings.freeDeliveryAll && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2"
                            >
                                <div className="w-full bg-green-50 border-r-4 border-l-0 rtl:border-r-4 rtl:border-l-0 ltr:border-l-4 ltr:border-r-0 border-green-500 p-3 rounded-lg flex items-center gap-2">
                                    <Truck size={18} className="text-green-600" />
                                    <span className="text-green-700 font-bold text-sm">{txt.free_delivery_active}</span>
                                </div>
                            </motion.div>
                        )}

                        {/* Conditional Input for Free Delivery Limit */}
                        {item.key === 'freeAboveLimit' && settings.freeAboveLimit && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2"
                            >
                                <input
                                    type="number"
                                    min="0"
                                    placeholder={txt.min_amount_placeholder}
                                    value={settings.limitAmount}
                                    onChange={(e) => setSettings({ ...settings, limitAmount: Math.max(0, Number(e.target.value)) })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-gray-700"
                                />
                            </motion.div>
                        )}

                        {/* Conditional Input for Dynamic Pricing Threshold */}
                        {item.key === 'dynamicPricing' && settings.dynamicPricing && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`mt-2 ${isRTL ? 'text-right' : 'text-left'}`}
                            >
                                <input
                                    type="number"
                                    min="0"
                                    placeholder={txt.threshold_placeholder}
                                    value={settings.dynamicThreshold}
                                    onChange={(e) => setSettings({ ...settings, dynamicThreshold: Math.max(0, Number(e.target.value)) })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-gray-700"
                                />
                                <p className="text-gray-400 text-xs font-bold mt-2 pr-2">{txt.threshold_hint}</p>
                            </motion.div>
                        )}
                    </div>
                ))}
            </div>

            {/* Regions Table */}
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-2 text-gray-400 font-bold text-xs uppercase">
                        <MapPin size={16} /> {txt.regions_title}
                    </div>
                    <button onClick={() => setIsAddingRegion(true)} className="flex items-center gap-2 text-blue-600 font-black text-xs bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
                        <Plus size={14} /> {txt.add_region}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                        <thead>
                            <tr className="border-b border-gray-50 text-gray-400 text-xs font-black uppercase">
                                <th className={`px-8 py-5 ${isRTL ? 'text-right' : 'text-left'} w-1/4`}>{txt.region_col}</th>
                                {settings.dynamicPricing ? (
                                    <>
                                        <th className="px-8 py-5 text-center">{txt.price_less_than} {settings.dynamicThreshold || '-'}</th>
                                        <th className="px-8 py-5 text-center">{txt.price_more_than} {settings.dynamicThreshold || '-'}</th>
                                    </>
                                ) : settings.splitFees ? (
                                    <>
                                        <th className="px-8 py-5 text-center">{txt.office_fee}</th>
                                        <th className="px-8 py-5 text-center">{txt.home_fee}</th>
                                    </>
                                ) : (
                                    <th className="px-8 py-5 text-center">{txt.delivery_val}</th>
                                )}
                                <th className={`px-8 py-5 ${isRTL ? 'text-left' : 'text-right'} w-24`}>{txt.delete_col}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {settings.regions.map((region) => (
                                <tr key={region.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-8 py-4">
                                        <input
                                            type="text"
                                            maxLength={50}
                                            value={region.name}
                                            onChange={(e) => updateRegionName(region.id, e.target.value)}
                                            className="w-full bg-transparent border-none p-0 font-bold text-gray-700 placeholder-gray-300 focus:ring-0"
                                            placeholder={txt.region_name_placeholder}
                                        />
                                    </td>

                                    {settings.freeDeliveryAll ? (
                                        <td className="px-8 py-4 text-center" colSpan={settings.splitFees || settings.dynamicPricing ? 2 : 1}>
                                            <div className="w-full bg-green-50 border border-green-100 rounded-xl py-2 text-green-600 font-bold text-sm text-center">
                                                {txt.free_delivery_badge}
                                            </div>
                                        </td>
                                    ) : (
                                        <>
                                            {settings.dynamicPricing ? (
                                                <>
                                                    <td className="px-8 py-4 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={region.costLessThan}
                                                            onChange={(e) => updateRegionCost(region.id, 'costLessThan', e.target.value)}
                                                            className="w-full max-w-[150px] px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono mx-auto"
                                                            placeholder={txt.price_less_than}
                                                        />
                                                    </td>
                                                    <td className="px-8 py-4 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={region.costGreaterThan}
                                                            onChange={(e) => updateRegionCost(region.id, 'costGreaterThan', e.target.value)}
                                                            className="w-full max-w-[150px] px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono mx-auto"
                                                            placeholder={txt.price_more_than}
                                                        />
                                                    </td>
                                                </>
                                            ) : settings.splitFees ? (
                                                <>
                                                    <td className="px-8 py-4 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={region.officeCost}
                                                            onChange={(e) => updateRegionCost(region.id, 'officeCost', e.target.value)}
                                                            className="w-full max-w-[150px] px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono mx-auto"
                                                            placeholder={txt.office_placeholder}
                                                        />
                                                    </td>
                                                    <td className="px-8 py-4 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={region.cost}
                                                            onChange={(e) => updateRegionCost(region.id, 'cost', e.target.value)}
                                                            className="w-full max-w-[150px] px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono mx-auto"
                                                            placeholder={txt.home_placeholder}
                                                        />
                                                    </td>
                                                </>
                                            ) : (
                                                <td className="px-8 py-4 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={region.cost}
                                                        onChange={(e) => updateRegionCost(region.id, 'cost', e.target.value)}
                                                        className="w-full max-w-[150px] px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono mx-auto"
                                                        placeholder="0"
                                                    />
                                                </td>
                                            )}
                                        </>
                                    )}

                                    <td className={`px-8 py-4 ${isRTL ? 'text-left' : 'text-right'}`}>
                                        <button
                                            onClick={() => removeRegion(region.id)}
                                            className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm inline-flex"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Region Modal */}
            <AnimatePresence>
                {isAddingRegion && (
                    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-bold text-lg text-gray-800">{txt.add_region_title}</h3>
                                <button
                                    onClick={() => setIsAddingRegion(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleAddRegion} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{txt.region_col}</label>
                                    <input
                                        type="text"
                                        maxLength={50}
                                        value={newRegionName}
                                        onChange={(e) => setNewRegionName(e.target.value)}
                                        placeholder={txt.new_region_placeholder}
                                        autoFocus
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-bold"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingRegion(false)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                    >
                                        {txt.cancel}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newRegionName.trim()}
                                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none"
                                    >
                                        {txt.add_region_btn}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DeliveryView;
