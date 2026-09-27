import React, { useState, useEffect } from 'react';
import { Save, ChevronLeft, Info } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const StoreInterfaceSettings = ({ onBack, lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        lastSeen: true,
        hideOutOfStock: false,
        hideSKU: false,
        hideExtraOptions: false,
        showCountryFlag: true,
        showOffersSection: false,
        showCategories: true,
        productSharing: true,
        contactForm: true
    });

    const t = {
        ar: {
            loading: "جاري التحميل...",
            save_success: "تم حفظ الإعدادات بنجاح!",
            save_error: "حدث خطأ أثناء الحفظ",
            saving: "جاري الحفظ...",
            save: "حفظ",
            interface: {
                lastSeen: {
                    title: "آخر ظهور لك في واجهة المتجر",
                    desc: "يعرض حالتك في المتجر مثل متصل الآن أو آخر ظهور قبل مدة محددة."
                },
                hideOutOfStock: {
                    title: "إخفاء المنتجات عند نفاد المخزون",
                    desc: "إخفاء المنتجات تلقائياً من المتجر عند انتهاء الكمية المتوفرة."
                },
                hideSKU: {
                    title: "إخفاء رمز المنتج",
                    desc: "إزالة عرض رمز المنتج (SKU) من صفحة تفاصيل المنتج في المتجر."
                },
                hideExtraOptions: {
                    title: "إخفاء الخيارات الإضافية عند نفاد المخزون",
                    desc: "عند نفاد مخزون أي خيار أو لون، سيتم إخفاؤه من صورته من صفحة المنتج تلقائياً."
                },
                showCountryFlag: {
                    title: "علم الدولة",
                    desc: "عرض علم الدولة من الصفحة الرئيسية للمتجر."
                },
                showOffersSection: {
                    title: "قسم العروض والخصومات",
                    desc: "عرض قسم العروض والخصومات من الصفحة الرئيسية للمتجر."
                },
                showCategories: {
                    title: "أقسام المتجر",
                    desc: "عرض جميع كتالوجات المتجر في الصفحة الرئيسية داخل بطاقات صغيرة."
                },
                productSharing: {
                    title: "مشاركة المنتج",
                    desc: "تمكن مشاركة صور المنتج وفيديو ورابطه بسهولة عبر زر المشاركة."
                },
                contactForm: {
                    title: "نموذج التواصل",
                    desc: 'سيتم عرض نموذج التواصل داخل صفحة "تواصل معنا" الخاصة بمتجرك.'
                }
            }
        },
        en: {
            loading: "Loading...",
            save_success: "Settings saved successfully!",
            save_error: "Error saving settings",
            saving: "Saving...",
            save: "Save",
            interface: {
                lastSeen: {
                    title: "Your Last Seen in Store Front",
                    desc: "Displays your status in the store like Online now or last seen some time ago."
                },
                hideOutOfStock: {
                    title: "Hide Out of Stock Products",
                    desc: "Automatically hide products from the store when the available quantity is zero."
                },
                hideSKU: {
                    title: "Hide Product SKU",
                    desc: "Remove the product SKU (code) from the product details page in the store."
                },
                hideExtraOptions: {
                    title: "Hide Extra Options When Out of Stock",
                    desc: "When an option or color is out of stock, it will be automatically hidden from the product page."
                },
                showCountryFlag: {
                    title: "Country Flag",
                    desc: "Display the country flag on the store's home page."
                },
                showOffersSection: {
                    title: "Offers and Discounts Section",
                    desc: "Display the offers and discounts section on the store's home page."
                },
                showCategories: {
                    title: "Store Categories",
                    desc: "Display all store categories on the home page inside small cards."
                },
                productSharing: {
                    title: "Product Sharing",
                    desc: "Enable sharing product images, video, and link easily via the share button."
                },
                contactForm: {
                    title: "Contact Form",
                    desc: 'The contact form will be displayed inside the "Contact Us" page of your store.'
                }
            }
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "interface");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleToggle = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "interface"), settings);
            alert(txt.save_success);
        } catch (error) {
            console.error("Error saving settings:", error);
            alert(txt.save_error);
        } finally {
            setSaving(false);
        }
    };

    const ToggleCard = ({ title, description, checked, onChange }) => (
        <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        {title}
                        <Info size={14} className="text-blue-500" />
                    </h3>
                </div>
                <p className="text-gray-400 text-xs font-bold leading-relaxed">{description}</p>
            </div>
            <div className={`flex mt-2 ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <button
                    onClick={onChange}
                    className={`w-12 h-7 rounded-full transition-colors relative ${checked ? 'bg-pink-500' : 'bg-gray-200'}`}
                >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm ${checked ? (isRTL ? 'left-1' : 'right-1') : (isRTL ? 'right-1' : 'left-1')}`} />
                </button>
            </div>
        </div>
    );

    if (loading) return <div className="p-8 text-center text-gray-500">{txt.loading}</div>;

    return (
        <div className="space-y-6 animate-fade-in font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header managed by SettingsView */}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ToggleCard
                    title={txt.interface.lastSeen.title}
                    description={txt.interface.lastSeen.desc}
                    checked={settings.lastSeen}
                    onChange={() => handleToggle('lastSeen')}
                />
                <ToggleCard
                    title={txt.interface.hideOutOfStock.title}
                    description={txt.interface.hideOutOfStock.desc}
                    checked={settings.hideOutOfStock}
                    onChange={() => handleToggle('hideOutOfStock')}
                />
                <ToggleCard
                    title={txt.interface.hideSKU.title}
                    description={txt.interface.hideSKU.desc}
                    checked={settings.hideSKU}
                    onChange={() => handleToggle('hideSKU')}
                />
                <ToggleCard
                    title={txt.interface.hideExtraOptions.title}
                    description={txt.interface.hideExtraOptions.desc}
                    checked={settings.hideExtraOptions}
                    onChange={() => handleToggle('hideExtraOptions')}
                />
                <ToggleCard
                    title={txt.interface.showCountryFlag.title}
                    description={txt.interface.showCountryFlag.desc}
                    checked={settings.showCountryFlag}
                    onChange={() => handleToggle('showCountryFlag')}
                />
                <ToggleCard
                    title={txt.interface.showOffersSection.title}
                    description={txt.interface.showOffersSection.desc}
                    checked={settings.showOffersSection}
                    onChange={() => handleToggle('showOffersSection')}
                />
                <ToggleCard
                    title={txt.interface.showCategories.title}
                    description={txt.interface.showCategories.desc}
                    checked={settings.showCategories}
                    onChange={() => handleToggle('showCategories')}
                />
                <ToggleCard
                    title={txt.interface.productSharing.title}
                    description={txt.interface.productSharing.desc}
                    checked={settings.productSharing}
                    onChange={() => handleToggle('productSharing')}
                />
                <ToggleCard
                    title={txt.interface.contactForm.title}
                    description={txt.interface.contactForm.desc}
                    checked={settings.contactForm}
                    onChange={() => handleToggle('contactForm')}
                />
            </div>

            <div className={`pt-6 border-t border-gray-100 flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-10 py-3 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                    {saving ? txt.saving : (
                        <>
                            <Save size={18} />
                            <span>{txt.save}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default StoreInterfaceSettings;
