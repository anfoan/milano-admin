import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Calendar, Clock, RotateCcw, Save, Check, Edit2, X, ChevronRight, Package, Hash, BarChart3 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { getLocalizedCurrency } from '../../lib/currencyUtils';

const LimitedOffersView = ({ lang = 'ar', generalSettings }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list'); // 'list' or 'sort-offers'
    const [sortedOffers, setSortedOffers] = useState([]);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    // Form State
    const [discountPercent, setDiscountPercent] = useState(0);
    const [isTimeLimited, setIsTimeLimited] = useState(false);
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('23:59');
    const [applyToAll, setApplyToAll] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState(0);
    const [tableSearch, setTableSearch] = useState('');
    const [discountAmountInput, setDiscountAmountInput] = useState('');
    const [lastInteracted, setLastInteracted] = useState('percent'); // 'amount' or 'percent'
    const [isAdding, setIsAdding] = useState(false); // Fix: Define isAdding state

    const t = {
        ar: {
            title: "العروض والخصومات",
            add_offer: "إضافة عرض جديد",
            cancel: "إلغاء",
            discount_percent: "نسبة الخصم %",
            time_limited: "تحديد الخصم لفترة محدودة",
            timezone: "توقيت المدينة",
            end_date: "تاريخ انتهاء الخصم",
            end_time: "وقت انتهاء الخصم",
            estimated_duration: "الفترة المقدرة",
            apply_all: "تطبيق على جميع المنتجات",
            apply_all_desc: "سيتم تطبيق الخصم على جميع المنتجات",
            select_products: "حدد المنتجات",
            search_product: "بحث عن منتج...",
            save_offer: "حفظ العرض",
            search_placeholder: "بحث عن اسم المنتج / وحدة زمنية",
            delete_selected: "حذف المحدد",

            // Table
            th_countdown: "العد التنازلي",
            th_product: "اسم المنتج",
            th_expiry: "تاريخ الانتهاء",
            th_timezone: "وحدة زمنية",
            th_discount: "نسبة الخصم",
            th_original_price: "السعر قبل الخصم",
            th_price_after: "السعر بعد الخصم",
            th_actions: "العمليات",

            // Values/Status
            val_limited: "محدودة",
            val_unlimited: "غير محدودة",
            val_product: "منتج",
            val_expired: "منتهي",
            val_paused: "متوقف مؤقتاً",
            no_offers: "لا توجد عروض نشطة حالياً",
            currency: "ر.ي",

            // Alerts
            alert_missing_discount: "يرجى تحديد نسبة الخصم",
            alert_missing_date: "يرجى تحديد تاريخ الانتهاء",
            alert_missing_products: "يرجى تحديد المنتجات المشمولة بالعرض",
            alert_success: "تم حفظ العرض بنجاح!",
            alert_error: "حدث خطأ أثناء حفظ العرض",
            alert_confirm_remove: "هل أنت متأكد من إلغاء العرض لهذا المنتج؟",
            alert_confirm_bulk: "هل أنت متأكد من حذف العروض المحددة؟",
            alert_confirm_pause: "هل أنت متأكد من تغيير حالة العرض؟",
            alert_success_bulk: "تم حذف العروض المحددة بنجاح",
            alert_success_pause: "تم تغيير حالة العروض المحددة بنجاح",
            sort_offers: "ترتيب العروض",
            save_order: "حفظ الترتيب",
            sort_offers_desc: "التحكم في ترتيب ظهور العروض في صفحة العروض",
            pause_selected: "إيقاف الخصم لـ",
            resume_selected: "تفعيل الخصم لـ",
            delete_selected_count: "حذف الخصم لـ"
        },
        en: {
            title: "Offers & Discounts",
            add_offer: "Add New Offer",
            cancel: "Cancel",
            discount_percent: "Discount %",
            time_limited: "Limit discount to specific time",
            timezone: "Timezone",
            end_date: "End Date",
            end_time: "End Time",
            estimated_duration: "Duration",
            apply_all: "Apply to all products",
            apply_all_desc: "Discount will be applied to all products",
            select_products: "Select Products",
            search_product: "Search product...",
            save_offer: "Save Offer",
            search_placeholder: "Search Product Name / Timezone",
            delete_selected: "Delete Selected",

            // Table
            th_countdown: "Countdown",
            th_product: "Product Name",
            th_expiry: "End Date",
            th_timezone: "Timezone",
            th_discount: "Discount",
            th_original_price: "Original Price",
            th_price_after: "Offer Price",
            th_actions: "Actions",

            // Values/Status
            val_limited: "Limited",
            val_unlimited: "Unlimited",
            val_product: "product",
            val_expired: "Expired",
            val_paused: "Paused",
            no_offers: "No active offers",
            currency: "YER",

            // Alerts
            alert_missing_discount: "Please specify discount percentage",
            alert_missing_date: "Please specify end date",
            alert_missing_products: "Please select products for this offer",
            alert_success: "Offer saved successfully!",
            alert_error: "Error saving offer",
            alert_confirm_remove: "Are you sure you want to remove the offer from this product?",
            alert_confirm_bulk: "Are you sure you want to delete selected offers?",
            alert_confirm_pause: "Are you sure you want to change offer status?",
            alert_success_bulk: "Selected offers removed successfully",
            alert_success_pause: "Selected offers status changed successfully",
            sort_offers: "Sort Offers",
            save_order: "Save Order",
            sort_offers_desc: "Control the order of offers in the offers page",
            pause_selected: "Pause Discount for",
            resume_selected: "Resume Discount for",
            delete_selected_count: "Delete Discount for"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';
    const currency = getLocalizedCurrency(generalSettings?.currency || 'YER', lang);

    const startEditing = (product) => {
        setEditingId(product.id);
        setEditValue(product.discount || 0);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditValue(0);
    };

    const saveEditing = async (productId, originalPrice) => {
        try {
            const newDiscount = Number(editValue);
            const price = Number(originalPrice);
            const discountAmount = (price * newDiscount) / 100;
            const newPriceAfter = price - discountAmount;

            await updateDoc(doc(db, "products", productId), {
                discount: newDiscount,
                priceAfterDiscount: newPriceAfter
            });

            // Optimistic Update
            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? { ...p, discount: newDiscount, priceAfterDiscount: newPriceAfter }
                    : p
            ));

            setEditingId(null);
            alert(txt.alert_success);
        } catch (error) {
            console.error("Error updating offer:", error);
            alert(txt.alert_error);
        }
    };

    useEffect(() => {
        const fetchProducts = async () => {
            const q = query(collection(db, "products"));
            const snapshot = await getDocs(q);
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(items);
            setLoading(false);
        };
        fetchProducts();
    }, []);

    const offers = products.filter(p => p.discount > 0 || p.isOfferPaused);

    const filteredOffers = offers.filter(p => {
        if (!tableSearch) return true;
        const searchLower = tableSearch.toLowerCase();
        return (
            (p.name && p.name.toLowerCase().includes(searchLower)) ||
            (p.offerTimezone && p.offerTimezone.toLowerCase().includes(searchLower)) ||
            (p.offerEndDate && p.offerEndDate.includes(tableSearch))
        );
    });

    const parsePrice = (priceVal) => {
        if (!priceVal) return 0;
        if (typeof priceVal === 'number') return priceVal;
        let str = priceVal.toString();
        // Handle Arabic numerals
        const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
        for (let i = 0; i < 10; i++) {
            str = str.replace(arabicNumbers[i], i.toString());
        }
        // Remove ALL commas (often used as thousand separators)
        str = str.replace(/,/g, '');
        // Note: we don't remove dots because they might be decimals.
        // If a user types 24.000 for 24,000, it'll parse as 24.
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    };

    useEffect(() => {
        if (!applyToAll && selectedProducts.length > 0) {
            const product = products.find(p => p.id === selectedProducts[0]);
            const pPrice = parsePrice(product?.price);
            
            if (pPrice > 0) {
                if (lastInteracted === 'amount' && discountAmountInput) {
                    const percent = (Number(discountAmountInput) / pPrice) * 100;
                    setDiscountPercent(Math.min(100, Math.max(0, Math.round(percent))));
                } else if (!discountAmountInput && discountPercent === 0 && lastInteracted === 'amount') {
                     setDiscountAmountInput('');
                } else if (lastInteracted === 'percent' && discountPercent >= 0) {
                    const amount = (pPrice * (Number(discountPercent) / 100));
                    setDiscountAmountInput(Number.isInteger(amount) ? amount.toString() : Math.round(amount).toString());
                }
            }
        } else if (!applyToAll) {
            setDiscountAmountInput('');
        }
    }, [discountAmountInput, discountPercent, selectedProducts, applyToAll, products, lastInteracted]);

    const handleSaveOffer = async () => {
        // Security & Validation Checks
        if (discountPercent <= 0 || discountPercent > 100) return alert(lang === 'ar' ? 'نسبة الخصم يجب أن تكون بين 1 و 100' : 'Discount must be between 1 and 100');

        if (isTimeLimited) {
            if (!endDate) return alert(txt.alert_missing_date);
            const selectedEnd = new Date(`${endDate}T${endTime || '23:59'}`);
            if (selectedEnd <= new Date()) return alert(lang === 'ar' ? 'تاريخ الانتهاء يجب أن يكون في المستقبل' : 'End date must be in the future');
        }

        if (!applyToAll && selectedProducts.length === 0) return alert(txt.alert_missing_products);

        try {
            const targetProducts = applyToAll ? products : products.filter(p => selectedProducts.includes(p.id));
            const updates = targetProducts.map(p => {
                const price = parsePrice(p.price);
                const discount = Number(discountPercent);
                // Ensure price doesn't go negative (though checks above prevent it via discount range)
                const priceAfterDiscount = Math.max(0, price - (price * (discount / 100)));

                return updateDoc(doc(db, "products", p.id), {
                    discount: discount,
                    priceAfterDiscount: priceAfterDiscount,
                    offerEndDate: isTimeLimited ? endDate : null,
                    offerEndTime: isTimeLimited ? endTime : null,
                    offerTimezone: 'Asia/Dubai',
                    hasOffer: true
                });
            });

            await Promise.all(updates);

            const { setDoc, doc: docRef } = await import('firebase/firestore');
            await setDoc(docRef(db, "settings", "global_offer"), {
                isActive: applyToAll,
                discount: discountPercent,
                updatedAt: new Date()
            });

            // Optimistic state update instead of reload
            setProducts(prev => prev.map(p => {
                const isTarget = applyToAll ? true : selectedProducts.includes(p.id);
                if (isTarget) {
                    const price = parsePrice(p.price);
                    const discount = Number(discountPercent);
                    const priceAfterDiscount = Math.max(0, price - (price * (discount / 100)));
                    return {
                        ...p,
                        discount,
                        priceAfterDiscount,
                        offerEndDate: isTimeLimited ? endDate : null,
                        offerEndTime: isTimeLimited ? endTime : null,
                        offerTimezone: 'Asia/Aden',
                        hasOffer: true
                    };
                }
                return p;
            }));

            setIsAdding(false);
            setDiscountPercent(0);
            setDiscountAmountInput('');
            setSelectedProducts([]);
            setIsTimeLimited(false);
            setEndDate('');
            
            alert(txt.alert_success);
        } catch (error) {
            console.error("Error saving offer:", error);
            alert(txt.alert_error);
        }
    };

    const toggleSingleOfferStatus = async (product, isPausing) => {
        if (!window.confirm(txt.alert_confirm_pause)) return;
        try {
            const price = parsePrice(product.price);
            if (isPausing) {
                const currentDiscount = Number(product.discount || product.pausedDiscount || 10);
                const currentPriceAfter = product.priceAfterDiscount || (price > 0 ? Math.max(0, price - (price * (currentDiscount / 100))) : null);

                await updateDoc(doc(db, "products", product.id), {
                    pausedDiscount: currentDiscount,
                    pausedPriceAfterDiscount: currentPriceAfter,
                    pausedOfferEndDate: product.offerEndDate || null,
                    pausedOfferEndTime: product.offerEndTime || null,
                    pausedOfferTimezone: product.offerTimezone || null,
                    discount: 0,
                    priceAfterDiscount: null,
                    hasOffer: false,
                    isOfferPaused: true
                });

                setProducts(prev => prev.map(p => {
                    if (p.id === product.id) {
                        return {
                            ...p,
                            pausedDiscount: currentDiscount,
                            pausedPriceAfterDiscount: currentPriceAfter,
                            pausedOfferEndDate: p.offerEndDate || null,
                            pausedOfferEndTime: p.offerEndTime || null,
                            isOfferPaused: true,
                            discount: 0,
                            priceAfterDiscount: null,
                            hasOffer: false
                        };
                    }
                    return p;
                }));
            } else {
                const restoredDiscount = Number(product.pausedDiscount || product.discount || 10);
                const restoredPriceAfter = product.pausedPriceAfterDiscount || (price > 0 ? Math.max(0, price - (price * (restoredDiscount / 100))) : null);

                await updateDoc(doc(db, "products", product.id), {
                    discount: restoredDiscount,
                    priceAfterDiscount: restoredPriceAfter,
                    offerEndDate: product.pausedOfferEndDate || product.offerEndDate || null,
                    offerEndTime: product.pausedOfferEndTime || product.offerEndTime || null,
                    offerTimezone: product.pausedOfferTimezone || product.offerTimezone || null,
                    pausedDiscount: null,
                    pausedPriceAfterDiscount: null,
                    pausedOfferEndDate: null,
                    pausedOfferEndTime: null,
                    pausedOfferTimezone: null,
                    hasOffer: true,
                    isOfferPaused: false
                });

                setProducts(prev => prev.map(p => {
                    if (p.id === product.id) {
                        return {
                            ...p,
                            discount: restoredDiscount,
                            priceAfterDiscount: restoredPriceAfter,
                            offerEndDate: p.pausedOfferEndDate || p.offerEndDate || null,
                            offerEndTime: p.pausedOfferEndTime || p.offerEndTime || null,
                            offerTimezone: p.pausedOfferTimezone || p.offerTimezone || null,
                            isOfferPaused: false,
                            pausedDiscount: null,
                            pausedPriceAfterDiscount: null,
                            hasOffer: true
                        };
                    }
                    return p;
                }));
            }
            alert(txt.alert_success_pause);
        } catch (error) {
            console.error("Error toggling offer:", error);
            alert(txt.alert_error);
        }
    };

    const getRemainingTime = (endDate, endTime) => {
        if (!endDate) return null;
        const end = new Date(`${endDate}T${endTime || '23:59:00'}`);
        const now = new Date();
        const diff = end - now;
        if (diff <= 0) return "EXPIRED";
        
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const removeOffer = async (productId) => {
        if (!window.confirm(txt.alert_confirm_remove)) return;
        try {
            await updateDoc(doc(db, "products", productId), {
                discount: 0,
                priceAfterDiscount: null,
                offerEndDate: null,
                offerEndTime: null,
                hasOffer: false,
                isOfferPaused: false,
                pausedDiscount: null,
                pausedPriceAfterDiscount: null,
                pausedOfferEndDate: null,
                pausedOfferEndTime: null,
                pausedOfferTimezone: null
            });
            setProducts(products.map(p => p.id === productId ? { ...p, discount: 0, hasOffer: false, isOfferPaused: false, pausedDiscount: null } : p));
        } catch (error) {
            console.error("Error removing offer:", error);
        }
    };

    const toggleProductSelection = (id) => {
        if (selectedProducts.includes(id)) {
            setSelectedProducts(selectedProducts.filter(pid => pid !== id));
        } else {
            setSelectedProducts([...selectedProducts, id]);
        }
    };

    // Bulk Selection State
    const [selectedOfferIds, setSelectedOfferIds] = useState([]);

    const toggleOfferSelection = (id) => {
        if (selectedOfferIds.includes(id)) {
            setSelectedOfferIds(selectedOfferIds.filter(pid => pid !== id));
        } else {
            setSelectedOfferIds([...selectedOfferIds, id]);
        }
    };

    const selectAllOffers = () => {
        if (selectedOfferIds.length === filteredOffers.length) {
            setSelectedOfferIds([]);
        } else {
            setSelectedOfferIds(filteredOffers.map(p => p.id));
        }
    };

    const bulkRemoveOffers = async () => {
        if (!window.confirm(txt.alert_confirm_bulk)) return;

        try {
            const updates = selectedOfferIds.map(id =>
                updateDoc(doc(db, "products", id), {
                    discount: 0,
                    priceAfterDiscount: null,
                    offerEndDate: null,
                    offerEndTime: null,
                    hasOffer: false
                })
            );
            await Promise.all(updates);
            setProducts(products.map(p => selectedOfferIds.includes(p.id) ? { 
                ...p, 
                discount: 0, 
                priceAfterDiscount: null, 
                hasOffer: false,
                offerEndDate: null,
                offerEndTime: null,
                isOfferPaused: false,
                pausedDiscount: null,
                pausedPriceAfterDiscount: null
            } : p));
            setSelectedOfferIds([]);
            alert(txt.alert_success_bulk);
        } catch (error) {
            console.error("Error removing offers:", error);
            alert(txt.alert_error);
        }
    };

    const bulkTogglePauseOffers = async (isPausing) => {
        if (!window.confirm(txt.alert_confirm_pause)) return;

        try {
            const updates = selectedOfferIds.map(id => {
                const product = products.find(p => p.id === id);
                if (!product) return null;
                const price = parsePrice(product.price);

                if (isPausing) {
                    const currentDiscount = Number(product.discount || product.pausedDiscount || 10);
                    const currentPriceAfter = product.priceAfterDiscount || (price > 0 ? Math.max(0, price - (price * (currentDiscount / 100))) : null);

                    return updateDoc(doc(db, "products", id), {
                        pausedDiscount: currentDiscount,
                        pausedPriceAfterDiscount: currentPriceAfter,
                        pausedOfferEndDate: product.offerEndDate || null,
                        pausedOfferEndTime: product.offerEndTime || null,
                        pausedOfferTimezone: product.offerTimezone || null,
                        discount: 0,
                        priceAfterDiscount: null,
                        hasOffer: false,
                        isOfferPaused: true
                    });
                } else {
                    const restoredDiscount = Number(product.pausedDiscount || product.discount || 10);
                    const restoredPriceAfter = product.pausedPriceAfterDiscount || (price > 0 ? Math.max(0, price - (price * (restoredDiscount / 100))) : null);

                    return updateDoc(doc(db, "products", id), {
                        discount: restoredDiscount,
                        priceAfterDiscount: restoredPriceAfter,
                        offerEndDate: product.pausedOfferEndDate || product.offerEndDate || null,
                        offerEndTime: product.pausedOfferEndTime || product.offerEndTime || null,
                        offerTimezone: product.pausedOfferTimezone || product.offerTimezone || null,
                        pausedDiscount: null,
                        pausedPriceAfterDiscount: null,
                        pausedOfferEndDate: null,
                        pausedOfferEndTime: null,
                        pausedOfferTimezone: null,
                        hasOffer: true,
                        isOfferPaused: false
                    });
                }
            }).filter(Boolean);

            await Promise.all(updates);

            setProducts(products.map(p => {
                if (selectedOfferIds.includes(p.id)) {
                    const price = parsePrice(p.price);
                    if (isPausing) {
                        const currentDiscount = Number(p.discount || p.pausedDiscount || 10);
                        const currentPriceAfter = p.priceAfterDiscount || (price > 0 ? Math.max(0, price - (price * (currentDiscount / 100))) : null);
                        return {
                            ...p,
                            pausedDiscount: currentDiscount,
                            pausedPriceAfterDiscount: currentPriceAfter,
                            pausedOfferEndDate: p.offerEndDate || null,
                            pausedOfferEndTime: p.offerEndTime || null,
                            pausedOfferTimezone: p.offerTimezone || null,
                            discount: 0,
                            priceAfterDiscount: null,
                            hasOffer: false,
                            isOfferPaused: true
                        };
                    } else {
                        const restoredDiscount = Number(p.pausedDiscount || p.discount || 10);
                        const restoredPriceAfter = p.pausedPriceAfterDiscount || (price > 0 ? Math.max(0, price - (price * (restoredDiscount / 100))) : null);
                        return {
                            ...p,
                            discount: restoredDiscount,
                            priceAfterDiscount: restoredPriceAfter,
                            offerEndDate: p.pausedOfferEndDate || p.offerEndDate || null,
                            offerEndTime: p.pausedOfferEndTime || p.offerEndTime || null,
                            offerTimezone: p.pausedOfferTimezone || p.offerTimezone || null,
                            pausedDiscount: null,
                            pausedPriceAfterDiscount: null,
                            pausedOfferEndDate: null,
                            pausedOfferEndTime: null,
                            pausedOfferTimezone: null,
                            hasOffer: true,
                            isOfferPaused: false
                        };
                    }
                }
                return p;
            }));

            setSelectedOfferIds([]);
            alert(txt.alert_success_pause);
        } catch (error) {
            console.error("Error toggling offers:", error);
            alert(txt.alert_error);
        }
    };
    // Reorder Logic
    useEffect(() => {
        if (view === 'sort-offers') {
            setSortedOffers([...offers].sort((a, b) => {
                const orderA = (a.offerOrder !== undefined && a.offerOrder !== null && !isNaN(a.offerOrder))
                    ? Number(a.offerOrder)
                    : ((a.order !== undefined && a.order !== null && !isNaN(a.order)) ? Number(a.order) : 999999);
                const orderB = (b.offerOrder !== undefined && b.offerOrder !== null && !isNaN(b.offerOrder))
                    ? Number(b.offerOrder)
                    : ((b.order !== undefined && b.order !== null && !isNaN(b.order)) ? Number(b.order) : 999999);
                return orderA - orderB;
            }));
        }
    }, [view, products]);

    const saveOffersOrder = async () => {
        setIsSavingOrder(true);
        try {
            const updates = sortedOffers.map((offer, index) => {
                return updateDoc(doc(db, "products", offer.id), {
                    offerOrder: index + 1,
                    order: index + 1
                });
            });
            await Promise.all(updates);

            setProducts(prev => prev.map(p => {
                const index = sortedOffers.findIndex(so => so.id === p.id);
                if (index !== -1) {
                    return { ...p, offerOrder: index + 1, order: index + 1 };
                }
                return p;
            }));

            alert(txt.alert_success);
            setView('list');
        } catch (error) {
            console.error("Error saving order:", error);
            alert(txt.alert_error);
        } finally {
            setIsSavingOrder(false);
        }
    };

    if (view === 'sort-offers') {
        const currency = getLocalizedCurrency(generalSettings?.currency, lang);
        return (
            <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setView('list')}
                            className="w-10 h-10 bg-gray-100 rounded-[14px] flex items-center justify-center text-gray-600 hover:bg-gray-200 transition shrink-0"
                        >
                            <ChevronRight size={20} className={isRTL ? "" : "rotate-180"} />
                        </button>
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-gray-800 leading-tight">{txt.sort_offers}</h2>
                            <p className="text-[11px] text-gray-400 font-bold">{txt.sort_offers_desc}</p>
                        </div>
                    </div>
                    <button
                        onClick={saveOffersOrder}
                        disabled={isSavingOrder}
                        className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base whitespace-nowrap"
                    >
                        {isSavingOrder ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={20} />
                        )}
                        <span>{txt.save_order}</span>
                    </button>
                </div>

                <div className="space-y-3 pb-20">
                    <div className="bg-blue-600 text-white p-4 rounded-t-2xl font-black text-center flex items-center justify-center gap-2">
                        <Tag size={20} />
                        {editingId ? txt.edit_offer_title : txt.add_offer_title}
                    </div>

                    <Reorder.Group axis="y" values={sortedOffers} onReorder={setSortedOffers} className="space-y-3">
                        {sortedOffers.map((offer, index) => (
                            <Reorder.Item key={offer.id} value={offer}>
                                <div className="bg-white border border-rose-100 border-b-4 border-b-rose-500 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing z-10 relative">
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col gap-1 text-rose-500 opacity-50">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                            </div>
                                        </div>
                                        <span className="text-gray-400 font-mono font-bold text-lg w-8">{index + 1}</span>
                                        <div className={isRTL ? "text-right" : "text-left"}>
                                            <h3 className="font-bold text-gray-700 text-base select-none line-clamp-1">{offer.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-400 line-through">{Number(offer.price).toLocaleString()}</span>
                                                <span className="text-sm font-black text-rose-500">{Number(offer.priceAfterDiscount).toLocaleString()} {currency}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {offer.mainImage ? (
                                        <img src={offer.mainImage} className="w-12 h-12 rounded-lg object-cover border border-gray-100 pointer-events-none" alt="" />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400"><Package size={20} /></div>
                                    )}
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                <h2 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-2">
                    <Tag className="text-blue-500" />
                    {txt.title}
                </h2>
                <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    {!isAdding ? (
                        <>
                            <button
                                onClick={() => setView('sort-offers')}
                                className="px-3 sm:px-6 py-3 bg-white text-blue-600 border border-blue-100 rounded-xl font-bold shadow-sm hover:bg-blue-50 transition flex items-center justify-center gap-1.5 sm:gap-2"
                            >
                                <BarChart3 size={18} className="rotate-90" />
                                <span className="whitespace-nowrap text-[13px] sm:text-base">{txt.sort_offers}</span>
                            </button>
                            <button
                                onClick={() => setIsAdding(true)}
                                className="px-3 sm:px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition flex items-center justify-center gap-1.5 sm:gap-2"
                            >
                                <Plus size={18} />
                                <span className="whitespace-nowrap text-[13px] sm:text-base">{txt.add_offer}</span>
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsAdding(false)}
                            className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2"
                        >
                            <span className="text-[13px] sm:text-base">{txt.cancel}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Add Offer Form (Full View) */}
            <AnimatePresence>
                {isAdding ? (
                    <motion.div
                        initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl overflow-hidden"
                    >
                        <h3 className={`text-xl font-black mb-8 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.add_offer}</h3>

                        <div className="space-y-8">
                            <div className="space-y-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                                <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                                    <div className="w-full md:w-1/2">
                                        <label className="block text-sm font-black text-gray-700 mb-2">
                                            {lang === 'ar' ? 'مبلغ الخصم' : 'Discount Amount'}
                                            {!applyToAll && selectedProducts.length === 0 && (
                                                <span className="text-xs text-red-500 font-bold mx-2">
                                                    {lang === 'ar' ? '(يرجى تحديد المنتج أولاً من الأسفل)' : '(Select product first below)'}
                                                </span>
                                            )}
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="discountAmountInput"
                                                type="number"
                                                min="0"
                                                value={discountAmountInput}
                                                onChange={(e) => {
                                                    setDiscountAmountInput(e.target.value);
                                                    setLastInteracted('amount');
                                                }}
                                                disabled={!applyToAll && selectedProducts.length === 0}
                                                placeholder={!applyToAll && selectedProducts.length === 0 ? (lang === 'ar' ? 'اختر منتج من الأسفل' : 'Select product') : '0'}
                                                className="w-full h-[52px] px-4 bg-white border-2 border-gray-200 rounded-2xl text-lg font-black text-blue-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all disabled:opacity-50 disabled:bg-gray-100"
                                            />
                                            <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg`}>
                                                {txt.currency}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full md:w-1/2 flex md:justify-end items-center">
                                        <div className={`text-center ${isRTL ? 'md:border-r' : 'md:border-l'} border-gray-200 md:px-8`}>
                                            <span className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">{lang === 'ar' ? 'النسبة المئوية' : 'PERCENTAGE'}</span>
                                            <span className="text-4xl text-blue-600 font-black">{discountPercent}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-2">
                                    <input
                                        id="discountPercentSlider"
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={discountPercent}
                                        onChange={(e) => {
                                            setDiscountPercent(parseInt(e.target.value));
                                            setLastInteracted('percent');
                                        }}
                                        className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Time Limit Toggle */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="font-bold text-gray-700">{txt.time_limited}</label>
                                        <div
                                            onClick={() => setIsTimeLimited(!isTimeLimited)}
                                            className={`w-14 h-7 rounded-full p-1 cursor-pointer transition-colors ${isTimeLimited ? 'bg-pink-500' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isTimeLimited ? (isRTL ? '-translate-x-7' : 'translate-x-7') : 'translate-x-0'}`} />
                                        </div>
                                    </div>

                                    {isTimeLimited && (
                                        <div className="grid grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 mb-1">{txt.timezone}</label>
                                                <select className="w-full h-[46px] px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 appearance-none">
                                                    <option value="Asia/Aden">Aden (Yemen)</option>
                                                    <option value="Asia/Riyadh">Riyadh (KSA)</option>
                                                    <option value="Asia/Dubai">Dubai (UAE)</option>
                                                    <option value="Africa/Cairo">Cairo (Egypt)</option>
                                                    <option value="Asia/Amman">Amman (Jordan)</option>
                                                    <option value="Asia/Baghdad">Baghdad (Iraq)</option>
                                                    <option value="Asia/Kuwait">Kuwait</option>
                                                    <option value="Asia/Qatar">Qatar</option>
                                                    <option value="Asia/Muscat">Muscat (Oman)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 mb-1">{txt.end_date}</label>
                                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-[46px] px-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm text-gray-900" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 mb-1">{txt.end_time}</label>
                                                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full h-[46px] px-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm text-gray-900" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 mb-1">{txt.estimated_duration}</label>
                                                <div className="w-full h-[46px] px-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm text-gray-900 flex items-center justify-center whitespace-nowrap overflow-hidden" dir="ltr">
                                                    {(() => {
                                                        if (!endDate) return "0d 0h 0m";
                                                        const start = new Date();
                                                        const end = new Date(`${endDate}T${endTime || '00:00'}`);
                                                        const diff = end - start;
                                                        if (diff <= 0) return txt.val_expired;

                                                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                                                        return `${days}d ${hours}h ${minutes}m`;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Target Products Toggle */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="font-bold text-gray-700">{txt.apply_all}</label>
                                        <div
                                            onClick={() => setApplyToAll(!applyToAll)}
                                            className={`w-14 h-7 rounded-full p-1 cursor-pointer transition-colors ${applyToAll ? 'bg-blue-500' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${applyToAll ? (isRTL ? '-translate-x-7' : 'translate-x-7') : 'translate-x-0'}`} />
                                        </div>
                                    </div>

                                    {applyToAll ? (
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-center gap-2 text-blue-600 font-bold animate-in fade-in slide-in-from-top-2">
                                            <Check size={20} />
                                            <span>{txt.apply_all_desc} ({products.length} {txt.val_product})</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-xs font-bold text-gray-400">{txt.select_products}</label>
                                            <input
                                                type="text"
                                                placeholder={txt.search_product}
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900"
                                            />
                                            <div className="h-40 overflow-y-auto border border-gray-100 rounded-xl p-2 space-y-1 scrollbar-thin">
                                                {products.filter(p => p.name.includes(searchQuery)).map(p => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => toggleProductSelection(p.id)}
                                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedProducts.includes(p.id) ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-900'}`}
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedProducts.includes(p.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                                            {selectedProducts.includes(p.id) && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <span className="text-sm font-bold truncate">{p.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleSaveOffer}
                                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
                                >
                                    {txt.save_offer}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    /* Offers List */
                    <motion.div
                        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                        className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]"
                    >
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="w-96 relative">
                                <input
                                    type="text"
                                    placeholder={txt.search_placeholder}
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-full text-sm font-bold focus:border-blue-500 outline-none"
                                />
                            </div>
                            {selectedOfferIds.length > 0 && (
                                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
                                    <button
                                        onClick={() => bulkTogglePauseOffers(true)}
                                        className="px-4 py-2 bg-orange-100 text-orange-600 border border-orange-200 rounded-xl font-black hover:bg-orange-200 transition flex items-center gap-2 shadow-sm"
                                    >
                                        <Clock size={18} />
                                        <span>{txt.pause_selected} {selectedOfferIds.length} {txt.val_product}</span>
                                    </button>
                                    <button
                                        onClick={() => bulkTogglePauseOffers(false)}
                                        className="px-4 py-2 bg-green-100 text-green-700 border border-green-200 rounded-xl font-black hover:bg-green-200 transition flex items-center gap-2 shadow-sm"
                                    >
                                        <RotateCcw size={18} />
                                        <span>{txt.resume_selected} {selectedOfferIds.length} {txt.val_product}</span>
                                    </button>
                                    <button
                                        onClick={bulkRemoveOffers}
                                        className="px-4 py-2 bg-red-100 text-red-600 border border-red-200 rounded-xl font-black hover:bg-red-200 transition flex items-center gap-2 shadow-sm"
                                    >
                                        <Trash2 size={18} />
                                        <span>{txt.delete_selected_count} {selectedOfferIds.length} {txt.val_product}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                                <thead>
                                    <tr className="text-gray-500 text-sm font-bold border-b border-gray-100">
                                        <th className="px-2 py-4 w-12 whitespace-nowrap"> {/* Checkbox Column */}
                                            <div
                                                onClick={selectAllOffers}
                                                className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center ${selectedOfferIds.length === filteredOffers.length && filteredOffers.length > 0 ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}
                                            >
                                                {selectedOfferIds.length === filteredOffers.length && filteredOffers.length > 0 && <Check size={14} className="text-white" />}
                                            </div>
                                        </th>
                                        <th className="px-2 py-4 whitespace-nowrap text-xs">{txt.th_countdown}</th>
                                        <th className="px-4 py-4 whitespace-nowrap text-xs">{txt.th_product}</th>
                                        <th className="px-2 py-4 whitespace-nowrap text-xs">{txt.th_expiry}</th>
                                        <th className="px-2 py-4 whitespace-nowrap text-xs">{txt.th_timezone}</th>
                                        <th className="px-2 py-4 text-center whitespace-nowrap text-xs">{txt.th_discount}</th>
                                        <th className="px-2 py-4 text-center whitespace-nowrap text-xs">{txt.th_original_price}</th>
                                        <th className="px-2 py-4 text-center whitespace-nowrap text-xs">{txt.th_price_after}</th>
                                        <th className="px-2 py-4 text-center whitespace-nowrap text-xs">{txt.th_actions}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredOffers.map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50 transition-colors group text-sm">
                                            <td className="px-2 py-4">
                                                <div
                                                    onClick={() => toggleOfferSelection(product.id)}
                                                    className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center ${selectedOfferIds.includes(product.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}
                                                >
                                                    {selectedOfferIds.includes(product.id) && <Check size={14} className="text-white" />}
                                                </div>
                                            </td>
                                            <td className="px-2 py-4 whitespace-nowrap">
                                                {(() => {
                                                    const remaining = getRemainingTime(product.offerEndDate || product.pausedOfferEndDate, product.offerEndTime || product.pausedOfferEndTime);
                                                    const isPaused = product.isOfferPaused;
                                                    
                                                    if (isPaused) {
                                                        return (
                                                            <div className="px-3 py-1.5 rounded-xl bg-orange-100 text-orange-600 text-center font-black text-[10px] flex items-center justify-center gap-1">
                                                                <Clock size={12} />
                                                                {txt.val_paused}
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    if (!remaining) {
                                                        return (
                                                            <div className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-center font-bold text-[10px]">
                                                                {txt.val_unlimited}
                                                            </div>
                                                        );
                                                    }

                                                    const isExpired = remaining === "EXPIRED";
                                                    return (
                                                        <div className={`px-3 py-1.5 rounded-xl text-center font-black text-[10px] flex items-center justify-center gap-1 ${isExpired ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            {!isExpired && <Clock size={12} className="animate-pulse" />}
                                                            {isExpired ? txt.val_expired : remaining}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-start">
                                                <div className="font-black text-gray-800 text-[13px]">{product.name}</div>
                                                <div className="text-[10px] text-gray-400 font-bold mt-1">CODE: {product.code || product.id.slice(0, 6)}</div>
                                            </td>
                                            <td className="px-2 py-4 text-gray-600 font-bold text-[11px] whitespace-nowrap">
                                                {(product.offerEndDate || product.pausedOfferEndDate) || txt.val_unlimited}
                                            </td>
                                            <td className="px-2 py-4 text-gray-400 font-bold text-[11px] whitespace-nowrap">
                                                {(product.offerEndDate || product.pausedOfferEndDate) ? (product.offerTimezone || product.pausedOfferTimezone || "Asia/Dubai") : txt.val_unlimited}
                                            </td>
                                            <td className="px-2 py-4 text-center font-black text-sm text-gray-800">
                                                {editingId === product.id ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input
                                                            type="number"
                                                            className="w-14 p-1 border rounded text-center text-xs"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <span>%</span>
                                                    </div>
                                                ) : (
                                                    <span>{product.discount || product.pausedDiscount || 0}%</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-4 text-center">
                                                <div className="bg-red-50 text-red-500 px-2 py-1.5 rounded-full font-bold text-[10px] line-through inline-flex items-center justify-center gap-1 whitespace-nowrap">
                                                    <span>{Number(product.price).toLocaleString()}</span>
                                                    <span className="text-[9px] text-red-600 font-bold">{currency}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-4 text-center">
                                                <div className="bg-green-50 text-green-600 px-2 py-1.5 rounded-full font-bold text-[10px] inline-flex items-center justify-center gap-1 whitespace-nowrap">
                                                    <span>{(editingId === product.id
                                                        ? (product.price - (product.price * editValue / 100))
                                                        : (product.isOfferPaused ? product.pausedPriceAfterDiscount : product.priceAfterDiscount)
                                                    )?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                                    <span className="text-[9px] text-green-700 font-bold">{currency}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {editingId === product.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => saveEditing(product.id, product.price)}
                                                                className="p-1.5 bg-green-50 rounded text-green-600 hover:bg-green-100 transition-all"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="p-1.5 bg-gray-50 rounded text-gray-500 hover:bg-gray-100 transition-all"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => toggleSingleOfferStatus(product, !product.isOfferPaused)}
                                                                className={`p-2 rounded-lg transition-all shadow-sm ${product.isOfferPaused ? 'bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white' : 'bg-green-50 text-green-500 hover:bg-green-500 hover:text-white'}`}
                                                                title={product.isOfferPaused ? txt.resume_selected : txt.pause_selected}
                                                            >
                                                                {product.isOfferPaused ? <RotateCcw size={16} /> : <Clock size={16} />}
                                                            </button>
                                                            <button
                                                                onClick={() => startEditing(product)}
                                                                className="p-2 bg-blue-50 rounded-lg text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => removeOffer(product.id)}
                                                                className="p-2 bg-red-50 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredOffers.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="p-12 text-center text-gray-400 font-bold text-lg">
                                                {txt.no_offers}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};


export default LimitedOffersView;
