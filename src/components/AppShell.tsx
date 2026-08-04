'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import RealtimeConnection from '@/components/RealtimeConnection';
import { disconnectSocket } from '@/lib/socket';

const PUBLIC_ROUTES = ['/login'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/lp/');
  const isFullScreenRoute = pathname.startsWith('/landing-page/builder');

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace('/login');
    }
  }, [isAuthenticated, isPublicRoute, isReady, router]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || isPublicRoute) {
      disconnectSocket();
    }
  }, [isAuthenticated, isPublicRoute, isReady]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isReady || !isAuthenticated) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__row">
          <div className="spinner" />
          Memuat...
        </div>
      </div>
    );
  }

  if (isFullScreenRoute) {
    return (
      <div className="min-h-screen bg-white">
        <RealtimeConnection />
        {children}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <RealtimeConnection />
      <Sidebar isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />

      <div className="app-shell__content">
        <div className="app-shell__column">
          <header className="app-shell__mobile-header">
            <div className="app-shell__mobile-brand">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="app-shell__mobile-button"
                aria-label="Open sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="app-shell__mobile-logo">
                <Image src="/app-logo.png" alt="GreatSales logo" fill className="app-shell__mobile-logo-image" sizes="36px" />
              </div>
              <div>
                <p className="app-shell__mobile-title">GreatSales</p>
                <p className="app-shell__mobile-subtitle">POS Panel</p>
              </div>
            </div>
          </header>

          <main className="app-shell__main">
            <div className="app-shell__inner">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
