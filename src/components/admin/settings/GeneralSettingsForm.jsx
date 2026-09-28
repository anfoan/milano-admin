import React, { useState, useEffect, useRef } from 'react';
import { Save, AlertCircle, MapPin, ChevronLeft, Plus, ChevronDown, Search, Globe } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const countries = [
    { name: 'Yemen', code: '+967', flag: 'ye' },
    { name: 'Saudi Arabia', code: '+966', flag: 'sa' },
    { name: 'Egypt', code: '+20', flag: 'eg' },
    { name: 'United Arab Emirates', code: '+971', flag: 'ae' },
    { name: 'Kuwait', code: '+965', flag: 'kw' },
    { name: 'Qatar', code: '+974', flag: 'qa' },
    { name: 'Bahrain', code: '+973', flag: 'bh' },
    { name: 'Oman', code: '+968', flag: 'om' },
    { name: 'Jordan', code: '+962', flag: 'jo' },
    { name: 'Iraq', code: '+964', flag: 'iq' },
    { name: 'Lebanon', code: '+961', flag: 'lb' },
    { name: 'Palestine', code: '+970', flag: 'ps' },
    { name: 'Syria', code: '+963', flag: 'sy' },
    { name: 'Sudan', code: '+249', flag: 'sd' },
    { name: 'Libya', code: '+218', flag: 'ly' },
    { name: 'Tunisia', code: '+216', flag: 'tn' },
    { name: 'Algeria', code: '+213', flag: 'dz' },
    { name: 'Morocco', code: '+212', flag: 'ma' },
    { name: 'USA', code: '+1', flag: 'us' },
    { name: 'UK', code: '+44', flag: 'gb' },
    { name: 'China', code: '+86', flag: 'cn' },
    { name: 'Turkey', code: '+90', flag: 'tr' }
];

