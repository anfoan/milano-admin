import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';
import StoreStatusGuardian from '../components/StoreStatusGuardian';
import ScrollToTop from '../components/ScrollToTop';

const Layout = () => {
    return (
        <div className="min-h-screen flex flex-col bg-brand-gray dark:bg-[#0f1218]">
            <ScrollToTop />
            <StoreStatusGuardian />
            <Navbar />
            <main className="flex-grow pb-2">
                <Outlet />
            </main>
            <Footer />
            <WhatsAppButton />
        </div>
    );
};

export default Layout;
