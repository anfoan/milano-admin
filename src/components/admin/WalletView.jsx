import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Check, CheckCircle2, Clock3, Copy, FileText, Gift, MapPin, Package, Pencil, Phone, Printer, Search, Settings2, Trash2, Truck, WalletCards, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { grantWalletRewardForCompletedOrder, isCompletedOrderStatus } from '../../lib/walletRewards';

const toMillis = value => value?.toMillis?.() || (value?.seconds ? value.seconds * 1000 : new Date(value || 0).getTime() || 0);
const currency = value => Number(value || 0).toLocaleString('en-US');
const customerName = order => order.formData?.name || order.customer?.name || order.customerName || order.name || 'عميل المتجر';
const customerPhone = order => order.formData?.fullPhone || order.formData?.phone || order.customer?.phone || order.phone || '---';
const orderDate = value => { const date = value?.toDate?.() || new Date(value || Date.now()); return Number.isNaN(date.getTime()) ? '---' : new Intl.DateTimeFormat('ar-YE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date); };
const statusKey = status => isCompletedOrderStatus(status) ? 'completed' : (String(status || '').toLowerCase().includes('ship') || String(status || '').includes('توصيل') ? 'shipping' : (String(status || '').toLowerCase().includes('process') || String(status || '').includes('تجهيز') ? 'processing' : 'new'));
const statusText = key => ({ new: 'قيد المراجعة', processing: 'قيد التجهيز', shipping: 'قيد التوصيل', completed: 'مكتمل' }[key]);
const paymentText = value => ({ cod: 'الدفع عند الاستلام', cash: 'نقدي / كاش', wallet: 'المحفظة', jib_wallet: 'محفظة جيب', bank: 'تحويل بنكي', whatsapp: 'تحويل واتساب' }[String(value || '').toLowerCase()] || '---');

const WalletView = () => {
    const [orders, setOrders] = useState([]);
    const [wallets, setWallets] = useState([]);
    const [settings, setSettings] = useState({ defaultReward: 500, enabled: true });
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [editingOrder, setEditingOrder] = useState(null);
    const [printingOrder, setPrintingOrder] = useState(null);
    const [rewarding, setRewarding] = useState('');
    const [savingReward, setSavingReward] = useState(false);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const stops = [
            onSnapshot(collection(db, 'orders'), snap => setOrders(snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => toMillis(b.createdAt || b.timestamp) - toMillis(a.createdAt || a.timestamp))), error => console.error('Wallet orders listener:', error)),
            onSnapshot(collection(db, 'customer_wallets'), snap => setWallets(snap.docs.map(item => ({ id: item.id, ...item.data() }))), error => console.error('Wallet balance listener:', error)),
            onSnapshot(doc(db, 'settings', 'wallet'), snap => { if (snap.exists()) setSettings(previous => ({ ...previous, ...snap.data() })); })
        ];
        return () => stops.forEach(stop => stop());
    }, []);

    const completedOrders = useMemo(() => orders.filter(order => statusKey(order.status) === 'completed'), [orders]);
    const inProgressOrders = useMemo(() => orders.filter(order => statusKey(order.status) !== 'completed'), [orders]);
    const totalInvoiceValue = useMemo(() => orders.reduce((sum, order) => sum + Number(order.total || 0), 0), [orders]);
    const totalBalances = useMemo(() => wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0), [wallets]);
    const visibleOrders = useMemo(() => orders.filter(order => {
        const key = `${order.orderId || ''} ${customerName(order)} ${customerPhone(order)}`.toLowerCase();
        const filterMatch = filter === 'all' || (filter === 'completed' ? statusKey(order.status) === 'completed' : statusKey(order.status) !== 'completed');
        return filterMatch && key.includes(search.trim().toLowerCase());
    }), [orders, filter, search]);

    const saveReward = async () => {
        setSavingReward(true);
        try {
            await setDoc(doc(db, 'settings', 'wallet'), { defaultReward: Math.max(0, Number(settings.defaultReward || 0)), enabled: settings.enabled !== false, updatedAt: serverTimestamp() }, { merge: true });
            setNotice('تم حفظ مكافأة المتجر.');
        } catch (error) { console.error(error); setNotice('تعذّر حفظ قيمة المكافأة.'); }
        finally { setSavingReward(false); }
    };
    const issueReward = async order => {
        setRewarding(order.id);
        try {
            const result = await grantWalletRewardForCompletedOrder(order.id);
            setNotice(result.granted ? `تم إيداع $ ${currency(result.amount)} في محفظة العميل.` : 'هذه المكافأة مودعة مسبقًا أو غير متاحة لهذا الطلب.');
        } catch (error) { console.error(error); setNotice('تعذّر إيداع المكافأة.'); }
        finally { setRewarding(''); }
    };
    const saveStatus = async status => {
        if (!editingOrder) return;
        try {
            await updateDoc(doc(db, 'orders', editingOrder.id), { status, updatedAt: serverTimestamp() });
            if (isCompletedOrderStatus(status)) await issueReward(editingOrder);
            setEditingOrder(null); setNotice('تم تحديث حالة الفاتورة.');
        } catch (error) { console.error(error); setNotice('تعذّر تعديل حالة الفاتورة.'); }
    };
    const removeOrder = async order => {
        if (!window.confirm(`هل تريد حذف الفاتورة ${order.orderId || ''}؟`)) return;
        try { await deleteDoc(doc(db, 'orders', order.id)); setNotice('تم حذف الفاتورة.'); }
        catch (error) { console.error(error); setNotice('تعذّر حذف الفاتورة.'); }
    };
    const copy = async value => { await navigator.clipboard?.writeText(value || ''); setNotice('تم نسخ رقم الفاتورة.'); };

    return <div dir="rtl" className="mx-auto max-w-7xl space-y-3 font-['Cairo'] text-slate-800 dark:text-white">
        <section className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#1a1d23]"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"><WalletCards size={19}/></div><div><h1 className="text-lg font-black">قسم المحفظة والفواتير</h1><p className="text-[10px] font-bold text-slate-400">متابعة فواتير العملاء وتحديث رصيد محفظتهم تلقائيًا عند اكتمال الطلب</p></div></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"><span>مكافأة المتجر</span><span dir="ltr" className="font-mono">$</span><input dir="ltr" value={settings.defaultReward} onChange={event => setSettings(previous => ({ ...previous, defaultReward: event.target.value.replace(/[^0-9.]/g, '') }))} className="w-12 bg-transparent text-center font-mono font-black outline-none"/><Gift size={14}/></label><button disabled={savingReward} onClick={saveReward} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white shadow-sm disabled:opacity-60">{savingReward ? 'جاري...' : 'تعديل المكافأة'}</button></div></div></section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric tone="emerald" icon={<CheckCircle2 size={18}/>} label="إجمالي فواتير المتجر المكتملة" value={completedOrders.length}/><Metric tone="blue" icon={<Package size={18}/>} label="إجمالي كافة فواتير المتجر" value={orders.length}/><Metric tone="violet" icon={<Gift size={18}/>} label="مبيعات الفواتير المختلفة" value={`${currency(totalInvoiceValue)} ريال يمني`}/><Metric tone="emerald" icon={<WalletCards size={18}/>} label="أرباح موجودة في محافظ العملاء" value={`$ ${currency(totalBalances)}`}/></section>

        <section className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#1a1d23]"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex flex-wrap gap-2"><Filter active={filter === 'all'} tone="blue" onClick={() => setFilter('all')}>جميع الفواتير ({orders.length})</Filter><Filter active={filter === 'completed'} tone="emerald" onClick={() => setFilter('completed')}>مكتملة ومدفوعة ({completedOrders.length})</Filter><Filter active={filter === 'processing'} tone="rose" onClick={() => setFilter('processing')}>قيد المعالجة ({inProgressOrders.length})</Filter></div><div className="relative w-full md:w-72"><Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث برقم الفاتورة أو اسم العميل أو الهاتف..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-[10px] font-bold outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-white/5"/></div></div></section>

        <section className="space-y-3">{visibleOrders.map((order, index) => <InvoiceCard key={order.id} order={order} position={visibleOrders.length - index} rewarding={rewarding === order.id} onReward={() => issueReward(order)} onEdit={() => setEditingOrder(order)} onDelete={() => removeOrder(order)} onPrint={() => setPrintingOrder(order)} onCopy={() => copy(order.orderId)}/>) }{visibleOrders.length === 0 && <div className="rounded-[18px] border border-slate-200 bg-white py-16 text-center text-sm font-bold text-slate-400 shadow-sm dark:border-white/10 dark:bg-[#1a1d23]">لا توجد فواتير مطابقة للبحث الحالي.</div>}</section>

        {notice && <div className="fixed bottom-5 left-1/2 z-[160] -translate-x-1/2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700 shadow-xl dark:border-emerald-400/40 dark:bg-[#183127] dark:text-emerald-200">{notice}</div>}
        {editingOrder && <StatusModal order={editingOrder} onClose={() => setEditingOrder(null)} onSave={saveStatus}/>}
        {printingOrder && <InvoicePreview order={printingOrder} onClose={() => setPrintingOrder(null)}/>}
    </div>;
};

