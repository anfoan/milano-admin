import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
    Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
    BarChart3, CalendarDays, ChevronLeft, CircleDollarSign, Download, FileText, Package, Printer,
    RefreshCw, Search, ShoppingCart, TrendingDown, TrendingUp, Wallet, X
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { getLocalizedCurrency } from '../../lib/currencyUtils';

const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value?.seconds) return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
};

const isoDay = (value) => {
    const date = toDate(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dayAtNoon = (value) => value ? new Date(`${value}T12:00:00`) : null;
const escapeHtml = (value) => String(value ?? '').replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#039;' }[char]));

const MetricCard = ({ title, hint, amount, currencyLabel, icon, tone, badge }) => (
    <article dir="rtl" className={`financial-report-card relative h-[124px] w-full overflow-hidden rounded-xl bg-gradient-to-br ${tone} p-4 text-white text-right shadow-[0_10px_24px_rgba(15,23,42,0.12)]`}>
        <div className="financial-report-card-wave" />
        <div className="financial-report-card-icon absolute left-1 top-1 z-10 flex h-[52px] w-[52px] items-center justify-center text-white">{icon}</div>
        <div className="absolute bottom-4 left-16 right-2 top-4 z-10 flex flex-col items-start text-right">
            <p className="w-full whitespace-nowrap text-right text-[14px] font-black leading-none text-white">{title}</p>
            <p className="mt-1 w-full whitespace-nowrap text-right text-[9px] font-bold text-white/75">{hint}</p>
            <div className="mt-auto self-start flex items-baseline gap-1.5" dir="rtl">
                <strong dir="ltr" className="font-['Cairo'] text-[23px] font-black leading-none tracking-tight text-white">{amount}</strong>
                <span className="text-[10px] font-black text-white/90">{currencyLabel}</span>
            </div>
        </div>
        <span className="absolute bottom-3 left-3 z-10 rounded-md border border-white/25 bg-white/15 px-2 py-1 text-[8px] font-black text-white shadow-sm backdrop-blur-sm">{badge}</span>
    </article>
);

const FinancialReportsView = ({ lang = 'ar', generalSettings = {} }) => {
    const isRTL = lang === 'ar';
    const currency = generalSettings?.currency || 'YER';
    const currencyLabel = getLocalizedCurrency(currency, lang);
    const [orders, setOrders] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [bonds, setBonds] = useState([]);
    const [products, setProducts] = useState([]);
    const [period, setPeriod] = useState('week');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [reportOpen, setReportOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const t = isRTL ? {
        title: 'إدارة التقارير المالية',
        subtitle: 'نظرة مالية شاملة لمبيعات المتجر، المشتريات، المصروفات وصافي الربح',
        reportButton: 'التقرير المالي',
        period: 'الفترة النشطة:',
        week: 'أسبوع', month: 'شهر 1', quarter: '3 شهور', half: '6 شهور', year: 'سنة', custom: 'فترة مخصصة',
        weekDetail: 'أسبوع (آخر 7 أيام)', monthDetail: 'شهر (آخر 30 يوم)', quarterDetail: '3 شهور', halfDetail: '6 شهور', yearDetail: 'سنة حالية', customDetail: 'فترة مخصصة',
        currentStock: 'الرصيد الحالي للمخزون', purchases: 'إجمالي المشتريات', expenses: 'إجمالي المصروفات', sales: 'إجمالي المبيعات', revenue: 'إجمالي الإيرادات', profit: 'صافي الربح',
        stockHint: 'إجمالي قيمة بضاعة المستودع والمحل', purchasesHint: 'فواتير شراء الأصناف الموردة', expensesHint: 'فواتير الخدمات والمصاريف التشغيلية', salesHint: 'إجمالي مبيعات نقطة البيع والطلبات', revenueHint: 'المبالغ المقبوضة وسندات القبض المودعة', profitHint: 'المبيعات ناقص تكلفة البضاعة والمصروفات',
        stockBadge: 'مخزون متاح', purchasesBadge: 'عدد الفواتير', expensesBadge: 'مصروفات تشغيل', salesBadge: 'عدد العمليات', revenueBadge: 'التدفق النقدي المحصل', profitBadge: 'هامش ربح',
        chartTitle: 'الأرباح والمبيعات', chartPeriod: 'رسم بياني تفاعلي يوضح مقارنة المبيعات والمشتريات والمصروفات وصافي الربح',
        search: 'ابحث في العمليات المالية...', all: 'الكل', transactionCount: 'عملية معروضة', paymentMethod: 'طريقة الدفع', cash: 'نقدي / كاش', wallet: 'تحويل / محفظة', transfer: 'تحويل بنكي',
        salesType: 'المبيعات', purchaseType: 'المشتريات', expenseType: 'المصروفات', receiptType: 'سندات القبض', paymentType: 'سندات الصرف',
        date: 'التاريخ', type: 'نوع المعاملة', description: 'البيان / الوصف', entity: 'الطرف / العميل / المورد', amount: 'المبلغ', status: 'الحالة',
        noTransactions: 'لا توجد عمليات مالية مطابقة للفلاتر المحددة',
        reportPreview: 'معاينة التقرير المالي الرسمي (PDF)', reportPreviewHint: 'جاهز للطباعة أو الحفظ كملف PDF', officialReport: 'تقرير مالي رسمي',
        reportDate: 'تاريخ الإصدار', fiscalPeriod: 'فترة التقرير المالي', first: 'أولاً: ملخص المؤشرات المالية الستة الرئيسية', second: 'ثانياً: جدول الميزانية والتدفقات النقدية للفترة', third: 'ثالثاً: كشف العمليات المالية المنجزة (عينة مسجلة)',
        financialItem: 'البند المالي', category: 'النوع', notes: 'ملاحظات', print: 'طباعة التقرير', close: 'إغلاق', ready: 'التقرير جاهز للطباعة أو الحفظ بصيغة PDF',
        totalGoodsSales: 'إجمالي مبيعات البضائع', approvedPurchases: 'فواتير المشتريات المعتمدة', operatingExpenses: 'المصروفات التشغيلية والسندات', netProfit: 'صافي الربح المحقق',
        income: 'إيراد', inventoryPurchases: 'مشتريات مخزون', expense: 'مصروفات', result: 'النتيجة المالية',
        completed: 'مكتمل', pending: 'طلب جديد', paid: 'مدفوع', deferred: 'آجل', documented: 'موثق',
        accountant: 'إعداد المحاسب المالي', manager: 'اعتماد المدير العام', stamp: 'ختم المنشأة الرسمي', reportNumber: 'FIN-941003'
    } : {
        title: 'Financial Reports Management', subtitle: 'A complete view of store sales, purchases, expenses, and net profit', reportButton: 'Financial report',
        period: 'Active period:', week: 'Week', month: '1 Month', quarter: '3 Months', half: '6 Months', year: 'Year', custom: 'Custom range',
        weekDetail: 'Week (last 7 days)', monthDetail: 'Month (last 30 days)', quarterDetail: '3 months', halfDetail: '6 months', yearDetail: 'Current year', customDetail: 'Custom range',
        currentStock: 'Current inventory balance', purchases: 'Total purchases', expenses: 'Total expenses', sales: 'Total sales', revenue: 'Total revenue', profit: 'Net profit',
        stockHint: 'Current value of products in stock', purchasesHint: 'Stock purchase invoices in period', expensesHint: 'Operating expenses and vouchers', salesHint: 'Recorded sales invoices', revenueHint: 'Received payments and other revenue', profitHint: 'Sales and expenses',
        stockBadge: 'Live inventory', purchasesBadge: 'Invoices', expensesBadge: 'Operating expenses', salesBadge: 'Transactions', revenueBadge: 'Cash receipts', profitBadge: 'Approx. margin',
        chartTitle: 'Profit and sales', chartPeriod: 'Interactive comparison of sales, purchases, expenses, and net profit', search: 'Search financial transactions...', all: 'All', transactionCount: 'transactions shown', paymentMethod: 'Payment method', cash: 'Cash', wallet: 'Wallet / card', transfer: 'Bank transfer',
        salesType: 'Sales', purchaseType: 'Purchases', expenseType: 'Expenses', receiptType: 'Receipt bonds', paymentType: 'Payment bonds',
        date: 'Date', type: 'Transaction type', description: 'Description', entity: 'Party / customer / supplier', amount: 'Amount', status: 'Status', noTransactions: 'No financial operations match these filters',
        reportPreview: 'Official Financial Report Preview (PDF)', reportPreviewHint: 'Ready to print or save as a PDF file', officialReport: 'Official Financial Report', reportDate: 'Issue date', fiscalPeriod: 'Financial reporting period', first: 'First: Summary of six primary financial indicators', second: 'Second: Budget and cash-flow statement for the period', third: 'Third: Recorded financial transactions',
        financialItem: 'Financial item', category: 'Type', notes: 'Notes', print: 'Print report', close: 'Close', ready: 'The report is ready to print or save as PDF',
        totalGoodsSales: 'Total goods sales', approvedPurchases: 'Approved purchase invoices', operatingExpenses: 'Operating expenses and vouchers', netProfit: 'Net profit achieved', income: 'Income', inventoryPurchases: 'Inventory purchases', expense: 'Expenses', result: 'Financial result',
        completed: 'Completed', pending: 'New', paid: 'Paid', deferred: 'Deferred', documented: 'Documented', accountant: 'Financial accountant', manager: 'General manager approval', stamp: 'Official company stamp', reportNumber: 'FIN-941003'
    };

    useEffect(() => {
        const listeners = [
            onSnapshot(collection(db, 'orders'), snap => setOrders(snap.docs.map(item => ({ id: item.id, ...item.data() }))), error => console.error('Financial orders listener:', error)),
            onSnapshot(collection(db, 'purchases'), snap => setPurchases(snap.docs.map(item => ({ id: item.id, ...item.data() }))), error => console.error('Financial purchases listener:', error)),
            onSnapshot(collection(db, 'expenses'), snap => setExpenses(snap.docs.map(item => ({ id: item.id, ...item.data() }))), error => console.error('Financial expenses listener:', error)),
            onSnapshot(collection(db, 'bonds'), snap => setBonds(snap.docs.map(item => ({ id: item.id, ...item.data() }))), error => console.error('Financial bonds listener:', error)),
            onSnapshot(collection(db, 'products'), snap => setProducts(snap.docs.map(item => ({ id: item.id, ...item.data() }))), error => console.error('Financial products listener:', error))
        ];
        return () => listeners.forEach(unsubscribe => unsubscribe());
    }, []);

    useEffect(() => {
        if (period === 'custom') return;
        const today = new Date();
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const start = new Date(end);
        if (period === 'week') start.setDate(end.getDate() - 6);
        if (period === 'month') start.setDate(end.getDate() - 29);
        if (period === 'quarter') start.setMonth(end.getMonth() - 2, 1);
        if (period === 'half') start.setMonth(end.getMonth() - 5, 1);
        if (period === 'year') start.setMonth(0, 1);
        setStartDate(isoDay(start));
        setEndDate(isoDay(end));
    }, [period]);

    const money = (value) => `${Number(value || 0).toLocaleString('en-US')} ${currencyLabel}`;
    const number = (value) => Number(value || 0).toLocaleString('en-US');
    const formatDate = (value) => {
        const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? dayAtNoon(value) : toDate(value);
        return date ? new Intl.DateTimeFormat(isRTL ? 'ar-YE' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '---';
    };
    const isInRange = (value) => {
        const key = isoDay(value);
        return Boolean(key) && (!startDate || key >= startDate) && (!endDate || key <= endDate);
    };
    const isCancelled = (status) => ['cancelled', 'canceled', 'ملغي', 'ملغى'].includes(String(status || '').toLowerCase());
    const orderTotal = (order) => order?.total !== undefined && order?.total !== null
        ? Number(order.total || 0)
        : Math.max(0, Number(order?.subTotal || order?.price || 0) - Number(order?.discount || 0) + Number(order?.deliveryCost || 0));
    const orderDate = (order) => order.completedAt || order.updatedAt || order.createdAt || order.date;
    const purchaseDate = (purchase) => purchase.date || purchase.updatedAt || purchase.createdAt;
    const expenseDate = (expense) => expense.date || expense.updatedAt || expense.createdAt;
    const bondDate = (bond) => bond.date || bond.updatedAt || bond.createdAt;
    const paymentKey = (value) => value === 'cash' || value === 'manual' || !value ? 'cash' : (value === 'card' || value === 'wallet' ? 'wallet' : (value === 'transfer' || value === 'bank' ? 'transfer' : String(value)));
    const paymentText = (value) => ({ cash: t.cash, wallet: t.wallet, transfer: t.transfer }[paymentKey(value)] || String(value || t.cash));
    const paymentClass = (value) => ({ cash: 'bg-emerald-50 text-emerald-700 ring-emerald-200', wallet: 'bg-violet-50 text-violet-700 ring-violet-200', transfer: 'bg-cyan-50 text-cyan-700 ring-cyan-200' }[paymentKey(value)] || 'bg-gray-50 text-gray-600 ring-gray-200');
    const typeText = (type) => ({ sales: t.salesType, purchase: t.purchaseType, expense: t.expenseType, receipt: t.receiptType, payment: t.paymentType }[type] || type);
    const typeClass = (type) => ({ sales: 'bg-emerald-50 text-emerald-700 ring-emerald-200', purchase: 'bg-orange-50 text-orange-700 ring-orange-200', expense: 'bg-rose-50 text-rose-700 ring-rose-200', receipt: 'bg-violet-50 text-violet-700 ring-violet-200', payment: 'bg-amber-50 text-amber-700 ring-amber-200' }[type] || 'bg-gray-50 text-gray-600 ring-gray-200');
    const categoryClass = (type) => ({
        all: 'border-slate-300 bg-transparent text-slate-700', sales: 'border-emerald-300 bg-transparent text-emerald-700', purchase: 'border-orange-300 bg-transparent text-orange-700',
        expense: 'border-rose-300 bg-transparent text-rose-700', receipt: 'border-violet-300 bg-transparent text-violet-700', payment: 'border-slate-300 bg-transparent text-slate-600'
    }[type] || 'border-slate-300 bg-transparent text-slate-700');
    const statusClass = (status) => {
        if (status === t.completed || status === t.paid) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
        if (status === t.pending || status === t.deferred) return 'bg-orange-50 text-orange-700 ring-orange-200';
        return 'bg-cyan-50 text-cyan-700 ring-cyan-200';
    };

    const productCostMap = useMemo(() => Object.fromEntries(products.map(product => [String(product.name || '').trim(), Number(product.costPrice || 0)])), [products]);
    const activeOrders = useMemo(() => orders.filter(order => !isCancelled(order.status) && isInRange(orderDate(order))), [orders, startDate, endDate]);
    const filteredPurchases = useMemo(() => purchases.filter(item => isInRange(purchaseDate(item))), [purchases, startDate, endDate]);
    const filteredExpenses = useMemo(() => expenses.filter(item => isInRange(expenseDate(item))), [expenses, startDate, endDate]);
    const filteredBonds = useMemo(() => bonds.filter(item => isInRange(bondDate(item))), [bonds, startDate, endDate]);

    const statistics = useMemo(() => {
        const sales = activeOrders.reduce((sum, order) => sum + orderTotal(order), 0);
        const purchasesTotal = filteredPurchases.reduce((sum, item) => sum + Number(item.total ?? item.amount ?? 0), 0);
        const expensesTotal = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const revenues = filteredBonds.filter(item => item.type === 'receipt').reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const payments = filteredBonds.filter(item => item.type === 'payment').reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const costOfSold = activeOrders.reduce((sum, order) => {
            const lines = Array.isArray(order.cartItems) ? order.cartItems : (Array.isArray(order.items) ? order.items : []);
            return sum + lines.reduce((lineSum, line) => lineSum + Number(line.quantity || line.qty || 1) * Number(line.costPrice ?? productCostMap[String(line.title || line.name || '').trim()] ?? 0), 0);
        }, 0);
        const stockBalance = products.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.price ?? product.costPrice ?? 0), 0);
        return { sales, purchases: purchasesTotal, expenses: expensesTotal, revenues, payments, costOfSold, stockBalance, profit: sales + revenues - expensesTotal - payments - costOfSold };
    }, [activeOrders, filteredPurchases, filteredExpenses, filteredBonds, products, productCostMap]);

    const allTransactions = useMemo(() => {
        const salesRows = activeOrders.map(order => ({
            id: `sales-${order.id}`, type: 'sales', date: isoDay(orderDate(order)), rawDate: toDate(orderDate(order)), amount: orderTotal(order),
            reference: order.orderId || `ORD-${String(order.id).slice(-6).toUpperCase()}`,
            description: isRTL ? 'فاتورة بيع' : 'Sales invoice', entity: order.formData?.name || order.customer?.name || order.customerName || order.name || '---',
            payment: order.paymentMethod || order.formData?.paymentMethod || 'cash', status: String(order.status || '').toLowerCase().includes('complete') || String(order.status || '').includes('مكتمل') ? t.completed : t.pending
        }));
        const purchaseRows = filteredPurchases.map(purchase => ({
            id: `purchase-${purchase.id}`, type: 'purchase', date: isoDay(purchaseDate(purchase)), rawDate: toDate(purchaseDate(purchase)), amount: Number(purchase.total ?? purchase.amount ?? 0),
            reference: purchase.invoiceNumber || `PUR-${String(purchase.id).slice(-6).toUpperCase()}`, description: purchase.productName || (isRTL ? 'فاتورة شراء مخزون' : 'Inventory purchase invoice'),
            entity: purchase.supplierName || '---', payment: purchase.paymentMethod || 'cash', status: purchase.invoiceStatus === 'paid' ? t.paid : purchase.invoiceStatus === 'deferred' ? t.deferred : t.pending
        }));
        const expenseRows = filteredExpenses.map(expense => ({
            id: `expense-${expense.id}`, type: 'expense', date: isoDay(expenseDate(expense)), rawDate: toDate(expenseDate(expense)), amount: Number(expense.amount || 0),
            reference: `EXP-${String(expense.id).slice(-6).toUpperCase()}`, description: expense.title || expense.category || t.expenseType,
            entity: expense.category || '---', payment: expense.paymentMethod || 'cash', status: t.completed
        }));
        const bondRows = filteredBonds.map(bond => ({
            id: `bond-${bond.id}`, type: bond.type === 'receipt' ? 'receipt' : 'payment', date: isoDay(bondDate(bond)), rawDate: toDate(bondDate(bond)), amount: Number(bond.amount || 0),
            reference: bond.number || `BND-${String(bond.id).slice(-6).toUpperCase()}`, description: bond.notes || (bond.type === 'receipt' ? t.receiptType : t.paymentType),
            entity: bond.entityName || '---', payment: bond.paymentMethod || 'cash', status: t.documented
        }));
        return [...salesRows, ...purchaseRows, ...expenseRows, ...bondRows].filter(row => row.date).sort((a, b) => Number(b.rawDate || 0) - Number(a.rawDate || 0));
    }, [activeOrders, filteredPurchases, filteredExpenses, filteredBonds, isRTL, lang]);

    const visibleTransactions = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return allTransactions.filter(row => {
            const text = [row.reference, row.description, row.entity, typeText(row.type), paymentText(row.payment)].join(' ').toLowerCase();
            return (!needle || text.includes(needle)) && (categoryFilter === 'all' || row.type === categoryFilter) && (paymentFilter === 'all' || paymentKey(row.payment) === paymentFilter);
        });
    }, [allTransactions, search, categoryFilter, paymentFilter, lang]);

    const chartBuckets = useMemo(() => {
        const start = dayAtNoon(startDate) || new Date();
        const end = dayAtNoon(endDate) || new Date();
        const days = Math.max(1, Math.floor((end - start) / 86400000) + 1);
        const bucketCount = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 12 : period === 'half' ? 6 : period === 'year' ? 12 : Math.min(days, 31);
        const bucketSize = period === 'quarter' ? 7 : period === 'half' || period === 'year' ? 31 : 1;
        const buckets = [];
        for (let index = 0; index < bucketCount; index += 1) {
            const bucketStart = new Date(start);
            if (period === 'half' || period === 'year') bucketStart.setMonth(start.getMonth() + index);
            else bucketStart.setDate(start.getDate() + index * bucketSize);
            if (bucketStart > end) break;
            const bucketEnd = new Date(bucketStart);
            if (period === 'half' || period === 'year') bucketEnd.setMonth(bucketStart.getMonth() + 1, 0);
            else bucketEnd.setDate(bucketStart.getDate() + bucketSize - 1);
            if (bucketEnd > end) bucketEnd.setTime(end.getTime());
            buckets.push({
                label: (period === 'half' || period === 'year') ? new Intl.DateTimeFormat(isRTL ? 'ar-YE' : 'en-US', { month: 'short' }).format(bucketStart) : new Intl.DateTimeFormat(isRTL ? 'ar-YE' : 'en-US', { weekday: days <= 7 ? 'short' : undefined, day: 'numeric', month: days > 7 ? 'short' : undefined }).format(bucketStart),
                start: bucketStart, end: bucketEnd
            });
        }
        return buckets;
    }, [period, startDate, endDate, isRTL]);

    const chartData = useMemo(() => chartBuckets.map(bucket => {
        const within = (value) => { const date = toDate(value); return date && date >= bucket.start && date <= new Date(bucket.end.getFullYear(), bucket.end.getMonth(), bucket.end.getDate(), 23, 59, 59); };
        const sales = activeOrders.filter(order => within(orderDate(order))).reduce((sum, order) => sum + orderTotal(order), 0);
        const purchasesTotal = filteredPurchases.filter(item => within(purchaseDate(item))).reduce((sum, item) => sum + Number(item.total ?? item.amount ?? 0), 0);
        const expensesTotal = filteredExpenses.filter(item => within(expenseDate(item))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const revenue = filteredBonds.filter(item => item.type === 'receipt' && within(bondDate(item))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const payments = filteredBonds.filter(item => item.type === 'payment' && within(bondDate(item))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const cost = activeOrders.filter(order => within(orderDate(order))).reduce((sum, order) => {
            const lines = Array.isArray(order.cartItems) ? order.cartItems : (Array.isArray(order.items) ? order.items : []);
            return sum + lines.reduce((lineSum, line) => lineSum + Number(line.quantity || line.qty || 1) * Number(line.costPrice ?? productCostMap[String(line.title || line.name || '').trim()] ?? 0), 0);
        }, 0);
        return { label: bucket.label, sales, purchases: purchasesTotal, expenses: expensesTotal, profit: sales + revenue - expensesTotal - payments - cost };
    }), [chartBuckets, activeOrders, filteredPurchases, filteredExpenses, filteredBonds, productCostMap]);

    const activePeriodDetail = ({ week: t.weekDetail, month: t.monthDetail, quarter: t.quarterDetail, half: t.halfDetail, year: t.yearDetail, custom: t.customDetail }[period] || t.weekDetail);
    const metricCards = [
        { title: t.currentStock, hint: t.stockHint, amount: number(statistics.stockBalance), icon: <Package size={18}/>, tone: 'from-[#2866ea] via-[#2860df] to-[#2855c9]', badge: t.stockBadge, key: 'stock' },
        { title: t.purchases, hint: t.purchasesHint, amount: number(statistics.purchases), icon: <ShoppingCart size={18}/>, tone: 'from-[#ff800e] via-[#fb790d] to-[#ee6f08]', badge: `${t.purchasesBadge}: ${number(filteredPurchases.length)}`, key: 'purchases' },
        { title: t.expenses, hint: t.expensesHint, amount: number(statistics.expenses), icon: <TrendingDown size={20}/>, tone: 'from-[#fa414b] via-[#f33f51] to-[#ee3652]', badge: t.expensesBadge, key: 'expenses' },
        { title: t.sales, hint: t.salesHint, amount: number(statistics.sales), icon: <TrendingUp size={18}/>, tone: 'from-[#16a953] via-[#10a04c] to-[#18a956]', badge: `${t.salesBadge} ${number(activeOrders.length)}`, key: 'sales' },
        { title: t.revenue, hint: t.revenueHint, amount: number(statistics.revenues), icon: <CircleDollarSign size={20}/>, tone: 'from-[#8244ea] via-[#7d39e2] to-[#7431cf]', badge: t.revenueBadge, key: 'revenue' },
        { title: t.profit, hint: t.profitHint, amount: number(statistics.profit), icon: <Wallet size={20}/>, tone: 'from-[#11b9cf] via-[#08b2c5] to-[#059ab4]', badge: `${t.profitBadge} %${statistics.sales ? ((statistics.profit / statistics.sales) * 100).toFixed(1) : '0'}`, key: 'profit' }
    ];
    const summaryRows = [
        { title: t.totalGoodsSales, category: t.income, value: statistics.sales, note: isRTL ? 'مبيعات نقطة البيع والطلبات' : 'Point of sale and order sales', color: 'text-emerald-600' },
        { title: t.approvedPurchases, category: t.inventoryPurchases, value: statistics.purchases, note: isRTL ? 'إضافات المخزون وفواتير الموردين' : 'Inventory additions and supplier invoices', color: 'text-amber-600' },
        { title: t.operatingExpenses, category: t.expense, value: statistics.expenses + statistics.payments, note: isRTL ? 'كهرباء، إيجارات، خدمات وسندات صرف' : 'Utilities, rents, services, and payment bonds', color: 'text-rose-600' },
        { title: t.netProfit, category: t.result, value: statistics.profit, note: `${t.profitBadge}: ${statistics.sales ? `${((statistics.profit / statistics.sales) * 100).toFixed(1)}%` : '0%'}`, color: 'text-cyan-700' }
    ];
    const categoryFilters = [['all', t.all], ['sales', t.salesType], ['purchase', t.purchaseType], ['expense', t.expenseType], ['receipt', t.receiptType], ['payment', t.paymentType]];
    const previewTone = {
        stock: 'border-blue-200 bg-blue-50/40', purchases: 'border-amber-200 bg-amber-50/40', expenses: 'border-rose-200 bg-rose-50/40',
        sales: 'border-emerald-200 bg-emerald-50/40', revenue: 'border-violet-200 bg-violet-50/40', profit: 'border-cyan-200 bg-cyan-50/40'
    };

    const refreshPage = () => {
        setRefreshing(true);
        window.setTimeout(() => setRefreshing(false), 420);
    };

    const printReport = () => {
        const popup = window.open('', '_blank', 'width=1000,height=850');
        if (!popup) { alert(isRTL ? 'يرجى السماح بالنوافذ المنبثقة للطباعة.' : 'Please allow popups to print.'); return; }
        const reportRange = `${formatDate(startDate)} — ${formatDate(endDate)}`;
        const logoPath = generalSettings?.invoiceLogo || '/admin-new-icon.png';
        const logo = logoPath.startsWith('http') ? logoPath : `${window.location.origin}${logoPath}`;
        const cards = metricCards.map(card => `<div class="metric"><span>${escapeHtml(card.title)}</span><b>${escapeHtml(card.amount)} <small>${escapeHtml(currencyLabel)}</small></b></div>`).join('');
        const summary = summaryRows.map(row => `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(money(row.value))}</td><td>${escapeHtml(row.note)}</td></tr>`).join('');
        const movements = visibleTransactions.slice(0, 40).map(row => `<tr><td>${escapeHtml(formatDate(row.date))}</td><td>${escapeHtml(typeText(row.type))}</td><td>${escapeHtml(row.reference)} — ${escapeHtml(row.description)}</td><td>${escapeHtml(row.entity)}</td><td>${escapeHtml(paymentText(row.payment))}</td><td>${escapeHtml(money(row.amount))}</td></tr>`).join('');
        popup.document.write(`<!doctype html><html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(t.officialReport)}</title><style>@page{size:A4 portrait;margin:9mm}*{box-sizing:border-box}body{margin:0;color:#20242b;background:#fff;font-family:Arial,Tahoma,sans-serif;font-size:10px}.sheet{min-height:275mm;border:1px solid #d9dfe7;border-radius:14px;padding:20px}.top{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #252525;padding-bottom:13px}.brand{display:flex;align-items:center;gap:10px}.brand img{height:46px;width:46px;border-radius:8px;object-fit:cover}.brand h1{margin:0;font-size:22px;font-weight:900}.brand p{margin:4px 0 0;color:#6c7380;font-weight:700;font-size:9px}.tag{display:inline-block;border-radius:7px;background:#16191f;color:white;padding:5px 10px;font-size:10px;font-weight:900}.small{margin-top:5px;color:#747b87;font-weight:700;font-size:9px}.period{display:flex;justify-content:space-between;align-items:center;margin-top:14px;border:1px solid #dce2e8;border-radius:9px;background:#fafbfd;padding:10px 13px;font-weight:800}.section{margin:18px 0 9px;font-size:12px;font-weight:900}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.metric{border:1px solid #dbe2eb;border-radius:9px;background:#fcfdff;padding:10px;text-align:center}.metric:nth-child(1){border-color:#b9d2ff}.metric:nth-child(2){border-color:#ffe18b}.metric:nth-child(3){border-color:#ffc8d1}.metric:nth-child(4){border-color:#a8eed0}.metric:nth-child(5){border-color:#d9c8ff}.metric:nth-child(6){border-color:#a3e9ee}.metric span{display:block;color:#5a6474;font-weight:800;font-size:9px}.metric b{display:block;margin-top:5px;font-size:14px}.metric small{font-size:9px}table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #dce2e8;border-radius:8px;font-size:9px}th{padding:8px 6px;background:#f2f4f7;border-bottom:1px solid #dce2e8;font-weight:900}td{padding:7px 6px;border-bottom:1px solid #edf0f3;text-align:center;font-weight:700}tr:last-child td{border-bottom:0}.signatures{display:flex;justify-content:space-between;margin-top:24px;text-align:center;color:#56606f;font-weight:800}.signature{width:29%}.line{margin-top:28px;border-bottom:1px dashed #98a2b3}@media print{.sheet{border:0}}</style></head><body><main class="sheet"><header class="top"><div class="brand"><img src="${logo}"><div><h1>${isRTL ? 'متجر ميلانو' : 'Milano Store'}</h1><p>${isRTL ? 'نظام إدارة التقارير المالية' : 'Financial reports system'}</p></div></div><div><span class="tag">${escapeHtml(t.officialReport)}</span><p class="small">${escapeHtml(t.reportDate)}: ${escapeHtml(formatDate(new Date()))}<br>${escapeHtml(t.reportNumber)}</p></div></header><div class="period"><span>${escapeHtml(t.fiscalPeriod)}: ${escapeHtml(activePeriodDetail)}</span><span>${escapeHtml(reportRange)}</span><span>${escapeHtml(currencyLabel)}</span></div><h2 class="section">${escapeHtml(t.first)}</h2><section class="metrics">${cards}</section><h2 class="section">${escapeHtml(t.second)}</h2><table><thead><tr><th>${escapeHtml(t.financialItem)}</th><th>${escapeHtml(t.category)}</th><th>${escapeHtml(t.amount)}</th><th>${escapeHtml(t.notes)}</th></tr></thead><tbody>${summary}</tbody></table><h2 class="section">${escapeHtml(t.third)}</h2><table><thead><tr><th>${escapeHtml(t.date)}</th><th>${escapeHtml(t.type)}</th><th>${escapeHtml(t.description)}</th><th>${escapeHtml(t.entity)}</th><th>${escapeHtml(t.paymentMethod)}</th><th>${escapeHtml(t.amount)}</th></tr></thead><tbody>${movements || `<tr><td colspan="6">${escapeHtml(t.noTransactions)}</td></tr>`}</tbody></table><footer class="signatures"><div class="signature">${escapeHtml(t.accountant)}<div class="line"></div></div><div class="signature">${escapeHtml(t.manager)}<div class="line"></div></div><div class="signature">${escapeHtml(t.stamp)}<div class="line"></div></div></footer></main><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);
        popup.document.close();
    };

    return <div className="financial-report-page space-y-4 pb-8" dir={isRTL ? 'rtl' : 'ltr'}>
        <header className="flex flex-col gap-4 px-1 py-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100"><BarChart3 size={20}/></div>
                <div><h1 className="text-[23px] font-black tracking-tight text-slate-900 dark:text-white">{t.title}</h1><p className="mt-0.5 text-[10px] font-bold text-slate-400">{t.subtitle}</p></div>
                <span dir="ltr" className="mr-1 hidden rounded-md bg-slate-100 px-2 py-1 font-mono text-[9px] font-black text-slate-500 sm:inline-block dark:bg-white/5 dark:text-slate-400">{t.reportNumber}</span>
            </div>
            <div className="flex items-center gap-2"><button onClick={() => setReportOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-600 px-4 text-[11px] font-black text-white shadow-md shadow-red-500/20 transition-colors hover:bg-red-700"><Printer size={14}/>{t.reportButton}</button><button onClick={refreshPage} title={isRTL ? 'تحديث البيانات' : 'Refresh data'} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''}/></button></div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-[#1d1d20]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">{[['week', t.week], ['month', t.month], ['quarter', t.quarter], ['half', t.half], ['year', t.year]].map(([key, label]) => <button key={key} onClick={() => setPeriod(key)} className={`h-8 rounded-lg px-3.5 text-[10px] font-black transition-all ${period === key ? 'bg-[#2563eb] text-white shadow-sm shadow-blue-500/30' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'}`}>{label}</button>)}<select value={period === 'custom' ? 'custom' : ''} onChange={event => setPeriod(event.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"><option value="" disabled>{t.custom}</option><option value="custom">{t.custom}</option></select></div>
                <div className="flex flex-wrap items-center gap-2 px-2 text-[10px] font-black text-slate-500"><span>{t.period}</span><span className="text-blue-600">{activePeriodDetail}</span>{period === 'custom' && <><label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-white/5"><CalendarDays size={13}/><input lang="en" dir="ltr" type="date" value={startDate} onChange={event => { setPeriod('custom'); setStartDate(event.target.value); }} className="w-[105px] bg-transparent text-center font-mono text-[10px] outline-none"/></label><label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-white/5"><input lang="en" dir="ltr" type="date" value={endDate} onChange={event => { setPeriod('custom'); setEndDate(event.target.value); }} className="w-[105px] bg-transparent text-center font-mono text-[10px] outline-none"/></label></>}</div>
            </div>
        </section>

        <section className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{metricCards.map(card => <MetricCard key={card.key} {...card} currencyLabel={currencyLabel}/>)}</section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1d1d20] md:p-5">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="text-right"><h2 className="text-[13px] font-black text-slate-900 dark:text-white">{t.chartTitle} ({activePeriodDetail})</h2><p className="mt-1 text-[9px] font-bold text-slate-400">{t.chartPeriod}</p></div><div className="flex flex-wrap items-center gap-3 text-[10px] font-black"><span className="text-emerald-600">● {t.sales}</span><span className="text-orange-500">● {t.purchases}</span><span className="text-rose-500">● {t.expenses}</span><span className="text-cyan-600">● {t.profit}</span></div></div>
            <div className="h-[272px] w-full" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 16, right: 15, bottom: 0, left: 0 }}><defs><linearGradient id="financial-sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#20aa56" stopOpacity={0.28}/><stop offset="100%" stopColor="#20aa56" stopOpacity={0}/></linearGradient><linearGradient id="financial-purchases-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ed7a1c" stopOpacity={0.16}/><stop offset="100%" stopColor="#ed7a1c" stopOpacity={0}/></linearGradient><linearGradient id="financial-expenses-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f04759" stopOpacity={0.12}/><stop offset="100%" stopColor="#f04759" stopOpacity={0}/></linearGradient><linearGradient id="financial-profit-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#118da4" stopOpacity={0.16}/><stop offset="100%" stopColor="#118da4" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e8edf3"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ba5b1', fontSize: 10, fontFamily: 'Cairo' }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ba5b1', fontSize: 10, fontFamily: 'Cairo' }} width={42} tickFormatter={value => value >= 1000 ? `${Math.round(value / 1000)}k` : value}/><Tooltip formatter={value => money(value)} contentStyle={{ borderRadius: '10px', border: '1px solid #e4e9ef', fontFamily: 'Cairo', fontWeight: 800, fontSize: '11px' }}/><Area type="monotone" dataKey="sales" name={t.sales} stroke="#159c52" strokeWidth={2.4} fill="url(#financial-sales-fill)" dot={{ r: 3.5, fill: '#159c52', strokeWidth: 0 }}/><Area type="monotone" dataKey="purchases" name={t.purchases} stroke="#ed7a1c" strokeWidth={2.3} fill="url(#financial-purchases-fill)" dot={{ r: 3.5, fill: '#ed7a1c', strokeWidth: 0 }}/><Area type="monotone" dataKey="expenses" name={t.expenses} stroke="#f04759" strokeWidth={2} strokeDasharray="4 4" fill="url(#financial-expenses-fill)" dot={{ r: 3, fill: '#f04759', strokeWidth: 0 }}/><Area type="monotone" dataKey="profit" name={t.profit} stroke="#118da4" strokeWidth={2.2} fill="url(#financial-profit-fill)" dot={{ r: 3.5, fill: '#118da4', strokeWidth: 0 }}/></AreaChart></ResponsiveContainer></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#1d1d20]">
            <div className="border-b border-slate-100 p-3 dark:border-white/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-black text-slate-500">{number(visibleTransactions.length)} {t.transactionCount}</span>
                    <div className="relative w-full sm:w-[230px]"><Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t.search} className="h-8 w-full rounded-lg border border-slate-200 bg-white py-1 pr-8 pl-3 text-[10px] font-bold text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white"/></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">{categoryFilters.map(([key, label]) => { const count = key === 'all' ? allTransactions.length : allTransactions.filter(row => row.type === key).length; return <button key={key} onClick={() => setCategoryFilter(key)} className={`h-7 rounded-lg border px-2.5 text-[9px] font-black ${categoryClass(key)} hover:bg-transparent active:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300`}>{label} ({number(count)})</button>; })}</div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="ml-1 text-[9px] font-black text-slate-500">{t.paymentMethod}</span>{[['all', t.all], ['cash', t.cash], ['wallet', t.wallet], ['transfer', t.transfer]].map(([key, label]) => { const tone = key === 'cash' ? 'border-emerald-300 bg-transparent text-emerald-700' : key === 'wallet' ? 'border-violet-300 bg-transparent text-violet-700' : key === 'transfer' ? 'border-cyan-300 bg-transparent text-cyan-700' : 'border-slate-300 bg-transparent text-slate-700'; return <button key={key} onClick={() => setPaymentFilter(key)} className={`h-6 rounded-full border px-3 text-[9px] font-black ${tone} hover:bg-transparent active:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300`}>{label}</button>; })}</div>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-[10px]"><thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><tr>{[t.type, t.description, t.entity, t.date, t.paymentMethod, t.status, t.amount].map(label => <th key={label} className="px-3 py-3 text-center font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">{visibleTransactions.length === 0 ? <tr><td colSpan="7" className="px-3 py-14 text-center text-xs font-bold text-slate-400">{t.noTransactions}</td></tr> : visibleTransactions.map(row => <tr key={row.id} className="transition-colors hover:bg-blue-50/30 dark:hover:bg-white/5"><td className="px-3 py-3 text-center"><span className="inline-flex items-center gap-1"><ChevronLeft size={13} className="text-slate-400"/><span className={`inline-flex rounded-full px-2 py-1 font-black ring-1 ${typeClass(row.type)}`}>{typeText(row.type)}</span></span></td><td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-200"><span dir="ltr" className="font-mono text-[9px] text-slate-700 dark:text-slate-300">{row.reference}</span><span className="mx-1 text-slate-300">/</span>{row.description}</td><td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-200">{row.entity}</td><td dir="ltr" className="px-3 py-3 text-center font-mono text-[9px] text-slate-500 dark:text-slate-300">{formatDate(row.date)}</td><td className="px-3 py-3 text-center"><span className={`inline-flex rounded-full px-2 py-1 font-black ring-1 ${paymentClass(row.payment)}`}>{paymentText(row.payment)}</span></td><td className="px-3 py-3 text-center"><span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black ring-1 ${statusClass(row.status)}`}>{row.status}</span></td><td dir="ltr" className={`px-3 py-3 text-center font-mono text-[10px] font-black ${row.type === 'expense' || row.type === 'payment' ? 'text-orange-500' : 'text-emerald-600'}`}>{money(row.amount)}</td></tr>)}</tbody></table></div>
        </section>

        {reportOpen && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm md:p-6"><div className="max-h-[96vh] w-full max-w-[780px] overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5"><div className="flex items-center gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600"><FileText size={15}/></div><div><h2 className="text-[11px] font-black text-slate-900">{t.reportPreview}</h2><p className="text-[9px] font-bold text-slate-400">{t.reportPreviewHint}</p></div></div><div className="flex items-center gap-2"><button onClick={printReport} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[10px] font-black text-white"><Printer size={13}/>{t.print}</button><button onClick={() => setReportOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={17}/></button></div></div><div className="bg-slate-100 p-4 md:p-6"><article className="rounded-2xl bg-white p-5 text-slate-900 shadow-sm md:p-8"><header className="flex items-start justify-between border-b-2 border-slate-800 pb-4"><div><h3 className="text-[22px] font-black">{isRTL ? 'متجر ميلانو' : 'Milano Store'}</h3><p className="mt-1 text-[9px] font-bold text-slate-500">{isRTL ? 'نظام إدارة التقارير المالية' : 'Financial reports management system'}</p></div><div className="text-left"><span className="rounded-md bg-slate-900 px-2.5 py-1 text-[9px] font-black text-white">{t.officialReport}</span><p dir="ltr" className="mt-2 font-mono text-[9px] font-bold text-slate-500">{t.reportNumber}</p></div></header><div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-black text-slate-600"><span>{t.fiscalPeriod}: <b className="text-slate-900">{activePeriodDetail}</b></span><span dir="ltr">{formatDate(startDate)} — {formatDate(endDate)}</span><span>{currencyLabel}</span></div><h4 className="mt-5 text-right text-[10px] font-black">{t.first}</h4><div className="mt-2 grid grid-cols-3 gap-2">{metricCards.map(card => <div key={card.key} className={`rounded-lg border p-2.5 text-center ${previewTone[card.key]}`}><p className="text-[8px] font-black text-slate-600">{card.title}</p><p dir="ltr" className="mt-1 font-mono text-[11px] font-black text-slate-900">{card.amount} <span className="text-[8px]">{currencyLabel}</span></p></div>)}</div><h4 className="mt-5 text-right text-[10px] font-black">{t.second}</h4><div className="mt-2 overflow-hidden rounded-lg border border-slate-200"><table className="w-full text-[8px]"><thead className="bg-slate-100"><tr>{[t.financialItem, t.category, t.amount, t.notes].map(label => <th key={label} className="px-2 py-2 text-center font-black">{label}</th>)}</tr></thead><tbody>{summaryRows.map(row => <tr key={row.title} className="border-t border-slate-100"><td className="px-2 py-2 text-center font-bold">{row.title}</td><td className={`px-2 py-2 text-center font-black ${row.color}`}>{row.category}</td><td dir="ltr" className="px-2 py-2 text-center font-mono font-black">{money(row.value)}</td><td className="px-2 py-2 text-center text-slate-500">{row.note}</td></tr>)}</tbody></table></div><h4 className="mt-5 text-right text-[10px] font-black">{t.third}</h4><div className="mt-2 overflow-hidden rounded-lg border border-slate-200"><table className="w-full text-[8px]"><thead className="bg-slate-100"><tr>{[t.date, t.type, t.description, t.entity, t.paymentMethod, t.amount].map(label => <th key={label} className="px-2 py-2 text-center font-black">{label}</th>)}</tr></thead><tbody>{visibleTransactions.slice(0, 15).map(row => <tr key={row.id} className="border-t border-slate-100"><td dir="ltr" className="px-2 py-2 text-center font-mono">{formatDate(row.date)}</td><td className="px-2 py-2 text-center font-bold">{typeText(row.type)}</td><td className="px-2 py-2 text-center">{row.reference} — {row.description}</td><td className="px-2 py-2 text-center">{row.entity}</td><td className="px-2 py-2 text-center">{paymentText(row.payment)}</td><td dir="ltr" className="px-2 py-2 text-center font-mono font-black">{money(row.amount)}</td></tr>)}</tbody></table></div><footer className="mt-7 flex justify-between border-t border-slate-200 pt-5 text-center text-[9px] font-black text-slate-600"><div>{t.accountant}<div className="mt-6 w-24 border-b border-dashed border-slate-400"></div></div><div>{t.manager}<div className="mt-6 w-24 border-b border-dashed border-slate-400"></div></div><div>{t.stamp}<div className="mt-3 flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-slate-300 text-[7px] text-slate-400">ميلانو</div></div></footer></article></div><div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3"><span className="text-[9px] font-bold text-slate-400">{t.ready}</span><div className="flex gap-2"><button onClick={() => setReportOpen(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600">{t.close}</button><button onClick={printReport} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black text-white"><Download size={13}/>{t.print}</button></div></div></div></div>}
    </div>;
};

export default FinancialReportsView;
