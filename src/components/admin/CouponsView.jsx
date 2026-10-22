import React, { useState, useEffect } from 'react';
import { Percent, Plus, Trash2, Tag, Calendar, Users, Edit2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

import { getLocalizedCurrency } from '../../lib/currencyUtils';
import { useCurrency } from '../../context/CurrencyContext';

const CouponsView = ({ lang = 'ar', generalSettings }) => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);

    // Form State
    const [code, setCode] = useState('');
    const [discountType, setDiscountType] = useState('percent');
    const [discountPercent, setDiscountPercent] = useState('');
    const [discountAmount, setDiscountAmount] = useState('');
    const [isUnlimited, setIsUnlimited] = useState(false);
    const [maxUses, setMaxUses] = useState(1);
    const [expiryDate, setExpiryDate] = useState('');
    const [minOrderAmount, setMinOrderAmount] = useState('');
    const { formatPrice, exchangeRate } = useCurrency();

    const t = {
        ar: {
            manage_coupons: "إدارة الكوبونات",
            add_coupon: "إضافة كوبون",
            cancel: "إلغاء",
            random: "عشوائي",
            code_placeholder: "كوبون",
            discount_type: "الخصم",
            discount_amount: "نسبة الخصم",
            discount_amount_placeholder: "10",
            unlimited_usage: "غير محدود الاستخدام",
            unlimited_desc: "تفعيل هذا الخيار يلغي الحد الأقصى",
            yes: "نعم",
            no: "لا",
            expiry_date: "تاريخ الانتهاء (اختياري)",
            min_order: 'الحد الأدنى للطلب',
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
            alert_amount: "أدخل نسبة خصم بين 1% و100%",
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
            discount_type: "Discount",
            discount_amount: "Discount percentage",
            discount_amount_placeholder: "10",
            unlimited_usage: "Unlimited Usage",
            unlimited_desc: "Enable to remove usage limit",
            yes: "Yes",
            no: "No",
            expiry_date: "Expiry Date (Optional)",
            min_order: 'Min Order Amount',
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
            alert_missing: "Please enter the code and discount percentage",
            alert_amount: "Enter a discount percentage between 1% and 100%",
            alert_success: "Coupon added successfully",
            alert_error: "Error adding coupon",
            alert_confirm_delete: "Are you sure you want to delete this coupon?"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';
    const couponCurrency = generalSettings?.currency === 'SAR' ? 'SAR' : 'YER';
    const currency = getLocalizedCurrency(couponCurrency, lang);
    const toBaseCouponAmount = value => couponCurrency === 'SAR'
        ? Math.round(Math.max(0, Number(value || 0)) * (exchangeRate || 140))
        : Math.round(Math.max(0, Number(value || 0)));
    const fromBaseCouponAmount = value => couponCurrency === 'SAR'
        ? Math.round(Math.max(0, Number(value || 0)) / (exchangeRate || 140))
        : Math.round(Math.max(0, Number(value || 0)));
    const couponHasFixedAmount = coupon => coupon?.discountType === 'fixed' || Number(coupon?.discountAmount || 0) > 0;
    const getDiscountAmount = coupon => couponHasFixedAmount(coupon)
        ? Math.max(0, Math.round(Number(coupon?.discountAmount || 0)))
        : null;
    const formatDiscountAmount = coupon => {
        const amount = getDiscountAmount(coupon);
        return amount === null
            ? (lang === 'ar' ? 'عيّن مبلغ خصم ثابتًا' : 'Set a fixed discount amount')
            : formatPrice(amount, couponCurrency);
    };
    const minimumOrderBaseForSave = () => {
        const displayedMinimum = Math.max(0, Number(minOrderAmount || 0));
        // Do not change an existing stored base amount merely because its SAR
        // display is rounded to a whole riyal.
        if (editingCoupon && displayedMinimum === fromBaseCouponAmount(editingCoupon.minOrderAmount)) {
            return Math.max(0, Number(editingCoupon.minOrderAmount || 0));
        }
        return toBaseCouponAmount(displayedMinimum);
    };

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
        if (discountType === 'percent' && (Number(discountPercent) < 1 || Number(discountPercent) > 100)) return alert(txt.alert_amount);
        if (discountType === 'fixed' && Number(discountAmount) <= 0) return alert(lang === 'ar' ? 'أدخل مبلغ خصم صحيح' : 'Enter a valid fixed discount amount');
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
                discountType,
                discountAmount: discountType === 'fixed' ? toBaseCouponAmount(discountAmount) : 0,
                discountPercent: discountType === 'percent' ? Math.min(100, Math.max(1, Number(discountPercent))) : 0,
                maxUses: isUnlimited ? null : Math.max(1, Number(maxUses)),
                expiryDate: expiryDate || null,
                minOrderAmount: minimumOrderBaseForSave(),
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
        setDiscountType('percent');
        setDiscountPercent('');
        setDiscountAmount('');
        setIsUnlimited(false);
        setMaxUses(100);
        setExpiryDate('');
        setMinOrderAmount('');
        setEditingCoupon(null);
    };

    const editCoupon = (coupon) => {
        setEditingCoupon(coupon);
        setCode(coupon.code || '');
        setDiscountType(coupon.discountType || (Number(coupon.discountAmount || 0) > 0 ? 'fixed' : 'percent'));
        setDiscountPercent(coupon.discountPercent || '');
        setDiscountAmount(fromBaseCouponAmount(coupon.discountAmount) || '');
        setIsUnlimited(Boolean(coupon.isUnlimited));
        setMaxUses(coupon.maxUses || 1);
        setExpiryDate(coupon.expiryDate || '');
        setMinOrderAmount(fromBaseCouponAmount(coupon.minOrderAmount) || '');
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
                        className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]"
                    >
                        <aside className="order-2 rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm lg:order-1">
                            <h3 className="mb-4 text-lg font-black text-gray-800">{lang === 'ar' ? 'ملخص الكوبون' : 'Coupon Summary'}</h3>
                            <div className="space-y-2 text-sm font-bold">
                                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-400">{lang === 'ar' ? 'الكود' : 'Code'}</span><b dir="ltr" className="font-mono">{code || '—'}</b></div>
                                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-400">{lang === 'ar' ? 'الخصم' : 'Discount'}</span><b>{discountType === 'percent' ? `${Number(discountPercent || 1)}%` : discountType === 'fixed' ? `${Number(discountAmount || 0).toLocaleString('en-US')} ${currency}` : (lang === 'ar' ? 'مجاني' : 'Free')}</b></div>
                                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-400">{lang === 'ar' ? 'الاستخدام' : 'Usage'}</span><b>{isUnlimited ? txt.unlimited : `${Number(maxUses || 0).toLocaleString('en-US')} ${lang === 'ar' ? 'مرات' : 'uses'}`}</b></div>
                                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-400">{txt.min_order}</span><b dir="ltr">{Number(minOrderAmount || 0).toLocaleString('en-US')} {currency}</b></div>
                            </div>
                            <button type="button" onClick={handleAddCoupon} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700">{editingCoupon ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (lang === 'ar' ? 'حفظ الكوبون' : 'Save Coupon')}</button>
                            <p className="mt-3 text-center text-[10px] font-bold leading-5 text-gray-400">{lang === 'ar' ? 'يمكنك إيقاف الكوبون أو حذفه في أي وقت من صفحة الكوبونات.' : 'You can disable or delete the coupon at any time.'}</p>
                        </aside>

                        <div className="order-1 space-y-4 lg:order-2">
                            <section className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-center justify-between"><h3 className="text-base font-black text-gray-800">{lang === 'ar' ? 'كود الكوبون' : 'Coupon Code'}</h3><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-600">1</span></div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={generateRandomCode} className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-black text-blue-600 hover:border-blue-400">↻ {lang === 'ar' ? 'توليد كود' : 'Generate Code'}</button>
                                    <input type="text" placeholder={txt.code_placeholder} className="min-w-0 flex-1 rounded-xl border border-blue-400 bg-white px-4 py-3 text-center text-lg font-black uppercase tracking-widest text-gray-900 outline-none" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
                                </div>
                                <p className="mt-2 text-right text-[10px] font-bold text-gray-400">{lang === 'ar' ? 'حروف إنجليزية وأرقام فقط من 3 إلى 20 رمزاً.' : 'Use English letters and numbers from 3 to 20 characters.'}</p>
                            </section>

                            <section className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-center justify-between"><h3 className="text-base font-black text-gray-800">{lang === 'ar' ? 'نوع الخصم' : 'Discount Type'}</h3><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-600">2</span></div>
                                <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-gray-100 p-1">
                                    {[['percent', lang === 'ar' ? 'نسبة مئوية' : 'Percentage'], ['fixed', lang === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'], ['free', lang === 'ar' ? 'توصيل مجاني' : 'Free Delivery']].map(([type, label]) => <button type="button" key={type} onClick={() => setDiscountType(type)} className={`rounded-lg px-4 py-2 text-xs font-black transition ${discountType === type ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-white'}`}>{label}</button>)}
                                </div>
                                {discountType === 'percent' && <>
                                    <div className="rounded-2xl bg-blue-50 p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-gray-500">{lang === 'ar' ? 'قيمة الخصم' : 'Discount value'}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setDiscountPercent(String(Math.max(1, Number(discountPercent || 1) - 1)))} className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-lg font-black text-blue-600">−</button><span className="flex h-10 min-w-20 items-center justify-center rounded-xl border border-blue-400 bg-white px-3 text-lg font-black text-blue-600" dir="ltr">{Number(discountPercent || 1)}%</span><button type="button" onClick={() => setDiscountPercent(String(Math.min(100, Number(discountPercent || 1) + 1)))} className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-lg font-black text-blue-600">+</button></div></div></div>
                                    <div className="mt-3 flex flex-wrap justify-center gap-2">{[5, 10, 15, 20, 25, 30, 40, 50].map(value => <button type="button" key={value} onClick={() => setDiscountPercent(String(value))} className={`rounded-full border px-4 py-2 text-xs font-black ${Number(discountPercent || 1) === value ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-200 bg-white text-gray-600'}`}>{value}%</button>)}</div>
                                    <input aria-label={lang === 'ar' ? 'نسبة الخصم' : 'Discount percentage'} type="range" min="1" max="100" step="1" value={discountPercent || 1} onChange={e => setDiscountPercent(e.target.value)} className="mt-4 w-full accent-blue-500" />
                                </>}
                                {discountType === 'fixed' && <div className="rounded-2xl bg-blue-50 p-4"><label className="mb-2 block text-xs font-black text-gray-600">{lang === 'ar' ? `مبلغ الخصم (${currency})` : `Discount amount (${currency})`}</label><input type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} className="w-full rounded-xl border border-blue-300 bg-white px-4 py-3 text-center font-black text-gray-900 outline-none" /></div>}
                                {discountType === 'free' && <div className="rounded-2xl bg-emerald-50 p-4 text-center text-sm font-black text-emerald-700">{lang === 'ar' ? 'سيتم تطبيق توصيل مجاني على الطلب.' : 'Free delivery will be applied to the order.'}</div>}
                            </section>

                            <section className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="mb-5 flex items-center justify-between"><h3 className="text-base font-black text-gray-800">{lang === 'ar' ? 'شروط الاستخدام' : 'Usage Conditions'}</h3><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-600">3</span></div>
                                <div className="space-y-5">
                                    <div className="flex flex-wrap items-center justify-between gap-4"><label className="text-sm font-black text-gray-700">{lang === 'ar' ? 'عدد مرات الاستخدام' : 'Usage limit'}</label><div className="flex items-center gap-2"><button type="button" disabled={isUnlimited} onClick={() => setMaxUses(Math.max(1, Number(maxUses || 1) - 1))} className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-lg font-black text-blue-600 disabled:opacity-40">−</button><input type="number" min="1" disabled={isUnlimited} value={maxUses} onChange={e => setMaxUses(e.target.value)} className="h-10 w-24 rounded-xl border border-gray-300 text-center font-black text-gray-900 outline-none disabled:bg-gray-100" /><button type="button" disabled={isUnlimited} onClick={() => setMaxUses(Number(maxUses || 0) + 1)} className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-lg font-black text-blue-600 disabled:opacity-40">+</button></div><div className="flex rounded-xl bg-gray-100 p-1"><button type="button" onClick={() => setIsUnlimited(false)} className={`rounded-lg px-4 py-2 text-xs font-black ${!isUnlimited ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>{lang === 'ar' ? 'عدد محدد' : 'Limited'}</button><button type="button" onClick={() => setIsUnlimited(true)} className={`rounded-lg px-4 py-2 text-xs font-black ${isUnlimited ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>{lang === 'ar' ? 'غير محدود' : 'Unlimited'}</button></div></div>
                                    <div className="border-t border-gray-100 pt-5"><div className="flex flex-wrap items-center justify-between gap-4"><label className="text-sm font-black text-gray-700">{txt.min_order}</label><div className="flex items-center overflow-hidden rounded-xl border border-gray-300 bg-white"><input type="number" min="0" value={minOrderAmount} onChange={e => setMinOrderAmount(e.target.value)} className="w-32 px-3 py-3 text-center font-black text-gray-900 outline-none" /><span className="border-l border-gray-200 px-3 text-xs font-black text-gray-500">{currency}</span></div></div><p className="mt-2 text-right text-[10px] font-bold text-gray-400">{lang === 'ar' ? 'لا يعمل الكوبون إذا لم تصل قيمة المنتجات في السلة إلى الحد الأدنى.' : 'The coupon will not work below the minimum cart amount.'}</p></div>
                                    <div className="border-t border-gray-100 pt-5"><label className="mb-2 block text-sm font-black text-gray-700">{txt.expiry_date}</label><input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold text-gray-900 outline-none" /></div>
                                </div>
                            </section>
                        </div>
                    </motion.div>                ) : (
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
                                        <th className="p-6 font-bold text-center">{txt.th_max}</th>
                                        <th className="p-6 font-bold text-center">{txt.th_uses}</th>
                                        <th className="p-6 font-bold text-center">{txt.th_actions}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr><td colSpan="7" className="p-12 text-center text-gray-400 font-bold">{txt.loading}</td></tr>
                                    ) : coupons.length === 0 ? (
                                        <tr><td colSpan="7" className="p-12 text-center text-gray-400 font-bold">{txt.no_coupons}</td></tr>
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
                                                    {coupon.discountType === 'free' ? (
                                                        <span className="inline-flex px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-black">{lang === 'ar' ? 'توصيل مجاني' : 'Free delivery'}</span>
                                                    ) : couponHasFixedAmount(coupon) ? (
                                                        <span className="inline-flex px-3 py-1 rounded-full bg-pink-50 text-pink-600 text-xs font-black">{formatDiscountAmount(coupon)}</span>
                                                    ) : (
                                                        <span className="font-black text-gray-400 text-sm">{coupon.discountPercent || 0}%</span>
                                                    )}
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
                                                    <div className="inline-flex items-center gap-2">
                                                        <button
                                                            onClick={() => editCoupon(coupon)}
                                                            className="w-8 h-8 p-0 bg-blue-500/15 text-blue-600 hover:bg-blue-500/25 rounded-lg transition-colors inline-flex items-center justify-center"
                                                            title={lang === 'ar' ? 'تعديل' : 'Edit'}
                                                        >
                                                            <Edit2 size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteCoupon(coupon.id)}
                                                            className="w-8 h-8 p-0 bg-red-500/15 text-red-600 hover:bg-red-500/25 rounded-lg transition-colors inline-flex items-center justify-center"
                                                            title={lang === 'ar' ? 'حذف' : 'Delete'}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
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
