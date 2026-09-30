import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
    Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
    BarChart3, CalendarDays, Download, FileText, Landmark, Package, Printer,
    RefreshCw, Search, ShoppingCart, TrendingUp, WalletCards, X
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { getLocalizedCurrency } from '../../lib/currencyUtils';

const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value?.seconds) return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
        return Number.isNaN(iso.getTime()) ? null : iso;
    }
    return null;
};

const isoDay = (value) => {
    const date = toDate(value);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const dayAtNoon = (key) => key ? new Date(`${key}T12:00:00`) : null;
const clampText = (value) => String(value ?? '').replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#039;' }[char]));

const MetricCard = ({ label, hint, value, icon, tone, badge }) => (
    <article className={`relative min-h-[124px] overflow-hidden rounded-2xl bg-gradient-to-br ${tone} p-4 text-white shadow-lg shadow-black/5`}>
        <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-inner">{icon}</div>
        <div className="relative mr-14 text-right">
            <p className="text-xs font-black text-white/95">{label}</p>
            <p className="mt-1 text-[10px] font-bold text-white/70">{hint}</p>
            <p dir="ltr" className="mt-2 font-mono text-2xl font-black tracking-tight">{value}</p>
            {badge && <span className="mt-2 inline-flex rounded-lg bg-white/20 px-2 py-1 text-[9px] font-black text-white">{badge}</span>}
        </div>
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

    const t = isRTL ? {
        title: 'إدارة التقارير المالية', subtitle: 'متابعة مالية شاملة لمبيعات المتجر، المشتريات، المصروفات وصافي الربح',
        printPdf: 'طباعة PDF', period: 'الفترة', week: 'أسبوع', month: 'شهر 1', quarter: '3 شهور', half: '6 شهور', year: 'سنة', custom: 'فترة مخصصة',
        currentStock: 'الرصيد الحالي للمخزون', purchases: 'إجمالي المشتريات', expenses: 'إجمالي المصروفات', sales: 'إجمالي المبيعات', revenue: 'إجمالي الإيرادات', profit: 'صافي الربح',
        stockHint: 'القيمة الحالية للمنتجات بالمخزون', purchasesHint: 'فواتير شراء المخزون خلال الفترة', expensesHint: 'المصروفات التشغيلية والسندات', salesHint: 'إجمالي فواتير البيع غير الملغاة', revenueHint: 'سندات القبض والإيرادات الأخرى', profitHint: 'بعد تكلفة المنتجات والمصروفات',
        salesPurchases: 'الأرباح والمبيعات', chartHint: 'رسم بياني تفاعلي يقارن المبيعات والمشتريات والمصروفات وصافي الربح',
        search: 'ابحث في العمليات المالية...', all: 'الكل', transactions: 'كشف العمليات المالية', transactionCount: 'عملية معروضة', paymentMethod: 'طريقة الدفع', cash: 'نقدي / كاش', wallet: 'محفظة جيب', transfer: 'تحويل بنكي',
        date: 'التاريخ', type: 'نوع المعاملة', description: 'البيان / الوصف', entity: 'الطرف / العميل / المورد', amount: 'المبلغ', status: 'الحالة',
        from: 'من', to: 'إلى', noTransactions: 'لا توجد عمليات مالية مطابقة للفلاتر المحددة', officialPreview: 'معاينة التقرير المالي الرسمي (PDF)', previewHint: 'جاهز للطباعة أو الحفظ بصيغة PDF', officialReport: 'تقرير مالي رسمي', reportDate: 'تاريخ الإصدار', fiscalPeriod: 'فترة التقرير المالي', summary: 'أولاً: ملخص المؤشرات المالية الستة الرئيسية', statement: 'ثانياً: جدول الميزانية والتدفقات النقدية للفترة', movement: 'ثالثاً: كشف العمليات المالية المنجزة (عينة مسجلة)', notes: 'ملاحظات', financialItem: 'البند المالي', category: 'النوع', net: 'صافي الربح المحقق', itemTotal: 'إجمالي الأصناف', printReport: 'طباعة التقرير', close: 'إغلاق', reportReady: 'التقرير جاهز للطباعة أو الحفظ كملف PDF',
        inventoryBadge: 'مخزون حي', invoiceBadge: 'فواتير مشتريات', expenseBadge: 'مصروفات تشغيلية', salesBadge: 'عدد المبيعات', receiptBadge: 'سندات قبض', margin: 'هامش تقريبي', salesType: 'مبيعات', purchaseType: 'مشتريات', expenseType: 'مصروفات', receiptType: 'سندات القبض', paymentType: 'سندات الصرف',
        completed: 'مكتمل', pending: 'قيد المعالجة', paid: 'مدفوع', deferred: 'آجل', document: 'موثق', currentCurrency: 'العملة', warehouseManager: 'إعداد المحاسب المالي', storeManager: 'اعتماد المدير العام', seal: 'ختم المنشأة الرسمي'
    } : {
        title: 'Financial Reports Management', subtitle: 'Store sales, purchases, expenses, and net-profit overview',
        printPdf: 'Print PDF', period: 'Period', week: 'Week', month: '1 Month', quarter: '3 Months', half: '6 Months', year: 'Year', custom: 'Custom range',
        currentStock: 'Current inventory balance', purchases: 'Total purchases', expenses: 'Total expenses', sales: 'Total sales', revenue: 'Total revenue', profit: 'Net profit',
        stockHint: 'Current value of products in inventory', purchasesHint: 'Inventory purchase invoices in period', expensesHint: 'Operating expenses and bonds', salesHint: 'All non-cancelled sales invoices', revenueHint: 'Receipt bonds and other revenue', profitHint: 'After product cost and expenses',
        salesPurchases: 'Profit and sales', chartHint: 'Interactive comparison of sales, purchases, expenses, and profit',
        search: 'Search financial transactions...', all: 'All', transactions: 'Financial transaction register', transactionCount: 'transactions shown', paymentMethod: 'Payment method', cash: 'Cash', wallet: 'Jib wallet', transfer: 'Bank transfer',
        date: 'Date', type: 'Transaction type', description: 'Description', entity: 'Party / customer / supplier', amount: 'Amount', status: 'Status',
        from: 'From', to: 'To', noTransactions: 'No financial operations match these filters', officialPreview: 'Official Financial Report Preview (PDF)', previewHint: 'Ready to print or save as PDF', officialReport: 'Official Financial Report', reportDate: 'Issue date', fiscalPeriod: 'Financial reporting period', summary: 'First: Summary of six primary financial indicators', statement: 'Second: Budget and cash-flow statement for the period', movement: 'Third: Recorded financial transactions', notes: 'Notes', financialItem: 'Financial item', category: 'Type', net: 'Net profit achieved', itemTotal: 'Items total', printReport: 'Print report', close: 'Close', reportReady: 'The report is ready to print or save as PDF',
        inventoryBadge: 'Live inventory', invoiceBadge: 'Purchase invoices', expenseBadge: 'Operating expenses', salesBadge: 'Sales invoices', receiptBadge: 'Receipt bonds', margin: 'Approx. margin', salesType: 'Sales', purchaseType: 'Purchases', expenseType: 'Expenses', receiptType: 'Receipt bonds', paymentType: 'Payment bonds',
        completed: 'Completed', pending: 'In progress', paid: 'Paid', deferred: 'Deferred', document: 'Documented', currentCurrency: 'Currency', warehouseManager: 'Financial accountant', storeManager: 'General manager approval', seal: 'Official company stamp'
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
        let start = new Date(end);
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
    const orderTotal = (order) => {
        if (order?.total !== undefined && order?.total !== null) return Number(order.total || 0);
        return Math.max(0, Number(order?.subTotal || order?.price || 0) - Number(order?.discount || 0) + Number(order?.deliveryCost || 0));
    };
    const orderDate = (order) => order.completedAt || order.updatedAt || order.createdAt || order.date;
    const purchaseDate = (purchase) => purchase.date || purchase.updatedAt || purchase.createdAt;
    const expenseDate = (expense) => expense.date || expense.updatedAt || expense.createdAt;
    const bondDate = (bond) => bond.date || bond.updatedAt || bond.createdAt;
    const paymentKey = (value) => value === 'cash' || value === 'manual' || !value ? 'cash' : (value === 'card' || value === 'wallet' ? 'wallet' : (value === 'transfer' || value === 'bank' ? 'transfer' : String(value)));
    const paymentText = (value) => {
        const key = paymentKey(value);
        if (key === 'cash') return t.cash;
        if (key === 'wallet') return t.wallet;
        if (key === 'transfer') return t.transfer;
        return String(value || t.cash);
    };
    const paymentBadge = (value) => {
        const key = paymentKey(value);
        return key === 'cash' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : key === 'wallet' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-cyan-200 bg-cyan-50 text-cyan-700';
    };
    const typeText = (type) => ({ sales: t.salesType, purchase: t.purchaseType, expense: t.expenseType, receipt: t.receiptType, payment: t.paymentType }[type] || type);
    const typeBadge = (type) => ({
        sales: 'border-emerald-200 bg-emerald-50 text-emerald-700', purchase: 'border-amber-200 bg-amber-50 text-amber-700',
        expense: 'border-rose-200 bg-rose-50 text-rose-700', receipt: 'border-violet-200 bg-violet-50 text-violet-700', payment: 'border-orange-200 bg-orange-50 text-orange-700'
    }[type] || 'border-gray-200 bg-gray-50 text-gray-700');

    const productCostMap = useMemo(() => Object.fromEntries(products.map(product => [String(product.name || '').trim(), Number(product.costPrice || 0)])), [products]);
    const activeOrders = useMemo(() => orders.filter(order => !isCancelled(order.status) && isInRange(orderDate(order))), [orders, startDate, endDate]);
    const filteredPurchases = useMemo(() => purchases.filter(item => isInRange(purchaseDate(item))), [purchases, startDate, endDate]);
    const filteredExpenses = useMemo(() => expenses.filter(item => isInRange(expenseDate(item))), [expenses, startDate, endDate]);
    const filteredBonds = useMemo(() => bonds.filter(item => isInRange(bondDate(item))), [bonds, startDate, endDate]);

    const statistics = useMemo(() => {
        const totalSales = activeOrders.reduce((sum, order) => sum + orderTotal(order), 0);
        const totalPurchases = filteredPurchases.reduce((sum, item) => sum + Number(item.total ?? item.amount ?? 0), 0);
        const totalExpenses = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalRevenue = filteredBonds.filter(item => item.type === 'receipt').reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalPayments = filteredBonds.filter(item => item.type === 'payment').reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const costOfSold = activeOrders.reduce((sum, order) => {
            const lines = Array.isArray(order.cartItems) ? order.cartItems : (Array.isArray(order.items) ? order.items : []);
            return sum + lines.reduce((lineSum, line) => lineSum + Number(line.quantity || line.qty || 1) * Number(line.costPrice ?? productCostMap[String(line.title || line.name || '').trim()] ?? 0), 0);
        }, 0);
        const stockBalance = products.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.price ?? product.costPrice ?? 0), 0);
        const netProfit = totalSales + totalRevenue - totalExpenses - totalPayments - costOfSold;
        return { totalSales, totalPurchases, totalExpenses, totalRevenue, totalPayments, costOfSold, stockBalance, netProfit };
    }, [activeOrders, filteredPurchases, filteredExpenses, filteredBonds, products, productCostMap]);

    const allTransactions = useMemo(() => {
        const sales = activeOrders.map(order => ({
            id: `sales-${order.id}`, type: 'sales', date: isoDay(orderDate(order)), rawDate: toDate(orderDate(order)), amount: orderTotal(order),
            reference: order.orderId || `ORD-${String(order.id).slice(-6).toUpperCase()}`, description: isRTL ? 'فاتورة بيع' : 'Sales invoice',
            entity: order.formData?.name || order.customer?.name || order.customerName || order.name || '---', payment: order.paymentMethod || order.formData?.paymentMethod || 'cash',
            status: isCancelled(order.status) ? t.pending : (String(order.status || '').toLowerCase().includes('complete') || String(order.status || '').includes('مكتمل') ? t.completed : t.pending)
        }));
        const purchaseRows = filteredPurchases.map(purchase => ({
            id: `purchase-${purchase.id}`, type: 'purchase', date: isoDay(purchaseDate(purchase)), rawDate: toDate(purchaseDate(purchase)), amount: Number(purchase.total ?? purchase.amount ?? 0),
            reference: purchase.invoiceNumber || `PUR-${String(purchase.id).slice(-6).toUpperCase()}`, description: purchase.productName || (isRTL ? 'فاتورة شراء مخزون' : 'Inventory purchase invoice'),
            entity: purchase.supplierName || '---', payment: purchase.paymentMethod || 'cash', status: purchase.invoiceStatus === 'paid' ? t.paid : purchase.invoiceStatus === 'deferred' ? t.deferred : t.pending
        }));
        const expenseRows = filteredExpenses.map(expense => ({
            id: `expense-${expense.id}`, type: 'expense', date: isoDay(expenseDate(expense)), rawDate: toDate(expenseDate(expense)), amount: Number(expense.amount || 0),
            reference: `EXP-${String(expense.id).slice(-6).toUpperCase()}`, description: expense.title || expense.category || (isRTL ? 'مصروف تشغيلي' : 'Operating expense'),
            entity: expense.category || '---', payment: expense.paymentMethod || 'cash', status: t.completed
        }));
        const bondRows = filteredBonds.map(bond => ({
            id: `bond-${bond.id}`, type: bond.type === 'receipt' ? 'receipt' : 'payment', date: isoDay(bondDate(bond)), rawDate: toDate(bondDate(bond)), amount: Number(bond.amount || 0),
            reference: bond.number || `BND-${String(bond.id).slice(-6).toUpperCase()}`, description: bond.notes || (bond.type === 'receipt' ? t.receiptType : t.paymentType),
            entity: bond.entityName || '---', payment: bond.paymentMethod || 'cash', status: t.document
        }));
        return [...sales, ...purchaseRows, ...expenseRows, ...bondRows].filter(row => row.date).sort((a, b) => Number(b.rawDate || 0) - Number(a.rawDate || 0));
    }, [activeOrders, filteredPurchases, filteredExpenses, filteredBonds, isRTL, t]);

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
                key: `${isoDay(bucketStart)}-${isoDay(bucketEnd)}`,
                label: (period === 'half' || period === 'year')
                    ? new Intl.DateTimeFormat(isRTL ? 'ar-YE' : 'en-US', { month: 'short' }).format(bucketStart)
                    : new Intl.DateTimeFormat(isRTL ? 'ar-YE' : 'en-US', { day: 'numeric', month: days > 7 ? 'short' : undefined, weekday: days <= 7 ? 'short' : undefined }).format(bucketStart),
                start: bucketStart, end: bucketEnd
            });
        }
        return buckets;
    }, [period, startDate, endDate, isRTL]);

    const chartData = useMemo(() => chartBuckets.map(bucket => {
        const inside = (value) => { const date = toDate(value); return date && date >= bucket.start && date <= new Date(bucket.end.getFullYear(), bucket.end.getMonth(), bucket.end.getDate(), 23, 59, 59); };
        const sales = activeOrders.filter(order => inside(orderDate(order))).reduce((sum, order) => sum + orderTotal(order), 0);
        const purchasesTotal = filteredPurchases.filter(item => inside(purchaseDate(item))).reduce((sum, item) => sum + Number(item.total ?? item.amount ?? 0), 0);
        const expensesTotal = filteredExpenses.filter(item => inside(expenseDate(item))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const revenue = filteredBonds.filter(item => item.type === 'receipt' && inside(bondDate(item))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const payments = filteredBonds.filter(item => item.type === 'payment' && inside(bondDate(item))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const soldCost = activeOrders.filter(order => inside(orderDate(order))).reduce((sum, order) => {
            const lines = Array.isArray(order.cartItems) ? order.cartItems : (Array.isArray(order.items) ? order.items : []);
            return sum + lines.reduce((lineSum, line) => lineSum + Number(line.quantity || line.qty || 1) * Number(line.costPrice ?? productCostMap[String(line.title || line.name || '').trim()] ?? 0), 0);
        }, 0);
        return { label: bucket.label, sales, purchases: purchasesTotal, expenses: expensesTotal, profit: sales + revenue - expensesTotal - payments - soldCost };
    }), [chartBuckets, activeOrders, filteredPurchases, filteredExpenses, filteredBonds, productCostMap]);

    const categoryFilters = [
        ['all', t.all], ['sales', t.salesType], ['purchase', t.purchaseType], ['expense', t.expenseType], ['receipt', t.receiptType], ['payment', t.paymentType]
    ];
    const periodLabel = ({ week: t.week, month: t.month, quarter: t.quarter, half: t.half, year: t.year, custom: t.custom }[period] || t.week);
    const reportCards = [
        { label: t.currentStock, hint: t.stockHint, value: money(statistics.stockBalance), icon: <Package size={21}/>, tone: 'from-blue-600 via-blue-500 to-indigo-700', badge: t.inventoryBadge },
        { label: t.purchases, hint: t.purchasesHint, value: money(statistics.totalPurchases), icon: <ShoppingCart size={21}/>, tone: 'from-orange-500 via-orange-500 to-amber-600', badge: `${number(filteredPurchases.length)} ${t.invoiceBadge}` },
        { label: t.expenses, hint: t.expensesHint, value: money(statistics.totalExpenses), icon: <WalletCards size={21}/>, tone: 'from-rose-500 via-red-500 to-pink-600', badge: t.expenseBadge },
        { label: t.sales, hint: t.salesHint, value: money(statistics.totalSales), icon: <TrendingUp size={21}/>, tone: 'from-emerald-600 via-green-500 to-emerald-500', badge: `${number(activeOrders.length)} ${t.salesBadge}` },
        { label: t.revenue, hint: t.revenueHint, value: money(statistics.totalRevenue), icon: <Landmark size={21}/>, tone: 'from-violet-600 via-purple-500 to-indigo-600', badge: `${number(filteredBonds.filter(item => item.type === 'receipt').length)} ${t.receiptBadge}` },
        { label: t.profit, hint: t.profitHint, value: money(statistics.netProfit), icon: <BarChart3 size={21}/>, tone: 'from-cyan-600 via-teal-500 to-sky-500', badge: `${t.margin}: ${statistics.totalSales ? `${((statistics.netProfit / statistics.totalSales) * 100).toFixed(1)}%` : '0%'}` }
    ];

    const financialRows = [
        { label: isRTL ? 'إجمالي مبيعات البضائع' : 'Total goods sales', type: isRTL ? 'إيراد' : 'Revenue', value: statistics.totalSales, note: isRTL ? 'مبيعات فواتير الطلبات غير الملغاة' : 'Non-cancelled order invoices', color: 'text-emerald-600' },
        { label: isRTL ? 'فواتير المشتريات المعتمدة' : 'Approved purchase invoices', type: isRTL ? 'مشتريات مخزون' : 'Inventory purchases', value: statistics.totalPurchases, note: isRTL ? 'إضافات المخزون خلال الفترة' : 'Inventory additions in period', color: 'text-amber-600' },
        { label: isRTL ? 'المصروفات التشغيلية والسندات' : 'Operating expenses and vouchers', type: isRTL ? 'مصروفات' : 'Expenses', value: statistics.totalExpenses + statistics.totalPayments, note: isRTL ? 'مصاريف خدمات وسندات صرف' : 'Service expenses and payment bonds', color: 'text-rose-600' },
        { label: isRTL ? 'صافي الربح المحقق' : 'Net profit achieved', type: isRTL ? 'النتيجة المالية' : 'Financial result', value: statistics.netProfit, note: `${t.margin}: ${statistics.totalSales ? `${((statistics.netProfit / statistics.totalSales) * 100).toFixed(1)}%` : '0%'}`, color: 'text-cyan-700' }
    ];

    const printReport = () => {
        const printWindow = window.open('', '_blank', 'width=1050,height=850');
        if (!printWindow) { alert(isRTL ? 'يرجى السماح بالنوافذ المنبثقة للطباعة.' : 'Please allow popups to print.'); return; }
        const dateRange = `${formatDate(startDate)} — ${formatDate(endDate)}`;
        const cardHtml = reportCards.map(card => `<div class="metric"><span>${clampText(card.label)}</span><b>${clampText(card.value)}</b></div>`).join('');
        const statementHtml = financialRows.map(row => `<tr><td>${clampText(row.label)}</td><td>${clampText(row.type)}</td><td>${clampText(money(row.value))}</td><td>${clampText(row.note)}</td></tr>`).join('');
        const transactionHtml = visibleTransactions.slice(0, 50).map(row => `<tr><td>${clampText(formatDate(row.date))}</td><td>${clampText(typeText(row.type))}</td><td>${clampText(row.reference)} — ${clampText(row.description)}</td><td>${clampText(row.entity)}</td><td>${clampText(paymentText(row.payment))}</td><td>${clampText(money(row.amount))}</td></tr>`).join('');
        const logo = generalSettings?.invoiceLogo || '/admin-new-icon.png';
        printWindow.document.write(`<!doctype html><html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${clampText(t.officialReport)}</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#1f2937;background:#fff;font-family:Arial,Tahoma,sans-serif;font-size:11px}.sheet{border:1px solid #dbe3ea;border-radius:12px;padding:22px;min-height:270mm}.header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #1f2937;padding-bottom:14px}.brand{display:flex;gap:11px;align-items:center}.brand img{width:48px;height:48px;object-fit:cover;border-radius:9px}.brand h1{font-size:21px;margin:0 0 4px;font-weight:900}.brand p{margin:0;color:#6b7280;font-weight:700;font-size:9px}.report-tag{display:inline-block;background:#111827;color:#fff;border-radius:6px;padding:5px 10px;font-weight:900;font-size:10px}.small{color:#6b7280;font-size:9px;font-weight:700;margin-top:5px}.range{margin-top:15px;border:1px solid #d9e0e8;border-radius:8px;background:#f8fafc;padding:10px 13px;display:flex;justify-content:space-between;font-weight:800}.section{font-size:12px;font-weight:900;margin:20px 0 9px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.metric{border:1px solid #dbe3ea;border-radius:9px;padding:10px;text-align:center;background:#fbfdff}.metric:nth-child(1){border-color:#bbd7ff}.metric:nth-child(2){border-color:#fde4a5}.metric:nth-child(3){border-color:#fecdd3}.metric:nth-child(4){border-color:#bbf7d0}.metric:nth-child(5){border-color:#ddd6fe}.metric:nth-child(6){border-color:#a7f3d0}.metric span{display:block;color:#475569;font-size:9px;font-weight:800}.metric b{display:block;margin-top:5px;font-size:14px;color:#111827}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dbe3ea;border-radius:8px;overflow:hidden;font-size:9px}th{background:#f3f4f6;font-weight:900;padding:8px 6px;border-bottom:1px solid #dbe3ea;text-align:center}td{padding:7px 6px;border-bottom:1px solid #edf0f3;text-align:center;font-weight:700}tr:last-child td{border-bottom:0}.footer{display:flex;justify-content:space-between;text-align:center;margin-top:25px;font-weight:800;color:#475569}.signature{width:29%}.line{border-bottom:1px dashed #94a3b8;margin-top:28px}@media print{.sheet{border:0}}</style></head><body><main class="sheet"><header class="header"><div class="brand"><img src="${logo}"/><div><h1>${isRTL ? 'متجر ميلانو' : 'Milano Store'}</h1><p>${isRTL ? 'نظام إدارة التقارير المالية' : 'Financial reports management system'}</p></div></div><div><span class="report-tag">${clampText(t.officialReport)}</span><p class="small">${clampText(t.reportDate)}: ${clampText(formatDate(new Date()))}</p></div></header><div class="range"><span>${clampText(t.fiscalPeriod)}: ${clampText(periodLabel)}</span><span>${clampText(dateRange)}</span><span>${clampText(t.currentCurrency)}: ${clampText(currencyLabel)}</span></div><h2 class="section">${clampText(t.summary)}</h2><section class="metrics">${cardHtml}</section><h2 class="section">${clampText(t.statement)}</h2><table><thead><tr><th>${clampText(t.financialItem)}</th><th>${clampText(t.category)}</th><th>${clampText(t.amount)}</th><th>${clampText(t.notes)}</th></tr></thead><tbody>${statementHtml}</tbody></table><h2 class="section">${clampText(t.movement)}</h2><table><thead><tr><th>${clampText(t.date)}</th><th>${clampText(t.type)}</th><th>${clampText(t.description)}</th><th>${clampText(t.entity)}</th><th>${clampText(t.paymentMethod)}</th><th>${clampText(t.amount)}</th></tr></thead><tbody>${transactionHtml || `<tr><td colspan="6">${clampText(t.noTransactions)}</td></tr>`}</tbody></table><footer class="footer"><div class="signature">${clampText(t.warehouseManager)}<div class="line"></div></div><div class="signature">${clampText(t.storeManager)}<div class="line"></div></div><div class="signature">${clampText(t.seal)}<div class="line"></div></div></footer></main><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);
        printWindow.document.close();
    };

    return <div className="space-y-5 pb-8" dir={isRTL ? 'rtl' : 'ltr'}>
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1c1c1e] md:flex-row md:items-center md:justify-between md:px-5">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><BarChart3 size={23}/></div>
                <div><h1 className="text-xl font-black text-gray-900 dark:text-white">{t.title}</h1><p className="mt-1 text-[11px] font-bold text-gray-400">{t.subtitle}</p></div>
            </div>
            <div className="flex items-center gap-2"><button onClick={() => setReportOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-red-700"><Printer size={16}/>{t.printPdf}</button><button onClick={() => setPeriod(period)} title={isRTL ? 'تحديث' : 'Refresh'} className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"><RefreshCw size={16}/></button></div>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#1c1c1e]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">{[['week', t.week], ['month', t.month], ['quarter', t.quarter], ['half', t.half], ['year', t.year]].map(([key, label]) => <button key={key} onClick={() => setPeriod(key)} className={`rounded-xl px-3.5 py-2 text-xs font-black transition-colors ${period === key ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'}`}>{label}</button>)}<select value={period === 'custom' ? 'custom' : ''} onChange={event => setPeriod(event.target.value)} className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"><option value="" disabled>{t.custom}</option><option value="custom">{t.custom}</option></select></div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-gray-500"><span>{t.period} {periodLabel}:</span><span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{formatDate(startDate)} — {formatDate(endDate)}</span>{period === 'custom' && <><label className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-white/5"><CalendarDays size={14}/>{t.from}<input lang="en" dir="ltr" type="date" value={startDate} onChange={event => { setPeriod('custom'); setStartDate(event.target.value); }} className="w-[112px] bg-transparent text-center font-mono text-[10px] outline-none"/></label><label className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-white/5">{t.to}<input lang="en" dir="ltr" type="date" value={endDate} onChange={event => { setPeriod('custom'); setEndDate(event.target.value); }} className="w-[112px] bg-transparent text-center font-mono text-[10px] outline-none"/></label></>}</div>
            </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{reportCards.map(card => <MetricCard key={card.label} {...card}/>)}</section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1c1c1e] md:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black text-gray-900 dark:text-white">{t.salesPurchases} ({periodLabel})</h2><p className="mt-1 text-[10px] font-bold text-gray-400">{t.chartHint}</p></div><div className="flex flex-wrap items-center gap-3 text-[10px] font-black"><span className="text-emerald-600">● {t.sales}</span><span className="text-orange-500">● {t.purchases}</span><span className="text-rose-500">● {t.expenses}</span><span className="text-cyan-600">● {t.profit}</span></div></div>
            <div className="h-[300px] w-full" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}><defs><linearGradient id="salesFillFinancial" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity={0.24}/><stop offset="100%" stopColor="#16a34a" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Cairo' }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Cairo' }} width={48} tickFormatter={value => value >= 1000 ? `${Math.round(value / 1000)}k` : value}/><Tooltip formatter={(value) => money(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontFamily: 'Cairo', fontWeight: 700 }}/><Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Cairo', fontWeight: 800 }}/><Area type="monotone" dataKey="sales" name={t.sales} stroke="#16a34a" strokeWidth={3} fill="url(#salesFillFinancial)" dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }}/><Line type="monotone" dataKey="purchases" name={t.purchases} stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}/><Line type="monotone" dataKey="expenses" name={t.expenses} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}/><Line type="monotone" dataKey="profit" name={t.profit} stroke="#0891b2" strokeWidth={2.5} dot={{ r: 3, fill: '#0891b2', strokeWidth: 0 }}/></AreaChart></ResponsiveContainer></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#1c1c1e]">
            <div className="border-b border-gray-100 p-4 dark:border-white/10"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="relative min-w-0 flex-1"><Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t.search} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pr-9 pl-3 text-xs font-bold outline-none placeholder:text-gray-400 focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white"/></div><div className="flex flex-wrap items-center gap-1.5">{categoryFilters.map(([key, label]) => { const count = key === 'all' ? allTransactions.length : allTransactions.filter(row => row.type === key).length; return <button key={key} onClick={() => setCategoryFilter(key)} className={`rounded-xl border px-3 py-1.5 text-[10px] font-black transition-colors ${categoryFilter === key ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'}`}>{label} ({number(count)})</button>; })}</div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold text-gray-400">{number(visibleTransactions.length)} {t.transactionCount}</span><div className="flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-black text-gray-500">{t.paymentMethod}:</span>{[['all', t.all], ['cash', t.cash], ['wallet', t.wallet], ['transfer', t.transfer]].map(([key, label]) => <button key={key} onClick={() => setPaymentFilter(key)} className={`rounded-full px-3 py-1 text-[10px] font-black transition-colors ${paymentFilter === key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'}`}>{label}</button>)}</div></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[970px] text-xs"><thead className="bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-300"><tr>{[t.type, t.description, t.entity, t.date, t.paymentMethod, t.amount, t.status].map(label => <th key={label} className="px-3 py-3 text-center font-black whitespace-nowrap">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-white/5">{visibleTransactions.length === 0 ? <tr><td colSpan="7" className="px-3 py-14 text-center text-sm font-bold text-gray-400">{t.noTransactions}</td></tr> : visibleTransactions.map(row => <tr key={row.id} className="bg-white transition-colors hover:bg-blue-50/30 dark:bg-[#1c1c1e] dark:hover:bg-white/5"><td className="px-3 py-3 text-center"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${typeBadge(row.type)}`}>{typeText(row.type)}</span></td><td className="px-3 py-3 text-center font-bold text-gray-700 dark:text-gray-200"><span dir="ltr" className="font-mono text-[10px] text-blue-600">{row.reference}</span><span className="mx-1.5 text-gray-300">/</span>{row.description}</td><td className="px-3 py-3 text-center font-bold text-gray-700 dark:text-gray-200">{row.entity}</td><td dir="ltr" className="px-3 py-3 text-center font-mono text-[11px] text-gray-500 dark:text-gray-300">{formatDate(row.date)}</td><td className="px-3 py-3 text-center"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${paymentBadge(row.payment)}`}>{paymentText(row.payment)}</span></td><td dir="ltr" className={`px-3 py-3 text-center font-mono font-black ${row.type === 'expense' || row.type === 'payment' ? 'text-rose-500' : 'text-emerald-600'}`}>{money(row.amount)}</td><td className="px-3 py-3 text-center"><span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-black text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">{row.status}</span></td></tr>)}</tbody></table></div>
        </section>

        {reportOpen && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm md:p-6"><div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-gray-100 shadow-2xl dark:bg-[#202124]"><div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-5 dark:border-white/10 dark:bg-[#242528]"><div className="flex items-center gap-3"><FileText size={18} className="text-red-600"/><div><h2 className="text-sm font-black text-gray-900 dark:text-white">{t.officialPreview}</h2><p className="text-[10px] font-bold text-gray-400">{t.previewHint}</p></div></div><div className="flex items-center gap-2"><button onClick={printReport} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-red-500/20 hover:bg-red-700"><Printer size={14}/>{t.printReport}</button><button onClick={() => setReportOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><X size={18}/></button></div></div><div className="p-4 md:p-7"><article className="rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-sm md:p-7" dir={isRTL ? 'rtl' : 'ltr'}><header className="flex items-start justify-between border-b-2 border-gray-800 pb-5"><div className="flex items-center gap-3"><img src={generalSettings?.invoiceLogo || '/admin-new-icon.png'} className="h-14 w-14 rounded-xl object-cover"/><div><h3 className="text-xl font-black">{isRTL ? 'متجر ميلانو' : 'Milano Store'}</h3><p className="mt-1 text-[10px] font-bold text-gray-500">{isRTL ? 'نظام إدارة التقارير المالية' : 'Financial reports management system'}</p></div></div><div className="text-left"><span className="inline-flex rounded-lg bg-gray-900 px-3 py-1.5 text-[10px] font-black text-white">{t.officialReport}</span><p className="mt-2 text-[10px] font-bold text-gray-500">{t.reportDate}: {formatDate(new Date())}</p></div></header><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[10px] font-black text-gray-600"><span>{t.fiscalPeriod}: <b className="text-gray-900">{periodLabel}</b></span><span dir="ltr">{formatDate(startDate)} — {formatDate(endDate)}</span><span>{t.currentCurrency}: <b className="text-gray-900">{currencyLabel}</b></span></div><h4 className="mt-6 text-right text-xs font-black">{t.summary}</h4><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">{reportCards.map(card => <div key={card.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center"><p className="text-[10px] font-black text-gray-600">{card.label}</p><p dir="ltr" className="mt-1 font-mono text-sm font-black text-gray-900">{card.value}</p></div>)}</div><h4 className="mt-6 text-right text-xs font-black">{t.statement}</h4><div className="mt-3 overflow-hidden rounded-xl border border-gray-200"><table className="w-full text-[10px]"><thead className="bg-gray-100"><tr>{[t.financialItem, t.category, t.amount, t.notes].map(label => <th key={label} className="px-2 py-2 text-center font-black">{label}</th>)}</tr></thead><tbody>{financialRows.map(row => <tr key={row.label} className="border-t border-gray-100"><td className="px-2 py-2 text-center font-bold">{row.label}</td><td className={`px-2 py-2 text-center font-black ${row.color}`}>{row.type}</td><td dir="ltr" className="px-2 py-2 text-center font-mono font-black">{money(row.value)}</td><td className="px-2 py-2 text-center text-gray-500">{row.note}</td></tr>)}</tbody></table></div><h4 className="mt-6 text-right text-xs font-black">{t.movement}</h4><div className="mt-3 overflow-hidden rounded-xl border border-gray-200"><table className="w-full text-[9px]"><thead className="bg-gray-100"><tr>{[t.date, t.type, t.description, t.entity, t.paymentMethod, t.amount].map(label => <th key={label} className="px-2 py-2 text-center font-black">{label}</th>)}</tr></thead><tbody>{visibleTransactions.slice(0, 20).map(row => <tr key={row.id} className="border-t border-gray-100"><td dir="ltr" className="px-2 py-2 text-center font-mono">{formatDate(row.date)}</td><td className="px-2 py-2 text-center font-bold">{typeText(row.type)}</td><td className="px-2 py-2 text-center">{row.reference} — {row.description}</td><td className="px-2 py-2 text-center">{row.entity}</td><td className="px-2 py-2 text-center">{paymentText(row.payment)}</td><td dir="ltr" className="px-2 py-2 text-center font-mono font-black">{money(row.amount)}</td></tr>)}</tbody></table></div><footer className="mt-8 flex justify-between border-t border-gray-200 pt-6 text-center text-[10px] font-black text-gray-600"><div>{t.warehouseManager}<div className="mt-7 w-28 border-b border-dashed border-gray-400"></div></div><div>{t.storeManager}<div className="mt-7 w-28 border-b border-dashed border-gray-400"></div></div><div>{t.seal}<div className="mt-5 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-gray-300 text-[8px] text-gray-400">ميلانو</div></div></footer></article></div><div className="flex items-center justify-between border-t border-gray-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-[#242528]"><span className="text-[10px] font-bold text-gray-400">{t.reportReady}</span><div className="flex items-center gap-2"><button onClick={() => setReportOpen(false)} className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-black text-gray-600 dark:bg-white/10 dark:text-gray-200">{t.close}</button><button onClick={printReport} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white"><Download size={14}/>{t.printReport}</button></div></div></div></div>}
    </div>;
};

export default FinancialReportsView;
