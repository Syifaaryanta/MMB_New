import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { User, Lock, Mail, Key, Shield, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Password baru dan konfirmasi tidak cocok');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setSuccess('Password berhasil diperbarui');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal mengubah password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Profil Pengguna</h1>
        <p className="text-slate-400">Informasi akun dan pengaturan kata sandi Anda</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="card md:col-span-1 flex flex-col items-center text-center justify-center p-6 space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-primary-500/10 border-2 border-primary-500/20">
            {user.nama.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{user.nama}</h3>
            <span className="inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-mono bg-primary-950/40 border border-primary-500/30 text-primary-400 capitalize">
              {user.role.replace('_', ' ')}
            </span>
          </div>
          <div className="w-full border-t border-surface-700 my-2" />
          <div className="w-full text-left space-y-3 text-sm">
            <div className="flex items-center gap-2.5 text-slate-300">
              <Mail size={16} className="text-slate-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300">
              <Shield size={16} className="text-slate-400 shrink-0" />
              <span className="capitalize">{user.role} Access Role</span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card md:col-span-2 p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-surface-700 pb-3">
            <Key className="text-primary-500 w-5 h-5" />
            <h3 className="text-lg font-bold text-white">Ubah Password</h3>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-danger-600/10 border border-danger-500/30 text-danger-400 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-lg bg-success-600/10 border border-success-500/30 text-success-400 text-sm flex items-start gap-2.5">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Password Saat Ini
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan password lama"
                    className="input-field pl-9"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Password Baru
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 karakter"
                    className="input-field pl-9"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="input-field pl-9"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Perbarui Password</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
