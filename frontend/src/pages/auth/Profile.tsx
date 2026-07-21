import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { User as UserIcon, Lock, Mail, Shield, AlertCircle, CheckCircle, Loader2, Save, HelpCircle } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';

export const Profile: React.FC = () => {
  const { user, login, token } = useAuthStore();

  const [username, setUsername] = useState(user?.username || user?.email.split('@')[0] || '');
  const [role, setRole] = useState(user?.role || 'staff_kantor');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLSelectElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setUsername(user.username || user.email.split('@')[0] || '');
      setRole(user.role || 'staff_kantor');
    }
  }, [user]);

  // Auto focus username field on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  if (!user) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate passwords if user entered new password
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError('Password saat ini wajib diisi untuk mengubah password');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Password baru dan konfirmasi password tidak cocok');
        return;
      }
      if (newPassword.length < 6) {
        setError('Password baru minimal 6 karakter');
        return;
      }
    }

    // Show confirmation popup modal
    setShowConfirmModal(true);
  };

  const executeProfileUpdate = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.put('/auth/update-profile', {
        username,
        role: user.role === 'super_admin' ? role : undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      setSuccess('Profil berhasil diperbarui');
      if (response.data?.user && token) {
        login(response.data.user, token);
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal memperbarui profil');
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard shortcut listener for modal confirmation ('Y' key)
  useEffect(() => {
    if (!showConfirmModal) return;
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
        e.preventDefault();
        executeProfileUpdate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowConfirmModal(false);
      }
    };
    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [showConfirmModal, username, role, currentPassword, newPassword]);

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLElement | null> | null
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      } else {
        handleFormSubmit(e as any);
      }
    }
  };

  const displayUsername = user.username || user.email.split('@')[0];
  const avatarInitials = displayUsername.slice(0, 2).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Profil Pengguna</h1>
        <p className="text-slate-500">Informasi akun, username, dan pengaturan kata sandi Anda</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="card card-hovered md:col-span-1 flex flex-col items-center text-center justify-center p-6 space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-primary-500/20 border-2 border-primary-400">
            {avatarInitials}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{displayUsername}</h3>
            <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full font-mono bg-blue-50 border border-blue-200 text-blue-700 capitalize font-semibold">
              {user.role.replace('_', ' ')}
            </span>
          </div>
          <div className="w-full border-t border-slate-200/80 my-2" />
          <div className="w-full text-left space-y-3 text-sm">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Mail size={16} className="text-slate-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <Shield size={16} className="text-slate-400 shrink-0" />
              <span className="capitalize">{user.role} Access Role</span>
            </div>
          </div>
        </div>

        {/* Update Form Card */}
        <div className="card card-hovered md:col-span-2 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <UserIcon className="text-primary-600 w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-800">Edit Profil & Kata Sandi</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Pindah form dengan Enter</span>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-danger-600/10 border border-danger-500/30 text-danger-600 text-sm flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-lg bg-success-600/10 border border-success-500/30 text-emerald-700 text-sm flex items-start gap-2.5 animate-fade-in">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Account Info Section */}
            <div className="grid grid-cols-1 sm:grid-cols-10 gap-4">
              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <UserIcon size={16} />
                  </span>
                  <input
                    ref={usernameRef}
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => handleInputKeyDown(e, roleRef as any)}
                    placeholder="Username"
                    className="input-field pl-9"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Role Hak Akses</span>
                  {user.role !== 'super_admin' && (
                    <span className="text-[10px] text-amber-600 font-medium lowercase">
                      (Terkunci)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Shield size={16} />
                  </span>
                  <select
                    ref={roleRef}
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    onKeyDown={(e: any) => handleInputKeyDown(e, currentPasswordRef)}
                    className="input-field pl-9 capitalize"
                    disabled={isLoading || user.role !== 'super_admin'}
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="staff_gudang">Staff Gudang</option>
                    <option value="staff_kantor">Staff Kantor</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/80 pt-4 mt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Ubah Password (Opsional)
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Password Saat Ini
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Lock size={16} />
                    </span>
                    <input
                      ref={currentPasswordRef}
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      onKeyDown={(e) => handleInputKeyDown(e, newPasswordRef)}
                      placeholder="Masukkan password saat ini"
                      className="input-field pl-9"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Password Baru
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <Lock size={16} />
                      </span>
                      <input
                        ref={newPasswordRef}
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, confirmPasswordRef)}
                        placeholder="Min. 6 karakter"
                        className="input-field pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Konfirmasi Password Baru
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <Lock size={16} />
                      </span>
                      <input
                        ref={confirmPasswordRef}
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, submitBtnRef)}
                        placeholder="Ulangi password baru"
                        className="input-field pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                ref={submitBtnRef}
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
                  <>
                    <Save size={16} className="mr-1.5" />
                    <span>Perbarui Profil</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setShowConfirmModal(false)}>
            <div
              className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in text-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Centered header with icon */}
              <div className="flex flex-col items-center text-center gap-2 bg-blue-50 border-b border-blue-100 px-5 py-4">
                <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                  <HelpCircle size={24} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Konfirmasi Perbarui Profil</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Periksa kembali data akun Anda</p>
                </div>
              </div>

              {/* Content body */}
              <div className="p-5 text-center text-sm text-slate-600 space-y-2">
                <p>Apakah Anda yakin ingin menyimpan perubahan data profil/password ini?</p>
                {newPassword && (
                  <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                    Catatan: Password akun Anda akan diubah.
                  </p>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-center gap-3 p-4 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={executeProfileUpdate}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                >
                  Ya, Perbarui Profil (Y)
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

