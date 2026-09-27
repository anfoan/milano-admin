import React, { useState, useEffect } from 'react';
import { Save, Loader2, ChevronUp, ChevronDown, GripVertical, CheckCircle2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion, Reorder, AnimatePresence } from 'framer-motion';

const SocialMediaView = ({ lang = 'ar' }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [links, setLinks] = useState({
        facebook: '',
        instagram: '',
        tiktok: '',
        whatsapp: '',
        googlemap: '',
        snapchat: '',
        youtube: '',
        twitter: ''
    });
    const [linkOrder, setLinkOrder] = useState([
        'whatsapp', 'instagram', 'tiktok', 'facebook', 'snapchat', 'youtube', 'twitter', 'googlemap'
    ]);

    const t = {
        ar: {
            title: "حسابات التواصل الاجتماعي",
            subtitle: "قم بإضافة الروابط وترتيبها (بالسحب أو بالأسهم) لتظهر في المتجر حسب رغبتك",
            save_btn: "حفظ التغييرات والترتيب",
            saving: "جاري الحفظ...",
            loading: "جاري تحميل البيانات...",
            success: "تم حفظ الروابط والترتيب بنجاح!",
            error: "حدث خطأ أثناء الحفظ",
            invalid_url: "يرجى إدخال رابط صالح (يجب أن يبدأ بـ http أو https)",
            move_up: "تحريك للأعلى",
            move_down: "تحريك للأسفل",
            active: "نشط",
            labels: {
                facebook: "فيسبوك",
                instagram: "انستجرام",
                tiktok: "تيك توك",
                whatsapp: "واتساب",
                googlemap: "رابط الخريطة (Google Map)",
                snapchat: "سناب شات",
                youtube: "يوتيوب",
                twitter: "منصة X (تويتر سابقاً)"
            }
        },
        en: {
            title: "Social Media Accounts",
            subtitle: "Add and reorder links (drag or arrows) to appear in store as you wish",
            save_btn: "Save Changes & Order",
            saving: "Saving...",
            loading: "Loading data...",
            success: "Links and order saved successfully!",
            error: "An error occurred while saving",
            invalid_url: "Please enter a valid link (must start with http or https)",
            move_up: "Move Up",
            move_down: "Move Down",
            active: "Active",
            labels: {
                facebook: "Facebook",
                instagram: "Instagram",
                tiktok: "TikTok",
                whatsapp: "WhatsApp",
                googlemap: "Map Link (Google Map)",
                snapchat: "Snapchat",
                youtube: "YouTube",
                twitter: "X (Twitter)"
            }
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    const iconMap = {
        facebook: "https://b3na.com/Store-assets/img/Facebook.webp",
        instagram: "https://b3na.com/Store-assets/img/Instagram.webp",
        tiktok: "https://b3na.com/Store-assets/img/Tiktok.webp",
        whatsapp: "https://b3na.com/Store-assets/img/Whatsapp.webp",
        snapchat: "https://b3na.com/Store-assets/img/Snapchat.webp",
        youtube: "https://b3na.com/Store-assets/img/Youtube.webp",
        twitter: "/twitter.png",
        googlemap: "https://b3na.com/Store-assets/img/GoogleMap.webp"
    };

    useEffect(() => {
        const fetchLinks = async () => {
            try {
                const docRef = doc(db, "settings", "social_links");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const { linkOrder: savedOrder, ...savedLinks } = data;
                    setLinks(prev => ({ ...prev, ...savedLinks }));
                    if (savedOrder && Array.isArray(savedOrder)) {
                        const currentIds = ['whatsapp', 'instagram', 'tiktok', 'facebook', 'snapchat', 'youtube', 'twitter', 'googlemap'];
                        const mergedOrder = [...savedOrder];
                        currentIds.forEach(id => {
                            if (!mergedOrder.includes(id)) mergedOrder.push(id);
                        });
                        setLinkOrder(mergedOrder.filter(id => currentIds.includes(id)));
                    }
                }
            } catch (error) {
                console.error("Error fetching links:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLinks();
    }, []);

    const handleChange = (e) => {
        setLinks({ ...links, [e.target.name]: e.target.value });
    };

    const moveItem = (index, direction) => {
        const newOrder = [...linkOrder];
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= newOrder.length) return;
        
        const temp = newOrder[index];
        newOrder[index] = newOrder[nextIndex];
        newOrder[nextIndex] = temp;
        setLinkOrder(newOrder);
    };

    const handleSave = async () => {
        for (const value of Object.values(links)) {
            if (value && typeof value === 'string' && !value.startsWith('http')) {
                alert(txt.invalid_url);
                return;
            }
        }

        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "social_links"), {
                ...links,
                linkOrder: linkOrder
            });
            alert(txt.success);
        } catch (error) {
            console.error("Error saving links:", error);
            alert(txt.error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500 font-bold">{txt.loading}</div>;

    return (
        <div className="space-y-6 font-['Cairo'] pb-20" dir={isRTL ? "rtl" : "ltr"}>
            <div className="bg-white p-6 md:p-8 rounded-[24px] border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h2 className="text-xl font-black text-gray-800">{txt.title}</h2>
                        <p className="text-gray-400 text-sm mt-1 font-bold">{txt.subtitle}</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 text-white px-8 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        <span>{saving ? txt.saving : txt.save_btn}</span>
                    </button>
                </div>

                <Reorder.Group axis="y" values={linkOrder} onReorder={setLinkOrder} className="space-y-4">
                    {linkOrder.map((id, index) => (
                        <Reorder.Item 
                            key={id} 
                            value={id}
                            className="bg-gray-50/50 hover:bg-white border border-gray-100 hover:border-blue-200 rounded-2xl p-4 transition-all shadow-sm active:shadow-md cursor-default flex items-center gap-4"
                        >
                            {/* Drag Handle */}
                            <div className="text-gray-300 cursor-grab active:cursor-grabbing p-1 hover:text-gray-400 transition-colors">
                                <GripVertical size={22} />
                            </div>

                            {/* Icon & Label & Status */}
                            <div className="flex items-center gap-3 min-w-[160px]">
                                <div className="relative">
                                    <div className="w-10 h-10 bg-white rounded-xl border border-gray-100 p-2 flex items-center justify-center shadow-sm">
                                        <img src={iconMap[id]} alt={txt.labels[id]} className="w-full h-full object-contain" />
                                    </div>
                                    {links[id] && (
                                        <div className="absolute -top-1 -right-1">
                                            <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse shadow-sm"></div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-700 text-sm">{txt.labels[id]}</span>
                                    {links[id] && <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">{txt.active}</span>}
                                </div>
                            </div>

                            {/* Input Area */}
                            <div className="flex-1">
                                <input
                                    type="text"
                                    name={id}
                                    value={links[id] || ''}
                                    onChange={handleChange}
                                    placeholder={`https://${id}.com/...`}
                                    className="w-full py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-left dir-ltr font-mono text-sm px-4"
                                />
                            </div>

                            {/* Arrow Controls (Backup) */}
                            <div className="flex flex-col gap-0">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); moveItem(index, 'up'); }}
                                    disabled={index === 0}
                                    className="p-1 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 disabled:opacity-20 transition-colors"
                                >
                                    <ChevronUp size={20} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); moveItem(index, 'down'); }}
                                    disabled={index === linkOrder.length - 1}
                                    className="p-1 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 disabled:opacity-20 transition-colors"
                                >
                                    <ChevronDown size={20} />
                                </button>
                            </div>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </div>
        </div>
    );
};

export default SocialMediaView;
