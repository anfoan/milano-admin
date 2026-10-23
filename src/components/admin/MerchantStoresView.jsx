import React, { useEffect, useState } from 'react';
import { Store, Plus, Save, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const EMPTY_FORM = { name: '', imageUrl: '', category: '', description: '' };

const MerchantStoresView = ({ lang = 'ar' }) => {
    const isRTL = lang === 'ar';
    const [stores, setStores] = useState([]);
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const text = isRTL
        ? { title: 'متاجر البائعين', subtitle: 'أضف المتاجر التي ستظهر في قسم تسوق حسب المتجر', add: 'إضافة متجر', edit: 'تعديل المتجر', name: 'اسم المتجر', image: 'رابط صورة المتجر', category: 'القسم المرتبط', description: 'وصف مختصر', save: 'حفظ المتجر', cancel: 'إلغاء', delete: 'حذف', empty: 'لا توجد متاجر مضافة حتى الآن', choose: 'اختر القسم', required: 'اكتب اسم المتجر ورابط الصورة' }
        : { title: 'Seller Stores', subtitle: 'Add the stores that will appear in Shop by Store', add: 'Add Store', edit: 'Edit Store', name: 'Store name', image: 'Store image URL', category: 'Linked category', description: 'Short description', save: 'Save Store', cancel: 'Cancel', delete: 'Delete', empty: 'No stores added yet', choose: 'Choose category', required: 'Enter a store name and image URL' };

    const loadData = async () => {
        setLoading(true);
        const [storesSnapshot, categoriesSnapshot] = await Promise.all([
            getDocs(collection(db, 'merchant_stores')),
            getDocs(collection(db, 'categories')),
        ]);
        setStores(storesSnapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)));
        setCategories(categoriesSnapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999)));
        setLoading(false);
    };

    useEffect(() => { loadData().catch(error => { console.error('Merchant stores load error:', error); setLoading(false); }); }, []);

    const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); };
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.name.trim() || !form.imageUrl.trim()) return alert(text.required);
        setSaving(true);
        try {
            const payload = { name: form.name.trim(), imageUrl: form.imageUrl.trim(), category: form.category, description: form.description.trim(), updatedAt: serverTimestamp() };
            if (editingId) await updateDoc(doc(db, 'merchant_stores', editingId), payload);
            else await addDoc(collection(db, 'merchant_stores'), { ...payload, order: stores.length, createdAt: serverTimestamp() });
            await loadData();
            resetForm();
        } catch (error) {
            console.error('Merchant store save error:', error);
            alert(isRTL ? 'تعذر حفظ المتجر' : 'Unable to save store');
        } finally { setSaving(false); }
    };

    const editStore = (store) => setForm({ name: store.name || '', imageUrl: store.imageUrl || '', category: store.category || '', description: store.description || '' }) || setEditingId(store.id);
    const removeStore = async (store) => {
        if (!window.confirm(isRTL ? `حذف متجر ${store.name}؟` : `Delete ${store.name}?`)) return;
        await deleteDoc(doc(db, 'merchant_stores', store.id));
        setStores(previous => previous.filter(item => item.id !== store.id));
        if (editingId === store.id) resetForm();
    };

    return (
        <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-3 text-2xl font-black text-slate-900 dark:text-white"><Store className="text-blue-600" />{text.title}</h1>
                    <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{text.subtitle}</p>
                </div>
                <button onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"><Plus size={18} />{text.add}</button>
            </div>

            <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black text-slate-900 dark:text-white">{editingId ? text.edit : text.add}</h2>{editingId && <button type="button" onClick={resetForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button>}</div>
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2"><span className="text-sm font-black text-slate-700 dark:text-slate-300">{text.name}</span><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800" /></label>
                    <label className="space-y-2"><span className="text-sm font-black text-slate-700 dark:text-slate-300">{text.image}</span><input value={form.imageUrl} onChange={event => setForm({ ...form, imageUrl: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800" dir="ltr" /></label>
                    <label className="space-y-2"><span className="text-sm font-black text-slate-700 dark:text-slate-300">{text.category}</span><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800"><option value="">{text.choose}</option>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
                    <label className="space-y-2"><span className="text-sm font-black text-slate-700 dark:text-slate-300">{text.description}</span><input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800" /></label>
                </div>
                <div className="mt-4 flex justify-end"><button disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50"><Save size={18} />{text.save}</button></div>
            </form>

            {loading ? <div className="rounded-3xl bg-white p-10 text-center font-black text-slate-500 dark:bg-slate-900">...</div> : stores.length === 0 ? <div className="rounded-3xl bg-white p-10 text-center font-black text-slate-500 dark:bg-slate-900">{text.empty}</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{stores.map(store => <article key={store.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"><div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800"><img src={store.imageUrl} alt={store.name} className="h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} /></div><div className="space-y-3 p-4"><h3 className="font-black text-slate-900 dark:text-white">{store.name}</h3>{store.category && <p className="text-xs font-bold text-slate-500">{store.category}</p>}<div className="flex gap-2"><button onClick={() => editStore(store)} className="flex-1 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{text.edit}</button><button onClick={() => removeStore(store)} className="rounded-xl bg-red-50 px-3 py-2 text-red-600 dark:bg-red-500/10"><Trash2 size={17} /></button></div></div></article>)}</div>}
        </div>
    );
};

export default MerchantStoresView;