const GeneralSettingsForm = ({ onBack, lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        storeLocation: 'Yemen',
        currency: 'YER',
        storeName: '',
        storeDescription: '',
        storeAddress: '',
        phoneNumber: '',
        countryCode: '+967', // Default
        countryFlag: 'ye',   // Default
        googleMapLink: '',
        storeUrl: ''
    });
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const countryDropdownRef = useRef(null);

    const t = {
        ar: {
            title: "الإعدادات العامة",
            subtitle: "إدارة بيانات وموقع المتجر الأساسية",
            save: "حفظ",
            saving: "جاري الحفظ...",
            success: "تم حفظ الإعدادات بنجاح!",
            error: "حدث خطأ أثناء الحفظ",
            validation: {
                name_required: "اسم النشاط التجاري مطلوب",
                phone_invalid: "رقم الهاتف غير صالح. يرجى استخدام الأرقام فقط",
                map_invalid: "رابط الخريطة غير صالح. يجب أن يبدأ بـ http أو https"
            },
            labels: {
                location: "موقع المتجر",
                currency: "عملة المتجر",
                name: "اسم النشاط التجاري",
                desc: "وصف المتجر",
                address: "عنوان متجرك",
                phone: "رقم الهاتف",
                map: "رابط موقع المتجر Google Map",
                storeUrl: "رابط المتجر (الدومين الخاص)"
            },
            placeholders: {
                name: "مثال: متجر ميلانو",
                desc: "متجر ميلانو لجميع المستلزمات الرياضية...",
                address: "اليمن - صنعاء - شميله شارع السفينه...",
                phone: "77xxxxxxx",
                map: "https://maps.app.goo.gl/..."
            },
            currencies: {
                yer: "ريال يمني (YER)",
                sar: "ريال سعودي (SAR)",
                usd: "دولار أمريكي (USD)"
            }
        },
        en: {
            title: "General Settings",
            subtitle: "Manage basic store details and location",
            save: "Save",
            saving: "Saving...",
            success: "Settings saved successfully!",
            error: "Error saving settings",
            validation: {
                name_required: "Business name is required",
                phone_invalid: "Invalid phone number. Please use digits only",
                map_invalid: "Invalid map link. It must start with http or https"
            },
            labels: {
                location: "Store Location",
                currency: "Store Currency",
                name: "Business Name",
                desc: "Store Description",
                address: "Store Address",
                phone: "Phone Number",
                map: "Google Map Link",
                storeUrl: "Store URL (Custom Domain)"
            },
            placeholders: {
                name: "Ex: Milano Store",
                desc: "Milano store for all sports achievements...",
                address: "Yemen - Sana'a...",
                phone: "77xxxxxxx",
                map: "https://maps.app.goo.gl/...",
                storeUrl: "https://yourdomain.com"
            },
            currencies: {
                yer: "Yemeni Rial (YER)",
                sar: "Saudi Riyal (SAR)",
                usd: "US Dollar (USD)"
            }
        }
    };

    const countries = [
        { name: lang === 'ar' ? 'اليمن' : 'Yemen', code: '+967', flag: 'ye' },
        { name: lang === 'ar' ? 'السعودية' : 'Saudi Arabia', code: '+966', flag: 'sa' },
        { name: lang === 'ar' ? 'مصر' : 'Egypt', code: '+20', flag: 'eg' },
        { name: lang === 'ar' ? 'الإمارات' : 'United Arab Emirates', code: '+971', flag: 'ae' },
        { name: lang === 'ar' ? 'الكويت' : 'Kuwait', code: '+965', flag: 'kw' },
        { name: lang === 'ar' ? 'قطر' : 'Qatar', code: '+974', flag: 'qa' },
        { name: lang === 'ar' ? 'البحرين' : 'Bahrain', code: '+973', flag: 'bh' },
        { name: lang === 'ar' ? 'سلطنة عمان' : 'Oman', code: '+968', flag: 'om' },
        { name: lang === 'ar' ? 'الأردن' : 'Jordan', code: '+962', flag: 'jo' },
        { name: lang === 'ar' ? 'العراق' : 'Iraq', code: '+964', flag: 'iq' },
        { name: lang === 'ar' ? 'لبنان' : 'Lebanon', code: '+961', flag: 'lb' },
        { name: lang === 'ar' ? 'فلسطين' : 'Palestine', code: '+970', flag: 'ps' },
        { name: lang === 'ar' ? 'سوريا' : 'Syria', code: '+963', flag: 'sy' },
        { name: lang === 'ar' ? 'السودان' : 'Sudan', code: '+249', flag: 'sd' },
        { name: lang === 'ar' ? 'ليبيا' : 'Libya', code: '+218', flag: 'ly' },
        { name: lang === 'ar' ? 'تونس' : 'Tunisia', code: '+216', flag: 'tn' },
        { name: lang === 'ar' ? 'الجزائر' : 'Algeria', code: '+213', flag: 'dz' },
        { name: lang === 'ar' ? 'المغرب' : 'Morocco', code: '+212', flag: 'ma' },
        { name: lang === 'ar' ? 'امريكا' : 'USA', code: '+1', flag: 'us' },
        { name: lang === 'ar' ? 'بريطانيا' : 'UK', code: '+44', flag: 'gb' },
        { name: lang === 'ar' ? 'الصين' : 'China', code: '+86', flag: 'cn' },
        { name: lang === 'ar' ? 'تركيا' : 'Turkey', code: '+90', flag: 'tr' }
    ];

    const txt = t[lang];
    const isRTL = lang === 'ar';

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
                setIsCountryOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCountries = countries.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.includes(countrySearch)
    );

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "general");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setFormData(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Basic phone number validation (allow only digits, +, -, and spaces for phone field)
        if (name === 'phoneNumber' && value && !/^[\d\+\-\s]*$/.test(value)) {
            return;
        }
        setFormData({ ...formData, [name]: value });
    };

    const validateForm = () => {
        if (!formData.storeName.trim()) {
            alert(txt.validation.name_required);
            return false;
        }
        if (formData.googleMapLink && !formData.googleMapLink.startsWith('http')) {
            alert(txt.validation.map_invalid);
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "general"), formData);
            alert(txt.success);
        } catch (error) {
            console.error("Error saving settings:", error);
            alert(txt.error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>;

    return (
        <div className="space-y-6 animate-fade-in" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header managed by SettingsView */}

            <div className="bg-white p-8 rounded-[24px] border border-gray-100 shadow-sm">

                {/* Form Header */}
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-50">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800">{txt.title}</h2>
                        <p className="text-gray-400 text-sm mt-1 font-bold">{txt.subtitle}</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        {saving ? txt.saving : (
                            <>
                                <Save size={18} />
                                <span>{txt.save}</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Store Location */}
                    <div className="space-y-2">
                        <label className="text-sm font-black text-gray-700 block">{txt.labels.location}</label>
                        <select
                            name="storeLocation"
                            value={formData.storeLocation}
                            onChange={(e) => {
                                const selected = countries.find(c => c.name === e.target.value);
                                setFormData(prev => ({ ...prev, storeLocation: e.target.value, countryFlag: selected?.flag || prev.countryFlag, countryCode: selected?.code || prev.countryCode }));
                            }}
                            className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors appearance-none font-bold text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                            {countries.map(c => (
                                <option key={c.code} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Store Currency */}
                    <div className="space-y-2">
                        <label className="text-sm font-black text-gray-700 block">{txt.labels.currency}</label>
                        <select
                            name="currency"
                            value={formData.currency}
                            onChange={handleChange}
                            className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors appearance-none font-bold text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                            <option value="YER">{txt.currencies.yer}</option>
                            <option value="SAR">{txt.currencies.sar}</option>
                            <option value="USD">{txt.currencies.usd}</option>
                        </select>
                    </div>

                    {/* Store Name - Full Width */}
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-black text-gray-700 block">{txt.labels.name}</label>
                        <input
                            type="text"
                            name="storeName"
                            maxLength={100}
                            value={formData.storeName}
                            onChange={handleChange}
                            placeholder={txt.placeholders.name}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>

                    {/* Description - Full Width */}
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-black text-gray-700 block">{txt.labels.desc}</label>
                        <textarea
                            name="storeDescription"
                            maxLength={500}
                            value={formData.storeDescription}
                            onChange={handleChange}
                            rows={3}
                            placeholder={txt.placeholders.desc}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
                        />
                    </div>

                    {/* Address - Full Width */}
                    <div className="md:col-span-2 space-y-2 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                        <h3 className="font-black text-gray-800 mb-4 text-lg">{txt.labels.address}</h3>
                        <textarea
                            name="storeAddress"
                            maxLength={200}
                            value={formData.storeAddress}
                            onChange={handleChange}
                            rows={2}
                            placeholder={txt.placeholders.address}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors resize-none mb-4"
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-600 block">{txt.labels.phone}</label>
                            <div className="flex bg-white border border-gray-200 rounded-xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all relative">
                                <input
                                    type="text"
                                    name="phoneNumber"
                                    maxLength={20}
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                    placeholder={txt.placeholders.phone}
                                    dir="ltr"
                                    className={`flex-1 px-4 py-3 focus:outline-none font-mono text-sm text-right ${isRTL ? 'rounded-r-xl' : 'rounded-l-xl order-last'}`}
                                />

                                <div className={`relative border-l border-gray-200 ${!isRTL ? 'border-r border-l-0' : ''}`} ref={countryDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsCountryOpen(!isCountryOpen)}
                                        className={`h-full px-3 flex items-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors min-w-[100px] justify-center ${isRTL ? 'rounded-l-xl' : 'rounded-r-xl'}`}
                                    >
                                        <ChevronDown size={14} className="text-gray-400" />
                                        <span className="font-mono text-sm font-bold text-gray-700 dir-ltr">{formData.countryCode}</span>
                                        <img src={`https://flagcdn.com/w40/${formData.countryFlag}.png`} className="w-6 object-cover rounded-sm shadow-sm" alt={formData.countryCode} />
                                    </button>

                                    {isCountryOpen && (
                                        <div className={`absolute bottom-full mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${isRTL ? 'left-0' : 'right-0'}`}>
                                            <div className="p-2 border-b border-gray-50 sticky top-0 bg-white">
                                                <div className="relative">
                                                    <Search size={14} className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRTL ? 'left-3' : 'right-3'}`} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search..."
                                                        value={countrySearch}
                                                        onChange={(e) => setCountrySearch(e.target.value)}
                                                        className={`w-full py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${isRTL ? 'pl-9 pr-3' : 'pr-9 pl-3'}`}
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                {filteredCountries.map((country) => (
                                                    <button
                                                        key={country.name}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, countryCode: country.code, countryFlag: country.flag });
                                                            setIsCountryOpen(false);
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-blue-50 transition-colors group ${isRTL ? 'text-right' : 'text-left'}`}
                                                    >
                                                        <img src={`https://flagcdn.com/w40/${country.flag}.png`} className="w-6 object-cover rounded-sm shadow-sm" alt={country.name} />
                                                        <span className={`font-mono text-sm text-gray-500 w-12 ${isRTL ? 'text-left' : 'text-right'}`}>{country.code}</span>
                                                        <span className="text-sm font-bold text-gray-700 flex-1 group-hover:text-blue-600">{country.name}</span>
                                                    </button>
                                                ))}
                                                {filteredCountries.length === 0 && (
                                                    <div className="p-4 text-center text-gray-400 text-sm">No results found</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Google Map Link */}
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-black text-gray-700 flex justify-between items-center">
                            <span>{txt.labels.map}</span>
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <div className={`absolute inset-y-0 flex items-center pointer-events-none text-gray-400 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'}`}>
                                    <MapPin size={18} />
                                </div>
                                <input
                                    type="text"
                                    name="googleMapLink"
                                    maxLength={500}
                                    value={formData.googleMapLink}
                                    onChange={handleChange}
                                    placeholder={txt.placeholders.map}
                                    className={`w-full py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors dir-ltr placeholder:text-right ${isRTL ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'}`}
                                />
                            </div>
                            <button className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl w-12 flex items-center justify-center transition-colors">
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default GeneralSettingsForm;
