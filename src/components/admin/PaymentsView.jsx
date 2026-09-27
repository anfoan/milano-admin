import React, { useState, useEffect } from 'react';
import { Save, CreditCard, MessageCircle, Settings, X, Phone, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PaymentsView = ({ lang = 'ar' }) => {
    const [settings, setSettings] = useState({
        cod_enabled: true,
        cod_condition_enabled: false,
        cod_condition_type: 'min', // 'min', 'max', 'range'
        cod_condition_min: 0,
        cod_condition_max: 0,
        whatsapp_enabled: false,
        whatsapp_number: '',
        whatsapp_label: 'تواصل لإكمال عملية الدفع عبر واتساب',
        whatsapp_condition_enabled: false,
        whatsapp_condition_type: 'min', // 'min', 'max', 'range'
        whatsapp_condition_min: 0,
        whatsapp_condition_max: 0
    });
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Modal State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [modalType, setModalType] = useState(null); // 'cod' or 'whatsapp'

    const t = {
        ar: {
            title: "طرق الدفع",
            subtitle: "إدارة خيارات الدفع المتاحة للعملاء",
            cod_title: "الدفع عند الاستلام",
            whatsapp_title: "تواصل لإكمال عملية الدفع عبر واتساب",
            active: "مفعل",
            inactive: "معطل",
            enable_payment: "تفعيل الدفع",
            disable_payment: "تعطيل الدفع",
            enable_service: "تفعيل الخدمة",
            disable_service: "قطع الاتصال",
            config_condition: "إعداد شرط الدفع",
            save: "حفظ",
            saving: "جارِ الحفظ...",
            cancel: "إلغاء",
            error_save: "حدث خطأ أثناء الحفظ.",
            success_save: "تم حفظ الإعدادات بنجاح!",

            // Modal
            condition_toggle_whatsapp: "تفعيل تواصل لإكمال عملية الدفع حسب قيمة السلة",
            condition_toggle_cod: "تفعيل الدفع عند الاستلام حسب قيمة السلة",
            additional_options: "خيارات إضافية",
            condition_type: "نوع الشرط",
            min_limit: "الحد الأدنى",
            max_limit: "الحد الأقصى",
            range_limit: "بين قيمتين",
            cart_value: "قيمة السلة",
            min_placeholder: "الحد الأدنى",
            max_placeholder: "الحد الأقصى",
            preview: "المعاينة",
            preview_whatsapp_prefix: "عرض \"تواصل للدفع\" إذا",
            preview_cod_prefix: "عرض \"الدفع عند الاستلام\" إذا",
            preview_min: "كان المجموع أكبر من",
            preview_max: "كان المجموع أقل من",
            preview_range_between: "كان المجموع بين",
            preview_range_and: "و",

            contact_settings: "إعدادات الاتصال",
            whatsapp_number: "رقم الواتساب",
            btn_label: "تسمية الزر",
            btn_label_placeholder: "مثال: تواصل معنا لإتمام الطلب"
        },
        en: {
            title: "Payment Methods",
            subtitle: "Manage payment options available to customers",
            cod_title: "Cash on Delivery",
            whatsapp_title: "Contact to Complete Payment",
            active: "Active",
            inactive: "Inactive",
            enable_payment: "Enable Payment",
            disable_payment: "Disable Payment",
            enable_service: "Enable Service",
            disable_service: "Disconnect",
            config_condition: "Configure Conditions",
            save: "Save",
            saving: "Saving...",
            cancel: "Cancel",
            error_save: "Error saving settings.",
            success_save: "Settings saved successfully!",

            // Modal
            condition_toggle_whatsapp: "Enable Contact Payment by Cart Value",
            condition_toggle_cod: "Enable COD by Cart Value",
            additional_options: "Additional Options",
            condition_type: "Condition Type",
            min_limit: "Minimum Limit",
            max_limit: "Maximum Limit",
            range_limit: "Between Values",
            cart_value: "Cart Value",
            min_placeholder: "Min Value",
            max_placeholder: "Max Value",
            preview: "Preview",
            preview_whatsapp_prefix: "Show \"Contact to Pay\" if",
            preview_cod_prefix: "Show \"COD\" if",
            preview_min: "Total is greater than",
            preview_max: "Total is less than",
            preview_range_between: "Total is between",
            preview_range_and: "and",

            contact_settings: "Contact Settings",
            whatsapp_number: "WhatsApp Number",
            btn_label: "Button Label",
            btn_label_placeholder: "Ex: Contact us to complete order"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const docRef = doc(db, "settings", "payments");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.whatsapp_label === 'تواصل لإكمال عملية الدفع' || data.whatsapp_label === 'تواصل معنا لإكمال عملية الدفع') {
                        data.whatsapp_label = 'تواصل لإكمال عملية الدفع عبر واتساب';
                    }
                    setSettings(prev => ({ ...prev, ...data }));
                }
            } catch (error) {
                console.error("Error fetching payment settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (newSettings = settings) => {
        // Validation Logic
        if (newSettings.whatsapp_enabled && !newSettings.whatsapp_number && modalType === 'whatsapp') {
            alert(isRTL ? "يرجى إدخال رقم الواتساب" : "Please enter WhatsApp number");
            return;
        }

        if (newSettings.whatsapp_condition_enabled && newSettings.whatsapp_condition_type === 'range') {
            if (Number(newSettings.whatsapp_condition_min) > Number(newSettings.whatsapp_condition_max)) {
                alert(isRTL ? "الحد الأدنى يجب أن يكون أقل من الحد الأقصى" : "Minimum limit must be less than Maximum limit");
                return;
            }
        }

        if (newSettings.cod_condition_enabled && newSettings.cod_condition_type === 'range') {
            if (Number(newSettings.cod_condition_min) > Number(newSettings.cod_condition_max)) {
                alert(isRTL ? "الحد الأدنى يجب أن يكون أقل من الحد الأقصى" : "Minimum limit must be less than Maximum limit");
                return;
            }
        }

        setIsSaving(true);
        try {
            await setDoc(doc(db, "settings", "payments"), newSettings);
            setSettings(newSettings);
            if (showConfigModal) alert(txt.success_save);
        } catch (error) {
            console.error("Error saving settings:", error);
            alert(txt.error_save);
        } finally {
            setIsSaving(false);
            if (!showConfigModal) return; // Don't close if it was a toggle save
            setShowConfigModal(false);
        }
    };

    const togglePayment = (key) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        handleSave(newSettings);
    };

    const configurePayment = (type) => {
        setModalType(type);
        setShowConfigModal(true);
    };

    return (
        <div className="space-y-6 font-['Cairo'] pb-20" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header */}
            <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">{txt.title}</h2>
                        <p className="text-sm text-gray-400 font-bold">{txt.subtitle}</p>
                    </div>
                </div>
            </div>

            {/* Payment Methods Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. Cash On Delivery (COD) */}
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                <img
                                    src="https://cdn-icons-png.flaticon.com/512/2331/2331941.png"
                                    className="w-10 h-10 object-contain drop-shadow-sm filter grayscale-[0.2]"
                                    alt="COD"
                                />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-800">{txt.cod_title}</h3>
                                <div className={`text-xs font-bold px-2 py-1 rounded-lg w-fit mt-1 flex items-center gap-1 ${settings.cod_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <div className={`w-2 h-2 rounded-full ${settings.cod_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    {settings.cod_enabled ? txt.active : txt.inactive}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-8">
                        <button
                            onClick={() => togglePayment('cod_enabled')}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${settings.cod_enabled
                                ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                                }`}
                        >
                            {settings.cod_enabled ? txt.disable_payment : txt.enable_payment}
                        </button>
                        <button
                            onClick={() => configurePayment('cod')}
                            className="py-3 px-4 rounded-xl font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-sm flex items-center gap-2"
                        >
                            <Settings size={18} />
                            {txt.config_condition}
                        </button>
                    </div>
                </div>

                {/* 2. WhatsApp Payment */}
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                                <img
                                    src="https://cdn-icons-png.flaticon.com/512/733/733585.png"
                                    className="w-10 h-10 object-contain"
                                    alt="WhatsApp"
                                />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-800">{txt.whatsapp_title}</h3>
                                <div className={`text-xs font-bold px-2 py-1 rounded-lg w-fit mt-1 flex items-center gap-1 ${settings.whatsapp_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <div className={`w-2 h-2 rounded-full ${settings.whatsapp_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    {settings.whatsapp_enabled ? txt.active : txt.inactive}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-8">
                        <button
                            onClick={() => togglePayment('whatsapp_enabled')}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${settings.whatsapp_enabled
                                ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                                }`}
                        >
                            {settings.whatsapp_enabled ? txt.disable_service : txt.enable_service}
                        </button>
                        <button
                            onClick={() => configurePayment('whatsapp')}
                            className="py-3 px-4 rounded-xl font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-sm flex items-center gap-2"
                        >
                            <Settings size={18} />
                            {txt.config_condition}
                        </button>
                    </div>

                    {settings.whatsapp_enabled && (
                        <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'}`}>
                            <img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" className="w-6 h-6 opacity-20" />
                        </div>
                    )}
                </div>
            </div>

            {/* Configuration Modal */}
            <AnimatePresence>
                {showConfigModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                            onClick={() => setShowConfigModal(false)}
                        />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="bg-white rounded-[24px] w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
                                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                        <Settings size={20} className="text-blue-600" />
                                        <span>{modalType === 'whatsapp' ? txt.whatsapp_title : txt.cod_title}</span>
                                    </h3>
                                    <button onClick={() => setShowConfigModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="p-8 space-y-8 overflow-y-auto flex-1">
                                    {modalType === 'whatsapp' ? (
                                        <>
                                            {/* Toggle Condition */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-700 font-bold text-lg">{txt.condition_toggle_whatsapp}</span>
                                                <label className="inline-flex items-center cursor-pointer gap-3">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={settings.whatsapp_condition_enabled || false}
                                                        onChange={(e) => setSettings({ ...settings, whatsapp_condition_enabled: e.target.checked })}
                                                    />
                                                    <div className={`relative w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full ${isRTL ? 'peer-checked:after:-translate-x-full' : ''} peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 ${isRTL ? 'after:right-[4px]' : 'after:left-[4px]'} after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600`}></div>
                                                    <span className="text-sm font-bold text-gray-600 peer-checked:text-blue-600 transition-colors">
                                                        {settings.whatsapp_condition_enabled ? txt.active : txt.additional_options}
                                                    </span>
                                                </label>
                                            </div>

                                            {settings.whatsapp_condition_enabled && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="space-y-6 pt-4"
                                                >
                                                    {/* Condition Type Tabs */}
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-500 mb-3 block">{txt.condition_type}</label>
                                                        <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1.5 rounded-xl">
                                                            {['min', 'max', 'range'].map((type) => (
                                                                <button
                                                                    key={type}
                                                                    onClick={() => setSettings({ ...settings, whatsapp_condition_type: type })}
                                                                    className={`py-2 px-4 rounded-lg text-sm font-bold transition-all ${settings.whatsapp_condition_type === type
                                                                        ? 'bg-white text-blue-600 shadow-sm'
                                                                        : 'text-gray-500 hover:text-gray-700'
                                                                        }`}
                                                                >
                                                                    {type === 'min' && txt.min_limit}
                                                                    {type === 'max' && txt.max_limit}
                                                                    {type === 'range' && txt.range_limit}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Condition Inputs */}
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-500 mb-3 block">{txt.cart_value}</label>
                                                        <div className="flex gap-4">
                                                            {(settings.whatsapp_condition_type === 'min' || settings.whatsapp_condition_type === 'range') && (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    placeholder={txt.min_placeholder}
                                                                    value={settings.whatsapp_condition_min || ''}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(0, Number(e.target.value));
                                                                        setSettings(prev => ({ ...prev, whatsapp_condition_min: val }));
                                                                    }}
                                                                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                                />
                                                            )}
                                                            {(settings.whatsapp_condition_type === 'max' || settings.whatsapp_condition_type === 'range') && (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    placeholder={txt.max_placeholder}
                                                                    value={settings.whatsapp_condition_max || ''}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(0, Number(e.target.value));
                                                                        setSettings(prev => ({ ...prev, whatsapp_condition_max: val }));
                                                                    }}
                                                                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Preview */}
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-500 mb-2 block">{txt.preview}</label>
                                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-700 text-sm font-bold text-center border-dashed">
                                                            {txt.preview_whatsapp_prefix}
                                                            {" "}
                                                            {settings.whatsapp_condition_type === 'min' && `${txt.preview_min} ${settings.whatsapp_condition_min || 0}`}
                                                            {settings.whatsapp_condition_type === 'max' && `${txt.preview_max} ${settings.whatsapp_condition_max || 0}`}
                                                            {settings.whatsapp_condition_type === 'range' && `${txt.preview_range_between} ${settings.whatsapp_condition_min || 0} ${txt.preview_range_and} ${settings.whatsapp_condition_max || 0}`}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                            <div className="h-px bg-gray-100 my-4"></div>

                                            <h4 className="font-bold text-gray-900 mb-4">{txt.contact_settings}</h4>
                                            <div>
                                                <label className="text-sm font-bold text-gray-500 mb-2 block">{txt.whatsapp_number}</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={settings.whatsapp_number}
                                                        onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                                                        placeholder="+967770000000"
                                                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 ${isRTL ? 'pl-10' : 'pr-10'} text-left font-mono font-bold focus:outline-none focus:border-blue-500 text-gray-800`}
                                                        dir="ltr"
                                                    />
                                                    <Phone size={18} className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-3.5 text-gray-400`} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-500 mb-2 block">{txt.btn_label}</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        maxLength={50}
                                                        value={settings.whatsapp_label || 'تواصل لإكمال عملية الدفع عبر واتساب'}
                                                        onChange={(e) => setSettings({ ...settings, whatsapp_label: e.target.value })}
                                                        placeholder={txt.btn_label_placeholder}
                                                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 ${isRTL ? 'pl-10' : 'pr-10'} font-bold focus:outline-none focus:border-blue-500 text-gray-800`}
                                                    />
                                                    <MessageSquare size={18} className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-3.5 text-gray-400`} />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        /* COD Settings */
                                        <>
                                            {/* Toggle Condition */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-700 font-bold text-lg">{txt.condition_toggle_cod}</span>
                                                <label className="inline-flex items-center cursor-pointer gap-3">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={settings.cod_condition_enabled || false}
                                                        onChange={(e) => setSettings({ ...settings, cod_condition_enabled: e.target.checked })}
                                                    />
                                                    <div className={`relative w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full ${isRTL ? 'peer-checked:after:-translate-x-full' : ''} peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 ${isRTL ? 'after:right-[4px]' : 'after:left-[4px]'} after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600`}></div>
                                                    <span className="text-sm font-bold text-gray-600 peer-checked:text-blue-600 transition-colors">
                                                        {settings.cod_condition_enabled ? txt.active : txt.additional_options}
                                                    </span>
                                                </label>
                                            </div>

                                            {settings.cod_condition_enabled && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="space-y-6 pt-4"
                                                >
                                                    {/* Condition Type Tabs */}
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-500 mb-3 block">{txt.condition_type}</label>
                                                        <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1.5 rounded-xl">
                                                            {['min', 'max', 'range'].map((type) => (
                                                                <button
                                                                    key={type}
                                                                    onClick={() => setSettings({ ...settings, cod_condition_type: type })}
                                                                    className={`py-2 px-4 rounded-lg text-sm font-bold transition-all ${settings.cod_condition_type === type
                                                                        ? 'bg-white text-blue-600 shadow-sm'
                                                                        : 'text-gray-500 hover:text-gray-700'
                                                                        }`}
                                                                >
                                                                    {type === 'min' && txt.min_limit}
                                                                    {type === 'max' && txt.max_limit}
                                                                    {type === 'range' && txt.range_limit}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Condition Inputs */}
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-500 mb-3 block">{txt.cart_value}</label>
                                                        <div className="flex gap-4">
                                                            {(settings.cod_condition_type === 'min' || settings.cod_condition_type === 'range') && (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    placeholder={txt.min_placeholder}
                                                                    value={settings.cod_condition_min || ''}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(0, Number(e.target.value));
                                                                        setSettings(prev => ({ ...prev, cod_condition_min: val }));
                                                                    }}
                                                                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                                />
                                                            )}
                                                            {(settings.cod_condition_type === 'max' || settings.cod_condition_type === 'range') && (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    placeholder={txt.max_placeholder}
                                                                    value={settings.cod_condition_max || ''}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(0, Number(e.target.value));
                                                                        setSettings(prev => ({ ...prev, cod_condition_max: val }));
                                                                    }}
                                                                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Preview */}
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-500 mb-2 block">{txt.preview}</label>
                                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-700 text-sm font-bold text-center border-dashed">
                                                            {txt.preview_cod_prefix}
                                                            {" "}
                                                            {settings.cod_condition_type === 'min' && `${txt.preview_min} ${settings.cod_condition_min || 0}`}
                                                            {settings.cod_condition_type === 'max' && `${txt.preview_max} ${settings.cod_condition_max || 0}`}
                                                            {settings.cod_condition_type === 'range' && `${txt.preview_range_between} ${settings.cod_condition_min || 0} ${txt.preview_range_and} ${settings.cod_condition_max || 0}`}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 flex-shrink-0">
                                    <button
                                        onClick={() => handleSave()}
                                        disabled={isSaving}
                                        className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving ? txt.saving : txt.save}
                                    </button>
                                    <button
                                        onClick={() => setShowConfigModal(false)}
                                        className="px-8 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition active:scale-95"
                                    >
                                        {txt.cancel}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PaymentsView;
