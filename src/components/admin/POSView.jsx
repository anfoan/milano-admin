import React, { useState, useEffect, useRef } from 'react';
import { 
    Calculator, Search, Plus, Minus, Trash2, CreditCard, User, 
    Printer, LogOut, CheckCircle, AlertTriangle, Clock, Calendar,
    Edit, X, ShoppingCart, RefreshCw, Layers, DollarSign, ArrowLeftRight,
    RotateCcw, Monitor, History, BarChart3, ArrowLeft, ArrowRight, ChevronDown
} from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { signInAnonymously, signOut } from 'firebase/auth';
import { getAdminEmails, FALLBACK_ADMIN_EMAILS } from '../../lib/adminEmails';
import { 
    collection, doc, getDoc, getDocs, addDoc, updateDoc, 
    deleteDoc, query, orderBy, increment, serverTimestamp, 
    onSnapshot 
} from 'firebase/firestore';
// eslint-disable-next-line no-unused-vars -- motion is used as <motion.div> in JSX (flat config lacks react/jsx-uses-vars)
import { motion, AnimatePresence } from 'framer-motion';
import { getLocalizedCurrency } from '../../lib/currencyUtils';
import InvoiceTemplate from '../InvoiceTemplate';
import DraggableScrollContainer from '../DraggableScrollContainer';