const Metric = ({ tone, icon, label, value }) => <article className={`rounded-[16px] border p-4 shadow-sm ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/70 text-emerald-600 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300' : tone === 'blue' ? 'border-blue-200 bg-blue-50/70 text-blue-600 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300' : 'border-violet-200 bg-violet-50/70 text-violet-600 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300'}`}><div className="flex items-center justify-between"><div className="rounded-lg bg-white/70 p-2 dark:bg-white/10">{icon}</div><p className="max-w-[75%] text-right text-[10px] font-bold text-slate-500 dark:text-slate-300">{label}</p></div><p className="mt-3 text-right font-mono text-lg font-black text-slate-800 dark:text-white">{value}</p></article>;
const Filter = ({ active, tone, onClick, children }) => <button onClick={onClick} className={`rounded-xl border px-3 py-2 text-[10px] font-black transition ${tone === 'blue' ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/15 dark:text-blue-200' : tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-200' : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-200'} ${active ? 'ring-2 ring-slate-400/40 dark:ring-white/30' : 'opacity-80 hover:opacity-100'}`}>{children}</button>;

const InvoiceCard = ({ order, position, rewarding, onReward, onEdit, onDelete, onPrint, onCopy }) => {
    const key = statusKey(order.status);
    const complete = key === 'completed';
    const items = order.cartItems || [];
    const reward = Number(order.walletRewardAmount || 0);
    const stageIndex = { new: 0, processing: 1, shipping: 2, completed: 3 }[key];
    const stages = [{ label: 'قيد المراجعة', Icon: Clock3, tone: 'orange' }, { label: 'قيد التجهيز', Icon: Package, tone: 'violet' }, { label: 'قيد التوصيل', Icon: Truck, tone: 'blue' }, { label: 'مكتمل', Icon: Check, tone: 'emerald' }];
    return <article className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#1a1d23]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 dark:border-white/10"><div className="flex flex-wrap items-center gap-1.5"><button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-black text-rose-700 dark:border-rose-400/35 dark:bg-rose-400/15 dark:text-rose-200"><Trash2 size={12}/> حذف</button><button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-black text-blue-700 dark:border-blue-400/35 dark:bg-blue-400/15 dark:text-blue-200"><Pencil size={12}/> تعديل</button><button onClick={onPrint} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-200"><Printer size={12}/> طباعة</button><span className={`rounded-lg px-2 py-1.5 text-[10px] font-black ${complete ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200' : 'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-200'}`}>{statusText(key)}</span></div><div className="flex items-center gap-2"><button onClick={onCopy} className="text-slate-400 hover:text-emerald-500"><Copy size={14}/></button><span className="text-[9px] font-bold text-slate-400">{orderDate(order.createdAt || order.date)}</span><span dir="ltr" className="font-mono text-[11px] font-black text-blue-600 dark:text-blue-300">{order.orderId || order.id}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-200">{position}</span></div></div><div className="grid grid-cols-2 gap-3 px-4 py-3 text-right md:grid-cols-5"><Data label="اسم العميل" value={customerName(order)}/><Data label="الهاتف" value={customerPhone(order)} ltr/><Data label="طريقة الدفع" value={paymentText(order.paymentMethod)}/><Data label="طريقة التوصيل" value={order.formData?.deliveryType === 'office' ? 'استلام من المكتب' : 'توصيل للمنزل'}/><Data label="إجمالي الفاتورة" value={`${currency(order.total)} ريال يمني`} green/></div>{items.length > 0 && <div className="border-y border-slate-100 px-4 py-2 dark:border-white/5">{items.slice(0, 3).map((item, index) => <div key={`${item.id}-${index}`} className="flex items-center justify-between py-1 text-[10px]"><span className="font-mono font-black text-slate-600 dark:text-slate-300">{currency(Number(item.price || 0) * Number(item.quantity || 1))} ريال يمني</span><span className="font-black">{item.title} <span className="text-slate-400">× {item.quantity || 1}</span></span></div>)}</div>}<div className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 dark:border-emerald-400/30 dark:bg-emerald-400/10"><div className="flex items-center gap-2 text-[10px] font-black text-emerald-700 dark:text-emerald-200"><WalletCards size={14}/><span>الرصيد الحالي بعد اكتمال الطلب:</span><span dir="ltr" className="font-mono">$ {complete && order.walletRewardGranted ? currency(reward) : '0'}</span></div>{complete ? (order.walletRewardGranted ? <span className="rounded-lg bg-emerald-500 px-2 py-1 text-[9px] font-black text-white">تم إيداع المكافأة</span> : <button disabled={rewarding} onClick={onReward} className="rounded-lg bg-emerald-500 px-2 py-1 text-[9px] font-black text-white disabled:opacity-50">{rewarding ? 'جاري...' : 'إيداع المكافأة'}</button>) : <span className="text-[9px] font-bold text-orange-700 dark:text-orange-200">تظهر المكافأة عند اكتمال الطلب فقط</span>}</div><div className="relative mx-5 my-4 flex items-start justify-between"><div className="absolute top-3 right-4 left-4 h-[2px] bg-slate-200 dark:bg-white/10"/><div className="absolute top-3 right-4 h-[2px] bg-gradient-to-l from-orange-400 via-violet-400 to-emerald-400" style={{ width: `${stageIndex / 3 * 100}%` }}/>{stages.map((stage, index) => <div key={stage.label} className="relative z-10 flex w-1/4 flex-col items-center gap-1"><div className={`flex h-6 w-6 items-center justify-center rounded-full border ${index <= stageIndex ? (stage.tone === 'orange' ? 'border-orange-300 bg-orange-100 text-orange-600' : stage.tone === 'violet' ? 'border-violet-300 bg-violet-100 text-violet-600' : stage.tone === 'blue' ? 'border-blue-300 bg-blue-100 text-blue-600' : 'border-emerald-300 bg-emerald-100 text-emerald-600') : 'border-slate-200 bg-white text-slate-300 dark:border-white/10 dark:bg-[#1a1d23]'}`}><stage.Icon size={12}/></div><span className="text-[8px] font-black text-slate-500 dark:text-slate-300">{stage.label}</span></div>)}</div></article>;
};
const Data = ({ label, value, ltr, green }) => <div><p className="text-[9px] font-bold text-slate-400">{label}</p><p dir={ltr ? 'ltr' : undefined} className={`mt-1 break-words text-[10px] font-black ${green ? 'text-emerald-600 dark:text-emerald-300' : ''}`}>{value || '---'}</p></div>;
const StatusModal = ({ order, onClose, onSave }) => <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#1a1d23]"><div className="flex items-center justify-between"><button onClick={onClose} className="text-slate-400"><X size={20}/></button><div className="text-right"><h2 className="font-black">تعديل حالة الفاتورة</h2><p dir="ltr" className="mt-1 font-mono text-[10px] text-slate-400">{order.orderId || order.id}</p></div></div><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => onSave('new')} className="rounded-xl bg-orange-100 py-2.5 text-xs font-black text-orange-700">قيد المراجعة</button><button onClick={() => onSave('processing')} className="rounded-xl bg-violet-100 py-2.5 text-xs font-black text-violet-700">قيد التجهيز</button><button onClick={() => onSave('shipping')} className="rounded-xl bg-blue-100 py-2.5 text-xs font-black text-blue-700">قيد التوصيل</button><button onClick={() => onSave('completed')} className="rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-white">مكتمل</button></div></div></div>;
const InvoicePreview = ({ order, onClose }) => <div className="fixed inset-0 z-[180] overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm"><div className="mx-auto my-5 w-full max-w-2xl rounded-2xl bg-white p-6 text-slate-800 shadow-2xl"><div className="flex justify-between"><button onClick={onClose} className="text-slate-400"><X size={20}/></button><div className="text-right"><h2 className="text-lg font-black">فاتورة متجر ميلانو</h2><p dir="ltr" className="font-mono text-xs text-blue-600">{order.orderId || order.id}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm"><p>العميل: <b>{customerName(order)}</b></p><p dir="ltr">{customerPhone(order)}</p><p>الحالة: <b>{statusText(statusKey(order.status))}</b></p><p>التاريخ: {orderDate(order.createdAt || order.date)}</p></div><div className="mt-4 divide-y border-y">{(order.cartItems || []).map((item, index) => <div key={`${item.id}-${index}`} className="flex justify-between py-3 text-sm"><span>{currency(Number(item.price || 0) * Number(item.quantity || 1))} ريال يمني</span><span>{item.title} × {item.quantity || 1}</span></div>)}</div><div className="mt-4 flex justify-between text-lg font-black text-emerald-600"><span>{currency(order.total)} ريال يمني</span><span>إجمالي الطلب</span></div><button onClick={() => window.print()} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white">طباعة الفاتورة</button></div></div>;

export default WalletView;
