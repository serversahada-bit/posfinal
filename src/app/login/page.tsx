'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isReady } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rememberedUsername = localStorage.getItem('pos-remember-username') ?? '';
    setUsername(rememberedUsername);
    setRememberMe(Boolean(rememberedUsername));
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isReady, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Username dan password harus diisi.');
      setLoading(false);
      return;
    }

    const result = await login(username, password);

    if (result.success) {
      if (rememberMe) {
        localStorage.setItem('pos-remember-username', username.trim());
      } else {
        localStorage.removeItem('pos-remember-username');
      }
      localStorage.removeItem('pos-remember-email');
      setLoading(false);
      return;
    }

    setError(result.message);
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/40 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/40 blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white p-8 md:p-10 relative z-10">
        <div className="flex flex-col items-center mb-10 mt-2">
          <div className="w-16 h-16 relative mb-5 bg-white rounded-2xl shadow-sm p-3 border border-slate-100 flex items-center justify-center">
            <Image src="/app-logo.png" alt="GreatSales logo" fill sizes="64px" className="object-contain p-2" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Point Of Sale</h2>
          <p className="text-sm text-slate-500 mt-2 text-center">Gunakan username akun Anda untuk masuk.</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 mb-6 p-4 border border-red-200 bg-red-50 text-red-600 rounded-2xl text-sm font-medium">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="login-username" className="text-sm font-bold text-slate-700 ml-1">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              name="username"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: min"
              className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-5 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="login-password" className="text-sm font-bold text-slate-700 ml-1">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-5 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 p-2 transition-colors"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer mt-1 ml-1 font-medium group">
            <div className="relative flex items-center justify-center">
              <input
                id="login-remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 rounded-[6px] border-slate-300 text-purple-600 focus:ring-purple-500/30 transition-all cursor-pointer peer appearance-none checked:bg-purple-600 checked:border-purple-600 bg-slate-50 border"
              />
              <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 4.5L4.5 8L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="group-hover:text-slate-800 transition-colors">Ingat Saya</span>
          </label>

          <button
            id="btn-login"
            type="submit"
            disabled={loading || !isReady}
            className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-4 rounded-2xl shadow-[0_8px_20px_-6px_rgba(147,51,234,0.5)] hover:shadow-[0_12px_24px_-8px_rgba(147,51,234,0.6)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0 flex justify-center items-center gap-2 text-sm tracking-wide"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                <span>MEMPROSES...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>LOGIN KE SISTEM</span>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
