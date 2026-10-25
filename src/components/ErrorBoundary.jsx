import React from 'react';

const RECOVERY_KEY = 'milano_runtime_recovery_attempted';
let recoveryStarted = false;

const isChunkLoadFailure = (error) => /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk|preload error/i.test(
    String(error?.message || error || '')
);

const recoveryAlreadyAttempted = () => {
    if (recoveryStarted || typeof window === 'undefined') return recoveryStarted;
    try {
        return window.location.search.includes('__milano_recovery=1')
            || window.sessionStorage.getItem(RECOVERY_KEY) === '1';
    } catch {
        return window.location.search.includes('__milano_recovery=1');
    }
};

const clearStaleRuntimeAssets = async () => {
    if (typeof window === 'undefined') return;
    try {
        const keys = await window.caches?.keys?.();
        await Promise.all((keys || []).map((key) => window.caches.delete(key)));
    } catch {
        // A fresh navigation is still useful when Cache Storage is unavailable.
    }
    try {
        const registrations = await window.navigator?.serviceWorker?.getRegistrations?.();
        await Promise.all((registrations || []).map((registration) => registration.unregister()));
    } catch {
        // Service workers are optional and may be disabled by the browser.
    }
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, recovering: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Uncaught application error:', error, errorInfo);
        if (!isChunkLoadFailure(error) || recoveryAlreadyAttempted() || typeof window === 'undefined') return;

        recoveryStarted = true;
        try { window.sessionStorage.setItem(RECOVERY_KEY, '1'); } catch { /* storage is optional */ }
        this.setState({ recovering: true });
        clearStaleRuntimeAssets().finally(() => {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('__milano_recovery', '1');
            window.location.replace(nextUrl.toString());
        });
    }

    handleRetry = () => {
        if (typeof window === 'undefined') return;
        clearStaleRuntimeAssets().finally(() => window.location.reload());
    };

    render() {
        if (this.state.hasError) {
            if (this.state.recovering) {
                return (
                    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 dark:bg-[#111317]" dir="rtl" role="status">
                        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-gray-600 shadow-sm dark:bg-[#1c1c1e] dark:text-gray-300">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                            جاري استعادة التطبيق...
                        </div>
                    </div>
                );
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-['Cairo'] text-gray-900 dark:bg-[#111317] dark:text-white" dir="rtl">
                    <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl dark:border-white/5 dark:bg-[#1c1c1e]">
                        <h1 className="mb-2 text-xl font-black">تعذر فتح هذه الصفحة الآن</h1>
                        <p className="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">أعد المحاولة وسيتم تحديث ملفات التطبيق تلقائيًا.</p>
                        <button onClick={this.handleRetry} className="w-full rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700">
                            إعادة المحاولة
                        </button>
                        {this.state.error && import.meta.env.DEV && (
                            <div className="mt-8 max-h-32 overflow-auto rounded-lg bg-gray-100 p-4 text-left font-mono text-xs text-red-500 dark:bg-black" dir="ltr">
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
