import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import {
  UserCheck,
  UserPlus,
  Search,
  Shield,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  User as UserIcon,
  Lock,
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';

type RoleType = 'super_admin' | 'admin' | 'staff_gudang' | 'staff_kantor' | 'sales';

interface ProfileData {
  id: string;
  email: string;
  username: string;
  nama: string;
  role: RoleType;
  aktif: boolean;
  created_at: string;
}

const roleOptions: Array<{ id: RoleType; label: string; desc: string }> = [
  { id: 'super_admin', label: 'Super Admin', desc: 'Semua Fitur' },
  { id: 'admin', label: 'Admin', desc: 'Data & Laporan' },
  { id: 'staff_gudang', label: 'Staff Gudang', desc: 'Stok & Pembelian' },
  { id: 'staff_kantor', label: 'Staff Kantor', desc: 'Read-Only Laporan' },
  { id: 'sales', label: 'Sales', desc: 'SO & AR' },
];

export const KelolaUser: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<ProfileData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Toast / Alerts
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileData | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleType>('staff_kantor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Refs for navigation & focus
  const searchInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const roleBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/profiles');
      setUsers(res.data || []);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal memuat data pegawai');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setRole('staff_kantor');
    setFormError(null);
  };

  // Initial focus on Search Input
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (selectedIdx >= filteredUsers.length) {
      setSelectedIdx(Math.max(0, filteredUsers.length - 1));
    }
  }, [filteredUsers.length, selectedIdx]);

  // Global Keyboard Hotkeys: F1 for Search, F2 for Add User, F3 for First Row, Arrow Up/Down for table row selection, Enter for Edit, Delete/Del for Delete
  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      // If modal is active, handle inside modal hooks
      if (showAddModal || editTarget || deleteTarget) return;

      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleOpenAddModal();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setSelectedIdx(0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, filteredUsers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (filteredUsers[selectedIdx]) {
          e.preventDefault();
          handleOpenEditModal(filteredUsers[selectedIdx]);
        }
      } else if (e.key === 'Delete' || e.key === 'Del') {
        if (filteredUsers[selectedIdx]) {
          const target = filteredUsers[selectedIdx];
          if (currentUser?.id !== target.id) {
            e.preventDefault();
            setDeleteTarget(target);
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalHotkeys);
    return () => window.removeEventListener('keydown', handleGlobalHotkeys);
  }, [showAddModal, editTarget, deleteTarget, filteredUsers, selectedIdx, currentUser]);

  // Auto focus username field on popup open
  useEffect(() => {
    if (showAddModal || editTarget) {
      const timer = setTimeout(() => {
        if (usernameInputRef.current) {
          usernameInputRef.current.focus();
          usernameInputRef.current.select();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showAddModal, editTarget]);

  // Reset form when modal state changes
  useEffect(() => {
    if (showAddModal) {
      resetForm();
    }
  }, [showAddModal]);

  useEffect(() => {
    if (!showAddModal && !editTarget) {
      resetForm();
    }
  }, [showAddModal, editTarget]);

  // Modal Keyboard Listener for Add / Edit Modal (Escape to close)
  useEffect(() => {
    if (!showAddModal && !editTarget) return;
    const handleModalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAddModal(false);
        setEditTarget(null);
        resetForm();
      }
    };
    window.addEventListener('keydown', handleModalEsc);
    return () => window.removeEventListener('keydown', handleModalEsc);
  }, [showAddModal, editTarget]);

  // Modal Keyboard Listeners for Delete Confirm (Y / Enter / Esc)
  useEffect(() => {
    if (!deleteTarget) return;
    const handleDeleteModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
        e.preventDefault();
        handleDeleteUser();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleDeleteModalKeyDown);
    return () => window.removeEventListener('keydown', handleDeleteModalKeyDown);
  }, [deleteTarget]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenAddModal = () => {
    setEditTarget(null);
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEditModal = (target: ProfileData) => {
    setShowAddModal(false);
    setEditTarget(target);
    setUsername(target.username);
    setPassword('');
    setRole(target.role);
    setFormError(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setFormError('Username wajib diisi');
      return;
    }

    if (!editTarget && !password.trim()) {
      setFormError('Password wajib diisi untuk user baru');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editTarget) {
        // Update user
        await api.put(`/profiles/${editTarget.id}`, {
          username: username.trim(),
          role,
          password: password.trim() || undefined,
        });
        showToast('success', `Data user ${username.trim()} berhasil diperbarui`);
        setEditTarget(null);
      } else {
        // Create user
        await api.post('/profiles', {
          username: username.trim(),
          password: password.trim(),
          role,
        });
        showToast('success', `User baru ${username.trim()} berhasil ditambahkan`);
        setShowAddModal(false);
      }
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Gagal menyimpan data user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/profiles/${deleteTarget.id}`);
      showToast('success', `User ${deleteTarget.username} berhasil dihapus`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Gagal menghapus user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordInputRef.current?.focus();
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const selectedIdx = roleOptions.findIndex((opt) => opt.id === role);
      const targetIdx = selectedIdx >= 0 ? selectedIdx : 0;
      roleBtnRefs.current[targetIdx]?.focus();
    }
  };

  const handleRoleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIndex + 1) % roleOptions.length;
      setRole(roleOptions[nextIdx].id);
      roleBtnRefs.current[nextIdx]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIndex - 1 + roleOptions.length) % roleOptions.length;
      setRole(roleOptions[prevIdx].id);
      roleBtnRefs.current[prevIdx]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submitBtnRef.current?.focus();
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'super_admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'admin':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'staff_gudang':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'staff_kantor':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'sales':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const formatRoleLabel = (r: string) => {
    switch (r) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'staff_gudang': return 'Staff Gudang';
      case 'staff_kantor': return 'Staff Kantor';
      case 'sales': return 'Sales';
      default: return r;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-slide-left">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border ${toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-red-600 text-white border-red-500'
              }`}
          >
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="text-slate-700 w-6 h-6" />
            <span>Kelola Hak Akses & Pegawai</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Manajemen akun username pegawai dan pembagian role hak akses (Khusus Super Admin)
          </p>
        </div>

        <button onClick={handleOpenAddModal} className="btn-primary shrink-0">
          <UserPlus size={16} className="mr-1.5" />
          <span>Tambah User Pegawai (F2)</span>
        </button>
      </div>

      {/* Search Bar & Keyboard Badges */}
      <div className="space-y-2">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Search size={18} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan username atau role... (Tekan F1)"
              className="input-field pl-10 w-full bg-white text-slate-800"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Hotkey Guide */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 shadow-xs">F1</kbd>
            <span>Cari</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 shadow-xs">F2</kbd>
            <span>Tambah</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 shadow-xs">F3</kbd>
            <span>Baris Pertama</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 shadow-xs">↑ / ↓</kbd>
            <span>Pilih Baris</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 shadow-xs">Enter</kbd>
            <span>Edit</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 shadow-xs">Del</kbd>
            <span>Hapus</span>
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="p-4">Username Pegawai</th>
                <th className="p-4">Role Hak Akses</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                    <span>Memuat daftar pegawai...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-400">
                    Tidak ada pegawai ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isSelected = idx === selectedIdx;
                  const rowBgClass = isSelected ? 'bg-blue-100' : 'hover:bg-slate-50/50';

                  const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                    let base = "p-4 text-xs transition-all duration-150 border-b ";
                    if (isSelected) {
                      base += "bg-blue-100 text-slate-900 font-bold border-blue-300 ";
                      if (pos === 'first') base += "border-l-4 border-blue-600 ";
                    } else {
                      base += "text-slate-800 border-slate-200 ";
                    }
                    return base;
                  };

                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedIdx(idx)}
                      onDoubleClick={() => handleOpenEditModal(u)}
                      className={`cursor-pointer ${rowBgClass}`}
                    >
                      <td className={getTdClass('first')}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${isSelected ? 'bg-blue-600' : 'bg-slate-700'}`}
                            style={{ color: '#ffffff' }}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span>{u.username}</span>
                            {isCurrent && (
                              <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${isSelected ? 'bg-blue-200 text-blue-900' : 'bg-emerald-100 text-emerald-800'}`}>
                                Akun Anda
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={getTdClass('middle')}>
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {formatRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className={getTdClass('last') + " text-center"}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(u);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'text-blue-700 hover:bg-blue-200/80' : 'text-slate-600 hover:bg-slate-100'}`}
                            title="Edit Role / Password (Enter)"
                          >
                            <Edit2 size={16} />
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(u);
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'text-red-700 hover:bg-red-200/80' : 'text-red-600 hover:bg-red-50'}`}
                              title="Hapus Akun User (Del)"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit User */}
      {(showAddModal || editTarget) && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => {
              setShowAddModal(false);
              setEditTarget(null);
              resetForm();
            }}
          >
            <div
              className="relative bg-white border border-slate-200/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-800 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">
                      {editTarget ? `Edit User ${editTarget.username}` : 'Tambah User Pegawai'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {editTarget ? 'Perbarui username, role, atau reset password' : 'Isi informasi akun user pegawai baru'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditTarget(null);
                    resetForm();
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form
                key={showAddModal ? 'add-form' : editTarget ? `edit-form-${editTarget.id}` : 'empty-form'}
                onSubmit={handleSaveUser}
                autoComplete="off"
                className="p-6 space-y-4"
              >

                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                      <UserIcon size={16} />
                    </span>
                    <input
                      ref={usernameInputRef}
                      type="text"
                      required
                      autoComplete="off"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleUsernameKeyDown}
                      placeholder="Masukkan username pegawai"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {editTarget ? 'Password Baru (Opsional)' : 'Password'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                      <Lock size={16} />
                    </span>
                    <input
                      ref={passwordInputRef}
                      type="password"
                      required={!editTarget}
                      autoComplete="off"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handlePasswordKeyDown}
                      placeholder={editTarget ? '•••••••• (Kosongkan jika tidak diubah)' : 'Masukkan password'}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Role Hak Akses
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {roleOptions.map((opt, idx) => {
                      const isSelected = role === opt.id;
                      return (
                        <button
                          key={opt.id}
                          ref={(el) => { roleBtnRefs.current[idx] = el; }}
                          type="button"
                          onClick={() => setRole(opt.id)}
                          onKeyDown={(e) => handleRoleKeyDown(e, idx)}
                          className={`p-2.5 rounded-xl border text-left flex flex-col transition-all outline-none text-xs cursor-pointer ${isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md font-bold scale-[1.02]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                        >
                          <span className="font-bold text-xs">{opt.label}</span>
                          <span className={`text-[10px] font-normal mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditTarget(null);
                      resetForm();
                    }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    ref={submitBtnRef}
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>{editTarget ? 'Simpan Perubahan' : 'Tambah User'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <div
              className="relative bg-white border border-slate-200/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-800 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex flex-col items-center text-center gap-2 bg-red-50/70 border-b border-red-100 px-6 py-5">
                <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shadow-xs mb-1">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Hapus Akun User Pegawai</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>

              {/* Message */}
              <div className="p-6 text-center text-sm text-slate-600">
                <p>
                  Apakah Anda yakin ingin menghapus akun pegawai{' '}
                  <strong className="text-slate-900 font-bold px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">{deleteTarget.username}</strong>?
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl shadow-md shadow-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Ya, Hapus Akun (Y / Enter)</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
