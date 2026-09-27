import React, { useState, useEffect, useRef } from 'react';
import { Save, Image as ImageIcon, Upload, X, ArrowRight, ChevronLeft, Loader2, Sun, Moon } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const StoreImageSettings = ({ onBack, lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState({ profile: false, cover: false, logoLight: false, logoDark: false });

    // Default Images State
    const [images, setImages] = useState({
        profileImage: '',
        coverImage: '',
        logoLight: '', // For Light Mode
        logoDark: ''   // For Dark Mode
    });

    const t = {
        ar: {
            loading: "جاري التحميل...",
            upload_error: "حدث خطأ أثناء رفع الصورة",
            type_error: "عذراً، يجب أن يكون الملف صورة من نوع JPG أو PNG أو WebP",
            size_error: "عذراً، حجم الصورة كبير جداً. يجب أن يكون أقل من 2 ميجابايت",
            save_success: "تم حفظ الصور بنجاح!",
            save_error: "حدث خطأ أثناء الحفظ",
            save_btn: "حفظ التغييرات",
            sections: {
                profile: {
                    title: "الصورة الشخصية للمتجر",
                    desc: "تظهر في صفحة تفاصيل المنتج (JPG/PNG)",
                    btn: "تغيير الصورة الشخصية"
                },
                cover: {
                    title: "غلاف المتجر",
                    desc: "تظهر كبانر عريض في الصفحة الرئيسية (JPG/PNG)",
                    btn: "تغيير غلاف المتجر"
                },
                logo: {
                    title: "شعار المتجر (اللوجو)",
                    desc: "يظهر في القائمة العلوية وفي تبويب المتصفح (Favicon). يرجى تعيين شعار للوضع النهاري وآخر للوضع الليلي.",
                    light: "شعار الوضع النهاري",
                    dark: "شعار الوضع الليلي",
                    upload_light: "رفع شعار فاتح",
                    upload_dark: "رفع شعار غامق"
                }
            }
        },
        en: {
            loading: "Loading...",
            upload_error: "An error occurred while uploading the image",
            type_error: "Sorry, the file must be an image of type JPG, PNG or WebP",
            size_error: "Sorry, the image size is too large. It must be less than 2MB",
            save_success: "Images saved successfully!",
            save_error: "An error occurred while saving",
            save_btn: "Save Changes",
            sections: {
                profile: {
                    title: "Store Profile Picture",
                    desc: "Appears on the product details page (JPG/PNG)",
                    btn: "Change Profile Picture"
                },
                cover: {
                    title: "Store Cover",
                    desc: "Appears as a wide banner on the home page (JPG/PNG)",
                    btn: "Change Store Cover"
                },
                logo: {
                    title: "Store Logo",
                    desc: "Appears in the top menu and in the browser tab (Favicon). Please set a logo for day mode and another for night mode.",
                    light: "Day Mode Logo",
                    dark: "Night Mode Logo",
                    upload_light: "Upload Light Logo",
                    upload_dark: "Upload Dark Logo"
                }
            }
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    const fileInputRef = {
        profile: useRef(null),
        cover: useRef(null),
        logoLight: useRef(null),
        logoDark: useRef(null)
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
                    logoLight: data.logoLight || data.logoImage || '', // Migration fallback
                    logoDark: data.logoDark || data.logoImage || ''     // Migration fallback
                });
            }
        } catch (error) {
            console.error("Error fetching images:", error);
        } finally {
            setLoading(false);
        }
    };

    const uploadToCloudinary = async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        formData.append("cloud_name", cloudName);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.secure_url) {
                return data.secure_url;
            } else {
                throw new Error("Cloudinary Upload Failed");
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            alert(txt.upload_error);
            return null;
        }
    };

    const validateFile = (file) => {
        // 1. Valid Types
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            alert(txt.type_error);
            return false;
        }

        // 2. Size Limit (2MB)
        const maxSize = 2 * 1024 * 1024; // 2MB
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
            const imageUrl = await uploadToCloudinary(file);
            if (imageUrl) {
                const newImages = { ...images, [type]: imageUrl };
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
                            disabled={uploading.profile}
                            className="bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {uploading.profile ? <Loader2 className="animate-spin" size={16} /> : null}
                            {txt.sections.profile.btn}
                        </button>

                        <div className="w-32 h-32 rounded-full p-1 bg-black overflow-hidden relative group">
                            <img
                                src={images.profileImage || "/logo.jpg"}
                                alt="Profile"
                                className="w-full h-full object-cover rounded-full"
                                onError={(e) => e.target.src = "/logo.jpg"}
                            />
                            {uploading.profile && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Store Cover */}
                <div className="flex flex-col md:flex-row gap-8 items-start justify-between border-b border-gray-100 pb-12">
                    <div className="w-full md:w-1/3">
                        <h3 className="text-lg font-black text-gray-800 mb-2">{txt.sections.cover.title}</h3>
                        <p className="text-gray-400 text-xs font-bold">{txt.sections.cover.desc}</p>
                    </div>

                    <div className="flex flex-col items-center gap-4 w-full md:w-2/3">
                        <input
                            type="file"
                            ref={fileInputRef.cover}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'coverImage')}
                        />
                        <button
                            onClick={() => fileInputRef.cover.current.click()}
                            disabled={uploading.cover}
                            className="bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end md:self-auto"
                        >
                            {uploading.cover ? <Loader2 className="animate-spin" size={16} /> : null}
                            {txt.sections.cover.btn}
                        </button>

                        <div className="w-full h-40 md:h-52 rounded-2xl bg-black overflow-hidden relative group border border-gray-100">
                            <img
                                src={images.coverImage || "/banner.jpeg"}
                                alt="Cover"
                                className="w-full h-full object-cover"
                                onError={(e) => e.target.src = "/banner.jpeg"}
                            />
                            {uploading.cover && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Store Logo (Dual Theme) */}
                <div className="flex flex-col gap-8">
                    <div className="w-full border-b border-gray-100 pb-4">
                        <h3 className="text-lg font-black text-gray-800 mb-2">{txt.sections.logo.title}</h3>
                        <p className="text-gray-400 text-xs font-bold">{txt.sections.logo.desc}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Light Mode Logo */}
                        <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 rounded-[24px] border-2 border-dashed border-gray-200">
                            <div className="flex items-center gap-2 text-gray-700 font-bold mb-2">
                                <Sun size={20} className="text-orange-500" />
                                <span>{txt.sections.logo.light}</span>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef.logoLight}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'logoLight')}
                            />

                            <div className="w-32 h-32 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                                <img
                                    src={images.logoLight || "/nav-logo-light.png"}
                                    alt="Light Logo"
                                    className="max-w-full max-h-full object-contain p-2"
                                    onError={(e) => e.target.src = "/nav-logo-light.png"}
                                />
                                {uploading.logoLight && (
                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
                                        <Loader2 className="animate-spin text-blue-500" size={24} />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => fileInputRef.logoLight.current.click()}
                                disabled={uploading.logoLight}
                                className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors w-full"
                            >
                                {txt.sections.logo.upload_light}
                            </button>
                        </div>

                        {/* Dark Mode Logo */}
                        <div className="flex flex-col items-center gap-4 p-6 bg-[#1a1d23] rounded-[24px] border-2 border-dashed border-gray-700">
                            <div className="flex items-center gap-2 text-white font-bold mb-2">
                                <Moon size={20} className="text-blue-400" />
                                <span>{txt.sections.logo.dark}</span>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef.logoDark}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'logoDark')}
                            />

                            <div className="w-32 h-32 flex items-center justify-center bg-[#2a2e35] rounded-2xl shadow-sm border border-gray-700 relative overflow-hidden">
                                <img
                                    src={images.logoDark || "/nav-logo.png"}
                                    alt="Dark Logo"
                                    className="max-w-full max-h-full object-contain p-2"
                                    onError={(e) => e.target.src = "/nav-logo.png"}
                                />
                                {uploading.logoDark && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                                        <Loader2 className="animate-spin text-white" size={24} />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => fileInputRef.logoDark.current.click()}
                                disabled={uploading.logoDark}
                                className="bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl font-bold text-xs hover:bg-white/20 transition-colors w-full"
                            >
                                {txt.sections.logo.upload_dark}
                            </button>
                        </div>
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
