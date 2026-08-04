'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [isAuthenticated, isReady, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <div>
          <p className="font-semibold text-slate-800">Mengalihkan halaman...</p>
          <p className="text-sm text-slate-500">Menyiapkan tujuan yang sesuai.</p>
        </div>
      </div>
    </div>
  );
}
