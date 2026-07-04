import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { 
  Users, 
  Truck, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  X,
  AlertTriangle,
  ArrowLeft,
  UserCheck
} from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  no_telp: string | null;
  jatuh_tempo_bulan: number;
  limit_kredit: number;
  aktif: boolean;
}

interface Supplier {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  no_telp: string | null;
  jatuh_tempo_bulan: number;
  aktif: boolean;
}

export const MasterData: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');
  
  // Data lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 15;

  // Selected row indexing for keyboard nav
  const [selectedRowIdx, setSelectedRowIdx] = useState(0);

  // Modal States
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form states
  const [formKode, setFormKode] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formNoTelp, setFormNoTelp] = useState('');
  const [formJatuhTempo, setFormJatuhTempo] = useState(1);
  const [formLimitKredit, setFormLimitKredit] = useState(10000000);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const endpoint = activeTab === 'customer' ? '/customers' : '/suppliers';
      const res = await api.get(`${endpoint}?q=${searchQuery}&page=${page}&limit=${limit}`);
      if (activeTab === 'customer') {
        setCustomers(res.data.data || []);
      } else {
        setSuppliers(res.data.data || []);
      }
      setTotalItems(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    setSelectedRowIdx(0);
  }, [activeTab, searchQuery, page]);

  // Tab switching handler
  const handleTabChange = (tab: 'customer' | 'supplier') => {
    setActiveTab(tab);
    setSearchQuery('');
    setPage(1);
  };

  // Keyboard Navigation & Shortcuts
  // F1: Focus Search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F2: Add new record
  useHotkeys('f2', (e) => {
    e.preventDefault();
    openAddModal();
  }, { enableOnFormTags: false });

  // F3 / F4: Edit record
  const triggerEdit = () => {
    const list = activeTab === 'customer' ? customers : suppliers;
    if (list.length === 0 || selectedRowIdx >= list.length) return;
    openEditModal(list[selectedRowIdx]);
  };
  useHotkeys('f3', (e) => { e.preventDefault(); triggerEdit(); }, { enableOnFormTags: false });
  useHotkeys('f4', (e) => { e.preventDefault(); triggerEdit(); }, { enableOnFormTags: false });

  // Delete: Soft delete / deactivate record
  useHotkeys('del', (e) => {
    e.preventDefault();
    const list = activeTab === 'customer' ? customers : suppliers;
    if (list.length === 0 || selectedRowIdx >= list.length) return;
    setShowDeleteConfirm(true);
  }, { enableOnFormTags: false });

  // ArrowLeft / ArrowRight to slide tabs
  useHotkeys('left', (e) => {
    if (showAddEditModal || showDeleteConfirm) return;
    e.preventDefault();
    if (activeTab === 'supplier') handleTabChange('customer');
  }, { enableOnFormTags: false });

  useHotkeys('right', (e) => {
    if (showAddEditModal || showDeleteConfirm) return;
    e.preventDefault();
    if (activeTab === 'customer') handleTabChange('supplier');
  }, { enableOnFormTags: false });

  // ArrowUp / ArrowDown: Navigate items list
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (selectedRowIdx > 0) setSelectedRowIdx(selectedRowIdx - 1);
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    const list = activeTab === 'customer' ? customers : suppliers;
    if (selectedRowIdx < list.length - 1) setSelectedRowIdx(selectedRowIdx + 1);
  }, { enableOnFormTags: false });

  // PageUp / PageDown: Next/Prev pagination
  useHotkeys('pageup', (e) => {
    e.preventDefault();
    if (page > 1) setPage(page - 1);
  }, { enableOnFormTags: false });

  useHotkeys('pagedown', (e) => {
    e.preventDefault();
    const maxPage = Math.ceil(totalItems / limit);
    if (page < maxPage) setPage(page + 1);
  }, { enableOnFormTags: false });

  // Escape: clear search or exit modals
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showAddEditModal) {
      setShowAddEditModal(false);
    } else if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
    } else if (searchQuery) {
      setSearchQuery('');
    } else {
      navigate('/dashboard');
    }
  }, { enableOnFormTags: true });

  // Add / Edit actions
  const openAddModal = () => {
    setIsEditMode(false);
    setEditId(null);
    // Generate simple draft code or empty
    setFormKode('');
    setFormNama('');
    setFormAlamat('');
    setFormNoTelp('');
    setFormJatuhTempo(1);
    setFormLimitKredit(10000000);
    setShowAddEditModal(true);
  };

  const openEditModal = (item: any) => {
    setIsEditMode(true);
    setEditId(item.id);
    setFormKode(item.kode);
    setFormNama(item.nama);
    setFormAlamat(item.alamat || '');
    setFormNoTelp(item.no_telp || '');
    setFormJatuhTempo(item.jatuh_tempo_bulan || 1);
    setFormLimitKredit(item.limit_kredit || 10000000);
    setShowAddEditModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      kode: formKode,
      nama: formNama,
      alamat: formAlamat,
      no_telp: formNoTelp,
      jatuh_tempo_bulan: Number(formJatuhTempo),
    };

    if (activeTab === 'customer') {
      payload.limit_kredit = Number(formLimitKredit);
    }

    try {
      const endpoint = activeTab === 'customer' ? '/customers' : '/suppliers';
      if (isEditMode && editId) {
        await api.put(`${endpoint}/${editId}`, payload);
      } else {
        await api.post(endpoint, payload);
      }
      setShowAddEditModal(false);
      fetchRecords();
      alert(`Master Data ${activeTab === 'customer' ? 'Pelanggan' : 'Pemasok'} berhasil disimpan!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menyimpan master data. Pastikan kode unik tidak duplikat.');
    }
  };

  const handleDelete = async () => {
    const list = activeTab === 'customer' ? customers : suppliers;
    const target = list[selectedRowIdx];
    if (!target) return;

    try {
      const endpoint = activeTab === 'customer' ? '/customers' : '/suppliers';
      await api.delete(`${endpoint}/${target.id}`);
      setShowDeleteConfirm(false);
      fetchRecords();
      alert(`Status master data ${activeTab === 'customer' ? 'Pelanggan' : 'Pemasok'} berhasil dinonaktifkan (Soft-Delete).`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menghapus data.');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const activeList = activeTab === 'customer' ? customers : suppliers;
  const maxPages = Math.ceil(totalItems / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={12} /> Dashboard (Esc)
          </button>
          <h1 className="text-2xl font-extrabold text-white">Kelola Master Data</h1>
          <p className="text-slate-400 text-sm">Manajemen profil data master Pelanggan (Customer) dan Pemasok (Supplier).</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={openAddModal}
            className="btn-primary flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 font-bold"
          >
            <Plus size={14} />
            <span>Tambah Data (F2)</span>
          </button>
          <button 
            onClick={triggerEdit}
            disabled={activeList.length === 0}
            className="card bg-surface-800 hover:bg-surface-750 px-3.5 py-2 text-slate-300 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <Edit3 size={14} />
            <span>Edit Data (F3)</span>
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            disabled={activeList.length === 0}
            className="btn-danger flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>Hapus / Deaktif (Del)</span>
          </button>
        </div>
      </div>

      {/* Tabs Control Board */}
      <div className="flex gap-3 border-b border-surface-700/60 pb-px">
        <button
          onClick={() => handleTabChange('customer')}
          className={`flex items-center gap-2 px-5 py-3 font-extrabold text-sm border-b-2 transition-all ${
            activeTab === 'customer'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={16} />
          <span>Master Pelanggan (Customer)</span>
        </button>
        <button
          onClick={() => handleTabChange('supplier')}
          className={`flex items-center gap-2 px-5 py-3 font-extrabold text-sm border-b-2 transition-all ${
            activeTab === 'supplier'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck size={16} />
          <span>Master Supplier (Pemasok)</span>
        </button>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Nama / Kode SKU (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Cari ${activeTab === 'customer' ? 'pelanggan' : 'supplier'}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Info badges */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[10px] text-slate-450 block uppercase font-semibold">Total Item</span>
            <span className="font-bold text-white">{totalItems} Data Terdaftar</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-450 block uppercase font-semibold">Halaman</span>
            <span className="font-bold text-slate-300">{page} dari {maxPages || 1}</span>
          </div>
        </div>

        {/* Shortcuts Hints */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-500">
          <p>Gunakan <kbd className="shortcut-badge">&larr;</kbd> <kbd className="shortcut-badge">&rarr;</kbd> untuk berpindah Tab.</p>
          <p className="mt-1">Gunakan <kbd className="shortcut-badge">PgUp</kbd> <kbd className="shortcut-badge">PgDn</kbd> untuk pindah Halaman.</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">No</th>
              <th className="p-4 w-40">Kode Master</th>
              <th className="p-4">Nama Lengkap</th>
              <th className="p-4">No. Telpon</th>
              <th className="p-4">Alamat Fisik</th>
              <th className="p-4 text-center">Termin J.Tempo</th>
              {activeTab === 'customer' && <th className="p-4 text-right">Limit Kredit</th>}
              <th className="p-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-750">
            {isLoading ? (
              <tr>
                <td colSpan={activeTab === 'customer' ? 8 : 7} className="p-8 text-center text-slate-400 italic">
                  Sedang mengambil data master...
                </td>
              </tr>
            ) : activeList.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'customer' ? 8 : 7} className="p-8 text-center text-slate-500 italic">
                  Tidak ada data master ditemukan.
                </td>
              </tr>
            ) : (
              activeList.map((item, idx) => {
                const isSelected = selectedRowIdx === idx;
                const absoluteIdx = (page - 1) * limit + idx + 1;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedRowIdx(idx)}
                    className={`hover:bg-surface-750/30 cursor-pointer ${
                      isSelected ? 'bg-surface-750/50 text-white font-semibold' : 'text-slate-350'
                    }`}
                  >
                    <td className="p-4 text-center text-slate-500">{absoluteIdx}</td>
                    <td className="p-4 font-mono font-bold text-slate-200">{item.kode}</td>
                    <td className="p-4 font-bold text-slate-200">{item.nama}</td>
                    <td className="p-4 text-slate-400">{item.no_telp || '-'}</td>
                    <td className="p-4 text-slate-400 truncate max-w-xs">{item.alamat || '-'}</td>
                    <td className="p-4 text-center font-semibold text-slate-400">
                      {item.jatuh_tempo_bulan} Bulan
                    </td>
                    {activeTab === 'customer' && (
                      <td className="p-4 text-right font-mono text-white font-bold">
                        {formatCurrency((item as Customer).limit_kredit)}
                      </td>
                    )}
                    <td className="p-4 text-center">
                      {item.aktif ? (
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/30 inline-flex items-center gap-0.5">
                          <UserCheck size={9} /> Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-surface-900 text-slate-500 border border-surface-750 inline-flex items-center gap-0.5">
                          Non-Aktif
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer bar */}
      {maxPages > 1 && (
        <div className="flex justify-between items-center text-xs mt-2 print:hidden">
          <button
            onClick={() => page > 1 && setPage(page - 1)}
            disabled={page === 1}
            className="card bg-surface-800 hover:bg-surface-750 border border-surface-700/60 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
          >
            <ChevronLeft size={14} />
            <span>Sebelumnya</span>
          </button>

          <span className="text-slate-450">Halaman {page} dari {maxPages}</span>

          <button
            onClick={() => page < maxPages && setPage(page + 1)}
            disabled={page === maxPages}
            className="card bg-surface-800 hover:bg-surface-750 border border-surface-700/60 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
          >
            <span>Selanjutnya</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Form Add / Edit Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <form 
            onSubmit={handleSave}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in space-y-4"
          >
            <div className="flex justify-between items-center border-b border-surface-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{isEditMode ? 'Edit Profil' : 'Tambah Baru'} - {activeTab === 'customer' ? 'Pelanggan' : 'Supplier'}</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Kode Unik</label>
                <input
                  type="text"
                  required
                  disabled={isEditMode}
                  value={formKode}
                  onChange={(e) => setFormKode(e.target.value)}
                  placeholder="Kode (misal: CUST-09 atau SUPP-11)"
                  className="input-field w-full py-2"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Nama Lengkap / Instansi</label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Nama lengkap..."
                  className="input-field w-full py-2"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">No. Telpon / Handphone</label>
                <input
                  type="text"
                  value={formNoTelp}
                  onChange={(e) => setFormNoTelp(e.target.value)}
                  placeholder="No. Telp..."
                  className="input-field w-full py-2"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Alamat Fisik</label>
                <textarea
                  value={formAlamat}
                  onChange={(e) => setFormAlamat(e.target.value)}
                  rows={2}
                  placeholder="Alamat lengkap..."
                  className="input-field w-full py-1.5 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Jatuh Tempo (Bulan)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={formJatuhTempo}
                    onChange={(e) => setFormJatuhTempo(Number(e.target.value))}
                    className="input-field w-full py-2 text-center"
                  />
                </div>

                {activeTab === 'customer' && (
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Limit Kredit (Rp)</label>
                    <input
                      type="text"
                      required
                      value={formatRupiahInput(formLimitKredit)}
                      onChange={(e) => setFormLimitKredit(parseRupiahInput(e.target.value))}
                      className="input-field w-full py-2 text-right font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-surface-700 flex justify-between items-center text-xs">
              <span className="text-slate-400">Tekan <kbd className="shortcut-badge">Esc</kbd> untuk batal</span>
              <button 
                type="submit" 
                className="btn-primary py-2 px-5 font-bold"
              >
                Simpan Data
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in space-y-4">
            <div className="flex items-center gap-3 text-danger-400 border-b border-surface-700 pb-3">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-white">Deaktivasi Master Data</h3>
            </div>

            <p className="text-xs text-slate-300">
              Apakah Anda yakin ingin menonaktifkan data master {activeTab === 'customer' ? 'Pelanggan' : 'Supplier'} yang terpilih? 
              Data ini tidak akan muncul dalam opsi transaksi masa depan.
            </p>

            <div className="pt-2 border-t border-surface-700 flex justify-end gap-2 text-xs">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="card bg-surface-700 hover:bg-surface-650 px-4 py-2 text-slate-300 font-bold border border-surface-600 rounded-lg"
              >
                Batal (Esc)
              </button>
              <button 
                onClick={handleDelete}
                className="btn-danger py-2 px-5 font-bold"
              >
                Ya, Non-Aktifkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