const POSView = ({ lang = 'ar', generalSettings, standalone = false }) => {
    const isRTL = lang === 'ar';
    const currency = getLocalizedCurrency(generalSettings?.currency || 'YER', lang);

    // Auth States
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAdminManager, setIsAdminManager] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Cashier Permissions State
    const [workerPermissions, setWorkerPermissions] = useState({
        allowDiscount: false,
        allowChangePayment: false,
        allowViewHistory: false,
        allowOnlyPrint: false,
        allowExpenses: false,
        allowManualOrder: false
    });
    const [, setCurrentWorkerId] = useState(null);

    // Store Offers Active/Closed Toggle State
    const [applyStoreOffers, setApplyStoreOffers] = useState(true);

    // POS Tab/SubView States: 'dashboard', 'sell', 'receipts'
    const [posSubView, setPosSubView] = useState('dashboard');

    // POS Cart & Catalog States
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showCategories, setShowCategories] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [cartItems, setCartItems] = useState([]);
    const [customDiscount, setCustomDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'card', 'transfer'
    const [checkoutName, setCheckoutName] = useState('');
    const [checkoutPhone, setCheckoutPhone] = useState('');
    const [editingOrderId, setEditingOrderId] = useState(null); // When editing a previous receipt

    // Receipt Log States
    const [receipts, setReceipts] = useState([]);
    const [monthlySalesSum, setMonthlySalesSum] = useState(0);
    const [monthlySalesCount, setMonthlySalesCount] = useState(0);
    const [todaySalesSum, setTodaySalesSum] = useState(0);
    const [todaySalesCount, setTodaySalesCount] = useState(0);
    const [searchReceiptId, setSearchReceiptId] = useState('');
    
    // Print States
    const [selectedOrderToPrint] = useState(null);
    const [printMode] = useState(false);
    
    // Report States
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportPeriod, setReportPeriod] = useState('custom');
    const [showReportModal, setShowReportModal] = useState(false);
    const [generatedReport, setGeneratedReport] = useState(null);

    // Success Screen
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastCreatedOrderId, setLastCreatedOrderId] = useState('');
    const [lastCreatedOrderData, setLastCreatedOrderData] = useState(null);

    // Size Selection Modal
    const [showSizeModal, setShowSizeModal] = useState(false);
    const [sizeModalProduct, setSizeModalProduct] = useState(null);
    const [sizeModalQtys, setSizeModalQtys] = useState({});

    const printRef = useRef(null);

    // Auto-calculate dates based on reportPeriod
    useEffect(() => {
        if (reportPeriod === 'custom') return;

        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (reportPeriod === 'this_week') {
            const dayOfWeek = now.getDay();
            start.setDate(now.getDate() - dayOfWeek);
            start.setHours(0, 0, 0, 0);
            
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (reportPeriod === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (reportPeriod === 'this_year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        } else if (reportPeriod.startsWith('month_')) {
            const monthIdx = parseInt(reportPeriod.split('_')[1], 10) - 1;
            const year = now.getFullYear();
            start = new Date(year, monthIdx, 1);
            end = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
        }

        const formatDate = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        setReportStartDate(formatDate(start));
        setReportEndDate(formatDate(end));
    }, [reportPeriod]);

    // Check Auth Status (either Admin user or Local Worker)
    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            const isWorker = sessionStorage.getItem('isPOSWorkerAuthenticated') === 'true';
            
            if (user) {
                // Admin check: Firestore list + fallback (case-insensitive)
                const adminList = (await getAdminEmails()) || FALLBACK_ADMIN_EMAILS;
                const combined = new Set([...adminList, ...FALLBACK_ADMIN_EMAILS]);
                if ([...combined].some(e => String(e).toLowerCase() === String(user.email || '').toLowerCase())) {
                    setIsAuthenticated(true);
                    setIsAdminManager(true);
                    setAuthLoading(false);
                    return;
                }
            }
            
            if (isWorker) {
                setIsAuthenticated(true);
                setIsAdminManager(false);
                // Ensure anonymous Firebase auth exists even for restored sessions
                // (worker login is local username/password, not Firebase Auth)
                if (!user) {
                    signInAnonymously(auth).catch(e => console.error("Anonymous sign-in error:", e));
                }
            } else {
                setIsAuthenticated(false);
            }
            setAuthLoading(false);
        });

        return () => unsubscribeAuth();
    }, []);

    // Worker Login Handler
    const handleWorkerLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        
        if (!loginUsername.trim() || !loginPassword.trim()) {
            setLoginError(isRTL ? "يرجى إدخال اسم المستخدم وكلمة المرور" : "Please enter username and password");
            return;
        }

        try {
            const qWorkers = query(collection(db, "settings", "pos", "workers"));
            const snap = await getDocs(qWorkers);
            let foundWorker = null;
            snap.forEach(doc => {
                const data = doc.data();
                if (data.username === loginUsername.trim() && data.password === loginPassword.trim()) {
                    foundWorker = { id: doc.id, ...data };
                }
            });
            if (foundWorker) {
                // Sign in anonymously so Firestore rules see an authenticated user
                // (worker login is local username/password, not Firebase Auth)
                try {
                    await signInAnonymously(auth);
                } catch (authErr) {
                    console.error("Anonymous sign-in error:", authErr);
                }
                sessionStorage.setItem('isPOSWorkerAuthenticated', 'true');
                sessionStorage.setItem('posWorkerId', foundWorker.id);
                setIsAuthenticated(true);
                setIsAdminManager(false);
                setCurrentWorkerId(foundWorker.id);
                setWorkerPermissions({
                    allowDiscount: foundWorker.allowDiscount || false,
                    allowChangePayment: foundWorker.allowChangePayment || false,
                    allowViewHistory: foundWorker.allowViewHistory || false,
                    allowOnlyPrint: foundWorker.allowOnlyPrint || false,
                    allowExpenses: foundWorker.allowExpenses || false,
                    allowManualOrder: foundWorker.allowManualOrder || false
                });
            } else {
                setLoginError(isRTL ? "بيانات الدخول غير صحيحة" : "Incorrect login details");
            }
        } catch (err) {
            console.error("POS Login Error:", err);
            setLoginError(isRTL ? "فشل الاتصال بقاعدة البيانات" : "Database connection failed");
        }
    };

    // Logout Handler
    const handleLogout = () => {
        sessionStorage.removeItem('isPOSWorkerAuthenticated');
        if (isAdminManager) {
            // If they are Admin, let them stay logged in to Firebase but exit POS view
            if (standalone) {
                window.location.href = '/milano-dashboard-vault-77';
            } else {
                // If embedded, just switch tab
                window.location.reload();
            }
        } else {
            // Worker log out: also sign out of anonymous Firebase auth
            signOut(auth).catch(e => console.error("Sign out error:", e));
            // Worker log out redirects to store main page
            window.location.href = '/';
        }
    };

    // Real-time catalog & receipts fetch
    useEffect(() => {
        if (!isAuthenticated) return;

        // Fetch POS worker permissions from saved session
        const fetchPermissions = async () => {
            try {
                const workerId = sessionStorage.getItem('posWorkerId');
                if (workerId) {
                    const docSnap = await getDoc(doc(db, "settings", "pos", "workers", workerId));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setWorkerPermissions({
                            allowDiscount: data.allowDiscount || false,
                            allowChangePayment: data.allowChangePayment || false,
                            allowViewHistory: data.allowViewHistory || false,
                            allowOnlyPrint: data.allowOnlyPrint || false,
                            allowExpenses: data.allowExpenses || false,
                            allowManualOrder: data.allowManualOrder || false
                        });
                        setCurrentWorkerId(workerId);
                    }
                }
            } catch (err) {
                console.error("Error fetching POS worker permissions:", err);
            }
        };
        fetchPermissions();

        // Fetch products
        const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
            let prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by manual sort order from Inventory (sortOrder), products without sortOrder go to end
            prods.sort((a, b) => (a.sortOrder ?? 99999) - (b.sortOrder ?? 99999));
            setProducts(prods);

            // Extract unique categories
            const cats = ['all', ...new Set(prods.map(p => p.category).filter(Boolean))];
            setCategories(cats);
        });

        // Fetch POS Receipts + External Orders (isPOS = true OR isExternal = true)
        const qReceipts = query(
            collection(db, "orders"),
            orderBy("createdAt", "desc")
        );

        const unsubReceipts = onSnapshot(qReceipts, (snap) => {
            const data = snap.docs.map(doc => {
                const rData = doc.data();
                return {
                    id: doc.id,
                    ...rData,
                    formattedDate: rData.createdAt?.toDate ? rData.createdAt.toDate().toLocaleDateString(isRTL ? 'ar-YE' : 'en-GB') : rData.date || '',
                    formattedTime: rData.createdAt?.toDate ? rData.createdAt.toDate().toLocaleTimeString(isRTL ? 'ar-YE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
                };
            }).filter(r => r.isPOS === true || r.isExternal === true); // Only POS and external invoices; storefront orders stay out
            setReceipts(data);

            // Calculate Today's Sales (for dashboard card)
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayOrders = data.filter(r => {
                if (r.createdAt?.toDate) {
                    return r.createdAt.toDate() >= startOfDay && r.status !== 'cancelled';
                }
                return false;
            });

            const todaySum = todayOrders.reduce((sum, r) => sum + (r.total || 0), 0);
            setTodaySalesSum(todaySum);
            setTodaySalesCount(todayOrders.length);

            // Calculate Monthly Sales excluding cancelled/returned (for receipts log)
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthActiveOrders = data.filter(r => {
                if (r.createdAt?.toDate) {
                    return r.createdAt.toDate() >= startOfMonth && r.status !== 'cancelled';
                }
                return false;
            });

            const monthSum = monthActiveOrders.reduce((sum, r) => sum + (r.total || 0), 0);
            setMonthlySalesSum(monthSum);
            setMonthlySalesCount(monthActiveOrders.length);
        });

        return () => {
            unsubProducts();
            unsubReceipts();
        };
    }, [isAuthenticated]);

    // Product search filter
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    const getReceiptDate = (receipt) => {
        if (receipt.createdAt?.toDate) return receipt.createdAt.toDate();
        if (receipt.date) { const parsed = new Date(`${receipt.date}T00:00:00`); return Number.isNaN(parsed.getTime()) ? null : parsed; }
        return null;
    };
    const visibleReceipts = receipts.filter((receipt) => {
        const receiptDate = getReceiptDate(receipt);
        let inPeriod = true;
        if (reportStartDate || reportEndDate) {
            const start = reportStartDate ? new Date(`${reportStartDate}T00:00:00`) : new Date(0);
            const end = reportEndDate ? new Date(`${reportEndDate}T23:59:59.999`) : new Date(8640000000000000);
            inPeriod = receiptDate ? receiptDate >= start && receiptDate <= end : false;
        }
        const queryText = searchReceiptId.trim().toLowerCase();
        const matchesSearch = !queryText || String(receipt.orderId || '').toLowerCase().includes(queryText) || String(receipt.formData?.name || '').toLowerCase().includes(queryText);
        return inPeriod && matchesSearch;
    });
    const activeVisibleReceipts = visibleReceipts.filter(receipt => receipt.status !== 'cancelled');
    const paymentTotals = activeVisibleReceipts.reduce((totals, receipt) => {
        const method = receipt.paymentMethod === 'card' ? 'card' : receipt.paymentMethod === 'transfer' ? 'transfer' : 'cash';
        totals[method] += Number(receipt.total || 0);
        return totals;
    }, { cash: 0, card: 0, transfer: 0 });

    const handleAddToCart = (product) => {
        const totalStock = Number(product.stock || 0);
        
        // Check if product has stock
        if (totalStock <= 0) {
            alert(isRTL ? 'هذا المنتج نفذ من المخزون' : 'This product is out of stock');
            return;
        }
        
        // Find if item already exists in cart with same size and color
        const sizeValues = product.variants?.find(v => v.type === 'size')?.values || [];
        const colorValues = product.variants?.find(v => v.type === 'color')?.values || [];
        
        const defaultSize = sizeValues[0] || '';
        const defaultColor = colorValues[0] || '';

        // Check size-specific stock if product has sizes
        if (defaultSize && product.sizeStocks) {
            const sizeStock = Number(product.sizeStocks[defaultSize] || 0);
            if (sizeStock <= 0) {
                alert(isRTL ? `مقاس ${defaultSize} نفذ من المخزون` : `Size ${defaultSize} is out of stock`);
                return;
            }
        }

        const existingIdx = cartItems.findIndex(item => 
            item.id === product.id && 
            item.selectedSize === defaultSize && 
            item.selectedColor === defaultColor
        );

        // Sync with active store discount
        const hasDiscount = applyStoreOffers && product.priceAfterDiscount && Number(product.priceAfterDiscount) < Number(product.price);
        const finalPrice = hasDiscount ? Number(product.priceAfterDiscount) : Number(product.price);

        if (existingIdx > -1) {
            const updated = [...cartItems];
            updated[existingIdx].quantity += 1;
            setCartItems(updated);
        } else {
            setCartItems([...cartItems, {
                id: product.id,
                title: product.name,
                price: finalPrice,
                originalPrice: product.price,
                costPrice: product.costPrice || 0,
                image: product.mainImage || '/nav-logo.png',
                quantity: 1,
                selectedSize: defaultSize,
                selectedColor: defaultColor,
                sizeOptions: sizeValues,
                colorOptions: colorValues
            }]);
        }
    };

    // Recalculate cart item prices reactively when applyStoreOffers changes
    useEffect(() => {
        setCartItems(prev => prev.map(item => {
            const p = products.find(prod => prod.id === item.id);
            if (!p) return item;
            const hasDiscount = applyStoreOffers && p.priceAfterDiscount && Number(p.priceAfterDiscount) < Number(p.price);
            const finalPrice = hasDiscount ? Number(p.priceAfterDiscount) : Number(p.price);
            return {
                ...item,
                price: finalPrice,
                originalPrice: p.price
            };
        }));
    }, [applyStoreOffers, products]);

    const handleUpdateCartItem = (index, key, val) => {
        const updated = [...cartItems];
        updated[index] = { ...updated[index], [key]: val };
        setCartItems(updated);
    };

    const handleRemoveFromCart = (index) => {
        setCartItems(cartItems.filter((_, idx) => idx !== index));
    };

    const calculateSubtotal = () => {
        return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const calculateTotal = () => {
        return Math.max(0, calculateSubtotal() - Number(customDiscount));
    };

    // Complete POS Checkout
    const handlePOSCheckout = async () => {
        if (cartItems.length === 0) {
            alert(isRTL ? "السلة فارغة!" : "Cart is empty!");
            return;
        }

        setAuthLoading(true);
        try {
            const subtotal = calculateSubtotal();
            const total = calculateTotal();
            const orderId = `POS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            const orderData = {
                orderId,
                status: 'completed',
                paymentMethod: paymentMethod, // 'cash', 'card', 'transfer'
                createdAt: serverTimestamp(),
                date: new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB'),
                formData: {
                    name: checkoutName.trim() || (isRTL ? 'زبون محلي' : 'Local Customer'),
                    phone: checkoutPhone.trim() || '---',
                    city: isRTL ? 'البيع المباشر في المحل' : 'Direct In-store Sale',
                    address: isRTL ? 'استلام فوري من المحل' : 'Immediate Store Pickup',
                    country: 'Yemen'
                },
                cartItems: cartItems.map(item => ({
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    costPrice: item.costPrice || 0,
                    quantity: item.quantity,
                    selectedSize: item.selectedSize,
                    selectedColor: item.selectedColor,
                    image: item.image
                })),
                subTotal: subtotal,
                deliveryCost: 0,
                discount: Number(customDiscount),
                total: total,
                isPOS: true,
                isExternal: false
            };

            if (editingOrderId) {
                // Retrieve original order to restore stock first
                const origDoc = await getDoc(doc(db, "orders", editingOrderId));
                if (origDoc.exists()) {
                    const origData = origDoc.data();
                    for (const item of (origData.cartItems || [])) {
                        const pRef = doc(db, "products", item.id);
                        const updates = { stock: increment(item.quantity) };
                        if (item.selectedSize) {
                            updates[`sizeStocks.${item.selectedSize}`] = increment(item.quantity);
                                }
                                await updateDoc(pRef, updates);
                            }
                            }

                            await updateDoc(doc(db, "orders", editingOrderId), {
                    ...orderData,
                    updatedAt: serverTimestamp()
                });
                
                setLastCreatedOrderId(orderId);
                setLastCreatedOrderData({ id: editingOrderId, ...orderData });
            } else {
                // Create new document
                const docRef = await addDoc(collection(db, "orders"), orderData);
                setLastCreatedOrderId(orderId);
                setLastCreatedOrderData({ id: docRef.id, ...orderData });
            }

            // Deduct stock for new cartItems
            for (const item of cartItems) {
                const pRef = doc(db, "products", item.id);
                const updates = { stock: increment(-item.quantity) };
                if (item.selectedSize) {
                    updates[`sizeStocks.${item.selectedSize}`] = increment(-item.quantity);
                }
                await updateDoc(pRef, updates);
            }

            // Auto-fix: cap negative stock at 0
            try {
                for (const item of cartItems) {
                    const productRef = doc(db, "products", item.id);
                    const snap = await getDoc(productRef);
                    if (snap.exists()) {
                        const data = snap.data();
                        const fixes = {};
                        if (Number(data.stock || 0) < 0) fixes.stock = 0;
                        if (item.selectedSize && data.sizeStocks) {
                            const sizeQty = Number(data.sizeStocks?.[item.selectedSize] || 0);
                            if (sizeQty < 0) fixes[`sizeStocks.${item.selectedSize}`] = 0;
                        }
                        // Sync total stock with sum of sizes if product has sizes
                        if (data.sizeStocks && Object.keys(data.sizeStocks).length > 0) {
                            const sumOfSizes = Object.values(data.sizeStocks).reduce((sum, qty) => sum + Number(qty || 0), 0);
                            const currentStock = Number(data.stock || 0);
                            const adjustedStock = fixes.stock !== undefined ? 0 : currentStock;
                            if (adjustedStock !== sumOfSizes) {
                                fixes.stock = sumOfSizes;
                            }
                        }
                        if (Object.keys(fixes).length > 0) {
                            await updateDoc(productRef, fixes);
                        }
                    }
                }
            } catch (autoFixErr) {
                console.warn("Auto-fix stock error:", autoFixErr);
            }

            setShowSuccessModal(true);
            
            // Reset state
            setCartItems([]);
            setCustomDiscount(0);
            setCheckoutName('');
            setCheckoutPhone('');
            setEditingOrderId(null);
            setPaymentMethod('cash');
        } catch (err) {
            console.error("Error completing POS checkout:", err);
            alert(isRTL ? "حدث خطأ أثناء إتمام عملية البيع" : "An error occurred during transaction completion");
        } finally {
            setAuthLoading(false);
        }
    };

    // Load receipt into cart for editing
    const handleEditReceipt = (receipt) => {
        // External orders are edited from Orders List (قائمة الطلبات) — POS form would convert them to POS receipts
        if (receipt.isExternal === true) {
            alert(isRTL ? "هذه فاتورة طلب خارجي — عدّلها من قائمة الطلبات" : "This is an external order — edit it from the Orders List");
            return;
        }
        setEditingOrderId(receipt.id);
        setCheckoutName(receipt.formData?.name || '');
        setCheckoutPhone(receipt.formData?.phone || '');
        setCustomDiscount(receipt.discount || 0);
        setPaymentMethod(receipt.paymentMethod || 'cash');

        const loadedCart = (receipt.cartItems || []).map(item => {
            const productMatch = products.find(p => p.id === item.id) || {};
            const sizeValues = productMatch.variants?.find(v => v.type === 'size')?.values || [];
            const colorValues = productMatch.variants?.find(v => v.type === 'color')?.values || [];

            return {
                id: item.id,
                title: item.title,
                price: item.price,
                originalPrice: productMatch.price || item.price,
                costPrice: item.costPrice || 0,
                image: item.image || '/nav-logo.png',
                quantity: item.quantity,
                selectedSize: item.selectedSize || '',
                selectedColor: item.selectedColor || '',
                sizeOptions: sizeValues,
                colorOptions: colorValues
            };
        });

        setCartItems(loadedCart);
        setPosSubView('sell');
    };

    // Delete receipt and restore stock levels
    const handleDeleteReceipt = async (receipt) => {
        if (!confirm(isRTL ? "هل أنت متأكد من حذف هذا الإيصال نهائياً؟ سيتم إعادة الكميات للمخزون." : "Are you sure you want to delete this receipt permanently? Stock will be restored.")) return;

        try {
            // Restore stock (only if not already cancelled/refunded, to avoid double-incrementing stock)
            if (receipt.status !== 'cancelled') {
            for (const item of (receipt.cartItems || [])) {
                const pRef = doc(db, "products", item.id);
                const updates = { stock: increment(item.quantity) };
                if (item.selectedSize) {
                    updates[`sizeStocks.${item.selectedSize}`] = increment(item.quantity);
                }
                await updateDoc(pRef, updates);
            }
            }

            await deleteDoc(doc(db, "orders", receipt.id));
            alert(isRTL ? "تم حذف الإيصال بنجاح" : "Receipt deleted successfully");
        } catch (err) {
            console.error("Error deleting receipt:", err);
            alert(isRTL ? "فشل حذف الإيصال" : "Failed to delete receipt");
        }
    };

    // Refund/Return receipt and restore stock levels
    const handleRefundReceipt = async (receipt) => {
        if (receipt.status === 'cancelled') {
            alert(isRTL ? "هذا الإيصال مسترجع بالفعل" : "This receipt is already refunded");
            return;
        }

        const confirmMsg = isRTL 
            ? "هل أنت متأكد من وضع هذا الإيصال كـ (مسترجع)؟ سيتم إعادة الكميات للمخزون."
            : "Are you sure you want to mark this receipt as (Refunded)? Stock will be restored.";
        if (!confirm(confirmMsg)) return;

        try {
            setAuthLoading(true);
            // Restore stock
            for (const item of (receipt.cartItems || [])) {
                const pRef = doc(db, "products", item.id);
                const updates = { stock: increment(item.quantity) };
                if (item.selectedSize) {
                    updates[`sizeStocks.${item.selectedSize}`] = increment(item.quantity);
                }
                await updateDoc(pRef, updates);
            }

            // Update doc status to cancelled
            await updateDoc(doc(db, "orders", receipt.id), {
                status: 'cancelled',
                updatedAt: serverTimestamp()
            });

            alert(isRTL ? "تم تحديث حالة الإيصال كـ مسترجع بنجاح" : "Receipt status updated to refunded successfully");
        } catch (err) {
            console.error("Error refunding receipt:", err);
            alert(isRTL ? "فشل استرجاع الإيصال" : "Failed to refund receipt");
        } finally {
            setAuthLoading(false);
        }
    };

    // Print POS invoice — uses the shared invoice logo maintained in Image Settings.
    const triggerPrint = (order) => {
        const printWindow = window.open('', '_blank', 'width=330,height=500');
        if (!printWindow) {
            alert(isRTL ? 'يرجى السماح بالنوافذ المنبثقة للطبع' : 'Please allow popups for printing');
            return;
        }

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
        const toEnglishNumber = (value) => Number(value || 0).toLocaleString('en-US');
        const paymentLabel = order.paymentMethod === 'card' ? (isRTL ? 'محفظة جيب' : 'Jib Wallet')
            : order.paymentMethod === 'transfer' ? (isRTL ? 'تحويل بنكي' : 'Bank Transfer')
            : order.paymentMethod === 'cash' || !order.paymentMethod || order.paymentMethod === 'manual' ? (isRTL ? 'نقدي / كاش' : 'Cash')
            : order.paymentMethod;
        const completed = order.status !== 'cancelled';
        const statusLabel = completed ? (isRTL ? 'مكتمل' : 'Completed') : (isRTL ? 'مسترجع' : 'Refunded');
        const date = order.createdAt?.toDate?.() || (order.date && !Number.isNaN(new Date(order.date).getTime()) ? new Date(order.date) : new Date());
        const datePart = date.toLocaleDateString('en-GB');
        const timePart = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/am/i, isRTL ? 'ص' : 'AM').replace(/pm/i, isRTL ? 'م' : 'PM');
        const invoiceLogo = generalSettings?.invoiceLogo || '/admin-logo.png';
        const logoUrl = /^https?:\/\//i.test(invoiceLogo) ? invoiceLogo : `${window.location.origin}${invoiceLogo.startsWith('/') ? '' : '/'}${invoiceLogo}`;
        const fallbackLogo = `${window.location.origin}/admin-logo.png`;
        const items = order.cartItems || [];
        const subtotal = Number(order.subTotal ?? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0));
        const discount = Number(order.discount || 0);
        const total = Number(order.total ?? Math.max(0, subtotal - discount));
        const itemRows = items.map(item => {
            const details = [item.selectedSize || item.size, item.selectedColor]
                .filter(Boolean)
                .join(' · ')
                .replace(/#[a-fA-F0-9]{6}/g, '')
                .replace(/#[a-fA-F0-9]{3}/g, '')
                .replace(/\s*·\s*$/, '')
                .trim();
            return `<tr><td class="item-cell"><strong>${escapeHtml(item.title || '---')}</strong>${details ? `<small>${escapeHtml(details)}</small>` : ''}</td><td class="qty-cell">${toEnglishNumber(item.quantity || 1)}</td><td class="amount-cell">${toEnglishNumber(Number(item.price || 0) * Number(item.quantity || 1))}</td></tr>`;
        }).join('') || `<tr><td colspan="3" class="empty">${isRTL ? 'لا توجد أصناف في الفاتورة' : 'No items in this invoice'}</td></tr>`;
        const htmlContent = `<!doctype html><html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><base href="${window.location.origin}/"><title>${isRTL ? 'فاتورة نقطة البيع' : 'POS Invoice'}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style>
            @page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:'Cairo',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{width:80mm;margin:0 auto}.no-print{display:block}.print-btn{width:calc(100% - 6mm);margin:1.5mm 3mm 0;border:0;border-radius:7px;background:#111;color:#fff;padding:2mm;font:800 11px 'Cairo',sans-serif;cursor:pointer}.receipt{width:100%;padding:3mm 4mm 4mm;background:#fff}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:4mm;padding-bottom:4mm;border-bottom:1px dashed #dedede}.store{min-width:0;flex:1;padding-top:3mm;text-align:right}.store-name{font-size:15px;line-height:1.2;font-weight:900;letter-spacing:-.25px}.store-address,.store-phone{margin-top:.6mm;color:#414141;font-size:8px;font-weight:700;line-height:1.45}.brand-logo{width:15mm;height:15mm;flex:0 0 15mm;object-fit:cover;border:1px solid #e5e7eb;border-radius:4mm;background:#fff;padding:0;box-shadow:0 2px 7px rgba(15,23,42,.12)}.meta{padding:2.5mm 0;border-bottom:1px dashed #dedede}.meta-row{display:grid;grid-template-columns:1fr 1fr;gap:3mm;min-height:4.5mm;align-items:baseline;font-size:9px}.meta-key{color:#666;font-weight:700;text-align:right}.meta-value{font-weight:900;text-align:left;overflow-wrap:anywhere}.meta-value.ltr{direction:ltr;font-family:Arial,sans-serif}.meta-value.status{color:${completed ? '#149a63' : '#dc2626'}}.items{width:100%;border-collapse:collapse;margin-top:3mm;table-layout:fixed}.items th{padding:0 0 2mm;border-bottom:1px solid #d9d9d9;color:#555;font-size:10px;font-weight:900}.items th.item-head{text-align:right;width:57%}.items th.qty-head{text-align:center;width:15%}.items th.amount-head{text-align:left;width:28%}.items td{padding:2.4mm 0;vertical-align:top;border-bottom:1px dashed #e2e2e2;font-size:10px}.item-cell{text-align:right;padding-left:2mm!important}.item-cell strong{display:block;font-size:10px;line-height:1.45}.item-cell small{display:block;margin-top:1px;color:#686868;font-size:8px;font-weight:700}.qty-cell{text-align:center;font-family:Arial,sans-serif;font-weight:900}.amount-cell{text-align:left;direction:ltr;font-family:Arial,sans-serif;font-size:10px;font-weight:900}.empty{text-align:center;color:#777;padding:6mm 0!important}.totals{margin-top:3mm;border-bottom:1px dashed #dedede;padding-bottom:3mm}.total-row{display:flex;justify-content:space-between;align-items:center;padding:1.1mm 0;font-size:10px;font-weight:700}.total-row .money{direction:ltr;font-family:Arial,sans-serif;font-weight:900}.total-row.discount{color:#d33}.total-row.final{margin-top:1.2mm;padding-top:2mm;border-top:1px solid #d9d9d9;color:#111;font-size:14px;font-weight:900}.total-row.final .money{font-size:14px}.footer{padding-top:4mm;padding-bottom:0;text-align:center}.footer b{display:block;font-size:11px;font-weight:900}.footer span{display:block;margin-top:1mm;color:#666;font-family:Arial,sans-serif;font-size:10px;font-weight:700}@media print{.no-print{display:none!important}.receipt{padding:3mm 4mm 4mm}body{width:80mm}.brand-logo{object-fit:contain!important;padding:.7mm!important;background:#fff!important}}
        </style></head><body><button class="print-btn no-print" onclick="window.print()">${isRTL ? 'طباعة الفاتورة' : 'Print Invoice'}</button><main class="receipt"><header class="top"><section class="store"><div class="store-name">${escapeHtml(generalSettings?.storeName || (isRTL ? 'متجر ميلانو' : 'Milano Store'))}</div>${generalSettings?.storeAddress ? `<div class="store-address">${escapeHtml(generalSettings.storeAddress)}</div>` : ''}${generalSettings?.phoneNumber ? `<div class="store-phone" dir="ltr">${escapeHtml(generalSettings.phoneNumber)}</div>` : ''}</section><img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${isRTL ? 'شعار المتجر' : 'Store logo'}" onerror="this.onerror=null;this.src='${escapeHtml(fallbackLogo)}'"/></header><section class="meta"><div class="meta-row"><span class="meta-key">${isRTL ? 'رقم الإيصال:' : 'Receipt no.:'}</span><span class="meta-value ltr">${escapeHtml(order.orderId || order.id || '---')}</span></div><div class="meta-row"><span class="meta-key">${isRTL ? 'التاريخ:' : 'Date:'}</span><span class="meta-value ltr">${escapeHtml(`${datePart} ${timePart}`)}</span></div><div class="meta-row"><span class="meta-key">${isRTL ? 'العميل:' : 'Customer:'}</span><span class="meta-value">${escapeHtml(order.formData?.name || (isRTL ? 'زبون محلي' : 'Walk-in Customer'))}</span></div><div class="meta-row"><span class="meta-key">${isRTL ? 'طريقة الدفع:' : 'Payment:'}</span><span class="meta-value">${escapeHtml(paymentLabel)}</span></div><div class="meta-row"><span class="meta-key">${isRTL ? 'الحالة:' : 'Status:'}</span><span class="meta-value status">${escapeHtml(statusLabel)}</span></div></section><table class="items"><thead><tr><th class="item-head">${isRTL ? 'الصنف' : 'Item'}</th><th class="qty-head">${isRTL ? 'كمية' : 'Qty'}</th><th class="amount-head">${isRTL ? 'الإجمالي' : 'Total'}</th></tr></thead><tbody>${itemRows}</tbody></table><section class="totals"><div class="total-row"><span>${isRTL ? 'المجموع الفرعي:' : 'Subtotal:'}</span><span class="money">${toEnglishNumber(subtotal)} ${escapeHtml(currency)}</span></div>${discount > 0 ? `<div class="total-row discount"><span>${isRTL ? 'الخصم:' : 'Discount:'}</span><span class="money">- ${toEnglishNumber(discount)} ${escapeHtml(currency)}</span></div>` : ''}<div class="total-row final"><span>${isRTL ? 'الإجمالي النهائي:' : 'Final total:'}</span><span class="money">${toEnglishNumber(total)} ${escapeHtml(currency)}</span></div></section><footer class="footer"><b>${isRTL ? 'شكراً لزيارتكم!' : 'Thank you for visiting!'}</b></footer></main><script>window.onload=()=>{const receipt=document.querySelector('.receipt');const button=document.querySelector('.print-btn');const chromeHeight=Math.max(0,window.outerHeight-window.innerHeight);const contentHeight=(receipt?.getBoundingClientRect().height||0)+(button?.getBoundingClientRect().height||0)+22;const popupHeight=Math.min(850,Math.max(390,Math.ceil(contentHeight+chromeHeight)));window.resizeTo(330,popupHeight);window.focus();setTimeout(()=>window.print(),350)}</script></body></html>`;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // Generate Custom Date Sales Report
    const handleGenerateReport = () => {
        if (!reportStartDate || !reportEndDate) {
            alert(isRTL ? "يرجى تحديد تاريخ البداية والنهاية" : "Please select start and end dates");
            return;
        }

        const start = new Date(reportStartDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(reportEndDate);
        end.setHours(23, 59, 59, 999);

        const rangeReceipts = receipts.filter(r => {
            if (r.createdAt?.toDate) {
                const date = r.createdAt.toDate();
                return date >= start && date <= end;
            }
            return false;
        });

        let totalSales = 0;
        let totalCost = 0;
        let totalDelivery = 0;
        let activeCount = 0;
        let paymentBreakdown = { cash: 0, card: 0, transfer: 0 };
        
        rangeReceipts.forEach(r => {
            if (r.status !== 'cancelled') {
                activeCount += 1;
                totalSales += (r.total || 0);
                totalDelivery += (r.deliveryCost || 0);
                const pMethod = r.paymentMethod || 'cash';
                paymentBreakdown[pMethod] = (paymentBreakdown[pMethod] || 0) + (r.total || 0);

                // Cost calculation
                (r.cartItems || []).forEach(item => {
                    totalCost += (item.costPrice || 0) * (item.quantity || 1);
                });
            }
        });

        const netProfit = totalSales - totalDelivery - totalCost;

        setGeneratedReport({
            startDate: reportStartDate,
            endDate: reportEndDate,
            receiptsCount: activeCount,
            totalSales,
            netProfit,
            paymentBreakdown,
            receipts: rangeReceipts
        });
        
        setShowReportModal(true);
    };

    const handlePrintReport = () => {
        const htmlContent = `
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
              <title></title>
              <meta charset="UTF-8">
              <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
              <style>
                  @page {
                      size: A4 portrait;
                      margin: 6mm 10mm;
                  }
                  * { box-sizing: border-box; }
                  body { font-family: 'Cairo', sans-serif; padding: 0; background: #fff; margin: 0; direction: rtl; color: #111827; }
                  
                  .print-btn { background: #111827; color: #fff; border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: 'Cairo', sans-serif; font-size: 13px; margin-bottom: 12px; }
                  .print-btn:hover { background: #1f2937; }

                  .report-container { width: 100%; max-width: 800px; margin: 0 auto; padding: 10px; }

                  .store-header { display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 2px solid #9ca3af; padding-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }
                  .store-logo { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; }
                  .store-text { text-align: right; }
                  .store-name { font-size: 18px; font-weight: 900; color: #111827; line-height: 1.2; }
                  .store-info { font-size: 13px; font-weight: 600; color: #374151; margin-top: 3px; }
                  
                  .report-title { text-align: center; margin: 0; font-weight: 900; font-size: 15px; color: #111827; }
                  .report-date { text-align: center; margin: 2px 0 0 0; font-weight: 600; font-size: 11px; color: #6b7280; }
                  
                  .payment-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 4px; page-break-inside: avoid; break-inside: avoid; }
                  .payment-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; text-align: center; background: #f9fafb; }
                  .payment-label { display: block; font-size: 9px; font-weight: 700; color: #6b7280; }
                  .payment-val { display: block; font-size: 13px; font-weight: 900; margin-top: 2px; font-family: monospace; color: #111827; }
                  
                  .table-title { font-size: 11px; font-weight: 900; color: #374151; margin: 8px 0 4px 0; }
                  table { width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
                  th { background: #f3f4f6; padding: 5px 6px; text-align: right; border-bottom: 2px solid #d1d5db; font-weight: 700; font-size: 9px; color: #374151; }
                  td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 9.5px; }
                  tr { page-break-inside: avoid; break-inside: avoid; }
                  .completed-val { color: #10b981; font-weight: bold; }
                  .cancelled-val { color: #ef4444; font-weight: bold; }
                  
                  .bottom-totals { margin-top: 8px; border-top: 2px solid #e5e7eb; padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; page-break-inside: avoid; break-inside: avoid; }
                  .bottom-card-sales { border: 2px solid #2563eb; border-radius: 10px; padding: 6px 12px; text-align: center; background: #eff6ff; }
                  .bottom-card-profit { border: 2px solid #10b981; border-radius: 10px; padding: 6px 12px; text-align: center; background: #f0fdf4; }
                  .bottom-card-count { border: 2px solid #8b5cf6; border-radius: 10px; padding: 6px 12px; text-align: center; background: #f5f3ff; }
                  
                  @media print {
                      .print-btn { display: none !important; }
                      .report-container { padding: 0 !important; max-width: 100% !important; }
                      body { padding: 0 !important; }
                  }
              </style>
          </head>
          <body>
              <div class="report-container">
                  <button class="print-btn" onclick="window.print()">${isRTL ? 'طباعة التقرير' : 'Print Report'}</button>

                  <div class="store-header">
                      <div class="store-text">
                          <div class="store-name">${generalSettings?.storeName || (isRTL ? 'متجر ميلانو الرياضي' : 'Milano Sports')}</div>
                          ${generalSettings?.storeAddress ? `<div class="store-info">${isRTL ? 'العنوان : ' : 'Address: '}${generalSettings.storeAddress}</div>` : ''}
                          ${generalSettings?.phoneNumber ? `<div class="store-info">${isRTL ? 'الهاتف : ' : 'Phone: '}${generalSettings.phoneNumber}</div>` : ''}
                      </div>
                      <img class="store-logo" src="${generalSettings?.storeLogo || '/logo-icon.jpg'}" alt="شعار المحل" onerror="this.style.display='none'" />
                  </div>

                  <h1 class="report-title">${isRTL ? 'ملخص مبيعات نقطة البيع' : 'POS Sales Report'}</h1>
                  <p class="report-date">${isRTL ? `من تاريخ ${generatedReport.startDate} إلى تاريخ ${generatedReport.endDate}` : `From ${generatedReport.startDate} to ${generatedReport.endDate}`}</p>

                  <h3 class="table-title">${isRTL ? 'تفصيل طرق الدفع' : 'Payment Method Details'}</h3>
                  <div class="payment-grid">
                      <div class="payment-card">
                          <span class="payment-label">${isRTL ? 'نقدي (كاش)' : 'Cash'}</span>
                          <span class="payment-val">${(generatedReport.paymentBreakdown.cash || 0).toLocaleString()} ${currency}</span>
                      </div>
                      <div class="payment-card">
                          <span class="payment-label">${isRTL ? 'محفظة جيب' : 'Jib Wallet'}</span>
                          <span class="payment-val">${(generatedReport.paymentBreakdown.card || 0).toLocaleString()} ${currency}</span>
                      </div>
                      <div class="payment-card">
                          <span class="payment-label">${isRTL ? 'تحويل بنكي' : 'Transfer'}</span>
                          <span class="payment-val">${(generatedReport.paymentBreakdown.transfer || 0).toLocaleString()} ${currency}</span>
                      </div>
                  </div>

                  <h3 class="table-title">${isRTL ? 'سجل الإيصالات خلال الفترة' : 'Invoices List'}</h3>
                  <table>
                      <thead>
                          <tr>
                              <th style="width:32px; text-align:center;">#</th>
                              <th style="text-align:right;">${isRTL ? 'رقم الفاتورة' : 'Invoice'}</th>
                              <th style="text-align:right;">${isRTL ? 'اسم العميل' : 'Customer'}</th>
                              <th style="text-align:right;">${isRTL ? 'طريقة الدفع' : 'Payment'}</th>
                              <th style="text-align:right;">${isRTL ? 'التاريخ والوقت' : 'Date & Time'}</th>
                              <th style="text-align:left;">${isRTL ? 'إجمالي الطلب' : 'Total'}</th>
                              <th style="text-align:center;">${isRTL ? 'الحاله' : 'Status'}</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${generatedReport.receipts.map((r, idx) => {
                              const paymentLabel = r.paymentMethod === 'card' ? (isRTL ? 'محفظة جيب' : 'Jib Wallet') :
                                  r.paymentMethod === 'transfer' ? (isRTL ? 'تحويل بنكي' : 'Bank Transfer') :
                                  (isRTL ? 'نقدي / كاش' : 'Cash');
                              return `
                              <tr>
                                  <td style="text-align:center; color:#9ca3af;">${idx + 1}</td>
                                  <td style="font-family:monospace; font-weight:bold;">${r.orderId}</td>
                                  <td style="font-weight: bold;">${r.formData?.name || (isRTL ? 'زبون محلي' : 'Walk-in')}</td>
                                  <td>${paymentLabel}</td>
                                  <td>${r.formattedDate}</td>
                                  <td style="text-align:left; font-weight: 900; font-family: monospace;">${r.total?.toLocaleString()} ${currency}</td>
                                  <td style="text-align:center;">
                                      <span class="${r.status === 'cancelled' ? 'cancelled-val' : 'completed-val'}">
                                          ${r.status === 'cancelled' ? (isRTL ? 'مسترجع' : 'Refunded') : (isRTL ? 'مكتمل' : 'Completed')}
                                      </span>
                                  </td>
                              </tr>
                              `;
                          }).join('')}
                          ${generatedReport.receipts.length === 0 ? '<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding:15px;">' + (isRTL ? 'لا توجد فواتير في هذه الفترة' : 'No invoices found') + '</td></tr>' : ''}
                      </tbody>
                  </table>
                  
                  <div class="bottom-totals">
                      <div class="bottom-card-sales">
                          <span style="display: block; font-size: 9px; font-weight: 700; color: #4b5563;">${isRTL ? 'الإجمالي النهائي' : 'Final Total'}</span>
                          <span style="display: block; font-size: 14px; font-weight: 900; color: #2563eb; margin-top: 2px; font-family: monospace;">${generatedReport.totalSales.toLocaleString()} ${currency}</span>
                      </div>
                      <div class="bottom-card-profit">
                          <span style="display: block; font-size: 9px; font-weight: 700; color: #4b5563;">${isRTL ? 'صافي الأرباح' : 'Net Profit'}</span>
                          <span style="display: block; font-size: 14px; font-weight: 900; color: #10b981; margin-top: 2px; font-family: monospace;">${generatedReport.netProfit.toLocaleString()} ${currency}</span>
                      </div>
                      <div class="bottom-card-count">
                          <span style="display: block; font-size: 9px; font-weight: 700; color: #4b5563;">${isRTL ? 'عدد الفواتير' : 'Transactions'}</span>
                          <span style="display: block; font-size: 14px; font-weight: 900; color: #8b5cf6; margin-top: 2px; font-family: monospace;">${generatedReport.receiptsCount}</span>
                      </div>
                  </div>
              </div>
          </body>
          </html>
        `;
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) {
            alert("يرجى السماح بالنوافذ المنبثقة");
            return;
        }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0b] font-['Cairo']">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-bold">{isRTL ? "جاري التحقق..." : "Checking permissions..."}</p>
                </div>
            </div>
        );
    }

    // 1. Render Login Screen if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0b] flex items-center justify-center p-4 font-['Cairo']" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="max-w-md w-full bg-white dark:bg-[#1c1c1e] rounded-[32px] p-8 shadow-2xl border border-gray-100 dark:border-white/5">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-[24px] flex items-center justify-center mb-4 text-blue-600 dark:text-blue-500">
                            <Calculator size={40} />
                        </div>
                        <h1 className="text-2xl font-black text-gray-800 dark:text-white">
                            {isRTL ? "نقطة بيع ميلانو" : "Milano POS"}
                        </h1>
                        <p className="text-gray-400 font-bold mt-2">
                            {isRTL ? "تسجيل دخول كاشير المحل" : "Staff Cashier Login"}
                        </p>
                    </div>

                    {loginError && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-bold text-center">
                            {loginError}
                        </div>
                    )}

                    <form onSubmit={handleWorkerLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-700 dark:text-gray-300 block">
                                {isRTL ? "اسم المستخدم" : "Username"}
                            </label>
                            <input
                                type="text"
                                value={loginUsername}
                                onChange={(e) => setLoginUsername(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-2xl py-4 px-4 outline-none focus:border-blue-500 text-gray-900 dark:text-white font-bold text-right"
                                placeholder={isRTL ? "اسم المستخدم" : "Username"}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-700 dark:text-gray-300 block">
                                {isRTL ? "كلمة المرور" : "Password"}
                            </label>
                            <input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-2xl py-4 px-4 outline-none focus:border-blue-500 text-gray-900 dark:text-white font-bold text-right"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                        >
                            {isRTL ? "تسجيل الدخول" : "Log In"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 2. Render Printable Invoice Mode
    if (printMode && selectedOrderToPrint) {
        return (
            <div className="bg-white p-0 m-0 print:block">
                <InvoiceTemplate 
                    ref={printRef} 
                    orders={[selectedOrderToPrint]} 
                    lang={lang} 
                    hideHeader={true} 
                    generalSettings={generalSettings} 
                />
            </div>
        );
    }

    // 3. Main POS Workstation Layout
    return (
        <div className={`min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0b] flex flex-col font-['Cairo'] ${standalone ? 'p-4 md:p-6' : 'p-0'} transition-colors duration-300`} dir={isRTL ? 'rtl' : 'ltr'}>
            
            {posSubView === 'dashboard' ? (
                // --- POS DASHBOARD LANDING PAGE ---
                <div className="flex-1 max-w-6xl mx-auto w-full p-6 flex flex-col gap-6 overflow-y-auto">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                        <div>
                            <h2 className="text-2xl font-black text-gray-800 dark:text-white">
                                {isRTL ? "نقطة البيع" : "Point of Sale"}
                            </h2>
                            <p className="text-xs text-gray-400 font-bold mt-1">
                                {isRTL ? "اختر إجراء للمتابعة" : "Select an action to proceed"}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/5">
                                {isRTL ? `المشغل: ${isAdminManager ? 'المدير العام' : 'كاشير المحل'}` : `Operator: ${isAdminManager ? 'General Manager' : 'Cashier'}`}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="p-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                title={isRTL ? "تسجيل الخروج" : "Logout"}
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>

                    {/* 3 Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Card 1: Enter Terminal */}
                        <div
                            onClick={() => setPosSubView('sell')}
                            className="group cursor-pointer bg-white dark:bg-[#1c1c1e] p-6 md:p-8 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-blue-500 transition-all flex flex-col items-center text-center"
                        >
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                                <Monitor size={28} />
                            </div>
                            <h3 className="text-sm font-black text-gray-800 dark:text-white mb-1.5">
                                {isRTL ? "تسجيل الدخول لنقطة البيع" : "Open POS Terminal"}
                            </h3>
                            <p className="text-[10px] text-gray-400 font-bold">
                                {isRTL ? "الدخول لشاشة الكاشير وبدء البيع" : "Enter cashier mode and start selling"}
                            </p>
                        </div>

                        {/* Card 2: Receipts Log */}
                        {(isAdminManager || workerPermissions.allowViewHistory) ? (
                            <div
                                onClick={() => setPosSubView('receipts')}
                                className="group cursor-pointer bg-white dark:bg-[#1c1c1e] p-6 md:p-8 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-purple-500 transition-all flex flex-col items-center text-center"
                            >
                                <div className="w-16 h-16 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                                    <History size={28} />
                                </div>
                                <h3 className="text-sm font-black text-gray-800 dark:text-white mb-1.5">
                                    {isRTL ? "سجل الإيصالات (تعديل/طباعة)" : "View Receipts (Edit/Print)"}
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold">
                                    {isRTL ? "سجل المبيعات، المرتجعات، وطباعة التقارير" : "Sales history, returns, and reports"}
                                </p>
                            </div>
                        ) : (
                            <div className="bg-gray-50/50 dark:bg-white/5 opacity-40 p-6 md:p-8 rounded-[28px] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center select-none pointer-events-none">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 text-gray-400 rounded-2xl flex items-center justify-center mb-4">
                                    <History size={28} />
                                </div>
                                <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 mb-1.5">
                                    {isRTL ? "سجل الإيصالات (مغلق)" : "View Receipts (Locked)"}
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold">
                                    {isRTL ? "ليس لديك صلاحية لعرض سجل المبيعات" : "You do not have permission to view history"}
                                </p>
                            </div>
                        )}

                        {/* Card 3: This Month's Sales */}
                        <div className="bg-white dark:bg-[#1c1c1e] p-6 md:p-8 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center relative overflow-hidden select-none">
                            <div className="w-16 h-16 bg-green-50 dark:bg-green-500/10 text-green-500 rounded-2xl flex items-center justify-center mb-4">
                                <BarChart3 size={28} />
                            </div>
                            <h3 className="text-sm font-black text-gray-800 dark:text-white mb-1">
                                {isRTL ? "مبيعات اليوم" : "Today's Sales"}
                            </h3>
                            <div className="text-lg font-black text-green-600 dark:text-green-400 mt-1">
                                {todaySalesSum.toLocaleString()} <span className="text-[10px] font-bold text-gray-400">{currency}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-bold mt-1">
                                {todaySalesCount} {isRTL ? "فاتورة" : "invoices"}
                            </span>
                        </div>
                    </div>

                    {/* Recent Transactions Table */}
                    <div className="bg-white dark:bg-[#1c1c1e] rounded-[28px] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[300px]">
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                            <h3 className="font-black text-xs text-gray-800 dark:text-white">
                                {isRTL ? "آخر العمليات" : "Recent Activity"}
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-start text-xs font-bold text-gray-800 dark:text-gray-200">
                                <thead className="bg-gray-50 dark:bg-white/5 text-gray-400 font-black uppercase text-[10px] border-b border-gray-100 dark:border-white/5 sticky top-0">
                                    <tr>
                                        <th className="p-3 text-start">{isRTL ? "رقم الإيصال" : "Receipt ID"}</th>
                                        <th className="p-3 text-start">{isRTL ? "الوقت" : "Time"}</th>
                                        <th className="p-3 text-start">{isRTL ? "المبلغ" : "Amount"}</th>
                                        <th className="p-3 text-start">{isRTL ? "الحالة" : "Status"}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipts.slice(0, 5).map(receipt => (
                                        <tr key={receipt.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/30 dark:hover:bg-white/5 transition-colors">
                                            <td className="p-3 font-mono font-black">{receipt.orderId}</td>
                                            <td className="p-3 text-gray-500">
                                                {receipt.formattedTime || receipt.formattedDate}
                                            </td>
                                            <td className="p-3 font-black text-gray-900 dark:text-white">
                                                {receipt.total?.toLocaleString()} {currency}
                                            </td>
                                            <td className="p-3">
                                                {receipt.status === 'cancelled' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                        <span>{isRTL ? "مسترجع" : "Refunded"}</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-green-100 dark:bg-green-500/15 text-green-600 dark:text-green-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                        <span>{isRTL ? "مكتمل" : "Completed"}</span>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {visibleReceipts.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="p-10 text-center text-gray-400 font-bold italic">
                                                {isRTL ? "لا توجد عمليات مبيعات اليوم بعد" : "No POS activity found"}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : posSubView === 'sell' ? (
                // --- TAB 1: SELL SCREEN ---
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                    {/* Header with Back Button */}
                    <div className="bg-white dark:bg-[#1c1c1e] p-2.5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPosSubView('dashboard')}
                                className="p-1.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-all text-gray-500 dark:text-white flex items-center justify-center"
                                title={isRTL ? "العودة للوحة تحكم نقطة البيع" : "Back to POS Dashboard"}
                            >
                                {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                            </button>
                            <div>
                                <h2 className="text-sm font-black text-gray-800 dark:text-white leading-tight">
                                    {isRTL ? "صالة البيع المباشر" : "POS Sell Screen"}
                                </h2>
                                <span className="text-[9px] text-gray-400 font-bold leading-none">
                                    {isRTL ? `المشغل: ${isAdminManager ? 'المدير العام' : 'كاشير المحل'}` : `Operator: ${isAdminManager ? 'Admin' : 'Cashier'}`}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {(isAdminManager || workerPermissions.allowViewHistory) && (
                                <button
                                    onClick={() => setPosSubView('receipts')}
                                    className="px-3 py-1.5 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-black text-[10px] rounded-lg transition-all flex items-center gap-1.5"
                                >
                                    <History size={12} />
                                    <span>{isRTL ? "سجل الإيصالات" : "Receipts Log"}</span>
                                </button>
                            )}
                            <button
                                onClick={handleLogout}
                                className="p-2 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center"
                                title={isRTL ? "تسجيل الخروج" : "Logout"}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden">
                    
                    {/* Left Panel: Catalog Grid */}
                    <div className="flex-1 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col overflow-hidden h-[calc(100vh-10rem)]">
                        {/* Search and Filters */}
                        <div className="p-2.5 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute top-3.5 right-3 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={isRTL ? "بحث عن منتج بالاسم أو الكود..." : "Search by name or code..."}
                                    className="w-full bg-gray-50 dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-xl py-2 pr-10 pl-4 outline-none focus:border-blue-500 font-bold text-sm text-gray-900 dark:text-white text-right"
                                />
                            </div>
                            
                            {/* Store Offers Toggle Switch */}
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/5 self-center shrink-0">
                                <span className="text-[10px] font-black text-gray-500 dark:text-gray-300">
                                    {isRTL ? "عروض المتجر:" : "Store Offers:"}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={applyStoreOffers} 
                                        onChange={(e) => setApplyStoreOffers(e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-red-500 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                                <span className={`text-[10px] font-bold flex items-center gap-1 ${applyStoreOffers ? 'text-green-600' : 'text-red-500'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${applyStoreOffers ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span>{applyStoreOffers ? (isRTL ? "تفعيل" : "Active") : (isRTL ? "مغلق" : "Closed")}</span>
                                </span>
                            </div>

                            {/* Categories Dropdown - أيقونة + كلمة واضحة */}
                            <div className="relative shrink-0">
                                <button
                                    onClick={() => setShowCategories(!showCategories)}
                                    className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${showCategories 
                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800' 
                                        : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                >
                                    <Layers size={14} />
                                    <span>{isRTL ? 'الأقسام' : 'Categories'}</span>
                                </button>
                                {showCategories && (
                                    <>
                                        <div className="absolute top-full left-0 mt-1.5 bg-white dark:bg-[#1c1c1e] rounded-xl border border-gray-200 dark:border-white/10 shadow-xl z-50 p-2 min-w-[140px] max-h-[250px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex flex-col gap-0.5">
                                                {categories.map(cat => (
                                                    <button
                                                        key={cat}
                                                        onClick={() => {
                                                            setSelectedCategory(cat);
                                                            setShowCategories(false);
                                                        }}
                                                        className={`w-full text-right px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${selectedCategory === cat 
                                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' 
                                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                                    >
                                                        {cat === 'all' ? (isRTL ? 'الكل' : 'All') : cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowCategories(false)} />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Catalog Items Grid */}
                        <div className="flex-1 overflow-y-auto p-2.5 scrollbar-hide">
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                                {filteredProducts.map(product => {
                                    const hasDiscount = applyStoreOffers && product.priceAfterDiscount && Number(product.priceAfterDiscount) < Number(product.price);
                                    const finalPrice = hasDiscount ? Number(product.priceAfterDiscount) : Number(product.price);

                                    return (
                                        <div
                                            key={product.id}
                                            onClick={() => {
                                                const sizeVals = product.variants?.find(v => v.type === 'size')?.values || [];
                                                if (sizeVals.length > 0) {
                                                    // Open size selector modal
                                                    const initialQtys = {};
                                                    sizeVals.forEach(s => { initialQtys[s] = 0; });
                                                    setSizeModalProduct(product);
                                                    setSizeModalQtys(initialQtys);
                                                    setShowSizeModal(true);
                                                } else {
                                                    handleAddToCart(product);
                                                }
                                            }}
                                            className={`group cursor-pointer border border-gray-100 dark:border-white/5 rounded-2xl p-2 hover:border-blue-500 hover:shadow-md transition-all flex flex-col justify-between ${Number(product.stock || 0) <= 0 ? 'opacity-50 bg-gray-100 dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-white/5'}`}
                                        >
                                            <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-white dark:bg-[#0d0d0e] flex items-center justify-center relative">
                                                {product.mainImage ? (
                                                    <img 
                                                        src={product.mainImage} 
                                                        alt={product.name} 
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                ) : (
                                                    <ShoppingCart size={32} className="text-gray-300" />
                                                )}
                                                {hasDiscount && (
                                                    <span className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-sm">
                                                        {isRTL ? `خصم ${product.discount}%` : `Discount ${product.discount}%`}
                                                    </span>
                                                )}
                                                {Number(product.stock || 0) <= 0 && (
                                                    <div className="absolute inset-0 bg-red-500/20 rounded-xl flex items-center justify-center z-10">
                                                        <span className="text-white font-black text-sm bg-red-500/70 px-4 py-1.5 rounded-full shadow-lg border-2 border-red-300/60">
                                                            {isRTL ? 'نفذ المخزون' : 'Out of Stock'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-xs text-gray-800 dark:text-white truncate" title={product.name}>
                                                {product.name}
                                            </h3>
                                            <div className="flex justify-between items-center mt-2.5 pt-1 border-t border-gray-100 dark:border-white/5">
                                                <span className="text-[10px] text-gray-400 font-mono italic">
                                                    {product.code || '---'}
                                                </span>
                                                <div className="flex flex-col items-end">
                                                    {hasDiscount && (
                                                        <span className="text-[9px] text-gray-400 line-through">
                                                            {Number(product.price).toLocaleString()}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                                                        {finalPrice.toLocaleString()} {currency}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredProducts.length === 0 && (
                                    <div className="col-span-full flex flex-col items-center justify-center text-gray-400 py-20">
                                        <ShoppingCart size={48} className="opacity-20 mb-3" />
                                        <p className="font-bold text-sm">{isRTL ? "لا توجد منتجات تطابق البحث" : "No products match"}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Cart Workspace */}
                    <div className="w-full lg:w-[420px] bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex flex-col h-[calc(100vh-10rem)] overflow-hidden">
                        {/* Cart Header */}
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <User size={16} className="text-gray-400" />
                                <span className="text-xs font-black text-gray-700 dark:text-white">
                                    {editingOrderId ? (isRTL ? `تعديل طلب ${lastCreatedOrderId || ''}` : `Editing Order ${lastCreatedOrderId || ''}`) : (isRTL ? "فاتورة بيع مباشر" : "Walk-in Invoice")}
                                </span>
                            </div>
                            <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-black px-3 py-1 rounded-full">
                                {cartItems.length} {isRTL ? "منتجات" : "Items"}
                            </span>
                        </div>

                        {/* Cart Items List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                            {cartItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <ShoppingCart size={40} className="opacity-10 mb-2" />
                                    <p className="font-bold text-xs">{isRTL ? "السلة فارغة" : "Cart is empty"}</p>
                                </div>
                            ) : (
                                cartItems.map((item, index) => (
                                    <div key={`${item.id}-${item.selectedSize}-${item.selectedColor}-${index}`} className="p-3 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-col gap-2 relative overflow-hidden group">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white">
                                                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-xs font-black text-gray-800 dark:text-white truncate" title={item.title}>
                                                        {item.title}
                                                    </h4>
                                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                                        {item.price.toLocaleString()} {currency}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleRemoveFromCart(index)}
                                                className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>

                                        {/* Variant Selectors inside Cart */}
                                        <div className="flex flex-wrap gap-2 items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
                                            <div className="flex gap-1.5">
                                                {/* Size Selector */}
                                                {item.sizeOptions?.length > 0 && (
                                                    <select
                                                        value={item.selectedSize}
                                                        onChange={(e) => handleUpdateCartItem(index, 'selectedSize', e.target.value)}
                                                        className="bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-0.5 text-[10px] font-bold outline-none text-gray-700 dark:text-gray-200"
                                                    >
                                                        {item.sizeOptions.map(sz => (
                                                            <option key={sz} value={sz}>{sz}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                
                                                {/* Color Selector */}
                                                {item.colorOptions?.length > 0 && (
                                                    <select
                                                        value={item.selectedColor}
                                                        onChange={(e) => handleUpdateCartItem(index, 'selectedColor', e.target.value)}
                                                        className="bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-0.5 text-[10px] font-bold outline-none text-gray-700 dark:text-gray-200"
                                                    >
                                                        {item.colorOptions.map(cl => (
                                                            <option key={cl} value={cl}>{cl}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>

                                            {/* Quantity controls */}
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleUpdateCartItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                                                    className="p-1 bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <Minus size={12} className="text-gray-600 dark:text-gray-300" />
                                                </button>
                                                <span className="text-xs font-black w-5 text-center text-gray-800 dark:text-white font-mono">
                                                    {item.quantity}
                                                </span>
                                                <button 
                                                    onClick={() => handleUpdateCartItem(index, 'quantity', item.quantity + 1)}
                                                    className="p-1 bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <Plus size={12} className="text-gray-600 dark:text-gray-300" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Customer Form and Totals Panel */}
                        <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 space-y-4">
                            {/* Optional Customer info */}
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={checkoutName}
                                    onChange={(e) => setCheckoutName(e.target.value)}
                                    placeholder={isRTL ? "اسم العميل (اختياري)" : "Customer name (optional)"}
                                    className="bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-bold text-right"
                                />
                                <input
                                    type="text"
                                    value={checkoutPhone}
                                    onChange={(e) => setCheckoutPhone(e.target.value)}
                                    placeholder={isRTL ? "رقم الهاتف (اختياري)" : "Phone number (optional)"}
                                    className="bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 font-bold text-right"
                                />
                            </div>

                            {/* Totals and Discounts */}
                            <div className="space-y-2 text-xs font-bold text-gray-600 dark:text-gray-400">
                                <div className="flex justify-between">
                                    <span>{isRTL ? "المجموع الفرعي" : "Subtotal"}</span>
                                    <span className="text-gray-800 dark:text-white font-mono">{calculateSubtotal().toLocaleString()} {currency}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>{isRTL ? "خصم إضافي بالفاتورة" : "Additional Invoice Discount"}</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={customDiscount}
                                            disabled={!(isAdminManager || workerPermissions.allowDiscount)}
                                            onChange={(e) => setCustomDiscount(Math.max(0, Number(e.target.value)))}
                                            className="w-24 bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1 text-center text-sm outline-none text-gray-800 dark:text-white font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <span>{currency}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-base font-black text-gray-900 dark:text-white pt-2.5 border-t border-gray-200 dark:border-white/5">
                                    <span>{isRTL ? "الإجمالي النهائي" : "Final Total"}</span>
                                    <span className="text-blue-600 dark:text-blue-400 font-mono">{calculateTotal().toLocaleString()} {currency}</span>
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => (isAdminManager || workerPermissions.allowChangePayment) && setPaymentMethod('cash')}
                                    disabled={!(isAdminManager || workerPermissions.allowChangePayment)}
                                    className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                                        paymentMethod === 'cash' 
                                            ? 'border-green-500/60 bg-green-500/15 dark:bg-green-400/10 text-green-700 dark:text-green-300 font-black'
                                            : 'border-gray-200 dark:border-white/5 text-gray-400'
                                    } ${!(isAdminManager || workerPermissions.allowChangePayment) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                >
                                    <DollarSign size={16} />
                                    <span className="text-[10px]">{isRTL ? "نقدي / كاش" : "Cash"}</span>
                                </button>
                                <button
                                    onClick={() => (isAdminManager || workerPermissions.allowChangePayment) && setPaymentMethod('card')}
                                    disabled={!(isAdminManager || workerPermissions.allowChangePayment)}
                                    className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                                        paymentMethod === 'card' 
                                            ? 'border-purple-500/60 bg-purple-500/15 dark:bg-purple-400/10 text-purple-700 dark:text-purple-300 font-black'
                                            : 'border-gray-200 dark:border-white/5 text-gray-400'
                                    } ${!(isAdminManager || workerPermissions.allowChangePayment) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                >
                                    <CreditCard size={16} />
                                    <span className="text-[10px]">{isRTL ? "محفظة جيب" : "Jib Wallet"}</span>
                                </button>
                                <button
                                    onClick={() => (isAdminManager || workerPermissions.allowChangePayment) && setPaymentMethod('transfer')}
                                    disabled={!(isAdminManager || workerPermissions.allowChangePayment)}
                                    className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                                        paymentMethod === 'transfer' 
                                            ? 'border-cyan-500/60 bg-cyan-500/15 dark:bg-cyan-400/10 text-cyan-700 dark:text-cyan-300 font-black'
                                            : 'border-gray-200 dark:border-white/5 text-gray-400'
                                    } ${!(isAdminManager || workerPermissions.allowChangePayment) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                >
                                    <ArrowLeftRight size={16} />
                                    <span className="text-[10px]">{isRTL ? "تحويل بنكي" : "Bank Transfer"}</span>
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                {editingOrderId && (
                                    <button
                                        onClick={() => {
                                            setCartItems([]);
                                            setCustomDiscount(0);
                                            setCheckoutName('');
                                            setCheckoutPhone('');
                                            setEditingOrderId(null);
                                            setPaymentMethod('cash');
                                        }}
                                        className="py-3 px-4 bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-xl font-black text-xs hover:bg-gray-300 dark:hover:bg-white/10 transition-colors"
                                    >
                                        {isRTL ? "إلغاء التعديل" : "Cancel Edit"}
                                    </button>
                                )}
                                <button
                                    onClick={handlePOSCheckout}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    <Calculator size={16} />
                                    {editingOrderId ? (isRTL ? "تحديث وحفظ الفاتورة" : "Update and Save") : (isRTL ? "تأكيد البيع والدفع" : "Complete & Pay")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ) : (
                // --- TAB 2: RECEIPTS LOG ---
                <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                    {/* Header with Back Button */}
                    <div className="bg-white dark:bg-[#1c1c1e] py-2 px-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setPosSubView('dashboard')}
                                className="p-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-all text-gray-500 dark:text-white flex items-center justify-center"
                                title={isRTL ? "العودة للوحة تحكم نقطة البيع" : "Back to POS Dashboard"}
                            >
                                {isRTL ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
                            </button>
                            <div>
                                <h2 className="text-sm font-black text-gray-800 dark:text-white leading-none">
                                    {isRTL ? "سجل الإيصالات والتقارير" : "POS Receipts Log"}
                                </h2>
                                <span className="text-[9px] text-gray-400 font-bold mt-1 block">
                                    {isRTL ? "إدارة المبيعات والمرتجعات وطباعة التقارير" : "Manage sales, returns and print reports"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPosSubView('sell')}
                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-[10px] rounded-lg transition-all flex items-center gap-1.5"
                            >
                                <Monitor size={12} />
                                <span>{isRTL ? "صالة البيع" : "POS Terminal"}</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="p-2 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center"
                                title={isRTL ? "تسجيل الخروج" : "Logout"}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-white dark:bg-[#1c1c1e] rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm pt-4 pb-5 px-5 flex flex-col gap-2 overflow-hidden h-[calc(100vh-10rem)]">
                    {/* Payment totals use the same visible period/search filter as the invoice table. */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-1">
                        {[
                            { id: 'cash', label: isRTL ? 'نقدي / كاش' : 'Cash', cls: 'bg-green-500/15 text-green-700 dark:text-green-300' },
                            { id: 'card', label: isRTL ? 'محفظة جيب' : 'Jib Wallet', cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300' },
                            { id: 'transfer', label: isRTL ? 'تحويل بنكي' : 'Bank Transfer', cls: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300' }
                        ].map(method => (
                            <div key={method.id} className={`rounded-2xl px-4 py-3 text-center font-black ${method.cls}`}>
                                <div className="text-xs">{method.label}</div>
                                <div className="font-mono text-lg mt-1">{paymentTotals[method.id].toLocaleString()} {currency}</div>
                            </div>
                        ))}
                    </div>
                    {/* Receipts Summary Header */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-gray-400 font-bold block uppercase">{isRTL ? "إجمالي مبيعات الشهر" : "Month's Total Sales"}</span>
                                <h3 className="text-xl font-black text-gray-800 dark:text-white mt-1 font-mono">{monthlySalesSum.toLocaleString()} {currency}</h3>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-500/10 text-green-500 flex items-center justify-center">
                                <DollarSign size={20} />
                            </div>
                        </div>
                        
                        <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-gray-400 font-bold block uppercase">{isRTL ? "عدد إيصالات الشهر" : "Month's Receipts Count"}</span>
                                <h3 className="text-xl font-black text-gray-800 dark:text-white mt-1 font-mono">{monthlySalesCount}</h3>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                <Printer size={20} />
                            </div>
                        </div>

                        {/* Date Range Report Tools — Admin Only */}
                        {isAdminManager && (
                        <div className="md:col-span-2 p-4 bg-blue-50/30 dark:bg-blue-500/5 rounded-2xl border border-blue-500/10 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex flex-col">
                                    <label className="text-[9px] text-gray-400 font-black mb-1">{isRTL ? "تحديد الفترة" : "Period"}</label>
                                    <div className="relative">
                                        <Calendar className={`absolute top-2.5 ${isRTL ? 'right-2' : 'left-2'} text-gray-400`} size={12} />
                                        <select
                                            value={reportPeriod}
                                            onChange={(e) => setReportPeriod(e.target.value)}
                                            className={`bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-lg ${isRTL ? 'pr-6 pl-2' : 'pl-6 pr-2'} py-1 text-xs outline-none font-bold text-gray-800 dark:text-white`}
                                        >
                                            <option value="custom">{isRTL ? "فترة مخصصة" : "Custom Period"}</option>
                                            <option value="this_week">{isRTL ? "هذا الأسبوع" : "This Week"}</option>
                                            <option value="this_month">{isRTL ? "هذا الشهر" : "This Month"}</option>
                                            <option value="this_year">{isRTL ? "هذه السنة" : "This Year"}</option>
                                            <option value="month_1">{isRTL ? "شهر 1 (يناير)" : "Month 1 (Jan)"}</option>
                                            <option value="month_2">{isRTL ? "شهر 2 (فبراير)" : "Month 2 (Feb)"}</option>
                                            <option value="month_3">{isRTL ? "شهر 3 (مارس)" : "Month 3 (Mar)"}</option>
                                            <option value="month_4">{isRTL ? "شهر 4 (أبريل)" : "Month 4 (Apr)"}</option>
                                            <option value="month_5">{isRTL ? "شهر 5 (مايو)" : "Month 5 (May)"}</option>
                                            <option value="month_6">{isRTL ? "شهر 6 (يونيو)" : "Month 6 (Jun)"}</option>
                                            <option value="month_7">{isRTL ? "شهر 7 (يوليو)" : "Month 7 (Jul)"}</option>
                                            <option value="month_8">{isRTL ? "شهر 8 (أغسطس)" : "Month 8 (Aug)"}</option>
                                            <option value="month_9">{isRTL ? "شهر 9 (سبتمبر)" : "Month 9 (Sep)"}</option>
                                            <option value="month_10">{isRTL ? "شهر 10 (أكتوبر)" : "Month 10 (Oct)"}</option>
                                            <option value="month_11">{isRTL ? "شهر 11 (نوفمبر)" : "Month 11 (Nov)"}</option>
                                            <option value="month_12">{isRTL ? "شهر 12 (ديسمبر)" : "Month 12 (Dec)"}</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex flex-col">
                                        <label className="text-[9px] text-gray-400 font-black mb-1">{isRTL ? "من تاريخ" : "From"}</label>
                                        <input
                                            type="date"
                                            value={reportStartDate}
                                            onChange={(e) => {
                                                setReportPeriod('custom');
                                                setReportStartDate(e.target.value);
                                            }}
                                            className="bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1 text-xs outline-none font-bold text-gray-800 dark:text-white"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[9px] text-gray-400 font-black mb-1">{isRTL ? "إلى تاريخ" : "To"}</label>
                                        <input
                                            type="date"
                                            value={reportEndDate}
                                            onChange={(e) => {
                                                setReportPeriod('custom');
                                                setReportEndDate(e.target.value);
                                            }}
                                            className="bg-white dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1 text-xs outline-none font-bold text-gray-800 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <button
                                onClick={handleGenerateReport}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/10 self-end flex items-center gap-1.5"
                            >
                                <BarChart3 size={14} />
                                <span>{isRTL ? "عرض تقرير المبيعات" : "View Sales Report"}</span>
                            </button>
                        </div>
                        )}
                    </div>

                    {/* Search and Table */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="mb-4">
                            <div className="relative max-w-md">
                                <Search className="absolute top-2.5 right-3 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    value={searchReceiptId}
                                    onChange={(e) => setSearchReceiptId(e.target.value)}
                                    placeholder={isRTL ? "ابحث برقم الإيصال أو العميل..." : "Search by receipt ID or customer name..."}
                                    className="w-full bg-gray-50 dark:bg-[#0d0d0e] border border-gray-200 dark:border-white/5 rounded-xl py-2 pr-9 pl-4 outline-none focus:border-blue-500 font-bold text-xs text-gray-900 dark:text-white text-right"
                                />
                            </div>
                        </div>

                        {/* Receipts Table */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide border border-gray-100 dark:border-white/5 rounded-2xl">
                            <table className="w-full text-start text-xs font-bold text-gray-800 dark:text-gray-200">
                                <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 font-black uppercase text-[10px] sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 w-8 text-center">#</th>
                                        <th className="p-3 text-start">{isRTL ? "رقم الفاتورة" : "Invoice ID"}</th>
                                        <th className="p-3 text-start">{isRTL ? "اسم المنتج + المقاس" : "Product + Size"}</th>
                                        <th className="p-3 text-center">{isRTL ? "الكمية" : "Qty"}</th>
                                        <th className="p-3 text-start">{isRTL ? "اسم العميل" : "Customer"}</th>
                                        <th className="p-3 text-start">{isRTL ? "طريقة الدفع" : "Payment"}</th>
                                        <th className="p-3 text-start">{isRTL ? "التاريخ والوقت" : "Date & Time"}</th>
                                        <th className="p-3 text-start">{isRTL ? "إجمالي الطلب" : "Total"}</th>
                                        <th className="p-3 text-start">{isRTL ? "الحاله" : "Status"}</th>
                                        <th className="p-3 text-center">{isRTL ? "إجراءات" : "Actions"}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleReceipts.map((receipt, idx) => (
                                            <tr key={receipt.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                                <td className="p-3 text-center text-gray-400 w-8">{idx + 1}</td>
                                                <td className="p-3 font-mono font-black">{receipt.orderId}</td>
                                                <td className="p-3">
                                                    <div className="space-y-0.5">{(receipt.cartItems || []).map((item, itemIdx) => <div key={itemIdx}>{item.title}{(item.selectedSize || item.size) ? ` / ${item.selectedSize || item.size}` : ''}</div>)}</div>
                                                </td>
                                                <td className="p-3 text-center font-mono">{(receipt.cartItems || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</td>
                                                <td className="p-3">{receipt.formData?.name || '---'}</td>
                                                <td className="p-3">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black ${
                                                        receipt.paymentMethod === 'card' ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-600' :
                                                        receipt.paymentMethod === 'transfer' ? 'bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600' :
                                                        'bg-green-100 dark:bg-green-500/10 text-green-600'
                                                    }`}>
                                                        {receipt.paymentMethod === 'card' ? (isRTL ? 'محفظة جيب' : 'Jib Wallet') :
                                                         receipt.paymentMethod === 'transfer' ? (isRTL ? 'تحويل بنكي' : 'Bank Transfer') :
                                                         receipt.paymentMethod === 'cash' || !receipt.paymentMethod || receipt.paymentMethod === 'manual' ? (isRTL ? 'نقدي / كاش' : 'Cash') :
                                                         receipt.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col">
                                                        <span>{receipt.formattedDate}</span>
                                                        <span className="text-[10px] text-gray-400 font-normal mt-0.5">{receipt.formattedTime}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 font-mono font-black text-blue-600 dark:text-blue-400">
                                                    {receipt.total?.toLocaleString()} {currency}
                                                </td>
                                                <td className="p-3">
                                                    {receipt.status === 'cancelled' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                            <span>{isRTL ? "مسترجع" : "Refunded"}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 dark:bg-green-500/15 text-green-600 dark:text-green-400">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                            <span>{isRTL ? "مكتمل" : "Completed"}</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => triggerPrint(receipt)}
                                                            className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                                                            title={isRTL ? "طباعة الفاتورة" : "Print Invoice"}
                                                        >
                                                            <Printer size={15} />
                                                        </button>
                                                        {(isAdminManager || !workerPermissions.allowOnlyPrint) && (
                                                            <>
                                                                {receipt.status !== 'cancelled' && (
                                                                    <button
                                                                        onClick={() => handleRefundReceipt(receipt)}
                                                                        className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
                                                                        title={isRTL ? "مرتجع / إرجاع السلع" : "Refund / Return Items"}
                                                                    >
                                                                        <RotateCcw size={15} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleEditReceipt(receipt)}
                                                                    className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                                    title={isRTL ? "تعديل الفاتورة" : "Edit Invoice"}
                                                                >
                                                                    <Edit size={15} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteReceipt(receipt)}
                                                                    className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                                    title={isRTL ? "حذف الفاتورة" : "Delete Invoice"}
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    
                                    {visibleReceipts.length === 0 && (
                                        <tr>
                                            <td colSpan="10" className="p-10 text-center text-gray-400 font-bold italic">
                                                {isRTL ? "لا توجد فواتير مسجلة بنقطة البيع بعد" : "No POS receipts found"}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Modal: Success Notification with print */}
            <AnimatePresence>
                {showSuccessModal && lastCreatedOrderData && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowSuccessModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm bg-white dark:bg-[#1c1c1e] rounded-[32px] overflow-hidden shadow-2xl border border-white/10 p-6 text-center"
                        >
                            <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-500/10 text-green-500 flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                                <CheckCircle size={32} className="animate-bounce" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">
                                {isRTL ? "تمت عملية البيع بنجاح!" : "Transaction Complete!"}
                            </h3>
                            <p className="text-xs text-gray-500 font-mono mt-1 mb-6">
                                #{lastCreatedOrderId}
                            </p>

                            <div className="flex gap-2.5">
                                <button
                                    onClick={() => setShowSuccessModal(false)}
                                    className="flex-1 py-3 border border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    {isRTL ? "فاتورة جديدة" : "New Receipt"}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        triggerPrint(lastCreatedOrderData);
                                    }}
                                    className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20"
                                >
                                    <Printer size={15} />
                                    {isRTL ? "طباعة الفاتورة" : "Print Receipt"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal: Custom Sales Report */}
            <AnimatePresence>
                {showReportModal && generatedReport && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowReportModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-[#1c1c1e] rounded-[32px] overflow-hidden shadow-2xl border border-white/10 p-6 flex flex-col max-h-[85vh]"
                        >
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-white/5">
                                <h3 className="text-base font-black text-gray-900 dark:text-white">
                                    {isRTL ? "تقرير المبيعات التفصيلي" : "Sales Report Overview"}
                                </h3>
                                <button onClick={() => setShowReportModal(false)} className="p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Report Content Container (for print target) */}
                            <div id="sales-report-printable" className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-hide">
                                <div className="header text-center">
                                    <h2 className="title text-gray-900" style={{ margin: 0, fontWeight: '900' }}>
                                        {isRTL ? "ملخص مبيعات نقطة البيع" : "POS Sales Report"}
                                    </h2>
                                    <p className="date text-gray-500 mt-2" style={{ margin: '5px 0' }}>
                                        {isRTL ? `من تاريخ ${generatedReport.startDate} إلى تاريخ ${generatedReport.endDate}` : `From ${generatedReport.startDate} to ${generatedReport.endDate}`}
                                    </p>
                                </div>

                                <div className="stats-grid grid grid-cols-3 gap-4">
                                    <div className="stat-card p-4 border border-gray-100 dark:border-white/5 rounded-xl bg-gray-50 dark:bg-white/5 text-center">
                                        <span className="text-[10px] text-gray-400 font-bold block">{isRTL ? "إجمالي المبيعات" : "Total Sales"}</span>
                                        <span className="stat-val text-lg font-black text-blue-600 dark:text-blue-400 mt-1 block">{generatedReport.totalSales.toLocaleString()} {currency}</span>
                                    </div>
                                    <div className="stat-card p-4 border border-gray-100 dark:border-white/5 rounded-xl bg-gray-50 dark:bg-white/5 text-center">
                                        <span className="text-[10px] text-gray-400 font-bold block">{isRTL ? "صافي الأرباح" : "Net Profit"}</span>
                                        <span className="stat-val text-lg font-black text-green-500 mt-1 block">{generatedReport.netProfit.toLocaleString()} {currency}</span>
                                    </div>
                                    <div className="stat-card p-4 border border-gray-100 dark:border-white/5 rounded-xl bg-gray-50 dark:bg-white/5 text-center">
                                        <span className="text-[10px] text-gray-400 font-bold block">{isRTL ? "عدد الفواتير" : "Transaction Count"}</span>
                                        <span className="stat-val text-lg font-black text-purple-600 mt-1 block">{generatedReport.receiptsCount}</span>
                                    </div>
                                </div>

                                <div className="p-4 border border-gray-100 dark:border-white/5 rounded-xl bg-gray-50 dark:bg-white/5">
                                    <h4 className="text-xs font-black text-gray-700 dark:text-white mb-3">{isRTL ? "تفصيل طرق الدفع" : "Payment Method Details"}</h4>
                                    <div className="grid grid-cols-3 gap-2 text-xs font-bold text-center text-gray-500">
                                        <div>
                                            <span>{isRTL ? "نقدي (كاش):" : "Cash:"}</span>
                                            <span className="block font-black text-gray-800 dark:text-white font-mono mt-1">{(generatedReport.paymentBreakdown.cash || 0).toLocaleString()} {currency}</span>
                                        </div>
                                        <div>
                                            <span>{isRTL ? "محفظة جيب:" : "Card:"}</span>
                                            <span className="block font-black text-gray-800 dark:text-white font-mono mt-1">{(generatedReport.paymentBreakdown.card || 0).toLocaleString()} {currency}</span>
                                        </div>
                                        <div>
                                            <span>{isRTL ? "تحويل بنكي:" : "Transfer:"}</span>
                                            <span className="block font-black text-gray-800 dark:text-white font-mono mt-1">{(generatedReport.paymentBreakdown.transfer || 0).toLocaleString()} {currency}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-black text-gray-700 dark:text-white">{isRTL ? "سجل الإيصالات خلال الفترة" : "Invoices List"}</h4>
                                    <table className="table w-full text-start text-xs border border-gray-100 dark:border-white/5 rounded-xl overflow-hidden">
                                        <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 font-bold text-[10px]">
                                            <tr>
                                                <th className="p-2 text-start w-8">#</th>
                                                <th className="p-2 text-start">{isRTL ? "رقم الفاتورة" : "Invoice ID"}</th>
                                                <th className="p-2 text-start">{isRTL ? "اسم العميل" : "Customer"}</th>
                                                <th className="p-2 text-start">{isRTL ? "طريقة الدفع" : "Payment"}</th>
                                                <th className="p-2 text-start">{isRTL ? "التاريخ والوقت" : "Date & Time"}</th>
                                                <th className="p-2 text-start">{isRTL ? "إجمالي الطلب" : "Total"}</th>
                                                <th className="p-2 text-start">{isRTL ? "الحاله" : "Status"}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {generatedReport.receipts.map((r, idx) => (
                                                <tr key={r.id} className="border-b border-gray-100 dark:border-white/5">
                                                    <td className="p-2 text-gray-400 text-center">{idx + 1}</td>
                                                    <td className="p-2 font-mono">{r.orderId}</td>
                                                    <td className="p-2">{r.formData?.name || '---'}</td>
                                                    <td className="p-2">
                                                        {r.paymentMethod === 'card' ? (isRTL ? 'محفظة جيب' : 'Jib Wallet') :
                                                         r.paymentMethod === 'transfer' ? (isRTL ? 'تحويل بنكي' : 'Bank Transfer') :
                                                         r.paymentMethod === 'cash' || !r.paymentMethod || r.paymentMethod === 'manual' ? (isRTL ? 'نقدي / كاش' : 'Cash') :
                                                         r.paymentMethod}
                                                    </td>
                                                    <td className="p-2">{r.formattedDate}</td>
                                                    <td className="p-2 font-mono font-black">{r.total?.toLocaleString()} {currency}</td>
                                                    <td className="p-2">
                                                        {r.status === 'cancelled' ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-black">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                                <span>{isRTL ? "مسترجع" : "Refunded"}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-green-500 font-black">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                                <span>{isRTL ? "مكتمل" : "Completed"}</span>
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-white/5 no-print">
                                <button
                                    onClick={() => setShowReportModal(false)}
                                    className="flex-1 py-3 border border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    {isRTL ? "إغلاق" : "Close"}
                                </button>
                                <button
                                    onClick={handlePrintReport}
                                    className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20"
                                >
                                    <Printer size={15} />
                                    {isRTL ? "طباعة التقرير" : "Print Report"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Size Selection Modal */}
            {showSizeModal && sizeModalProduct && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowSizeModal(false)}
                    >
                        <div
                            className="bg-white rounded-3xl w-[400px] max-w-[95vw] shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-6 pb-0">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                                        <img
                                            src={sizeModalProduct.mainImage || '/nav-logo.png'}
                                            className="w-full h-full object-cover"
                                            alt={sizeModalProduct.name}
                                            onError={(e) => e.target.src = '/nav-logo.png'}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-base text-gray-800 truncate">{sizeModalProduct.name}</h3>
                                        <p className="text-xs text-gray-400 font-bold font-mono mt-0.5">{sizeModalProduct.code || '---'}</p>
                                    </div>
                                    <button onClick={() => setShowSizeModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                                        <X size={20} className="text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Size List */}
                            <div className="px-6 pb-4 space-y-3 max-h-[50vh] overflow-y-auto">
                                {(sizeModalProduct.variants?.find(v => v.type === 'size')?.values || []).map(size => {
                                    const sizeStock = Number(sizeModalProduct.sizeStocks?.[size] || 0);
                                    const qty = sizeModalQtys[size] || 0;
                                    return (
                                        <div key={size} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                                            qty > 0 
                                                ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                                                : sizeStock <= 0 
                                                    ? 'border-red-200 bg-red-50/30 opacity-60'
                                                    : 'border-gray-100 hover:border-gray-200'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-sm text-gray-700 min-w-[40px]">{size}:</span>
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                                    sizeStock <= 0 
                                                        ? 'bg-red-100 text-red-500' 
                                                        : sizeStock <= 3 
                                                            ? 'bg-orange-100 text-orange-600' 
                                                            : 'bg-green-100 text-green-700'
                                                }`}>
                                                    {sizeStock} قطعة
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setSizeModalQtys(prev => ({ ...prev, [size]: Math.max(0, (prev[size] || 0) - 1) }))}
                                                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black transition-all ${
                                                        qty > 0 
                                                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                                                            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                    }`}
                                                    disabled={qty <= 0}
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="w-8 text-center font-black text-sm text-gray-800">{qty}</span>
                                                <button
                                                    onClick={() => setSizeModalQtys(prev => ({ ...prev, [size]: (prev[size] || 0) + 1 }))}
                                                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black transition-all ${
                                                        sizeStock > qty
                                                            ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm' 
                                                            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                    }`}
                                                    disabled={sizeStock <= qty}
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Actions */}
                            <div className="p-6 pt-0 flex gap-3">
                                <button
                                    onClick={() => setShowSizeModal(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-colors"
                                >
                                    {isRTL ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    onClick={() => {
                                        // Add selected sizes to cart
                                        const itemsToAdd = [];
                                        for (const [size, qty] of Object.entries(sizeModalQtys)) {
                                            if (qty > 0) {
                                                const hasDiscount = applyStoreOffers && sizeModalProduct.priceAfterDiscount && Number(sizeModalProduct.priceAfterDiscount) < Number(sizeModalProduct.price);
                                                const finalPrice = hasDiscount ? Number(sizeModalProduct.priceAfterDiscount) : Number(sizeModalProduct.price);
                                                itemsToAdd.push({
                                                    id: sizeModalProduct.id,
                                                    title: sizeModalProduct.name,
                                                    price: finalPrice,
                                                    originalPrice: sizeModalProduct.price,
                                                    costPrice: sizeModalProduct.costPrice || 0,
                                                    image: sizeModalProduct.mainImage || '/nav-logo.png',
                                                    quantity: qty,
                                                    selectedSize: size,
                                                    selectedColor: sizeModalProduct.variants?.find(v => v.type === 'color')?.values?.[0] || '',
                                                    sizeOptions: [size],
                                                    colorOptions: sizeModalProduct.variants?.find(v => v.type === 'color')?.values || []
                                                });
                                            }
                                        }
                                        if (itemsToAdd.length > 0) {
                                            setCartItems(prev => [...prev, ...itemsToAdd]);
                                        }
                                        setShowSizeModal(false);
                                    }}
                                    disabled={Object.values(sizeModalQtys).every(q => q === 0)}
                                    className="flex-[2] py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isRTL 
                                        ? `إضافة ${Object.values(sizeModalQtys).reduce((a, b) => a + b, 0) > 0 ? '(' + Object.values(sizeModalQtys).reduce((a, b) => a + b, 0) + ')' : ''} إلى السلة`
                                        : `Add ${Object.values(sizeModalQtys).reduce((a, b) => a + b, 0) > 0 ? '(' + Object.values(sizeModalQtys).reduce((a, b) => a + b, 0) + ')' : ''} to Cart`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default POSView;
