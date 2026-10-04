import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

const AdminLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const isEmail = (val) => val.includes('@');
    const isWorkerEmail = (val) => val.trim().toLowerCase().endsWith('@milano-store.com');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const input = username.trim();
            
            // The primary `milano` username must use Firebase Auth, not the worker lookup.
            const isPrimaryAdmin = input.toLowerCase() === 'milano';

            // Check if it's a worker login (either no @, or ends with @milano-store.com)
            if (!isPrimaryAdmin && (!isEmail(input) || isWorkerEmail(input))) {
                // === WORKER LOGIN ===
                const workerUsername = isWorkerEmail(input) 
                    ? input.replace(/@milano-store\.com$/i, '') 
                    : input;
                
                try {
                    const qWorkers = query(collection(db, "settings", "pos", "workers"));
                    const snap = await getDocs(qWorkers);
                    let foundWorker = null;
                    snap.forEach(doc => {
                        const data = doc.data();
                        if (data.username === workerUsername && data.password === password.trim()) {
                            foundWorker = { id: doc.id, ...data };
                        }
                    });
                    
                    if (foundWorker) {
                        sessionStorage.setItem('isPOSWorkerAuthenticated', 'true');
                        sessionStorage.setItem('posWorkerId', foundWorker.id);
                        sessionStorage.setItem('posWorkerName', foundWorker.username || '');
                        const perms = {
                            allowDiscount: foundWorker.allowDiscount || false,
                            allowChangePayment: foundWorker.allowChangePayment || false,
                            allowViewHistory: foundWorker.allowViewHistory || false,
                            allowOnlyPrint: foundWorker.allowOnlyPrint || false,
                            allowExpenses: foundWorker.allowExpenses || false,
                            allowManualOrder: foundWorker.allowManualOrder || false,
                            allowBonds: foundWorker.allowBonds || false
                        };
                        sessionStorage.setItem('posWorkerPermissions', JSON.stringify(perms));
                        navigate('/milano-dashboard-vault-77');
                    } else {
                        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
                    }
                } catch (err) {
                    console.error("Worker login error:", err);
                    setError('حدث خطأ أثناء تسجيل الدخول');
                }
            } else {
                // === ADMIN LOGIN (Firebase Auth) ===
                // The independent project uses the friendly primary username `milano`.
                // It is backed by a private Firebase Auth email so Firestore rules remain secure.
                const loginEmail = input.toLowerCase() === 'milano'
                    ? 'anfoan7370@gmail.com'
                    : input;
                const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);

                // Log Session
                try {
                    const res = await fetch('https://api.ipify.org?format=json');
                    const data = await res.json();
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

                    await addDoc(collection(db, 'login_history'), {
                        uid: userCredential.user.uid,
                        ip: data.ip,
                        os: os,
                        browser: browser,
                        device: /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop',
                        userAgent: ua,
                        timestamp: serverTimestamp()
                    });
                } catch (logErr) {
                    console.error("Session logging failed:", logErr);
                }

                // مسح أي جلسة موظف قديمة من نفس التبويب حتى لا يتعامل التطبيق مع الأدمن كموظف
                sessionStorage.removeItem('isPOSWorkerAuthenticated');
                sessionStorage.removeItem('posWorkerId');
                sessionStorage.removeItem('posWorkerName');
                sessionStorage.removeItem('posWorkerPermissions');

                navigate('/milano-dashboard-vault-77');
            }
        } catch (err) {
            console.error("Login Error:", err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
            } else if (err.code === 'auth/too-many-requests') {
                setError('تم ايقاف المحاولات مؤقتاً. الرجاء المحاولة لاحقاً.');
            } else {
                setError('حدث خطأ أثناء تسجيل الدخول. تأكد من اتصالك بالإنترنت.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#111317] flex items-center justify-center p-4 font-['Cairo'] transition-colors duration-300" dir="rtl">
            <div className="max-w-md w-full bg-white dark:bg-[#1c1c1e] rounded-[32px] p-8 shadow-2xl dark:shadow-none border border-gray-100 dark:border-white/5 transition-colors duration-300">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 bg-white dark:bg-[#2a2e35] border border-gray-100 dark:border-white/10 rounded-[32px] flex items-center justify-center mb-4 transition-colors p-1 overflow-hidden shadow-sm">
                        <img src="/admin-new-icon.png" className="w-full h-full object-cover rounded-[28px]" alt="Admin Badge" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-white">لوحة تحكم ميلانو</h1>
                    <p className="text-gray-400 font-bold mt-2">برجاء تسجيل الدخول للمتابعة</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 block mr-1">اسم المستخدم</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#2a2e35] border border-gray-100 dark:border-white/5 rounded-2xl py-4 pr-12 pl-4 outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-[#2a2e35] transition-all font-bold text-gray-900 dark:text-white text-right"
                                placeholder="اسم المستخدم أو البريد الإلكتروني"
                                dir="auto"
                                required
                            />
                            <User className="absolute top-4 right-4 text-gray-400" size={20} />
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold mr-1">للموظفين: اكتب اسم المستخدم فقط (مثل: موظف1) وسيتم إكمال البريد تلقائياً</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 block mr-1">كلمة المرور</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#2a2e35] border border-gray-100 dark:border-white/5 rounded-2xl py-4 pr-12 pl-12 outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-[#2a2e35] transition-all font-bold text-gray-900 dark:text-white"
                                placeholder="••••••••"
                                required
                            />
                            <Lock className="absolute top-4 right-4 text-gray-400" size={20} />
                            <button
                                type="button"
                                onClick={() => setShowPassword((visible) => !visible)}
                                className="absolute top-3 left-3 p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] flex justify-center items-center"
                    >
                        {loading ? <Loader2 className="animate-spin" size={24} /> : 'تسجيل الدخول'}
                    </button>

                    <Link
                        to="/reset-password"
                        className="block text-center text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors pt-1"
                    >
                        نسيت كلمة المرور الحالية؟
                    </Link>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
