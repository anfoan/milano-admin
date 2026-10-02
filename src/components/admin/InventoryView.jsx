import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Plus, Printer, Edit2, Trash2,
    CheckCircle, Package, Filter,
    ChevronDown, ChevronUp, Save, ArrowUpDown, ClipboardList
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { getLocalizedCurrency } from '../../lib/currencyUtils';

const InventoryView = ({ lang = 'ar', generalSettings, searchQuery, setSearchQuery }) => {
    const t = {
        ar: {
            add_stock: 'إضافة مخزون جديد',
            print_report: 'طباعة تقرير إدارة المخزون',
            search_placeholder: 'ابحث عن اسم المنتج / رمز المنتج',
            search_btn: 'بحث',
            filter_all: 'جميع المنتجات',
            filter_available: 'متوفر في المخزون',
            filter_near: 'قارب على النفاذ',
            filter_out: 'نفذ من المخزون',
            filter_audit: 'جرد المنتجات',
            click_to_view: 'اضغط لعرض النتائج',
            th_hash: '#',
            th_code: 'رمز المنتج',
            th_name: 'اسم المنتج',
            th_cost: 'سعر التكلفة',
            th_total_cost: 'إجمالي التكلفة',
            th_sell: 'سعر البيع',
            th_total_sell: 'إجمالي البيع',
            th_stock: 'المخزون الحالي',
            th_actions: 'الإجراءات',
            th_sizes: 'المقاسات والكميات',
            active_in_store: 'نشط في المتجر',
            total: 'الإجمالي',
            piece: 'قطعة',
            sort_label: 'فرز المنتجات',
            sort_default: 'فرز يدوي',
            sort_name_az: 'الاسم (أ - ي)',
            sort_name_za: 'الاسم (ي - أ)',
            sort_stock_asc: 'المخزون (الأقل أولاً)',
            sort_stock_desc: 'المخزون (الأكثر أولاً)',
            sort_price_asc: 'السعر (الأقل أولاً)',
            sort_price_desc: 'السعر (الأعلى أولاً)',
            alert_del: 'هل أنت متأكد من حذف هذا المنتج نهائياً من المتجر والمخزون؟',
            alert_del_success: 'تم حذف المنتج بنجاح',
            alert_del_error: 'حدث خطأ أثناء محاولة الحذف: ',
            error_product_id_missing: 'خطأ: معرف المنتج غير موجود',
            grand_total_title: 'الإجمالي الكلي لإدارة المخزون',
            grand_total_products: 'إجمالي المنتجات',
            grand_total_qty: 'إجمالي الكميات',
            grand_total_cost: 'إجمالي قيمة التكلفة',
            grand_total_sell: 'إجمالي قيمة البيع',
            grand_total_profit: 'صافي الربح المتوقع',
            save_order: 'حفظ الترتيب',
            order_saved: 'تم حفظ الترتيب بنجاح',
            saving: 'جاري الحفظ...',
            edit: 'تعديل المخزون',
            save: 'حفظ',
            cancel: 'إلغاء',
        },
        en: {
            add_stock: 'Add New Stock',
            print_report: 'Print Inventory Report',
            search_placeholder: 'Search Product Name / SKU',
            search_btn: 'Search',
            filter_all: 'All Products',
            filter_available: 'Available in Stock',
            filter_near: 'Low Stock',
            filter_out: 'Out of Stock',
            filter_audit: 'Stock Audit',
            click_to_view: 'Click to view',
            th_hash: '#',
            th_code: 'SKU',
            th_name: 'Product Name',
            th_cost: 'Cost Price',
            th_total_cost: 'Total Cost',
            th_sell: 'Selling Price',
            th_total_sell: 'Total Sell',
            th_stock: 'Current Stock',
            th_actions: 'Actions',
            th_sizes: 'Sizes & Quantities',
            active_in_store: 'Active',
            total: 'Total',
            piece: 'pcs',
            sort_label: 'Sort Products',
            sort_default: 'Manual Sort',
            sort_name_az: 'Name (A - Z)',
            sort_name_za: 'Name (Z - A)',
            sort_stock_asc: 'Stock (Low First)',
            sort_stock_desc: 'Stock (High First)',
            sort_price_asc: 'Price (Low First)',
            sort_price_desc: 'Price (High First)',
            alert_del: 'Are you sure you want to permanently delete this product?',
            alert_del_success: 'Product deleted successfully',
            alert_del_error: 'Error deleting product: ',
            error_product_id_missing: 'Error: Product ID not found',
            grand_total_title: 'Grand Total Summary',
            grand_total_products: 'Total Products',
            grand_total_qty: 'Total Quantity',
            grand_total_cost: 'Total Cost Value',
            grand_total_sell: 'Total Sell Value',
            grand_total_profit: 'Expected Net Profit',
            save_order: 'Save Order',
            order_saved: 'Order saved successfully',
            saving: 'Saving...',
            edit: 'Edit stock',
            save: 'Save',
            cancel: 'Cancel',
        }
    };
    const txt = t[lang];
    const isRTL = lang === 'ar';
    const currency = getLocalizedCurrency(generalSettings?.currency || 'YER', lang);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [sortBy, setSortBy] = useState('');
    const [manualOrder, setManualOrder] = useState([]);
    const [savingOrder, setSavingOrder] = useState(false);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [tempStock, setTempStock] = useState('');
    const [tempSizeStocks, setTempSizeStocks] = useState({});

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const q = query(collection(db, "products"));
                const querySnapshot = await getDocs(q);
                const items = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort by sortOrder if available
                items.sort((a, b) => (a.sortOrder ?? 99999) - (b.sortOrder ?? 99999));
                setProducts(items);
                setManualOrder(items);
                
                // Auto-fix negative or mismatched stock on load
                const negativeItems = items.filter(p => Number(p.stock || 0) < 0);
                const negativeSizesItems = items.filter(p => {
                    if (!p.sizeStocks) return false;
                    return Object.values(p.sizeStocks).some(v => Number(v || 0) < 0);
                });
                // Fix products where total stock != sum of size stocks
                const mismatchedStockItems = items.filter(p => {
                    if (!p.sizeStocks || Object.keys(p.sizeStocks).length === 0) return false;
                    const sumOfSizes = Object.values(p.sizeStocks).reduce((sum, qty) => sum + Number(qty || 0), 0);
                    return Number(p.stock || 0) !== sumOfSizes;
                });
                
                if (negativeItems.length > 0 || negativeSizesItems.length > 0 || mismatchedStockItems.length > 0) {
                    for (const p of negativeItems) {
                        await updateDoc(doc(db, 'products', p.id), { stock: 0 });
                    }
                    for (const p of negativeSizesItems) {
                        const fixes = {};
                        for (const [size, qty] of Object.entries(p.sizeStocks || {})) {
                            if (Number(qty || 0) < 0) {
                                fixes[`sizeStocks.${size}`] = 0;
                            }
                        }
                        if (Object.keys(fixes).length > 0) {
                            await updateDoc(doc(db, 'products', p.id), fixes);
                        }
                    }
                    for (const p of mismatchedStockItems) {
                        const correctStock = Object.values(p.sizeStocks).reduce((sum, qty) => sum + Number(qty || 0), 0);
                        await updateDoc(doc(db, 'products', p.id), { stock: correctStock });
                    }
                    // Re-fetch after fix
                    const freshSnap = await getDocs(q);
                    const fixedItems = freshSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    fixedItems.sort((a, b) => (a.sortOrder ?? 99999) - (b.sortOrder ?? 99999));
                    setProducts(fixedItems);
                    setManualOrder(fixedItems);
                }
            } catch (err) {
                console.error("Error fetching inventory:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const updateStock = async (id, newStock) => {
        try {
            await updateDoc(doc(db, "products", id), { stock: Number(newStock) });
            const updater = (prev) => prev.map(p => p.id === id ? { ...p, stock: Number(newStock) } : p);
            setProducts(updater(products));
            setManualOrder(prev => updater(prev));
        } catch (err) {
            console.error("Error updating stock:", err);
        }
    };

    const updateStockWithSizes = async (id, sizeStocks) => {
        try {
            const firestoreUpdates = {};
            let totalStock = 0;
            for (const [size, qty] of Object.entries(sizeStocks)) {
                firestoreUpdates[`sizeStocks.${size}`] = Number(qty) || 0;
                totalStock += Number(qty) || 0;
            }
            firestoreUpdates.stock = totalStock;
            await updateDoc(doc(db, "products", id), firestoreUpdates);
            // Update local state immediately so no refresh needed
            const updater = (prev) => prev.map(p => {
                if (p.id !== id) return p;
                const updatedSizeStocks = { ...(p.sizeStocks || {}) };
                for (const [size, qty] of Object.entries(sizeStocks)) {
                    updatedSizeStocks[size] = Number(qty) || 0;
                }
                return { ...p, sizeStocks: updatedSizeStocks, stock: totalStock };
            });
            setProducts(updater(products));
            setManualOrder(prev => updater(prev));
        } catch (err) {
            console.error("Error updating size stocks:", err);
        }
    };

    const deleteProduct = async (id) => {
        if (!id) return;
        if (!window.confirm(txt.alert_del)) return;
        try {
            await deleteDoc(doc(db, "products", id));
            setProducts(products.filter(p => p.id !== id));
            alert(txt.alert_del_success);
        } catch (err) {
            console.error("Error deleting product:", err);
            alert(txt.alert_del_error + err.message);
        }
    };

    // Manual sort functions
    const moveUp = (index) => {
        if (index === 0) return;
        const newOrder = [...manualOrder];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        setManualOrder(newOrder);
    };

    const moveDown = (index) => {
        if (index === manualOrder.length - 1) return;
        const newOrder = [...manualOrder];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        setManualOrder(newOrder);
    };

    const saveManualOrder = async () => {
        setSavingOrder(true);
        try {
            const batch = writeBatch(db);
            manualOrder.forEach((product, idx) => {
                batch.update(doc(db, 'products', product.id), { sortOrder: idx });
            });
            await batch.commit();
            setProducts([...manualOrder]);
            alert(txt.order_saved);
        } catch (err) {
            console.error("Error saving order:", err);
            alert(isRTL ? 'حدث خطأ أثناء حفظ الترتيب' : 'Error saving order');
        } finally {
            setSavingOrder(false);
        }
    };

    // Sorting logic
    const sortedProducts = useMemo(() => {
        switch (sortBy) {
            case 'name_az': return [...products].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            case 'name_za': return [...products].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
            case 'stock_asc': return [...products].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
            case 'stock_desc': return [...products].sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
            case 'price_asc': return [...products].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
            case 'price_desc': return [...products].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
            default: return manualOrder.length === products.length ? [...manualOrder] : [...products];
        }
    }, [products, sortBy, manualOrder]);

    const filteredItems = sortedProducts.filter(p => {
        const matchesSearch = (p.name?.toLowerCase() || '').includes((searchQuery || '').toLowerCase()) ||
            (p.code?.toLowerCase() || '').includes((searchQuery || '').toLowerCase()) ||
            (p.id?.toLowerCase() || '').includes((searchQuery || '').toLowerCase());
        if (!matchesSearch) return false;
        if (filter === 'out') return Number(p.stock || 0) <= 0;
        if (filter === 'near') return Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5;
        if (filter === 'available') return Number(p.stock || 0) > 5;
        if (filter === 'all') return true;
        if (filter === 'audit') return true;
        return true;
    });

    // Global totals (always all products)
    const allTotalQty = products.reduce((acc, p) => acc + Number(p.stock || 0), 0);
    const allTotalSell = products.reduce((acc, p) => acc + (Number(p.price || 0) * Number(p.stock || 0)), 0);
    const allTotalCost = products.reduce((acc, p) => acc + (Number(p.costPrice || 0) * Number(p.stock || 0)), 0);
    const allTotalProfit = allTotalSell - allTotalCost;

    // Filtered totals
    const totalQty = filteredItems.reduce((acc, p) => acc + Number(p.stock || 0), 0);
    const totalSell = filteredItems.reduce((acc, p) => acc + (Number(p.price || 0) * Number(p.stock || 0)), 0);
    const totalCost = filteredItems.reduce((acc, p) => acc + (Number(p.costPrice || 0) * Number(p.stock || 0)), 0);

    const sortOptions = [
        { id: 'default', label: txt.sort_default },
        { id: 'name_az', label: txt.sort_name_az },
        { id: 'name_za', label: txt.sort_name_za },
        { id: 'stock_asc', label: txt.sort_stock_asc },
        { id: 'stock_desc', label: txt.sort_stock_desc },
        { id: 'price_asc', label: txt.sort_price_asc },
        { id: 'price_desc', label: txt.sort_price_desc },
    ];

    const filterTabs = [
        { id: 'all', label: txt.filter_all, color: 'blue', count: products.length },
        { id: 'available', label: txt.filter_available, color: 'green', count: products.filter(p => Number(p.stock || 0) > 5).length },
        { id: 'near', label: txt.filter_near, color: 'yellow', count: products.filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5).length },
        { id: 'out', label: txt.filter_out, color: 'red', count: products.filter(p => Number(p.stock || 0) <= 0).length },
    ];

    const colorMap = {
        blue: { active: 'border-blue-500 bg-blue-500 text-white', inactive: 'border-gray-100 bg-white text-gray-500 hover:border-blue-200', count: 'bg-blue-600' },
        green: { active: 'border-green-500 bg-green-500 text-white', inactive: 'border-gray-100 bg-white text-gray-500 hover:border-green-200', count: 'bg-green-600' },
        yellow: { active: 'border-yellow-500 bg-yellow-500 text-white', inactive: 'border-gray-100 bg-white text-gray-500 hover:border-yellow-200', count: 'bg-yellow-500' },
        red: { active: 'border-red-500 bg-red-500 text-white', inactive: 'border-gray-100 bg-white text-gray-500 hover:border-red-200', count: 'bg-red-500' },
    };

    return (
        <div className="space-y-6 font-['Cairo'] relative" dir={isRTL ? "rtl" : "ltr"}>

            {/* ===================== PRINT HEADER ===================== */}
            <div className="hidden print:block mb-6 text-right" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div className="flex justify-between items-start border-b-2 border-gray-100 pb-4 mb-4">
                    <div className="flex items-center gap-4">
                        <div style={{ width: '50px', height: '50px', minWidth: '50px', minHeight: '50px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                            <img src="/admin-new-icon.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.src = "/nav-logo.png"} />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h1 className="text-lg font-black text-gray-900 leading-tight mb-0">{generalSettings?.storeName || 'Milano Store'}</h1>
                            <p className="text-blue-600 font-bold uppercase tracking-widest" style={{ fontSize: '9px' }}>{txt.print_report}</p>
                        </div>
                    </div>
                    <div className="text-left py-1">
                        <p className="text-[8px] font-black text-gray-400 mb-0.5 uppercase">{lang === 'ar' ? 'تاريخ التقرير' : 'Report Date'}</p>
                        <p className="text-[10px] font-bold text-gray-900">{new Date().toLocaleDateString(lang === 'ar' ? 'ar-YE' : 'en-GB')} - {new Date().toLocaleTimeString(lang === 'ar' ? 'ar-YE' : 'en-GB')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="bg-gray-50 border border-gray-100 p-1.5 rounded text-center">
                        <p className="text-[6px] font-black text-gray-400 uppercase mb-0">{lang === 'ar' ? 'الفلتر' : 'Filter'}</p>
                        <p className="text-[8px] font-black text-blue-600 leading-tight">{filter === 'all' ? txt.filter_all : filter === 'near' ? txt.filter_near : filter === 'out' ? txt.filter_out : filter === 'available' ? txt.filter_available : txt.filter_audit}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-1.5 rounded text-center">
                        <p className="text-[6px] font-black text-blue-400 uppercase mb-0">{txt.total} {txt.piece}</p>
                        <p className="text-[9px] font-black text-blue-700 leading-tight">{totalQty.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-1.5 rounded text-center">
                        <p className="text-[6px] font-black text-gray-400 uppercase mb-0">{txt.th_total_cost}</p>
                        <p className="text-[9px] font-black text-gray-900 leading-tight">{totalCost.toLocaleString()} <span className="text-[6px] opacity-50">{currency}</span></p>
                    </div>
                    <div className="bg-green-50 border border-green-100 p-1.5 rounded text-center">
                        <p className="text-[6px] font-black text-green-400 uppercase mb-0">{txt.th_total_sell}</p>
                        <p className="text-[9px] font-black text-green-700 leading-tight">{totalSell.toLocaleString()} <span className="text-[6px] opacity-50">{currency}</span></p>
                    </div>
                </div>
            </div>

            {/* ===================== ACTION BAR ===================== */}
            <div className="space-y-5 no-print">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-5 border-b border-gray-100">
                    <div className="flex flex-wrap gap-2 items-center">
                        <button className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-blue-600 transition shadow-lg shadow-blue-200">
                            <Plus size={18} /> {txt.add_stock}
                        </button>
                        <button onClick={() => window.print()} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-gray-50 transition">
                            <Printer size={18} /> {txt.print_report}
                        </button>
                        {/* Sort Dropdown - next to print button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSortMenu(!showSortMenu)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:border-blue-300 rounded-xl font-black text-sm text-gray-600 transition-all hover:bg-gray-50"
                            >
                                <ArrowUpDown size={16} className="text-blue-500" />
                                <span>{txt.sort_label}</span>
                                {sortBy && (
                                    <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-black">
                                        {sortOptions.find(s => s.id === sortBy)?.label}
                                    </span>
                                )}
                                <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showSortMenu && (
                                <div className={`absolute top-full mt-2 ${isRTL ? 'right-0' : 'left-0'} z-30 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[200px]`}>
                                    {sortOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setSortBy(prev => prev === opt.id ? '' : opt.id); setShowSortMenu(false); }}
                                            className={`w-full px-5 py-3 text-sm font-bold text-right transition-colors flex items-center justify-between gap-3 ${sortBy === opt.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            <span>{opt.label}</span>
                                            {sortBy === opt.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {sortBy === 'default' && (
                            <button
                                onClick={saveManualOrder}
                                disabled={savingOrder}
                                className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-emerald-600 transition shadow-lg shadow-emerald-200 disabled:opacity-50"
                            >
                                <Save size={16} />
                                {savingOrder ? txt.saving : txt.save_order}
                            </button>
                        )}
                    </div>
                    <div className="flex-1 max-w-md relative">
                        <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-2.5 text-gray-400`} size={18} />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={txt.search_placeholder}
                            className={`w-full bg-white border border-gray-200 rounded-xl py-2.5 ${isRTL ? 'pr-12 pl-20' : 'pl-12 pr-20'} outline-none focus:border-blue-500 font-bold text-sm shadow-sm text-gray-900 placeholder-gray-400`}
                        />
                        <button className={`absolute ${isRTL ? 'left-1' : 'right-1'} top-1 h-8 px-4 bg-blue-500 text-white rounded-lg text-xs font-black shadow-md`}>{txt.search_btn}</button>
                    </div>
                </div>

                {/* ===================== FILTERS ===================== */}
                <div className="space-y-3">
                    {/* Filter Tabs Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {filterTabs.map(tab => {
                            const c = colorMap[tab.color];
                            const isActive = filter === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id)}
                                    className={`relative py-6 rounded-[22px] border-2 transition-all flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md ${isActive ? c.active : c.inactive}`}
                                >
                                    {/* Count badge */}
                                    <span className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} text-[11px] font-black px-2 py-0.5 rounded-full text-white ${isActive ? 'bg-white/30' : c.count}`}>
                                        {tab.count}
                                    </span>
                                    <span className="text-sm font-black">{tab.label}</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'opacity-70' : 'opacity-40'}`}>{txt.click_to_view}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Audit tab - aligned with tabs above */}
                    <div>
                        <button
                            onClick={() => setFilter('audit')}
                            className={`w-full px-6 py-3 rounded-[18px] border-2 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md ${filter === 'audit' ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-100 bg-white text-gray-500 hover:border-purple-200'}`}
                        >
                            <ClipboardList size={18} />
                            <span className="text-sm font-black">{txt.filter_audit}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${filter === 'audit' ? 'bg-white/30' : 'bg-purple-500'}`}>
                                {products.length}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ===================== INVENTORY TABLE ===================== */}
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden printable-content print:rounded-none print:shadow-none print:border-none print:overflow-visible">
                <div className="overflow-x-auto print:overflow-visible">

                    {/* AUDIT MODE: special layout showing sizes */}
                    {filter === 'audit' ? (
                        <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} font-bold border-collapse`}>
                            <thead className="bg-purple-50 text-[11px] font-black text-purple-700 uppercase tracking-widest border-b-2 border-purple-100">
                                <tr style={{ height: '44px' }}>
                                    <th className="px-4 text-center" style={{ width: '5%' }}>#</th>
                                    <th className="px-3" style={{ width: '10%' }}>{txt.th_code}</th>
                                    <th className="px-3" style={{ width: '30%' }}>{txt.th_name}</th>
                                    <th className="px-3" style={{ width: '35%' }}>{txt.th_sizes}</th>
                                    <th className="px-3 text-center text-gray-900 dark:text-white" style={{ width: '10%' }}>{txt.th_stock}</th>
                                    <th className="px-3 text-center no-print text-gray-900 dark:text-white" style={{ width: '10%' }}>{txt.th_actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredItems.map((product, idx) => {
                                    const sizeVariant = product.variants?.find(v => v.type === 'size');
                                    const sizeValues = sizeVariant?.values || [];
                                    return (
                                        <tr key={product.id} className="hover:bg-purple-50/30 transition-colors">
                                            <td className="px-4 text-center text-xs font-black text-gray-400">{idx + 1}</td>
                                            <td className="px-3 text-xs font-mono text-blue-700 font-bold">{product.code || '---'}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 no-print">
                                                        <img src={product.mainImage || "/nav-logo.png"} className="w-full h-full object-cover" alt={product.name} onError={(e) => e.target.src = "/nav-logo.png"} />
                                                    </div>
                                                    <span className="text-sm font-black text-gray-800">{product.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                {sizeValues.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {sizeValues.map(size => {
                                                            const qty = Number(product.sizeStocks?.[size] || 0);
                                                            return (
                                                                <span key={size} className={`text-[11px] font-black border-2 rounded-xl px-3 py-1 flex items-center gap-1.5 ${qty === 0 ? 'border-red-200 bg-red-50 text-red-600' : qty <= 3 ? 'border-orange-200 bg-orange-50 text-orange-600' : 'border-blue-100 bg-blue-50 text-blue-700'}`}>
                                                                    <span className="font-bold text-gray-500">{size}:</span>
                                                                    <span className="font-black text-base">{qty}</span>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 font-bold">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 text-center">
                                                <span className={`px-3 py-1.5 rounded-full text-sm font-black whitespace-nowrap ${Number(product.stock) <= 0 ? 'bg-red-100 text-red-600' : Number(product.stock) <= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700'}`}>
                                                    {product.stock} {txt.piece}
                                                </span>
                                            </td>
                                            <td className="px-3 text-center no-print">
                                                <button onClick={() => deleteProduct(product.id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        /* REGULAR TABLE (all, available, near, out) */
                        <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} font-bold border-collapse`}>
                            <thead className="bg-gray-50 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b-2 border-gray-100">
                                <tr style={{ height: '44px' }}>
                                    <th className="px-3 text-center" style={{ width: '4%' }}>#</th>
                                    <th className="px-3" style={{ width: '10%' }}>{txt.th_code}</th>
                                    <th className="px-3" style={{ width: '28%' }}>{txt.th_name}</th>
                                    {/* Cost columns */}
                                    <th className="px-3" style={{ width: '10%' }}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-gray-700">{txt.th_cost}</span>
                                        </div>
                                    </th>
                                    <th className="px-3" style={{ width: '10%' }}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-orange-500">{txt.th_total_cost}</span>
                                        </div>
                                    </th>
                                    {/* Sell columns */}
                                    <th className="px-3" style={{ width: '10%' }}>
                                        <span className="text-gray-700">{txt.th_sell}</span>
                                    </th>
                                    <th className="px-3" style={{ width: '10%' }}>
                                        <span className="text-green-600">{txt.th_total_sell}</span>
                                    </th>
                                    <th className="px-3 text-gray-900 dark:text-white" style={{ width: '12%' }}>{txt.th_stock}</th>
                                    <th className="px-3 no-print text-center text-gray-900 dark:text-white" style={{ width: '6%' }}>{txt.th_actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                                {filteredItems.map((product, idx) => {
                                    const costPrice = Number(product.costPrice || 0);
                                    const sellPrice = Number(product.price || 0);
                                    const stock = Number(product.stock || 0);
                                    const sizeVariant = product.variants?.find(v => v.type === 'size');
                                    const sizeValues = sizeVariant?.values || [];
                                    const totalCostItem = costPrice * stock;
                                    const totalSellItem = sellPrice * stock;
                                    return (
                                        <tr key={product.id} className="hover:bg-gray-50 transition-colors print:bg-white" style={{ height: '58px' }}>
                                            <td className="px-3 text-center text-xs font-black text-gray-400">{idx + 1}</td>
                                            <td className="px-3 text-xs font-mono text-blue-700 font-bold">{product.code || '---'}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-11 h-11 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shadow-inner flex-shrink-0 no-print">
                                                        <img src={product.mainImage || "/nav-logo.png"} className="w-full h-full object-cover" alt={product.name} onError={(e) => e.target.src = "/nav-logo.png"} />
                                                    </div>
                                                    <img src={product.mainImage} className="hidden print:block print-report-img rounded-md border border-gray-50" onError={(e) => e.target.style.display = 'none'} />
                                                    <div className="flex flex-col">
                                                        {/* LARGER product name (was text-sm, now text-base + font-extrabold) */}
                                                        <span className="text-base font-extrabold text-gray-900 print:text-[10px]">{product.name}</span>
                                                        <div className="flex items-center gap-1.5 no-print mt-0.5">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${stock > 5 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                                                            <span className="text-[10px] text-gray-400 font-bold">{txt.active_in_store}</span>
                                                        </div>
                                                        {/* Sizes: larger and clearer */}
                                                        {editingId !== product.id && product.variants?.find(v => v.type === 'size')?.values?.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-1.5 no-print">
                                                                {product.variants.find(v => v.type === 'size').values.map(size => {
                                                                    const qty = product.sizeStocks?.[size] !== undefined ? Number(product.sizeStocks[size]) : 0;
                                                                    return (
                                                                        <span key={size} className={`text-[12px] font-black border rounded-lg px-2.5 py-0.5 flex items-center gap-1 ${qty === 0 ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                                                                            <span className="text-gray-400">{size}:</span>
                                                                            <span className={`font-black text-[13px] ${qty === 0 ? 'text-red-500' : 'text-blue-600'}`}>{qty}</span>
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                        {editingId === product.id ? (
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-2 no-print">
                                                                {sizeValues.length > 0 ? (
                                                                    sizeValues.map(size => (
                                                                        <label key={size} className="inline-flex items-center gap-1 whitespace-nowrap border border-blue-300 rounded-lg px-1.5 py-0.5 bg-blue-50">
                                                                            <span className="text-[10px] font-bold text-gray-500">{size}:</span>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                className="w-9 bg-white border border-blue-400 rounded text-center text-[11px] font-black outline-none"
                                                                                value={tempSizeStocks[size] ?? product.sizeStocks?.[size] ?? 0}
                                                                                onChange={(e) => setTempSizeStocks(prev => ({ ...prev, [size]: Math.max(0, Number(e.target.value) || 0) }))}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') { updateStockWithSizes(product.id, tempSizeStocks); setEditingId(null); }
                                                                                    if (e.key === 'Escape') setEditingId(null);
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    ))
                                                                ) : (
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="w-16 bg-white border-2 border-blue-500 rounded-lg py-1 text-center text-xs font-black outline-none"
                                                                        value={tempStock}
                                                                        onChange={(e) => setTempStock(Math.max(0, Number(e.target.value) || 0))}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') { updateStock(product.id, tempStock); setEditingId(null); }
                                                                            if (e.key === 'Escape') setEditingId(null);
                                                                        }}
                                                                    />
                                                                )}
                                                                <button type="button" onClick={() => { sizeValues.length > 0 ? updateStockWithSizes(product.id, tempSizeStocks) : updateStock(product.id, tempStock); setEditingId(null); }} className="w-7 h-7 p-0 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center justify-center" title={txt.save}>
                                                                    <Save size={12} />
                                                                </button>
                                                                <button type="button" onClick={() => setEditingId(null)} className="px-1.5 py-1 text-[10px] font-black text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200" title={txt.cancel}>
                                                                    {txt.cancel}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setEditingId(product.id); setTempStock(product.stock); setTempSizeStocks(product.sizeStocks || {}); }}
                                                                className="mt-1 w-7 h-7 p-0 bg-blue-50 rounded-md text-blue-500 hover:bg-blue-100 transition-colors no-print flex items-center justify-center"
                                                                title={txt.edit}
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Cost Price - larger */}
                                            <td className="px-3">
                                                <span className="text-sm font-black text-gray-700 print:text-[10px]">{costPrice.toLocaleString()}</span>
                                                <span className="text-[10px] text-gray-400 font-bold block">{currency}</span>
                                            </td>
                                            {/* Total Cost (cost × stock) */}
                                            <td className="px-3">
                                                <span className="text-sm font-black text-orange-600 print:text-[10px]">{totalCostItem.toLocaleString()}</span>
                                                <span className="text-[10px] text-gray-400 font-bold block">{currency}</span>
                                            </td>

                                            {/* Sell Price - larger */}
                                            <td className="px-3">
                                                <span className="text-sm font-black text-gray-900 dark:text-white print:text-[10px]">{sellPrice.toLocaleString()}</span>
                                                <span className="text-[10px] text-gray-400 font-bold block">{currency}</span>
                                            </td>
                                            {/* Total Sell (sell × stock) */}
                                            <td className="px-3">
                                                <span className="text-base font-black text-green-700 print:text-[10px]">{totalSellItem.toLocaleString()}</span>
                                                <span className="text-[10px] text-gray-400 font-bold block">{currency}</span>
                                            </td>

                                            {/* Stock */}
                                            <td className="px-3 py-1">
                                                <div className="flex items-center gap-2">
                                                    <div className={`px-4 py-1.5 rounded-full text-sm font-black print:p-0 print:bg-transparent ${
                                                        stock <= 0 ? 'bg-red-100 text-red-600' :
                                                        stock <= 5 ? 'bg-orange-100 text-orange-600' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        {stock}<span className="mx-0.5"></span>{txt.piece}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-3 no-print text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {sortBy === 'default' && (
                                                        <>
                                                            <button
                                                                onClick={() => moveUp(idx)}
                                                                disabled={idx === 0}
                                                                className="p-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title={isRTL ? "تحريك لأعلى" : "Move up"}
                                                            >
                                                                <ChevronUp size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => moveDown(idx)}
                                                                disabled={idx === filteredItems.length - 1}
                                                                className="p-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title={isRTL ? "تحريك لأسفل" : "Move down"}
                                                            >
                                                                <ChevronDown size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button onClick={() => deleteProduct(product.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* Table footer for filtered totals — hidden during print to avoid per-page repetition */}
                            <tfoot className="border-t-2 border-gray-200 bg-gray-50/80 print:hidden">
                                <tr style={{ height: '50px' }}>
                                    <td colSpan={3} className="px-4 text-sm font-black text-gray-700">
                                        {txt.total} — {filteredItems.length} {lang === 'ar' ? 'منتج' : 'Products'}
                                    </td>
                                    {/* Total cost (unit) */}
                                    <td className="px-3">
                                        <span className="text-xs font-black text-gray-500 block">{txt.th_cost}</span>
                                        <span className="text-sm font-black text-gray-700">—</span>
                                    </td>
                                    {/* Total cost value */}
                                    <td className="px-3">
                                        <span className="text-xs font-black text-orange-500 block">{txt.th_total_cost}</span>
                                        <span className="text-base font-black text-orange-600">{totalCost.toLocaleString()} <span className="text-xs font-bold text-gray-400">{currency}</span></span>
                                    </td>
                                    {/* Total sell (unit) */}
                                    <td className="px-3">
                                        <span className="text-xs font-black text-gray-500 block">{txt.th_sell}</span>
                                        <span className="text-sm font-black text-gray-700">—</span>
                                    </td>
                                    {/* Total sell value */}
                                    <td className="px-3">
                                        <span className="text-xs font-black text-green-600 block">{txt.th_total_sell}</span>
                                        <span className="text-base font-black text-green-700">{totalSell.toLocaleString()} <span className="text-xs font-bold text-gray-400">{currency}</span></span>
                                    </td>
                                    <td className="px-3">
                                        <span className="text-xs font-black text-gray-500 block">{txt.th_stock}</span>
                                        <span className="text-base font-black text-blue-600">{totalQty.toLocaleString()} <span className="text-xs font-bold text-gray-400">{txt.piece}</span></span>
                                    </td>
                                    <td className="no-print" />
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {/* Print footer — totals appear ONCE at the very end */}
                    <div className="hidden print:block mt-6 px-6 bg-white">
                        {/* Grand Totals Summary */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', borderTop: '2px solid #e5e7eb' }}>
                            <tbody>
                                <tr style={{ backgroundColor: '#f9fafb' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 900, fontSize: '11px', color: '#374151' }}>
                                        {txt.total} — {filteredItems.length} {lang === 'ar' ? 'منتج' : 'Products'}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#6b7280' }}>{txt.th_cost}</span>
                                        <span style={{ fontSize: '11px', fontWeight: 900, color: '#374151' }}>—</span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#f97316' }}>{txt.th_total_cost}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#ea580c' }}>{totalCost.toLocaleString()} <span style={{ fontSize: '9px', color: '#9ca3af' }}>{currency}</span></span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#6b7280' }}>{txt.th_sell}</span>
                                        <span style={{ fontSize: '11px', fontWeight: 900, color: '#374151' }}>—</span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#16a34a' }}>{txt.th_total_sell}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#15803d' }}>{totalSell.toLocaleString()} <span style={{ fontSize: '9px', color: '#9ca3af' }}>{currency}</span></span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#6b7280' }}>{txt.th_stock}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#2563eb' }}>{totalQty.toLocaleString()} <span style={{ fontSize: '9px', color: '#9ca3af' }}>{txt.piece}</span></span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Signature lines */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: '128px', height: '1px', backgroundColor: '#d1d5db', marginBottom: '12px' }} />
                                <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{lang === 'ar' ? 'توقيع أمين المخازن' : 'Warehouse Keeper'}</p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: '128px', height: '1px', backgroundColor: '#d1d5db', marginBottom: '12px' }} />
                                <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{lang === 'ar' ? 'اعتماد الإدارة' : 'Management'}</p>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', paddingTop: '12px', borderTop: '1px solid #f9fafb' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(59,130,246,0.5)', letterSpacing: '0.1em' }}>{window.location.origin.replace(/^https?:\/\//, '')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===================== GRAND TOTAL FOOTER ===================== */}
            <div className="no-print bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600">
                        <Package size={22} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-900">{txt.grand_total_title}</h3>
                        <p className="text-xs text-gray-400 font-bold">{lang === 'ar' ? 'يشمل جميع المنتجات بغض النظر عن الفلتر المحدد' : 'Includes all products regardless of active filter'}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Total Products */}
                    <div className="bg-cyan-50/70 border border-cyan-200 rounded-[20px] p-4 flex flex-col gap-1 dark:bg-cyan-400/10 dark:border-cyan-400/25">
                        <span className="text-xs font-black text-cyan-600 dark:text-cyan-300 uppercase tracking-wide">{txt.grand_total_products}</span>
                        <span className="text-2xl font-black text-cyan-700 dark:text-cyan-200">{products.length}</span>
                        <span className="text-[10px] font-bold text-cyan-500 dark:text-cyan-300/80">{lang === 'ar' ? 'منتج مسجّل' : 'Registered Products'}</span>
                    </div>
                    {/* Total Qty */}
                    <div className="bg-violet-50/70 border border-violet-200 rounded-[20px] p-4 flex flex-col gap-1 dark:bg-violet-400/10 dark:border-violet-400/25">
                        <span className="text-xs font-black text-violet-600 dark:text-violet-300 uppercase tracking-wide">{txt.grand_total_qty}</span>
                        <span className="text-2xl font-black text-violet-700 dark:text-violet-200">{allTotalQty.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-violet-500 dark:text-violet-300/80">{txt.piece}</span>
                    </div>
                    {/* Total Cost */}
                    <div className="bg-orange-50 border border-orange-100 rounded-[20px] p-4 flex flex-col gap-1">
                        <span className="text-xs font-black text-orange-500 uppercase tracking-wide">{txt.grand_total_cost}</span>
                        <span className="text-xl font-black text-orange-700">{allTotalCost.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-orange-400">{currency}</span>
                    </div>
                    {/* Total Sell */}
                    <div className="bg-green-50/70 border border-green-200 rounded-[20px] p-4 flex flex-col gap-1 dark:bg-green-400/10 dark:border-green-400/25">
                        <span className="text-xs font-black text-green-600 dark:text-green-300 uppercase tracking-wide">{txt.grand_total_sell}</span>
                        <span className="text-xl font-black text-green-700 dark:text-green-200">{allTotalSell.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-green-500 dark:text-green-300/80">{currency}</span>
                    </div>
                    {/* Net Profit */}
                    <div className={`border rounded-[20px] p-4 flex flex-col gap-1 ${allTotalProfit >= 0 ? 'bg-blue-50/70 border-blue-200 dark:bg-blue-400/10 dark:border-blue-400/25' : 'bg-red-50/70 border-red-200 dark:bg-red-400/10 dark:border-red-400/25'}`}>
                        <span className={`text-xs font-black uppercase tracking-wide ${allTotalProfit >= 0 ? 'text-blue-600 dark:text-blue-300' : 'text-red-500 dark:text-red-300'}`}>{txt.grand_total_profit}</span>
                        <span className={`text-xl font-black ${allTotalProfit >= 0 ? 'text-blue-700 dark:text-blue-200' : 'text-red-600 dark:text-red-300'}`}>
                            {allTotalProfit >= 0 ? '+' : ''}{allTotalProfit.toLocaleString()}
                        </span>
                        <span className={`text-[10px] font-bold ${allTotalProfit >= 0 ? 'text-blue-500 dark:text-blue-300/80' : 'text-red-400 dark:text-red-300/80'}`}>{currency}</span>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default InventoryView;
