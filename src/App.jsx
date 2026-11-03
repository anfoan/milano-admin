import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CurrencyProvider } from './context/CurrencyContext';
import PageMetadataHandler from './components/PageMetadataHandler';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';

const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const POSView = lazy(() => import('./components/admin/POSView'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#111317]">
    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <CurrencyProvider>
      <PageMetadataHandler />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<AdminLogin />} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pos" element={<POSView standalone />} />
          <Route path="/milano-secure-gate-99" element={<AdminLogin />} />
          <Route path="/milano-dashboard-vault-77" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
          <Route path="/dashboard" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </CurrencyProvider>
  );
}
