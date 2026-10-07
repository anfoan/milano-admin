import React, { useState, useEffect } from 'react';
import {
    Search, Plus, MoreVertical, Edit2, Trash2,
    Share2, Eye, EyeOff, ChevronRight, Package,
    Settings, BarChart3, Image as ImageIcon, Percent,
    ExternalLink, ArrowUp, ArrowDown, Save
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { uploadToCloudinary } from '../../services/uploadService';
import { getLocalizedCurrency } from '../../lib/currencyUtils';
import VideoShowcaseManager from './VideoShowcaseManager';

const readProductsCache = (key) => {
    try {
        const cached = localStorage.getItem(key);
        return cached ? JSON.parse(cached) : [];
    } catch {
        return [];
    }
};

const ProductsView = ({ onEdit, lang = 'ar', generalSettings, searchQuery, setSearchQuery }) => {
    const t = {
        ar: {
            search_cat_placeholder: 'بحث عن قسم...',
            sort_categories: 'ترتيب الأقسام',
            add_category: 'إضافة قسم',
            new_cat_placeholder: 'اسم القسم الجديد...',
            update: 'تحديث',
            save: 'حفظ',
            cancel: 'إلغاء',
            products_count: 'منتج',
            sort_cat_title: 'ترتيب الأقسام',
            sort_cat_desc: 'تحكم في ترتيب ظهور الأقسام في المتجر',
            save_order: 'حفظ الترتيب',
            categories_header: 'الأقسام',
            sort_prod_title: 'فرز المنتجات',
            sort_prod_desc: 'قائمة المنتجات - ',
            products_header: 'المنتجات',
            back_to_cats: 'العودة للأقسام',
            search_prod_placeholder: 'ابحث عن اسم المنتج / رمز المنتج',
            search_btn: 'بحث',
            sort_prod_btn: 'فرز المنتجات',
            edit_product: 'تعديل المنتج',
            no_products: 'لا توجد منتجات في هذا القسم حالياً',
            alert_del_cat: 'هل أنت متأكد من حذف قسم "{name}"؟ سيتم حذف جميع المنتجات التابعة لهذا القسم أيضاً!',
            alert_del_cat_success: 'تم حذف القسم "{name}" وجميع المنتجات المرتبطة به بنجاح!',
            alert_del_error: 'حدث خطأ أثناء حذف القسم والمنتجات',
            alert_del_prod: 'هل أنت متأكد من حذف هذا المنتج؟',
            alert_del_prod_success: 'تم حذف المنتج بنجاح',
            alert_del_prod_error: 'حدث خطأ أثناء محاولة الحذف: ',
            alert_copy_link: 'تم نسخ رابط المنتج لمشاركته!',
            alert_upload_fail: 'فشل رفع الصورة',
            alert_update_cat_success: 'تم تحديث اسم القسم وجميع المنتجات المرتبطة به بنجاح!',
            alert_add_cat_success: 'تم إضافة القسم بنجاح!',
            alert_save_error: 'حدث خطأ أثناء الحفظ',
            alert_update_img_success: 'تم تحديث صورة القسم بنجاح!',
            alert_save_order_success: 'تم حفظ ترتيب الأقسام بنجاح!',
            alert_save_order_error: 'حدث خطأ أثناء حفظ الترتيب',
            alert_save_prod_order_success: 'تم حفظ ترتيب المنتجات بنجاح!',
            code_label: 'رمز المنتج',
            stock_label: 'مخزون:',
            options: 'خيارات',
            discount: 'خصم',
            images: 'صور',
            currency: 'ريال يمني',
            alert_id_missing: 'خطأ: معرف المنتج غير موجود',
            order: 'الترتيب'
        },
        en: {
            search_cat_placeholder: 'Search for category...',
            sort_categories: 'Sort Categories',
            add_category: 'Add Category',
            new_cat_placeholder: 'New category name...',
            update: 'Update',
            save: 'Save',
            cancel: 'Cancel',
            products_count: 'products',
            sort_cat_title: 'Sort Categories',
            sort_cat_desc: 'Control the order of categories in the store',
            save_order: 'Save Order',
            categories_header: 'Categories',
            sort_prod_title: 'Sort Products',
            sort_prod_desc: 'Product List - ',
            products_header: 'Products',
            back_to_cats: 'Back to Categories',
            search_prod_placeholder: 'Search product name / SKU',
            search_btn: 'Search',
            sort_prod_btn: 'Sort Products',
            edit_product: 'Edit Product',
            no_products: 'No products in this category currently',
            alert_del_cat: 'Are you sure you want to delete category "{name}"? All products in this category will also be deleted!',
            alert_del_cat_success: 'Category "{name}" and all associated products deleted successfully!',
            alert_del_error: 'Error deleting category and products',
            alert_del_prod: 'Are you sure you want to delete this product?',
            alert_del_prod_success: 'Product deleted successfully',
            alert_del_prod_error: 'Error attempting to delete: ',
            alert_copy_link: 'Product link copied to share!',
            alert_upload_fail: 'Image upload failed',
            alert_update_cat_success: 'Category name and all associated products updated successfully!',
            alert_add_cat_success: 'Category added successfully!',
            alert_save_error: 'Error saving',
            alert_update_img_success: 'Category image updated successfully!',
            alert_save_order_success: 'Category order saved successfully!',
            alert_save_order_error: 'Error saving category order',
            alert_save_prod_order_success: 'Product order saved successfully!',
            code_label: 'SKU',
            stock_label: 'Stock:',
            options: 'Options',
            discount: 'Discount',
            images: 'Images',
            currency: 'YER',
            alert_id_missing: 'Error: Product ID missing',
            order: 'Order'
        }
    };
    const txt = t[lang];
    const isRTL = lang === 'ar';
    const currency = getLocalizedCurrency(generalSettings?.currency || 'YER', lang);
    const [view, setView] = useState('categories'); // 'categories' or 'product-list'
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [products, setProducts] = useState(() => readProductsCache('milano_admin_products_cache'));
    const [loading, setLoading] = useState(() => readProductsCache('milano_admin_categories_cache').length === 0);
    // searchQuery state is now handled via props from AdminDashboard
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState(null);
    const fileInputRef = React.useRef(null);
    const [uploading, setUploading] = useState(false);
    const [sortOrder, setSortOrder] = useState('custom');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    const [categories, setCategories] = useState(() => readProductsCache('milano_admin_categories_cache'));

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const qProd = query(collection(db, "products"));
                const qCat = query(collection(db, "categories"));
                // Load both collections at the same time; render categories as soon
                // as their request completes instead of waiting for products first.
                const productsPromise = getDocs(qProd).then(prodSnapshot => {
                    const items = prodSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setProducts(items);
                    localStorage.setItem('milano_admin_products_cache', JSON.stringify(items));
                });
                const categoriesPromise = getDocs(qCat).then(catSnapshot => {
                    const fetchedCats = catSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, image: doc.data().image, order: doc.data().order }));
                    setCategories(fetchedCats);
                    localStorage.setItem('milano_admin_categories_cache', JSON.stringify(fetchedCats));
                });
                await Promise.all([productsPromise, categoriesPromise]);
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const deleteCategory = async (e, catObj) => {
        e.stopPropagation();
        if (window.confirm(txt.alert_del_cat.replace('{name}', catObj.name))) {
            try {
                // Delete the category itself
                await deleteDoc(doc(db, "categories", catObj.id));

                // Find products belonging to this category and delete them
                const productsToDelete = products.filter(p => p.category === catObj.name);
                const deletePromises = productsToDelete.map(p => deleteDoc(doc(db, "products", p.id)));
                await Promise.all(deletePromises);

                // Update local states
                setCategories(categories.filter(c => c.id !== catObj.id));
                setProducts(products.filter(p => p.category !== catObj.name));

                alert(txt.alert_del_cat_success.replace('{name}', catObj.name));
            } catch (error) {
                console.error("Error deleting category and its products:", error);
                alert(txt.alert_del_error);
            }
        }
    };

    const toggleHideProduct = async (product) => {
        try {
            const docRef = doc(db, "products", product.id);
            await updateDoc(docRef, { hidden: !product.hidden });
            setProducts(products.map(p => p.id === product.id ? { ...p, hidden: !p.hidden } : p));
        } catch (err) {
            console.error("Error toggling product visibility:", err);
        }
    };

    const deleteProduct = async (id) => {
        console.log("Attempting to delete product with ID:", id);
        if (!id) {
            alert(txt.alert_id_missing);
            return;
        }
        if (!window.confirm(txt.alert_del_prod)) return;
        try {
            await deleteDoc(doc(db, "products", id));
            setProducts(products.filter(p => p.id !== id));
            alert(txt.alert_del_prod_success);
        } catch (err) {
            console.error("Error deleting product:", err);
            alert(txt.alert_del_prod_error + err.message);
        }
    };

    const shareProduct = (product) => {
        const storeUrl = generalSettings?.storeUrl || window.location.origin;
        const url = `${storeUrl}/product/${product.id}`;
        navigator.clipboard.writeText(url);
        alert(txt.alert_copy_link);
    };

    // Helper: Upload to Cloudinary (Reused logic)
    // Centralized upload service used instead of local function

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        setLoading(true);

        try {
            if (editingCategory) {
                // Update
                const catRef = doc(db, "categories", editingCategory.id);
                // 1. Update the category itself
                await updateDoc(catRef, { name: newCategoryName.trim(), updatedAt: new Date() });

                // 2. Cascading Update: Find all products with the OLD category name and update them
                const oldCategoryName = editingCategory.name;
                const productsToUpdate = products.filter(p => p.category === oldCategoryName);

                if (productsToUpdate.length > 0) {
                    const updatePromises = productsToUpdate.map(p => {
                        const productRef = doc(db, "products", p.id);
                        return updateDoc(productRef, { category: newCategoryName.trim() });
                    });

                    await Promise.all(updatePromises);
                    console.log(`Updated ${productsToUpdate.length} products to new category name.`);
                }

                // Update local state for Categories
                setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, name: newCategoryName.trim() } : c));

                // Update local state for Products (so UI reflects changes immediately)
                setProducts(products.map(p => p.category === oldCategoryName ? { ...p, category: newCategoryName.trim() } : p));

                alert(txt.alert_update_cat_success);
            } else {
                // Create
                const docRef = await addDoc(collection(db, "categories"), {
                    name: newCategoryName.trim(),
                    createdAt: new Date()
                });
                setCategories([{ id: docRef.id, name: newCategoryName.trim() }, ...categories]);
                alert(txt.alert_add_cat_success);
            }

            // Reset
            setNewCategoryName('');
            setEditingCategory(null);
            setIsAddingCategory(false);
        } catch (err) {
            console.error("Error saving category:", err);
            alert(txt.alert_save_error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (cat, e) => {
        e.stopPropagation();
        setEditingCategory(cat);
        setNewCategoryName(cat.name);
        setIsAddingCategory(true);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !editingCategory) return;

        setUploading(true);
        const imageUrl = await uploadToCloudinary(file);

        if (imageUrl) {
            try {
                const catRef = doc(db, "categories", editingCategory.id);
                await updateDoc(catRef, { image: imageUrl });

                setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, image: imageUrl } : c));
                alert(txt.alert_update_img_success);
            } catch (err) {
                console.error("Error updating category image:", err);
                alert(txt.alert_save_error);
            }
        }
        setUploading(false);
        setEditingCategory(null); // Clear selection after upload
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerImageUpload = (cat, e) => {
        e.stopPropagation();
        setEditingCategory(cat);
        setTimeout(() => fileInputRef.current.click(), 100);
    };

    const handleMoveProduct = (index, direction) => {
        // Redundant since we use specific sort view, but keeping for reference if needed
    };

    // --- SORT CATEGORIES LOGIC ---
    const [sortedCategories, setSortedCategories] = useState([]);

    useEffect(() => {
        if (view === 'sort-categories') {
            // Sort by order field or fallback to created order (logic handled in sort view)
            setSortedCategories([...categories].sort((a, b) => (a.order || 9999) - (b.order || 9999)));
        }
    }, [view, categories]);

    const moveCategory = (index, direction) => {
        const newItems = [...sortedCategories];
        if (direction === 'up' && index > 0) {
            [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
        } else if (direction === 'down' && index < newItems.length - 1) {
            [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
        }
        setSortedCategories(newItems);
    };

    const saveCategoryOrder = async () => {
        setLoading(true);
        try {
            const updatePromises = sortedCategories.map((cat, index) => {
                const catRef = doc(db, "categories", cat.id);
                return updateDoc(catRef, { order: index + 1 });
            });
            await Promise.all(updatePromises);

            // Update local state
            const updatedCats = categories.map(c => {
                const sortedItem = sortedCategories.find(sc => sc.id === c.id);
                // Assign new order
                return sortedItem ? { ...c, order: sortedCategories.indexOf(sortedItem) + 1 } : c;
            });
            setCategories(updatedCats);

            alert(txt.alert_save_order_success);
            setView('categories');
        } catch (error) {
            console.error("Error saving category order:", error);
            alert(txt.alert_save_order_error);
        } finally {
            setLoading(false);
        }
    };
    // ----------------------------

    // Sort Products View Logic
    const [sortedProducts, setSortedProducts] = useState([]);

    // Initialize sorted products when entering sort view
    useEffect(() => {
        if (view === 'sort-products' && selectedCategory) {
            const filtered = products
                .filter(p => p.category === selectedCategory)
                .sort((a, b) => (a.order || 9999) - (b.order || 9999));
            setSortedProducts(filtered);
        }
    }, [view, selectedCategory, products]);

    useEffect(() => {
        setProductSearch('');
    }, [selectedCategory]);

    const moveProduct = (index, direction) => {
        const newItems = [...sortedProducts];
        if (direction === 'up' && index > 0) {
            [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
        } else if (direction === 'down' && index < newItems.length - 1) {
            [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
        }
        setSortedProducts(newItems);
    };

    const saveProductOrder = async () => {
        setLoading(true);
        try {
            const updatePromises = sortedProducts.map((product, index) => {
                const productRef = doc(db, "products", product.id);
                return updateDoc(productRef, { order: index + 1 });
            });
            await Promise.all(updatePromises);

            // Update local state
            const updatedAllProducts = products.map(p => {
                const sortedItem = sortedProducts.find(sp => sp.id === p.id);
                return sortedItem ? { ...p, order: sortedProducts.indexOf(sortedItem) + 1 } : p;
            });
            setProducts(updatedAllProducts);

            alert(txt.alert_save_prod_order_success);
            setView('product-list');
        } catch (error) {
            console.error("Error saving order:", error);
            alert(txt.alert_save_order_error);
        } finally {
            setLoading(false);
        }
    };

    // Category List View (Matching Image 0)
    if (loading && products.length === 0 && categories.length === 0) {
        return (
            <div className="min-h-[320px] rounded-[22px] border border-gray-100 bg-white dark:border-white/10 dark:bg-[#15171b] flex flex-col items-center justify-center gap-3 font-['Cairo']" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="h-9 w-9 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                <span className="text-sm font-black text-gray-400">{lang === 'ar' ? 'جاري تحميل قائمة المنتجات...' : 'Loading product list...'}</span>
            </div>
        );
    }

    if (view === 'videos') {
        return <VideoShowcaseManager lang={lang} onBack={() => setView('categories')} />;
    }

    if (view === 'categories') {
        return (
            <div className="space-y-4 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
                <button onClick={() => setView('videos')} className="w-full rounded-[22px] border border-purple-200 bg-gradient-to-l from-purple-700 to-indigo-600 text-white p-4 md:p-5 flex items-center justify-between gap-4 shadow-lg shadow-purple-200/40 hover:scale-[1.005] transition-transform">
                    <span className="flex items-center gap-3 text-right"><span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-xl">🎬</span><span><strong className="block text-base md:text-lg font-black">إضافة فيديوهات متحركة</strong><small className="block text-purple-100 font-bold mt-1">أضف ريلز إعلانية صامتة تظهر أسفل أقسام المتجر</small></span></span>
                    <ChevronRight size={22} className={isRTL ? 'rotate-180' : ''} />
                </button>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-3.5 text-gray-400`} size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full bg-white border border-gray-100 rounded-xl py-3.5 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} outline-none focus:border-blue-500 font-bold text-gray-900 shadow-sm`}
                            placeholder={txt.search_cat_placeholder}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setView('sort-categories')}
                            className="px-6 py-3.5 bg-white text-blue-500 border border-blue-100 rounded-xl font-black shadow-sm hover:bg-blue-50 transition flex items-center gap-2 justify-center whitespace-nowrap"
                        >
                            <BarChart3 size={20} className="rotate-90" />
                            {txt.sort_categories}
                        </button>
                        <button
                            onClick={() => setIsAddingCategory(true)}
                            className="px-6 py-3.5 bg-blue-500 text-white rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-600 transition flex items-center gap-2 justify-center whitespace-nowrap"
                        >
                            <Plus size={20} /> {txt.add_category}
                        </button>
                    </div>
                </div>

                {isAddingCategory && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row gap-3 mb-6"
                    >
                        <input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder={txt.new_cat_placeholder}
                            className={`flex-1 px-4 py-2.5 rounded-xl border border-blue-200 outline-none font-bold text-gray-900 focus:border-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                            autoFocus
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveCategory()}
                        />
                        <div className="flex gap-2">
                            <button onClick={handleSaveCategory} className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-500 text-white rounded-xl font-black">{editingCategory ? txt.update : txt.save}</button>
                            <button onClick={() => { setIsAddingCategory(false); setEditingCategory(null); setNewCategoryName(''); }} className="flex-1 sm:flex-none px-6 py-2.5 bg-white text-gray-400 rounded-xl font-black border border-gray-200">{txt.cancel}</button>
                        </div>
                    </motion.div>
                )}

                {/* Hidden File Input for Category Image */}
                <input type="file" hidden ref={fileInputRef} onChange={handleImageUpload} accept="image/*" />

                <div className="space-y-3">
                    {categories
                        .filter(c => c.name && c.name.includes(searchQuery))
                        .sort((a, b) => {
                            if (sortOrder === 'newest') return -1;
                            if (sortOrder === 'oldest') return 1;
                            return (a.order || 9999) - (b.order || 9999);
                        })
                        .map((cat, idx) => {
                            const count = products.filter(p => p.category === cat.name).length;
                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => { setSelectedCategory(cat.name); setView('product-list'); }}
                                    className="bg-white p-4 md:p-6 rounded-[24px] border border-gray-100 shadow-sm flex items-center justify-between hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    {/* Background Image Overlay */}
                                    {cat.image && (
                                        <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                                            <img src={cat.image} className="w-full h-full object-cover" alt={cat.name} />
                                            <div className="absolute inset-0 bg-gradient-to-l from-white via-white/80 to-transparent" />
                                        </div>
                                    )}

                                    {/* Content (Image + Text) - NOW FIRST */}
                                    <div className="flex items-center gap-6 relative z-10">
                                        <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner group-hover:scale-110 transition-transform bg-white/80 backdrop-blur-sm">
                                            {cat.image ? (
                                                <img src={cat.image} className="w-full h-full object-cover rounded-2xl" alt="" />
                                            ) : (
                                                <Package size={24} className="md:w-8 md:h-8" />
                                            )}
                                        </div>
                                        <div className={isRTL ? "text-right" : "text-left"}>
                                            <h3 className="font-black text-gray-800 text-base md:text-lg">{cat.name}</h3>
                                            <span className="text-xs font-bold text-gray-400">{products.filter(p => p.category === cat.name).length} {txt.products_count}</span>
                                        </div>
                                    </div>

                                    {/* Buttons - NOW LAST */}
                                    <div className="flex items-center gap-2 relative z-10">
                                        <button onClick={(e) => handleEditClick(cat, e)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors outline-none">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={(e) => triggerImageUpload(cat, e)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors outline-none">
                                            <ImageIcon size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); console.log("Category trash clicked:", cat.id); deleteCategory(e, cat); }}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors outline-none"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                </div>
            </div>
        );
    }

    // Sort Categories View
    if (view === 'sort-categories') {
        return (
            <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setView('categories')}
                            className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 transition"
                        >
                            <ChevronRight size={20} className={isRTL ? "" : "rotate-180"} />
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-gray-800">{txt.sort_cat_title}</h2>
                            <p className="text-xs text-gray-400 font-bold">{txt.sort_cat_desc}</p>
                        </div>
                    </div>
                    <button
                        onClick={saveCategoryOrder}
                        className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-600 transition flex items-center gap-2"
                    >
                        <Save size={18} /> {txt.save_order}
                    </button>
                </div>

                <div className="space-y-3 pb-20">
                    <div className="bg-blue-900 text-white p-4 rounded-t-2xl font-black text-center">
                        {txt.categories_header}
                    </div>

                    <Reorder.Group axis="y" values={sortedCategories} onReorder={setSortedCategories} className="space-y-3">
                        {sortedCategories.map((cat, index) => (
                            <Reorder.Item key={cat.id} value={cat}>
                                <div
                                    className="bg-white border border-blue-500/30 border-b-4 border-b-blue-500 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing z-10 relative"
                                    onClick={(e) => e.stopPropagation()} // Prevent accidental clicks while dragging
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col gap-1 text-blue-500 opacity-50">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                            </div>
                                        </div>
                                        <span className="text-gray-400 font-mono font-bold text-lg w-8">{index + 1}</span>
                                        <h3 className="font-bold text-gray-700 text-lg select-none">{cat.name}</h3>
                                    </div>

                                    {cat.image ? (
                                        <img src={cat.image} className="w-16 h-16 rounded-lg object-cover border border-gray-100 pointer-events-none" alt={cat.name} />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400"><Package /></div>
                                    )}
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </div>
            </div>
        );
    }

    // Sort Products View
    if (view === 'sort-products') {
        return (
            <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setView('product-list')}
                            className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 transition"
                        >
                            <ChevronRight size={20} className={isRTL ? "" : "rotate-180"} />
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-gray-800">{txt.sort_prod_title}</h2>
                            <p className="text-xs text-gray-400 font-bold">{txt.sort_prod_desc}{selectedCategory}</p>
                        </div>
                    </div>
                    <button
                        onClick={saveProductOrder}
                        className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-600 transition flex items-center gap-2"
                    >
                        <Save size={18} /> {txt.save_order}
                    </button>
                </div>

                {/* Sortable List */}
                <div className="space-y-3 pb-20">
                    <div className="bg-blue-900 text-white p-4 rounded-t-2xl font-black text-center">
                        {txt.products_header}
                    </div>

                    <Reorder.Group axis="y" values={sortedProducts} onReorder={setSortedProducts} className="space-y-3">
                        {sortedProducts.map((product, index) => (
                            <Reorder.Item key={product.id} value={product}>
                                <div
                                    className="bg-white border border-green-500/30 border-b-4 border-b-green-500 rounded-xl p-4 flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing z-10 relative"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col gap-1 text-green-500 opacity-50">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                            </div>
                                        </div>
                                        <span className="text-gray-400 font-mono font-bold text-lg w-8">{index + 1}</span>
                                        <div className={isRTL ? "text-right" : "text-left"}>
                                            <h3 className="font-bold text-gray-700 text-lg select-none line-clamp-1">{product.name}</h3>
                                            <span className="text-xs font-bold text-gray-400 select-none">{product.price} {currency}</span>
                                        </div>
                                    </div>

                                    {product.mainImage ? (
                                        <img src={product.mainImage} className="w-16 h-16 rounded-lg object-cover border border-gray-100 pointer-events-none" alt="" />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400"><Package /></div>
                                    )}
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </div>
            </div>
        );
    }



    // Product Grid View (Matching Image 1)
    const filteredProducts = products.filter(p => {
        const matchesCategory = p.category === selectedCategory;
        const searchLower = searchQuery ? String(searchQuery).toLowerCase() : '';

        const nameMatch = p.name && String(p.name).toLowerCase().includes(searchLower);
        const codeMatch = p.code && String(p.code).toLowerCase().includes(searchLower);
        const idMatch = p.id && String(p.id).toLowerCase().includes(searchLower);

        const matchesSearch = !searchQuery || nameMatch || codeMatch || idMatch;

        return matchesCategory && matchesSearch;
    });



    return (
        <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header / Breadcrumb */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 md:mb-8">
                <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-4">
                    <button
                        onClick={() => setView('categories')}
                        className="flex items-center gap-2 text-gray-400 hover:text-blue-600 font-black transition-colors text-sm md:text-base"
                    >
                        <ChevronRight size={20} className={isRTL ? "" : "rotate-180"} />
                        <span>{txt.back_to_cats}</span>
                    </button>
                    <h2 className="text-xl md:text-2xl font-black text-gray-800">{selectedCategory}</h2>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="flex-1 md:flex-none w-full md:w-auto">
                        <div className="relative flex items-center">
                            <button className={`absolute ${isRTL ? 'left-1' : 'right-1'} top-1 bottom-1 bg-blue-500 text-white px-6 rounded-lg font-black text-sm hover:bg-blue-600 transition`}>
                                {txt.search_btn}
                            </button>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={txt.search_prod_placeholder}
                                className={`w-full md:w-96 bg-white border border-gray-200 rounded-xl py-3 ${isRTL ? 'pr-10 pl-20 text-right' : 'pl-10 pr-20 text-left'} outline-none focus:border-blue-500 font-bold text-gray-900 placeholder-gray-400`}
                            />
                            <Search size={20} className={`absolute ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setView('sort-products')}
                            className="w-10 h-10 md:w-12 md:h-12 bg-white text-blue-500 border border-blue-100 rounded-xl flex items-center justify-center shadow-sm hover:bg-blue-50 transition"
                            title={txt.sort_prod_btn}
                        >
                            <BarChart3 size={20} className="rotate-90" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className="w-10 h-10 md:w-12 md:h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-blue-600 transition"
                            >
                                <Settings size={20} />
                            </button>

                            {isSettingsOpen && (
                                <div className={`absolute top-12 ${isRTL ? 'left-0' : 'right-0'} w-48 md:w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50`}>
                                    <div className="p-4 text-center text-xs text-gray-400 font-bold uppercase tracking-widest">{txt.options}</div>
                                    <div className="h-px bg-gray-50 mx-4" />
                                    {/* Additional settings can go here if needed, but for now it's a placeholder for future features */}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
                {filteredProducts
                    .sort((a, b) => ((a.order || 9999) - (b.order || 9999))) // Apply Sort Order
                    .map((product) => (
                        <div
                            key={product.id}
                            className={`bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col group relative ${product.hidden ? 'opacity-60 grayscale' : ''}`}
                        >
                            {/* Quick Actions (Always Visible) */}
                            <div className="absolute top-2.5 right-2.5 left-2.5 z-20 flex justify-between items-center transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); shareProduct(product); }} className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform"><ExternalLink size={15} /></button>
                                <div className="flex gap-1.5">
                                    <button onClick={(e) => { e.stopPropagation(); toggleHideProduct(product); }} className={`w-8 h-8 ${product.hidden ? 'bg-gray-400' : 'bg-orange-400'} text-white rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}>
                                        {product.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); console.log("Trash clicked!"); deleteProduct(product.id); }} className="w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"><Trash2 size={15} /></button>
                                </div>
                            </div>

                            {/* Image */}
                            <div className="aspect-square bg-gray-50 relative overflow-hidden">
                                <img
                                    src={product.mainImage || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=400"}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    alt={product.name}
                                />
                            </div>

                            {/* Info & Sub-Buttons */}
                            <div className="p-3.5 md:p-4.5 text-center space-y-1.5 md:space-y-2.5">
                                <h3 className="font-black text-gray-800 truncate text-[11px] md:text-sm">{product.name}</h3>
                                <div className="text-gray-900 font-black text-sm md:text-lg italic uppercase flex items-center justify-center gap-1.5">
                                    <span>{product.price?.toLocaleString()}</span>
                                    <span>{currency}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-1 md:gap-2">
                                    <button className="py-1.5 md:py-2 bg-blue-50 text-blue-500 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black border border-blue-100">
                                        {product.code || '---'}
                                    </button>
                                    <button className="py-1.5 md:py-2 bg-blue-50 text-blue-500 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black border border-blue-100">
                                        {txt.code_label}
                                    </button>
                                    <button className="py-1.5 md:py-2 bg-indigo-50 text-indigo-500 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black border border-indigo-100 italic">
                                        #{product.order || '9999'} {txt.order}
                                    </button>
                                    <button className="py-1.5 md:py-2 bg-blue-50 text-blue-500 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black border border-blue-100">
                                        {txt.stock_label} {product.stock}
                                    </button>
                                    <button className="py-1.5 md:py-2 bg-blue-50 text-blue-500 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black border border-blue-100">{txt.options}</button>
                                    <button className="py-1.5 md:py-2 bg-blue-50 text-blue-500 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black border border-blue-100">{txt.discount}</button>
                                    <button className="py-1.5 md:py-2 bg-blue-50 text-blue-500 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black border border-blue-100">{txt.images}</button>
                                </div>

                                <button onClick={() => onEdit(product)} className="w-full py-1.5 md:py-2.5 bg-blue-500 text-white font-black rounded-lg md:rounded-xl shadow-lg shadow-blue-200 mt-1 hover:bg-blue-600 transition-all text-[11px] md:text-sm">{txt.edit_product}</button>
                            </div>
                        </div>
                    ))}
            </div>

            {filteredProducts.length === 0 && (
                <div className="py-20 text-center space-y-4 opacity-30">
                    <Package size={64} className="mx-auto" />
                    <p className="font-black">{txt.no_products}</p>
                </div>
            )}
        </div>
    );
};

export default ProductsView;
