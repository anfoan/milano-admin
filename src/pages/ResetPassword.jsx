import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, CheckCircle2, XCircle, Mail, Loader2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { confirmPasswordReset, verifyPasswordResetCode, sendPasswordResetEmail } from 'firebase/auth';

const ResetPassword = () => {
    const navigate = useNavigate();
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    const email = params.get('email') || '';
    const isCodeMode = mode === 'resetPassword' && oobCode;

    // 'checking' | 'email' | 'invalid' | 'valid'
    const [view, setView] = React.useState(isCodeMode ? 'checking' : 'email');
    const [resetEmail, setResetEmail] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirm, setShowConfirm] = React.useState(false);
    const [message, setMessage] = React.useState({ type: '', text: '' });
    const [loading, setLoading] = React.useState(false);

    // Verify the reset code on mount
    React.useEffect(() => {
        if (mode === 'resetPassword' && oobCode) {
            verifyPasswordResetCode(auth, oobCode)
                .then(() => setView('valid'))
                .catch(() => setView('invalid'));
        } else {
            setView('email');
        }
    }, [mode, oobCode]);

    // Send the reset link to the entered email (request from the login page)
    const handleSendEmail = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (!resetEmail.trim()) {
            setMessage({ type: 'error', text: 'أدخل بريدك الإلكتروني أولاً' });
            return;
        }

        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, resetEmail.trim());
            setMessage({
                type: 'success',
                text: 'تم الإرسال ✅ تحقق من بريدك الإلكتروني (وافحص مجلد الرسائل غير المرغوب فيها)',
            });
            setResetEmail('');
        } catch (error) {
            console.error('Send Reset Email Error:', error);
            let text = 'حدث خطأ غير متوقع، حاول مرة أخرى';
            if (error.code === 'auth/invalid-email') text = 'البريد الإلكتروني غير صالح';
            else if (error.code === 'auth/user-not-found') text = 'لا يوجد حساب مسجل بهذا البريد الإلكتروني';
            else if (error.code === 'auth/too-many-requests') text = 'طلبات كثيرة — انتظر قليلاً ثم حاول مرة أخرى';
            setMessage({ type: 'error', text });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'كلمتا المرور غير متطابقتين' });
            return;
        }

        setLoading(true);
        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            setMessage({
                type: 'success',
                text: 'تم تغيير كلمة المرور بنجاح ✅ سيتم تحويلك لتسجيل الدخول...',
            });
            setTimeout(() => navigate('/milano-secure-gate-99'), 2500);
        } catch (error) {
            console.error('Password Reset Error:', error);
            let text = 'حدث خطأ غير متوقع، حاول مرة أخرى';
            if (error.code === 'auth/expired-action-code') text = 'انتهت صلاحية الرابط. يرجى طلب رابط جديد';
            else if (error.code === 'auth/invalid-action-code') text = 'الرابط غير صالح. يرجى طلب رابط جديد';
            else if (error.code === 'auth/weak-password') text = 'كلمة المرور ضعيفة جداً (6 أحرف على الأقل)';
            setMessage({ type: 'error', text });
        } finally {
            setLoading(false);
        }
    };

    // Checking code...
    if (view === 'checking') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#111317] flex items-center justify-center p-4 font-['Cairo'] transition-colors duration-300" dir="rtl">
                <div className="flex flex-col items-center gap-4 text-gray-500 dark:text-gray-400 font-bold">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    جاري التحقق من الرابط...
                </div>
            </div>
        );
    }

    // Invalid / expired code
    if (view === 'invalid') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#111317] flex items-center justify-center p-4 font-['Cairo'] transition-colors duration-300" dir="rtl">
                <div className="max-w-md w-full bg-white dark:bg-[#1c1c1e] rounded-[32px] p-8 shadow-2xl dark:shadow-none border border-gray-100 dark:border-white/5 transition-colors duration-300">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-[28px] flex items-center justify-center mb-4">
                            <XCircle size={40} className="text-red-500" />
                        </div>
                        <h1 className="text-xl font-black text-gray-800 dark:text-white text-center">الرابط غير صالح أو منتهي الصلاحية</h1>
                        <p className="text-gray-400 font-bold mt-3 text-center text-sm">يمكنك طلب رابط جديد بإدخال بريدك الإلكتروني</p>
                    </div>
                    <button
                        onClick={() => navigate('/reset-password')}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]"
                    >
                        طلب رابط جديد
                    </button>
                    <button
                        onClick={() => navigate('/milano-secure-gate-99')}
                        className="w-full mt-3 py-4 bg-gray-100 dark:bg-[#2a2e35] hover:bg-gray-200 dark:hover:bg-[#33373f] text-gray-600 dark:text-gray-300 font-black rounded-2xl transition-all active:scale-[0.98]"
                    >
                        العودة لتسجيل الدخول
                    </button>
                </div>
            </div>
        );
    }

    // Request reset link by email (from the login page link)
    if (view === 'email') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#111317] flex items-center justify-center p-4 font-['Cairo'] transition-colors duration-300" dir="rtl">
                <div className="max-w-md w-full bg-white dark:bg-[#1c1c1e] rounded-[32px] p-8 shadow-2xl dark:shadow-none border border-gray-100 dark:border-white/5 transition-colors duration-300">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-24 h-24 bg-white dark:bg-[#2a2e35] border border-gray-100 dark:border-white/10 rounded-[32px] flex items-center justify-center mb-4 transition-colors p-1 overflow-hidden shadow-sm">
                            <img src="/admin-new-icon.png" className="w-full h-full object-cover rounded-[28px]" alt="Admin Badge" />
                        </div>
                        <h1 className="text-2xl font-black text-gray-800 dark:text-white">نسيت كلمة المرور؟</h1>
                        <p className="text-gray-400 font-bold mt-2 text-center text-sm">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور</p>
                    </div>

                    {message.text && (
                        <div className={`mb-6 p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center gap-2 ${
                            message.type === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                            {message.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSendEmail} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-700 dark:text-gray-300 block mr-1">البريد الإلكتروني</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#2a2e35] border border-gray-100 dark:border-white/5 rounded-2xl py-4 pr-12 pl-4 outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-[#2a2e35] transition-all font-bold text-gray-900 dark:text-white text-right"
                                    placeholder="example@gmail.com"
                                    dir="ltr"
                                    required
                                />
                                <Mail className="absolute top-4 right-4 text-gray-400" size={20} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] flex justify-center items-center"
                        >
                            {loading ? <Loader2 className="animate-spin" size={24} /> : 'إرسال رابط إعادة التعيين'}
                        </button>
                    </form>

                    <Link
                        to="/milano-secure-gate-99"
                        className="block text-center mt-6 text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        العودة لتسجيل الدخول
                    </Link>
                </div>
            </div>
        );
    }

    // Valid code — show the form
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#111317] flex items-center justify-center p-4 font-['Cairo'] transition-colors duration-300" dir="rtl">
            <div className="max-w-md w-full bg-white dark:bg-[#1c1c1e] rounded-[32px] p-8 shadow-2xl dark:shadow-none border border-gray-100 dark:border-white/5 transition-colors duration-300">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 bg-white dark:bg-[#2a2e35] border border-gray-100 dark:border-white/10 rounded-[32px] flex items-center justify-center mb-4 transition-colors p-1 overflow-hidden shadow-sm">
                        <img src="/admin-new-icon.png" className="w-full h-full object-cover rounded-[28px]" alt="Admin Badge" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-white">إعادة ضبط كلمة المرور</h1>
                    <p className="text-gray-400 font-bold mt-2 flex items-center gap-1.5">
                        <KeyRound size={15} />
                        {email || 'حسابك'}
                    </p>
                </div>

                {message.text && (
                    <div className={`mb-6 p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center gap-2 ${
                        message.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400'
                    }`}>
                        {message.type === 'success' && <CheckCircle2 size={18} />}
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 block mr-1 mb-2">كلمة المرور الجديدة</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-gray-50 dark:bg-[#2a2e35] border border-gray-100 dark:border-white/5 rounded-2xl py-4 pr-12 pl-12 outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-[#2a2e35] transition-all font-bold text-gray-900 dark:text-white"
                                dir="ltr"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 block mr-1 mb-2">تأكيد كلمة المرور</label>
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-gray-50 dark:bg-[#2a2e35] border border-gray-100 dark:border-white/5 rounded-2xl py-4 pr-12 pl-12 outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-[#2a2e35] transition-all font-bold text-gray-900 dark:text-white"
                                dir="ltr"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                tabIndex={-1}
                            >
                                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] flex justify-center items-center"
                    >
                        {loading ? (
                            <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                            'حفظ كلمة المرور الجديدة'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
