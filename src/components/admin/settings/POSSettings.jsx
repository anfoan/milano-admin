import React, { useState, useEffect } from 'react';
import { Shield, User, Key, Save, CheckCircle, AlertTriangle,
    Plus, Trash2, Edit2, X, Eye, EyeOff } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

const POSSettings = ({ lang = 'ar', onBack }) => {
    const isRTL = lang === 'ar';
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [showWorkerPassword, setShowWorkerPassword] = useState(false);
    const [visibleWorkerIds, setVisibleWorkerIds] = useState(new Set());

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        allowViewHistory: false,
        allowOnlyPrint: false,
        allowExpenses: false,
        allowBonds: false,
        allowManualOrder: false,
        allowDiscount: false,
        allowChangePayment: false
    });

    const txt = {
        ar: {
            title: 'المستخدمين والصلاحيات',
            desc: 'إدارة صلاحيات دخول العاملين وإضافة مستخدمين جدد',
            add_user: 'إضافة مستخدم جديد',
            edit_user: 'تعديل صلاحيات المستخدم',
            delete_user: 'حذف المستخدم',
            delete_confirm: 'هل أنت متأكد من حذف هذا المستخدم نهائياً؟',
            delete_success: 'تم حذف المستخدم بنجاح',
            save_success: 'تم حفظ بيانات المستخدم بنجاح',
            error_required: 'يرجى تعبئة جميع الحقول المطلوبة',
            error_save: 'فشل حفظ البيانات',
            error_delete: 'فشل حذف المستخدم',
            username: 'اسم المستخدم',
            password: 'كلمة المرور',
            username_placeholder: 'مثال: موظف1',
            password_placeholder: '••••••••',
            password_security_hint: 'يمكنك إظهار كلمة المرور الحالية أو استبدالها ثم الضغط على حفظ',
            no_users: 'لا يوجد مستخدمين بعد. أضف أول مستخدم!',
            th_user: 'اسم المستخدم',
            th_permissions: 'الصلاحيات',
            th_actions: 'الإجراءات',
            btn_save: 'حفظ',
            btn_add: 'إضافة',
            btn_cancel: 'إلغاء',
            btn_edit: 'تعديل',
            perm_receipts: 'سجل الإيصالات',
            perm_only_print: 'طباعة فقط (بدون تعديل/حذف)',
            perm_expenses: 'إدارة المصروفات',
            perm_expenses_desc: 'بدون خيار السندات',
            perm_bonds: 'السندات المالية',
            perm_bonds_desc: 'إدارة سندات القبض والصرف',
            perm_manual_order: 'إنشاء طلب خارجي',
            perm_discount: 'السماح بالخصم',
            perm_payment: 'تغيير طريقة الدفع',
        },
        en: {
            title: 'Users & Permissions',
            desc: 'Manage worker login permissions and add new users',
            add_user: 'Add New User',
            edit_user: 'Edit User Permissions',
            delete_user: 'Delete User',
            delete_confirm: 'Are you sure you want to permanently delete this user?',
            delete_success: 'User deleted successfully',
            save_success: 'User data saved successfully',
            error_required: 'Please fill in all required fields',
            error_save: 'Failed to save data',
            error_delete: 'Failed to delete user',
            username: 'Username',
            password: 'Password',
            username_placeholder: 'e.g., Worker1',
            password_placeholder: '••••••••',
            password_security_hint: 'Reveal the current password or replace it, then save',
            no_users: 'No users yet. Add your first user!',
            th_user: 'Username',
            th_permissions: 'Permissions',
            th_actions: 'Actions',
            btn_save: 'Save',
            btn_add: 'Add',
            btn_cancel: 'Cancel',
            btn_edit: 'Edit',
            perm_receipts: 'Receipts Log',
            perm_only_print: 'Print Only (no edit/delete)',
            perm_expenses: 'Expenses Management',
            perm_expenses_desc: 'Without bonds option',
            perm_bonds: 'Financial Bonds',
            perm_bonds_desc: 'Manage receipts and payments',
            perm_manual_order: 'Create External Order',
            perm_discount: 'Allow Discount',
            perm_payment: 'Change Payment Method',
        }
    };

    const t = txt[lang];

    useEffect(() => {
        fetchWorkers();
    }, []);

    const fetchWorkers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "settings", "pos", "workers"));
            const snap = await getDocs(q);
            const items = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setWorkers(items);
        } catch (err) {
            console.error("Error fetching workers:", err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            username: '',
            password: '',
            allowViewHistory: false,
            allowOnlyPrint: false,
            allowExpenses: false,
            allowBonds: false,
            allowManualOrder: false,
            allowDiscount: false,
            allowChangePayment: false
        });
        setEditingId(null);
        setShowForm(false);
        setErrorMsg('');
        setShowWorkerPassword(false);
    };

    const handleEdit = (worker) => {
        setFormData({
            username: worker.username || '',
            password: worker.password || '',
            allowViewHistory: worker.allowViewHistory || false,
            allowOnlyPrint: worker.allowOnlyPrint || false,
            allowExpenses: worker.allowExpenses || false,
            allowBonds: worker.allowBonds || false,
            allowManualOrder: worker.allowManualOrder || false,
            allowDiscount: worker.allowDiscount || false,
            allowChangePayment: worker.allowChangePayment || false
        });
        setEditingId(worker.id);
        setShowForm(true);
    };

    const handleDelete = async (workerId, username) => {
        if (!window.confirm(t.delete_confirm + ` (${username})`)) return;
        try {
            await deleteDoc(doc(db, "settings", "pos", "workers", workerId));
            setWorkers(prev => prev.filter(w => w.id !== workerId));
            setSuccessMsg(t.delete_success);
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            console.error("Error deleting worker:", err);
            alert(t.error_delete);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.username.trim() || (!editingId && !formData.password.trim())) {
            setErrorMsg(t.error_required);
            return;
        }

        try {
            const workerData = {
                username: formData.username.trim(),
                updatedAt: new Date(),
                allowViewHistory: formData.allowViewHistory,
                allowOnlyPrint: formData.allowOnlyPrint,
                allowExpenses: formData.allowExpenses,
                allowBonds: formData.allowBonds,
                allowManualOrder: formData.allowManualOrder,
                allowDiscount: formData.allowDiscount,
                allowChangePayment: formData.allowChangePayment
            };

            if (formData.password.trim()) {
                workerData.password = formData.password.trim();
            }

            // Auto-generate email from username
            workerData.email = formData.username.trim() + '@milano-store.com';

            if (editingId) {
                // Update existing
                await setDoc(doc(db, "settings", "pos", "workers", editingId), workerData, { merge: true });
            } else {
                // Add new
                const newRef = doc(collection(db, "settings", "pos", "workers"));
                await setDoc(newRef, { ...workerData, createdAt: new Date() });
            }

            setSuccessMsg(t.save_success);
            setTimeout(() => setSuccessMsg(''), 3000);
            resetForm();
            fetchWorkers();
        } catch (err) {
            console.error("Error saving worker:", err);
            setErrorMsg(t.error_save);
        }
    };

    const getPermissionBadges = (worker) => {
        const badges = [];
        if (worker.allowViewHistory) badges.push(t.perm_receipts);
        if (worker.allowOnlyPrint) badges.push(t.perm_only_print);
        if (worker.allowExpenses) badges.push(t.perm_expenses);
        if (worker.allowBonds) badges.push(t.perm_bonds);
        if (worker.allowManualOrder) badges.push(t.perm_manual_order);
        if (worker.allowDiscount) badges.push(t.perm_discount);
        if (worker.allowChangePayment) badges.push(t.perm_payment);
        if (badges.length === 0) return [isRTL ? 'بدون صلاحيات' : 'No permissions'];
        return badges;
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    return (
        <div className="max-w-5xl mx-auto font-['Cairo'] pb-6" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="bg-white dark:bg-[#1c1c1e] p-4 md:p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm mb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-500 shrink-0">
                            <Shield size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-800 dark:text-white">{t.title}</h3>
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">{t.desc}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="px-3.5 py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow shadow-blue-600/20"
                    >
                        <Plus size={15} />
                        <span>{t.add_user}</span>
                    </button>
                </div>
            </div>

            {successMsg && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-2xl text-green-600 dark:text-green-400 text-sm font-bold flex items-center gap-2">
                    <CheckCircle size={18} />
                    <span>{successMsg}</span>
                </div>
            )}

            {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2">
                    <AlertTriangle size={18} />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-white dark:bg-[#1c1c1e] p-4 md:p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black text-gray-800 dark:text-white flex items-center gap-2">
                            <User size={16} />
                            {editingId ? t.edit_user : t.add_user}
                        </h4>
                        <button onClick={resetForm} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 block">{t.username}</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleFormChange}
                                        placeholder={t.username_placeholder}
                                        className="w-full bg-gray-50 dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-xl py-2.5 pr-9 pl-3 outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-900 dark:text-white text-right"
                                        required
                                    />
                                    <User className="absolute top-3 right-3 text-gray-400" size={15} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 block">
                                    {t.password} {editingId ? `(${isRTL ? 'اتركه فارغاً' : 'leave empty'})` : ''}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showWorkerPassword ? 'text' : 'password'}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleFormChange}
                                        placeholder={t.password_placeholder}
                                        className="w-full bg-gray-50 dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-xl py-2.5 pr-9 pl-10 outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-900 dark:text-white text-right"
                                        required={!editingId}
                                    />
                                    <Key className="absolute top-3 right-3 text-gray-400" size={15} />
                                    <button type="button" onClick={() => setShowWorkerPassword(prev => !prev)} className="absolute top-2.5 left-3 text-gray-400 hover:text-blue-500" aria-label={showWorkerPassword ? 'Hide password' : 'Show password'}>
                                        {showWorkerPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{t.password_security_hint}</p>
                            </div>
                        </div>

                        {/* Permissions */}
                        <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-white/5">
                            <h5 className="text-xs font-black text-gray-800 dark:text-white">
                                {isRTL ? 'الصلاحيات الممنوحة:' : 'Granted Permissions:'}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors">
                                    <input type="checkbox" name="allowViewHistory" checked={formData.allowViewHistory} onChange={handleFormChange}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                    <span className="text-[11px] font-black text-gray-800 dark:text-white">{t.perm_receipts}</span>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors">
                                    <input type="checkbox" name="allowOnlyPrint" checked={formData.allowOnlyPrint} onChange={handleFormChange}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                    <div>
                                        <span className="text-[11px] font-black text-gray-800 dark:text-white block">{t.perm_only_print}</span>
                                        <span className="text-[9px] text-gray-400 font-bold">{isRTL ? 'إخفاء أزرار التعديل والحذف والاسترجاع' : 'Hide edit, delete & refund'}</span>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors">
                                    <input type="checkbox" name="allowExpenses" checked={formData.allowExpenses} onChange={handleFormChange}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                    <div>
                                        <span className="text-[11px] font-black text-gray-800 dark:text-white block">{t.perm_expenses}</span>
                                        <span className="text-[9px] text-gray-400 font-bold">{t.perm_expenses_desc}</span>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors">
                                    <input type="checkbox" name="allowBonds" checked={formData.allowBonds} onChange={handleFormChange}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                    <div>
                                        <span className="text-[11px] font-black text-gray-800 dark:text-white block">{t.perm_bonds}</span>
                                        <span className="text-[9px] text-gray-400 font-bold">{t.perm_bonds_desc}</span>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors">
                                    <input type="checkbox" name="allowManualOrder" checked={formData.allowManualOrder} onChange={handleFormChange}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                    <span className="text-[11px] font-black text-gray-800 dark:text-white">{t.perm_manual_order}</span>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors">
                                    <input type="checkbox" name="allowDiscount" checked={formData.allowDiscount} onChange={handleFormChange}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                    <span className="text-[11px] font-black text-gray-800 dark:text-white">{t.perm_discount}</span>
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors">
                                    <input type="checkbox" name="allowChangePayment" checked={formData.allowChangePayment} onChange={handleFormChange}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                    <span className="text-[11px] font-black text-gray-800 dark:text-white">{t.perm_payment}</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={resetForm}
                                className="flex-1 py-2.5 border border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 rounded-xl font-black text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                {t.btn_cancel}
                            </button>
                            <button type="submit"
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 shadow shadow-blue-600/20">
                                <Save size={15} />
                                <span>{editingId ? t.btn_save : t.btn_add}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-start">
                        <thead className="bg-gray-50 dark:bg-white/5">
                            <tr>
                                <th className="p-3 md:p-4 font-black text-gray-700 dark:text-gray-300 text-xs">#</th>
                                <th className="p-3 md:p-4 font-black text-gray-700 dark:text-gray-300 text-xs">{t.th_user}</th>
                                <th className="p-3 md:p-4 font-black text-gray-700 dark:text-gray-300 text-xs">{t.password}</th>
                                <th className="p-3 md:p-4 font-black text-gray-700 dark:text-gray-300 text-xs">{t.th_permissions}</th>
                                <th className="p-3 md:p-4 font-black text-gray-700 dark:text-gray-300 text-xs text-center">{t.th_actions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-400 font-bold text-xs">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span>{isRTL ? 'جاري التحميل...' : 'Loading...'}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : workers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Shield size={30} className="text-gray-300" />
                                            <span className="text-gray-400 font-bold italic text-xs">{t.no_users}</span>
                                            <button onClick={() => { resetForm(); setShowForm(true); }}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-black text-[11px] hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                                                <Plus size={13} />
                                                <span>{t.add_user}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                workers.map((worker, idx) => (
                                    <tr key={worker.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-3 md:p-4 text-gray-400 font-bold text-center w-8 text-xs">{idx + 1}</td>
                                        <td className="p-3 md:p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                                    <User size={14} />
                                                </div>
                                                <span className="font-black text-gray-800 dark:text-white text-sm">{worker.username}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 md:p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 min-w-[72px]">
                                                    {visibleWorkerIds.has(worker.id) ? (worker.password || '—') : '••••••••'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setVisibleWorkerIds(prev => {
                                                        const next = new Set(prev);
                                                        next.has(worker.id) ? next.delete(worker.id) : next.add(worker.id);
                                                        return next;
                                                    })}
                                                    className="text-gray-400 hover:text-blue-500"
                                                    title={visibleWorkerIds.has(worker.id) ? 'Hide password' : 'Show password'}
                                                >
                                                    {visibleWorkerIds.has(worker.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-3 md:p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {getPermissionBadges(worker).map((badge, i) => (
                                                    <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                                        badge === (isRTL ? 'بدون صلاحيات' : 'No permissions')
                                                            ? 'bg-gray-100 dark:bg-white/5 text-gray-400'
                                                            : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                    }`}>
                                                        {badge}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-3 md:p-4">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => handleEdit(worker)}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title={t.btn_edit}>
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(worker.id, worker.username)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title={isRTL ? 'حذف' : 'Delete'}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default POSSettings;
