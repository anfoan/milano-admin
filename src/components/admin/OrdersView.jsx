import React, { useState, useEffect, useRef } from 'react';
import { Printer, Search, FileDown, Trash2, Clock, CheckCircle, XCircle, MapPin, Phone, User, ShoppingBag, MessageCircle, Truck, X, Layers, ChevronDown, AlertTriangle, RefreshCw, Pencil } from 'lucide-react';
import { db } from '../../lib/firebase';
import { reverseWalletRewardForOrder, syncWalletRewardForOrderStatus } from '../../lib/walletRewards';
import { reconcilePendingCustomerOrder } from '../../lib/pendingOrderSync';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getLocalizedCurrency } from '../../lib/currencyUtils';
import { useCurrency } from '../../context/CurrencyContext';

import InvoiceTemplate from '../InvoiceTemplate';

class SafeInvoicePreview extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }
    static getDerivedStateFromError() {
        return { failed: true };
    }
    renderFallback() {
        const { order, lang, generalSettings } = this.props;
        const items = Array.isArray(order?.cartItems) ? order.cartItems : [];
        const currency = getLocalizedCurrency(generalSettings?.currency || order?.currency || 'YER', lang);
        const money = (value) => `${Number(value || 0).toLocaleString()} ${currency}`;
        return (
            <div className="bg-white text-gray-900 p-6 rounded-xl" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-5">
                    <div><h1 className="text-3xl font-black">{lang === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice'}</h1><p className="font-bold">متجر ميلانو</p></div>
                    <div className="text-sm font-bold text-right"><div>{lang === 'ar' ? 'رقم الفاتورة:' : 'Invoice:'} {order?.orderId || order?.id || '---'}</div><div>{order?.date || ''}</div></div>
                </div>
                <div className="bg-gray-50 border rounded-lg p-4 mb-5 text-sm font-bold">{lang === 'ar' ? 'العميل:' : 'Customer:'} {order?.formData?.name || '---'}<br />{order?.formData?.phone || ''}</div>
                <table className="w-full border-collapse border text-sm"><thead><tr className="bg-gray-900 text-white"><th className="p-2 text-right">{lang === 'ar' ? 'المنتج' : 'Product'}</th><th className="p-2">{lang === 'ar' ? 'الكمية' : 'Qty'}</th><th className="p-2">{lang === 'ar' ? 'الإجمالي' : 'Total'}</th></tr></thead><tbody>{items.map((item, index) => <tr key={index} className="border-b"><td className="p-2">{item.title || '---'}{item.selectedSize ? ` / ${item.selectedSize}` : ''}</td><td className="p-2 text-center">{item.quantity || 1}</td><td className="p-2 text-center">{money(Number(item.price || 0) * Number(item.quantity || 1))}</td></tr>)}</tbody></table>
                <div className="mt-5 ml-auto w-72 border-t-2 pt-3 space-y-2 font-bold">
                    <div className="flex justify-between"><span>{lang === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span><span>{money(order?.subTotal || order?.total)}</span></div>
                    <div className="flex justify-between text-red-600"><span>{lang === 'ar' ? 'الخصم:' : 'Discount:'}</span><span>- {money(Number(order?.discount || 0) + Math.round(Number(order?.subTotal || 0) * Number(order?.discountPercentage || 0) / 100))}</span></div>
                    <div className="flex justify-between"><span>{lang === 'ar' ? 'التوصيل:' : 'Delivery:'}</span><span>{money(order?.deliveryCost)}</span></div>
                    <div className="border-t-2 pt-2 font-black text-lg flex justify-between"><span>{lang === 'ar' ? 'الإجمالي:' : 'Total:'}</span><span>{money(order?.total)}</span></div>
                </div>
            </div>
        );
    }
    render() {
        // Keep the eye preview independent from the printable template. Older sales
        // orders can have incompatible shapes; the review screen must never crash.
        return this.renderFallback();
    }
}

const OrdersView = ({ onViewOrder, lang = 'ar', generalSettings, searchQuery, setSearchQuery }) => {
    const t = {
        ar: {
            search_placeholder: 'ابحث عن رقم الطلب، الاسم، أو الهاتف...',
            invoice_pdf: 'PDF فاتورة',
            export_excel: 'تصدير Excel',
            stat_all: 'الكل',
            stat_new: 'طلبات جديدة',
            stat_processing: 'قيد التجهيز',
            stat_shipping: 'قيد التوصيل',
            stat_completed: 'مكتمل',
            stat_cancelled: 'ملغي',
            th_order_id: 'رقم الطلب',
            th_name: 'اسم العميل',
            th_product_size: 'اسم المنتج + المقاس',
            th_price: 'السعر الكلي',
            th_status: 'الحالة',
            th_payment: 'توصيل الطلبات',
            th_phone: 'رقم الهاتف',
            th_date: 'التاريخ',
            th_details: 'التفاصيل',
            loading: 'جاري تحميل الطلبات...',
            no_orders: 'لا توجد طلبات تطابق البحث',
            total_footer: 'الإجمالي',
            orders_count: 'طلب',
            selected: 'محدد',
            select_status: 'حدد الحالة...',
            change_status: 'تغيير الحالة',
            print_invoices: 'طباعة الفواتير',
            delete_selected: 'حذف الفواتير المحددة',
            bulk_delete_title: 'حذف الفواتير المحددة؟',
            bulk_delete_desc: 'سيتم حذف {count} فاتورة نهائياً من قائمة الطلبات. ستُسترجع مكافأة المحفظة المرتبطة بالفاتورة تلقائياً إن وُجدت. لا يمكن التراجع عن هذا الإجراء.',
            bulk_delete_confirm: 'حذف الفواتير',
            bulk_delete_error: 'تعذر حذف بعض الفواتير المحددة. لم تُحذف الفواتير التي تعذر معالجتها.',
            confirm_modal_title: 'هل أنت متأكد؟',
            confirm_modal_desc: 'سيتم تغيير حالة {count} طلب إلى «{status}».',
            confirm_modal_note: 'ملاحظة: سيتم استثناء الطلبات التي حالتها (ملغي) من هذا التغيير.',
            confirm_btn: 'تأكيد التغيير',
            cancel_btn: 'إلغاء',
            order_details_title: 'تفاصيل الطلب',
            update_status_label: 'تحديث الحالة',
            notes: 'ملاحظات:',
            products_title: 'المنتجات',
            subtotal: 'المجموع الفرعي:',
            delivery: 'التوصيل:',
            total_final: 'الإجمالي:',
            status_new: 'طلب جديد',
            status_processing: 'قيد التجهيز',
            status_shipping: 'قيد التوصيل',
            status_completed: 'مكتمل',
            status_cancelled: 'ملغي',
            export_excel_title: 'تصدير طلباتك عبر ملف Excel',
            export_pdf_title: 'طباعة تقرير الطلبات PDF',
            export_period: 'الفترة',
            export_period_month: 'شهر (الحالي)',
            export_period_week: 'أسبوع (آخر 7 أيام)',
            export_period_all: 'الكل (جميع السجلات)',
            export_status: 'حالة الطلب',
            export_status_all: 'الكل',
            export_note: 'الملف سيحتوي على ورقتين: الأولى مخصصة للطلبات، والثانية مخصصة للمنتجات المطلوبة.',
            print_report_btn: 'طباعة التقرير',
            preview_invoice: 'معاينة الفاتورة',
            preview_note: 'تأكد من صحة البيانات قبل الطباعة',
            close: 'إغلاق',
            print: 'طباعة',
            alert_no_export: 'لا توجد طلبات لتصديرها وفقاً لهذه المعايير',
            alert_popup: 'من فضلك اسمح بالنوافذ المنبثقة (Popups) لطباعة التقرير.',
            alert_print_error: 'خطأ: لم يتم العثور على محتوى الفاتورة للطباعة.',
            alert_no_update: 'لا توجد طلبات قابلة للتحديث (الطلبات الملغية مستثناة)',
            alert_delete: 'هل أنت متأكد من حذف هذا الطلب نهائياً؟',
            alert_update_error: 'حدث خطأ أثناء التحديث',
            alert_status_update_error: 'حدث خطأ أثناء تحديث الحالة',
            alert_delete_error: 'حدث خطأ أثناء حذف الطلب',
        },
        en: {
            search_placeholder: 'Search Order ID, Name, or Phone...',
            invoice_pdf: 'Invoice PDF',
            export_excel: 'Export Excel',
            stat_all: 'All',
            stat_new: 'New Orders',
            stat_processing: 'Processing',
            stat_shipping: 'Shipping',
            stat_completed: 'Completed',
            stat_cancelled: 'Cancelled',
            th_order_id: 'Order ID',
            th_name: 'Customer Name',
            th_product_size: 'Product + Size',
            th_price: 'Total Price',
            th_status: 'Status',
            th_payment: 'Payment',
            th_phone: 'Phone',
            th_date: 'Date',
            th_details: 'Details',
            loading: 'Loading orders...',
            no_orders: 'No orders match your search',
            total_footer: 'Total',
            orders_count: 'orders',
            selected: 'Selected',
            select_status: 'Select Status...',
            change_status: 'Change Status',
            print_invoices: 'Print Invoices',
            delete_selected: 'Delete selected invoices',
            bulk_delete_title: 'Delete selected invoices?',
            bulk_delete_desc: '{count} invoices will be permanently removed from the orders list. Any linked wallet reward will be reversed automatically. This action cannot be undone.',
            bulk_delete_confirm: 'Delete invoices',
            bulk_delete_error: 'Some selected invoices could not be deleted. Invoices that could not be processed remain unchanged.',
            confirm_modal_title: 'Are you sure?',
            confirm_modal_desc: 'You are about to change the status of {count} orders to "{status}".',
            confirm_modal_note: 'Note: Cancelled orders will be excluded from this change.',
            confirm_btn: 'Confirm Change',
            cancel_btn: 'Cancel',
            order_details_title: 'Order Details',
            update_status_label: 'Update Status',
            notes: 'Notes:',
            products_title: 'Products',
            subtotal: 'Subtotal:',
            delivery: 'Delivery:',
            total_final: 'Total:',
            status_new: 'New Order',
            status_processing: 'Processing',
            status_shipping: 'Shipping',
            status_completed: 'Completed',
            status_cancelled: 'Cancelled',
            export_excel_title: 'Export Orders to Excel',
            export_pdf_title: 'Print Orders Report PDF',
            export_period: 'Period',
            export_period_month: 'Month (Current)',
            export_period_week: 'Week (Last 7 Days)',
            export_period_all: 'All (All Records)',
            export_status: 'Order Status',
            export_status_all: 'All',
            export_note: 'The file will contain two sheets: one for orders and one for ordered products.',
            print_report_btn: 'Print Report',
            preview_invoice: 'Invoice Preview',
            preview_note: 'Verify details before printing',
            close: 'Close',
            print: 'Print',
            alert_no_export: 'No orders to export based on these criteria',
            alert_popup: 'Please allow popups to print the report.',
            alert_print_error: 'Error: Invoice content not found for printing.',
            alert_no_update: 'No orders to update (Cancelled orders excluded)',
            alert_delete: 'Are you sure you want to permanently delete this order?',
            alert_update_error: 'Error updating orders',
            alert_status_update_error: 'Error updating status',
            alert_delete_error: 'Error deleting order',
        }
    };
    const txt = t[lang];
    const isRTL = lang === 'ar';
    const { formatPrice } = useCurrency();
    const currency = getLocalizedCurrency(generalSettings?.currency || 'YER', lang);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    // searchQuery is now handled via props from AdminDashboard
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [previewOrder, setPreviewOrder] = useState(null);
    const [printOrder, setPrintOrder] = useState(null);
    const [selectedOrdersIds, setSelectedOrdersIds] = useState([]);
    const [productCostMap, setProductCostMap] = useState({});
    const pendingSyncIdsRef = useRef(new Set());

    // Excel/PDF Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportMode, setExportMode] = useState('excel'); // 'excel' or 'pdf'
    const [exportPeriod, setExportPeriod] = useState('month');
    const [exportStatusFilter, setExportStatusFilter] = useState('all');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Reset page to 1 when filters change
const printPreviewInvoice = () => {
const source = document.getElementById('order-preview-invoice');
if (!source) return;
const printWindow = window.open('', '_blank', 'width=1000,height=900');
if (!printWindow) return alert(lang === 'ar' ? 'يرجى السماح بالنوافذ المنبثقة للطباعة' : 'Please allow popups for printing');
printWindow.document.write(`<!doctype html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><title>${txt.preview_invoice}</title><style>
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    body { font-family: Cairo, Arial, sans-serif; }
    .print-page { width: 210mm !important; height: 297mm !important; min-height: 297mm !important; margin: 0 !important; padding: 12mm 14mm !important; box-sizing: border-box !important; page-break-after: auto !important; break-after: auto !important; overflow: hidden !important; box-shadow: none !important; border-radius: 0 !important; }
    .print\:hidden, [data-html2canvas-ignore="true"] { display: none !important; }
    table { page-break-inside: auto; } tr { page-break-inside: avoid; }
    * { box-sizing: border-box; }
</style></head><body>${source.innerHTML}</body></html>`);
printWindow.document.close();
printWindow.focus();
printWindow.onload = () => printWindow.print();
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterStatus]);

    const openExcelModal = () => {
        setExportMode('excel');
        setShowExportModal(true);
    };

    const openPDFModal = () => {
        setExportMode('pdf');
        setShowExportModal(true);
    };

    const confirmExportExcel = () => {
        let filteredForExport = [...orders];

        // Filter by Status
        if (exportStatusFilter !== 'all') {
            filteredForExport = filteredForExport.filter(o => o.status === exportStatusFilter);
        }

        // Filter by Period
        const now = new Date();
        const getOrderDate = (order) => {
            if (order.createdAt?.seconds) return new Date(order.createdAt.seconds * 1000); // Firestore Timestamp check
            if (order.createdAt instanceof Date) return order.createdAt;
            if (typeof order.createdAt === 'string') return new Date(order.createdAt);
            return new Date(); // Fallback
        };

        if (exportPeriod === 'month') {
            filteredForExport = filteredForExport.filter(o => {
                const d = getOrderDate(o);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
        } else if (exportPeriod === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filteredForExport = filteredForExport.filter(o => getOrderDate(o) >= oneWeekAgo);
        }

        if (filteredForExport.length === 0) {
            alert(txt.alert_no_export);
            return;
        }

        // Sheet 1: Orders
        const ordersData = filteredForExport.map(o => ({
            [txt.th_order_id]: o.orderId || o.id,
            [txt.th_name]: o.formData?.name || '---',
            [txt.th_phone]: o.formData?.phone || '---',
            [txt.th_date]: o.formData?.address || '---',
            [txt.th_date]: o.formData?.city || o.formData?.governorate || '---',
            [txt.th_status]: getStatusLabel(o.status),
            [txt.th_date]: o.date || new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB'),
            [txt.th_price]: o.total !== undefined ? o.total : ((o.subTotal || 0) - (o.discount || 0) + (o.deliveryCost || 0)),
            [txt.th_payment]: o.formData?.paymentMethod === 'whatsapp' ? (lang === 'ar' ? 'واتساب' : 'WhatsApp') : (lang === 'ar' ? 'عند الاستلام' : 'COD')
        }));

        // Sheet 2: Products
        const productsData = [];
        filteredForExport.forEach(o => {
            if (o.cartItems && Array.isArray(o.cartItems)) {
                o.cartItems.forEach(item => {
                    productsData.push({
                        [txt.th_order_id]: o.orderId || o.id,
                        [lang === 'ar' ? 'اسم المنتج' : 'Product Name']: item.title,
                        [lang === 'ar' ? 'المقاس' : 'Size']: item.selectedSize || '-',
                        [lang === 'ar' ? 'السعر' : 'Price']: item.price,
                        [lang === 'ar' ? 'الكمية' : 'Quantity']: item.quantity,
                        [txt.total_footer]: (item.price || 0) * (item.quantity || 1)
                    });
                });
            }
        });

        const wb = XLSX.utils.book_new();

        // Make sheets right-to-left if possible (xlsx doesn't support RTL layout flag natively in basic write, but data is Arabic)
        const wsOrders = XLSX.utils.json_to_sheet(ordersData);
        XLSX.utils.book_append_sheet(wb, wsOrders, lang === 'ar' ? "الطلبات" : "Orders");

        const wsProducts = XLSX.utils.json_to_sheet(productsData);
        XLSX.utils.book_append_sheet(wb, wsProducts, lang === 'ar' ? "المنتجات المطلوبة" : "Ordered Products");

        // Generate filename
        const filename = `Milano_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);

        setShowExportModal(false);
    };

    const handleExportPDF = () => {
        // Use the SAME filtering logic as Excel export to respect the modal selections
        let ordersToExport = [...orders];

        // Filter by Status (from Modal State)
        if (exportStatusFilter !== 'all') {
            ordersToExport = ordersToExport.filter(o => o.status === exportStatusFilter);
        }

        // Filter by Period (from Modal State)
        const now = new Date();
        const getOrderDate = (order) => {
            if (order.createdAt?.seconds) return new Date(order.createdAt.seconds * 1000);
            if (order.createdAt instanceof Date) return order.createdAt;
            if (typeof order.createdAt === 'string') return new Date(order.createdAt);
            return new Date();
        };

        if (exportPeriod === 'month') {
            ordersToExport = ordersToExport.filter(o => {
                const d = getOrderDate(o);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
        } else if (exportPeriod === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            ordersToExport = ordersToExport.filter(o => getOrderDate(o) >= oneWeekAgo);
        }

        if (ordersToExport.length === 0) {
            alert(txt.alert_no_export);
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            alert(txt.alert_popup);
            return;
        }

        const doc = printWindow.document;
        doc.open();

        const calculateOrderNetProfit = (order) => {
            const items = order.cartItems || order.items || [];
            let totalCost = 0;
            let itemsSubtotal = 0;

            if (items.length > 0) {
                items.forEach(item => {
                    const qty = Number(item.quantity || item.qty || 1);
                    const sellPrice = Number(item.price || 0);
                    const costPrice = Number(item.costPrice !== undefined ? item.costPrice : (productCostMap[item.title || item.name] || 0));
                    itemsSubtotal += sellPrice * qty;
                    totalCost += costPrice * qty;
                });
            }

            let netProductsRevenue = 0;
            if (order.total !== undefined) {
                const deliveryCost = Number(order.deliveryCost || 0);
                netProductsRevenue = Number(order.total) - deliveryCost;
            } else {
                const subTotal = order.subTotal !== undefined ? Number(order.subTotal) : itemsSubtotal;
                const discount = Number(order.discount || 0);
                const discountPct = Number(order.discountPercentage || 0);
                const couponDisc = Math.round(subTotal * (discountPct / 100));
                netProductsRevenue = subTotal - discount - couponDisc;
            }

            return netProductsRevenue - totalCost;
        };

        const dateStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar-YE' : 'en-GB');
        const rowsHtml = ordersToExport.map((o, i) => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; text-align: center; font-weight: bold;">${i + 1}</td>
                <td style="padding: 8px; font-weight: bold;">${o.orderId || o.id}</td>
                <td style="padding: 8px;">${o.formData?.name || '---'}</td>
                <td style="padding: 8px;">${o.formData?.phone || '---'}</td>
                <td style="padding: 8px;">${getStatusLabel(o.status)}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold;">${formatPrice(o.total !== undefined ? o.total : ((o.subTotal || 0) - (o.discount || 0) + (o.deliveryCost || 0)), generalSettings?.currency || 'YER')}</td>
                <td style="padding: 8px; white-space: nowrap;">${o.date || '-'}</td>
            </tr>
        `).join('');

        const totalNetProfit = ordersToExport.reduce((acc, order) => {
            return acc + calculateOrderNetProfit(order);
        }, 0);

        doc.write(`
            <!DOCTYPE html>
            <html dir="${isRTL ? 'rtl' : 'ltr'}">
            <head>
                <title></title>
                <meta charset="UTF-8">
                <meta name="color-scheme" content="light">
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
                <style>
                    :root { color-scheme: light; }
                    html { background-color: #ffffff !important; filter: none !important; }
                    body { 
                        font-family: 'Cairo', sans-serif; 
                        background-color: #ffffff !important; 
                        color: #000000 !important; 
                        margin: 0; 
                        padding: 0; 
                        font-size: 11px;
                        min-height: 100vh;
                    }
                    .print-wrapper {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        padding: 15px;
                        min-height: 100vh;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th { 
                        background-color: #f8fafc !important; 
                        padding: 8px; 
                        text-align: ${isRTL ? 'right' : 'left'}; 
                        border-bottom: 2px solid #e2e8f0; 
                        font-weight: 800; 
                        color: #1e293b !important; 
                        font-size: 11px; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    tr { border-bottom: 1px solid #eee; background-color: #ffffff !important; }
                    td { color: #334155 !important; font-size: 11px; background-color: #ffffff !important; padding: 6px 8px; }
                    @media print {
                        @page { size: A4 landscape; margin: 10mm; } 
                        html, body, .print-wrapper {
                            background-color: #ffffff !important;
                            color: #000000 !important;
                        }
                        button { display: none !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                </style>
            </head>
            <body>
                <div class="print-wrapper">
                    <div style="display: flex; justify-content: space-between; items-align: center; margin-bottom: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">
                        <div>
                            <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 0;">${lang === 'ar' ? 'تقرير المبيعات والطلبات' : 'Orders & Sales Report'}</h1>
                            <p style="color: #64748b; margin-top: 5px;">${lang === 'ar' ? 'تاريخ الاستخراج:' : 'Date:'} ${dateStr}</p>
                        </div>
                        <div style="text-align: left;">
                            <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">${txt.print_report_btn}</button>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="text-align: center;">#</th>
                                <th>${txt.th_order_id}</th>
                                <th>${txt.th_name}</th>
                                <th>${txt.th_phone}</th>
                                <th>${txt.th_status}</th>
                                <th style="text-align: center;">${txt.total_footer}</th>
                                <th>${txt.th_date}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div style="display: grid; grid-template-columns: 1fr 1.5fr 1.5fr; gap: 15px; margin-top: 25px; page-break-inside: avoid; max-width: 700px;">
                        <div style="background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">
                            <div style="color: #64748b; font-size: 11px; font-weight: bold;">${lang === 'ar' ? 'عدد الطلبات' : 'Total Orders'}</div>
                            <div style="color: #0f172a; font-size: 20px; font-weight: 900;">${ordersToExport.length}</div>
                        </div>
                        <div style="background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">
                            <div style="color: #64748b; font-size: 11px; font-weight: bold;">${lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</div>
                            <div style="color: #16a34a; font-size: 20px; font-weight: 900;">
                                ${ordersToExport.length > 1 ? ordersToExport.reduce((acc, curr) => acc + (curr.total !== undefined ? curr.total : ((curr.subTotal || 0) - (curr.discount || 0) + (curr.deliveryCost || 0))), 0).toLocaleString() + ' ' + (generalSettings?.currency || 'YER') : formatPrice(ordersToExport[0]?.total !== undefined ? ordersToExport[0]?.total : ((ordersToExport[0]?.subTotal || 0) - (ordersToExport[0]?.discount || 0) + (ordersToExport[0]?.deliveryCost || 0)), generalSettings?.currency || 'YER')}
                            </div>
                        </div>
                        <div style="background: #eff6ff; padding: 12px; border-radius: 10px; border: 1px solid #dbeafe;">
                            <div style="color: #1e40af; font-size: 11px; font-weight: bold;">${lang === 'ar' ? 'صافي الربح' : 'Net Profit'}</div>
                            <div style="color: #2563eb; font-size: 20px; font-weight: 900;">
                                ${totalNetProfit.toLocaleString()} ${generalSettings?.currency || 'YER'}
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
        doc.close();
    };

    // NEW SAFE PRINT METHOD (CDN + Button)
    const handleSafePrint = () => {
        const content = document.getElementById('printable-invoices');
        if (!content) {
            alert(txt.alert_print_error);
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            alert(txt.alert_popup);
            return;
        }

        const doc = printWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html dir="${isRTL ? 'rtl' : 'ltr'}">
            <head>
                <title>${txt.print_invoices} - ${lang === 'ar' ? 'متجر ميلانو' : 'Milano Store'}</title>
                <meta charset="UTF-8">
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Cairo', sans-serif; background-color: #f3f4f6; }
                    
                    @media print {
                        body { background-color: white; margin: 0; padding: 0; }
                        .no-print { display: none !important; }
                        .print-page { 
                            width: 100% !important; 
                            max-width: 210mm !important; 
                            margin: 0 !important; 
                            page-break-after: always;
                            box-shadow: none !important;
                            border: none !important;
                            break-inside: avoid;
                        }
                        * { color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        .text-white { color: white !important; } 
                    }
                    
                    .print-page {
                        background: white;
                        margin: 20px auto;
                        padding: 20px;
                        max-width: 210mm;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                        border-radius: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="no-print fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg z-50 flex justify-between items-center px-8" dir="${isRTL ? 'rtl' : 'ltr'}">
                    <div class="flex items-center gap-4">
                        <span class="font-bold text-lg">${txt.preview_invoice}</span>
                        <span class="text-sm text-gray-400 hidden md:inline">${txt.preview_note}</span>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="window.close()" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition">${txt.close}</button>
                        <button onclick="window.print()" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition flex items-center gap-2">
                            <span style="font-size: 20px">🖨️</span>
                            ${txt.print}
                        </button>
                    </div>
                </div>
                <div class="h-24 no-print"></div>
                <div id="invoice-content" dir="${isRTL ? 'rtl' : 'ltr'}">
                    ${content.innerHTML}
                </div>
            </body>
            </html>
        `);
        doc.close();
    };

    // Manual Printing Logic (New Window Method for Maximum Reliability)
    const handlePrint = () => {
        const content = document.getElementById('printable-invoices');
        if (!content) {
            alert(txt.alert_print_error);
            return;
        }

        // Open a new window
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) {
            alert(txt.alert_popup);
            return;
        }

        const doc = printWindow.document;
        doc.open();
        doc.write(`<html dir="${isRTL ? 'rtl' : 'ltr'}"><head><title>${txt.print_invoices} - ${lang === 'ar' ? 'متجر ميلانو' : 'Milano Store'}</title>`);

        // standard link copying
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach(node => {
            if (node.tagName === 'LINK' && node.rel === 'stylesheet' && node.href) {
                // Convert to absolute URL
                const absoluteUrl = new URL(node.getAttribute('href'), generalSettings?.storeUrl || window.location.origin).href;
                doc.write(`<link rel="stylesheet" type="text/css" href="${absoluteUrl}" />`);
            } else if (node.tagName === 'STYLE') {
                doc.write(node.outerHTML);
            }
        });

        // Add essential print overrides
        doc.write(`
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
                
                @media print {
                    @page { size: A4; margin: 0; }
                    html, body {
                        height: auto !important;
                        min-height: 100%;
                        overflow: visible !important;
                        background-color: white !important;
                        display: block !important;
                    }
                    * { 
                       -webkit-print-color-adjust: exact !important; 
                       print-color-adjust: exact !important;
                       color: #000 !important; 
                       visibility: visible !important;
                    }
                    .text-blue-600 { color: #2563eb !important; }
                    .text-green-600 { color: #16a34a !important; }
                    .bg-gray-50 { background-color: #f9fafb !important; }
                    
                    .print-page { 
                        width: 100% !important;
                        max-width: 210mm !important; 
                        margin: 0 auto !important;
                        page-break-after: always;
                        display: block !important;
                    }
                    button, input, .no-print { display: none !important; }
                }
                
                @media screen {
                   body { background: #f0f0f0; padding: 20px; font-family: 'Cairo', sans-serif; }
                   .print-page { background: white; padding: 20mm; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 20px auto; width: 210mm; min-height: 297mm; direction: rtl; }
                }
            </style>
        `);

        doc.write('</head><body style="background-color: #f3f4f6;">'); // Light gray bg for preview distinction
        doc.write(content.innerHTML);
        doc.write('</body></html>');
        doc.close();

        // Wait for resources then print
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 1000);
        };
    };

    const handlePrintSingleInvoice = (order) => {
        const printWindow = window.open('', '_blank', 'width=1000,height=900');
        if (!printWindow) {
            alert(txt.alert_popup);
            return;
        }
        setPrintOrder(order);
        window.setTimeout(() => {
            const content = document.getElementById('printable-single-invoice');
            if (!content) {
                printWindow.close();
                alert(txt.alert_print_error);
                return;
            }
            // Copy the app styles as well as the invoice markup. Without them, the
            // popup contains the right HTML but loses the exact InvoiceTemplate design.
            const copiedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
                .map((node) => node.tagName === 'LINK'
                    ? `<link rel="stylesheet" href="${new URL(node.getAttribute('href'), window.location.href).href}">`
                    : node.outerHTML)
                .join('');
            printWindow.document.write(`<!doctype html><html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><title>${txt.print_invoices}</title>
                ${copiedStyles}
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4 portrait; margin: 0; }
                    html, body { margin: 0 !important; padding: 0 !important; background: #f3f4f6 !important; }
                    body { font-family: 'Cairo', Arial, sans-serif; }
                    .print-toolbar {
                        position: sticky; top: 0; z-index: 20; display: flex; justify-content: center;
                        padding: 16px; background: rgba(255,255,255,.96); box-shadow: 0 2px 12px rgba(15,23,42,.10);
                    }
                    .print-button {
                        border: 0; border-radius: 10px; background: #2563eb; color: #fff; padding: 11px 28px;
                        font: 700 15px Cairo, Arial, sans-serif; cursor: pointer; box-shadow: 0 6px 14px rgba(37,99,235,.25);
                    }
                    .print-button:hover { background: #1d4ed8; }
                    .print-container { width: 100% !important; padding: 28px 0 40px; }
                    .print-page {
                        width: 210mm !important;
                        min-height: 240mm !important;
                        height: auto !important;
                        margin: 0 auto !important;
                        padding: 20px 40px !important;
                        page-break-after: avoid !important;
                        break-after: avoid-page !important;
                        page-break-inside: avoid !important;
                        background: #fff !important;
                        box-shadow: 0 10px 30px rgba(15,23,42,.18) !important;
                        border: 1px solid #e5e7eb !important;
                        border-radius: 30px !important;
                        overflow: hidden !important;
                    }
                    .print\:hidden, [data-html2canvas-ignore="true"] { display: none !important; }
                    table, tr { page-break-inside: avoid !important; }
                    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    @media print {
                        html, body { background: #fff !important; }
                        .print-toolbar { display: none !important; }
                        .print-container { padding: 0 !important; }
                        .print-page {
                            box-shadow: none !important; border: 0 !important; border-radius: 0 !important;
                            margin: 0 !important; width: 210mm !important; min-height: 240mm !important;
                        }
                    }
                </style></head><body>
                <div class="print-toolbar no-print">
                    <button class="print-button" onclick="window.print()">🖨️ ${lang === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'}</button>
                </div>
                <div class="invoice-preview">${content.innerHTML}</div>
                </body></html>`);
            printWindow.document.close();
            printWindow.focus();
            // Keep the preview open so the user can review it and press the blue print button.
            setPrintOrder(null);
        }, 80);
    };

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const snap = await getDocs(collection(db, "products"));
                const mapping = {};
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.name) mapping[data.name] = Number(data.costPrice || 0);
                });
                setProductCostMap(mapping);
            } catch (err) {
                console.error("Error fetching products for cost map:", err);
            }
        };
        fetchProducts();

        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            })).sort((a, b) => {
                const getTime = (val) => {
                    if (!val) return 0;
                    if (typeof val.toMillis === 'function') return val.toMillis();
                    if (val instanceof Date) return val.getTime();
                    if (typeof val === 'string') return new Date(val).getTime() || 0;
                    if (val.seconds) return val.seconds * 1000;
                    return 0;
                };
                return getTime(b.createdAt) - getTime(a.createdAt);
            });
            setOrders(fetchedOrders);
            setLoading(false);
            fetchedOrders.filter(order => order.inventorySyncPending).forEach(order => {
                if (pendingSyncIdsRef.current.has(order.id)) return;
                pendingSyncIdsRef.current.add(order.id);
                reconcilePendingCustomerOrder(order.id)
                    .catch(error => console.error('Pending customer order reconciliation failed:', order.id, error))
                    .finally(() => pendingSyncIdsRef.current.delete(order.id));
            });
        });

    return () => unsubscribe();
    }, []);

    // Filter Logic
    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.formData?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.formData?.phone?.includes(searchQuery);

        const matchesStatus = filterStatus === 'all' || order.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Selection Logic
    const toggleSelectAll = () => {
        // Check if all orders on the CURRENT page are selected
        const allCurrentSelected = currentOrders.every(o => selectedOrdersIds.includes(o.id));

        if (allCurrentSelected) {
            // Deselect only the orders on the current page
            setSelectedOrdersIds(prev => prev.filter(id => !currentOrders.find(o => o.id === id)));
        } else {
            // Select all orders on the current page (keeping existing selections from other pages)
            const newIds = currentOrders.map(o => o.id);
            const combinedIds = Array.from(new Set([...selectedOrdersIds, ...newIds]));
            setSelectedOrdersIds(combinedIds);
        }
    };

    const toggleSelectOrder = (id) => {
        if (selectedOrdersIds.includes(id)) {
            setSelectedOrdersIds(selectedOrdersIds.filter(selectedId => selectedId !== id));
        } else {
            setSelectedOrdersIds([...selectedOrdersIds, id]);
        }
    };

    // Bulk Actions
    const [bulkStatus, setBulkStatus] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Bulk Actions
    const openBulkStatusModal = () => {
        if (!bulkStatus) return;
        setShowConfirmModal(true);
    };

    const confirmBulkStatusUpdate = async () => {
        // Filter out cancelled orders from the update
        const ordersToUpdate = orders
            .filter(o => selectedOrdersIds.includes(o.id) && o.status !== 'cancelled');

        if (ordersToUpdate.length === 0) {
            alert(txt.alert_no_update);
            setShowConfirmModal(false);
            return;
        }

        try {
            await Promise.all(ordersToUpdate.map(async order => {
                const orderRef = doc(db, "orders", order.id);
                await updateDoc(orderRef, { status: bulkStatus });
                await syncWalletRewardForOrderStatus(order.id, bulkStatus);
            }));
            setSelectedOrdersIds([]);
            setBulkStatus('');
            setShowConfirmModal(false);
            // Optional: Success toast
        } catch (error) {
            console.error("Error bulk updating:", error);
            alert(txt.alert_update_error);
        }
    };

    // Deleting an invoice must also reverse any completion reward first, so a
    // customer cannot retain a wallet credit from an invoice that no longer exists.
    const removeOrderPermanently = async (orderId) => {
        await reverseWalletRewardForOrder(orderId);
        await deleteDoc(doc(db, 'orders', orderId));
    };

    const confirmBulkDelete = async () => {
        const orderIds = [...new Set(selectedOrdersIds)].filter(Boolean);
        if (orderIds.length === 0) {
            setShowBulkDeleteConfirm(false);
            return;
        }

        setIsBulkDeleting(true);
        try {
            const results = await Promise.allSettled(orderIds.map(removeOrderPermanently));
            const failedIds = orderIds.filter((_, index) => results[index].status === 'rejected');

            if (selectedOrder && !failedIds.includes(selectedOrder.id)) setSelectedOrder(null);
            setSelectedOrdersIds(failedIds);
            setBulkStatus('');
            setShowBulkDeleteConfirm(false);

            if (failedIds.length > 0) {
                console.error('Bulk order deletion failures:', results.filter(result => result.status === 'rejected'));
                alert(txt.bulk_delete_error);
            }
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const updateStatus = async (orderId, newStatus) => {
        try {
            const orderRef = doc(db, "orders", orderId);
            await updateDoc(orderRef, { status: newStatus });
            await syncWalletRewardForOrderStatus(orderId, newStatus);
        } catch (error) {
            console.error("Error updating status:", error);
            alert(txt.alert_status_update_error);
        }
    };

    const deleteOrder = async (orderId) => {
        if (!window.confirm(txt.alert_delete)) return;
        try {
            await removeOrderPermanently(orderId);
            if (selectedOrder?.id === orderId) setSelectedOrder(null);
            if (selectedOrdersIds.includes(orderId)) {
                setSelectedOrdersIds(selectedOrdersIds.filter(id => id !== orderId));
            }
        } catch (error) {
            console.error("Error deleting order:", error);
            alert(txt.alert_delete_error);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-yellow-50 text-yellow-600 border-yellow-200 ring-1 ring-yellow-100'; // Light Yellow
            case 'processing': return 'bg-indigo-50 text-indigo-600 border-indigo-200 ring-1 ring-indigo-100'; // Light Purple
            case 'shipping': return 'bg-purple-50 text-purple-600 border-purple-200 ring-1 ring-purple-100'; // Light Pink/Purple for Shipping
            case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-1 ring-emerald-100'; // Light Green
            case 'cancelled': return 'bg-red-50 text-red-600 border-red-200 ring-1 ring-red-100'; // Light Red
            default: return 'bg-gray-50 text-gray-600 border-gray-200';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'new': return txt.status_new;
            case 'processing': return txt.status_processing;
            case 'shipping': return txt.status_shipping;
            case 'completed': return txt.status_completed;
            case 'cancelled': return txt.status_cancelled;
            default: return status;
        }
    };

    const calculateOrderNetProfit = (order) => {
        const items = order.cartItems || order.items || [];
        let totalCost = 0;
        let itemsSubtotal = 0;

        if (items.length > 0) {
            items.forEach(item => {
                const qty = Number(item.quantity || item.qty || 1);
                const sellPrice = Number(item.price || 0);
                const costPrice = Number(item.costPrice !== undefined ? item.costPrice : (productCostMap[item.title || item.name] || 0));
                itemsSubtotal += sellPrice * qty;
                totalCost += costPrice * qty;
            });
        }

        let netProductsRevenue = 0;
        if (order.total !== undefined) {
            const deliveryCost = Number(order.deliveryCost || 0);
            netProductsRevenue = Number(order.total) - deliveryCost;
        } else {
            const subTotal = order.subTotal !== undefined ? Number(order.subTotal) : itemsSubtotal;
            const discount = Number(order.discount || 0);
            const discountPct = Number(order.discountPercentage || 0);
            const couponDisc = Math.round(subTotal * (discountPct / 100));
            netProductsRevenue = subTotal - discount - couponDisc;
        }

        return netProductsRevenue - totalCost;
    };

    // Calculate details for modal
    const validOrdersCount = orders.filter(o => selectedOrdersIds.includes(o.id) && o.status !== 'cancelled').length;

    // Pagination Logic
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const currentOrders = filteredOrders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    // Match the receipt-history convention: append the size only when the
    // purchased item actually has one, while keeping all invoice products in
    // a single line inside the orders list.
    const getOrderProductsLabel = (order) => {
        const items = Array.isArray(order?.cartItems)
            ? order.cartItems
            : (Array.isArray(order?.items) ? order.items : []);
        const label = items.map(item => {
            const productName = item?.title || item?.name || item?.productName || '';
            const size = item?.selectedSize || item?.size || '';
            return productName ? `${productName}${size ? ` / ${size}` : ''}` : '';
        }).filter(Boolean).join(' • ');
        return label || '---';
    };

    const ordersToPrint = selectedOrdersIds.length > 0
        ? orders.filter(o => selectedOrdersIds.includes(o.id))
        : filteredOrders;

    const totalSales = filteredOrders.reduce((sum, order) => {
        if (order.status !== 'completed') return sum;
        return sum + (order.total !== undefined ? order.total : ((order.subTotal || 0) - (order.discount || 0) + (order.deliveryCost || 0)));
    }, 0);
    const totalProfit = filteredOrders.reduce((acc, order) => {
        if (order.status !== 'completed') return acc;
        return acc + calculateOrderNetProfit(order);
    }, 0);

    return (
        <div className="-mt-1 space-y-4 font-['Cairo'] relative" dir={isRTL ? "rtl" : "ltr"}>
            {/* Hidden Printable Component - Wrapped in Ref Div */}
            <div style={{ position: 'fixed', left: '-10000px', top: 0 }}>
                <div id="printable-invoices">
                    <InvoiceTemplate orders={ordersToPrint} lang={lang} generalSettings={generalSettings} />
                </div>
            </div>
            {printOrder && (
                <div style={{ position: 'fixed', left: '-10000px', top: 0 }}>
                    <div id="printable-single-invoice">
                        <InvoiceTemplate orders={[printOrder]} lang={lang} generalSettings={generalSettings} hideHeader={true} />
                    </div>
                </div>
            )}

            {/* Actions Bar */}

            {/* Export Modal */}
            <AnimatePresence>
                {showExportModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-black text-xl text-gray-800">
                                    {exportMode === 'excel' ? txt.export_excel_title : txt.export_pdf_title}
                                </h3>
                                <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-red-500 transition">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600 block">{txt.export_period}</label>
                                        <div className="relative">
                                            <select
                                                value={exportPeriod}
                                                onChange={(e) => setExportPeriod(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                            >
                                                <option value="month">{txt.export_period_month}</option>
                                                <option value="week">{txt.export_period_week}</option>
                                                <option value="all">{txt.export_period_all}</option>
                                            </select>
                                            <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600 block">{txt.export_status}</label>
                                        <div className="relative">
                                            <select
                                                value={exportStatusFilter}
                                                onChange={(e) => setExportStatusFilter(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                            >
                                                <option value="all">{txt.export_status_all}</option>
                                                <option value="new">{txt.status_new}</option>
                                                <option value="processing">{txt.status_processing}</option>
                                                <option value="shipping">{txt.status_shipping}</option>
                                                <option value="completed">{txt.status_completed}</option>
                                                <option value="cancelled">{txt.status_cancelled}</option>
                                            </select>
                                            <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                        {txt.export_note}
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                                {exportMode === 'excel' ? (
                                    <button
                                        onClick={confirmExportExcel}
                                        className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-500/20 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <FileDown size={20} />
                                        <span>{txt.export_excel}</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleExportPDF}
                                        className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition shadow-lg shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Printer size={20} />
                                        <span>{txt.print} PDF</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="flex-1 bg-white text-gray-700 font-bold py-3 rounded-xl border border-gray-200 hover:bg-gray-100 transition active:scale-95"
                                >
                                    {txt.cancel_btn}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm md:flex-row md:px-5">
                <div className="relative w-full md:w-[420px]">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
                    <input
                        type="text"
                        placeholder={txt.search_placeholder}
                        className={`h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-4 pr-12 text-sm font-bold outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${isRTL ? 'text-right' : 'text-left'}`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex w-full gap-2 md:w-auto">
                    <button
                        onClick={openPDFModal}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600 md:flex-none"
                    >
                        <Printer size={20} />
                        <span>{txt.invoice_pdf}</span>
                    </button>
                    <button
                        onClick={openExcelModal} // Opens modal for now, or could change to direct excel if needed
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-green-500/20 transition hover:bg-green-700 md:flex-none"
                    >
                        <FileDown size={20} />
                        <span>{txt.export_excel}</span>
                    </button>
                </div>
            </div>

            {/* Header Stats */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 lg:gap-4">
                {[
                    { label: txt.stat_all, value: orders.length, color: 'border-blue-500 text-blue-600', filter: 'all' },
                    { label: txt.stat_new, value: orders.filter(o => o.status === 'new').length, color: 'border-yellow-500 text-yellow-600', filter: 'new' },
                    { label: txt.stat_processing, value: orders.filter(o => o.status === 'processing').length, color: 'border-purple-500 text-purple-600', filter: 'processing' },
                    { label: txt.stat_shipping, value: orders.filter(o => o.status === 'shipping').length, color: 'border-indigo-500 text-indigo-600', filter: 'shipping' },
                    { label: txt.stat_completed, value: orders.filter(o => o.status === 'completed').length, color: 'border-green-500 text-green-600', filter: 'completed' },
                    { label: txt.stat_cancelled, value: orders.filter(o => o.status === 'cancelled').length, color: 'border-red-500 text-red-600', filter: 'cancelled' },
                ].map((stat, idx) => (
                    <button
                        key={idx}
                        onClick={() => setFilterStatus(stat.filter)}
                        className={`rounded-2xl border-b-4 bg-white px-3 py-2.5 shadow-sm transition-all hover:shadow-md md:px-3.5 md:py-3 ${stat.color} ${filterStatus === stat.filter ? 'bg-gray-50 ring-2 ring-blue-500/10' : 'opacity-80 hover:opacity-100'}`}
                    >
                        <div className="text-xl md:text-2xl font-black mb-1">{stat.value}</div>
                        <div className="text-[10px] md:text-xs font-bold">{stat.label}</div>
                    </button>
                ))}
            </div>

            {/* Table Layout */}
            <div className={`bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 lg:-mx-6 ${selectedOrdersIds.length > 0 ? 'pb-24' : ''}`}>
                <div className="overflow-x-auto relative">
                    <table className="w-full min-w-[1040px] table-fixed border-collapse text-[13px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold text-xs">
                                <th className="w-11 p-2 text-center">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={currentOrders.length > 0 && currentOrders.every(o => selectedOrdersIds.includes(o.id))}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="w-[120px] whitespace-nowrap p-2 text-center">{txt.th_order_id}</th>
                                <th className={`w-[105px] whitespace-nowrap p-2 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.th_name}</th>
                                <th className={`w-[155px] whitespace-nowrap p-2 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.th_product_size}</th>
                                <th className={`w-[105px] whitespace-nowrap p-2 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.th_price}</th>
                                <th className="w-[96px] whitespace-nowrap p-2 text-center">{txt.th_status}</th>
                                <th className="w-16 whitespace-nowrap p-2 text-center">{txt.th_payment}</th>
                                <th className="w-[112px] whitespace-nowrap p-2 text-center">{txt.th_phone}</th>
                                <th className="w-[90px] whitespace-nowrap p-2 text-center">{txt.th_date}</th>
                                <th className="w-[122px] whitespace-nowrap p-2 text-center">{txt.th_details}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-20 text-gray-400">{txt.loading}</td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-20 text-gray-400 font-bold">{txt.no_orders}</td>
                                </tr>
                            ) : (
                                currentOrders.map((order) => (
                                    <tr key={order.id} className={`hover:bg-blue-50/50 transition-colors group ${selectedOrdersIds.includes(order.id) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="p-2 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={selectedOrdersIds.includes(order.id)}
                                                onChange={() => toggleSelectOrder(order.id)}
                                            />
                                        </td>
                                        <td className="p-1 text-center">
                                            <button
                                                onClick={() => onViewOrder && onViewOrder(order)}
                                                className="whitespace-nowrap rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 font-mono text-[11px] font-bold text-blue-600 transition-all hover:scale-105 hover:bg-white hover:shadow-sm active:scale-95"
                                            >
                                                {order.orderId}
                                            </button>
                                        </td>
                                        <td className="p-2 font-bold text-gray-700 whitespace-nowrap">
                                            {order.formData?.name || 'زائر'}
                                        </td>
                                        <td className={`py-2 ${isRTL ? 'pr-0 pl-2 text-right' : 'pl-0 pr-2 text-left'}`}>
                                            <div title={getOrderProductsLabel(order)} className={`truncate whitespace-nowrap font-bold text-gray-700 ${isRTL ? 'translate-x-2' : '-translate-x-2'}`}>
                                                {getOrderProductsLabel(order)}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <div className="flex flex-col items-start gap-0.5 whitespace-nowrap font-black text-gray-800">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs md:text-sm">
                                                        {formatPrice(order.subTotal ? (order.subTotal - (order.discount || 0) + (order.deliveryCost || 0)) : order.total, generalSettings?.currency || 'YER')}
                                                    </span>
                                                </div>
                                                {order.deliveryCost > 0 && <span className="text-[9px] text-gray-400 font-normal">{lang === 'ar' ? 'شامل التوصيل' : 'Inc. Delivery'}</span>}
                                            </div>
                                        </td>
                                        <td className="p-1.5 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold border rounded-full ${getStatusColor(order.status)}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(order.status).replace('bg-', 'bg-current-').replace('text-', 'bg-').split(' ')[1]}`}></span>
                                                {getStatusLabel(order.status)}
                                            </span>
                                        </td>
                                        <td className="p-1.5">
                                            <div className="flex justify-center">
                                                <div title={order.formData?.paymentMethod === 'whatsapp' ? "WhatsApp" : "الدفع عند الاستلام"}>
                                                    <img src="/cash-on-delivery.png" alt="توصيل الطلبات" className="w-10 object-contain" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-1.5 text-center">
                                            <div className="mx-auto flex w-fit items-center justify-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                                                <span className="font-mono text-[11px] font-bold text-gray-600" dir="ltr">{order.formData?.phone}</span>
                                                <Phone size={12} className="text-gray-400" />
                                            </div>
                                        </td>
                                        <td className="p-1.5 text-center">
                                            <div className="flex flex-col items-center justify-center gap-0.5 whitespace-nowrap">
                                                <span className="text-[10px] font-bold text-gray-600 font-mono">
                                                    {(() => {
                                                        const locale = lang === 'ar' ? 'ar-YE' : 'en-GB';
                                                        if (order.createdAt && typeof order.createdAt.toDate === 'function') {
                                                            return order.createdAt.toDate().toLocaleDateString(locale);
                                                        } else if (typeof order.createdAt === 'string') {
                                                            return new Date(order.createdAt).toLocaleDateString(locale);
                                                        }
                                                        return order.date;
                                                    })()}
                                                </span>
                                                <span className="text-[9px] text-gray-400 font-mono">
                                                    {(() => {
                                                        const locale = lang === 'ar' ? 'ar-YE' : 'en-GB';
                                                        if (order.createdAt && typeof order.createdAt.toDate === 'function') {
                                                            return order.createdAt.toDate().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                                                        } else if (typeof order.createdAt === 'string') {
                                                            return new Date(order.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                                                        }
                                                        return '';
                                                    })()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-1 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handlePrintSingleInvoice(order)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 shadow-sm transition-all hover:bg-gray-200 active:scale-95"
                                                    title={lang === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'}
                                                >
                                                    <Printer size={17} />
                                                </button>
                                                <button
                                                    onClick={() => onViewOrder && onViewOrder(order, true)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
                                                    title={lang === 'ar' ? 'تعديل الطلب' : 'Edit Order'}
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => deleteOrder(order.id)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white shadow-md shadow-red-500/20 transition-all hover:bg-red-600 active:scale-95"
                                                    title={lang === 'ar' ? 'حذف الطلب' : 'Delete Order'}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-100 font-bold">
                            <tr>
                                <td colSpan="3" className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'} font-black text-gray-400 uppercase italic`}>
                                    {txt.total_footer}
                                </td>
                                <td colSpan="4" className="px-6 py-3 font-black">
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-6">
                                        <div className="flex items-center gap-1.5 text-green-600">
                                            <span className="text-sm md:text-sm">{totalSales.toLocaleString()}</span>
                                            <span className="text-[10px] md:text-[11px] whitespace-nowrap opacity-80">{currency}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-blue-600 border-t md:border-t-0 md:border-r border-gray-200 mt-1.5 pt-1.5 md:mt-0 md:pt-0 md:pr-6">
                                            <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">{lang === 'ar' ? 'صافي الربح:' : 'Profit:'}</span>
                                            <span className="text-sm md:text-sm">{totalProfit.toLocaleString()}</span>
                                            <span className="text-[10px] md:text-[11px] whitespace-nowrap opacity-80">{currency}</span>
                                        </div>
                                    </div>
                                </td>
                                <td colSpan="3" className="px-6 py-2 text-left">
                                    {totalPages > 1 ? (
                                        <div className="flex items-center justify-start gap-2" dir="ltr">
                                            <button
                                                onClick={() => paginate(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronDown className="rotate-90" size={16} />
                                            </button>
                                            {[...Array(totalPages)].map((_, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => paginate(index + 1)}
                                                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${currentPage === index + 1
                                                        ? 'bg-blue-600 text-white shadow-md'
                                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {index + 1}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => paginate(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronDown className="-rotate-90" size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="font-black text-blue-600 text-lg italic block py-2">{filteredOrders.length} {txt.orders_count}</span>
                                    )}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

            </div>

            {/* Floating Bulk Actions Bar */}
            <AnimatePresence>
                {selectedOrdersIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-4 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto bg-gray-900 text-white p-2 md:px-6 md:py-3 rounded-2xl md:rounded-full shadow-2xl z-50 flex flex-col md:flex-row items-center gap-3 md:gap-6 border border-gray-700"
                    >
                        <div className="flex items-center justify-between w-full md:w-auto gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                                    {selectedOrdersIds.length}
                                </div>
                                <span className="font-bold text-sm">{txt.selected}</span>
                            </div>
                            <button onClick={() => setSelectedOrdersIds([])} className="text-gray-400 hover:text-white md:hidden">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                            {/* Status Selector */}
                            <div className="relative min-w-[140px]">
                                <select
                                    value={bulkStatus}
                                    onChange={(e) => setBulkStatus(e.target.value)}
                                    className="w-full appearance-none bg-gray-800 text-white text-sm font-bold border border-gray-700 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="">{txt.select_status}</option>
                                    <option value="new">{txt.status_new}</option>
                                    <option value="processing">{txt.status_processing}</option>
                                    <option value="shipping">{txt.status_shipping}</option>
                                    <option value="completed">{txt.status_completed}</option>
                                    <option value="cancelled">{txt.status_cancelled}</option>
                                </select>
                                <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                            </div>

                            {/* Change Button */}
                            <button
                                onClick={openBulkStatusModal}
                                disabled={!bulkStatus}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${bulkStatus
                                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                <RefreshCw size={14} />
                                <span>{txt.change_status}</span>
                            </button>

                            <div className="w-px h-6 bg-gray-700 mx-1 hidden md:block"></div>

                            {/* Print Button */}
                            <button
                                onClick={handleSafePrint}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors font-bold text-sm shadow-lg shadow-blue-500/20 whitespace-nowrap"
                            >
                                <Printer size={14} />
                                <span>{txt.print_invoices}</span>
                            </button>

                            <button
                                onClick={() => setShowBulkDeleteConfirm(true)}
                                disabled={isBulkDeleting}
                                title={txt.delete_selected}
                                aria-label={txt.delete_selected}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-400/45 bg-rose-500/15 text-rose-200 transition-colors hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Trash2 size={15} className={isBulkDeleting ? 'animate-pulse' : ''} />
                            </button>

                            <button onClick={() => setSelectedOrdersIds([])} className="text-gray-400 hover:text-white hidden md:block mr-2">
                                <X size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirmModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
                        >
                            <div className="p-8 text-center">
                                <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-500 border-4 border-yellow-100">
                                    <AlertTriangle size={40} />
                                </div>
                                <h3 className="text-2xl font-black text-gray-800 mb-2">{txt.confirm_modal_title}</h3>
                                <p className="text-gray-500 mb-6 leading-relaxed">
                                    {txt.confirm_modal_desc.replace('{count}', validOrdersCount).replace('{status}', getStatusLabel(bulkStatus))}
                                    <br />
                                    <span className="text-xs text-red-500 mt-2 block">{txt.confirm_modal_note}</span>
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={confirmBulkStatusUpdate}
                                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/30 flex-1"
                                    >
                                        {txt.confirm_btn}
                                    </button>
                                    <button
                                        onClick={() => setShowConfirmModal(false)}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold flex-1"
                                    >
                                        {txt.cancel_btn}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Permanent deletion confirmation for invoices selected in the toolbar */}
            <AnimatePresence>
                {showBulkDeleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.94, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.94, opacity: 0 }}
                            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
                            dir={isRTL ? 'rtl' : 'ltr'}
                        >
                            <div className="p-7 text-center">
                                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-4 border-rose-100 bg-rose-50 text-rose-500">
                                    <Trash2 size={30} />
                                </div>
                                <h3 className="mb-3 text-xl font-black text-gray-900">{txt.bulk_delete_title}</h3>
                                <p className="mb-6 text-sm font-bold leading-6 text-gray-500">
                                    {txt.bulk_delete_desc.replace('{count}', selectedOrdersIds.length)}
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={confirmBulkDelete}
                                        disabled={isBulkDeleting}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-rose-500/25 transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Trash2 size={16} />
                                        {isBulkDeleting ? (lang === 'ar' ? 'جارٍ الحذف...' : 'Deleting...') : txt.bulk_delete_confirm}
                                    </button>
                                    <button
                                        onClick={() => setShowBulkDeleteConfirm(false)}
                                        disabled={isBulkDeleting}
                                        className="flex-1 rounded-xl bg-gray-100 px-5 py-3 text-sm font-black text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {txt.cancel_btn}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invoice Preview opened by the eye button */}
            <AnimatePresence>
                {previewOrder && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 shrink-0">
                                <h3 className="font-black text-gray-800">{txt.preview_invoice} — {previewOrder.orderId}</h3>
                                <div className="flex items-center gap-2">
                                    <button onClick={printPreviewInvoice} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center gap-2"><Printer size={16} />{txt.print}</button>
                                    <button onClick={() => setPreviewOrder(null)} className="p-2 rounded-xl hover:bg-gray-200 text-gray-500" title={txt.close}><X size={20} /></button>
                                </div>
                            </div>
                            <div id="order-preview-invoice" className="overflow-y-auto p-4 md:p-8"><SafeInvoicePreview order={previewOrder} lang={lang} generalSettings={generalSettings} /></div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Order Details Panel (Overlay) */}
            <AnimatePresence>
                {selectedOrder && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedOrder(null)}
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ opacity: 0, x: -100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            className="fixed left-0 top-0 h-full w-full max-w-[450px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col border-r border-gray-100"
                        >
                            {/* Panel Header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                                <div>
                                    <h3 className="font-black text-gray-800 text-lg">{txt.order_details_title}</h3>
                                    <p className="text-xs text-gray-500 font-mono">{selectedOrder.orderId}</p>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-200 rounded-full lg:hidden">
                                    <XCircle size={24} className="text-gray-500" />
                                </button>
                                <div className="flex gap-2 hidden lg:flex">
                                    <button className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><Printer size={20} /></button>
                                    <button onClick={() => deleteOrder(selectedOrder.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={20} /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Status Control */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 block">{txt.update_status_label}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['new', 'processing', 'shipping', 'completed', 'cancelled'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => updateStatus(selectedOrder.id, status)}
                                                className={`px-2 py-2 text-xs font-bold rounded-lg transition-all ${getStatusColor(status)} ${selectedOrder.status === status
                                                    ? 'ring-2 ring-offset-2 ring-blue-500/20 shadow-md transform scale-105'
                                                    : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                                            >
                                                {getStatusLabel(status)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">{selectedOrder.formData?.name}</h4>
                                            <div className="text-xs text-gray-500" dir="ltr">{selectedOrder.formData?.phone}</div>
                                        </div>
                                    </div>
                                    <div className="border-t border-gray-200 pt-3 flex items-start gap-2">
                                        <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                        <p className="text-xs text-gray-600 font-medium leading-relaxed">
                                            {selectedOrder.formData?.country}, {selectedOrder.formData?.city}, {selectedOrder.formData?.address}
                                        </p>
                                    </div>
                                    {selectedOrder.formData?.notes && (
                                        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                                            <span className="font-bold">{txt.notes}</span> {selectedOrder.formData.notes}
                                        </div>
                                    )}
                                </div>

                                {/* Products */}
                                <div>
                                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <ShoppingBag size={16} />
                                        {txt.products_title} ({selectedOrder.cartItems?.length || 0})
                                    </h4>
                                    <div className="space-y-3">
                                        {selectedOrder.cartItems?.map((item, idx) => (
                                            <div key={idx} className="flex gap-3 bg-white border border-gray-100 p-2 rounded-xl">
                                                <img src={item.image} className="w-14 h-14 rounded-lg object-cover bg-gray-50" alt="" />
                                                <div className="flex-1">
                                                    <h5 className="font-bold text-gray-800 text-xs line-clamp-1">{item.title}</h5>
                                                    <div className="flex justify-between items-end mt-1">
                                                        <span className="text-xs text-gray-500">الكمية: {item.quantity || 1}</span>
                                                        <span className="font-bold text-green-600 text-sm">{item.price?.toLocaleString()} {getLocalizedCurrency(generalSettings?.currency || 'YER', lang)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Totals */}
                                <div className="border-t-2 border-dashed border-gray-100 pt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">{txt.subtotal}</span>
                                        <span className="font-bold">{(selectedOrder.subTotal || selectedOrder.total)?.toLocaleString()} {getLocalizedCurrency(generalSettings?.currency || 'YER', lang)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">{txt.delivery}</span>
                                        <span className="font-bold">{selectedOrder.deliveryCost?.toLocaleString()} {getLocalizedCurrency(generalSettings?.currency || 'YER', lang)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg text-blue-600 font-black pt-2">
                                        <span>{txt.total_final}</span>
                                        <span>{((Number(selectedOrder.subTotal || 0) + Number(selectedOrder.deliveryCost || 0)) - Number(selectedOrder.discount || 0)).toLocaleString()} {getLocalizedCurrency(generalSettings?.currency || 'YER', lang)}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>


        </div>
    );
};

export default OrdersView;
