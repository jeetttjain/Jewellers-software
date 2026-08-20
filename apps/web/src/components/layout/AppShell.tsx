import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';
import { MobileNav } from './MobileNav.js';
import { ToastContainer } from '../common/ToastContainer.js';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api/client.js';
import { ShopSettings } from '@jewellery-pos/shared';
import { updateDynamicBranding } from '../../utils/branding.js';

export const AppShell: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (user) {
      api
        .get<ShopSettings>('/settings')
        .then((shop) => {
          if (isMounted && shop) {
            updateDynamicBranding(shop);
          }
        })
        .catch(() => {
          // Ignore fallback
        });
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-serif">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs tracking-wide">Authenticating Showroom Session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-surface-50 flex flex-col">
      {/* Top Header (Static, flex-shrink-0) */}
      <Header onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />

      {/* Main Workspace Body (Fills remaining height) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Responsive Sidebar (Container 1: Independent Scroll) */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Content Viewport (Container 2: Independent Scroll) */}
        <main className="flex-1 h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 md:p-6 pb-20 lg:pb-6 focus:outline-none">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav onOpenMenu={() => setIsSidebarOpen(true)} />

      {/* Global Toast System */}
      <ToastContainer />
    </div>
  );
};
