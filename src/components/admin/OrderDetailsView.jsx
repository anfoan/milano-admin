import React, { useState } from 'react';
import {
    ArrowLeft, Printer, FileText, CheckCircle2, Truck, XCircle,
    AlertCircle, Phone, MapPin, User, Mail, Calendar, CreditCard,
    Copy, ExternalLink, Plus, ShoppingBag, MessageCircle, Pencil, Save, X, Trash2, Search
} from 'lucide-react';
import { doc, updateDoc, collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncWalletRewardForOrderStatus } from '../../lib/walletRewards';
import { syncCustomerOrderHistoryById } from '../../lib/customerOrderHistory';
import ImageWithFallback from '../ImageWithFallback';
import { getLocalizedCurrency } from '../../lib/currencyUtils';
import { useCurrency } from '../../context/CurrencyContext';
import InvoiceTemplate from '../InvoiceTemplate';

const OrderDetailsView = ({ order, onBack, lang = 'ar', generalSettings, initialEditMode = false, onUpdate }) => {
    const { formatPrice, exchangeRate } = useCurrency();
    const [status, setStatus] = useState(order.status);
    const [updating, setUpdating] = useState(false);
    const [adminNote, setAdminNote] = useState(order.adminNote || '');
    const [showNoteOnInvoice, setShowNoteOnInvoice] = useState(order.showNoteOnInvoice || false);
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showInvoice, setShowInvoice] = useState(false);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(initialEditMode);
    const [editOrder, setEditOrder] = useState({
        ...order,
        formData: { ...order.formData },
        cartItems: order.cartItems?.map(item => ({ ...item })) || []
    });
    // State for Product Search
    const [allProducts, setAllProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Currency conversion helpers for edit mode inputs
    const isSAR = generalSettings?.currency === 'SAR';
    const rate = isSAR ? (exchangeRate || 140) : 1;

    const toDisplayPrice = (valInYER) => {
        const val = Number(valInYER) || 0;
        if (isSAR) {
            return Math.round(val / rate);
        }
        return val;
    };

    const toBasePrice = (valInDisplay) => {
        const val = Number(valInDisplay) || 0;
        if (isSAR) {
            return Math.round(val * rate);
        }
        return val;
    };

    // Sync local state if order prop updates
    React.useEffect(() => {
        setStatus(order.status);
        setAdminNote(order.adminNote || '');
        setShowNoteOnInvoice(order.showNoteOnInvoice || false);
        setEditOrder({
            ...order,
            formData: { ...order.formData },
            cartItems: order.cartItems?.map(item => ({ ...item })) || []
        });
    }, [order]);

    // Fetch All Products for Search
    React.useEffect(() => {
        if (!isEditing) return;
        const q = query(collection(db, "products"), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            setAllProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, [isEditing]);

    const currency = generalSettings?.currency === 'SAR'
        ? (lang === 'ar' ? "ر.س" : "SAR")
        : (lang === 'ar' ? "ر.ي" : "YER");

    const t = {
        ar: {
            // Headers & Titles
            order_details: "تفاصيل الطلب",
            order_id: "رقم الطلب",
            order_date: "تاريخ الطلب",
            invoice: "فاتورة",
            invoice_preview: "معاينة الفاتورة",
            customer_details: "بيانات العميل",
            invoice_details: "تفاصيل الفاتورة",
            delivery_location: "موقع التوصيل",
            notes_title: "ملاحظات",
            additional_notes: "ملاحظات إضافية:",

            // Labels
            buyer_name: "اسم المشتري:",
            phone: "رقم الهاتف:",
            email: "البريد الإلكتروني:",
            country: "الدولة:",
            city: "المدينة:",
            address: "العنوان:",
            payment_method: "طريقة الدفع:",
            payment_gateway: "بوابة الدفع:",
            device: "الجهاز:",
            user_address: "عنوان العميل:",

            // Table
            product: "المنتج",
            price: "السعر",
            discount: "الخصم",
            qty: "الكمية",
            total: "الإجمالي",
            size: "المقاس:",
            no_warranty: "لا يوجد ضمان",

            // Moneys
            subtotal: "المجموع الفرعي",
            delivery_fee: "رسوم التوصيل",
            coupon: "كوبون خصم",
            discount_percentage: "نسبة الخصم (%)",
            discount_fixed: "خصم المنتجات / إضافي",
            invoice_total: "إجمالي الفاتورة",
            currency: generalSettings?.currency === 'SAR' ? "ريال سعودي" : "ريال يمني",

            // Actions & Buttons
            print: "طباعة",
            print_pdf: "فاتورة PDF",
            close: "إغلاق",
            add_note: "إضافة ملاحظة",
            save_note: "إضافة",
            show_on_invoice: "تظهر في الفاتورة",
            copy_link: "نسخ الرابط",
            link_copied: "تم النسخ",
            tracking_title: "تتبع الطلب",
            tracking_desc: "يمكنك مشاركة هذا الرابط مع العميل لمتابعة الشحنة",

            // Statuses
            status_update_title: "يرجى تحديث حالة الطلب لإعلام المشتري",
            status_alert_title: "يرجى التأكد من أن المشتري قد تواصل معكم لتحديد طريقة الشراء، وتحديث الحالة وفقاً لذلك",
            status_label: "حالة الطلب :",
            st_new: "طلب جديد",
            st_processing: "قيد التجهيز",
            st_shipping: "قيد التوصيل",
            st_completed: "مكتمل",
            st_cancelled: "ملغي",

            // Values
            // Values
            val_visitors: "زائر",
            val_whatsapp: "واتساب",
            val_cod: "كاش",
            val_manual: "يدوي",
            val_cod_gateway: "الدفع عند الاستلام",
            val_connect_payment: "تواصل لإكمال عملية الدفع عبر واتساب",
            val_no_email: "لا يوجد",
            val_avail: "متوفر",
            val_not_avail: "غير متوفر",
            val_yemen: "اليمن",
            val_sanaa: "صنعاء",
            val_unknown_device: "غير معروف",

            // Alerts
            alert_status_confirm: 'هل أنت متأكد من تغيير حالة الطلب إلى "{status}"؟',
            alert_error: "حدث خطأ: ",
            alert_note_saved: "تم حفظ الملاحظة والإعدادات",
            alert_popup: "من فضلك اسمح بالنوافذ المنبثقة (Popups) لطباعة الفاتورة.",
            alert_download_error: "حدث خطأ أثناء تحميل الفاتورة",

            // Misc
            customer_note: "ملاحظة العميل:",
            admin_note: "ملاحظة الأدمن:",
            no_notes: "لا توجد ملاحظات حالياً",
            store_name: "متجر ميلانو",
            thanks: "شكراً لتسوقكم من متجر ميلانو الذكي",

            // Edit Mode
            edit_order: "تعديل الطلب",
            save_changes: "حفظ التغييرات",
            cancel: "إلغاء",
            delete_item_confirm: "هل أنت متأكد من حذف هذا المنتج؟",
            save_success: "تم حفظ التغييرات بنجاح",
            save_error: "حدث خطأ أثناء حفظ التغييرات",
            add_item: "إضافة منتج للطلب"
        },
        en: {
            // Headers & Titles
            order_details: "Order Details",
            order_id: "Order ID",
            order_date: "Order Date",
            invoice: "INVOICE",
            invoice_preview: "Invoice Preview",
            customer_details: "Customer Details",
            invoice_details: "Invoice Items",
            delivery_location: "Delivery Location",
            notes_title: "Notes",
            additional_notes: "Additional Notes:",

            // Labels
            buyer_name: "Name:",
            phone: "Phone:",
            email: "Email:",
            country: "Country:",
            city: "City:",
            address: "Address:",
            payment_method: "Payment Method:",
            payment_gateway: "Gateway:",
            device: "Device:",
            user_address: "User IP:",

            // Table
            product: "Item",
            price: "Price",
            discount: "Discount",
            qty: "Qty",
            total: "Total",
            size: "Size:",
            no_warranty: "No Warranty",

            // Moneys
            subtotal: "Subtotal",
            delivery_fee: "Delivery Fee",
            coupon: "Coupon Code",
            discount_percentage: "Discount (%)",
            discount_fixed: "Product / Extra Discount",
            invoice_total: "Invoice Total",
            currency: order.currency || "YER",

            // Actions & Buttons
            print: "Print",
            print_pdf: "PDF Invoice",
            close: "Close",
            add_note: "Add Note",
            save_note: "Add",
            show_on_invoice: "Show on Invoice",
            copy_link: "Copy Link",
            link_copied: "Copied!",
            tracking_title: "Track Order",
            tracking_desc: "Share this link with the customer to track the shipment",

            // Statuses
            status_update_title: "Update Order Status",
            status_alert_title: "Please ensure the customer has been contacted to confirm payment method, and update status accordingly",
            status_label: "Order Status:",
            st_new: "New Order",
            st_processing: "Processing",
            st_shipping: "Shipping",
            st_completed: "Completed",
            st_cancelled: "Cancelled",

            // Values
            val_visitors: "Guest",
            val_whatsapp: "WhatsApp",
            val_cod: "Cash",
            val_manual: "Manual",
            val_cod_gateway: "COD",
            val_connect_payment: "Contact to Pay",
            val_no_email: "None",
            val_avail: "Available",
            val_not_avail: "N/A",
            val_yemen: "Yemen",
            val_sanaa: "Sana'a",
            val_unknown_device: "Unknown",

            // Alerts
            alert_status_confirm: 'Are you sure you want to change status to "{status}"?',
            alert_error: "Error: ",
            alert_note_saved: "Note & Settings Saved",
            alert_popup: "Please allow popups to print the invoice.",
            alert_download_error: "Error downloading invoice",

            // Misc
            customer_note: "Customer Note:",
            admin_note: "Admin Note:",
            no_notes: "No notes currently",
            store_name: "Milano Store",
            thanks: "Thank you for shopping with Milano Smart Store",

            // Edit Mode
            edit_order: "Edit Order",
            save_changes: "Save Changes",
            cancel: "Cancel",
            delete_item_confirm: "Are you sure you want to delete this item?",
            save_success: "Changes saved successfully",
            save_error: "Error saving changes",
            add_item: "Add Item"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    // --- Actions ---
    const handleStatusUpdate = async (newStatus) => {
        if (!window.confirm(txt.alert_status_confirm.replace("{status}", getStatusLabel(newStatus)))) return;

        setUpdating(true);
        try {
            const updates = {
                status: newStatus,
                updatedAt: new Date()
            };

            // If marking as completed, save the completion time
            if (newStatus.toLowerCase().includes('complete') || newStatus.includes('مكتمل') || newStatus.includes('اكتمل')) {
                updates.completedAt = new Date();
            }

            await updateDoc(doc(db, "orders", order.id), updates);
            await syncWalletRewardForOrderStatus(order.id, newStatus);
            await syncCustomerOrderHistoryById(order.id);
            setStatus(newStatus);
        } catch (error) {
            console.error("Error updating status:", error);
            alert(txt.alert_error + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleRecalculate = (updatedOrder) => {
        const subTotal = updatedOrder.cartItems.reduce((acc, item) => acc + (Number(item.price || 0) * (item.quantity || 1)), 0);

        // Calculate percentage discount
        const perc = Number(updatedOrder.discountPercentage || 0);
        const percAmount = subTotal * (perc / 100);

        const total = (subTotal - percAmount + Number(updatedOrder.deliveryCost || 0)) - Number(updatedOrder.discount || 0);
        setEditOrder({
            ...updatedOrder,
            subTotal,
            total
        });
    };

    const handleUpdateField = (field, value, isNested = false) => {
        if (isNested) {
            const newOrder = {
                ...editOrder,
                formData: { ...editOrder.formData, [field]: value }
            };
            // Also update top-level if it's paymentMethod
            if (field === 'paymentMethod') {
                newOrder.paymentMethod = value;
            }
            setEditOrder(newOrder);
        } else {
            const newOrder = { ...editOrder, [field]: value };
            if (field === 'deliveryCost' || field === 'discount' || field === 'discountPercentage') {
                handleRecalculate(newOrder);
            } else {
                setEditOrder(newOrder);
            }
        }
    };

    const handleUpdateItem = (idx, field, value) => {
        const newItems = [...editOrder.cartItems];

        // Handle numeric fields
        if (field === 'price' || field === 'quantity') {
            value = Number(value) || 0;
        }

        newItems[idx][field] = value;

        // Ensure both fields are in sync for size changes to avoid invoice conflicts
        if (field === 'selectedSize' || field === 'size') {
            newItems[idx].selectedSize = value;
            newItems[idx].size = value;
        }

        handleRecalculate({ ...editOrder, cartItems: newItems });
    };

    const handleSelectProduct = (product) => {
        const newItem = {
            id: product.id,
            title: product.name,
            price: Number(product.priceAfterDiscount || product.price || 0),
            quantity: 1,
            image: product.mainImage || '/nav-logo.png',
            selectedSize: '',
            size: '',
            variants: product.variants || []
        };

        // Auto-select first size if available
        const sizeVariant = product.variants?.find(v => v.type === 'size');
        if (sizeVariant?.values?.length > 0) {
            const firstSize = sizeVariant.values[0];
            newItem.selectedSize = firstSize;
            newItem.size = firstSize;
        }

        const newItems = [...editOrder.cartItems, newItem];
        handleRecalculate({ ...editOrder, cartItems: newItems });
        setSearchTerm('');
    };

    const handleRemoveItem = (idx) => {
        if (editOrder.cartItems.length <= 1) return alert(lang === 'ar' ? 'يجب أن يحتوي الطلب على منتج واحد على الأقل' : 'Order must have at least one item');
        if (!window.confirm(txt.delete_item_confirm)) return;
        const newItems = editOrder.cartItems.filter((_, i) => i !== idx);
        handleRecalculate({ ...editOrder, cartItems: newItems });
    };

    const handleAddItem = () => {
        const newItem = {
            title: lang === 'ar' ? 'منتج جديد' : 'New Product',
            price: 0,
            quantity: 1,
            image: '/nav-logo.png',
            selectedSize: ''
        };
        const newItems = [...editOrder.cartItems, newItem];
        handleRecalculate({ ...editOrder, cartItems: newItems });
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const updates = {
                formData: editOrder.formData,
                cartItems: editOrder.cartItems,
                paymentMethod: editOrder.paymentMethod || 'manual',
                subTotal: editOrder.subTotal,
                deliveryCost: Number(editOrder.deliveryCost || 0),
                discount: Number(editOrder.discount || 0),
                discountPercentage: Number(editOrder.discountPercentage || 0),
                couponCode: editOrder.couponCode || '',
                orderId: editOrder.orderId,
                total: editOrder.total,
                date: editOrder.date || order.date,
                updatedAt: new Date()
            };
            await updateDoc(doc(db, "orders", order.id), updates);
            // If the phone was just recorded on a completed invoice, reconcile its reward now.
            await syncWalletRewardForOrderStatus(order.id, order.status);
            await syncCustomerOrderHistoryById(order.id);

            // Sync with parent state if callback provided
            if (onUpdate) {
                onUpdate(updates);
            }

            alert(txt.save_success);
            setIsEditing(false);
            // We might need to refresh the parent state, usually it happens via onSnapshot if managed that way.
        } catch (error) {
            console.error("Error saving changes:", error);
            alert(txt.save_error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyLink = () => {
        const storeUrl = generalSettings?.storeUrl ? generalSettings.storeUrl.replace(/\/$/, '') : window.location.origin;
        const link = `${storeUrl}/order-tracking/${order.orderId.replace('#', '').replace(/\s+/g, '')}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrint = () => {
        const content = document.getElementById('order-invoice-content');
        if (!content) return;

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
                <title>فاتورة - ${order.orderId}</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=1024">
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Cairo', sans-serif;
                        background-color: #f3f4f6;
                        margin: 0;
                        padding: 0;
                        min-width: 1024px;
                    }
                    /* Hide internal template header */
                    [data-html2canvas-ignore="true"], .print\\:hidden {
                        display: none !important;
                    }
                    #invoice-content {
                        display: flex;
                        justify-content: center;
                        padding: 40px 0;
                    }
                    @media print {
                        body {
                            background-color: white !important;
                            min-width: auto !important;
                        }
                        #invoice-content {
                            display: block !important;
                            padding: 0 !important;
                        }
                        .no-print { display: none !important; }
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        @page {
                            size: A4;
                            margin: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="no-print fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg z-50 flex justify-between items-center px-8">
                    <span class="font-bold">معاينة الفاتورة</span>
                    <div class="flex gap-4">
                        <button onclick="window.close()" class="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-all flex items-center gap-2">
                             <span>إغلاق</span>
                        </button>
                        <button onclick="window.print()" class="px-8 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                            <span>طباعة الفاتورة</span>
                        </button>
                    </div>
                </div>
                <div class="h-24 no-print"></div>
                <div id="invoice-content">
                    ${content.innerHTML}
                </div>
            </body>
            </html>
        `);
        doc.close();
    };



    // --- Helpers ---
    const getStatusLabel = (s) => {
        const map = {
            'new': txt.st_new,
            'processing': txt.st_processing,
            'shipping': txt.st_shipping,
            'completed': txt.st_completed,
            'cancelled': txt.st_cancelled
        };
        return map[s] || s;
    };

    const getStatusColor = (s) => {
        const map = {
            'new': 'bg-yellow-100 text-yellow-700',
            'processing': 'bg-blue-100 text-blue-700',
            'shipping': 'bg-purple-100 text-purple-700',
            'completed': 'bg-green-100 text-green-700',
            'cancelled': 'bg-red-100 text-red-700'
        };
        return map[s] || 'bg-gray-100 text-gray-700';
    };




    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header / Actions bar */}
            <div className="flex items-center gap-4 mb-4 md:mb-6">
                <button
                    onClick={onBack}
                    className="p-2 bg-white rounded-xl shadow-sm hover:bg-gray-50 border border-gray-100 text-gray-500 transition-colors"
                >
                    <ArrowLeft size={20} className={isRTL ? "rotate-180" : ""} />
                </button>
                <h1 className="text-2xl font-black text-gray-800">{txt.order_details} <span className="text-blue-600 font-mono text-xl ltr:ml-2 rtl:mr-2">{order.orderId}</span></h1>

                <div className="flex-1" />

                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-50"
                            >
                                <Save size={18} />
                                <span>{txt.save_changes}</span>
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditOrder({
                                        ...order,
                                        formData: { ...order.formData },
                                        cartItems: order.cartItems?.map(item => ({ ...item })) || []
                                    });
                                }}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95"
                            >
                                <X size={18} />
                                <span>{txt.cancel}</span>
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            <Pencil size={18} />
                            <span>{txt.edit_order}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* --- Left Column (Main) --- */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Header Card - Redesigned */}
                    <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden">
                        {/* Card Header */}
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-start gap-3">
                            <div>
                                <h1 className="text-xl md:text-3xl font-black text-blue-800 mb-1">{txt.order_id}</h1>
                                <p className="text-gray-400 font-mono text-lg font-bold" dir="ltr">{order.orderId}</p>
                            </div>
                            <div className="shrink-0">
                                <img
                                    src="/logo.jpg"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = '/nav-logo.png';
                                    }}
                                    alt="Milano Logo"
                                    className="h-16 w-auto object-contain"
                                />
                            </div>
                        </div>

                        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                            {/* Right Column (Payment & Status) - First in Layout for RTL */}
                            <div className="space-y-6">
                                {/* Payment Gateway Info */}
                                <div className="flex flex-wrap items-center justify-start gap-2 text-gray-600 font-bold">
                                    <MessageCircle className="text-blue-600" size={20} />
                                    <span>{txt.payment_method}</span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editOrder.formData?.paymentMethod || ''}
                                            onChange={(e) => handleUpdateField('paymentMethod', e.target.value, true)}
                                            className="px-2 py-1 bg-white border border-blue-200 rounded text-xs font-bold text-gray-800 outline-none focus:border-blue-500 w-32"
                                            placeholder={txt.val_manual}
                                        />
                                    ) : (
                                        <span>
                                            {order.formData?.paymentMethod === 'whatsapp' ? txt.val_whatsapp : (order.formData?.paymentMethod === 'cod' ? txt.val_cod : (order.formData?.paymentMethod || txt.val_manual))}
                                        </span>
                                    )}
                                </div>

                                {/* Blue Alert Box */}
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center space-y-2">
                                    <h4 className="font-bold text-blue-600 text-sm">
                                        {txt.status_alert_title}
                                    </h4>
                                    <p className="text-gray-500 font-bold text-sm">
                                        {txt.buyer_name}
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editOrder.formData?.name}
                                                onChange={(e) => handleUpdateField('name', e.target.value, true)}
                                                className="mr-2 px-2 py-1 bg-white border border-blue-200 rounded text-gray-800 outline-none focus:border-blue-500 transition-all font-bold"
                                            />
                                        ) : (
                                            <span className="text-gray-800">{order.formData?.name || txt.val_visitors}</span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 md:gap-4 shrink-0">
                                    <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tight flex items-center gap-2 md:gap-3">
                                        {txt.order_id}
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editOrder.orderId}
                                                onChange={(e) => setEditOrder({ ...editOrder, orderId: e.target.value })}
                                                className="w-28 md:w-40 px-3 py-1 bg-white border border-blue-200 rounded-xl text-lg md:text-2xl font-black text-blue-600 outline-none focus:border-blue-500 transition-all shadow-inner"
                                            />
                                        ) : (
                                            <span className="text-blue-600 hover:scale-105 transition-transform inline-block">
                                                {order.orderId}
                                            </span>
                                        )}
                                    </h2>
                                    <div className={`px-3 py-1 md:px-4 md:py-1.5 rounded-full font-black text-[10px] md:text-xs uppercase tracking-wider shadow-sm ${getStatusColor(isEditing ? editOrder.status : status)}`}>
                                        {getStatusLabel(isEditing ? editOrder.status : status)}
                                    </div>
                                </div>
                            </div>

                            {/* Left Column (Technical & Contact) */}
                            <div className="space-y-5">
                                <div className="flex flex-wrap items-center justify-start gap-2 text-gray-600">
                                    <span className="font-bold text-gray-400">{txt.email}</span>
                                    {isEditing ? (
                                        <input
                                            type="email"
                                            value={editOrder.formData?.email || ''}
                                            onChange={(e) => handleUpdateField('email', e.target.value, true)}
                                            className="px-2 py-1 bg-white border border-blue-200 rounded text-gray-800 outline-none focus:border-blue-500 transition-all font-bold text-xs w-48"
                                        />
                                    ) : (
                                        <span className="font-bold">{order.formData?.email || txt.val_no_email}</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-start gap-2 text-gray-600">
                                    <span className="font-bold text-gray-400">{txt.user_address}</span>
                                    <span className="font-bold dir-ltr font-mono">{order.ipAddress || txt.val_not_avail}</span>
                                </div>
                                <div className="flex items-center justify-start gap-2 text-gray-600">
                                    <span className="font-bold text-gray-400">{txt.order_date}</span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editOrder.date || ''}
                                            onChange={(e) => setEditOrder({ ...editOrder, date: e.target.value })}
                                            className="px-2 py-1 bg-white border border-blue-200 rounded text-gray-800 outline-none focus:border-blue-500 transition-all font-bold text-xs font-mono w-32"
                                            dir="ltr"
                                        />
                                    ) : (
                                        <span className="font-bold dir-ltr font-mono">
                                            {(() => {
                                                const locale = lang === 'ar' ? 'ar-YE' : 'en-GB';
                                                if (order.createdAt && typeof order.createdAt.toDate === 'function') {
                                                    return order.createdAt.toDate().toLocaleString(locale);
                                                } else if (typeof order.createdAt === 'string') {
                                                    return new Date(order.createdAt).toLocaleString(locale);
                                                }
                                                return order.date;
                                            })()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-start gap-2 text-gray-600">
                                    <span className="font-bold text-gray-400">{txt.device}</span>
                                    <span className="font-bold dir-ltr">{order.deviceInfo || txt.val_unknown_device}</span>
                                </div>
                                <div className="flex items-center justify-start gap-2 text-gray-600">
                                    <span className="font-bold text-gray-400">{txt.country}</span>
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={editOrder.formData?.country || ''}
                                                onChange={(e) => handleUpdateField('country', e.target.value, true)}
                                                className="px-2 py-1 bg-white border border-blue-200 rounded text-gray-800 outline-none focus:border-blue-500 transition-all font-bold text-xs w-24"
                                            />
                                            <input
                                                type="text"
                                                value={editOrder.formData?.countryCode || 'ye'}
                                                onChange={(e) => handleUpdateField('countryCode', e.target.value, true)}
                                                className="px-2 py-1 bg-white border border-blue-200 rounded text-gray-800 outline-none focus:border-blue-500 transition-all font-bold text-[10px] w-10 uppercase"
                                                placeholder="ye"
                                                maxLength={2}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{order.formData?.country || txt.val_yemen}</span>
                                            <img src={`https://flagcdn.com/w20/${order.formData?.countryCode || 'ye'}.png`} alt={order.formData?.country || txt.val_yemen} className="w-5 rounded-sm shadow-sm" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-start gap-2 text-gray-600">
                                    <span className="font-bold text-gray-400">{txt.phone}</span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editOrder.formData?.phone || ''}
                                            onChange={(e) => handleUpdateField('phone', e.target.value, true)}
                                            className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-gray-800 outline-none focus:border-blue-500 transition-all font-mono text-sm font-bold w-40"
                                            dir="ltr"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                                            <span className="font-mono text-sm font-bold text-gray-600" dir="ltr">{order.formData?.phone}</span>
                                            <MessageCircle size={16} className="text-gray-400" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Delivery Location Footer */}
                        <div className="border-t border-gray-100 p-4 md:p-6 bg-gray-50/50">
                            <h3 className="font-black text-gray-700 mb-4">{txt.delivery_location}</h3>
                            <div className="space-y-4">
                                {isEditing ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">{txt.city}</label>
                                            <input
                                                type="text"
                                                value={editOrder.formData?.city || ''}
                                                onChange={(e) => handleUpdateField('city', e.target.value, true)}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-blue-500 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">{txt.phone}</label>
                                            <input
                                                type="text"
                                                value={editOrder.formData?.phone || ''}
                                                onChange={(e) => handleUpdateField('phone', e.target.value, true)}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-blue-500 transition-all dir-ltr font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">{txt.address}</label>
                                            <textarea
                                                value={editOrder.formData?.address || ''}
                                                onChange={(e) => handleUpdateField('address', e.target.value, true)}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-blue-500 transition-all min-h-[60px] resize-none"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 text-gray-500 font-bold text-sm">
                                        <p>{order.formData?.city || txt.val_sanaa}</p>
                                        <p>{txt.payment_gateway} {order.formData?.paymentMethod === 'whatsapp' ? txt.val_manual : (order.formData?.paymentMethod === 'cod' ? txt.val_cod_gateway : txt.val_manual)}</p>
                                        <p>{txt.payment_method} {order.formData?.paymentMethod === 'whatsapp' ? txt.val_whatsapp : (order.formData?.paymentMethod === 'cod' ? txt.val_cod : (order.formData?.paymentMethod || txt.val_manual))}</p>
                                        <p className="dir-ltr font-mono">{order.formData?.phone}</p>
                                        <p>{order.formData?.address}</p>
                                        <p>{txt.val_yemen}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>


                    {/* Notes Section */}
                    <div className="bg-white rounded-[20px] p-5 md:p-8 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-6">
                            <h3 className="font-black text-gray-800 flex items-center gap-2 md:gap-3 text-base md:text-xl shrink-0">
                                <FileText size={20} className="text-gray-500 md:w-6 md:h-6" />
                                {txt.notes_title}
                            </h3>
                            <button
                                onClick={() => setShowNoteInput(!showNoteInput)}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-3 md:px-6 py-2 md:py-2.5 rounded-xl flex items-center gap-1.5 md:gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 text-[10px] md:text-sm whitespace-nowrap"
                            >
                                <Plus size={16} className="md:w-5 md:h-5" />
                                {txt.add_note}
                            </button>
                        </div>

                        {showNoteInput && (
                            <div className="mb-8 space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
                                <div className="space-y-2">
                                    <textarea
                                        className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder-gray-400 text-gray-700 min-h-[100px] resize-none"
                                        placeholder={`${txt.add_note}...`}
                                        maxLength={1000}
                                        value={adminNote}
                                        onChange={(e) => setAdminNote(e.target.value)}
                                    ></textarea>
                                    <div className="flex justify-end text-xs font-bold text-gray-400 dir-ltr font-mono">
                                        1000 / {adminNote.length}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <button
                                        onClick={handleSaveNote}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-2.5 rounded-lg font-bold shadow-md shadow-blue-500/10 transition-all active:scale-95 text-sm"
                                    >
                                        {txt.save_note}
                                    </button>

                                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                                        <span className="text-gray-500 font-bold text-sm group-hover:text-gray-700 transition-colors">{txt.show_on_invoice}</span>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={showNoteOnInvoice}
                                                onChange={(e) => setShowNoteOnInvoice(e.target.checked)}
                                                className="w-5 h-5 accent-pink-500 rounded border-2 border-gray-300 cursor-pointer transition-colors focus:ring-0"
                                            />
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {isEditing ? (
                                <div className="bg-yellow-50 text-yellow-800 p-5 rounded-xl border border-yellow-100 space-y-2">
                                    <label className="block text-xs text-yellow-600 font-extrabold">{txt.customer_note}</label>
                                    <textarea
                                        value={editOrder.formData?.notes || ''}
                                        onChange={(e) => handleUpdateField('notes', e.target.value, true)}
                                        className="w-full px-3 py-2 bg-white border border-yellow-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-yellow-500 transition-all min-h-[60px] resize-none"
                                    />
                                </div>
                            ) : order.formData?.notes && (
                                <div className="bg-yellow-50 text-yellow-800 p-5 rounded-xl text-sm font-bold border border-yellow-100 leading-relaxed flex gap-3 items-start">
                                    <MessageCircle size={18} className="mt-0.5 shrink-0 text-yellow-600" />
                                    <div>
                                        <span className="block text-xs text-yellow-600 mb-1 font-extrabold">{txt.customer_note}</span>
                                        {order.formData.notes}
                                    </div>
                                </div>
                            )}

                            {adminNote && !showNoteInput && (
                                <div className="bg-gray-50 text-gray-600 p-5 rounded-xl text-sm font-bold border border-gray-100 leading-relaxed flex gap-3 items-start group relative">
                                    <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setShowNoteInput(true)} className="p-1.5 bg-white text-blue-600 rounded-lg shadow-sm border border-gray-100 hover:bg-blue-50"><FileText size={14} /></button>
                                    </div>
                                    <FileText size={18} className="mt-0.5 shrink-0 text-blue-500" />
                                    <div>
                                        <span className="block text-xs text-blue-600 mb-1 font-extrabold">{txt.admin_note}</span>
                                        {adminNote}
                                    </div>
                                </div>
                            )}

                            {!order.formData?.notes && (!adminNote || showNoteInput) && !showNoteInput && (
                                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-400 text-sm font-bold">{txt.no_notes}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Product Search (Add Item) */}
                    {isEditing && (
                        <div className="mb-6 relative">
                            <div className="relative">
                                <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-gray-400`} size={20} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-white border border-gray-200 rounded-[20px] focus:ring-4 focus:ring-blue-500/5 transition-all font-bold shadow-sm`}
                                    placeholder={lang === 'ar' ? 'ابحث عن منتج لإضافته بالاسم...' : 'Search for a product to add by name...'}
                                />
                            </div>

                            {/* Search Results Dropdown */}
                            {searchTerm && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100] max-h-80 overflow-y-auto">
                                    {allProducts.filter(p =>
                                        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).length > 0 ? (
                                        allProducts.filter(p =>
                                            p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            p.category?.toLowerCase().includes(searchTerm.toLowerCase())
                                        ).map(p => (
                                            <div
                                                key={p.id}
                                                className="p-4 hover:bg-blue-50 flex items-center justify-between border-b last:border-0 transition-colors cursor-pointer"
                                                onClick={() => handleSelectProduct(p)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <img src={p.mainImage || '/nav-logo.png'} className="w-12 h-12 rounded-lg object-cover" />
                                                    <div>
                                                        <div className="font-black text-gray-800 text-sm">{p.name}</div>
                                                        <div className="text-[10px] font-bold text-gray-400">{p.category}</div>
                                                    </div>
                                                </div>
                                                <div className="text-sm font-black text-blue-600">
                                                    {Number(p.price).toLocaleString()} {currency}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-gray-400 font-bold text-sm">
                                            {lang === 'ar' ? 'لا توجد منتجات تطابق البحث' : 'No products match search'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Products Table */}
                    <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] md:min-w-full">
                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold text-xs">
                                    <tr>
                                        <th className={`py-4 px-4 md:px-6 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.product}</th>
                                        <th className="py-4 px-4 md:px-6 text-center whitespace-nowrap">{txt.price}</th>
                                        <th className="py-4 px-4 md:px-6 text-center whitespace-nowrap">{txt.qty}</th>
                                        <th className="py-4 px-4 md:px-6 text-center whitespace-nowrap">{txt.total}</th>
                                        {isEditing && <th className="py-4 px-2 text-center w-12"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(isEditing ? editOrder.cartItems : order.cartItems).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/10 transition-colors">
                                            <td className="py-4 px-4 md:px-6">
                                                <div className="flex items-center gap-3 md:gap-4">
                                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                                                        <ImageWithFallback src={item.image} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        {isEditing ? (
                                                            <div className="space-y-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={item.title}
                                                                    onChange={(e) => handleUpdateItem(idx, 'title', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-gray-800 outline-none focus:border-blue-500"
                                                                    placeholder={txt.product}
                                                                />
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">{txt.size}</span>
                                                                    <input
                                                                        type="text"
                                                                        value={item.selectedSize || item.size || ''}
                                                                        onChange={(e) => handleUpdateItem(idx, 'selectedSize', e.target.value)}
                                                                        className="w-full px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600 outline-none focus:border-blue-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <h4 className="font-bold text-gray-800 text-xs md:text-sm truncate max-w-[150px] md:max-w-none">{item.title}</h4>
                                                                {(item.selectedSize || item.size) && <span className="text-[10px] text-gray-400 font-bold block">{txt.size} {item.selectedSize || item.size}</span>}
                                                            </>
                                                        )}
                                                        <div className="mt-1 flex">
                                                            <span className="bg-yellow-100 text-yellow-700 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">{txt.no_warranty}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-2 md:px-6 text-center">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={toDisplayPrice(item.price)}
                                                            onChange={(e) => handleUpdateItem(idx, 'price', toBasePrice(e.target.value))}
                                                            className="w-20 px-2 py-1 bg-white border border-gray-200 rounded text-center text-xs font-bold text-blue-600 outline-none focus:border-blue-500"
                                                            step={isSAR ? "0.01" : "1"}
                                                        />
                                                        <span className="text-[10px] text-gray-400 font-bold">{currency}</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-blue-600 text-xs md:text-sm whitespace-nowrap">{formatPrice(item.price, generalSettings?.currency || 'YER')}</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 md:px-6 text-center whitespace-nowrap">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={item.quantity || 1}
                                                        onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                        className="w-20 px-2 py-1 bg-white border border-gray-200 rounded text-center text-xs font-bold text-gray-700 outline-none focus:border-blue-500"
                                                        min="1"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-gray-700 text-xs md:text-sm">{item.quantity || 1}</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 md:px-6 text-center font-bold text-gray-800 text-xs md:text-sm whitespace-nowrap">{formatPrice(item.price * (item.quantity || 1), generalSettings?.currency || 'YER')}</td>
                                            {isEditing && (
                                                <td className="py-4 px-2 text-center">
                                                    <button
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={lang === 'ar' ? 'حذف المنتج' : 'Remove Item'}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {isEditing && (
                                        <tr className="bg-blue-50/20">
                                            <td colSpan="5" className="py-4 px-6 text-center">
                                                <div className="text-gray-400 font-bold text-xs">
                                                    {lang === 'ar' ? 'استخدم خانة البحث أعلاه لإضافة منتجات من المخزن' : 'Use the search box above to add products from inventory'}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals Section */}
                        <div className="bg-gray-50 p-6 border-t border-gray-100">
                            <div className={`flex flex-col items-end gap-3 max-w-xs ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
                                <div className="flex justify-between w-full text-sm font-bold text-gray-500">
                                    <span>{txt.subtotal}</span>
                                    <span className="font-bold text-gray-500">{formatPrice(isEditing ? editOrder.subTotal : (order.subTotal || 0), generalSettings?.currency || 'YER')}</span>
                                </div>
                                <div className="flex justify-between w-full text-sm font-bold text-gray-500 items-center">
                                    <span>{txt.discount_percentage}</span>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={editOrder.discountPercentage || 0}
                                                onChange={(e) => handleUpdateField('discountPercentage', e.target.value)}
                                                className="w-20 px-2 py-1 bg-white border border-gray-200 rounded text-center text-xs font-bold text-gray-700 outline-none focus:border-blue-500"
                                            />
                                            <span className="text-[10px] text-gray-400 font-bold">%</span>
                                        </div>
                                    ) : (
                                        <span className="font-bold text-gray-700 text-xs md:text-sm">
                                            {(() => {
                                                const productDiscount = Number(order.discount || 0);
                                                const couponPercentage = Number(order.discountPercentage || 0);
                                                const couponDiscount = Math.round(Number(order.subTotal || 0) * (couponPercentage / 100));
                                                const totalDiscountAmt = productDiscount + couponDiscount;

                                                if (order.subTotal > 0 && totalDiscountAmt > 0) {
                                                    const totalPerc = Math.round((totalDiscountAmt / order.subTotal) * 100);
                                                    return (
                                                        <span className="flex items-center gap-1">
                                                            {totalPerc}%
                                                            {couponPercentage > 0 && <span className="text-[10px] text-blue-500 font-bold">({txt.coupon})</span>}
                                                        </span>
                                                    );
                                                }
                                                return "0%";
                                            })()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex justify-between w-full text-sm font-bold text-gray-500 items-center">
                                    <span>{txt.discount_fixed}</span>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={toDisplayPrice(editOrder.discount)}
                                                onChange={(e) => handleUpdateField('discount', toBasePrice(e.target.value))}
                                                className="w-20 px-2 py-1 bg-white border border-gray-200 rounded text-center text-xs font-bold text-gray-700 outline-none focus:border-blue-500"
                                                step={isSAR ? "0.01" : "1"}
                                            />
                                            <span className="text-[10px] text-gray-400 font-bold">{currency}</span>
                                        </div>
                                    ) : (
                                        <span>{formatPrice(order.discount || 0, generalSettings?.currency || 'YER')}</span>
                                    )}
                                </div>
                                <div className="flex justify-between w-full text-sm font-bold text-gray-400 items-center">
                                    <span>{txt.coupon}</span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editOrder.couponCode || ''}
                                            onChange={(e) => handleUpdateField('couponCode', e.target.value)}
                                            className="w-32 px-2 py-1 bg-white border border-gray-200 rounded text-center text-xs font-bold text-gray-500 outline-none focus:border-blue-500"
                                            placeholder="CODE123"
                                        />
                                    ) : (
                                        <span className="font-mono">{order.couponCode || txt.val_not_avail}</span>
                                    )}
                                </div>
                                <div className="flex justify-between w-full text-sm font-bold text-gray-500 items-center">
                                    <span>{txt.delivery_fee}</span>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={toDisplayPrice(editOrder.deliveryCost)}
                                                onChange={(e) => handleUpdateField('deliveryCost', toBasePrice(e.target.value))}
                                                className="w-20 px-2 py-1 bg-white border border-gray-200 rounded text-center text-xs font-bold text-gray-700 outline-none focus:border-blue-500"
                                                step={isSAR ? "0.01" : "1"}
                                            />
                                            <span className="text-[10px] text-gray-400 font-bold">{currency}</span>
                                        </div>
                                    ) : (
                                        <span className="font-bold text-gray-700 text-xs md:text-sm">{formatPrice(order.deliveryCost || 0, generalSettings?.currency || 'YER')}</span>
                                    )}
                                </div>
                                <div className="h-px w-full bg-gray-200 my-1"></div>
                                <div className="flex justify-between w-full text-base md:text-lg font-black text-gray-800 whitespace-nowrap items-center">
                                    <span>{txt.invoice_total}</span>
                                    <span className="text-blue-600 font-bold text-lg md:text-xl">
                                        {formatPrice(isEditing ? editOrder.total : (order.total || ((Number(order.subTotal || 0) + Number(order.deliveryCost || 0)) - Number(order.discount || 0))), generalSettings?.currency || 'YER')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>


                </div>

                {/* --- Right Column (Sidebar) --- */}
                <div className="space-y-6">

                    {/* Actions Card */}
                    <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm space-y-3">
                        <button
                            onClick={handlePrint}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-base"
                        >
                            <Printer size={20} />
                            {txt.print}
                        </button>
                        <button
                            onClick={handlePrint}
                            className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-base"
                        >
                            <FileText size={18} />
                            {txt.print_pdf}
                        </button>
                    </div>

                    {/* Hidden Invoice Template for printing */}
                    <div style={{ display: 'none' }}>
                        <div id="order-invoice-content">
                            <InvoiceTemplate orders={[isEditing ? editOrder : order]} lang={lang} generalSettings={generalSettings} />
                        </div>
                    </div>

                    {/* Status Update Card */}
                    <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 text-sm">{txt.status_update_title}</h3>
                        <div className="space-y-2">
                            <button onClick={() => handleStatusUpdate('processing')} disabled={updating} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${status === 'processing' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>({txt.st_processing})</button>
                            <button onClick={() => handleStatusUpdate('shipping')} disabled={updating} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${status === 'shipping' ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>({txt.st_shipping})</button>
                            <button onClick={() => handleStatusUpdate('completed')} disabled={updating} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${status === 'completed' ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>({txt.st_completed})</button>
                            <button onClick={() => handleStatusUpdate('cancelled')} disabled={updating} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${status === 'cancelled' ? 'bg-red-500 text-white ring-2 ring-red-300' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>({txt.st_cancelled})</button>
                            <button onClick={() => handleStatusUpdate('new')} disabled={updating} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${status === 'new' ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>{txt.st_new}</button>
                        </div>
                    </div>



                    {/* Tracking Link Card */}
                    <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-5">
                            <button
                                onClick={handleCopyLink}
                                className={`text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md active:scale-95 ${copied ? 'bg-green-500 shadow-green-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                            >
                                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                                {copied ? txt.link_copied : txt.copy_link}
                            </button>
                            <h3 className="font-black text-gray-800 text-base flex items-center gap-2">
                                <MapPin size={20} className="text-blue-600" />
                                {txt.tracking_title}
                            </h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-3 group relative">
                            <p className="font-mono text-xs font-bold text-gray-600 break-all dir-ltr select-all">
                                {`${(generalSettings?.storeUrl ? generalSettings.storeUrl.replace(/\/$/, '') : window.location.origin)}/order-tracking/${order.orderId.replace('#', '').replace(/\s+/g, '')}`}
                            </p>
                        </div>
                        <p className="text-xs text-gray-400 font-bold flex items-center gap-2">
                            <AlertCircle size={14} />
                            {txt.tracking_desc}
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default OrderDetailsView;
