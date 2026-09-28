import React, { useState, useEffect, useRef } from 'react';
import {
    User, Phone, MapPin, ShoppingBag, Plus, Trash2,
    Search, CheckCircle, ChevronRight, ChevronLeft,
    Printer, ArrowRight, AlertTriangle, Package,
    Truck, DollarSign, X
} from 'lucide-react';
import { db } from '../../lib/firebase';
import {
    collection, addDoc, doc, getDoc, getDocs,
    query, where, serverTimestamp, increment, updateDoc,
    onSnapshot
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { getLocalizedCurrency } from '../../lib/currencyUtils';
import { useCurrency } from '../../context/CurrencyContext';
import InvoiceTemplate from '../InvoiceTemplate';

const ManualOrderView = ({ lang = 'ar', generalSettings }) => {
    const isRTL = lang === 'ar';
    const { formatPrice } = useCurrency();
    const [orderCurrency, setOrderCurrency] = useState('YER');
    const currency = orderCurrency === 'SAR' ? (isRTL ? 'ريال سعودي' : 'SAR') : (isRTL ? 'ريال يمني' : 'YER');

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [createdOrderId, setCreatedOrderId] = useState(null);
    const [createdOrderData, setCreatedOrderData] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        region: '',
        address: '',
        deliveryType: 'home', // 'home' or 'office'
        paymentMethod: '', // Empty by default as requested
        notes: ''
    });

    // Cart State
    const [cartItems, setCartItems] = useState([]);
    const [discount, setDiscount] = useState(0);

    // Data State
    const [products, setProducts] = useState([]);
    const [regions, setRegions] = useState([]);
    const [deliverySettings, setDeliverySettings] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    // Coupon State
    const [coupons, setCoupons] = useState([]);
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponError, setCouponError] = useState('');

    useEffect(() => {
        // Fetch Delivery Settings (Static enough to fetch once)
        const fetchSettings = async () => {
            try {
                const deliveryDoc = await getDoc(doc(db, "settings", "delivery"));
                if (deliveryDoc.exists()) {
                    const data = deliveryDoc.data();
                    setDeliverySettings(data);
                    setRegions(data.regions || []);
                }
            } catch (err) {
                console.error("Error fetching settings:", err);
            }
        };
        fetchSettings();

        // Real-time Products
        const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
            setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Real-time Coupons
        const unsubCoupons = onSnapshot(collection(db, "coupons"), (snap) => {
            setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubProducts();
            unsubCoupons();
        };
    }, []);

    const t = {
        ar: {
            title: "إنشاء طلب خارجي",
            subtitle: "تسجيل طلب يدوي للزبائن (واتساب، اتصال، انستقرام)",
            step1: "بيانات العميل",
            step2: "إضافة المنتجات",
            step3: "تأكيد الطلب",
            name: "الاسم الكامل",
            phone: "رقم الهاتف",
            region: "المنطقة / المدينة",
            address: "العنوان التفصيلي",
            delivery_type: "نوع التوصيل",
            home: "منزلي",
            office: "مكتبي",
            notes: "ملاحظات إضافية",
            search_products: "ابحث عن منتج...",
            add_to_order: "إضافة للطلب",
            quantity: "الكمية",
            price: "السعر",
            total: "الإجمالي",
            subtotal: "المجموع الفرعي",
            delivery_cost: "تكلفة التوصيل",
            discount: "خصم إضافي",
            final_total: "الإجمالي النهائي",
            create_order: "تأكيد وإنشاء الطلب",
            creating: "جاري إنشاء الطلب...",
            success_msg: "تم إنشاء الطلب بنجاح!",
            order_id: "رقم الطلب",
            print_invoice: "طباعة الفاتورة",
            new_order: "إنشاء طلب جديد",
            no_products: "لا توجد منتجات تطابق البحث",
            select_product_first: "يرجى اختيار منتج",
            fill_required: "يرجى تعبئة الحقول المطلوبة",
            back: "رجوع",
            next: "التالي",
            remove: "حذف",
            select_size: "المقاس",
            select_color: "اللون",
            empty_cart: "لم يتم إضافة منتجات للطلب بعد",
            payment_method: "طريقة الدفع",
            payment_placeholder: "مثال: واتساب، كاش، تحويل...",
            coupon_code: "كود الخصم",
            apply: "تطبيق",
            coupon_invalid: "كود الخصم غير صالح",
            coupon_expired: "هذا الكود منتهي الصلاحية",
            coupon_min_order: "لم يتم الوصول للحد الأدنى للطلب",
            coupon_applied: "تم تطبيق الخصم بنجاح"
        },
        en: {
            title: "Create External Order",
            subtitle: "Manual order entry for WhatsApp, Phone, Instagram",
            step1: "Customer Info",
            step2: "Add Products",
            step3: "Confirm Order",
            name: "Full Name",
            phone: "Phone Number",
            region: "Region / City",
            address: "Detailed Address",
            delivery_type: "Delivery Type",
            home: "Home",
            office: "Office",
            notes: "Additional Notes",
            search_products: "Search products...",
            add_to_order: "Add to Order",
            quantity: "Quantity",
            price: "Price",
            total: "Total",
            subtotal: "Subtotal",
            delivery_cost: "Delivery Cost",
            discount: "Additional Discount",
            final_total: "Final Total",
            create_order: "Confirm & Create Order",
            creating: "Creating order...",
            success_msg: "Order created successfully!",
            order_id: "Order ID",
            print_invoice: "Print Invoice",
            new_order: "Create New Order",
            no_products: "No products match search",
            select_product_first: "Please select a product",
            fill_required: "Please fill required fields",
            back: "Back",
            next: "Next",
            remove: "Remove",
            select_size: "Size",
            select_color: "Color",
            empty_cart: "No products added to order yet",
            payment_method: "Payment Method",
            payment_placeholder: "e.g. WhatsApp, Cash, Bank...",
            coupon_code: "Coupon Code",
            apply: "Apply",
            coupon_invalid: "Invalid coupon code",
            coupon_expired: "This coupon is expired",
            coupon_min_order: "Minimum order amount not reached",
            coupon_applied: "Discount applied successfully"
        }
    };

    const txt = t[lang];

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getCartKey = (item, idx) => item.cartItemId || `${item.id}-${idx}`;

    const handleAddToCart = (product) => {
        // Check if product has stock
        const totalStock = Number(product.stock || 0);
        if (totalStock <= 0) {
            alert(isRTL ? 'هذا المنتج نفذ من المخزون' : 'This product is out of stock');
            return;
        }
        
        const sizeValues = product.variants?.find(v => v.type === 'size')?.values || [];
        const colorValues = product.variants?.find(v => v.type === 'color')?.values || [];
        
        // Find first available size with stock > 0
        let defaultSize = '';
        if (sizeValues.length > 0) {
            if (product.sizeStocks && typeof product.sizeStocks === 'object') {
                defaultSize = sizeValues.find(s => (product.sizeStocks[s] ?? 0) > 0) || '';
            }
            // If no size with stock found or no sizeStocks object, use first size but check if any stock exists
            if (!defaultSize) {
                defaultSize = sizeValues[0];
                // Only block if sizeStocks exists and ALL are 0
                if (product.sizeStocks && typeof product.sizeStocks === 'object') {
                    const hasAnyStock = sizeValues.some(s => (product.sizeStocks[s] ?? 0) > 0);
                    if (!hasAnyStock) {
                        alert(isRTL ? 'جميع المقاسات نفذت من المخزون' : 'All sizes are out of stock');
                        return;
                    }
                }
            }
        }

        const defaultColor = colorValues[0] || '';
        const effectivePrice = Number((product.priceAfterDiscount && product.priceAfterDiscount < product.price) ? product.priceAfterDiscount : (product.price || 0));

        const cartItemId = `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

        setCartItems(prev => [...prev, {
            cartItemId,
            id: product.id,
            title: product.name,
            price: effectivePrice,
            originalPrice: Number(product.price || 0),
            costPrice: product.costPrice || 0,
            image: product.mainImage || '/nav-logo.png',
            quantity: 1,
            selectedSize: defaultSize,
            size: defaultSize,
            selectedColor: defaultColor,
            color: defaultColor
        }]);
    };

    const removeFromCart = (cartKey) => {
        setCartItems(cartItems.filter((item, idx) => getCartKey(item, idx) !== cartKey));
    };

    const updateQuantity = (cartKey, delta) => {
        setCartItems(cartItems.map((item, idx) => {
            if (getCartKey(item, idx) === cartKey) {
                const product = products.find(p => p.id === item.id);
                if (!product) return item;

                const newQty = Math.max(1, item.quantity + delta);
                
                // Check stock limit
                let maxStock = Number(product.stock || 0);
                
                // If product has sizes, check size-specific stock
                if (item.selectedSize && product.sizeStocks) {
                    const sizeStock = Number(product.sizeStocks[item.selectedSize] || 0);
                    // Calculate how much of this size is already in cart (excluding current item)
                    const otherSameSize = cartItems.reduce((acc, i, iIdx) => {
                        if (getCartKey(i, iIdx) !== cartKey && i.id === item.id && (i.selectedSize || i.size) === item.selectedSize) {
                            return acc + i.quantity;
                        }
                        return acc;
                    }, 0);
                    maxStock = Math.max(0, sizeStock - otherSameSize);
                } else {
                    // Calculate how much of this product is already in cart (excluding current item)
                    const otherSameProduct = cartItems.reduce((acc, i, iIdx) => {
                        if (getCartKey(i, iIdx) !== cartKey && i.id === item.id) {
                            return acc + i.quantity;
                        }
                        return acc;
                    }, 0);
                    maxStock = Math.max(0, maxStock - otherSameProduct);
                }

                if (newQty > maxStock) {
                    alert(isRTL ? `الكمية المتوفرة: ${maxStock} فقط` : `Available stock: ${maxStock} only`);
                    return { ...item, quantity: Math.max(1, maxStock) };
                }
                
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const calculateSubtotal = () => {
        return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const getDeliveryCost = () => {
        if (deliverySettings.freeDeliveryAll) return 0;

        const subtotal = calculateSubtotal();
        if (deliverySettings.freeAboveLimit && subtotal >= deliverySettings.limitAmount) return 0;

        const region = regions.find(r => r.name === formData.region);
        if (!region) return 0;

        if (deliverySettings.dynamicPricing) {
            return subtotal < deliverySettings.dynamicThreshold ? region.costLessThan : region.costGreaterThan;
        }

        if (deliverySettings.splitFees) {
            return formData.deliveryType === 'home' ? region.cost : region.officeCost;
        }

        return region.cost || 0;
    };

    const handleApplyCoupon = () => {
        setCouponError('');
        const inputCode = couponCode.trim().toUpperCase();

        // Find coupon (Checking both standard 'code' field and being safe with trims)
        const coupon = coupons.find(c => {
            const dbCode = String(c.code || "").trim().toUpperCase();
            return dbCode === inputCode;
        });

        if (!coupon) {
            setCouponError(txt.coupon_invalid);
            return;
        }

        const subtotal = calculateSubtotal();

        // Check Minimum Amount
        if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
            setCouponError(txt.coupon_min_order);
            return;
        }

        // Check Expiry
        if (coupon.expiryDate) {
            const expiry = new Date(coupon.expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (expiry < today) {
                setCouponError(txt.coupon_expired);
                return;
            }
        }

        // Check Usage Limit
        if (!coupon.isUnlimited && coupon.usedCount >= coupon.maxUses) {
            setCouponError(txt.coupon_expired);
            return;
        }

        // Apply Discount
        setAppliedCoupon(coupon);
        const couponDiscount = Math.round(subtotal * (coupon.discountPercent / 100));
        setDiscount(couponDiscount);
    };

    const handleCreateOrder = async () => {
        if (!formData.name.trim() || !formData.phone.trim() || !formData.region.trim() || !formData.address.trim() || cartItems.length === 0) {
            alert(isRTL ? "يرجى تعبئة جميع بيانات العميل الإجبارية (الاسم، الهاتف، المنطقة، العنوان) وإضافة منتجات" : "Please fill in all mandatory customer details (Name, Phone, Region, Address) and add products");
            return;
        }

        setLoading(true);
        try {
            const subtotal = calculateSubtotal();
            const deliveryCost = getDeliveryCost();
            const total = (subtotal + deliveryCost) - discount;
            const orderId = `MIL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const orderData = {
                orderId,
                status: 'new',
                currency: orderCurrency,
                paymentMethod: formData.paymentMethod || 'manual', // Set at top level for InvoiceTemplate compatibility
                createdAt: serverTimestamp(),
                date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB'),
                formData: {
                    ...formData,
                    city: formData.region, // For compatibility with InvoiceTemplate
                    country: 'Yemen'
                },
                cartItems,
                subTotal: subtotal,
                deliveryCost,
                discount,
                total,
                isExternal: true // Flag to distinguish
            };

            const docRef = await addDoc(collection(db, "orders"), orderData);
            if (appliedCoupon?.id && !appliedCoupon.isUnlimited) {
                await updateDoc(doc(db, "coupons", appliedCoupon.id), { usedCount: increment(1) });
            }

            // Update stock
            for (const item of cartItems) {
                const pRef = doc(db, "products", item.id);
                const updates = { stock: increment(-item.quantity) };
                if (item.size) {
                    updates[`sizeStocks.${item.size}`] = increment(-item.quantity);
                }
                await updateDoc(pRef, updates);
            }

            setCreatedOrderId(orderId);
            setCreatedOrderData({ id: docRef.id, ...orderData });
            setSuccess(true);
        } catch (err) {
            console.error("Error creating order:", err);
            alert("حدث خطأ أثناء إنشاء الطلب");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const content = document.getElementById('manual-invoice-content');
        if (!content) return;

        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            alert("يرجى السماح بالنوافذ المنبثقة للطباعة");
            return;
        }

        const doc = printWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html dir="${isRTL ? 'rtl' : 'ltr'}">
            <head>
                <title>فاتورة - ${createdOrderId}</title>
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
                    /* Hide the duplicate header from InvoiceTemplate */
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
                            color: black !important; 
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
                <script>
                    window.onload = () => {
                        const buttons = document.querySelectorAll('button');
                        buttons.forEach(btn => {
                            if (btn.innerText.includes('طباعة') || btn.innerText.includes('Print')) {
                                btn.onclick = () => window.print();
                            }
                            if (btn.innerText.includes('إغلاق') || btn.innerText.includes('Close')) {
                                btn.onclick = () => window.close();
                            }
                        });
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
    };

    const resetForm = () => {
        setStep(1);
        setFormData({
            name: '',
            phone: '',
            region: '',
            address: '',
            deliveryType: 'home',
            notes: ''
        });
        setCartItems([]);
        setDiscount(0);
        setCouponCode('');
        setAppliedCoupon(null);
        setCouponError('');
        setSuccess(false);
        setCreatedOrderId(null);
    };

    if (success) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto bg-white p-6 md:p-10 rounded-[24px] md:rounded-[32px] border border-gray-100 shadow-xl text-center"
            >
                <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={32} />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-2">{txt.success_msg}</h2>
                <div className="bg-gray-50 p-4 rounded-2xl mb-8 flex items-center justify-between">
                    <span className="text-gray-500 font-bold">{txt.order_id}</span>
                    <span className="text-xl font-black text-blue-600 font-mono">{createdOrderId}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition order-1 md:order-none"
                    >
                        <Printer size={20} />
                        <span>{txt.print_invoice}</span>
                    </button>
                    <button
                        onClick={resetForm}
                        className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-4 rounded-2xl font-black hover:bg-gray-200 transition order-2 md:order-none"
                    >
                        <Plus size={20} />
                        <span>{txt.new_order}</span>
                    </button>
                </div>

                {/* Hidden Invoice Template for printing */}
                <div style={{ display: 'none' }}>
                    <div id="manual-invoice-content">
                        <InvoiceTemplate orders={[createdOrderData]} lang={lang} generalSettings={generalSettings} />
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-4 md:space-y-6 pb-20 px-4 md:px-6" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header */}
            <div className="bg-white p-4 md:p-6 rounded-[20px] md:rounded-[24px] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-gray-800 line-clamp-1">{txt.title}</h2>
                        <p className="text-[10px] md:text-sm text-gray-400 font-bold">{txt.subtitle}</p>
                    </div>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-between px-4">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center flex-1 last:flex-none">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            {s}
                        </div>
                        <div className={`hidden md:block mx-4 text-sm font-bold ${step === s ? 'text-blue-600' : 'text-gray-400'}`}>
                            {s === 1 ? txt.step1 : s === 2 ? txt.step2 : txt.step3}
                        </div>
                        {s < 3 && <div className={`flex-1 h-1 mx-4 rounded-full ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`}></div>}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {step === 1 && (
                        <motion.div
                            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white p-5 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100 shadow-sm space-y-6"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 block">{txt.name}</label>
                                    <div className="relative">
                                        <User className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 transition-all font-bold"
                                            placeholder="محمد مروان..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 block">{txt.phone}</label>
                                    <div className="relative">
                                        <Phone className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 transition-all font-bold text-left"
                                            dir="ltr"
                                            placeholder="77xxxxxxx"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 block">{txt.region}</label>
                                    <select
                                        value={formData.region}
                                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 transition-all font-bold"
                                    >
                                        <option value="">اختر المنطقة...</option>
                                        {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 block">{txt.payment_method}</label>
                                    <div className="relative">
                                        <DollarSign className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={formData.paymentMethod}
                                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                            className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 transition-all font-bold"
                                            placeholder={txt.payment_placeholder}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 block">عملة الفاتورة والطلب</label>
                                    <select
                                        value={orderCurrency}
                                        onChange={(e) => setOrderCurrency(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 transition-all font-bold cursor-pointer"
                                    >
                                        <option value="YER">🇾🇪 ريال يمني (YER)</option>
                                        <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 block">{txt.delivery_type}</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setFormData({ ...formData, deliveryType: 'home' })}
                                            className={`py-3 rounded-xl border font-bold transition-all ${formData.deliveryType === 'home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                        >
                                            {txt.home}
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, deliveryType: 'office' })}
                                            className={`py-3 rounded-xl border font-bold transition-all ${formData.deliveryType === 'office' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                        >
                                            {txt.office}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 block">{txt.address}</label>
                                <textarea
                                    rows={2}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 transition-all font-bold resize-none"
                                    placeholder="شارع خولان - بجانب عمارة..."
                                />
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            {/* Search Box */}
                            <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm relative z-20">
                                <div className="relative">
                                    <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-gray-400`} size={20} />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/5 transition-all font-bold`}
                                        placeholder={txt.search_products}
                                    />
                                </div>

                                {/* Results Dropdown */}
                                {searchTerm && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-96 overflow-y-auto">
                                        {filteredProducts.length > 0 ? (
                                            filteredProducts.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="p-4 hover:bg-gray-50 flex items-center justify-between border-b last:border-0 transition-colors"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <img src={p.mainImage || '/nav-logo.png'} className="w-12 h-12 rounded-lg object-cover" />
                                                        <div>
                                                            <div className="font-black text-gray-800">{p.name}</div>
                                                            <div className="text-xs font-bold text-gray-400">{p.category}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-sm md:text-base font-black text-blue-600">
                                                            {p.priceAfterDiscount && p.priceAfterDiscount < p.price ? (
                                                                <div className="flex flex-col items-end">
                                                                    <span>{p.priceAfterDiscount.toLocaleString()} {currency}</span>
                                                                    <span className="text-xs text-gray-400 line-through font-normal">{p.price?.toLocaleString()} {currency}</span>
                                                                </div>
                                                            ) : (
                                                                <span>{p.price?.toLocaleString()} {currency}</span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                handleAddToCart(p);
                                                                setSearchTerm('');
                                                            }}
                                                            className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition"
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-gray-400 font-bold">{txt.no_products}</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Cart List */}
                            <div className="bg-white rounded-[24px] md:rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-4 md:p-6 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                    <Package size={20} className="text-gray-400" />
                                    <h3 className="font-black text-gray-800">{txt.products_title || 'المنتجات المختارة'}</h3>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {cartItems.length > 0 ? (
                                        cartItems.map((item, idx) => {
                                            const key = getCartKey(item, idx);
                                            return (
                                                <div key={key} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <img src={item.image} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
                                                        <div>
                                                            <div className="font-black text-gray-800">{item.title}</div>
                                                            <div className="flex flex-wrap gap-2.5 mt-2">
                                                                <div className="relative group">
                                                                    <select
                                                                        value={item.selectedSize || item.size}
                                                                        onChange={(e) => {
                                                                            const newSize = e.target.value;
                                                                            const p = products.find(prod => prod.id === item.id);
                                                                            const sizeStock = Number(p?.sizeStocks?.[newSize] ?? 0);
                                                                            setCartItems(cartItems.map((i, iIdx) => {
                                                                                if (getCartKey(i, iIdx) === key) {
                                                                                    // Cap quantity to available stock for new size
                                                                                    const newQty = Math.min(i.quantity, sizeStock || 1);
                                                                                    return { ...i, selectedSize: newSize, size: newSize, quantity: newQty };
                                                                                }
                                                                                return i;
                                                                            }));
                                                                        }}
                                                                        className="appearance-none text-[11px] md:text-sm font-black bg-white hover:bg-gray-50 px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none cursor-pointer min-w-[80px] md:min-w-[100px] text-center shadow-sm"
                                                                    >
                                                                        {(() => {
                                                                            const p = products.find(prod => prod.id === item.id);
                                                                            const sizes = p?.variants?.find(v => v.type === 'size')?.values || [];
                                                                            // Filter to only sizes with stock > 0
                                                                            return sizes
                                                                                .filter(s => (p?.sizeStocks?.[s] ?? 0) > 0)
                                                                                .map(s => <option key={s} value={s}>{s}</option>);
                                                                        })()}
                                                                    </select>
                                                                </div>

                                                                <div className="relative group">
                                                                    <select
                                                                        value={item.selectedColor || item.color}
                                                                        onChange={(e) => setCartItems(cartItems.map((i, iIdx) => getCartKey(i, iIdx) === key ? { ...i, selectedColor: e.target.value, color: e.target.value } : i))}
                                                                        className="appearance-none text-[11px] md:text-sm font-black bg-white hover:bg-gray-50 px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none cursor-pointer min-w-[80px] md:min-w-[100px] text-center shadow-sm"
                                                                    >
                                                                        {products.find(p => p.id === item.id)?.variants?.find(v => v.type === 'color')?.values?.map(c => <option key={c} value={c}>{c}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 md:gap-6 justify-between md:justify-end w-full md:w-auto">
                                                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-2 py-1 border border-gray-200">
                                                            <button onClick={() => updateQuantity(key, -1)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors font-black text-2xl">-</button>
                                                            <span className="w-8 text-center font-black text-gray-800">{item.quantity}</span>
                                                            <button onClick={() => updateQuantity(key, 1)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors font-black text-2xl">+</button>
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-sm md:text-lg font-black text-blue-600">
                                                                    {formatPrice(item.price * item.quantity, orderCurrency)}
                                                                </span>
                                                                {item.originalPrice && item.originalPrice > item.price && (
                                                                    <span className="text-xs text-gray-400 line-through font-normal">
                                                                        {formatPrice(item.originalPrice * item.quantity, orderCurrency)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => removeFromCart(key)}
                                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all shadow-sm border border-red-100/50"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-20 text-center text-gray-300">
                                            <ShoppingBag size={48} className="mx-auto mb-4 opacity-10" />
                                            <p className="font-black text-lg">{txt.empty_cart}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white p-5 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100 shadow-sm space-y-6 md:space-y-8"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="font-black text-gray-800 border-b-2 border-blue-500 pb-2 inline-block">{txt.step1}</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <User size={18} className="text-gray-400" />
                                            <span className="font-bold">{formData.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <Phone size={18} className="text-gray-400" />
                                            <span className="font-mono font-bold">{formData.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <MapPin size={18} className="text-gray-400" />
                                            <span className="font-bold">{formData.region} - {formData.address}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <Truck size={18} className="text-gray-400" />
                                            <span className="font-bold">{formData.deliveryType === 'home' ? txt.home : txt.office}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-black text-gray-800 border-b-2 border-emerald-500 pb-2 inline-block">حالة الدفع</h4>
                                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100">
                                        <span className="font-black">طلب خارجي اليدوي</span>
                                        <p className="text-xs mt-1 font-bold opacity-75">سيتم احتساب مبيعات هذا الطلب ضمن إحصائيات المتجر الكلية.</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                        {step > 1 ? (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="flex items-center gap-1.5 md:gap-2 px-6 md:px-10 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl bg-gray-100 text-gray-600 font-bold md:font-black hover:bg-gray-200 transition text-sm md:text-base"
                            >
                                <ChevronRight size={18} className={isRTL ? '' : 'rotate-180'} />
                                <span>{txt.back}</span>
                            </button>
                        ) : <div />}

                        {step < 3 ? (
                            <button
                                onClick={() => {
                                    if (step === 1 && (!formData.name || !formData.phone)) return alert(txt.fill_required);
                                    if (step === 2 && cartItems.length === 0) return alert(txt.empty_cart);
                                    setStep(step + 1);
                                }}
                                className="flex items-center gap-1.5 md:gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-blue-600 text-white font-bold md:font-black hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 text-sm md:text-base"
                            >
                                <span>{txt.next}</span>
                                <ChevronLeft size={18} className={isRTL ? '' : 'rotate-180'} />
                            </button>
                        ) : (
                            <button
                                onClick={handleCreateOrder}
                                disabled={loading}
                                className="flex items-center gap-1.5 md:gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-emerald-600 text-white font-bold md:font-black hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 text-sm md:text-base"
                            >
                                {loading ? <X className="animate-spin w-4 h-4" /> : <CheckCircle size={18} />}
                                <span>{loading ? txt.creating : txt.create_order}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Sidebar / Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-gray-100 shadow-sm sticky top-24">
                        <h3 className="font-black text-gray-800 mb-6 flex items-center gap-2">
                            ملخص الفاتورة
                        </h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-bold text-gray-500">
                                <span>{txt.subtotal}</span>
                                <span className="text-gray-800">{formatPrice(calculateSubtotal(), orderCurrency)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-bold text-gray-500">
                                <span>{txt.delivery_cost}</span>
                                <span className="text-gray-800">{formatPrice(getDeliveryCost(), orderCurrency)}</span>
                            </div>

                            {/* Coupon Code Input */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 block uppercase tracking-wider">{txt.coupon_code}</label>
                                <div className="flex items-stretch gap-2.5 h-11 md:h-12 w-full">
                                    <input
                                        type="text"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                        className="flex-1 min-w-0 text-sm font-black bg-gray-50 border border-gray-200 rounded-2xl px-4 outline-none focus:border-blue-500 uppercase font-mono transition-all focus:bg-white placeholder:text-gray-300 text-center shadow-sm"
                                        placeholder="SALE20"
                                    />
                                    <button
                                        onClick={handleApplyCoupon}
                                        className="bg-gray-900 text-white px-6 md:px-8 rounded-2xl text-xs md:text-sm font-black hover:bg-black active:scale-[0.98] transition-all shrink-0 shadow-md shadow-gray-200/50"
                                    >
                                        {txt.apply}
                                    </button>
                                </div>
                                {couponError && <p className="text-[10px] font-bold text-red-500">{couponError}</p>}
                                {appliedCoupon && (
                                    <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        {txt.coupon_applied} ({appliedCoupon.discountPercent}%)
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-between items-center text-sm font-bold text-gray-500">
                                <span>{txt.discount}</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={discount}
                                        onChange={(e) => {
                                            setDiscount(Math.max(0, Number(e.target.value)));
                                            setAppliedCoupon(null); // Clear applied coupon if manual edit
                                        }}
                                        className="w-24 text-left font-mono font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-red-500"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t-2 border-dashed border-gray-100 flex justify-between items-center whitespace-nowrap">
                                <span className="text-sm md:text-lg font-black text-gray-800 shrink-0">{txt.final_total}</span>
                                <div className="text-base md:text-2xl font-black text-blue-600 flex items-center gap-1">
                                    <span>{formatPrice(Math.max(0, (calculateSubtotal() + getDeliveryCost()) - discount), orderCurrency)}</span>
                                </div>
                            </div>
                        </div>

                        {step === 3 && (
                            <div className="mt-8 pt-6 border-t border-gray-50 space-y-3">
                                <p className="text-[10px] text-gray-400 font-bold text-center leading-relaxed">
                                    سيتم حفظ هذا الطلب في قاعدة البيانات برقم تسلسلي خاص، ويمكنك طباعة الفاتورة بعد الحفظ مباشرة.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualOrderView;
