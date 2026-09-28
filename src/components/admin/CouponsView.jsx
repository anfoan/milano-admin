import React, { useState, useEffect } from 'react';
import { Percent, Plus, Trash2, Tag, Calendar, Users, Edit2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

import { getLocalizedCurrency } from '../../lib/currencyUtils';

const CouponsView = ({ lang = 'ar', generalSettings }) => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);

    // Form State
    const [code, setCode] = useState('');
    const [discountPercent, setDiscountPercent] = useState(0);
    const [isUnlimited, setIsUnlimited] = useState(false);
    const [maxUses, setMaxUses] = useState(1);
    const [expiryDate, setExpiryDate] = useState('');
    const [minOrderAmount, setMinOrderAmount] = useState('');

    const t = {
        ar: {
            manage_coupons: "إدارة الكوبونات",
            add_coupon: "إضافة كوبون",
            cancel: "إلغاء",
            random: "عشوائي",
            code_placeholder: "كوبون",
            discount_percent: "نسبة الخصم %",
            discount_amount: "مبلغ",
            unlimited_usage: "غير محدود الاستخدام",
            unlimited_desc: "تفعيل هذا الخيار يلغي الحد الأقصى",
            yes: "نعم",
            no: "لا",
            expiry_date: "تاريخ الانتهاء (اختياري)",
            min_order: `الحد الأدنى للطلب (${getLocalizedCurrency('YER', 'ar')})`,
            min_order_placeholder: "0 (اختياري)",
            max_uses: "أقصى عدد من الاستخدامات",
            max_uses_placeholder: "1",
            save: "حفظ",
            loading: "جاري التحميل...",
            no_coupons: "لا توجد كوبونات متاحة",
            expired: "منتهي الصلاحية",
            open: "مفتوح",
            unlimited: "غير محدود",

            // Table
            th_coupon: "الكوبون",
            th_created: "تاريخ الإنشاء",
            th_expiry: "تاريخ الانتهاء",
            th_discount: "الخصم",
            th_max: "أقصى عدد",
            th_uses: "الاستخدامات",
            th_actions: "العمليات",

            // Alerts
            alert_missing: "يرجى إدخال الكود ونسبة الخصم",
            alert_success: "تم إضافة الكوبون بنجاح",
            alert_error: "حدث خطأ أثناء إضافة الكوبون",
            alert_confirm_delete: "هل أنت متأكد من حذف هذا الكوبون؟"
        },
        en: {
            manage_coupons: "Manage Coupons",
            add_coupon: "Add Coupon",
            cancel: "Cancel",
            random: "Random",
            code_placeholder: "CODE",
            discount_percent: "Discount %",
            discount_amount: "Amount",
            unlimited_usage: "Unlimited Usage",
            unlimited_desc: "Enable to remove usage limit",
            yes: "Yes",
            no: "No",
            expiry_date: "Expiry Date (Optional)",
            min_order: `Min Order Amount (${getLocalizedCurrency('YER', 'en')})`,
            min_order_placeholder: "0 (Optional)",
            max_uses: "Max Uses",
            max_uses_placeholder: "1",
            save: "Save",
            loading: "Loading...",
            no_coupons: "No coupons available",
            expired: "Expired",
            open: "Open",
            unlimited: "Unlimited",

            // Table
            th_coupon: "Coupon",
            th_created: "Created At",
            th_expiry: "Expires At",
            th_discount: "Discount",
            th_max: "Max Uses",
            th_uses: "Used",
            th_actions: "Actions",

            // Alerts
            alert_missing: "Please enter code and discount percentage",
            alert_success: "Coupon added successfully",
            alert_error: "Error adding coupon",
            alert_confirm_delete: "Are you sure you want to delete this coupon?"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';
    const currency = getLocalizedCurrency(generalSettings?.currency || 'YER', lang);

    useEffect(() => {
        const q = query(collection(db, "coupons"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedCoupons = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCoupons(fetchedCoupons);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCode(result);
    };

    const handleAddCoupon = async (e) => {
        e.preventDefault();

        // Security & Validation Checks
        if (!code) return alert(txt.alert_missing);
        if (discountPercent <= 0 || discountPercent > 100) return alert(lang === 'ar' ? 'نسبة الخصم يجب أن تكون بين 1 و 100' : 'Discount must be between 1 and 100');
        if (!isUnlimited && Number(maxUses) < 1) return alert(lang === 'ar' ? 'أقصى عدد للاستخدام يجب أن يكون 1 على الأقل' : 'Max uses must be at least 1');
        if (minOrderAmount < 0) return alert(lang === 'ar' ? 'مبلغ الحد الأدنى لا يمكن أن يكون سالباً' : 'Min order cannot be negative');

        if (expiryDate) {
            const selectedDate = new Date(expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selectedDate < today) return alert(lang === 'ar' ? 'تاريخ الانتهاء لا يمكن أن يكون في الماضي' : 'Expiry date cannot be in the past');
        }

        try {
            // Check for existing code (Simple client-side check if list is small, otherwise query)
            // Since we have 'coupons' state, we can check it.
            if (coupons.some(c => c.code === code.toUpperCase() && c.id !== editingCoupon?.id)) {
                return alert(lang === 'ar' ? 'هذا الكوبون موجود بالفعل' : 'Coupon code already exists');
            }

            const couponData = {
                code: code.toUpperCase(),
                discountPercent: Number(discountPercent),
                maxUses: isUnlimited ? null : Math.max(1, Number(maxUses)),
                expiryDate: expiryDate || null,
                minOrderAmount: Number(minOrderAmount) || 0,
                usedCount: editingCoupon ? Number(editingCoupon.usedCount || 0) : 0,
                isUnlimited,
                createdAt: editingCoupon?.createdAt || serverTimestamp(),
                createdAtDisplay: editingCoupon?.createdAtDisplay || new Date().toISOString().slice(0, 19).replace('T', ' ')
            };
            if (editingCoupon) await updateDoc(doc(db, "coupons", editingCoupon.id), couponData);
            else await addDoc(collection(db, "coupons"), couponData);
            setIsAdding(false);
            resetForm();
            alert(txt.alert_success);
        } catch (error) {
            console.error("Error adding coupon:", error);
            alert(txt.alert_error);
        }
    };

    const resetForm = () => {
        setCode('');
        setDiscountPercent(0);
        setIsUnlimited(false);
        setMaxUses(100);
        setExpiryDate('');
        setMinOrderAmount('');
        setEditingCoupon(null);
    };

    const editCoupon = (coupon) => {
        setEditingCoupon(coupon);
        setCode(coupon.code || '');
        setDiscountPercent(Number(coupon.discountPercent || 0));
        setIsUnlimited(Boolean(coupon.isUnlimited));
        setMaxUses(coupon.maxUses || 1);
        setExpiryDate(coupon.expiryDate || '');
        setMinOrderAmount(coupon.minOrderAmount || '');
        setIsAdding(true);
    };

    const deleteCoupon = async (id) => {
        if (!window.confirm(txt.alert_confirm_delete)) return;
        try {
            await deleteDoc(doc(db, "coupons", id));
        } catch (error) {
            console.error("Error deleting coupon:", error);
        }
    };

    return (
        <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                    <Percent className="text-blue-500" />
                    {txt.manage_coupons}
                </h2>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <Plus size={20} />
                        <span>{txt.add_coupon}</span>
                    </button>
                )}
                {isAdding && (
                    <button
                        onClick={() => { setIsAdding(false); resetForm(); }}
                        className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition flex items-center gap-2"
                    >
                        <span>{txt.cancel}</span>
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isAdding ? (
                    <motion.div
                        initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl overflow-hidden max-w-4xl mx-auto"
                    >
                        <div className="flex justify-center mb-8 border-b-2 border-blue-500 w-fit mx-auto pb-2">
                            <h3 className="text-xl font-black text-gray-800">{editingCoupon ? (lang === 'ar' ? 'تعديل الكوبون' : 'Edit Coupon') : txt.add_coupon}</h3>
                        </div>

                        <div className="space-y-8">
                            {/* Code Input & Random Button */}
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={generateRandomCode}
                                    className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition"
                                >
                                    {txt.random}
                                </button>
                                <input
                                    type="text"
                                    placeholder={txt.code_placeholder}
                                    className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-center text-lg uppercase tracking-widest text-gray-900"
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                />
                            </div>

                            {/* Discount Slider */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm font-bold text-gray-500">
                                    <span>{txt.discount_percent}</span>
                                    <span className="text-2xl text-pink-500 font-black">{discountPercent}%</span><span className="text-sm text-gray-500 font-black">{txt.discount_amount}: {Math.round((Number(minOrderAmount) || 0) * Number(discountPercent) / 100).toLocaleString()} {currency}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={discountPercent}
                                    onChange={(e) => setDiscountPercent(e.target.value)}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                />
                            </div>

                            {/* Unlimited Usage Toggle */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className={isRTL ? "text-right" : "text-left"}>
                                        <label className="font-bold text-gray-700 block">{txt.unlimited_usage}</label>
                                        <span className="text-xs text-gray-400 font-bold">{txt.unlimited_desc}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-bold text-gray-400`}>{txt.no}</span>
                                        <div
                                            onClick={() => setIsUnlimited(!isUnlimited)}
                                            className={`w-14 h-7 rounded-full p-1 cursor-pointer transition-colors ${isUnlimited ? 'bg-pink-500' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isUnlimited ? (isRTL ? '-translate-x-7' : 'translate-x-7') : 'translate-x-0'}`} />
                                        </div>
                                        <span className={`text-sm font-bold ${isUnlimited ? 'text-pink-500' : 'text-gray-400'}`}>{txt.yes}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expiry Date */}
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">{txt.expiry_date}</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900"
                                    value={expiryDate}
                                    onChange={e => setExpiryDate(e.target.value)}
                                />
                            </div>

                            {/* Min Order Amount */}
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">{txt.min_order}</label>
                                <input
                                    type="number"
                                    placeholder={txt.min_order_placeholder}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900"
                                    value={minOrderAmount}
                                    onChange={e => setMinOrderAmount(e.target.value)}
                                />
                            </div>

                            {/* Max Uses Input */}
                            <div className={`transition-opacity duration-300 ${isUnlimited ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                <label className="block text-sm font-bold text-gray-600 mb-2">{txt.max_uses}</label>
                                <input
                                    type="number"
                                    placeholder={txt.max_uses_placeholder}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-center text-gray-900"
                                    value={maxUses}
                                    onChange={e => setMaxUses(e.target.value)}
                                    disabled={isUnlimited}
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleAddCoupon}
                                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
                                >
                                    {txt.save}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                        className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden"
                    >
                        <div className="overflow-x-auto">
                            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                                <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                                    <tr>
                                        <th className="p-6 font-bold">{txt.th_coupon}</th>
                                        <th className="p-6 font-bold">{txt.th_created}</th>
                                        <th className="p-6 font-bold">{txt.th_expiry}</th>
                                        <th className="p-6 font-bold text-center">{txt.th_discount}</th>
                                        <th className="p-6 font-bold text-center">{txt.discount_amount}</th>
                                        <th className="p-6 font-bold text-center">{txt.th_max}</th>
                                        <th className="p-6 font-bold text-center">{txt.th_uses}</th>
                                        <th className="p-6 font-bold text-center">{txt.th_actions}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr><td colSpan="8" className="p-12 text-center text-gray-400 font-bold">{txt.loading}</td></tr>
                                    ) : coupons.length === 0 ? (
                                        <tr><td colSpan="8" className="p-12 text-center text-gray-400 font-bold">{txt.no_coupons}</td></tr>
                                    ) : (
                                        coupons.map((coupon) => (
                                            <tr key={coupon.id} className={`hover:bg-gray-50 transition-colors ${(!coupon.isUnlimited && Number(coupon.usedCount || 0) >= Number(coupon.maxUses || 0)) ? 'opacity-60 bg-gray-50' : ''}`}>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(!coupon.isUnlimited && Number(coupon.usedCount || 0) >= Number(coupon.maxUses || 0)) ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-500'}`}>
                                                            <Tag size={18} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-gray-800 tracking-wider font-mono uppercase text-lg">{coupon.code}</span>
                                                            {(!coupon.isUnlimited && Number(coupon.usedCount || 0) >= Number(coupon.maxUses || 0)) && (
                                                                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded w-fit mt-1">{txt.expired}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <span className="text-gray-500 font-bold text-sm" dir="ltr">{coupon.createdAtDisplay?.split(' ')[0] || 'N/A'}</span>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`font-bold text-sm ${coupon.expiryDate ? 'text-orange-500' : 'text-green-500'}`} dir="ltr">
                                                        {coupon.expiryDate || txt.open}
                                                    </span>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className="font-black text-pink-500 text-lg">{coupon.discountPercent}%</span>
                                                </td>
                                                <td className="p-6 text-center font-black text-gray-700 font-mono">
                                                    {Math.round(Number(coupon.minOrderAmount || 0) * Number(coupon.discountPercent || 0) / 100).toLocaleString()} {currency}
                                                </td>
                                                <td className="p-6 text-center font-bold text-gray-600">
                                                    {coupon.isUnlimited ? (
                                                        <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs">{txt.unlimited}</span>
                                                    ) : coupon.maxUses}
                                                </td>
                                                <td className="p-6 text-center text-gray-500 font-bold">
                                                    {coupon.usedCount || 0}
                                                </td>
                                                <td className="p-6 text-center">
                                                    <button
                                                        onClick={() => editCoupon(coupon)}
                                                        className="p-2 bg-blue-500/15 text-blue-600 hover:bg-blue-500/25 rounded-lg transition-colors"
                                                        title={lang === 'ar' ? 'تعديل' : 'Edit'}
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteCoupon(coupon.id)}
                                                        className="p-2 bg-red-500/15 text-red-600 hover:bg-red-500/25 rounded-lg transition-colors"
                                                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CouponsView;
