import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import api from '@/lib/api';
import { 
  User as UserIcon, 
  Lock, 
  Mail, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Save, 
  HelpCircle,
  Settings,
  Moon,
  Sun,
  Globe
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';

const translations = {
  id: {
    title: "Profil Pengguna",
    subtitle: "Informasi akun, username, dan pengaturan kata sandi Anda",
    accessRole: "Akses Role",
    editTitle: "Edit Profil & Kata Sandi",
    enterTip: "Pindah form dengan Enter",
    username: "Username",
    role: "Role Hak Akses",
    locked: "(Terkunci)",
    changePassword: "Ubah Password (Opsional)",
    currentPassword: "Password Saat Ini",
    newPassword: "Password Baru",
    confirmNewPassword: "Konfirmasi Password Baru",
    saveBtn: "Perbarui Profil",
    savingBtn: "Menyimpan...",
    settingsTitle: "Pengaturan Aplikasi",
    settingsSubtitle: "Sesuaikan preferensi tampilan dan bahasa sistem",
    darkMode: "Mode Gelap",
    darkModeDesc: "Ubah tampilan antarmuka ke mode gelap untuk kenyamanan mata",
    language: "Bahasa Tampilan",
    languageDesc: "Pilih bahasa sistem utama",
    modalTitle: "Konfirmasi Perbarui Profil",
    modalSub: "Periksa kembali data akun Anda",
    modalBody: "Apakah Anda yakin ingin menyimpan perubahan data profil/password ini?",
    modalWarning: "Catatan: Password akun Anda akan diubah.",
    modalCancel: "Batal",
    modalYes: "Ya, Perbarui Profil (Y)",
    successMsg: "Profil Anda berhasil diperbarui!",
    errorMsg: "Gagal memperbarui profil.",
    currentPassReq: "Password saat ini wajib diisi untuk mengubah password",
    passMismatch: "Password baru dan konfirmasi password tidak cocok",
    passMinLen: "Password baru minimal 6 karakter"
  },
  en: {
    title: "User Profile",
    subtitle: "Your account details, username, and password preferences",
    accessRole: "Access Role",
    editTitle: "Edit Profile & Password",
    enterTip: "Press Enter to navigate forms",
    username: "Username",
    role: "Access Role",
    locked: "(Locked)",
    changePassword: "Change Password (Optional)",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm New Password",
    saveBtn: "Update Profile",
    savingBtn: "Saving...",
    settingsTitle: "Application Settings",
    settingsSubtitle: "Customize interface preferences and system language",
    darkMode: "Dark Mode",
    darkModeDesc: "Switch the interface to dark mode for eye comfort",
    language: "Display Language",
    languageDesc: "Choose the main system language",
    modalTitle: "Confirm Profile Update",
    modalSub: "Please verify your account details",
    modalBody: "Are you sure you want to save these profile/password changes?",
    modalWarning: "Note: Your account password will be changed.",
    modalCancel: "Cancel",
    modalYes: "Yes, Update Profile (Y)",
    successMsg: "Your profile has been successfully updated!",
    errorMsg: "Failed to update profile.",
    currentPassReq: "Current password is required to change password",
    passMismatch: "New password and confirmation password do not match",
    passMinLen: "New password must be at least 6 characters"
  }
};

export const Profile: React.FC = () => {
  const { user, login, token } = useAuthStore();
  const { theme, language, toggleTheme, setLanguage } = useSettingsStore();
  const t = translations[language];

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
        setError(t.currentPassReq);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t.passMismatch);
        return;
      }
      if (newPassword.length < 6) {
        setError(t.passMinLen);
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

      setSuccess(t.successMsg);
      if (response.data?.user && token) {
        login(response.data.user, token);
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || t.errorMsg);
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
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">{t.title}</h1>
        <p className="text-slate-500">{t.subtitle}</p>
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
              <span className="capitalize">{user.role} {t.accessRole}</span>
            </div>
          </div>
        </div>

        {/* Update Form Card & Settings Stack */}
        <div className="md:col-span-2 space-y-6">
          {/* Update Form Card */}
          <div className="card card-hovered p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <UserIcon className="text-primary-600 w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-800">{t.editTitle}</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">{t.enterTip}</span>
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
                    {t.username}
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
                    <span>{t.role}</span>
                    {user.role !== 'super_admin' && (
                      <span className="text-[10px] text-amber-600 font-medium lowercase">
                        {t.locked}
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
                  {t.changePassword}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t.currentPassword}
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
                        placeholder={language === 'id' ? "Masukkan password saat ini" : "Enter current password"}
                        className="input-field pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        {t.newPassword}
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
                          placeholder={language === 'id' ? "Min. 6 karakter" : "Min. 6 characters"}
                          className="input-field pl-9"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        {t.confirmNewPassword}
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
                          placeholder={language === 'id' ? "Ulangi password baru" : "Repeat new password"}
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
                      <span>{t.savingBtn}</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-1.5" />
                      <span>{t.saveBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Settings Card */}
          <div className="card card-hovered p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="text-primary-600 w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-800">{t.settingsTitle}</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">{language.toUpperCase()}</span>
            </div>

            <div className="space-y-6">
              {/* Dark Mode Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex gap-3 items-start pr-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 mt-0.5">
                    {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{t.darkMode}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t.darkModeDesc}</p>
                  </div>
                </div>
                
                {/* iOS style toggle switch */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    theme === 'dark' ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Language Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex gap-3 items-start pr-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 mt-0.5">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{t.language}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t.languageDesc}</p>
                  </div>
                </div>

                <div className="relative shrink-0 w-full sm:w-48">
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="input-field cursor-pointer bg-white dark:bg-slate-950 text-slate-800 dark:text-white"
                  >
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English (US)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
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
                  <h2 className="font-bold text-slate-900 text-base">{t.modalTitle}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t.modalSub}</p>
                </div>
              </div>

              {/* Content body */}
              <div className="p-5 text-center text-sm text-slate-600 space-y-2">
                <p>{t.modalBody}</p>
                {newPassword && (
                  <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                    {t.modalWarning}
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
                  {t.modalCancel}
                </button>
                <button
                  type="button"
                  onClick={executeProfileUpdate}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                >
                  {t.modalYes}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

