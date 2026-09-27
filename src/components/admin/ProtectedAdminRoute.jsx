import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { getAdminEmails, FALLBACK_ADMIN_EMAILS } from '../../lib/adminEmails';

const ProtectedAdminRoute = ({ children }) => {
    const { currentUser, loading } = useAuth();
    const [adminEmails, setAdminEmails] = useState(null); // null = still loading

    // Allow workers through session storage (no Firebase Auth needed)
    const isWorker = sessionStorage.getItem('isPOSWorkerAuthenticated') === 'true';

    useEffect(() => {
        let mounted = true;
        getAdminEmails().then(list => {
            if (mounted) setAdminEmails(list || FALLBACK_ADMIN_EMAILS);
        });
        return () => { mounted = false; };
    }, []);

    if (loading || adminEmails === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#121212]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-gray-500 font-bold">{isWorker ? 'جاري تحميل لوحة الموظف...' : 'جاري التحقق من الصلاحيات...'}</p>
                </div>
            </div>
        );
    }

    // Allow workers through session
    if (isWorker) {
        return children;
    }

    // Firestore list + fallback list (case-insensitive)
    const combined = new Set([...(adminEmails || []), ...FALLBACK_ADMIN_EMAILS]);
    const isAllowedAdmin = currentUser && [...combined].some(e => String(e).toLowerCase() === String(currentUser.email || '').toLowerCase());

    if (!isAllowedAdmin) {
        return <Navigate to="/milano-secure-gate-99" replace />;
    }

    return children;
};

export default ProtectedAdminRoute;
