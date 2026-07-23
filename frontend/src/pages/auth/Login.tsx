import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { Eye, EyeOff, Lock, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto redirect if already logged in and clean inputs
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      setUsername('');
      setPassword('');
      setTimeout(() => usernameRef.current?.focus(), 50);
    }
  }, [isAuthenticated, navigate]);

  const handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username dan Password wajib diisi');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { username, password });
      const { user, token } = response.data;
      login(user, token);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Gagal terhubung ke server';
      setError(msg);
      // Select password field so user can re-type
      passwordRef.current?.focus();
      passwordRef.current?.select();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Orbs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-primary-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md glass rounded-2xl shadow-2xl p-8 relative z-10 border border-surface-700/50 animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center font-black text-2xl text-white mx-auto shadow-lg shadow-primary-600/20 mb-4">
            M
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Maju Mulia Bersama</h2>
          <p className="text-sm text-slate-500 mt-1">Sistem Manajemen Operasional Terintegrasi</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-danger-600/10 border border-danger-500/30 text-danger-400 text-sm flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Login Gagal</p>
              <p className="text-xs mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <UserIcon size={18} />
              </span>
              <input
                ref={usernameRef}
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                placeholder="Masukkan username"
                className="input-field pl-10"
                autoComplete="off"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Lock size={18} />
              </span>
              <input
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field pl-10 pr-10"
                autoComplete="new-password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary justify-center mt-2 py-2 rounded-md text-sm shadow-md"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <span>Masuk</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          <p>© 2026 PT. Maju Mulia Bersama. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
