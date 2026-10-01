import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Check, CheckCircle2, ChevronDown, Clock3, Gift, KeyRound, MapPin, Package, Pencil, Printer, Save, Search, Trash2, Truck, Wallet, WalletCards, WalletMinimal, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { getOrderRewardWalletId, grantWalletRewardForCompletedOrder, isCompletedOrderStatus, syncWalletRewardForOrderStatus } from '../../lib/walletRewards';
import { adjustCustomerWalletBalance, ensureWalletSpendLedgerForOrder, setCustomerWalletBalance } from '../../lib/walletLedger';

const toMillis = value => value?.toMillis?.() || (value?.seconds ? value.seconds * 1000 : new Date(value || 0).getTime() || 0);
const WALLET_SAR_EXCHANGE_RATE = 140;
const walletCurrencyLabel = code => code === 'SAR' ? 'ريال سعودي' : 'ريال يمني';
const walletConvertedAmount = (value, code) => {
    const baseValue = Number(value || 0);
    const converted = code === 'SAR' ? baseValue / WALLET_SAR_EXCHANGE_RATE : baseValue;
    return converted.toLocaleString('en-US', { minimumFractionDigits: code === 'SAR' ? 2 : 0, maximumFractionDigits: code === 'SAR' ? 2 : 0 });
};
const walletBaseAmount = (value, code) => Math.max(0, Number(value || 0) * (code === 'SAR' ? WALLET_SAR_EXCHANGE_RATE : 1));
const isValidWalletPassword = value => /^[0-9]{4,6}$/.test(String(value || ''));
const hashWalletPassword = async password => {
    const bytes = new TextEncoder().encode(`milano-wallet-v1:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const customerName = order => order.formData?.name || order.customer?.name || order.customerName || order.name || 'عميل المتجر';
const customerPhone = order => order.formData?.fullPhone || order.formData?.phone || order.customer?.phone || order.phone || '---';
const orderDate = value => { const date = value?.toDate?.() || new Date(value || Date.now()); return Number.isNaN(date.getTime()) ? '---' : new Intl.DateTimeFormat('ar-YE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date); };
const statusKey = status => {
    const value = String(status || '').toLowerCase();
    if (value.includes('return') || value.includes('مسترجع')) return 'returned';
    if (isCompletedOrderStatus(status)) return 'completed';
    if (value.includes('ship') || value.includes('توصيل')) return 'shipping';
    if (value.includes('process') || value.includes('تجهيز')) return 'processing';
    return 'new';
};
const statusText = key => ({ new: 'طلب جديد', processing: 'قيد التجهيز', shipping: 'قيد التوصيل', completed: 'مكتمل', returned: 'مسترجع' }[key] || 'طلب جديد');
const paymentText = value => ({ cod: 'الدفع عند الاستلام', cash: 'نقدي / كاش', wallet: 'المحفظة', jib_wallet: 'محفظة جيب', bank: 'تحويل بنكي', whatsapp: 'تحويل واتساب' }[String(value || '').toLowerCase()] || '---');
// Wallet invoice cards belong only to storefront checkout. POS and external
// invoices remain available in the main orders/receipts sections.
const isStorefrontInvoice = order => order?.isPOS !== true && order?.isExternal !== true;
const movementMeta = type => ({ reward: { label: 'مكافأة طلب مكتمل', tone: 'emerald', sign: '+' }, reward_reversal: { label: 'استرجاع مكافأة', tone: 'rose', sign: '-' }, credit: { label: 'إضافة رصيد', tone: 'blue', sign: '+' }, bonus: { label: 'رصيد تشجيعي', tone: 'violet', sign: '+' }, debit: { label: 'خصم رصيد', tone: 'rose', sign: '-' }, spend: { label: 'استخدام الرصيد في طلب', tone: 'rose', sign: '-' } }[type] || { label: 'حركة محفظة', tone: 'slate', sign: '' });

const WalletView = () => {
    const [orders, setOrders] = useState([]);
    const [wallets, setWallets] = useState([]);
    const [walletTransactions, setWalletTransactions] = useState([]);
    const [settings, setSettings] = useState({ defaultReward: 500, enabled: true });
    const [walletSettingsLoaded, setWalletSettingsLoaded] = useState(false);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [editingOrder, setEditingOrder] = useState(null);
    const [printingOrder, setPrintingOrder] = useState(null);
    const [rewarding, setRewarding] = useState('');
    const [deletingOrderId, setDeletingOrderId] = useState('');
    const [savingReward, setSavingReward] = useState(false);
    const [rewardModalOpen, setRewardModalOpen] = useState(false);
    const [notice, setNotice] = useState('');
    const [walletDisplayCurrency, setWalletDisplayCurrency] = useState('YER');
    const [managingWallet, setManagingWallet] = useState(null);
    const [savingWalletAdjustment, setSavingWalletAdjustment] = useState(false);
    const spendLedgerSyncRef = useRef(new Set());
    const rewardSyncRef = useRef(new Set());

    useEffect(() => {
        const stops = [
            onSnapshot(collection(db, 'orders'), snap => setOrders(snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => toMillis(b.createdAt || b.timestamp) - toMillis(a.createdAt || a.timestamp))), error => console.error('Wallet orders listener:', error)),
            onSnapshot(collection(db, 'customer_wallets'), snap => setWallets(snap.docs.map(item => ({ id: item.id, ...item.data() }))), error => console.error('Wallet balance listener:', error)),
            onSnapshot(collection(db, 'wallet_transactions'), snap => setWalletTransactions(snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))), error => console.error('Wallet transaction listener:', error)),
            onSnapshot(doc(db, 'settings', 'wallet'), snap => { if (snap.exists()) setSettings(previous => ({ ...previous, ...snap.data() })); setWalletSettingsLoaded(true); }, error => { console.error('Wallet settings listener:', error); setWalletSettingsLoaded(true); })
        ];
        return () => stops.forEach(stop => stop());
    }, []);

    const storeOrders = useMemo(() => orders.filter(isStorefrontInvoice), [orders]);
    const completedOrders = useMemo(() => storeOrders.filter(order => statusKey(order.status) === 'completed'), [storeOrders]);
    const inProgressOrders = useMemo(() => storeOrders.filter(order => statusKey(order.status) !== 'completed'), [storeOrders]);
    const totalInvoiceValue = useMemo(() => storeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0), [storeOrders]);
    // This total is the exact sum shown beside «الرصيد الحالي بعد اكتمال الطلب»
    // for completed invoices only. Changing status removes or restores it immediately.
    const completedWalletRewardsTotal = useMemo(() => orders.reduce((sum, order) => {
        if (!isCompletedOrderStatus(order.status)) return sum;
        return sum + Math.max(0, Number(order.walletRewardAmount ?? settings.defaultReward ?? 0));
    }, 0), [orders, settings.defaultReward]);
    const walletMap = useMemo(() => new Map(wallets.map(wallet => [wallet.walletId || wallet.id, wallet])), [wallets]);
    const visibleOrders = useMemo(() => storeOrders.filter(order => {
        const key = `${order.orderId || ''} ${customerName(order)} ${customerPhone(order)}`.toLowerCase();
        const filterMatch = filter === 'all' || (filter === 'completed' ? statusKey(order.status) === 'completed' : statusKey(order.status) !== 'completed');
        return filterMatch && key.includes(search.trim().toLowerCase());
    }), [storeOrders, filter, search]);
    const visibleWallets = useMemo(() => wallets.filter(wallet => `${wallet.customerName || ''} ${wallet.phone || ''} ${wallet.walletId || wallet.id || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [wallets, search]);
    const recentWalletTransactions = useMemo(() => walletTransactions.slice(0, 8), [walletTransactions]);
    const walletCurrencyText = walletCurrencyLabel(walletDisplayCurrency);
    const walletAmount = value => walletConvertedAmount(value, walletDisplayCurrency);
    const toWalletBase = value => walletBaseAmount(value, walletDisplayCurrency);

    useEffect(() => {
        orders.filter(order => Number(order.walletApplied || 0) > 0 && !order.walletSpendLedgerCreated).forEach(order => {
            if (spendLedgerSyncRef.current.has(order.id)) return;
            spendLedgerSyncRef.current.add(order.id);
            ensureWalletSpendLedgerForOrder(order.id).catch(error => console.error('Wallet spend ledger sync:', error)).finally(() => spendLedgerSyncRef.current.delete(order.id));
        });
    }, [orders]);

    // Reconcile every existing and newly updated invoice so the total wallet balance
    // always receives the reward for completed orders and returns it on any other status.
    useEffect(() => {
        if (!walletSettingsLoaded) return;
        orders.forEach(order => {
            if (!order.id || !getOrderRewardWalletId(order)) return;
            const completed = isCompletedOrderStatus(order.status);
            const needsCredit = completed && (!order.walletRewardGranted || order.walletRewardReversed);
            const needsReversal = !completed && order.walletRewardGranted && !order.walletRewardReversed;
            if ((!needsCredit && !needsReversal) || rewardSyncRef.current.has(order.id)) return;
            rewardSyncRef.current.add(order.id);
            syncWalletRewardForOrderStatus(order.id, order.status)
                .catch(error => console.error('Wallet reward reconciliation:', error))
                .finally(() => rewardSyncRef.current.delete(order.id));
        });
    }, [orders, settings.defaultReward, settings.enabled, walletSettingsLoaded]);

    const saveReward = async (amount = settings.defaultReward) => {
        const defaultReward = Math.max(0, Number(amount || 0));
        setSavingReward(true);
        try {
            await setDoc(doc(db, 'settings', 'wallet'), { defaultReward, enabled: settings.enabled !== false, updatedAt: serverTimestamp() }, { merge: true });
            setSettings(previous => ({ ...previous, defaultReward }));
            setRewardModalOpen(false);
            setNotice('تم حفظ مكافأة المتجر وتطبيقها على الطلبات المكتملة الجديدة.');
        } catch (error) { console.error(error); setNotice('تعذّر حفظ قيمة المكافأة.'); }
        finally { setSavingReward(false); }
    };
    const issueReward = async order => {
        setRewarding(order.id);
        try {
            const result = await grantWalletRewardForCompletedOrder(order.id);
            setNotice(result.granted ? `تم إيداع $ ${walletAmount(result.amount)} ${walletCurrencyText} في محفظة العميل.` : 'هذه المكافأة مودعة مسبقًا أو غير متاحة لهذا الطلب.');
        } catch (error) { console.error(error); setNotice('تعذّر إيداع المكافأة.'); }
        finally { setRewarding(''); }
    };
    const saveStatus = async (order, status) => {
        try {
            await updateDoc(doc(db, 'orders', order.id), { status, updatedAt: serverTimestamp() });
            const walletResult = await syncWalletRewardForOrderStatus(order.id, status);
            setNotice(walletResult.reversed ? `تم تحديث الحالة واسترجاع $ ${walletAmount(walletResult.amount)} ${walletCurrencyText} من مكافأة العميل.` : 'تم تحديث حالة الفاتورة.');
        } catch (error) { console.error(error); setNotice('تعذّر تعديل حالة الفاتورة.'); }
    };
    const saveInvoice = async (draft) => {
        try {
            const phone = String(draft.formData?.fullPhone || draft.formData?.phone || '').trim();
            const newPassword = String(draft.walletPassword || '');
            if (newPassword && !isValidWalletPassword(newPassword)) {
                setNotice('كلمة المرور يجب أن تكون من 4 إلى 6 أرقام إنجليزية.');
                return;
            }
            const orderFormData = { ...draft.formData, fullPhone: phone };
            const walletId = getOrderRewardWalletId({ ...draft, formData: orderFormData }) || draft.customerWalletId || draft.walletId || '';
            const requestedWalletBalance = Math.max(0, Number(draft.walletBalance || 0));
            const walletUpdate = walletId && (phone || newPassword)
                ? {
                    walletId,
                    customerName: String(orderFormData.name || draft.customerName || '').trim(),
                    phone,
                    ...(newPassword ? { pinHash: await hashWalletPassword(newPassword), pinConfigured: true } : {}),
                    updatedAt: serverTimestamp()
                }
                : null;
            await Promise.all([
                updateDoc(doc(db, 'orders', draft.id), {
                    formData: orderFormData,
                    total: Math.max(0, Number(draft.total || 0)),
                    status: draft.status,
                    walletRewardOverride: Math.max(0, Number(draft.walletRewardOverride || 0)),
                    adminNote: draft.adminNote || '',
                    updatedAt: serverTimestamp()
                }),
                walletUpdate ? setDoc(doc(db, 'customer_wallets', walletId), walletUpdate, { merge: true }) : Promise.resolve()
            ]);
            if (walletId) {
                await setCustomerWalletBalance({
                    walletId,
                    balance: requestedWalletBalance,
                    customerName: String(orderFormData.name || draft.customerName || '').trim(),
                    phone,
                    note: `تعديل الرصيد المباشر من الفاتورة ${draft.orderId || draft.id}`
                });
            }
            const walletResult = await syncWalletRewardForOrderStatus(draft.id, draft.status);
            setEditingOrder(null);
            setNotice(walletResult.reversed ? `تم حفظ التعديلات واسترجاع $ ${walletAmount(walletResult.amount)} ${walletCurrencyText} من مكافأة العميل.` : 'تم حفظ تعديلات الفاتورة.');
        } catch (error) { console.error(error); setNotice('تعذّر حفظ تعديلات الفاتورة.'); }
    };
    const saveWalletAdjustment = async draft => {
        setSavingWalletAdjustment(true);
        try {
            if (String(draft.targetBalance ?? '').trim() === '') {
                setNotice('أدخل الرصيد الجديد للعميل أولاً.');
                return;
            }
            const targetBalance = toWalletBase(draft.targetBalance);
            const additionalCredit = toWalletBase(draft.additionalCredit);
            const directResult = await setCustomerWalletBalance({
                walletId: draft.walletId,
                balance: targetBalance,
                customerName: draft.customerName,
                phone: draft.phone,
                note: 'تعديل الرصيد الحالي من الفاتورة'
            });
            const additionResult = additionalCredit > 0
                ? await adjustCustomerWalletBalance({
                    walletId: draft.walletId,
                    type: 'credit',
                    amount: additionalCredit,
                    customerName: draft.customerName,
                    phone: draft.phone,
                    note: 'إضافة رصيد جديد غير المكافأة من الفاتورة'
                })
                : null;
            const finalBalance = additionResult?.balance ?? directResult.balance;
            setNotice(`تم حفظ الرصيد. الرصيد الحالي للعميل: $ ${walletAmount(finalBalance)} ${walletCurrencyText}.`);
            setManagingWallet(null);
        } catch (error) {
            console.error(error);
            setNotice('تعذّر حفظ تعديل رصيد العميل.');
        } finally { setSavingWalletAdjustment(false); }
    };
    const removeOrder = async order => {
        const confirmed = window.confirm(`هل أنت متأكد من حذف الفاتورة ${order.orderId || order.id}؟

سيتم حذفها من قسم المحفظة وقائمة الطلبات بشكل نهائي.`);
        if (!confirmed) return;
        setDeletingOrderId(order.id);
        try {
            // Delete the shared orders document so both Wallet and Orders listeners remove it.
            await deleteDoc(doc(db, 'orders', order.id));
            // Remove it locally as well, so Wallet updates immediately without waiting for a snapshot.
            setOrders(previous => previous.filter(item => item.id !== order.id));
            setNotice('');
        } catch (error) {
            console.error('Wallet invoice deletion failed:', error);
            setNotice('تعذّر حذف الفاتورة. تأكد من صلاحية لوحة التحكم ثم حاول مرة أخرى.');
        } finally { setDeletingOrderId(''); }
    };
    const copy = async value => { await navigator.clipboard?.writeText(value || ''); setNotice('تم نسخ رقم الفاتورة.'); };

    return <div dir="rtl" className="mx-auto max-w-7xl space-y-3 rounded-[22px] bg-slate-50/80 p-3 font-['Cairo'] text-slate-800 dark:bg-[#0d1118] dark:text-white">
        <section className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#1a1d23]"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-emerald-600 shadow-sm dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300"><Wallet size={19}/></div><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="text-lg font-black leading-5">قسم المحفظة والفواتير</h1><span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">مكافآت المتجر <Gift className="mr-1 inline" size={11}/></span></div><p className="mt-1 text-[10px] font-bold text-slate-400">إدارة فواتير العملاء وتحديث الرصيد تلقائيًا في محفظتهم عند اكتمال الطلب</p></div></div><div dir="ltr" className="flex items-center gap-2 self-start lg:self-auto"><div dir="rtl" className="flex flex-col items-stretch gap-0.5"><button onClick={() => setWalletDisplayCurrency('YER')} className={`rounded-[5px] px-2 py-[2px] text-[8px] font-black leading-3 shadow-sm transition ${walletDisplayCurrency === 'YER' ? 'bg-emerald-600 text-white shadow-emerald-600/25' : 'border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>ريال يمني</button><button onClick={() => setWalletDisplayCurrency('SAR')} className={`rounded-[5px] px-2 py-[2px] text-[8px] font-black leading-3 shadow-sm transition ${walletDisplayCurrency === 'SAR' ? 'bg-emerald-600 text-white shadow-emerald-600/25' : 'border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>ريال سعودي</button></div><div className="inline-flex h-8 min-w-[118px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 text-emerald-600 shadow-sm dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"><button type="button" onClick={() => setRewardModalOpen(true)} title="تعديل مبلغ المكافأة" className="rounded-md p-1 transition hover:bg-emerald-100 dark:hover:bg-emerald-400/15"><Pencil size={13}/></button><span className="font-sans text-sm font-black">$</span><span className="font-mono text-sm font-black tabular-nums">{walletAmount(settings.defaultReward)}</span><Wallet size={14}/></div></div></div></section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric tone="emerald" icon={<CheckCircle2 size={18}/>} label="إجمالي فواتير المتجر المكتملة" value={completedOrders.length}/><Metric tone="blue" icon={<Package size={18}/>} label="إجمالي كافة فواتير المتجر" value={storeOrders.length}/><Metric tone="violet" icon={<Gift size={18}/>} label="مبيعات الفواتير المكتملة للمتجر" value={<span dir="ltr" className="inline-flex items-baseline gap-1 tabular-nums"><span dir="rtl" className="font-sans text-[10px] font-black text-slate-600 dark:text-slate-100">{walletCurrencyText}</span><span className="font-mono">{walletAmount(totalInvoiceValue)}</span></span>}/><Metric tone="emerald" icon={<Wallet size={18}/>} label="إجمالي أرصدة محافظ العملاء" value={<span dir="ltr" className="inline-flex items-center gap-1 font-sans tabular-nums not-italic"><span className="font-['Arial','Helvetica',sans-serif] not-italic font-bold leading-none">$</span><span>{walletAmount(completedWalletRewardsTotal)}</span></span>} openDigits/></section>



        <section className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#1a1d23]"><div className="flex flex-col gap-3 md:flex-row-reverse md:items-center md:justify-between"><div className="flex flex-wrap gap-2"><Filter active={filter === 'all'} tone="blue" onClick={() => setFilter('all')}>جميع الفواتير ({storeOrders.length})</Filter><Filter active={filter === 'completed'} tone="emerald" onClick={() => setFilter('completed')}>فواتير مكتملة ومدفوعة ({completedOrders.length})</Filter><Filter active={filter === 'processing'} tone="maroon" onClick={() => setFilter('processing')}>فواتير قيد المعالجة ({inProgressOrders.length})</Filter></div><div className="relative w-full md:w-72"><Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث بالعميل أو الهاتف أو رقم الفاتورة..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-[10px] font-bold outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-white/5"/></div></div></section>

        <section className="space-y-3">{visibleOrders.map((order, index) => <InvoiceCard key={order.id} order={order} wallet={walletMap.get(order.customerWalletId)} position={visibleOrders.length - index} isLatest={order.id === storeOrders[0]?.id} rewarding={rewarding === order.id} deleting={deletingOrderId === order.id} defaultReward={settings.defaultReward} formatAmount={walletAmount} currencyLabel={walletCurrencyText} onReward={() => issueReward(order)} onEdit={() => setEditingOrder(order)} onDelete={() => removeOrder(order)} onPrint={() => setPrintingOrder(order)} onChangeStatus={status => saveStatus(order, status)} onManageWallet={() => { const wallet = walletMap.get(order.customerWalletId); if (wallet) setManagingWallet({ wallet, order }); else setNotice('لا توجد محفظة مرتبطة بهذه الفاتورة بعد.'); }}/>) }{visibleOrders.length === 0 && <div className="rounded-[18px] border border-slate-200 bg-white py-16 text-center text-sm font-bold text-slate-400 shadow-sm dark:border-white/10 dark:bg-[#1a1d23]">لا توجد فواتير مطابقة للبحث الحالي.</div>}</section>

        {rewardModalOpen && <RewardSettingsModal amount={settings.defaultReward} currencyCode={walletDisplayCurrency} saving={savingReward} onClose={() => setRewardModalOpen(false)} onSave={value => saveReward(toWalletBase(value))}/>}
        {managingWallet && <WalletAdjustmentModal wallet={managingWallet.wallet} order={managingWallet.order} defaultReward={settings.defaultReward} currencyCode={walletDisplayCurrency} currencyLabel={walletCurrencyText} formatAmount={walletAmount} saving={savingWalletAdjustment} onClose={() => setManagingWallet(null)} onSave={saveWalletAdjustment}/>}
        {notice && <div dir="rtl" className="fixed inset-x-0 bottom-5 z-[160] mx-auto w-fit max-w-[calc(100vw-2rem)] -translate-x-5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-xs font-black text-emerald-700 shadow-xl dark:border-emerald-400/40 dark:bg-[#183127] dark:text-emerald-200">{notice}</div>}
        {editingOrder && <InvoiceEditModal key={editingOrder.id} order={editingOrder} wallet={walletMap.get(editingOrder.customerWalletId)} defaultReward={settings.defaultReward} currencyCode={walletDisplayCurrency} currencyLabel={walletCurrencyText} formatAmount={walletAmount} onClose={() => setEditingOrder(null)} onSave={draft => saveInvoice({ ...draft, total: toWalletBase(draft.total), walletRewardOverride: toWalletBase(draft.walletRewardOverride), walletBalance: toWalletBase(draft.walletBalance) })}/>}
        {printingOrder && <InvoicePreview order={printingOrder} formatAmount={walletAmount} currencyLabel={walletCurrencyText} onClose={() => setPrintingOrder(null)}/>}
    </div>;
};

const RewardSettingsModal = ({ amount, currencyCode, saving, onClose, onSave }) => {
    const [value, setValue] = useState(String(currencyCode === 'SAR' ? Number(amount || 0) / WALLET_SAR_EXCHANGE_RATE : Number(amount || 0)));
    const presets = currencyCode === 'SAR' ? [2.15, 3.58, 7.15, 10.72, 14.29] : [300, 500, 1000, 1500, 2000];
    const selected = Number(value || 0);
    return <div className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><div dir="rtl" className="w-full max-w-[440px] overflow-hidden rounded-[22px] bg-white shadow-2xl dark:bg-[#1a1d23]"><header dir="ltr" className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10"><button onClick={onClose} className="text-slate-300 transition hover:text-rose-500"><X size={20}/></button><div dir="rtl" className="flex items-center gap-2"><div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"><Wallet size={16} strokeWidth={2.5}/></div><h2 className="text-sm font-black">تعديل مبلغ مكافأة محفظة العميل</h2></div></header><div className="space-y-4 px-5 py-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50/85 px-4 py-3 text-right dark:border-emerald-400/25 dark:bg-emerald-400/10"><p className="text-[10px] font-black leading-5 text-emerald-700 dark:text-emerald-200">المبلغ المحدد هنا هو الذي يحصل عليه كل عميل تلقائيًا في محفظته عند اكتمال الطلب بنجاح.</p><p className="mt-1 text-[8px] font-bold leading-4 text-emerald-700/75 dark:text-emerald-200/75">يمكن تعديل القيمة في أي وقت، وتطبق على الفواتير المكتملة الجديدة فقط.</p></div><label className="block text-right"><span className="mb-1 block text-[10px] font-black text-slate-600 dark:text-slate-200">المبلغ الافتراضي للمكافأة لكل طلب مكتمل ({walletCurrencyLabel(currencyCode)}):</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-emerald-600">$</span><input dir="ltr" inputMode="decimal" value={value} onChange={event => setValue(event.target.value.replace(/[^0-9.]/g, ''))} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-8 pr-3 text-right font-mono text-sm font-black text-emerald-700 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-emerald-200"/></div></label><div><p className="mb-2 text-right text-[9px] font-bold text-slate-400">مبالغ سريعة مقترحة ({walletCurrencyLabel(currencyCode)})</p><div className="flex flex-wrap justify-end gap-2">{presets.map(preset => <button key={preset} onClick={() => setValue(String(preset))} className={`rounded-lg border px-3 py-1.5 text-[10px] font-black transition ${selected === preset ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-emerald-400/10'}`}>{Number(preset).toLocaleString('en-US', { maximumFractionDigits: currencyCode === 'SAR' ? 2 : 0 })} {walletCurrencyLabel(currencyCode)}</button>)}</div></div></div><footer className="flex items-center gap-4 border-t border-slate-100 px-5 py-3 dark:border-white/10"><button disabled={saving} onClick={() => onSave(value)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-60">{saving ? 'جاري الحفظ...' : 'حفظ وتطبيق'}</button><button onClick={onClose} className="text-xs font-black text-slate-500">إلغاء</button></footer></div></div>;
};

const WalletAdjustmentModal = ({ wallet, order, defaultReward, currencyCode, currencyLabel, formatAmount, saving, onClose, onSave }) => {
    const displayBalance = currencyCode === 'SAR' ? Number(wallet.balance || 0) / WALLET_SAR_EXCHANGE_RATE : Number(wallet.balance || 0);
    const invoiceReward = Number(order?.walletRewardAmount ?? defaultReward ?? 0);
    const displayReward = currencyCode === 'SAR' ? invoiceReward / WALLET_SAR_EXCHANGE_RATE : invoiceReward;
    const [targetBalance, setTargetBalance] = useState(String(displayBalance));
    const [additionalCredit, setAdditionalCredit] = useState('');
    const submit = event => {
        event.preventDefault();
        onSave({
            walletId: wallet.walletId || wallet.id,
            targetBalance,
            additionalCredit,
            customerName: wallet.customerName || customerName(order),
            phone: wallet.phone || customerPhone(order)
        });
    };
    return <div className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm"><form dir="rtl" onSubmit={submit} className="w-full max-w-[405px] overflow-hidden rounded-[22px] border border-white/10 bg-[#171c28] text-white shadow-2xl"><header dir="ltr" className="flex items-center justify-between border-b border-white/10 px-5 py-4"><button type="button" onClick={onClose} className="text-slate-400 transition hover:text-rose-400"><X size={19}/></button><div dir="rtl" className="flex items-center gap-2"><div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-1.5 text-emerald-300"><Wallet size={16}/></div><h2 className="text-sm font-black">تعديل رصيد محفظة العميل ({currencyLabel})</h2></div></header><div className="space-y-3 px-5 py-4"><div className="flex items-center justify-between text-[9px] font-bold text-slate-400"><span>معرّف العميل (هاتف / جهاز):</span><span dir="ltr" className="font-mono text-slate-200">هاتف: {wallet.phone || customerPhone(order)}</span></div><section className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-3"><div className="flex items-center justify-between gap-3"><div className="text-right"><p className="text-[11px] font-black text-emerald-200">إجمالي الرصيد الحالي لهذا العميل:</p><p className="mt-1 text-[8px] font-bold text-emerald-200/70">هذا المبلغ يتغير عند حفظ الرصيد الجديد أو إضافة رصيد مستقل.</p></div><span dir="ltr" className="font-mono text-sm font-black text-emerald-300">$ {formatAmount(Number(wallet.balance || 0))}</span></div></section><section className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black text-slate-200">مكافأة الفاتورة ({order?.orderId || order?.id || '---'}):</p><span dir="ltr" className="font-mono text-[11px] font-black text-slate-200">$ {Number(displayReward).toLocaleString('en-US', { maximumFractionDigits: currencyCode === 'SAR' ? 2 : 0 })}</span></div><p className="mt-1.5 text-[8px] font-bold leading-4 text-amber-300">مكافأة الفاتورة لا ترتفع إلى الرصيد الحالي لهذا العميل إلا عند اكتمال الطلب.</p></section><label className="block text-right"><span className="mb-1 block text-[10px] font-black text-slate-200">الرصيد الجديد ($):</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-emerald-300">$</span><input dir="ltr" required inputMode="decimal" value={targetBalance} onChange={event => setTargetBalance(event.target.value.replace(/[^0-9.]/g, ''))} className="h-10 w-full rounded-xl border border-white/10 bg-[#0d111a] py-2 pl-8 pr-3 text-right font-mono text-sm font-black text-white outline-none transition focus:border-emerald-400"/></div></label><section className="rounded-xl border border-blue-400/35 bg-blue-500/10 p-3"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-200"><span className="text-base leading-none">+</span> إضافة رصيد جديد غير المكافأة</span><span className="text-[8px] font-bold text-blue-200/80">إضافة مباشرة</span></div><div className="relative mt-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-blue-300">$</span><input dir="ltr" inputMode="decimal" value={additionalCredit} onChange={event => setAdditionalCredit(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="أدخل مبلغاً إضافياً (مثلاً: 50)" className="h-10 w-full rounded-xl border border-blue-300/20 bg-[#0d111a] py-2 pl-8 pr-3 text-right font-mono text-[11px] font-black text-white outline-none placeholder:font-['Cairo'] placeholder:text-right placeholder:text-[9px] placeholder:font-bold placeholder:text-slate-500 focus:border-blue-400"/></div><p className="mt-2 text-[8px] font-bold leading-4 text-slate-400">عند الحفظ، يضاف هذا المبلغ إلى الرصيد الإجمالي لهذا العميل دون ربطه بمكافأة الفاتورة.</p></section></div><footer className="flex items-center gap-5 border-t border-white/10 px-5 py-3"><button disabled={saving} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60">{saving ? 'جاري الحفظ...' : 'حفظ الرصيد'}</button><button type="button" onClick={onClose} className="text-xs font-black text-slate-400 transition hover:text-white">إلغاء</button></footer></form></div>;
};
const Metric = ({ tone, icon, label, value, openDigits = false }) => {
    const accent = tone === 'emerald' ? { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300', value: 'text-emerald-600 dark:text-emerald-300' } : tone === 'blue' ? { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300', value: 'text-amber-600 dark:text-amber-300' } : { icon: 'bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300', value: 'text-slate-800 dark:text-white' };
    return <article className="min-h-[92px] rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#101722]"><div dir="ltr" className="grid h-full grid-cols-[auto_1fr] items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent.icon}`}>{icon}</div><div dir="rtl" className="min-w-0 self-stretch text-right"><p className="text-[10px] font-bold leading-5 text-slate-500 dark:text-slate-200">{label}</p><p className={`mt-1 whitespace-nowrap ${openDigits ? 'font-sans tabular-nums not-italic' : 'font-mono'} text-lg font-black leading-5 ${accent.value}`}>{value}</p></div></div></article>;
};
const Filter = ({ active, tone, onClick, children }) => <button onClick={onClick} className={`rounded-xl border px-3 py-2 text-[10px] font-black transition ${tone === 'blue' ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/15 dark:text-blue-200' : tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-200' : tone === 'maroon' ? 'border-red-300/60 bg-red-500/10 text-white italic dark:border-red-300/40 dark:bg-red-400/15 dark:text-white' : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-200'} ${active ? 'ring-2 ring-red-400/30 dark:ring-red-200/30' : 'opacity-80 hover:opacity-100'}`}>{children}</button>;

const InvoiceMeta = ({ label, value, ltr = false, tone = '' }) => <div className="min-h-[62px] px-3 py-2 text-right"><p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{label}</p><div dir={ltr ? 'ltr' : undefined} className={`mt-1 truncate text-[11px] font-black ${tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'}`}>{value ?? '---'}</div></div>;

const InvoiceCard = ({ order, wallet, position, isLatest, rewarding, deleting, defaultReward, formatAmount, currencyLabel, onReward, onEdit, onDelete, onPrint, onChangeStatus, onManageWallet }) => {
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const key = statusKey(order.status);
    const complete = key === 'completed';
    const items = order.cartItems || [];
    // Completed invoices without a recorded cycle immediately show the live configured reward.
    const reward = Number(order.walletRewardAmount ?? defaultReward ?? 0);
    const stageIndex = { new: 0, processing: 1, shipping: 2, completed: 3, returned: 0 }[key] ?? 0;
    const stages = [{ label: 'قيد المراجعة', Icon: Clock3, tone: 'orange' }, { label: 'قيد التجهيز', Icon: Package, tone: 'violet' }, { label: 'قيد التوصيل', Icon: Truck, tone: 'blue' }, { label: 'مكتمل', Icon: complete ? Check : MapPin, tone: 'emerald' }];
    const choices = [['new', 'طلب جديد'], ['processing', 'قيد التجهيز'], ['shipping', 'قيد التوصيل'], ['completed', 'مكتمل'], ['returned', 'مسترجع']];
    const statusPillClass = value => ({
        new: 'border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-400/35 dark:bg-orange-400/15 dark:text-orange-200',
        processing: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-400/35 dark:bg-violet-400/15 dark:text-violet-200',
        shipping: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/35 dark:bg-blue-400/15 dark:text-blue-200',
        completed: 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-200',
        returned: 'border-red-500/60 bg-red-600/55 text-white dark:border-red-400/45 dark:bg-red-500/35 dark:text-white'
    }[value] || 'border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-400/35 dark:bg-orange-400/15 dark:text-orange-200');
    const destination = order.formData?.deliveryType === 'office'
        ? 'استلام من المكتب'
        : [order.formData?.city || order.formData?.region, order.formData?.district].filter(Boolean).join(' - ') || 'توصيل للمنزل';
    const deliveryCost = Number(order.deliveryCost || 0);
    const currentWalletBalance = Number(wallet?.balance || 0);
    const invoiceBalance = Math.max(0, Number(order.remainingAmount ?? order.remaining ?? 0));
    const itemImage = item => item.image || item.imageUrl || item.images?.[0] || '/nav-logo.png';
    const itemSize = item => item.selectedSize || item.size || item.variant || '---';

    return <article className="overflow-visible rounded-[18px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#10131d]">
        <div className="relative z-20 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-t-[18px] border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-200">{position}</span><span dir="ltr" className="font-mono text-[11px] font-black text-blue-600 dark:text-blue-300">{order.orderId || order.id}</span><span className="text-[9px] font-bold text-slate-400">{orderDate(order.createdAt || order.date)}</span>{isLatest && <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700 dark:border-blue-400/35 dark:bg-blue-400/15 dark:text-blue-200">أحدث فاتورة</span>}</div>
            <div className="flex flex-wrap items-center gap-1.5"><div className="relative z-[80]"><button onClick={() => setStatusMenuOpen(value => !value)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${statusPillClass(key)}`}><ChevronDown size={13}/>{statusText(key)}</button>{statusMenuOpen && <div className="absolute left-0 top-full z-[90] mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-right shadow-xl dark:border-slate-700 dark:bg-[#252a35]">{choices.map(([value, label]) => <button key={value} onClick={() => { setStatusMenuOpen(false); onChangeStatus(value); }} className={`block w-full rounded-md border px-3 py-2 text-right text-[10px] font-black transition ${statusPillClass(value)} ${value === key ? 'ring-2 ring-slate-400/40 dark:ring-white/30' : 'opacity-90 hover:opacity-100'}`}>{label}</button>)}</div>}</div><button onClick={onPrint} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-200"><Printer size={12}/> طباعة</button><button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-black text-blue-700 dark:border-blue-400/35 dark:bg-blue-400/15 dark:text-blue-200"><Pencil size={12}/> تعديل</button><button type="button" disabled={deleting} onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60 dark:border-rose-400/35 dark:bg-rose-400/15 dark:text-rose-200 dark:hover:bg-rose-400/25"><Trash2 size={12}/>{deleting ? 'جاري الحذف...' : 'حذف'}</button></div>
        </div>

        <div className="mx-3 mt-3">
            <div dir="rtl" className="grid grid-cols-2 md:grid-cols-6">
                <InvoiceMeta label="اسم العميل" value={customerName(order)}/>
                <InvoiceMeta label="الهاتف" value={customerPhone(order)} ltr/>
                <InvoiceMeta label="كلمة المرور:" tone="amber" value={<span dir="ltr" className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/60 dark:text-amber-300"><span>{wallet?.pinConfigured ? 'محمي' : '---'}</span><KeyRound size={11}/></span>}/>
                <InvoiceMeta label="تكلفة التوصيل" tone="amber" value={<span dir="ltr" className="inline-flex items-center gap-1"><span>{formatAmount(deliveryCost)}</span><span className="rounded bg-amber-500/15 px-1 font-sans text-[9px]">$</span></span>}/>
                <InvoiceMeta label="المدينة / التوصيل" value={destination}/>
                <InvoiceMeta label="إجمالي الفاتورة" tone="emerald" value={<span dir="rtl" className="inline-flex items-baseline gap-1"><span dir="ltr">{formatAmount(order.total)}</span><span className="font-sans text-[9px]">{currencyLabel}</span></span>}/>
            </div>
        </div>

        <div dir="rtl" className="mx-3 mt-2 flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-[#081d25] px-3 py-2 text-right shadow-inner shadow-black/25">
            <div className="flex min-w-0 items-center gap-2 text-[10px] font-black text-white"><div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-1 text-emerald-300"><Wallet size={13} strokeWidth={2.4}/></div><span className="whitespace-nowrap">إجمالي الرصيد الحالي لهذا العميل: <span className="text-[9px] text-emerald-200">{currencyLabel}</span></span><span dir="ltr" className="whitespace-nowrap font-mono text-emerald-400">$ {formatAmount(currentWalletBalance)}</span><span className="whitespace-nowrap text-[10px] font-bold text-slate-300">(هاتف: {customerPhone(order)})</span></div>
            <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[8px] font-black ${complete ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/40 bg-amber-400/10 text-amber-300'}`}><CheckCircle2 size={10}/>{complete ? <>تم إيداع مكافأة <span dir="ltr">(${formatAmount(reward)})</span> واختبار رصيد الفاتورة <span dir="ltr">(${formatAmount(invoiceBalance)})</span></> : <>مكافأة الفاتورة <span dir="ltr">(${formatAmount(reward)})</span> لا ترتفع إلا عند اكتمال الطلب</>}</span><button onClick={onManageWallet} className="rounded-lg border border-emerald-400/45 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black text-emerald-300 transition hover:bg-emerald-400/20">تعديل الرصيد</button></div>
        </div>

        <div className="mx-3 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200 dark:border-slate-800 dark:bg-[#111522] dark:divide-slate-800">
            {items.length > 0 ? items.map((item, index) => <div key={`${item.id || item.title}-${index}`} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2"><div className="flex min-w-0 flex-1 items-center gap-2 text-right"><img src={itemImage(item)} onError={event => { event.currentTarget.src = '/nav-logo.png'; }} alt="" className="h-8 w-8 shrink-0 rounded-md border border-slate-200 object-cover bg-white dark:border-slate-700 dark:bg-slate-800"/><div className="min-w-0"><p className="truncate text-[11px] font-black text-slate-800 dark:text-slate-100">{item.title || item.name || 'منتج المتجر'}</p><p className="mt-0.5 text-[8px] font-bold text-slate-500 dark:text-slate-400">المقاس: {itemSize(item)} <span className="mx-1 text-slate-400 dark:text-slate-600">|</span> الكمية: {Number(item.quantity || 1)}</p></div></div><span dir="rtl" className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap font-mono text-[10px] font-black text-slate-800 dark:text-slate-100"><span dir="ltr">{formatAmount(Number(item.price || 0) * Number(item.quantity || 1))}</span><span className="font-sans text-[9px] text-slate-500 dark:text-slate-300">{currencyLabel}</span></span></div>) : <div className="py-5 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">لا توجد منتجات مسجلة لهذه الفاتورة.</div>}
        </div>

        <div className="relative mx-5 my-4 flex items-start justify-between">{[0, 1, 2].map(segment => <div key={`track-${segment}`} className={`pointer-events-none absolute top-3 h-[2px] rounded-full ${segment < stageIndex ? (stageIndex === 3 ? 'bg-emerald-500' : 'bg-gradient-to-l from-orange-400 via-violet-400 to-emerald-400') : 'bg-slate-200 dark:bg-white/10'}`} style={{ right: `calc(${12.5 + segment * 25}% + 12px)`, width: 'calc(25% - 24px)' }}/>) }{stages.map((stage, index) => <div key={stage.label} className="relative z-10 flex w-1/4 flex-col items-center gap-1"><div className={`flex h-6 w-6 items-center justify-center rounded-full border ${stage.tone === 'violet' ? 'border-violet-300 bg-white text-violet-600 dark:border-violet-300 dark:bg-white dark:text-violet-600' : stage.tone === 'emerald' && index > stageIndex ? 'border-emerald-200 bg-white text-emerald-500 dark:border-emerald-400/45 dark:bg-white dark:text-emerald-600' : index <= stageIndex ? (stage.tone === 'orange' ? 'border-orange-300 bg-orange-100 text-orange-600' : stage.tone === 'blue' ? 'border-blue-300 bg-blue-100 text-blue-600' : 'border-emerald-300 bg-emerald-100 text-emerald-600') : 'border-slate-200 bg-white text-slate-300 dark:border-white/10 dark:bg-[#10131d]'}`}><stage.Icon size={12} className={stage.tone === 'blue' ? '-scale-x-100' : undefined}/></div><span className="text-[8px] font-black text-slate-500 dark:text-slate-300">{stage.label}</span></div>)}</div>
    </article>;
};

const InvoiceEditModal = ({ order, wallet, defaultReward, currencyCode, currencyLabel, formatAmount, onClose, onSave }) => {
    const [draft, setDraft] = useState({
        ...order,
        formData: { ...order.formData },
        total: String(currencyCode === 'SAR' ? Number(order.total || 0) / WALLET_SAR_EXCHANGE_RATE : Number(order.total || 0)),
        walletRewardOverride: String(currencyCode === 'SAR' ? Number(order.walletRewardOverride ?? defaultReward ?? 0) / WALLET_SAR_EXCHANGE_RATE : Number(order.walletRewardOverride ?? defaultReward ?? 0)),
        walletBalance: String(currencyCode === 'SAR' ? Number(wallet?.balance || 0) / WALLET_SAR_EXCHANGE_RATE : Number(wallet?.balance || 0)),
        walletPassword: '',
        adminNote: order.adminNote || ''
    });
    const changeField = (field, value) => setDraft(previous => ({ ...previous, formData: { ...previous.formData, [field]: value } }));
    return <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm"><div dir="rtl" className="flex max-h-[calc(100vh-24px)] w-full max-w-[650px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl dark:bg-[#1a1d23]"><header dir="ltr" className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10"><button onClick={onClose} className="text-slate-300 transition hover:text-rose-500"><X size={20}/></button><div dir="rtl" className="flex items-center gap-1 text-right"><Pencil size={15} className="text-blue-600"/><h2 className="text-sm font-black">تعديل الفاتورة رقم <span dir="ltr">({order.orderId || order.id})</span></h2></div></header><div className="overflow-y-auto px-5 py-4"><div className="space-y-3"><Field label="اسم العميل" required><input value={draft.formData?.name || ''} onChange={event => changeField('name', event.target.value)} placeholder="اسم العميل" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs font-bold outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-white/5" required/></Field><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="رقم الهاتف" required><input dir="ltr" value={draft.formData?.fullPhone || draft.formData?.phone || ''} onChange={event => changeField('fullPhone', event.target.value)} placeholder="رقم الهاتف" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs font-bold outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-white/5 text-right" required/></Field><Field label="المدينة"><input value={draft.formData?.city || ''} onChange={event => changeField('city', event.target.value)} placeholder="المدينة" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs font-bold outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-white/5"/></Field></div><Field label="كلمة المرور"><div className="relative w-full max-w-[300px]"><KeyRound size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500"/><input dir="ltr" type="password" inputMode="numeric" value={draft.walletPassword} onChange={event => setDraft(previous => ({ ...previous, walletPassword: event.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))} placeholder={wallet?.pinConfigured ? 'اتركه فارغًا لإبقاء كلمة المرور الحالية' : 'أنشئ كلمة مرور من 4 إلى 6 أرقام'} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-center font-mono text-[11px] font-bold outline-none transition placeholder:font-['Cairo'] placeholder:text-right placeholder:text-[9px] placeholder:font-bold focus:border-blue-500 dark:border-white/10 dark:bg-white/5"/></div><p className="mt-1 max-w-[300px] text-[8px] font-bold leading-4 text-slate-400">يُحفظ الرقم بأمان ولا يُعرض بعد الحفظ. إدخال قيمة جديدة يستبدل كلمة المرور الحالية للعميل.</p></Field><Field label="العنوان التفصيلي"><input value={draft.formData?.address || ''} onChange={event => changeField('address', event.target.value)} placeholder="العنوان التفصيلي" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs font-bold outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-white/5"/></Field><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label={`إجمالي المبلغ (${currencyLabel})`}><input dir="ltr" inputMode="decimal" value={draft.total} onChange={event => setDraft(previous => ({ ...previous, total: event.target.value.replace(/[^0-9.]/g, '') }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs font-bold outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-white/5 text-center font-mono"/></Field><Field label="حالة الفاتورة"><select value={draft.status || 'new'} onChange={event => setDraft(previous => ({ ...previous, status: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs font-bold outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-white/5 cursor-pointer"><option value="new">طلب جديد</option><option value="processing">قيد التجهيز</option><option value="shipping">قيد التوصيل</option><option value="completed">مكتمل</option><option value="returned">مسترجع</option></select></Field></div><section className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-400/30 dark:bg-emerald-400/10"><div className="grid min-h-[58px] grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="text-right"><p className="text-[10px] font-black text-emerald-700 dark:text-emerald-200">إجمالي الرصيد الحالي لهذا العميل:</p><p className="mt-1 text-[8px] font-bold text-emerald-700/75 dark:text-emerald-200/75">الرصيد المتاح في محفظة العميل قبل اعتماد الفاتورة</p></div><label dir="ltr" title="تعديل الرصيد الحالي" className="relative w-28 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-center font-mono text-sm font-black text-emerald-600 shadow-sm transition focus-within:border-emerald-500 dark:border-emerald-400/25 dark:bg-white/10 dark:text-emerald-200"><span className="absolute left-3 top-1/2 -translate-y-1/2">$</span><input aria-label="إجمالي الرصيد الحالي لهذا العميل" dir="ltr" inputMode="decimal" value={draft.walletBalance} onChange={event => setDraft(previous => ({ ...previous, walletBalance: event.target.value.replace(/[^0-9.]/g, '') }))} className="w-full bg-transparent pl-4 text-center font-mono text-sm font-black text-emerald-600 outline-none dark:text-emerald-200"/></label><div aria-hidden="true"/></div></section><section className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-400/30 dark:bg-blue-400/10"><label className="flex items-center justify-between gap-3"><span className="text-[10px] font-black text-blue-700 dark:text-blue-200">مبلغ رصيد جديد بعد اكتمال الفاتورة ($ - {currencyLabel})</span><div className="relative w-28"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-blue-600">$</span><input dir="ltr" inputMode="decimal" value={draft.walletRewardOverride} onChange={event => setDraft(previous => ({ ...previous, walletRewardOverride: event.target.value.replace(/[^0-9.]/g, '') }))} className="w-full rounded-lg border border-blue-200 bg-white py-2 pl-7 pr-2 text-center font-mono text-sm font-black text-blue-600 outline-none focus:border-blue-500 dark:border-blue-400/30 dark:bg-white/10 dark:text-blue-200"/></div></label><p className="mt-2 text-[8px] font-bold leading-4 text-amber-700 dark:text-amber-200">يُضاف هذا الرصيد مرة واحدة فقط عند اختيار حالة «مكتمل» وعدم وجود مكافأة سابقة للفاتورة.</p></section><Field label="ملاحظات الفاتورة"><textarea value={draft.adminNote} onChange={event => setDraft(previous => ({ ...previous, adminNote: event.target.value }))} placeholder="اكتب ملاحظة داخلية إن وجدت" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs font-bold outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-white/5 min-h-20 resize-none py-2"/></Field></div></div><footer className="flex shrink-0 items-center gap-4 border-t border-slate-100 px-5 py-3 dark:border-white/10"><button onClick={() => onSave(draft)} className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-600/20"><Save size={15}/> حفظ التعديلات</button><button onClick={onClose} className="text-xs font-black text-slate-500">إلغاء</button></footer></div></div>;
};
const Field = ({ label, required, children }) => <label className="block text-right"><span className="mb-1 block text-[10px] font-black text-slate-600 dark:text-slate-200">{label}{required && <span className="mr-1 text-rose-500">*</span>}</span>{children}</label>;
const InvoicePreview = ({ order, formatAmount, currencyLabel, onClose }) => <div className="fixed inset-0 z-[180] overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm"><div className="mx-auto my-5 w-full max-w-2xl rounded-2xl bg-white p-6 text-slate-800 shadow-2xl"><div className="flex justify-between"><button onClick={onClose} className="text-slate-400"><X size={20}/></button><div className="text-right"><h2 className="text-lg font-black">فاتورة متجر ميلانو</h2><p dir="ltr" className="font-mono text-xs text-blue-600">{order.orderId || order.id}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm"><p>العميل: <b>{customerName(order)}</b></p><p dir="ltr">{customerPhone(order)}</p><p>الحالة: <b>{statusText(statusKey(order.status))}</b></p><p>التاريخ: {orderDate(order.createdAt || order.date)}</p></div><div className="mt-4 divide-y border-y">{(order.cartItems || []).map((item, index) => <div key={`${item.id}-${index}`} className="flex justify-between py-3 text-sm"><span>{formatAmount(Number(item.price || 0) * Number(item.quantity || 1))} {currencyLabel}</span><span>{item.title} × {item.quantity || 1}</span></div>)}</div><div className="mt-4 flex justify-between text-lg font-black text-emerald-600"><span>{formatAmount(order.total)} {currencyLabel}</span><span>إجمالي الطلب</span></div><button onClick={() => window.print()} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white">طباعة الفاتورة</button></div></div>;

export default WalletView;
