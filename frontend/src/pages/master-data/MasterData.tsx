import { ModalPortal } from '@/components/ui/ModalPortal';
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

interface MasterDataProps {
  type?: 'customer' | 'supplier';
}

export const MasterData: React.FC<MasterDataProps> = ({ type }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>(type || 'customer');

  useEffect(() => {
    if (type) {
      setActiveTab(type);
      setSearchQuery('');
      setPage(1);
    }
  }, [type]);

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
  const [isTableFocused, setIsTableFocused] = useState(false);

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

  const [deleteCheckState, setDeleteCheckState] = useState<{
    status: 'idle' | 'checking' | 'cannot_delete' | 'can_delete';
    amount: number;
    targetItem: any | null;
  }>({ status: 'idle', amount: 0, targetItem: null });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const formKodeRef = useRef<HTMLInputElement>(null);
  const formNamaRef = useRef<HTMLInputElement>(null);
  const formNoTelpRef = useRef<HTMLInputElement>(null);
  const formAlamatRef = useRef<HTMLTextAreaElement>(null);
  const formJatuhTempoRef = useRef<HTMLDivElement>(null);
  const formLimitKreditRef = useRef<HTMLInputElement>(null);

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

  // Focus modal inputs on open
  useEffect(() => {
    if (showAddEditModal) {
      setTimeout(() => {
        if (isEditMode) {
          formNamaRef.current?.focus();
          formNamaRef.current?.select();
        } else {
          formKodeRef.current?.focus();
          formKodeRef.current?.select();
        }
      }, 150);
    }
  }, [showAddEditModal, isEditMode]);

  // Initial focus on search input on mount
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  }, []);

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
  // Delete Check trigger
  const triggerDelete = async () => {
    const list = activeTab === 'customer' ? customers : suppliers;
    if (list.length === 0 || selectedRowIdx >= list.length) return;
    const target = list[selectedRowIdx];
    if (!target) return;

    setDeleteCheckState({ status: 'checking', amount: 0, targetItem: target });

    try {
      if (activeTab === 'customer') {
        const res = await api.get(`/customers/${target.id}`);
        const balance = Number(res.data.saldo_piutang) || 0;
        if (balance > 0) {
          setDeleteCheckState({ status: 'cannot_delete', amount: balance, targetItem: target });
        } else {
          setDeleteCheckState({ status: 'can_delete', amount: 0, targetItem: target });
        }
      } else {
        const res = await api.get('/payments/supplier/debt');
        const supplierDebt = res.data.find((d: any) => d.supplier.id === target.id);
        const balance = supplierDebt ? Number(supplierDebt.total_hutang) : 0;
        if (balance > 0) {
          setDeleteCheckState({ status: 'cannot_delete', amount: balance, targetItem: target });
        } else {
          setDeleteCheckState({ status: 'can_delete', amount: 0, targetItem: target });
        }
      }
    } catch (err) {
      console.error(err);
      setDeleteCheckState({ status: 'can_delete', amount: 0, targetItem: target });
    }
  };

  useHotkeys('f3', (e) => { e.preventDefault(); triggerEdit(); }, { enableOnFormTags: false });
  useHotkeys('f4', (e) => { e.preventDefault(); triggerEdit(); }, { enableOnFormTags: false });

  // Delete: Soft delete / deactivate record
  useHotkeys('del, delete', (e) => {
    e.preventDefault();
    if (showAddEditModal || deleteCheckState.status !== 'idle') return;
    triggerDelete();
  }, { enableOnFormTags: false }, [activeTab, customers, suppliers, selectedRowIdx, showAddEditModal, deleteCheckState]);

  // Enter key in confirm/warning delete modals
  useHotkeys('enter', (e) => {
    if (deleteCheckState.status === 'can_delete') {
      e.preventDefault();
      handleDelete();
    } else if (deleteCheckState.status === 'cannot_delete') {
      e.preventDefault();
      setDeleteCheckState({ status: 'idle', amount: 0, targetItem: null });
    }
  }, { enableOnFormTags: true }, [deleteCheckState, activeTab]);

  // ArrowLeft / ArrowRight to slide tabs
  useHotkeys('left', (e) => {
    if (type) return;
    if (showAddEditModal || deleteCheckState.status !== 'idle') return;
    e.preventDefault();
    if (activeTab === 'supplier') handleTabChange('customer');
  }, { enableOnFormTags: false }, [showAddEditModal, deleteCheckState, activeTab, type]);

  useHotkeys('right', (e) => {
    if (type) return;
    if (showAddEditModal || deleteCheckState.status !== 'idle') return;
    e.preventDefault();
    if (activeTab === 'customer') handleTabChange('supplier');
  }, { enableOnFormTags: false }, [showAddEditModal, deleteCheckState, activeTab, type]);

  // ArrowUp / ArrowDown: Navigate items list
  useHotkeys('up', (e) => {
    if (isTableFocused) {
      e.preventDefault();
      if (selectedRowIdx > 0) setSelectedRowIdx(selectedRowIdx - 1);
    }
  }, { enableOnFormTags: false }, [isTableFocused, selectedRowIdx]);

  useHotkeys('down', (e) => {
    if (isTableFocused) {
      e.preventDefault();
      const list = activeTab === 'customer' ? customers : suppliers;
      if (selectedRowIdx < list.length - 1) setSelectedRowIdx(selectedRowIdx + 1);
    }
  }, { enableOnFormTags: false }, [isTableFocused, selectedRowIdx, activeTab, customers, suppliers]);

  // PageUp / PageDown: Next/Prev pagination
  useHotkeys('pageup', (e) => {
    e.preventDefault();
    if (page > 1) setPage(page - 1);
  }, { enableOnFormTags: false }, [page]);

  useHotkeys('pagedown', (e) => {
    e.preventDefault();
    const maxPage = Math.ceil(totalItems / limit);
    if (page < maxPage) setPage(page + 1);
  }, { enableOnFormTags: false }, [page, totalItems, limit]);

  // Escape: clear search or exit modals
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showAddEditModal) {
      setShowAddEditModal(false);
    } else if (deleteCheckState.status !== 'idle') {
      setDeleteCheckState({ status: 'idle', amount: 0, targetItem: null });
    } else if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else if (searchQuery) {
      setSearchQuery('');
    } else {
      navigate('/master-data');
    }
  }, { enableOnFormTags: true }, [showAddEditModal, deleteCheckState, isTableFocused, searchQuery]);

  // Add / Edit actions
  const openAddModal = () => {
    setIsEditMode(false);
    setEditId(null);
    // Generate simple draft code or empty
    setFormKode('');
    setFormNama('');
    setFormAlamat('');
    setFormNoTelp('');
    setFormJatuhTempo(0);
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
    setFormJatuhTempo(item.jatuh_tempo_bulan || 0);
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
    const target = deleteCheckState.targetItem;
    if (!target) return;

    try {
      const endpoint = activeTab === 'customer' ? '/customers' : '/suppliers';
      await api.delete(`${endpoint}/${target.id}`);
      setDeleteCheckState({ status: 'idle', amount: 0, targetItem: null });
      fetchRecords();
      alert(`Status master data ${activeTab === 'customer' ? 'Pelanggan' : 'Pemasok'} berhasil dinonaktifkan (Soft-Delete).`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menonaktifkan data master.');
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeList.length > 0) {
        setIsTableFocused(true);
        setSelectedRowIdx(0);
        searchInputRef.current?.blur();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {type && (
            <button
              onClick={() => navigate('/master-data')}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all focus:outline-none"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950">
              {activeTab === 'customer' ? 'Master Pelanggan (Customer)' : 'Master Supplier'}
            </h1>
            <p className="text-slate-555 text-xs mt-0.5">
              {activeTab === 'customer'
                ? 'Manajemen profil data master pelanggan, kontak, limit kredit, dan termin jatuh tempo.'
                : 'Manajemen profil data master pemasok barang, kontak, alamat, dan termin pembayaran.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md shadow-blue-500/10 flex items-center gap-1.5 focus:outline-none"
          >
            <Plus size={14} />
            <span>Tambah Data (F2)</span>
          </button>
          <button
            onClick={triggerEdit}
            disabled={activeList.length === 0}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 focus:outline-none"
          >
            <Edit3 size={14} />
            <span>Edit Data (F3)</span>
          </button>
          <button
            onClick={triggerDelete}
            disabled={activeList.length === 0}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-red-655 hover:text-red-700 hover:bg-red-50 font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 focus:outline-none"
          >
            <Trash2 size={14} />
            <span>Hapus / Deaktif (Del)</span>
          </button>
        </div>
      </div>

      {/* Tabs Control Board */}
      {!type && (
        <div className="flex gap-3 border-b border-slate-200 pb-px">
          <button
            onClick={() => handleTabChange('customer')}
            className={`flex items-center gap-2 px-5 py-3 font-extrabold text-sm border-b-2 transition-all ${
              activeTab === 'customer'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users size={16} />
            <span>Master Pelanggan (Customer)</span>
          </button>
          <button
            onClick={() => handleTabChange('supplier')}
            className={`flex items-center gap-2 px-5 py-3 font-extrabold text-sm border-b-2 transition-all ${
              activeTab === 'supplier'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Truck size={16} />
            <span>Master Supplier (Pemasok)</span>
          </button>
        </div>
      )}

      {/* Control Board */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 text-slate-800">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <label className="block text-[10px] text-slate-555 mb-1 font-semibold uppercase tracking-wider">Cari Nama / Kode (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              autoFocus={true}
              placeholder={`Cari ${activeTab === 'customer' ? 'pelanggan' : 'supplier'}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
                setIsTableFocused(false);
              }}
              onKeyDown={handleSearchKeyDown}
              className="input-field w-full pl-9 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Info badges */}
        <div className="flex items-center gap-6 text-xs text-slate-700 shrink-0 self-end md:self-center md:pt-4">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Total Item</span>
            <span className="font-bold text-slate-900">{totalItems} Data Terdaftar</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Halaman</span>
            <span className="font-bold text-slate-900">{page} dari {maxPages || 1}</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
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
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={activeTab === 'customer' ? 8 : 7} className="p-8 text-center text-slate-500 italic">
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
                const isSelected = selectedRowIdx === idx && isTableFocused;
                const absoluteIdx = (page - 1) * limit + idx + 1;

                const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                  let base = "p-4 text-xs transition-all duration-150 border-b ";
                  if (isSelected) {
                    base += "bg-blue-100 text-blue-950 font-bold border-blue-300 ";
                    if (pos === 'first') base += "border-l-4 border-blue-600 ";
                  } else {
                    base += "text-slate-800 border-slate-100 ";
                  }
                  return base;
                };

                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setSelectedRowIdx(idx);
                      setIsTableFocused(true);
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                      }
                    }}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-100' : 'hover:bg-slate-50'
                      }`}
                  >
                    <td className={`${getTdClass('first')} text-center font-mono ${isSelected ? 'text-blue-950' : 'text-slate-400'}`}>{absoluteIdx}</td>
                    <td className={`${getTdClass('middle')} font-mono font-bold ${isSelected ? 'text-blue-950' : 'text-slate-800'}`}>{item.kode}</td>
                    <td className={`${getTdClass('middle')} font-bold ${isSelected ? 'text-blue-950' : 'text-slate-800'}`}>{item.nama}</td>
                    <td className={`${getTdClass('middle')} ${isSelected ? 'text-blue-950' : 'text-slate-600'}`}>{item.no_telp || '-'}</td>
                    <td className={`${getTdClass('middle')} truncate max-w-xs ${isSelected ? 'text-blue-950' : 'text-slate-600'}`}>{item.alamat || '-'}</td>
                    <td className={`${getTdClass('middle')} text-center font-medium ${isSelected ? 'text-blue-950' : 'text-slate-650'}`}>
                      {item.jatuh_tempo_bulan === 0 ? 'Tunai' : `${item.jatuh_tempo_bulan} Bulan`}
                    </td>
                    {activeTab === 'customer' && (
                      <td className={`${getTdClass('middle')} text-right font-mono font-bold ${isSelected ? 'text-blue-950' : 'text-slate-900'}`}>
                        {formatCurrency((item as Customer).limit_kredit)}
                      </td>
                    )}
                    <td className={`${getTdClass('last')} text-center`}>
                      {item.aktif ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-0.5">
                          <UserCheck size={9} /> Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 inline-flex items-center gap-0.5">
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
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1"
          >
            <ChevronLeft size={14} />
            <span>Sebelumnya</span>
          </button>

          <span className="text-slate-500">Halaman {page} dari {maxPages}</span>

          <button
            onClick={() => page < maxPages && setPage(page + 1)}
            disabled={page === maxPages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1"
          >
            <span>Selanjutnya</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Form Add / Edit Modal */}
      {showAddEditModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowAddEditModal(false)} />
          <form
            onSubmit={handleSave}
            className="z-10 bg-white border border-slate-200 rounded-xl overflow-hidden max-w-md w-full mx-4 shadow-2xl animate-scale-in flex flex-col"
          >
            <div className="bg-blue-600 !text-white px-6 py-4 flex justify-between items-center border-b border-blue-700">
              <h3 className="text-base font-bold !text-white flex items-center gap-2">
                <span>{isEditMode ? 'Edit Profil' : 'Tambah Baru'} - {activeTab === 'customer' ? 'Pelanggan' : 'Supplier'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="!text-white/80 hover:!text-white transition-colors focus:outline-none"
              >
                <X size={18} className="!text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Kode Unik</label>
                <input
                  ref={formKodeRef}
                  type="text"
                  required
                  disabled={isEditMode}
                  value={formKode}
                  onChange={(e) => setFormKode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Enter') {
                      e.preventDefault();
                      formNamaRef.current?.focus();
                      formNamaRef.current?.select();
                    }
                  }}
                  placeholder="Kode (misal: CUST-09 atau SUPP-11)"
                  className="input-field w-full py-2.5 px-3 border border-slate-350 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Nama Lengkap / Instansi</label>
                <input
                  ref={formNamaRef}
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Enter') {
                      e.preventDefault();
                      formNoTelpRef.current?.focus();
                      formNoTelpRef.current?.select();
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      formKodeRef.current?.focus();
                      formKodeRef.current?.select();
                    }
                  }}
                  placeholder="Nama lengkap..."
                  className="input-field w-full py-2.5 px-3 border border-slate-350 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">No. Telpon / Handphone</label>
                <input
                  ref={formNoTelpRef}
                  type="text"
                  value={formNoTelp}
                  onChange={(e) => setFormNoTelp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Enter') {
                      e.preventDefault();
                      formAlamatRef.current?.focus();
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      formNamaRef.current?.focus();
                      formNamaRef.current?.select();
                    }
                  }}
                  placeholder="No. Telp..."
                  className="input-field w-full py-2.5 px-3 border border-slate-350 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Alamat Fisik</label>
                <textarea
                  ref={formAlamatRef}
                  value={formAlamat}
                  onChange={(e) => setFormAlamat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      formJatuhTempoRef.current?.focus();
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      formNoTelpRef.current?.focus();
                      formNoTelpRef.current?.select();
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      formJatuhTempoRef.current?.focus();
                    }
                  }}
                  rows={2}
                  placeholder="Alamat lengkap..."
                  className="input-field w-full py-2 px-3 border border-slate-350 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Termin Jatuh Tempo</label>
                  <div
                    ref={formJatuhTempoRef}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      const list = [0, 1, 2, 3];
                      const currIdx = list.indexOf(formJatuhTempo);
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        setFormJatuhTempo(list[(currIdx + 1) % list.length]);
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setFormJatuhTempo(list[(currIdx - 1 + list.length) % list.length]);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        formAlamatRef.current?.focus();
                      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                        e.preventDefault();
                        if (activeTab === 'customer') {
                          formLimitKreditRef.current?.focus();
                          formLimitKreditRef.current?.select();
                        } else {
                          handleSave(e);
                        }
                      }
                    }}
                    className="flex gap-2 p-1 bg-slate-100 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  >
                    {[
                      { val: 0, label: 'Tunai' },
                      { val: 1, label: '1 Bln' },
                      { val: 2, label: '2 Bln' },
                      { val: 3, label: '3 Bln' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          setFormJatuhTempo(opt.val);
                          formJatuhTempoRef.current?.focus();
                        }}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center ${formJatuhTempo === opt.val
                          ? 'bg-blue-600 text-white shadow font-extrabold'
                          : 'text-slate-550 hover:text-slate-700 bg-white border border-slate-200'
                          }`}
                      >
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {activeTab === 'customer' && (
                  <div>
                    <label className="block text-slate-500 mb-1 font-semibold">Limit Kredit (Rp)</label>
                    <input
                      ref={formLimitKreditRef}
                      type="text"
                      required
                      value={formatRupiahInput(formLimitKredit)}
                      onChange={(e) => setFormLimitKredit(parseRupiahInput(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          formJatuhTempoRef.current?.focus();
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSave(e);
                        }
                      }}
                      className="input-field w-full py-2.5 text-right font-mono border border-slate-355 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="px-4 py-2 text-xs font-bold border border-slate-250 rounded-lg text-slate-600 bg-white hover:bg-slate-50 shadow-sm flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <span>Batal (Esc)</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-450"
              >
                Simpan Data
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Delete / Deactivate Checker Modals */}
      {deleteCheckState.status === 'checking' && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-xs" />
          <div className="z-10 bg-white border border-slate-200 rounded-xl p-6 max-w-xs w-full shadow-2xl animate-scale-in text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Memeriksa status piutang/hutang...</p>
          </div>
        </div>
        </ModalPortal>
      )}

      {deleteCheckState.status === 'cannot_delete' && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-xs" onClick={() => setDeleteCheckState({ status: 'idle', amount: 0, targetItem: null })} />
          <div className="z-10 bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm w-full mx-4 shadow-2xl animate-scale-in flex flex-col text-slate-800">
            <div className="flex items-center gap-3 bg-red-50 border-b border-red-100 px-6 py-4 text-red-750">
              <AlertTriangle size={24} className="text-red-500 animate-bounce" />
              <h3 className="text-sm font-black uppercase tracking-wider text-red-800">Tidak Bisa Dihapus</h3>
            </div>

            <div className="p-6 space-y-4 text-xs font-semibold text-slate-650 leading-relaxed">
              <p>
                Data master <strong className="text-slate-900">{deleteCheckState.targetItem?.nama}</strong> tidak dapat dinonaktifkan karena masih memiliki saldo{' '}
                <strong className="text-red-700">
                  {activeTab === 'customer' ? 'piutang aktif' : 'hutang belum lunas'} sebesar {formatCurrency(deleteCheckState.amount)}
                </strong>.
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Harap selesaikan pelunasan seluruh transaksi sebelum menonaktifkan data master ini.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteCheckState({ status: 'idle', amount: 0, targetItem: null })}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                Tutup (Enter)
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {deleteCheckState.status === 'can_delete' && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-xs" onClick={() => setDeleteCheckState({ status: 'idle', amount: 0, targetItem: null })} />
          <div className="z-10 bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm w-full mx-4 shadow-2xl animate-scale-in flex flex-col text-slate-800">
            <div className="flex items-center gap-3 bg-red-500/10 border-b border-red-500/20 px-6 py-4 text-red-655">
              <AlertTriangle size={24} className="text-red-500 animate-bounce" />
              <h3 className="text-sm font-black uppercase tracking-wider text-red-700">Deaktivasi Master Data</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                Apakah Anda yakin ingin menonaktifkan data master <strong className="text-slate-900">{deleteCheckState.targetItem?.nama}</strong>?
                Data ini tidak akan muncul dalam opsi transaksi masa depan.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteCheckState({ status: 'idle', amount: 0, targetItem: null })}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-350"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-650 hover:bg-red-700 text-red-600 font-bold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-red-450"
              >
                Ya, Non-Aktifkan (Enter)
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
