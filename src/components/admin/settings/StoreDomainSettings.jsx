import React, { useState, useEffect } from 'react';
import { Save, Globe, Info, ExternalLink, Link2, CheckCircle } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DEFAULT_STORE_URL, normalizeStoreUrl } from '../../../lib/storeUrl';

const StoreDomainSettings = ({ lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [storeUrl, setStoreUrl] = useState('');

    const t = {
        ar: {
            title: "إعدادات النطاق (Domain)",
            subtitle: "ربط وإدارة عنوان متجرك على الإنترنت",
            save: "حفظ التغييرات",
            saving: "جاري الحفظ...",
            success: "تم حفظ الإعدادات بنجاح!",
            error: "حدث خطأ أثناء الحفظ",
            current_domain: "الدومين الحالي للمتجر",
            placeholder: "https://www.yourdomain.com",
            hint: "هذا الرابط سيتم استخدامه لإنشاء QR كود المتجر، وفي روابط تتبع الطلبات، وفي بيانات الـ SEO ومشاركة المنتجات.",
            important: "تأكد من كتابة الرابط كاملاً مع https://",
            verify_title: "حالة الربط",
            verify_text: "المتجر يعمل الآن على هذا النطاق"
        },
        en: {
            title: "Domain Settings",
            subtitle: "Manage your store's web address",
            save: "Save Changes",
            saving: "Saving...",
            success: "Settings saved successfully!",
            error: "Error saving settings",
            current_domain: "Current Store Domain",
            placeholder: "https://www.yourdomain.com",
            hint: "This link will be used to generate the store QR code, in order tracking links, SEO metadata, and product sharing.",
            important: "Make sure to include https:// in the URL",
            verify_title: "Link Status",
            verify_text: "The store is now active on this domain"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "general");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setStoreUrl(normalizeStoreUrl(docSnap.data().storeUrl || DEFAULT_STORE_URL));
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        if (storeUrl && !storeUrl.startsWith('http')) {
            alert(lang === 'ar' ? 'يجب أن يبدأ الرابط بـ http أو https' : 'URL must start with http or https');
            return;
        }

        setSaving(true);
        try {
            const docRef = doc(db, "settings", "general");
            const docSnap = await getDoc(docRef);
            const currentData = docSnap.exists() ? docSnap.data() : {};
            
            const nextStoreUrl = normalizeStoreUrl(storeUrl || DEFAULT_STORE_URL);
            await setDoc(docRef, { ...currentData, storeUrl: nextStoreUrl });
            setStoreUrl(nextStoreUrl);
            alert(txt.success);
        } catch (error) {
            console.error("Error saving domain:", error);
            alert(txt.error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 font-bold">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>;

    return (
        <div className="space-y-6 animate-fade-in" dir={isRTL ? "rtl" : "ltr"}>
            <div className="bg-white p-8 rounded-[24px] border border-gray-100 shadow-sm">
                
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-50">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                            <Globe className="text-blue-500" size={28} />
                            {txt.title}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1 font-bold">{txt.subtitle}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Side: Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-700 block">{txt.current_domain}</label>
                            <div className="relative group">
                                <div className={`absolute inset-y-0 flex items-center pointer-events-none text-gray-400 ${isRTL ? 'right-0 pr-4' : 'left-0 pl-4'}`}>
                                    <Link2 size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={storeUrl}
                                    onChange={(e) => setStoreUrl(e.target.value)}
                                    placeholder={txt.placeholder}
                                    dir="ltr"
                                    className={`w-full py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-mono text-sm ${isRTL ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'}`}
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50 flex gap-4 items-start">
                            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                                <Info size={20} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-blue-800 font-bold leading-relaxed">{txt.hint}</p>
                                <p className="text-xs text-blue-500 font-black italic">{txt.important}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl hover:bg-blue-700 transition-all font-black shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            {saving ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    {txt.saving}
                                </span>
                            ) : (
                                <>
                                    <Save size={20} />
                                    <span>{txt.save}</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right Side: Status/Preview */}
                    <div className="lg:col-span-1 border-s border-gray-100 ps-8 hidden lg:block">
                        <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 text-center">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <CheckCircle size={32} />
                            </div>
                            <h4 className="font-black text-gray-800 mb-1">{txt.verify_title}</h4>
                            <p className="text-xs text-gray-400 font-bold mb-4">{txt.verify_text}</p>
                            
                            {storeUrl && (
                                <a 
                                    href={storeUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 font-black text-sm hover:underline"
                                >
                                    <span>{lang === 'ar' ? 'زيارة الموقع' : 'Visit Store'}</span>
                                    <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default StoreDomainSettings;
