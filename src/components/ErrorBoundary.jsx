import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#111317] text-gray-900 dark:text-white p-4 font-['Cairo']" dir="rtl">
                    <div className="text-center max-w-md bg-white dark:bg-[#1c1c1e] p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-white/5">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                        </div>
                        <h1 className="text-xl font-black mb-2">عذراً، حدث خطأ غير متوقع</h1>
                        <p className="mb-6 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                            نعمل على إصلاح هذا الخلل. حاول إعادة تحميل الصفحة، أو تواصل معنا إذا استمرت المشكلة.
                        </p>
                        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors w-full shadow-lg shadow-blue-600/20">
                            إعادة تحميل / Reload
                        </button>
                        {this.state.error && process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 text-left bg-gray-100 dark:bg-black p-4 rounded-lg overflow-auto text-xs font-mono text-red-500 max-h-32" dir="ltr">
                                {this.state.error.toString()}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
