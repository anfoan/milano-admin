import React, { useState, useEffect, useRef } from 'react';
import {
    CheckCircle, Clock, DollarSign, MessageSquare,
    TrendingUp, PieChart as PieChartIcon, ExternalLink, Copy, QrCode,
    Users, Phone, MapPin, Search, Eye, X, Send,
    Inbox, AlertTriangle, Calendar, Monitor, Globe, Printer, FileText,
    ArrowRightCircle, UserPlus, ShoppingBag, ShoppingBasket, Info, Package
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, orderBy, limit, doc, onSnapshot, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

import { getLocalizedCurrency } from '../../lib/currencyUtils';

const DashboardHome = ({ onViewOrder, setActiveTab, lang, generalSettings }) => {
    const t = {
        ar: {
            // Stats
            completed_orders: "طلبات مكتملة",
            profit: "صافي الربح",
            reviews: "آراء العملاء",
            pending_orders: "طلبات غير مكتملة",
            total_purchases: "إجمالي المشتريات",
            purchase_invoices: "فواتير مشتريات",
            visitors_today: "الزائرين اليوم",
            visitors_yesterday: "جميع زائرين المتجر",

            // Sales Chart
            daily_sales: "مبيعات المتجر اليومية",
            today: "اليوم",
            week: "الأسبوع",
            month: "الشهر",
            sales: "المبيعات",
            sar: "ريال يمني",

            // Top Sellers
            top_sellers: "الأعلى مبيعاً",
            sold_qty: "الكمية المباعة",
            piece: "قطعة",
            view_more: "عرض المزيد (قريبا)",
            no_sales: "لا توجد مبيعات بعد",

            // Store Info
            store_link: "رابط المتجر",
            link_copied: "تم نسخ رابط المتجر!",
            qr_code: "QR Code",
            go_to_store: "اذهب إلى المتجر",
            store_status: "حالة المتجر",
            open: "مفتوح",
            closed: "مغلق",
            store_open_msg: "متجرك مفتوح حاليا ويستقبل الطلبات.",

            // Recent Orders
            recent_orders: "أحدث الطلبات الحقيقية",
            view_all: "عرض الكل",
            loading: "جاري تحميل البيانات الحقيقية...",
            no_orders: "لا توجد طلبات حقيقية في قاعدة البيانات حتى الآن.",

            // Table Headers
            order_no: "رقم الطلب",
            name: "الإسم",
            price: "إجمالي الطلب",
            phone: "رقم الهاتف",
            city: "المدينة",
            status: "الحالة",

            unknown: "غير معروف",
            anonymous: "عميل مجهول",
            unspecified: "غير محدد"
        },
        en: {
            // Stats
            completed_orders: "Completed Orders",
            profit: "Net Profit",
            reviews: "Reviews",
            pending_orders: "Pending Orders",
            total_purchases: "Total Purchases",
            purchase_invoices: "purchase invoices",
            visitors_today: "Visitors Today",
            visitors_yesterday: "All store visitors",

            // Sales Chart
            daily_sales: "Daily Store Sales",
            today: "Today",
            week: "Week",
            month: "Month",
            sales: "Sales",
            sar: "YER",

            // Top Sellers
            top_sellers: "Top Sellers",
            sold_qty: "Quantity Sold",
            piece: "pcs",
            view_more: "View More (Soon)",
            no_sales: "No sales yet",

            // Store Info
            store_link: "Store Link",
            link_copied: "Store link copied!",
            qr_code: "QR Code",
            go_to_store: "Go to Store",
            store_status: "Store Status",
            open: "Open",
            closed: "Closed",
            store_open_msg: "Your store is currently open and accepting orders.",

            // Recent Orders
            recent_orders: "Recent Real Orders",
            view_all: "View All",
            loading: "Loading real data...",
            no_orders: "No real orders in database yet.",

            // Table Headers
            order_no: "Order #",
            name: "Name",
            price: "Order Total",
            phone: "Phone",
            city: "City",
            status: "Status",

            unknown: "Unknown",
            anonymous: "Anonymous",
            unspecified: "Unspecified"
        }
    };

    const txt = t[lang];
    const currency = getLocalizedCurrency(generalSettings?.currency || 'YER', lang);
    const isRTL = lang === 'ar';

    const [storeOpen, setStoreOpen] = useState(true);
    const [storeUrl, setStoreUrl] = useState('');
    const [topSellers, setTopSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [realOrders, setRealOrders] = useState([]);
    const [salesChartData, setSalesChartData] = useState([]);
    const chartTabs = [
        { id: 'today', label: txt.today },
        { id: 'week', label: txt.week },
        { id: 'month', label: txt.month }
    ];
    const [activeChartTab, setActiveChartTab] = useState('week');
    const [dashboardStats, setDashboardStats] = useState({
        completed: 0,
        profit: 0,
        reviews: 0,
        pending: 0,
        todayVisitors: 0,
        allTimeVisitors: 0,
        totalSales: 0,
        totalPurchases: 0,
        purchaseInvoices: 0,
        stockValue: 0,
        stockQty: 0,
        lowStock: 0,
        outOfStock: 0
    });
    const [isEditingLink, setIsEditingLink] = useState(false);
    const [editableLink, setEditableLink] = useState('');
    const [showQrModal, setShowQrModal] = useState(false);

    const productCostMapRef = useRef({});

    const calculateOrderNetProfit = (order) => {
        const costMap = productCostMapRef.current;
        const items = order.cartItems || order.items || [];
        let totalCost = 0;
        let itemsSubtotal = 0;

        if (items.length > 0) {
            items.forEach(item => {
                const qty = Number(item.quantity || item.qty || 1);
                const sellPrice = Number(item.price || 0);
                const costPrice = Number(item.costPrice !== undefined ? item.costPrice : (costMap[item.title || item.name] || 0));
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

    // Real-time listener for orders and stats
    useEffect(() => {
        // Fetch orders - limits to 2000 to ensure performance
        // Added orderBy to ensure we get newest first (helps with "Today" checks for recent orders)
        // Note: If you have > 2000 orders, "Total Profit" will only calculate based on these 2000.
        const q = query(
            collection(db, "orders"),
            orderBy("createdAt", "desc"),
            limit(2000)
        );

        // Safety timeout in case Firebase is slow or blocked
        const safetyTimer = setTimeout(() => {
            console.warn("Orders fetch timed out, forcing loading false");
            setLoading(false);
        }, 8000);

        const unsubscribeOrders = onSnapshot(q, async (snapshot) => {
            clearTimeout(safetyTimer);
            try {
                const ordersData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    let dateStr = 'قيد المعالجة';
                    try {
                        const locale = lang === 'ar' ? 'ar-YE' : 'en-GB';
                        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                            dateStr = data.createdAt.toDate().toLocaleString(locale);
                        } else if (typeof data.createdAt === 'string') {
                            dateStr = new Date(data.createdAt).toLocaleString(locale);
                        } else if (data.date) {
                            dateStr = data.date;
                        }
                    } catch (e) {
                        console.warn('Error formatting date for order:', doc.id);
                    }

                    return {
                        id: doc.id,
                        ...data,
                        date: dateStr,
                        createdAt: data.createdAt, // Preserve original for sorting
                        // Fix for missing data: Map from formData if top-level is empty
                        name: data.formData?.name || data.customer?.name || data.name,
                        phone: data.formData?.fullPhone || data.formData?.phone || data.customer?.phone || data.phone,
                        city: data.formData?.city || data.customer?.city || data.city,
                        address: data.formData?.address || data.customer?.address || data.address
                    };
                }).sort((a, b) => {
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

                // --- Fetch Products for Cost Analysis & Stock Stats ---
                const productsSnap = await getDocs(collection(db, "products"));
                const productCostMap = {};
                let calculatedStockValue = 0;
                let calculatedStockQty = 0;
                let calculatedLowStock = 0;
                let calculatedOutOfStock = 0;

                productsSnap.docs.forEach(doc => {
                    const p = doc.data();
                    if (p.name) productCostMap[p.name] = Number(p.costPrice || 0);
                    
                    const stock = Number(p.stock || 0);
                    const price = Number(p.price || 0);
                    calculatedStockQty += stock;
                    calculatedStockValue += stock * price;
                    
                    if (stock <= 0) {
                        calculatedOutOfStock++;
                    } else if (stock <= 5) {
                        calculatedLowStock++;
                    }
                });

                setRealOrders(ordersData);

                // --- Calculate Top Sellers ---
                const productCounts = {};
                ordersData.forEach(order => {
                    const itemsToCount = order.cartItems || order.items || [];
                    if (Array.isArray(itemsToCount)) {
                        itemsToCount.forEach(item => {
                            const pName = item.title || item.name;
                            if (pName) {
                                productCounts[pName] = (productCounts[pName] || 0) + (item.quantity || 1);
                            }
                        });
                    }
                });

                const sortedProducts = Object.entries(productCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([name, count], index) => {
                        const totalSold = Object.values(productCounts).reduce((a, b) => a + b, 0);
                        return {
                            name,
                            count,
                            percentage: Math.round((count / (totalSold || 1)) * 100),
                            color: ["bg-blue-500", "bg-pink-500", "bg-purple-500", "bg-orange-500"][index % 4]
                        };
                    });

                setTopSellers(sortedProducts.length > 0 ? sortedProducts : []);

                productCostMapRef.current = productCostMap;

                // Calculate stats
                let completedCount = 0;
                let netProfit = 0;
                let pendingCount = 0;
                let totalSalesCount = 0;

                // Daily Stats
                let todayCompleted = 0;
                let todayProfit = 0;
                let todayPending = 0;

                const currentDate = new Date();

                ordersData.forEach(order => {
                    const s = (order.status || '').toLowerCase().trim();
                    let comparisonDate = null;
                    const isCompletedStatus = s === 'completed' || s === 'مكتمل' || s.includes('اكتمل');

                    if (isCompletedStatus) {
                        if (order.completedAt && typeof order.completedAt.toDate === 'function') {
                            comparisonDate = order.completedAt.toDate();
                        } else if (order.updatedAt && typeof order.updatedAt.toDate === 'function') {
                            comparisonDate = order.updatedAt.toDate();
                        } else if (order.completedAt) {
                            comparisonDate = new Date(order.completedAt);
                        }
                    }

                    if (!comparisonDate) {
                        if (order.createdAt && typeof order.createdAt.toDate === 'function') {
                            comparisonDate = order.createdAt.toDate();
                        } else if (order.date) {
                            comparisonDate = new Date(order.date);
                        }
                    }

                    const isToday = comparisonDate &&
                        comparisonDate.getDate() === currentDate.getDate() &&
                        comparisonDate.getMonth() === currentDate.getMonth() &&
                        comparisonDate.getFullYear() === currentDate.getFullYear();

                    if (isCompletedStatus) {
                        completedCount++;
                        totalSalesCount += Number(order.total || order.price || 0);

                        // Calculate REAL Net Profit for this order
                        const orderProfit = calculateOrderNetProfit(order);

                        netProfit += orderProfit;

                        if (isToday) {
                            todayCompleted++;
                            todayProfit += orderProfit;
                        }

                    } else if (s !== 'cancelled' && s !== 'ملغي' && !s.includes('إلغاء')) {
                        pendingCount++;
                        if (isToday) todayPending++;
                    }
                });

                setDashboardStats(prev => ({
                    ...prev,
                    completed: completedCount,
                    profit: netProfit,
                    pending: pendingCount,
                    todayCompleted: todayCompleted,
                    todayProfit: todayProfit,
                    todayPending: todayPending,
                    totalSales: totalSalesCount,
                    stockValue: calculatedStockValue,
                    stockQty: calculatedStockQty,
                    lowStock: calculatedLowStock,
                    outOfStock: calculatedOutOfStock
                }));
            } catch (err) {
                console.error("Critical error processing orders:", err);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("Error fetching orders:", error);
            clearTimeout(safetyTimer);
            setLoading(false);
        });

        // --- Real-time Reviews Stats (registered once) ---
        const reviewsQuery = query(collection(db, "reviews"));
        const unsubReviews = onSnapshot(reviewsQuery, (revSnapshot) => {
            setDashboardStats(prev => ({ ...prev, reviews: revSnapshot.size }));
        });

        // --- Real-time Today Visitor Stats (registered once) ---
        const todayDate = new Date().toISOString().split('T')[0];
        const unsubToday = onSnapshot(doc(db, "daily_stats", todayDate), (doc) => {
            const visitors = doc.exists() ? doc.data().visitors || 0 : 0;
            setDashboardStats(prev => ({ ...prev, todayVisitors: visitors }));
        });

        // --- Real-time All-Time Visitor Stats (registered once) ---
        const unsubAllTime = onSnapshot(collection(db, "daily_stats"), (snapshot) => {
            let total = 0;
            snapshot.docs.forEach(doc => {
                total += Number(doc.data().visitors || 0);
            });
            setDashboardStats(prev => ({ ...prev, allTimeVisitors: total }));
        });

        // Purchase invoices are kept in their own collection. This listener makes
        // the dashboard card update immediately after any purchase is added, edited,
        // or deleted from the Purchases section.
        const unsubPurchases = onSnapshot(collection(db, "purchases"), (snapshot) => {
            const totalPurchases = snapshot.docs.reduce((sum, purchase) => {
                return sum + Math.max(0, Number(purchase.data().total || 0));
            }, 0);
            setDashboardStats(prev => ({
                ...prev,
                totalPurchases,
                purchaseInvoices: snapshot.size
            }));
        }, error => console.error('Purchases dashboard listener:', error));

        const savedStatus = localStorage.getItem('store_status');
        if (savedStatus) setStoreOpen(savedStatus === 'open');

        return () => {
            unsubscribeOrders();
            unsubReviews();
            unsubToday();
            unsubAllTime();
            unsubPurchases();
            clearTimeout(safetyTimer);
        };
    }, []);

    // Effect to calculate chart data based on active tab
    useEffect(() => {
        if (!realOrders) return;

        const now = new Date();
        let chartData = [];

        // --- Helpers ---
        const parseMoney = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return Number(val.replace(/[^\d.]/g, '')) || 0;
            return 0;
        };

        const parseDateHelper = (dateValue) => {
            if (!dateValue) return null;
            if (typeof dateValue.toDate === 'function') return dateValue.toDate();
            if (dateValue instanceof Date) return dateValue;
            if (typeof dateValue === 'string') {
                let d = new Date(dateValue);
                if (!isNaN(d)) return d;
                const parts = dateValue.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                if (parts) return new Date(parts[3], parts[2] - 1, parts[1]);
            }
            return null;
        };

        const isOrderCompleted = (status) => {
            const s = status?.toLowerCase() || '';
            return s === 'completed' || s === 'مكتمل' || s.includes('اكتمل') || s.includes('complete');
        };

        if (activeChartTab === 'today') {
            const hours = [...Array(24)].map((_, i) => {
                const d = new Date();
                d.setHours(i, 0, 0, 0);
                return d;
            });

            const salesMap = {};
            hours.forEach(h => salesMap[h.getHours()] = 0);

            // Flexible Date Parser Helper
            const parseDateHelper = (dateValue) => {
                if (!dateValue) return null;
                // 1. Firestore Timestamp
                if (typeof dateValue.toDate === 'function') return dateValue.toDate();
                // 2. JS Date object
                if (dateValue instanceof Date) return dateValue;
                // 3. String Parsing
                if (typeof dateValue === 'string') {
                    // Try ISO/Standard first
                    let d = new Date(dateValue);
                    if (!isNaN(d)) return d;

                    // Try DD/MM/YYYY or DD-MM-YYYY
                    const parts = dateValue.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                    if (parts) {
                        // parts[1]=Day, parts[2]=Month, parts[3]=Year
                        return new Date(parts[3], parts[2] - 1, parts[1]);
                    }
                }
                return null;
            };

            realOrders.forEach(order => {
                let orderDate = null;
                const s = order.status?.toLowerCase() || '';
                const isCompleted = s === 'completed' || s === 'مكتمل' || s.includes('اكتمل') || s.includes('complete');

                if (isCompleted) {
                    orderDate = parseDateHelper(order.completedAt) || parseDateHelper(order.updatedAt) || parseDateHelper(order.date) || parseDateHelper(order.createdAt);
                } else {
                    // For non-completed, just use creation date
                    orderDate = parseDateHelper(order.createdAt) || parseDateHelper(order.date);
                }

                const isValid = orderDate instanceof Date && !isNaN(orderDate);

                if (isValid && orderDate.getDate() === now.getDate() &&
                    orderDate.getMonth() === now.getMonth() &&
                    orderDate.getFullYear() === now.getFullYear() &&
                    isCompleted) {

                    const orderProfit = calculateOrderNetProfit(order);
                    salesMap[orderDate.getHours()] += orderProfit;
                }
            });

            chartData = Object.keys(salesMap).map(hour => ({
                label: `${hour}:00`,
                value: salesMap[hour]
            }));

        } else if (activeChartTab === 'week') {
            const last7Days = [...Array(7)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                // Use local YYYY-MM-DD format
                const offset = d.getTimezoneOffset();
                const dLocal = new Date(d.getTime() - (offset * 60 * 1000));
                return dLocal.toISOString().split('T')[0];
            }).reverse();

            const salesMap = {};
            last7Days.forEach(day => salesMap[day] = 0);

            realOrders.forEach(order => {
                const parseDateHelper = (dateValue) => {
                    if (!dateValue) return null;
                    if (typeof dateValue.toDate === 'function') return dateValue.toDate();
                    if (dateValue instanceof Date) return dateValue;
                    if (typeof dateValue === 'string') {
                        let d = new Date(dateValue);
                        if (!isNaN(d)) return d;
                        const parts = dateValue.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                        if (parts) return new Date(parts[3], parts[2] - 1, parts[1]);
                    }
                    return null;
                };

                let orderDate = null;
                const s = order.status?.toLowerCase() || '';
                const isCompleted = s === 'completed' || s === 'مكتمل' || s.includes('اكتمل') || s.includes('complete');

                if (isCompleted) {
                    orderDate = parseDateHelper(order.completedAt) || parseDateHelper(order.updatedAt) || parseDateHelper(order.date) || parseDateHelper(order.createdAt);
                } else {
                    orderDate = parseDateHelper(order.createdAt) || parseDateHelper(order.date);
                }

                // Helper
                const parseMoney = (val) => {
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string') return Number(val.replace(/[^\d.]/g, '')) || 0;
                    return 0;
                };

                // Validate Date before usage
                const isValid = orderDate instanceof Date && !isNaN(orderDate);

                if (isValid && isCompleted) {
                    try {
                        // Use local YYYY-MM-DD key logic
                        const offset = orderDate.getTimezoneOffset();
                        const dLocal = new Date(orderDate.getTime() - (offset * 60 * 1000));
                        const dayKey = dLocal.toISOString().split('T')[0];

                        if (salesMap[dayKey] !== undefined) {
                            const orderProfit = calculateOrderNetProfit(order);
                            salesMap[dayKey] += orderProfit;
                        }
                    } catch (e) {
                        console.warn('Skipping order with invalid date:', order.id);
                    }
                }
            });

            chartData = Object.keys(salesMap).map(day => ({
                label: new Date(day).toLocaleDateString(lang === 'ar' ? 'ar-YE' : 'en-US', { weekday: 'short' }),
                value: salesMap[day]
            }));

        } else if (activeChartTab === 'month') {
            const last30Days = [...Array(30)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                // Use local YYYY-MM-DD
                const offset = d.getTimezoneOffset();
                const dLocal = new Date(d.getTime() - (offset * 60 * 1000));
                return dLocal.toISOString().split('T')[0];
            }).reverse();

            const salesMap = {};
            last30Days.forEach(day => salesMap[day] = 0);

            realOrders.forEach(order => {
                const parseDateHelper = (dateValue) => {
                    if (!dateValue) return null;
                    if (typeof dateValue.toDate === 'function') return dateValue.toDate();
                    if (dateValue instanceof Date) return dateValue;
                    if (typeof dateValue === 'string') {
                        let d = new Date(dateValue);
                        if (!isNaN(d)) return d;
                        const parts = dateValue.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                        if (parts) return new Date(parts[3], parts[2] - 1, parts[1]);
                    }
                    return null;
                };

                let orderDate = null;
                const s = order.status?.toLowerCase() || '';
                const isCompleted = s === 'completed' || s === 'مكتمل' || s.includes('اكتمل') || s.includes('complete');

                if (isCompleted) {
                    orderDate = parseDateHelper(order.completedAt) || parseDateHelper(order.updatedAt) || parseDateHelper(order.date) || parseDateHelper(order.createdAt);
                } else {
                    orderDate = parseDateHelper(order.createdAt) || parseDateHelper(order.date);
                }

                // Helper
                const parseMoney = (val) => {
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string') return Number(val.replace(/[^\d.]/g, '')) || 0;
                    return 0;
                };

                // Validate Date before usage
                const isValid = orderDate instanceof Date && !isNaN(orderDate);

                if (isValid && isCompleted) {
                    try {
                        // Use local YYYY-MM-DD key logic
                        const offset = orderDate.getTimezoneOffset();
                        const dLocal = new Date(orderDate.getTime() - (offset * 60 * 1000));
                        const dayKey = dLocal.toISOString().split('T')[0];

                        if (salesMap[dayKey] !== undefined) {
                            const orderProfit = calculateOrderNetProfit(order);
                            salesMap[dayKey] += orderProfit;
                        }
                    } catch (e) {
                        console.warn('Skipping invalid date order:', order.id);
                    }
                }
            });

            chartData = Object.keys(salesMap).map((day, idx) => ({
                label: new Date(day).toLocaleDateString(lang === 'ar' ? 'ar-YE' : 'en-US', { day: 'numeric', month: 'numeric' }),
                value: salesMap[day]
            }));
        }

        setSalesChartData(chartData);

    }, [realOrders, activeChartTab]);

    // --- Real Store Status Sync ---
    useEffect(() => {
        const statusRef = doc(db, 'settings', 'store');
        const unsubscribe = onSnapshot(statusRef, (docSnap) => {
            if (docSnap.exists()) {
                setStoreOpen(docSnap.data().isOpen);
            } else {
                // Default to open if not set
                setStoreOpen(true);
            }
        });
        return () => unsubscribe();
    }, []);

    // Toggle Handler
    const [showStatusConfirm, setShowStatusConfirm] = useState(false);

    const handleStoreToggle = async () => {
        // If currently open (true), we are trying to close it. Warn the user.
        if (storeOpen) {
            setShowStatusConfirm(true);
            return;
        }

        // If closed, open immediately
        toggleStatus(true);
    };

    const toggleStatus = async (status) => {
        setStoreOpen(status);
        setShowStatusConfirm(false);
        try {
            await setDoc(doc(db, 'settings', 'store'), { isOpen: status }, { merge: true });
        } catch (error) {
            console.error("Error updating store status:", error);
            setStoreOpen(!status); // Revert
        }
    };

    useEffect(() => {
        if (generalSettings?.storeUrl) {
            setStoreUrl(generalSettings.storeUrl);
            setEditableLink(generalSettings.storeUrl);
        } else if (typeof window !== 'undefined') {
            setStoreUrl(window.location.origin);
            setEditableLink(window.location.origin);
        }
    }, [generalSettings]);

    const handleSaveLink = async () => {
        try {
            const settingsRef = doc(db, 'settings', 'general');
            await updateDoc(settingsRef, { storeUrl: editableLink });
            setStoreUrl(editableLink);
            setIsEditingLink(false);
        } catch (error) {
            console.error("Error saving store link:", error);
            alert("فشل حفظ الرابط");
        }
    };

    const statsConfig = [
        { title: txt.completed_orders, value: dashboardStats.completed, icon: <CheckCircle className="text-green-500" />, color: "bg-green-50" },
        { title: txt.profit, value: `${(dashboardStats.profit || 0).toLocaleString()} ${currency}`, icon: <DollarSign className="text-blue-500" />, color: "bg-blue-50" },
        { title: txt.reviews, value: dashboardStats.reviews, icon: <MessageSquare className="text-cyan-500" />, color: "bg-cyan-50" },
        { title: txt.pending_orders, value: dashboardStats.pending, icon: <Clock className="text-red-500" />, color: "bg-red-50" },
    ];

    const copyLink = () => {
        if (!storeUrl) return;
        navigator.clipboard.writeText(storeUrl);
        alert(txt.link_copied);
    };

    const getStatusColor = (status) => {
        const s = status?.toLowerCase() || '';
        if (s === 'new' || s.includes('جديد')) return "text-orange-500 bg-orange-50 ring-1 ring-orange-100";
        if (s === 'shipping' || s.includes('توصيل')) return "text-blue-500 bg-blue-50 ring-1 ring-blue-100";
        if (s === 'completed' || s.includes('اكتمل') || s === 'مكتمل') return "text-green-500 bg-green-50 ring-1 ring-green-100";
        if (s === 'cancelled' || s.includes('إلغاء') || s === 'ملغي') return "text-red-500 bg-red-50 ring-1 ring-red-100";
        return "text-gray-500 bg-gray-50";
    };

    const formatStatus = (status) => {
        const s = status?.toLowerCase() || '';
        if (lang === 'ar') {
            if (s === 'new' || s.includes('جديد')) return "طلب جديد";
            if (s === 'shipping' || s.includes('توصيل')) return "قيد التوصيل";
            if (s === 'completed' || s.includes('اكتمل') || s === 'مكتمل') return "مكتمل";
            if (s === 'cancelled' || s.includes('إلغاء') || s === 'ملغي') return "ملغي";
            return status || 'غير معروف';
        } else {
            if (s === 'new' || s.includes('جديد')) return "New Order";
            if (s === 'shipping' || s.includes('توصيل')) return "Out for Delivery";
            if (s === 'completed' || s.includes('اكتمل') || s === 'مكتمل') return "Completed";
            if (s === 'cancelled' || s.includes('إلغاء') || s === 'ملغي') return "Cancelled";
            return status || 'Unknown';
        }
    };

    return (
        <div className="space-y-6 pb-10 font-['Cairo']" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {/* Top Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {statsConfig.map((stat, idx) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={idx}
                        className="bg-white dark:bg-[#1c1c1e] p-3 sm:p-4 md:p-5 rounded-[20px] md:rounded-[24px] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center"
                    >
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${stat.color} flex items-center justify-center mb-3`}>
                            {stat.icon}
                        </div>
                        <span className="text-lg md:text-xl font-black text-gray-800 dark:text-white mb-1">{stat.value}</span>
                        <span className="text-gray-400 dark:text-gray-400 font-bold text-xs">{stat.title}</span>
                    </motion.div>
                ))}
            </div>

            {/* Middle Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {/* إجمالي المشتريات */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-[#1c1c1e] p-5 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center relative overflow-hidden"
                >
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-3">
                        <ShoppingBasket className="text-emerald-500" />
                    </div>
                    <span className="text-xl font-black text-gray-800 dark:text-white mb-1">
                        {(dashboardStats.totalPurchases || 0).toLocaleString('en-US')} {currency}
                    </span>
                    <span className="text-gray-400 dark:text-gray-400 font-bold text-xs">{txt.total_purchases}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">({dashboardStats.purchaseInvoices || 0} {txt.purchase_invoices})</span>
                </motion.div>

                {/* 1. إجمالي المبيعات */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white dark:bg-[#1c1c1e] p-5 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center relative overflow-hidden"
                >
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-3">
                        <TrendingUp className="text-blue-500" />
                    </div>
                    <span className="text-xl font-black text-gray-800 dark:text-white mb-1">
                        {(dashboardStats.totalSales || 0).toLocaleString()} {currency}
                    </span>
                    <span className="text-gray-400 dark:text-gray-400 font-bold text-xs">إجمالي المبيعات</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">({dashboardStats.completed} {lang === 'ar' ? 'فاتورة' : 'invoices'})</span>
                </motion.div>

                {/* 2. قيمة المخزون */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-white dark:bg-[#1c1c1e] p-5 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center text-center relative overflow-hidden"
                >
                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-3">
                        <Package className="text-indigo-500" />
                    </div>
                    <span className="text-xl font-black text-gray-800 dark:text-white mb-1">
                        {(dashboardStats.stockValue || 0).toLocaleString()} {currency}
                    </span>
                    <span className="text-gray-400 dark:text-gray-400 font-bold text-xs">قيمة المخزون</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">({dashboardStats.stockQty} {lang === 'ar' ? 'منتج' : 'products'})</span>
                </motion.div>

                {/* 3. تنبيه المخزون */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="bg-white dark:bg-[#1c1c1e] p-5 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center justify-center relative overflow-hidden"
                >
                    <div className="absolute top-3 right-3 text-red-500">
                        <AlertTriangle size={16} />
                    </div>
                    <div className="flex items-center gap-4 sm:gap-8 justify-center w-full mt-2">
                        {/* Low Stock (Orange) */}
                        <div className="flex flex-col items-center text-center">
                            <span className="text-gray-400 dark:text-gray-400 font-bold text-xs mb-1">منخفض المخزون</span>
                            <span className="text-xl font-black text-orange-500">
                                {dashboardStats.lowStock || 0}
                            </span>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-10 bg-gray-200 dark:bg-white/10"></div>

                        {/* Out of Stock (Red) */}
                        <div className="flex flex-col items-center text-center">
                            <span className="text-gray-400 dark:text-gray-400 font-bold text-xs mb-1">نفذ من المخزون</span>
                            <span className="text-xl font-black text-red-500">
                                {dashboardStats.outOfStock || 0}
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Dashboard Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Left Column: Sales Chart (Spans 3 cols) */}
                <div className="lg:col-span-3 bg-white p-5 md:p-7 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6 md:mb-8">
                        <h3 className="font-black text-gray-800 text-sm">{txt.daily_sales}</h3>
                        <div className="flex bg-gray-50 p-1 rounded-xl">
                            {chartTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveChartTab(tab.id)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeChartTab === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Chart Visual */}
                    <div className="h-64 w-full mt-4" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={salesChartData}>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="label"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9CA3AF', fontSize: 12, fontFamily: 'Cairo' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9CA3AF', fontSize: 12, fontFamily: 'Cairo' }}
                                    tickFormatter={(value) => `${value.toLocaleString()}`}
                                    width={40}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
                                        padding: '12px'
                                    }}
                                    itemStyle={{ color: '#111827', fontFamily: 'Cairo', fontWeight: 'bold' }}
                                    formatter={(value) => [`${value.toLocaleString()}`, txt.val || 'القيمة']}
                                    labelStyle={{ color: '#6B7280', fontFamily: 'Cairo', marginBottom: '8px', fontSize: '12px' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ fill: '#3b82f6', r: 5, strokeWidth: 3, stroke: '#fff' }}
                                    activeDot={{ r: 7, strokeWidth: 0, fill: '#3b82f6' }}
                                    animationDuration={1500}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Column: Top Sellers (Vertical Layout) */}
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                    <h3 className="font-black text-gray-800 text-sm mb-6 w-full text-center">{txt.top_sellers}</h3>

                    {topSellers.length > 0 ? (
                        <>
                            <div className="h-40 w-full relative mb-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={topSellers}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={0}
                                            outerRadius={70}
                                            paddingAngle={2}
                                            dataKey="count"
                                            stroke="none"
                                        >
                                            {topSellers.map((entry, index) => {
                                                const COLORS = ['#3b82f6', '#ec4899', '#fbbf24', '#a855f7'];
                                                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                            })}
                                        </Pie>
                                        <Tooltip
                                            itemStyle={{ fontFamily: 'Cairo' }}
                                            formatter={(value, name, props) => [`${value} ${txt.piece}`, props.payload.name]}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="w-full space-y-3 mb-2">
                                {topSellers.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between text-xs font-bold text-gray-700">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0"
                                                style={{ backgroundColor: item.color.replace('bg-', '').replace('-500', '') === 'blue' ? '#3b82f6' : item.color.replace('bg-', '').replace('-500', '') === 'pink' ? '#ec4899' : item.color.replace('bg-', '').replace('-500', '') === 'purple' ? '#a855f7' : '#fbbf24' }}
                                            ></div>
                                            <span className="truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                        </div>
                                        <span className="font-mono">{item.count} {txt.piece}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="mt-10 mb-10 text-gray-300 font-bold text-xs italic">{txt.no_sales}</div>
                    )}
                </div>
            </div>

            {/* Store Controls Section (New Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">

                {/* 1. Store Link Card (NOW FIRST - Right in RTL) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between relative h-44">
                    <div className="absolute top-4 right-4 flex items-center gap-1">
                        <span className="text-[10px] font-black text-gray-600">{txt.store_link}</span>
                        <Info size={14} className="text-blue-500" />
                    </div>

                    <div className="mt-8">
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2 mb-4">
                            <div className="flex items-center justify-between gap-3 h-6">
                                {isEditingLink ? (
                                    <input
                                        type="text"
                                        value={editableLink}
                                        onChange={(e) => setEditableLink(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm font-mono dir-ltr"
                                        autoFocus
                                    />
                                ) : (
                                    <span className="font-black text-gray-800 text-sm tracking-wide dir-ltr select-all truncate w-full text-left">
                                        {storeUrl || 'Loading...'}
                                    </span>
                                )}
                                <div className="flex gap-2">
                                    {isEditingLink ? (
                                        <button onClick={handleSaveLink} className="text-green-600 hover:text-green-700 font-bold text-xs uppercase">
                                            Save
                                        </button>
                                    ) : (
                                        <button onClick={() => setIsEditingLink(true)} className="text-blue-600 hover:text-blue-700">
                                            <FileText size={18} />
                                        </button>
                                    )}
                                    <button onClick={copyLink} className="text-gray-400 hover:text-blue-600 transition-colors">
                                        <Copy size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowQrModal(true)}
                                className="flex-1 bg-gray-700 text-white py-2.5 rounded-lg font-bold text-xs hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-600/20"
                            >
                                <QrCode size={16} /> {txt.qr_code}
                            </button>
                            <button onClick={() => window.open(storeUrl || '/', '_blank')} className="flex-[2] bg-teal-500 text-white py-2.5 rounded-lg font-bold text-xs hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20">
                                <ShoppingBag size={16} /> {txt.go_to_store}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Store Status Card (Middle) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 relative h-44 transition-all hover:shadow-md">
                    <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{txt.store_status}</span>
                        <div className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center">
                            <Info size={10} className="text-blue-500" />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input type="checkbox" className="sr-only peer" checked={storeOpen} onChange={handleStoreToggle} />
                            <div className="w-16 h-8 bg-gray-100 peer-focus:outline-none rounded-full peer transition-all duration-300 peer-checked:after:translate-x-8 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-6 after:w-6 after:shadow-sm after:transition-all peer-checked:bg-green-500 group-hover:scale-105 active:scale-95"></div>
                        </label>

                        <div className="flex items-center gap-2">
                            <span className={`text-base font-black transition-colors ${storeOpen ? 'text-green-600' : 'text-gray-400'}`}>
                                {storeOpen ? txt.open : txt.closed}
                            </span>
                            {storeOpen ? (
                                <CheckCircle size={18} className="text-green-500 animate-pulse" fill="currentColor" stroke="#fff" />
                            ) : (
                                <X size={18} className="text-gray-400" />
                            )}
                        </div>
                    </div>

                    <span className="text-[9px] text-gray-400 text-center font-bold px-2 leading-relaxed">
                        {txt.store_open_msg}
                    </span>
                </div>

                {/* 3. Visitors Card (NOW LAST - Left in RTL) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden h-44">
                    <div className="flex justify-between items-start mb-2">
                        <div className="h-14 w-14 bg-blue-500 rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center text-white ring-4 ring-blue-50">
                            <Users size={24} strokeWidth={2} />
                        </div>
                        <div className="text-center flex flex-col items-end">
                            <span className="block text-3xl font-black text-gray-800 leading-none">{dashboardStats.todayVisitors}</span>
                            <span className="text-[10px] text-gray-400 font-bold mt-1">{txt.visitors_today}</span>
                        </div>
                    </div>
                    <div className="text-center mt-auto border-t border-gray-50 pt-4 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 font-bold">{txt.visitors_yesterday}</span>
                        <span className="block text-xl font-black text-gray-800">{dashboardStats.allTimeVisitors}</span>
                    </div>
                </div>

            </div>

            {/* Real Orders Table */}
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden text-gray-800">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-gray-800 text-base">{txt.recent_orders}</h3>
                    <button onClick={() => setActiveTab('orders')} className="text-blue-600 text-sm font-black hover:underline">{txt.view_all}</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-start font-bold">
                        <thead className="bg-gray-50 text-gray-800 text-sm font-black uppercase italic">
                            <tr>
                                <th className="px-6 py-3 md:px-8 md:py-4 text-start">{txt.order_no}</th>
                                <th className="px-6 py-3 md:px-8 md:py-4 text-start">{txt.name}</th>
                                <th className="px-6 py-3 md:px-8 md:py-4 text-start">{txt.price}</th>
                                <th className="px-6 py-3 md:px-8 md:py-4 text-start">{txt.phone}</th>
                                <th className="px-6 py-3 md:px-8 md:py-4 text-start">{txt.city}</th>
                                <th className="px-6 py-3 md:px-8 md:py-4 text-start">{txt.status}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-500 font-bold text-lg">{txt.loading}</td></tr>
                            ) : realOrders.length > 0 ? (
                                realOrders.slice(0, 20).map((order, idx) => (
                                    <tr key={order.id} onClick={() => onViewOrder(order)} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                                        <td className="px-6 py-3 md:px-8 md:py-3.5 text-base font-black text-gray-800 font-mono italic">#{order.id.slice(-8)}</td>
                                        <td className="px-6 py-3 md:px-8 md:py-3.5 text-gray-900 text-base font-black">{order.customer?.name || order.name || txt.anonymous}</td>
                                        <td className="px-6 py-3 md:px-8 md:py-3.5 text-gray-900 text-sm font-black uppercase">{(order.total || order.price || 0).toLocaleString()} {currency}</td>
                                        <td className="px-6 py-3 md:px-8 md:py-3.5 text-gray-800 text-sm font-mono dir-ltr">{order.customer?.phone || order.phone}</td>
                                        <td className="px-6 py-3 md:px-8 md:py-3.5 text-gray-800 text-base">{order.customer?.city || order.city || txt.unspecified}</td>
                                        <td className="px-6 py-3 md:px-8 md:py-3.5">
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-black ${getStatusColor(order.status)}`}>
                                                {formatStatus(order.status)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-500 font-bold italic text-lg">{txt.no_orders}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Store Status Confirmation Modal */}
            <AnimatePresence>
                {showStatusConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full text-center"
                        >
                            <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-500 mx-auto flex items-center justify-center mb-4">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {lang === 'ar' ? 'هل أنت واثق؟' : 'Are you sure?'}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                {lang === 'ar'
                                    ? 'سيتم إيقاف استقبال الطلبات وسيتم عرض رسالة تفيد بأن المتجر مشغول حالياً.'
                                    : 'Orders will be paused and a "Store Busy" message will be displayed.'}
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setShowStatusConfirm(false)}
                                    className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                                >
                                    {lang === 'ar' ? 'لا' : 'No'}
                                </button>
                                <button
                                    onClick={() => toggleStatus(false)}
                                    className="px-6 py-2 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
                                >
                                    {lang === 'ar' ? 'نعم' : 'Yes'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* QR Code Modal */}
            <AnimatePresence>
                {showQrModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full relative"
                        >
                            <button
                                onClick={() => setShowQrModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="text-center mb-6">
                                <h3 className="text-xl font-black text-gray-900 mb-2">
                                    {txt.qr_code}
                                </h3>
                                <p className="text-gray-500 text-xs font-bold">
                                    {storeUrl}
                                </p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-2xl flex items-center justify-center mb-6 border-2 border-dashed border-gray-200">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(storeUrl)}`}
                                    alt="Store QR Code"
                                    className="w-48 h-48 block"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(storeUrl)}`, '_blank')}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} /> {lang === 'ar' ? 'طباعة / حفظ' : 'Print / Save'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DashboardHome;
