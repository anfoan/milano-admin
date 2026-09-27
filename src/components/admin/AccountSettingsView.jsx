import React, { useState, useEffect } from 'react';
import { Settings, Lock, Shield, Clock, Trash2, Loader2, Check, AlertTriangle, Monitor, Smartphone, Globe, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, verifyBeforeUpdateEmail, updatePassword, deleteUser, sendEmailVerification, signOut, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { addAdminEmail } from '../../lib/adminEmails';
import { auth } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';

const AccountSettingsView = ({ lang = 'ar' }) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('general');

    // Forms State
    const [formData, setFormData] = useState({
        displayName: '',
        email: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Security / Sessions Data
    const [currentSession, setCurrentSession] = useState({
        ip: 'Loading...',
        os: 'Unknown Layout',
        browser: 'Unknown Browser',
        device: 'Desktop',
        location: 'Unknown Location'
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [visiblePasswordFields, setVisiblePasswordFields] = useState({ current: false, new: false, confirm: false });
    const [loginHistory, setLoginHistory] = useState([]); // Fixed: Defined loginHistory state

    // Initial Load & IP Fetch
    useEffect(() => {
        if (currentUser) {
            setFormData(prev => ({
                ...prev,
                displayName: currentUser.displayName || (lang === 'ar' ? 'متجر ميلانو' : 'Milano Store'),
                email: currentUser.email || ''
            }));
        }

        // Fetch IP and Session Info
        const fetchSessionInfo = async () => {
            try {
                // Mock IP Fetch (In real app, use a service)
                const res = await fetch('https://api.ipify.org?format=json');
                const data = await res.json();

                // Parse User Agent
                const ua = navigator.userAgent;
                let os = "Unknown OS";
                if (ua.indexOf("Win") !== -1) os = "Windows";
                if (ua.indexOf("Mac") !== -1) os = "MacOS";
                if (ua.indexOf("Linux") !== -1) os = "Linux";
                if (ua.indexOf("Android") !== -1) os = "Android";
                if (ua.indexOf("like Mac") !== -1) os = "iOS";

                let browser = "Unknown Browser";
                if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
                if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
                if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Safari";
                if (ua.indexOf("Edge") !== -1) browser = "Edge";

                const sessionData = {
                    id: Date.now(),
                    ip: data.ip,
                    os: os,
                    browser: browser,
                    device: /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop',
                    location: lang === 'ar' ? 'موقع غير معروف' : 'Unknown Location',
                    timestamp: new Date()
                };

                setCurrentSession(sessionData);
                setLoginHistory([sessionData]); // Add current session to history
            } catch (e) {
                console.error("Failed to fetch IP", e);
                setCurrentSession(prev => ({ ...prev, ip: 'Unavailable', location: txt.history.unknown_location }));
            }
        };

        fetchSessionInfo();

    }, [currentUser]);

    // Handlers
    const handleChange = (e) => {
        setMessage({ type: '', text: '' });
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setMessage({ type: '', text: '' });
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    // 1. General Save
    const t = {
        ar: {
            title: "إعدادات الحساب",
            tabs: {
                general: "عام",
                password: "تغيير كلمة المرور",
                security: "الأمان",
                history: "سجل تسجيل الدخول",
                delete: "حذف الحساب"
            },
            messages: {
                save_success: "تم حفظ التغييرات بنجاح",
                password_mismatch: "كلمات المرور غير متطابقة",
                password_short: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
                enter_current_password: "يرجى إدخال كلمة المرور الحالية",
                password_success: "تم تغيير كلمة المرور بنجاح",
                wrong_password: "كلمة المرور الحالية غير صحيحة",
                verification_sent: "تم إرسال رابط التفعيل إلى بريدك الإلكتروني",
                reset_sent: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني",
                email_change_sent: "اتبعث رسالة تأكيد إلى {email} — افتحها واضغط على الرابط جواها لإتمام تغيير البريد الإلكتروني",
                recent_login: "لأغراض أمنية، يرجى تسجيل الخروج والدخول مرة أخرى لإتمام هذا الإجراء.",
                error: "حدث خطأ: "
            },
            general: {
                display_name: "الاسم الكامل",
                email: "البريد الإلكتروني",
                verified: "موثق",
                save: "حفظ",
                change: "تغيير"
            },
            password: {
                title: "تغيير كلمة المرور",
                hint: "لضمان الحماية، يرجى إدخال كلمة المرور الحالية قبل تعيين كلمة مرور جديدة.",
                current: "كلمة المرور الحالية",
                new: "كلمة المرور الجديدة",
                confirm: "تأكيد كلمة المرور",
                update: "تحديث كلمة المرور",
                forgot: "نسيت كلمة المرور الحالية؟",
                reveal_hint: "لا يمكن لـ Firebase استرجاع كلمة المرور الحالية أو عرضها. يمكنك إظهار النص الذي أدخلته أو إرسال رابط إعادة تعيين جديد."
            },
            security: {
                status: "حالة الحساب",
                verified: "البريد الإلكتروني مفعل",
                not_verified: "البريد الإلكتروني غير مفعل",
                send_link: "إرسال رابط التفعيل",
                sending: "جاري الإرسال...",
                devices: "الأجهزة المتصلة",
                devices_hint: "يُظهر هذا القسم الجلسة الحالية النشطة.",
                current_device: "جهازك الحالي",
                logout: "تسجيل الخروج",
                os_browser: "النظام / المتصفح",
                login_time: "تسجيل الدخول",
                location: "الموقع"
            },
            history: {
                title: "سجل تسجيل الدخول",
                browser: "المتصفح",
                os: "النظام",
                device: "الجهاز",
                date: "التاريخ",
                ip: "الآي بي (IP)",
                mobile: "هاتف",
                desktop: "كمبيوتر",
                empty: "لا يوجد سجلات محفوظة بعد. سيتم تسجيل عمليات الدخول القادمة تلقائياً.",
                unknown_location: "موقع غير معروف",
                default_name: "متجر ميلانو"
            },
            delete: {
                title: "منطقة الخطر",
                hint: "حذف الحساب هو إجراء نهائي لا يمكن التراجع عنه. سيتم حذف جميع بياناتك ومنتجاتك.",
                btn: "حذف حسابي نهائياً",
                confirm_q: "هل أنت متأكد تماماً؟",
                confirm_btn: "نعم، احذف الحساب",
                deleting: "جاري الحذف...",
                cancel: "إلغاء"
            }
        },
        en: {
            title: "Account Settings",
            tabs: {
                general: "General",
                password: "Change Password",
                security: "Security",
                history: "Login History",
                delete: "Delete Account"
            },
            messages: {
                save_success: "Changes saved successfully",
                password_mismatch: "Passwords do not match",
                password_short: "Password must be at least 6 characters",
                enter_current_password: "Please enter your current password",
                password_success: "Password changed successfully",
                wrong_password: "Current password is incorrect",
                verification_sent: "Verification link sent to your email",
                reset_sent: "Password reset link sent to your email",
                email_change_sent: "A confirmation link was sent to {email} — open it and click the link inside to complete the email change",
                recent_login: "For security, please logout and login again to complete this action.",
                error: "Error: "
            },
            general: {
                display_name: "Full Name",
                email: "Email Address",
                verified: "Verified",
                save: "Save",
                change: "Change"
            },
            password: {
                title: "Change Password",
                hint: "To ensure protection, please enter your current password before setting a new one.",
                current: "Current Password",
                new: "New Password",
                confirm: "Confirm New Password",
                update: "Update Password",
                forgot: "Forgot current password?",
                reveal_hint: "Firebase cannot retrieve or display the current password. You can reveal what you entered or send a new reset link."
            },
            security: {
                status: "Account Status",
                verified: "Email Verified",
                not_verified: "Email Not Verified",
                send_link: "Send Verification Link",
                sending: "Sending...",
                devices: "Connected Devices",
                devices_hint: "This section shows the current active session.",
                current_device: "Your Current Device",
                logout: "Logout",
                os_browser: "OS / Browser",
                login_time: "Login Time",
                location: "Location"
            },
            history: {
                title: "Login History",
                browser: "Browser",
                os: "OS",
                device: "Device",
                date: "Date",
                ip: "IP Address",
                mobile: "Mobile",
                desktop: "Desktop",
                empty: "No saved logs yet. Future logins will be recorded automatically.",
                unknown_location: "Unknown Location",
                default_name: "Milano Store"
            },
            delete: {
                title: "Danger Zone",
                hint: "Deleting your account is final and cannot be undone. All your data and products will be deleted.",
                btn: "Delete My Account Permanently",
                confirm_q: "Are you absolutely sure?",
                confirm_btn: "Yes, delete account",
                deleting: "Deleting...",
                cancel: "Cancel"
            }
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    const handleSaveGeneral = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            if (currentUser && formData.displayName !== currentUser.displayName) {
                await updateProfile(currentUser, { displayName: formData.displayName });
            }
            if (currentUser && formData.email !== currentUser.email) {
                await verifyBeforeUpdateEmail(currentUser, formData.email);
                // Auto-add the new email to the admin list so the client can log in immediately
                // after confirming — no code change or redeploy needed.
                addAdminEmail(formData.email);
                setMessage({ type: 'success', text: txt.messages.email_change_sent.replace('{email}', formData.email) });
            } else {
                setMessage({ type: 'success', text: txt.messages.save_success });
            }
        } catch (error) {
            handleAuthError(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePassword = async () => {
        if (!passwordData.currentPassword) {
            setMessage({ type: 'error', text: txt.messages.enter_current_password });
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: txt.messages.password_mismatch });
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: txt.messages.password_short });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const credential = EmailAuthProvider.credential(currentUser.email, passwordData.currentPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, passwordData.newPassword);
            setMessage({ type: 'success', text: txt.messages.password_success });
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            console.error("Password Update Error:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                setMessage({ type: 'error', text: txt.messages.wrong_password });
            } else {
                handleAuthError(error);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, currentUser.email);
            setMessage({ type: 'success', text: txt.messages.reset_sent });
        } catch (error) {
            handleAuthError(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendVerification = async () => {
        setLoading(true);
        try {
            await sendEmailVerification(currentUser);
            setMessage({ type: 'success', text: txt.messages.verification_sent });
        } catch (error) {
            setMessage({ type: 'error', text: txt.messages.error + error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleAuthError = (error) => {
        console.error("Auth Error:", error);
        if (error.code === 'auth/requires-recent-login') {
            setMessage({ type: 'error', text: txt.messages.recent_login });
        } else {
            setMessage({ type: 'error', text: txt.messages.error + error.message });
        }
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            // In a real app, delete Firestore user data here if needed
            await deleteUser(currentUser);
            localStorage.removeItem('isAdminAuthenticated');
            navigate('/');
        } catch (error) {
            handleAuthError(error);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'general', label: txt.tabs.general, icon: Settings },
        { id: 'password', label: txt.tabs.password, icon: Lock },
        { id: 'security', label: txt.tabs.security, icon: Shield },
        { id: 'history', label: txt.tabs.history, icon: Clock },
        { id: 'delete', label: txt.tabs.delete, icon: Trash2, color: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' },
    ];

    return (
        <div className="max-w-6xl mx-auto font-['Cairo'] pb-10" dir={isRTL ? "rtl" : "ltr"}>
            <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-6">{txt.title}</h2>

            <div className="flex flex-col lg:flex-row gap-6">

                {/* Sidebar */}
                <div className="w-full lg:w-72 shrink-0">
                    <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/5 p-2 space-y-1 shadow-sm">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setMessage({ type: '', text: '' }); }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all text-sm ${activeTab === tab.id
                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-500'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                    } ${tab.color || ''}`}
                            >
                                <tab.icon size={18} className={activeTab === tab.id ? 'text-blue-600 dark:text-blue-500' : 'text-gray-400'} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6">

                    {/* Global Message */}
                    {message.text && (
                        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${message.type === 'success'
                            ? 'bg-green-50 text-green-600 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20'
                            : 'bg-red-50 text-red-600 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20'
                            }`}>
                            {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                            {message.text}
                        </div>
                    )}

                    {/* 1. General Tab */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm space-y-5">
                                <div>
                                    <label className={`block text-xs font-bold text-gray-500 mb-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.general.display_name}</label>
                                    <input type="text" name="displayName" value={formData.displayName} onChange={handleChange} className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold text-gray-700 dark:text-white" />
                                </div>
                                <button onClick={handleSaveGeneral} disabled={loading} className="bg-[#4f46e5] text-white px-8 py-2.5 rounded-lg font-bold hover:bg-[#4338ca] text-sm flex items-center gap-2">{loading && <Loader2 className="animate-spin" size={16} />}{txt.general.save}</button>
                            </div>

                            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm">
                                <div>
                                    <label className={`block text-xs font-bold text-gray-500 mb-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.general.email}</label>
                                    <div className="flex gap-3">
                                        <button onClick={handleSaveGeneral} disabled={loading} className="bg-[#3b82f6] text-white px-6 py-2.5 rounded-lg font-bold text-sm h-[48px]">{txt.general.change}</button>
                                        <input type="email" name="email" value={formData.email} onChange={handleChange} className={`flex-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 outline-none font-bold text-gray-600 dark:text-gray-300 dir-ltr ${isRTL ? 'text-right' : 'text-left'} h-[48px]`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Password Tab */}
                    {activeTab === 'password' && (
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm space-y-5">
                            <h3 className="font-bold text-gray-800 dark:text-white">{txt.password.title}</h3>
                            <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                <p>{txt.password.hint}</p>
                                <p className="text-xs font-bold opacity-80">{txt.password.reveal_hint}</p>
                            </div>
                            <div>
                                <label className={`block text-xs font-bold text-gray-500 mb-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.password.current}</label>
                                <div className="relative">
                                    <input type={visiblePasswordFields.current ? 'text' : 'password'} name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} className={`w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 font-bold text-gray-700 dark:text-white ${isRTL ? 'text-right' : 'text-left'}`} placeholder="••••••" />
                                    <button type="button" onClick={() => setVisiblePasswordFields(prev => ({ ...prev, current: !prev.current }))} className="absolute left-3 top-3 text-gray-400 hover:text-blue-500">{visiblePasswordFields.current ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className={`block text-xs font-bold text-gray-500 mb-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.password.new}</label>
                                    <div className="relative">
                                        <input type={visiblePasswordFields.new ? 'text' : 'password'} name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} className={`w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 font-bold text-gray-700 dark:text-white ${isRTL ? 'text-right' : 'text-left'}`} placeholder="••••••" />
                                        <button type="button" onClick={() => setVisiblePasswordFields(prev => ({ ...prev, new: !prev.new }))} className="absolute left-3 top-3 text-gray-400 hover:text-blue-500">{visiblePasswordFields.new ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className={`block text-xs font-bold text-gray-500 mb-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>{txt.password.confirm}</label>
                                    <div className="relative">
                                        <input type={visiblePasswordFields.confirm ? 'text' : 'password'} name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} className={`w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 font-bold text-gray-700 dark:text-white ${isRTL ? 'text-right' : 'text-left'}`} placeholder="••••••" />
                                        <button type="button" onClick={() => setVisiblePasswordFields(prev => ({ ...prev, confirm: !prev.confirm }))} className="absolute left-3 top-3 text-gray-400 hover:text-blue-500">{visiblePasswordFields.confirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <button onClick={handleSavePassword} disabled={loading} className="bg-[#4f46e5] text-white px-8 py-2.5 rounded-lg font-bold hover:bg-[#4338ca] text-sm flex items-center gap-2">
                                    {loading && <Loader2 className="animate-spin" size={16} />}{txt.password.update}
                                </button>
                                <button onClick={handleForgotPassword} disabled={loading} className="text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors">
                                    {txt.password.forgot}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 3. Security Tab */}
                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            {/* Email Verification Card */}
                            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white mb-1">{txt.security.status}</h3>
                                    <p className={`text-sm font-bold ${currentUser?.emailVerified ? 'text-green-500' : 'text-yellow-500'}`}>
                                        {currentUser?.emailVerified ? txt.security.verified : txt.security.not_verified}
                                    </p>
                                </div>
                                {!currentUser?.emailVerified && (
                                    <button onClick={handleSendVerification} disabled={loading} className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-200">
                                        {loading ? txt.security.sending : txt.security.send_link}
                                    </button>
                                )}
                                {currentUser?.emailVerified && (
                                    <div className="bg-green-100 text-green-700 p-2 rounded-full"><Check size={20} /></div>
                                )}
                            </div>

                            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
                                <div className="border-b border-gray-100 dark:border-white/10 pb-4">
                                    <h3 className="font-bold text-gray-800 dark:text-white">{txt.security.devices}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{txt.security.devices_hint}</p>
                                </div>

                                <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                                    <div className="p-3 bg-white dark:bg-black/20 rounded-xl text-gray-800 dark:text-gray-200 shadow-sm">
                                        {currentSession.device === 'Mobile' ? <Smartphone size={28} /> : <Monitor size={28} />}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                            <div>
                                                <h4 className="font-bold text-gray-800 dark:text-white text-sm">{currentSession.os} / {currentSession.browser}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-green-600 font-bold bg-green-100 dark:bg-green-500/20 px-2 py-0.5 rounded-full">{txt.security.current_device}</span>
                                                    <span className="text-xs text-gray-500 dir-ltr">{currentSession.ip}</span>
                                                </div>
                                            </div>
                                            <button className="text-gray-400 bg-gray-200 dark:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold cursor-not-allowed" disabled>{txt.security.logout}</button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-2 border-t border-gray-200 dark:border-white/5 pt-2">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {txt.security.login_time}: <span dir="ltr">{currentUser?.metadata.lastSignInTime ? new Date(currentUser.metadata.lastSignInTime).toLocaleDateString() : 'N/A'}</span></span>
                                            <span className="flex items-center gap-1"><Globe size={12} /> {currentSession.location}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. History Tab */}
                    {activeTab === 'history' && (
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-4">{txt.history.title}</h3>

                            <div className="overflow-x-auto">
                                <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                                    <thead className="text-gray-500 font-bold border-b border-gray-100 dark:border-white/10">
                                        <tr>
                                            <th className={`pb-3 ${isRTL ? 'pl-4' : 'pr-4'}`}>{txt.history.browser}</th>
                                            <th className="pb-3 px-4">{txt.history.os}</th>
                                            <th className="pb-3 px-4">{txt.history.device}</th>
                                            <th className="pb-3 px-4">{txt.history.date}</th>
                                            <th className="pb-3 px-4">{txt.history.ip}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                        {loginHistory.length > 0 ? loginHistory.map((log) => (
                                            <tr key={log.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                <td className={`py-4 ${isRTL ? 'pl-4' : 'pr-4'} font-bold text-gray-800 dark:text-white dir-ltr ${isRTL ? 'text-right' : 'text-left'}`}>{log.browser}</td>
                                                <td className={`py-4 px-4 text-gray-600 dark:text-gray-300 dir-ltr ${isRTL ? 'text-right' : 'text-left'}`}>{log.os}</td>
                                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{log.device === 'Mobile' ? txt.history.mobile : txt.history.desktop}</td>
                                                <td className={`py-4 px-4 text-gray-500 dir-ltr ${isRTL ? 'text-right' : 'text-left'}`}>
                                                    {log.timestamp ? log.timestamp.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                </td>
                                                <td className={`py-4 px-4 text-gray-500 dir-ltr ${isRTL ? 'text-right' : 'text-left'} font-mono text-xs`}>{log.ip}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" className="py-8 text-center text-gray-400 font-bold">
                                                    {txt.history.empty}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 5. Delete Tab */}
                    {activeTab === 'delete' && (
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-red-100 dark:border-red-500/20 shadow-sm space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="bg-red-100 text-red-600 p-3 rounded-full"><AlertTriangle size={24} /></div>
                                <div>
                                    <h3 className="font-black text-red-600 text-lg">{txt.delete.title}</h3>
                                    <p className="text-gray-500 text-sm mt-1 font-bold">{txt.delete.hint}</p>
                                </div>
                            </div>
                            <div className="pt-4">
                                {!showDeleteConfirm ? (
                                    <button onClick={() => setShowDeleteConfirm(true)} className="bg-red-50 text-red-600 px-6 py-2.5 rounded-lg font-bold hover:bg-red-100 transition-colors text-sm w-full sm:w-auto">
                                        {txt.delete.btn}
                                    </button>
                                ) : (
                                    <div className="bg-red-50 dark:bg-red-500/10 p-4 rounded-xl border border-red-100 dark:border-red-500/20">
                                        <p className="font-bold text-red-600 mb-3 text-sm">{txt.delete.confirm_q}</p>
                                        <div className="flex gap-3">
                                            <button onClick={handleDeleteAccount} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-700 flex-1">
                                                {loading ? txt.delete.deleting : txt.delete.confirm_btn}
                                            </button>
                                            <button onClick={() => setShowDeleteConfirm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-300 flex-1">
                                                {txt.delete.cancel}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AccountSettingsView;
