import React, { useState, useEffect } from 'react';
import { Save, ArrowRight, Loader2, Mail, Users, Upload } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { uploadSettingsImage } from '../../../services/uploadService';

const OrderPageSettings = ({ onBack, lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [branding, setBranding] = useState({ adminTitle: 'إعدادات لوحة التحكم', adminImage: '/admin-new-icon.png', storeTitle: 'متجر ميلانو', storeImage: '/logo-rounded.png' });
    const [uploading, setUploading] = useState({ admin: false, store: false });

    const [settings, setSettings] = useState({
        emailStatus: 'hide', // 'show' or 'hide'
        maxDailyOrders: 3
    });

    const t = {
        ar: {
            title_email: "حالة البريد الإلكتروني عند الطلب",
            title_max_orders: "عدد الطلبات المسموح بها يومياً لكل شخص",
            save: "حفظ",
            saving: "جاري الحفظ...",
            success: "تم حفظ إعدادات صفحة الطلب بنجاح!",
            error: "حدث خطأ أثناء الحفظ",
            loading: "جاري التحميل...",
            options: {
                hide: "إخفاء",
                optional: "اختياري",
                required: "إلزامي"
            }
        },
        en: {
            title_email: "Email Field Status at Checkout",
            title_max_orders: "Max Daily Orders per Person",
            save: "Save",
            saving: "Saving...",
            success: "Order page settings saved successfully!",
            error: "An error occurred while saving",
            loading: "Loading...",
            options: {
                hide: "Hide",
                optional: "Optional",
                required: "Required"
            }
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "order");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }
                const brandingSnap = await getDoc(doc(db, 'settings', 'branding'));
                if (brandingSnap.exists()) setBranding(prev => ({ ...prev, ...brandingSnap.data() }));
            } catch (error) {
                console.error("Error fetching order settings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleBrandingChange = (key, value) => setBranding(prev => ({ ...prev, [key]: value }));

    const cropToSquare = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                // Zoom the centered square crop slightly so browser/tab icons
                // use the available square area instead of appearing too small.
                const size = Math.min(image.naturalWidth, image.naturalHeight) * 0.90;
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const context = canvas.getContext('2d');
                context.beginPath();
                context.roundRect(4, 4, 504, 504, 72);
                context.clip();
                context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 512, 512);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image crop failed')), 'image/png');
            };
            image.onerror = reject;
            image.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handleBrandingImage = async (event, key) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploading(prev => ({ ...prev, [key]: true }));
        try {
            const url = await uploadSettingsImage(await cropToSquare(file), `${key}-brand`);
            setBranding(prev => ({ ...prev, [`${key}Image`]: url }));
        } catch (error) {
            console.error('Brand image upload failed:', error);
            alert(isRTL ? 'تعذر رفع الصورة' : 'Unable to upload image');
        } finally {
            setUploading(prev => ({ ...prev, [key]: false }));
            event.target.value = '';
        }
    };

    const handleSave = async () => {
        // Validation: Ensure maxDailyOrders is at least 1
        if (settings.maxDailyOrders < 1) {
            setSettings(prev => ({ ...prev, maxDailyOrders: 1 }));
            return;
        }

        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "order"), settings);
            await setDoc(doc(db, 'settings', 'branding'), branding, { merge: true });
            await setDoc(doc(db, 'settings', 'general'), { storeName: branding.storeTitle, adminTitle: branding.adminTitle }, { merge: true });
            await setDoc(doc(db, 'settings', 'images'), { navLogo: branding.storeImage, adminImage: branding.adminImage }, { merge: true });
            alert(txt.success);
        } catch (error) {
            console.error("Error saving order settings:", error);
            alert(txt.error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64 text-gray-500">
            {txt.loading}
        </div>
    );

    return (
        <div className="space-y-6 font-['Cairo'] pb-20" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header managed by SettingsView */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[['admin', 'adminTitle', 'adminImage', isRTL ? 'إعدادات ميلانو' : 'Milano Settings', isRTL ? 'بيانات متصفح لوحة التحكم' : 'Dashboard browser data'], ['store', 'storeTitle', 'storeImage', isRTL ? 'متجر ميلانو' : 'Milano Store', isRTL ? 'بيانات متصفح المتجر' : 'Store browser data']].map(([key, titleKey, imageKey, heading, label]) => (
                        <div key={key} className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm">
                            <div className="mb-5 flex items-center gap-3"><img src={branding[imageKey]} onError={event => { event.currentTarget.src = key === 'admin' ? '/admin-new-icon.png' : '/logo-rounded.png'; }} className="h-10 w-10 rounded-xl object-cover" alt=""/><h3 className="font-black text-gray-800">{branding[titleKey] || heading}</h3></div>
                            <label className="mb-2 block text-sm font-bold text-gray-500">{label}</label>
                            <input value={branding[titleKey]} onChange={event => handleBrandingChange(titleKey, event.target.value)} className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-bold text-gray-900 outline-none focus:border-blue-500" />
                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 font-bold text-blue-700"><Upload size={17}/>{uploading[key] ? (isRTL ? 'جاري الرفع...' : 'Uploading...') : (isRTL ? 'تغيير الصورة' : 'Change image')}<input type="file" accept="image/*" className="hidden" onChange={event => handleBrandingImage(event, key)} /></label>
                        </div>
                    ))}
                </div>

                {/* Email Status */}
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className={`flex items-center gap-3 mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <Mail size={20} />
                        </div>
                        <h3 className="font-bold text-gray-800 text-base">{txt.title_email}</h3>
                    </div>

                    <div className="relative">
                        <select
                            value={settings.emailStatus}
                            onChange={(e) => handleChange('emailStatus', e.target.value)}
                            className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 font-bold text-gray-900 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer transition-colors ${isRTL ? 'text-right pl-10' : 'text-left pr-10'}`}
                        >
                            <option value="hide">{txt.options.hide}</option>
                            <option value="optional">{txt.options.optional}</option>
                            <option value="required">{txt.options.required}</option>
                        </select>
                        <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${isRTL ? 'left-4' : 'right-4'}`}>
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Max Daily Orders */}
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className={`flex items-center gap-3 mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <Users size={20} />
                        </div>
                        <h3 className="font-bold text-gray-800 text-base">{txt.title_max_orders}</h3>
                    </div>

                    <div className="relative">
                        <input
                            type="number"
                            min="1"
                            value={settings.maxDailyOrders}
                            onChange={(e) => handleChange('maxDailyOrders', Number(e.target.value))}
                            className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 font-bold text-gray-900 focus:outline-none focus:border-blue-500 transition-colors ${isRTL ? 'text-right' : 'text-left'}`}
                        />
                    </div>
                </div>

            </div>

            {/* Footer Save Button */}
            <div className={`flex mt-8 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-500 text-white px-12 py-3.5 rounded-xl font-black text-base shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {saving ? txt.saving : txt.save}
                </button>
            </div>
        </div>
    );
};

export default OrderPageSettings;
