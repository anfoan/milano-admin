import React, { useState, useRef, useEffect } from 'react';
import {
    Image as ImageIcon, Plus, X, Upload,
    Type, Hash, Palette, Ruler, Info,
    ChevronDown, Save, Trash2, Bold, Italic, Underline,
    Link, Heading2, List, ListOrdered, FileJson, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/firebase';
import {
    collection, addDoc, doc, updateDoc,
    getDocs, query, serverTimestamp
} from 'firebase/firestore';
import { uploadToCloudinary } from '../../services/uploadService';
import ImageCropper from './ImageCropper';
import { useCurrency } from '../../context/CurrencyContext';

const ProductForm = ({ editingProduct, setEditingProduct, setActiveTab, lang = 'ar' }) => {
    const { convertPrice } = useCurrency();
    const mainImageInputRef = useRef(null);
    const galleryImageInputRef = useRef(null);
    const descriptionRef = useRef(null);

    const t = {
        ar: {
            title_add: 'معلومات المنتج',
            title_edit: 'تعديل بيانات المنتج',
            save: 'حفظ المنتج',
            saving: 'جاري الحفظ...',
            save_changes: 'حفظ التعديلات',
            product_name: 'إسم المنتج',
            sku: 'رمز المنتج (SKU)',
            price: 'سعر البيع',
            stock: 'عدد المخزون',
            cost_price: 'سعر التكلفة',
            category_label: 'اختر عنوان الكتالوج',
            select_category: 'اختر القسم...',
            add_category_btn: '+ إضافة قسم جديد',
            enter_new_category: 'أدخل اسم القسم الجديد',
            save_btn: 'حفظ',
            cancel_btn: 'إلغاء',
            main_image_label: 'صورة المنتج الأساسية',
            uploaded: 'تم الرفع',
            click_upload: 'اضغط هنا لرفع صورة المنتج',
            upload_btn: 'رفع صورة',
            description_label: 'وصف المنتج',
            edit_s: 'تعديل',
            preview_s: 'معاينة',
            desc_placeholder: 'اكتب وصف المنتج هنا... (استخدم الأزرار بالأعلى للتنسيق)',
            no_preview: 'لا يوجد محتوى للمعاينة...',
            gallery_title: 'الصور الإضافية (اختياري)',
            gallery_hint: 'يمكنك رفع حتى 3 صور (بحد أقصى 10MB لكل صورة)',
            drag_drop: 'اسحب وأفلت الصور هنا',
            click_select: 'أو انقر للاختيار',
            variants_title: 'المقاسات والألوان المتوفرة',
            add_sizes: 'إضافة المقاسات (مثل: S, M, XL أو 42, 43)',
            add_size_placeholder: 'أضف مقاس...',
            add_btn: 'إضافة',
            add_colors: 'إضافة الألوان (مثل: أحمر، أزرق، #FF0000)',
            variants_info: 'سيتم عرض هذه الاختيارات للعميل في صفحة المنتج بشكل دقيق، مما يسهل عليه اختيار المقاس واللون المناسب قبل الإضافة للسلة.',
            alert_success_add_cat: 'تم إضافة الكتالوج بنجاح!',
            alert_error_add_cat: 'حدث خطأ أثناء إضافة الكتالوج',
            alert_success_main_img: 'تم رفع الصورة الأساسية بنجاح!',
            alert_success_gallery: 'تم رفع صور للمعرض بنجاح!',
            alert_validation: 'يرجى إدخال اسم المنتج وسعر البيع على الأقل',
            alert_success_update: 'تم تحديث المنتج بنجاح!',
            alert_success_add: 'تم حفظ المنتج بنجاح في قاعدة البيانات!',
            alert_error_save: 'حدث خطأ أثناء الحفظ. تأكد من أن حجم الصور ليس كبيراً جداً (Firestore Limit 1MB)',
            generate_code: "توليد رمز جديد",
            sizes: "المقاسات",
            colors: "الألوان",
            order_label: "ترتيب المنتج (رقمي)",
            order_placeholder: "مثال: 1, 2, 3...",
            yer_suffix: "يمني",
            sar_preview: "يعادل بالسعودي تقريبا:"
        },
        en: {
            title_add: 'Product Information',
            title_edit: 'Edit Product Details',
            save: 'Save Product',
            saving: 'Saving...',
            save_changes: 'Save Changes',
            product_name: 'Product Name',
            sku: 'SKU Code',
            price: 'Selling Price',
            stock: 'Stock Quantity',
            cost_price: 'Cost Price',
            category_label: 'Select Category',
            select_category: 'Choose Category...',
            add_category_btn: '+ Add New Category',
            enter_new_category: 'Enter New Category Name',
            save_btn: 'Save',
            cancel_btn: 'Cancel',
            main_image_label: 'Main Product Image',
            uploaded: 'Uploaded',
            click_upload: 'Click here to upload image',
            upload_btn: 'Upload Image',
            description_label: 'Product Description',
            edit_s: 'Edit',
            preview_s: 'Preview',
            desc_placeholder: 'Write product description here... (Use buttons above for formatting)',
            no_preview: 'No content to preview...',
            gallery_title: 'Additional Images (Optional)',
            gallery_hint: 'You can upload up to 3 images (Max 10MB per image)',
            drag_drop: 'Drag & Drop images here',
            click_select: 'Or click to select',
            variants_title: 'Available Sizes & Colors',
            add_sizes: 'Add Sizes (e.g., S, M, XL or 42, 43)',
            add_size_placeholder: 'Add size...',
            add_btn: 'Add',
            add_colors: 'Add Colors (e.g., Red, Blue, #FF0000)',
            variants_info: 'these options will be displayed to the customer on the product page, making it easier for them to choose the right size and color before adding to cart.',
            alert_success_add_cat: 'Category added successfully!',
            alert_error_add_cat: 'Error adding category',
            alert_success_main_img: 'Main image uploaded successfully!',
            alert_success_gallery: 'Gallery images uploaded successfully!',
            alert_validation: 'Please enter at least Product Name and Selling Price',
            alert_success_update: 'Product updated successfully!',
            alert_success_add: 'Product saved successfully to database!',
            alert_error_save: 'Error saving. Ensure images are not too large (Firestore Limit 1MB)',
            generate_code: "Generate New Code",
            sizes: "Sizes",
            colors: "Colors",
            order_label: "Product Order (Numeric)",
            order_placeholder: "e.g., 1, 2, 3..."
        }
    };
    const txt = t[lang];
    const isRTL = lang === 'ar';

    // If switching back to Add mode manually, clear form
    useEffect(() => {
        if (!editingProduct) {
            setFormData({
                name: '', price: '', costPrice: '', stock: '', code: '',
                category: '', description: '', mainImage: null, gallery: [],
                hidden: false, order: ''
            });
            setVariants([
                { type: 'size', name: txt.sizes, values: [] },
                { type: 'color', name: txt.colors, values: [] }
            ]);
            setSizeStocks({});
            generateCode();
        }
    }, [editingProduct]);

    const generateCode = () => {
        const chars = '0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData(prev => ({ ...prev, code: result }));
    };

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        costPrice: '',
        stock: '',
        code: '',
        category: '',
        description: '',
        mainImage: null,
        gallery: [],
        hidden: false,
        order: ''
    });

    const [variants, setVariants] = useState([
        { type: 'size', name: txt.sizes, values: [] },
        { type: 'color', name: txt.colors, values: [] }
    ]);

    const [sizeStocks, setSizeStocks] = useState({});

    const [newSize, setNewSize] = useState('');
    const [newColor, setNewColor] = useState('#000000'); // Default black for picker
    const [localCategories, setLocalCategories] = useState([]);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [descriptionView, setDescriptionView] = useState('editor'); // 'editor' or 'preview'
    const [croppingImage, setCroppingImage] = useState(null); // State for image to crop

    const toEnglishDigits = (value) => String(value ?? '').replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660));

    // Fetch categories on mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const q = query(collection(db, "categories"));
                const querySnapshot = await getDocs(q);
                const cats = querySnapshot.docs.map(doc => doc.data().name);
                if (cats.length > 0) {
                    setLocalCategories(cats);
                } else {
                    setLocalCategories([]);
                }
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };
        fetchCategories();
    }, []);

    // Handle Edit Mode
    useEffect(() => {
        if (editingProduct) {
            setFormData({
                name: editingProduct.name || '',
                price: editingProduct.price || '',
                costPrice: editingProduct.costPrice || '',
                stock: editingProduct.stock || '',
                code: editingProduct.code || '',
                category: editingProduct.category || '',
                description: editingProduct.description || '',
                mainImage: editingProduct.mainImage || null,
                gallery: editingProduct.gallery || [],
                hidden: editingProduct.hidden || false,
                order: editingProduct.order || ''
            });
            if (editingProduct.variants) {
                setVariants(editingProduct.variants.map(variant => variant.type === 'size'
                    ? { ...variant, values: (variant.values || []).map(toEnglishDigits) }
                    : variant));
            }
            const normalizedStocks = Object.entries(editingProduct.sizeStocks || {}).reduce((stocks, [size, quantity]) => {
                stocks[toEnglishDigits(size)] = toEnglishDigits(quantity);
                return stocks;
            }, {});
            setSizeStocks(normalizedStocks);
        }
    }, [editingProduct]);

    const handleAddCatalog = async () => {
        if (newCategoryName && newCategoryName.trim()) {
            setLoading(true);
            try {
                await addDoc(collection(db, "categories"), {
                    name: newCategoryName.trim(),
                    createdAt: serverTimestamp()
                });
                setLocalCategories([...localCategories, newCategoryName.trim()]);
                setNewCategoryName('');
                setIsAddingCategory(false);
                alert(txt.alert_success_add_cat);
            } catch (error) {
                console.error("Error adding category:", error);
                alert(txt.alert_error_add_cat);
            } finally {
                setLoading(false);
            }
        }
    };

    const applyFormat = (type) => {
        const textarea = descriptionRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = formData.description.substring(start, end);
        let newText = '';

        switch (type) {
            case 'bold': newText = `**${selectedText}**`; break;
            case 'italic': newText = `*${selectedText}*`; break;
            case 'underline': newText = `<u>${selectedText}</u>`; break;
            case 'link': newText = `[${selectedText}](رابط_هنا)`; break;
            case 'h2': newText = `\n## ${selectedText}`; break;
            case 'list': newText = `\n- ${selectedText}`; break;
            case 'ordered-list': newText = `\n1. ${selectedText}`; break;
            default: newText = selectedText;
        }

        const updatedDescription = formData.description.substring(0, start) + newText + formData.description.substring(end);
        setFormData({ ...formData, description: updatedDescription });

        // Reset focus
        if (descriptionView === 'editor') {
            setTimeout(() => {
                textarea.focus();
            }, 0);
        }
    };

    const renderPreview = (text) => {
        if (!text) return txt.no_preview;

        // Escape HTML to prevent XSS
        const escape = (str) => {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        let safeText = escape(text);

        let html = safeText
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-500 underline" target="_blank">$1</a>')
            .replace(/\n## (.*?)/g, '<h2 class="text-xl font-bold mt-4 mb-2 text-gray-800">$1</h2>')
            .replace(/\n- (.*?)/g, '<li class="mr-4">$1</li>')
            .replace(/\n1. (.*?)/g, '<li class="mr-4" list-style-type="decimal">$1</li>')
            .replace(/\n/g, '<br/>');

        return html;
    };

    const handleMainImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setCroppingImage(reader.result); // Open cropper with this image
            });
            reader.readAsDataURL(file);
            // Clear input so same file can be selected again if cancelled
            e.target.value = null;
        }
    };

    const handleCropComplete = async (croppedBlob) => {
        setCroppingImage(null); // Close cropper
        setLoading(true);

        // Upload cropped blob with a specific name
        const imageUrl = await uploadToCloudinary(croppedBlob, 'cropped_product');
        if (imageUrl) {
            setFormData({ ...formData, mainImage: imageUrl });
            alert(txt.alert_success_main_img);
        }
        setLoading(false);
    };

    const handleGalleryChange = async (e) => {
        if (e.target.files) {
            setLoading(true);
            const files = Array.from(e.target.files);
            const uploadPromises = files.map(file => uploadToCloudinary(file));
            const uploadedUrls = await Promise.all(uploadPromises);

            // Filter out any failed uploads (nulls)
            const validUrls = uploadedUrls.filter(url => url !== null);

            setFormData(prev => ({
                ...prev,
                gallery: [...prev.gallery, ...validUrls].slice(0, 5) // Limit to 5 images for now
            }));

            alert(txt.alert_success_gallery);
        }
        setLoading(false);
    };

    const removeGalleryImage = (index) => {
        const newGallery = formData.gallery.filter((_, i) => i !== index);
        setFormData({ ...formData, gallery: newGallery });
    };

    const handleSizeStockChange = (size, val) => {
        const normalizedValue = toEnglishDigits(val);
        const numVal = normalizedValue === '' ? '' : Math.max(0, parseInt(normalizedValue, 10) || 0);
        setSizeStocks(prev => {
            const updatedStocks = { ...prev, [size]: numVal };
            const totalStock = Object.values(updatedStocks).reduce((sum, current) => sum + (Number(current) || 0), 0);
            setFormData(prevForm => ({ ...prevForm, stock: totalStock.toString() }));
            return updatedStocks;
        });
    };

    const renameVariantValue = (index, nextValue) => {
        const normalizedValue = toEnglishDigits(nextValue).trim();
        const previousValue = variants[0].values[index];
        if (!normalizedValue || normalizedValue === previousValue) return;
        if (variants[0].values.some((value, valueIndex) => valueIndex !== index && value === normalizedValue)) return;
        const updated = [...variants];
        updated[0] = { ...updated[0], values: updated[0].values.map((value, valueIndex) => valueIndex === index ? normalizedValue : value) };
        setVariants(updated);
        setSizeStocks(prev => {
            const updatedStocks = { ...prev, [normalizedValue]: prev[previousValue] ?? 0 };
            delete updatedStocks[previousValue];
            return updatedStocks;
        });
    };

    const addVariantValue = (type) => {
        if (type === 'size' && newSize.trim()) {
            const sizeVal = newSize.trim();
            if (variants[0].values.includes(sizeVal)) return;

            const updated = [...variants];
            updated[0].values.push(sizeVal);
            setVariants(updated);
            
            setSizeStocks(prev => ({ ...prev, [sizeVal]: 0 }));
            setNewSize('');
        } else if (type === 'color' && newColor.trim()) {
            const updated = [...variants];
            updated[1].values.push(newColor.trim());
            setVariants(updated);
            setNewColor('');
        }
    };

    const removeVariantValue = (type, index) => {
        const updated = [...variants];
        if (type === 'size') {
            const removedSize = updated[0].values[index];
            updated[0].values.splice(index, 1);
            
            setSizeStocks(prev => {
                const updatedStocks = { ...prev };
                delete updatedStocks[removedSize];
                
                const totalStock = Object.values(updatedStocks).reduce((sum, current) => sum + (Number(current) || 0), 0);
                setFormData(prevForm => ({ ...prevForm, stock: totalStock.toString() }));
                return updatedStocks;
            });
        } else {
            updated[1].values.splice(index, 1);
        }
        setVariants(updated);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        // Detailed validation for mandatory fields
        const requiredFields = {
            name: formData.name,
            code: formData.code,
            price: formData.price,
            stock: formData.stock,
            costPrice: formData.costPrice,
            category: formData.category,
            mainImage: formData.mainImage,
            order: formData.order
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value || (typeof value === 'string' && !value.trim()))
            .map(([key]) => key);

        const missingFieldsMap = {};
        missingFields.forEach(field => {
            missingFieldsMap[field] = true;
        });
        setErrors(missingFieldsMap);

        if (missingFields.length > 0) {
            const fieldNamesAr = {
                name: 'اسم المنتج',
                code: 'رمز المنتج (SKU)',
                price: 'سعر البيع',
                stock: 'عدد المخزون',
                costPrice: 'سعر التكلفة',
                category: 'الكتالوج / القسم',
                mainImage: 'صورة المنتج',
                order: 'ترتيب المنتج'
            };

            const missingNames = missingFields.map(f => fieldNamesAr[f] || f).join('، ');
            alert(`يرجى تعبئة جميع الحقول المطلوبة: ${missingNames}`);
            return;
        }

        setErrors({});

        setLoading(true);
        try {
            // Prepare data for saving
            let finalData = { 
                ...formData,
                order: formData.order ? Number(formData.order) : 999999
            };

            // Recalculate priceAfterDiscount if discount exists (from editingProduct)
            if (editingProduct && editingProduct.discount > 0) {
                const priceNum = Number(formData.price);
                const discountPercent = Number(editingProduct.discount);
                finalData.priceAfterDiscount = priceNum - (priceNum * (discountPercent / 100));
            }

            if (editingProduct) {
                // Update existing product
                const productRef = doc(db, "products", editingProduct.id);
                await updateDoc(productRef, {
                    ...finalData,
                    variants: variants,
                    sizeStocks: sizeStocks,
                    updatedAt: serverTimestamp(),
                });

                // Notify Google Indexing API
                try {
                    const productUrl = `https://milano-store.com/product/${editingProduct.id}`;
                    fetch('/.netlify/functions/index-now', {
                        method: 'POST',
                        body: JSON.stringify({ url: productUrl, type: "URL_UPDATED" })
                    }).catch(e => console.error("IndexNow error:", e));
                } catch (e) {
                    console.error("Index notification failed:", e);
                }

                alert(txt.alert_success_update);
            } else {
                // Add new product
                const newDoc = await addDoc(collection(db, "products"), {
                    ...finalData,
                    variants: variants,
                    sizeStocks: sizeStocks,
                    createdAt: serverTimestamp(),
                });

                // Notify Google Indexing API for NEW product
                try {
                    const productUrl = `https://milano-store.com/product/${newDoc.id}`;
                    fetch('/.netlify/functions/index-now', {
                        method: 'POST',
                        body: JSON.stringify({ url: productUrl, type: "URL_UPDATED" })
                    }).catch(e => console.error("IndexNow error:", e));
                } catch (e) {
                    console.error("Index notification failed:", e);
                }

                alert(txt.alert_success_add);
            }

            // Cleanup
            setFormData({
                name: '', price: '', costPrice: '', stock: '', code: '',
                category: '', description: '', mainImage: null, gallery: [],
                hidden: false
            });
            setVariants([
                { type: 'size', name: txt.sizes, values: [] },
                { type: 'color', name: txt.colors, values: [] }
            ]);
            setSizeStocks({});
            generateCode(); // Ready for next one
            if (editingProduct) {
                setEditingProduct(null); // Clear edit mode
                setActiveTab('product-list'); // Go back to list
            }
        } catch (error) {
            console.error("Error adding product: ", error);
            alert("حدث خطأ أثناء الحفظ. تأكد من أن حجم الصور ليس كبيراً جداً (Firestore Limit 1MB)");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {croppingImage && (
                <ImageCropper
                    imageSrc={croppingImage}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setCroppingImage(null)}
                />
            )}
            <form onSubmit={handleSave} className="space-y-6 pb-20 font-['Cairo']" dir={isRTL ? 'rtl' : 'ltr'}>
                {editingProduct && (
                    <button type="button" onClick={() => { setEditingProduct(null); setActiveTab('product-list'); }} className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-colors" title={isRTL ? 'العودة إلى قائمة المنتجات' : 'Back to products'}>
                        <ArrowRight size={20} className={isRTL ? '' : 'rotate-180'} />
                    </button>
                )}
                {/* 1. Product Info Section (Matching Image 1) */}
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden relative">
                    <div className={`absolute top-8 ${isRTL ? 'right-8' : 'left-8'} w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-black z-10 shadow-lg shadow-blue-200`}>
                        1
                    </div>

                    <div className={`p-10 ${isRTL ? 'pr-20' : 'pl-20'}`}>
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-xl font-black text-gray-800">
                                {editingProduct ? txt.title_edit : txt.title_add}
                            </h2>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 bg-blue-500 text-white font-black rounded-xl hover:bg-blue-600 transition shadow-lg shadow-blue-200 flex items-center gap-2"
                            >
                                <Save size={18} /> {loading ? txt.saving : (editingProduct ? txt.save_changes : txt.save)}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            <div className="space-y-2">
                                <label className={`text-xs font-black ${errors.name ? 'text-red-500' : 'text-gray-600'} block ${isRTL ? 'mr-1' : 'ml-1'}`}>{txt.product_name} <span className="text-red-500 text-xl mx-1 font-black">*</span></label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData({ ...formData, name: e.target.value });
                                        if (errors.name) setErrors({ ...errors, name: false });
                                    }}
                                    className={`w-full bg-white border ${errors.name ? 'border-red-500 bg-red-50/30' : 'border-gray-200'} rounded-xl py-4 px-4 outline-none focus:border-blue-500 font-bold text-gray-900 placeholder-gray-400 transition-all`}
                                    placeholder={txt.product_name}
                                />
                                {errors.name && <p className="text-[10px] font-bold text-red-500 px-2 animate-in fade-in slide-in-from-top-1">إسم المنتج مطلوب</p>}
                            </div>
                            <div className="space-y-2">
                                <label className={`text-xs font-black ${errors.code ? 'text-red-500' : 'text-gray-600'} block ${isRTL ? 'mr-1' : 'ml-1'}`}>{txt.sku} <span className="text-red-500 text-xl mx-1 font-black">*</span></label>
                                <div className="flex gap-2">
                                    <input
                                        value={formData.code}
                                        onChange={(e) => {
                                            setFormData({ ...formData, code: e.target.value });
                                            if (errors.code) setErrors({ ...errors, code: false });
                                        }}
                                        className={`w-full bg-white border ${errors.code ? 'border-red-500 bg-red-50/30' : 'border-gray-200'} rounded-xl py-4 px-4 outline-none focus:border-blue-500 font-bold text-gray-900 placeholder-gray-400 uppercase font-mono transition-all`}
                                        placeholder="CODE"
                                    />
                                    <button type="button" onClick={generateCode} className="px-3 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200 transition-colors" title={txt.generate_code}>
                                        <Hash size={18} />
                                    </button>
                                </div>
                                {errors.code && <p className="text-[10px] font-bold text-red-500 px-2 animate-in fade-in slide-in-from-top-1">رمز المنتج مطلوب</p>}
                            </div>
                            <div className="space-y-2">
                                <label className={`text-xs font-black ${errors.price ? 'text-red-500' : 'text-gray-600'} block ${isRTL ? 'mr-1' : 'ml-1'}`}>{txt.price} ({txt.yer_suffix}) <span className="text-red-500 text-xl mx-1 font-black">*</span></label>
                                <input
                                    value={formData.price}
                                    onChange={(e) => {
                                        setFormData({ ...formData, price: e.target.value });
                                        if (errors.price) setErrors({ ...errors, price: false });
                                    }}
                                    type="number"
                                    className={`w-full bg-white border ${errors.price ? 'border-red-500 bg-red-50/30' : 'border-gray-200'} rounded-xl py-4 px-4 outline-none focus:border-blue-500 font-bold text-gray-900 placeholder-gray-400 transition-all`}
                                    placeholder={txt.price}
                                />
                                {formData.price && (
                                    <p className="text-[10px] font-bold text-blue-500 px-2">
                                        {txt.sar_preview} {Math.round(convertPrice(Number(formData.price), 'SAR')).toLocaleString('en-US')} SAR
                                    </p>
                                )}
                                {errors.price && <p className="text-[10px] font-bold text-red-500 px-2 animate-in fade-in slide-in-from-top-1">سعر البيع مطلوب</p>}
                            </div>
                            <div className="space-y-2">
                                <label className={`text-xs font-black ${errors.stock ? 'text-red-500' : 'text-gray-600'} block ${isRTL ? 'mr-1' : 'ml-1'}`}>{txt.stock} <span className="text-red-500 text-xl mx-1 font-black">*</span></label>
                                <input
                                    value={formData.stock}
                                    onChange={(e) => {
                                        setFormData({ ...formData, stock: e.target.value });
                                        if (errors.stock) setErrors({ ...errors, stock: false });
                                    }}
                                    type="number"
                                    disabled={variants[0].values.length > 0}
                                    className={`w-full bg-white border ${errors.stock ? 'border-red-500 bg-red-50/30' : 'border-gray-200'} rounded-xl py-4 px-4 outline-none focus:border-blue-500 font-bold text-gray-900 placeholder-gray-400 transition-all ${variants[0].values.length > 0 ? 'opacity-60 bg-gray-50 cursor-not-allowed' : ''}`}
                                    placeholder={txt.stock}
                                />
                                {variants[0].values.length > 0 ? (
                                    <p className="text-[10px] font-bold text-blue-500 px-2">يتم احتساب المخزون تلقائياً من مجموع كميات المقاسات</p>
                                ) : (
                                    errors.stock && <p className="text-[10px] font-bold text-red-500 px-2 animate-in fade-in slide-in-from-top-1">عدد المخزون مطلوب</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className={`text-xs font-black ${errors.costPrice ? 'text-red-500' : 'text-gray-600'} block ${isRTL ? 'mr-1' : 'ml-1'}`}>{txt.cost_price} ({txt.yer_suffix}) <span className="text-red-500 text-xl mx-1 font-black">*</span></label>
                                <input
                                    value={formData.costPrice}
                                    onChange={(e) => {
                                        setFormData({ ...formData, costPrice: e.target.value });
                                        if (errors.costPrice) setErrors({ ...errors, costPrice: false });
                                    }}
                                    type="number"
                                    className={`w-full bg-white border ${errors.costPrice ? 'border-red-500 bg-red-50/30' : 'border-gray-200'} rounded-xl py-4 px-4 outline-none focus:border-blue-500 font-bold text-gray-900 placeholder-gray-400 transition-all`}
                                    placeholder={txt.cost_price}
                                />
                                {formData.costPrice && (
                                    <p className="text-[10px] font-bold text-blue-500 px-2">
                                        {txt.sar_preview} {Math.round(convertPrice(Number(formData.costPrice), 'SAR')).toLocaleString('en-US')} SAR
                                    </p>
                                )}
                                {errors.costPrice && <p className="text-[10px] font-bold text-red-500 px-2 animate-in fade-in slide-in-from-top-1">سعر التكلفة مطلوب</p>}
                            </div>
                            <div className="space-y-2">
                                <label className={`text-xs font-black ${errors.order ? 'text-red-500' : 'text-gray-600'} block ${isRTL ? 'mr-1' : 'ml-1'}`}>{txt.order_label} <span className="text-red-500 text-xl mx-1 font-black">*</span></label>
                                <input
                                    value={formData.order}
                                    onChange={(e) => {
                                        setFormData({ ...formData, order: e.target.value });
                                        if (errors.order) setErrors({ ...errors, order: false });
                                    }}
                                    type="number"
                                    className={`w-full bg-white border ${errors.order ? 'border-red-500 bg-red-50/30' : 'border-gray-200'} rounded-xl py-4 px-4 outline-none focus:border-blue-500 font-bold text-gray-900 placeholder-gray-400 transition-all`}
                                    placeholder={txt.order_placeholder}
                                />
                                {errors.order && <p className="text-[10px] font-bold text-red-500 px-2 animate-in fade-in slide-in-from-top-1">حقل الترتيب مطلوب</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={`text-xs font-black ${errors.category ? 'text-red-500' : 'text-gray-600'} block ${isRTL ? 'mr-1' : 'ml-1'}`}>{txt.category_label} <span className="text-red-500 text-xl mx-1 font-black">*</span></label>
                                <div className="space-y-3">
                                    {!isAddingCategory ? (
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <div className="flex-1 space-y-1">
                                                <select
                                                    value={formData.category}
                                                    onChange={(e) => {
                                                        setFormData({ ...formData, category: e.target.value });
                                                        if (errors.category) setErrors({ ...errors, category: false });
                                                    }}
                                                    className={`w-full bg-white border ${errors.category ? 'border-red-500 bg-red-50/30' : 'border-gray-200'} rounded-xl py-4 px-4 outline-none focus:border-blue-500 font-bold text-gray-900 transition-all`}
                                                >
                                                    <option value="">{txt.select_category}</option>
                                                    {localCategories.map((cat, i) => (
                                                        <option key={i} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                                {errors.category && <p className="text-[10px] font-bold text-red-500 px-2 animate-in fade-in slide-in-from-top-1">يجب اختيار قسم</p>}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsAddingCategory(true)}
                                                className="px-6 py-4 h-[58px] bg-blue-50 text-blue-600 border border-blue-100 rounded-xl font-black text-sm hover:bg-blue-100 transition whitespace-nowrap"
                                            >
                                                {txt.add_category_btn}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row gap-2 animate-in fade-in slide-in-from-top-2">
                                            <input
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                placeholder={txt.enter_new_category}
                                                className="flex-1 bg-white border border-blue-500 rounded-xl py-4 px-4 outline-none font-bold text-gray-900"
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleAddCatalog}
                                                    className="flex-1 sm:flex-none px-6 py-4 bg-blue-500 text-white rounded-xl font-black text-sm hover:bg-blue-600 transition"
                                                >
                                                    {txt.save_btn}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}
                                                    className="px-6 py-4 bg-gray-100 text-gray-500 rounded-xl font-black text-sm hover:bg-gray-200 transition"
                                                >
                                                    {txt.cancel_btn}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className={`text-xs font-black ${errors.mainImage ? 'text-red-500' : 'text-gray-600'} block ${isRTL ? 'mr-1' : 'ml-1'}`}>{txt.main_image_label} <span className="text-red-500 text-xl mx-1 font-black">*</span></label>
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                                    <div className={`bg-white border ${errors.mainImage ? 'border-red-500 bg-red-50/30' : 'border-gray-200'} rounded-xl py-4 px-4 font-bold ${formData.mainImage ? 'text-blue-600' : 'text-gray-500'} text-center truncate w-full transition-all`}>
                                        {formData.mainImage ? txt.uploaded : txt.click_upload}
                                    </div>
                                    <input type="file" hidden ref={mainImageInputRef} onChange={handleMainImageChange} accept="image/*" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            mainImageInputRef.current.click();
                                            if (errors.mainImage) setErrors({ ...errors, mainImage: false });
                                        }}
                                        className="px-6 py-4 bg-blue-500 text-white rounded-xl font-black text-sm hover:bg-blue-600 shadow-md transition whitespace-nowrap"
                                    >
                                        {txt.upload_btn}
                                    </button>
                                </div>
                                {errors.mainImage && <p className="text-[10px] font-bold text-red-500 px-2 animate-in fade-in slide-in-from-top-1">صورة المنتج مطلوبة</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Description Section (Matching Image 2) */}
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-gray-600">{txt.description_label}</h3>
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setDescriptionView('editor')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${descriptionView === 'editor' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {txt.edit_s}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDescriptionView('preview')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${descriptionView === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {txt.preview_s}
                                </button>
                            </div>
                        </div>
                        <div className="border border-gray-100 rounded-[20px] overflow-hidden">
                            <div className="bg-gray-50/50 p-2 border-b border-gray-100 flex items-center gap-1 text-gray-500 px-4">
                                <button type="button" onClick={() => applyFormat('bold')} className="p-2 hover:bg-white hover:text-blue-500 rounded-lg transition-colors" title="عريض"><Bold size={16} /></button>
                                <button type="button" onClick={() => applyFormat('italic')} className="p-2 hover:bg-white hover:text-blue-500 rounded-lg transition-colors" title="مائل"><Italic size={16} /></button>
                                <button type="button" onClick={() => applyFormat('underline')} className="p-2 hover:bg-white hover:text-blue-500 rounded-lg transition-colors" title="تحته خط"><Underline size={16} /></button>
                                <div className="w-px h-4 bg-gray-200 mx-1" />
                                <button type="button" onClick={() => applyFormat('link')} className="p-2 hover:bg-white hover:text-blue-500 rounded-lg transition-colors" title="إضافة رابط"><Link size={16} /></button>
                                <button type="button" onClick={() => applyFormat('h2')} className="p-2 hover:bg-white hover:text-blue-500 rounded-lg transition-colors" title="عنوان"><Heading2 size={16} /></button>
                                <button type="button" onClick={() => applyFormat('list')} className="p-2 hover:bg-white hover:text-blue-500 rounded-lg transition-colors" title="قائمة بنقاط"><List size={16} /></button>
                                <button type="button" onClick={() => applyFormat('ordered-list')} className="p-2 hover:bg-white hover:text-blue-500 rounded-lg transition-colors" title="قائمة مرقمة"><ListOrdered size={16} /></button>
                            </div>

                            {descriptionView === 'editor' ? (
                                <textarea
                                    ref={descriptionRef}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full min-h-[220px] p-6 outline-none font-bold text-gray-900 placeholder-gray-400 leading-relaxed"
                                    placeholder={txt.desc_placeholder}
                                />
                            ) : (
                                <div
                                    className="w-full min-h-[220px] p-6 bg-white font-bold text-gray-800 overflow-y-auto leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: renderPreview(formData.description) }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Gallery Upload Section */}
                    <div className="p-8 pt-0">
                        <h3 className="text-center font-black text-gray-800 mb-6">{txt.gallery_title}</h3>
                        <p className="text-center text-[10px] text-gray-400 font-bold mb-4">{txt.gallery_hint}</p>

                        <div
                            onClick={() => galleryImageInputRef.current.click()}
                            className="border-2 border-dashed border-gray-200 rounded-[24px] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-gray-50 transition-all group"
                        >
                            <input type="file" hidden multiple ref={galleryImageInputRef} onChange={handleGalleryChange} accept="image/*" />
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                <Upload size={32} />
                            </div>
                            <div className="text-center">
                                <span className="block font-black text-gray-800">{txt.drag_drop}</span>
                                <span className="text-xs font-bold text-gray-400 uppercase">{txt.click_select}</span>
                            </div>
                        </div>

                        {/* Gallery Preview */}
                        {formData.gallery.length > 0 && (
                            <div className="mt-6 flex justify-center gap-4">
                                {formData.gallery.map((img, idx) => (
                                    <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-gray-100">
                                        <img src={img} className="w-full h-full object-cover" />
                                        <button type="button" onClick={(e) => { e.stopPropagation(); removeGalleryImage(idx); }} className="absolute top-1 left-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Variants Section (Matching Image 3) */}
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-8 space-y-8">
                    <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                        <Ruler size={20} className="text-blue-500" />
                        {txt.variants_title}
                    </h3>

                    {/* Sizes Management */}
                    <div className="space-y-4">
                        <label className="text-xs font-black text-gray-600 block">{txt.add_sizes}</label>
                        <div className="flex gap-2">
                            <input
                                value={newSize}
                                onChange={(e) => setNewSize(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVariantValue('size'))}
                                className="bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold flex-1 text-gray-900 placeholder-gray-500"
                                placeholder={txt.add_size_placeholder}
                            />
                            <button type="button" onClick={() => addVariantValue('size')} className="px-6 bg-blue-500 text-white rounded-xl font-black">{txt.add_btn}</button>
                        </div>
                        {variants[0].values.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
                                {variants[0].values.map((v, i) => (
                                    <div key={i} className="p-3 border border-gray-200 bg-gray-50/50 dark:bg-white/5 rounded-2xl flex flex-col items-center gap-2 relative shadow-sm">
                                        <button 
                                            type="button" 
                                            onClick={() => removeVariantValue('size', i)}
                                            className="absolute top-1.5 left-1.5 p-1 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                                            title="حذف"
                                        >
                                            <X size={12} />
                                        </button>
                                        <input
                                            type="text"
                                            value={toEnglishDigits(v)}
                                            onChange={(e) => renameVariantValue(i, e.target.value)}
                                            className="w-full text-center bg-transparent text-sm font-black text-gray-800 dark:text-white mt-1 outline-none border-b border-transparent focus:border-blue-500"
                                            aria-label={`تعديل المقاس ${toEnglishDigits(v)}`}
                                        />
                                        <div className="w-full">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={toEnglishDigits(sizeStocks[v] !== undefined ? sizeStocks[v] : 0)}
                                                onChange={(e) => handleSizeStockChange(v, e.target.value)}
                                                className="w-full text-center bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 rounded-xl py-1.5 px-2 text-xs font-black outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                                                placeholder="الكمية"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Colors Management */}
                    <div className="space-y-4">
                        <label className="text-xs font-black text-gray-600 block">{txt.add_colors}</label>
                        <div className="flex gap-2">
                            <div className="relative">
                                <input
                                    type="color"
                                    value={newColor}
                                    onChange={(e) => setNewColor(e.target.value)}
                                    className="w-12 h-12 p-1 rounded-xl cursor-pointer border border-gray-100"
                                />
                            </div>
                            <input
                                value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                className="bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold flex-1 text-left ltr text-gray-900 placeholder-gray-500"
                                placeholder="#000000"
                                dir="ltr"
                            />
                            <button type="button" onClick={() => addVariantValue('color')} className="px-6 bg-blue-500 text-white rounded-xl font-black">{txt.add_btn}</button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {variants[1].values.map((v, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold group text-gray-900 shadow-sm">
                                    <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: v.includes('#') ? v : '#eee' }}></div>
                                    {v}
                                    <X size={14} className="cursor-pointer text-gray-400 hover:text-red-500" onClick={() => removeVariantValue('color', i)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-start gap-3">
                        <Info size={18} className="text-orange-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-black text-orange-700 leading-relaxed">
                            {txt.variants_info}
                        </p>
                    </div>
                </div>
            </form>
        </>
    );
};

export default ProductForm;
