import React, { useState, useEffect, useRef } from 'react';
import { Save, Image as ImageIcon, Upload, X, ArrowRight, ChevronLeft, Loader2, Receipt, Tag } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { uploadToCloudinary } from '../../../services/uploadService';

const StoreImageSettings = ({ onBack, lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState({ profileImage: false, invoiceLogo: false, nike: false, adidas: false, puma: false, lacoste: false });

    // Default Images State
    const [images, setImages] = useState({
        profileImage: '',
        coverImage: '',
        invoiceLogo: '',
        brands: { nike: '', adidas: '', puma: '', lacoste: '' }
    });

    const t = {
        ar: {
            loading: "جاري التحميل...",
            upload_error: "حدث خطأ أثناء رفع الصورة",
            type_error: "عذراً، يجب أن يكون الملف صورة من نوع JPG أو PNG أو WebP",
            size_error: "عذراً، حجم الصورة كبير جداً. يجب أن يكون أقل من 15 ميجابايت",
            save_success: "تم حفظ الصور بنجاح!",
            save_error: "حدث خطأ أثناء الحفظ",
            save_btn: "حفظ التغييرات",
            sections: {
                profile: {
                    title: "الصورة الشخصية للمتجر",
                    desc: "تظهر في صفحة تفاصيل المنتج، بإطار مربع أنيق",
                    btn: "تغيير الصورة الشخصية"
                },
                invoice: {
                    title: "صورة شعار فواتير لوحة التحكم",
                    desc: "تظهر في جميع فواتير المبيعات والمشتريات والمصروفات والسندات",
                    btn: "تغيير شعار الفواتير"
                },
                brands: {
                    title: "صورة البراندات التي يتم بيعها في المتجر",
                    desc: "تظهر بالترتيب نفسه في بداية المتجر: نايكي، أديداس، بوماء، لاكوست",
                    upload: "تغيير الصورة"
                }
            }
        }
    };

    const txt = t[lang] || t.ar;
    const isRTL = lang === 'ar';

    const fileInputRef = {
        profile: useRef(null),
        cover: useRef(null),
        invoiceLogo: useRef(null),
        nike: useRef(null),
        adidas: useRef(null),
        puma: useRef(null),
        lacoste: useRef(null)
    };

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
        try {
            const docRef = doc(db, "settings", "images");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // Merge separate fields if they exist, or fallback to the old 'logoImage' if new ones aren't set yet (migration)
                const data = docSnap.data();
                setImages({
                    ...data,
                    invoiceLogo: data.invoiceLogo || '',
                    brands: { ...(data.brands || {}) }
                });
            }
        } catch (error) {
            console.error("Error fetching images:", error);
        } finally {
            setLoading(false);
        }
    };

    const cropToSquare = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
                const sx = Math.round((image.naturalWidth - sourceSize) / 2);
                const sy = Math.round((image.naturalHeight - sourceSize) / 2);
                const outputSize = Math.min(sourceSize, 1600);
                const canvas = document.createElement('canvas');
                canvas.width = outputSize;
                canvas.height = outputSize;
                const context = canvas.getContext('2d');
                if (!context) return reject(new Error('Canvas unavailable'));
                context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image crop failed')), 'image/jpeg', 0.92);
            };
            image.onerror = () => reject(new Error('Invalid image'));
            image.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const validateFile = (file) => {
        // 1. Valid Types
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            alert(txt.type_error);
            return false;
        }

        // Source files up to 15MB are accepted; they are cropped and compressed automatically.
        const maxSize = 15 * 1024 * 1024;
        if (file.size > maxSize) {
            alert(txt.size_error);
            return false;
        }

        return true;
    };

    const handleFileChange = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        // Security Validation
        if (!validateFile(file)) {
            e.target.value = ''; // Reset input
            return;
        }

        setUploading(prev => ({ ...prev, [type]: true }));
        try {
            const croppedFile = await cropToSquare(file);
            const imageUrl = await uploadToCloudinary(croppedFile, `store-${type}`);
            if (imageUrl) {
                const newImages = type in { nike: true, adidas: true, puma: true, lacoste: true }
                    ? { ...images, brands: { ...(images.brands || {}), [type]: imageUrl } }
                    : { ...images, [type]: imageUrl };
                setImages(newImages);
                // Auto save on upload success
                await setDoc(doc(db, "settings", "images"), newImages, { merge: true });
            }
        } catch (error) {
            console.error(`Error uploading ${type}:`, error);
        } finally {
            setUploading(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "images"), images, { merge: true });
            alert(txt.save_success);
        } catch (error) {
            console.error("Error saving images:", error);
            alert(txt.save_error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-6 font-['Cairo'] pb-20" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header managed by SettingsView */}

            {/* Main Content Card */}
            <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden p-6 md:p-8 space-y-12">

                {/* 1. Profile Picture */}
                <div className="flex flex-col md:flex-row gap-8 items-start justify-between border-b border-gray-100 pb-12">
                    <div className="w-full md:w-1/3">
                        <h3 className="text-lg font-black text-gray-800 mb-2">{txt.sections.profile.title}</h3>
                        <p className="text-gray-400 text-xs font-bold">{txt.sections.profile.desc}</p>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <input
                            type="file"
                            ref={fileInputRef.profile}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'profileImage')}
                        />
                        <button
                            onClick={() => fileInputRef.profile.current.click()}
                            disabled={uploading.profileImage}
                            className="bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {uploading.profileImage ? <Loader2 className="animate-spin" size={16} /> : null}
                            {txt.sections.profile.btn}
                        </button>

                        <div className="w-32 h-32 rounded-[20px] p-1 bg-black overflow-hidden relative group">
                            <img
                                src={images.profileImage || "/logo.jpg"}
                                alt="Profile"
                                className="w-full h-full object-cover rounded-[18px]"
                                onError={(e) => e.target.src = "/logo.jpg"}
                            />
                            {uploading.profileImage && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cover and theme logos intentionally hidden: the active store image controls are below. */}
                {/* 2. Invoice Logo */}
                <div className="flex flex-col md:flex-row gap-8 items-start justify-between border-b border-gray-100 pb-12">
                    <div className="w-full md:w-1/3">
                        <h3 className="text-lg font-black text-gray-800 mb-2 flex items-center gap-2"><Receipt size={20} className="text-blue-500" />{txt.sections.invoice.title}</h3>
                        <p className="text-gray-400 text-xs font-bold">{txt.sections.invoice.desc}</p>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        <input type="file" ref={fileInputRef.invoiceLogo} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'invoiceLogo')} />
                        <div className="w-32 h-32 rounded-[20px] bg-black overflow-hidden border border-gray-200 shadow-sm relative">
                            <img src={images.invoiceLogo || "/admin-logo.png"} alt="Invoice Logo" className="w-full h-full object-contain p-2" onError={(e) => e.target.src = "/admin-logo.png"} />
                            {uploading.invoiceLogo && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={24} /></div>}
                        </div>
                        <button onClick={() => fileInputRef.invoiceLogo.current.click()} disabled={uploading.invoiceLogo} className="bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                            {uploading.invoiceLogo && <Loader2 className="animate-spin" size={16} />}{txt.sections.invoice.btn}
                        </button>
                    </div>
                </div>
                {/* 3. Brand Images */}
                <div className="flex flex-col gap-6">
                    <div className="border-b border-gray-100 pb-4">
                        <h3 className="text-lg font-black text-gray-800 mb-2 flex items-center gap-2"><Tag size={20} className="text-purple-500" />{txt.sections.brands.title}</h3>
                        <p className="text-gray-400 text-xs font-bold">{txt.sections.brands.desc}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[['nike','نايكي','/nike.png'],['adidas','أديداس','/adidas.png'],['puma','بوماء','/puma.png'],['lacoste','لاكوست','/lacoste.png']].map(([key, label, fallback]) => (
                            <div key={key} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center gap-3">
                                <span className="font-black text-gray-700 text-sm">{label}</span>
                                <input type="file" ref={fileInputRef[key]} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, key)} />
                                <div className="w-full aspect-square rounded-[18px] overflow-hidden bg-white border border-gray-100"><img src={images.brands?.[key] || fallback} alt={label} className="w-full h-full object-cover" onError={(e) => e.target.src = fallback} /></div>
                                <button onClick={() => fileInputRef[key].current.click()} disabled={uploading[key]} className="w-full bg-white text-gray-700 border border-gray-200 px-3 py-2 rounded-xl font-bold text-xs hover:bg-gray-100 disabled:opacity-50">{uploading[key] ? <Loader2 className="animate-spin mx-auto" size={15} /> : txt.sections.brands.upload}</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Footer Save Button */}
            <div className={`flex ${isRTL ? 'justify-start' : 'justify-end'}`}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-500 text-white px-12 py-3.5 rounded-xl font-black text-base shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {txt.save_btn}
                </button>
            </div>
        </div>
    );
};

export default StoreImageSettings;
