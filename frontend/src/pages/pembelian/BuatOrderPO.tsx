import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Search, ChevronRight, X, Calendar, User, CreditCard, AlertTriangle } from 'lucide-react';
import { todayString, formatCurrency } from '@/lib/utils';

interface Supplier {
  id: string;
  kode: string;
  nama: string;
  jatuh_tempo_bulan: number;
}

interface SupplierStats {
  total_transaksi_bulan_ini: number;
  nominal_transaksi_bulan_ini: number;
  piutang: number;
  terakhir_order: string | null;
  jatuh_tempo: number;
  alamat: string | null;
  no_telp: string | null;
  kode: string;
  nama: string;
}

const rankResults = (items: any[], query: string, searchKeys: string[] = ['nama', 'kode']) => {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return [...items].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
  }
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  return items
    .map((item) => {
      let matchedCount = 0;
      let minMatchIndex = Infinity;

      tokens.forEach((token) => {
        let foundInKey = false;
        searchKeys.forEach((key) => {
          const value = (item[key] || '').toLowerCase();
          const idx = value.indexOf(token);
          if (idx !== -1) {
            foundInKey = true;
            minMatchIndex = Math.min(minMatchIndex, idx);
          }
        });
        if (foundInKey) matchedCount++;
      });

      return { item, matchedCount, minMatchIndex };
    })
    .filter((res) => res.matchedCount > 0)
    .sort((a, b) => {
      if (b.matchedCount !== a.matchedCount) {
        return b.matchedCount - a.matchedCount;
      }
      if (a.minMatchIndex !== b.minMatchIndex) {
        return a.minMatchIndex - b.minMatchIndex;
      }
      return (a.item.nama || '').localeCompare(b.item.nama || '');
    })
    .map((res) => res.item);
};

export const BuatOrderPO: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();

  const [poMetaSaved] = useState(() => {
    const saved = sessionStorage.getItem('po_step1');
    return saved ? JSON.parse(saved) : null;
  });

  const [noOrder, setNoOrder] = useState(poMetaSaved?.noOrder || '');
  const [orderDate, setOrderDate] = useState(poMetaSaved?.orderDate || todayString());
  const [supplierQuery, setSupplierQuery] = useState(poMetaSaved?.supplier?.nama || '');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(poMetaSaved?.supplier || null);
  const [terms, setTerms] = useState<'tunai' | '1' | '2' | '3'>(poMetaSaved ? poMetaSaved.terms : 'tunai');
  const [supplierStats, setSupplierStats] = useState<SupplierStats | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal / Popup
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierPopup, setShowSupplierPopup] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Focus tracking for Enter navigation
  const [activeStep, setActiveStep] = useState<'date' | 'supplier' | 'terms'>('date');

  const dateInputRef = useRef<HTMLInputElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const termsSelectRef = useRef<HTMLDivElement>(null);
  const supplierPopupRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (showSupplierPopup) {
      const target = itemRefs.current[focusedIndex];
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, showSupplierPopup]);

  // Focus modal popups when shown
  useEffect(() => {
    if (showSupplierPopup) {
      setTimeout(() => {
        supplierPopupRef.current?.focus();
      }, 100);
    }
  }, [showSupplierPopup]);

  useEffect(() => {
    if (!noOrder) {
      api.get('/purchases/generate-no').then((res) => {
        setNoOrder(res.data.no_order);
      });
    }
    dateInputRef.current?.focus();
  }, []);

  // Fetch stats if preselected on refresh
  useEffect(() => {
    if (selectedSupplier && !supplierStats) {
      api.get(`/suppliers/${selectedSupplier.id}/summary-stats`).then((res) => {
        setSupplierStats(res.data);
      }).catch(err => {
        console.error('Gagal mengambil statistik supplier', err);
      });
    }
  }, [selectedSupplier, supplierStats]);

  // Sync to sessionStorage on change
  useEffect(() => {
    const poMeta = {
      noOrder,
      orderDate,
      supplier: selectedSupplier,
      terms,
    };
    sessionStorage.setItem('po_step1', JSON.stringify(poMeta));
  }, [noOrder, orderDate, selectedSupplier, terms]);

  // Fetch Suppliers on query change
  useEffect(() => {
    if (!supplierQuery.trim()) {
      setSuppliers([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/suppliers?q=${supplierQuery}&limit=50`);
        const rawData = res.data.data || [];
        const ranked = rankResults(rawData, supplierQuery);
        setSuppliers(ranked);
        setFocusedIndex(0);
      } catch (err) {
        console.error(err);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [supplierQuery]);

  // Handle Enter to step through fields
  const handleDateEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setActiveStep('supplier');
      supplierInputRef.current?.focus();
    }
  };

  const handleSupplierKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = supplierQuery.trim();
      if (selectedSupplier && trimmed.toLowerCase() === selectedSupplier.nama.toLowerCase()) {
        setActiveStep('terms');
        termsSelectRef.current?.focus();
      } else {
        if (!trimmed) {
          try {
            const res = await api.get(`/suppliers?limit=50`);
            const rawData = res.data.data || [];
            const ranked = rankResults(rawData, '');
            setSuppliers(ranked);
          } catch (err) {
            console.error(err);
          }
        }
        setShowSupplierPopup(true);
        setFocusedIndex(0);
      }
    }
  };

  const selectSupplier = async (supp: Supplier) => {
    setSelectedSupplier(supp);
    setSupplierQuery(supp.nama);
    setShowSupplierPopup(false);
    setFormError(null);

    // Auto adjust terms berdasarkan database supplier
    if (supp.jatuh_tempo_bulan === 1) {
      setTerms('1');
    } else if (supp.jatuh_tempo_bulan === 2) {
      setTerms('2');
    } else if (supp.jatuh_tempo_bulan === 3) {
      setTerms('3');
    } else {
      setTerms('tunai');
    }

    try {
      const res = await api.get(`/suppliers/${supp.id}/summary-stats`);
      setSupplierStats(res.data);
    } catch (err) {
      console.error('Gagal mengambil statistik supplier', err);
    }

    supplierInputRef.current?.focus();
  };

  const handleSupplierPopupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowSupplierPopup(false);
      supplierInputRef.current?.focus();
      return;
    }
    if (suppliers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % suppliers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + suppliers.length) % suppliers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectSupplier(suppliers[focusedIndex]);
    }
  };

  // Terms Shortcuts (1-4)
  useHotkeys('1', (e) => { if (activeStep === 'terms') { e.preventDefault(); setTerms('tunai'); } }, { enableOnFormTags: true });
  useHotkeys('2', (e) => { if (activeStep === 'terms') { e.preventDefault(); setTerms('1'); } }, { enableOnFormTags: true });
  useHotkeys('3', (e) => { if (activeStep === 'terms') { e.preventDefault(); setTerms('2'); } }, { enableOnFormTags: true });
  useHotkeys('4', (e) => { if (activeStep === 'terms') { e.preventDefault(); setTerms('3'); } }, { enableOnFormTags: true });

  const handleTermsKeyDown = (e: React.KeyboardEvent) => {
    const list: Array<'tunai' | '1' | '2' | '3'> = ['tunai', '1', '2', '3'];
    const currIdx = list.indexOf(terms);

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setTerms(list[(currIdx + 1) % list.length]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setTerms(list[(currIdx - 1 + list.length) % list.length]);
    } else if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      navigate('/pembelian');
    }
  };

  // Backspace to navigate backwards
  const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !supplierQuery && activeStep === 'supplier') {
      setActiveStep('date');
      dateInputRef.current?.focus();
    } else if (e.key === 'Backspace' && activeStep === 'terms') {
      setActiveStep('supplier');
      supplierInputRef.current?.focus();
    }
  };

  const handleSubmit = () => {
    if (!selectedSupplier || !supplierQuery.trim() || selectedSupplier.nama.toLowerCase() !== supplierQuery.trim().toLowerCase()) {
      setFormError(lang === 'en' ? 'Supplier Name cannot be empty and must be selected from the list.' : 'Nama Pemasok (Supplier) tidak boleh kosong dan harus dipilih dari daftar autocomplete.');
      return;
    }
    setFormError(null);

    // Save metadata in sessionStorage
    const poMeta = {
      noOrder,
      orderDate,
      supplier: selectedSupplier,
      terms,
    };
    sessionStorage.setItem('po_step1', JSON.stringify(poMeta));
    navigate('/pembelian/input');
  };

  // Global escape
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/pembelian');
  }, { enableOnFormTags: true });

  return (
    <div className="w-full space-y-6" onKeyDown={handleGlobalKeyDown}>
      <div>
        <h1 className="text-2xl font-extrabold text-white">
          {lang === 'en' ? 'Create Purchase Order (Step 1)' : 'Buat Order PO (Step 1)'}
        </h1>
        <p className="text-slate-400">
          {lang === 'en' ? 'Select supplier, date, and payment terms for PO' : 'Pilih supplier, tanggal, dan jangka waktu pembayaran PO'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Left Column: Form Input (Takes 1 col in 50:50 split) */}
        <div className="lg:col-span-1 space-y-4">
          {formError && (
            <div className="p-4 rounded-lg bg-danger-600/15 border border-danger-500/30 text-danger-400 text-sm flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-danger-400" />
              <div className="flex-1">
                <p className="font-bold">{lang === 'en' ? 'Validation Error' : 'Kesalahan Validasi'}</p>
                <p className="text-xs opacity-90 mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          <div className="card card-hovered p-6 space-y-5 shadow-xl">
            {/* PO Number & Order Date side-by-side */}
            <div className="grid grid-cols-2 gap-4">
              {/* PO Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {lang === 'en' ? 'PO Number (Auto)' : 'Nomor PO (Otomatis)'}
                </label>
                <input
                  type="text"
                  readOnly
                  value={noOrder || 'Generating...'}
                  className="input-field bg-surface-900 border-surface-700 text-slate-500 font-mono"
                />
              </div>

              {/* Order Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {lang === 'en' ? 'Order Date' : 'Tanggal Order'} <span className="shortcut-badge text-[9px] ml-1">Enter</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Calendar size={16} />
                  </span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    onKeyDown={handleDateEnter}
                    onFocus={() => setActiveStep('date')}
                    className={`input-field pl-9 ${activeStep === 'date' ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Supplier Selector */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {lang === 'en' ? 'Supplier (Pemasok)' : 'Pemasok (Supplier)'} <span className="shortcut-badge text-[9px] ml-1">{lang === 'en' ? 'Type & Select' : 'Ketik & Pilih'}</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <User size={16} />
                </span>
                <input
                  ref={supplierInputRef}
                  type="text"
                  value={supplierQuery}
                  onChange={(e) => {
                    setSupplierQuery(e.target.value);
                  }}
                  onFocus={() => {
                    setActiveStep('supplier');
                  }}
                  onKeyDown={handleSupplierKeyDown}
                  placeholder={lang === 'en' ? 'Search Supplier...' : 'Cari Supplier...'}
                  className={`input-field pl-9 ${activeStep === 'supplier' ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}`}
                />
              </div>
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {lang === 'en' ? 'Payment Terms' : 'Termin Pembayaran'} <span className="shortcut-badge text-[9px] ml-1">{lang === 'en' ? 'Numbers 1-4 / Arrow' : 'Angka 1-4 / Panah'}</span>
              </label>
              <div
                ref={termsSelectRef}
                tabIndex={0}
                onKeyDown={handleTermsKeyDown}
                onFocus={() => setActiveStep('terms')}
                className={`flex gap-2 p-1.5 bg-surface-900 border border-blue-500 rounded-lg outline-none transition-all ${
                  activeStep === 'terms' ? 'ring-2 ring-primary-500/20' : ''
                }`}
              >
                {[
                  { val: 'tunai', num: '1', label: lang === 'en' ? 'Cash' : 'Tunai' },
                  { val: '1', num: '2', label: lang === 'en' ? '1 Month' : '1 Bulan' },
                  { val: '2', num: '3', label: lang === 'en' ? '2 Months' : '2 Bulan' },
                  { val: '3', num: '4', label: lang === 'en' ? '3 Months' : '3 Bulan' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      setTerms(opt.val as any);
                      setActiveStep('terms');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                      terms === opt.val
                        ? 'bg-primary-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label} ({opt.num})
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => navigate('/pembelian')} className="btn-secondary">
                {lang === 'en' ? 'Cancel (Esc)' : 'Batal (Esc)'}
              </button>
              <button onClick={handleSubmit} className="btn-primary">
                <span>{lang === 'en' ? 'Continue to Item Input' : 'Lanjut Input Item'}</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Supplier Detail Info (Takes 1 col in 50:50 split) */}
        <div className="lg:col-span-1">
          <div className="card card-hovered p-0 flex flex-col justify-between h-full overflow-hidden">
            <div>
              <div className="bg-blue-600 px-6 py-4 flex items-center gap-3 text-white border-b border-blue-700/80 rounded-t-xl">
                <User className="text-white" size={18} />
                <h3 className="text-base font-extrabold text-white">
                  {lang === 'en' ? 'Supplier Information' : 'Informasi Pemasok'}
                </h3>
              </div>

              <div className="p-6">
                {supplierStats ? (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        {lang === 'en' ? 'Supplier Name' : 'Nama Pemasok'}
                      </p>
                      <h4 className="text-base font-extrabold text-white mt-0.5">{supplierStats.nama}</h4>
                      <span className="inline-block mt-1 text-[10px] bg-blue-500/10 text-blue-400 font-mono px-1.5 py-0.5 rounded border border-blue-500/20">
                        {supplierStats.kode}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-surface-700/40 pt-3">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          {lang === 'en' ? 'Phone Number' : 'No. Telepon'}
                        </p>
                        <p className="text-xs text-slate-300 font-semibold mt-0.5">{supplierStats.no_telp || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          {lang === 'en' ? 'Default Terms' : 'Default Termin'}
                        </p>
                        <p className="text-xs text-slate-300 font-semibold mt-0.5">
                          {supplierStats.jatuh_tempo ? (lang === 'en' ? `${supplierStats.jatuh_tempo} Month(s)` : `${supplierStats.jatuh_tempo} Bulan`) : (lang === 'en' ? 'Cash' : 'Tunai')}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-surface-700/40 pt-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        {lang === 'en' ? 'Address' : 'Alamat'}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{supplierStats.alamat || '-'}</p>
                    </div>

                    <div className="border-t border-surface-700/40 pt-3 space-y-2.5">
                      <h5 className="text-xs font-bold text-slate-400">
                        {lang === 'en' ? 'Activity Summary' : 'Ringkasan Aktivitas'}
                      </h5>
                      
                      {/* Transaksi Bulan Ini */}
                      <div className="p-3 bg-surface-900 border border-blue-500/40 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">
                            {lang === 'en' ? 'Transactions This Month' : 'Transaksi Bulan Ini'}
                          </p>
                          <p className="text-xs font-bold text-white mt-0.5">{supplierStats.total_transaksi_bulan_ini} Invoice</p>
                        </div>
                        <span className="text-xs font-bold text-primary-400">{formatCurrency(supplierStats.nominal_transaksi_bulan_ini)}</span>
                      </div>

                      {/* Piutang Dagang (Utang kita) */}
                      <div className="p-3 bg-surface-900 border border-blue-500/40 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">
                            {lang === 'en' ? 'Total Accounts Payable' : 'Total Utang Dagang'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {lang === 'en' ? 'Cumulative active transactions' : 'Kumulatif transaksi aktif'}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-danger-400">{formatCurrency(supplierStats.piutang)}</span>
                      </div>

                      {/* Terakhir Order */}
                      <div className="p-3 bg-surface-900 border border-blue-500/40 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">
                            {lang === 'en' ? 'Last Order' : 'Terakhir Order'}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-300">
                          {supplierStats.terakhir_order
                            ? new Date(supplierStats.terakhir_order).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                    <User size={32} className="text-slate-600 animate-pulse" />
                    <p className="text-xs text-slate-500 max-w-[200px]">
                      {lang === 'en' ? 'Please search and select a supplier to view details.' : 'Silakan cari dan pilih supplier untuk melihat detail data pemasok.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 pt-0">
              <div className="text-[9px] text-slate-500 border-t border-surface-700/40 pt-3">
                {lang === 'en' ? '* Data retrieved in real-time from supplier database.' : '* Data diambil real-time dari database supplier.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier Selection Popup Modal (Sama persis dengan modul inventory/customer) */}
      {showSupplierPopup && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={supplierPopupRef}
            tabIndex={0}
            onKeyDown={handleSupplierPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>{lang === 'en' ? 'Select Supplier' : 'Pilih Pemasok (Supplier)'}</span>
              </h3>
              <button onClick={() => setShowSupplierPopup(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {suppliers.length > 0 ? (
                suppliers.map((supp, idx) => (
                  <button
                    key={supp.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onClick={() => selectSupplier(supp)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${
                      idx === focusedIndex
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-2 ring-emerald-500/20 scale-[1.01]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-750 bg-white'
                    }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === focusedIndex ? 'text-emerald-900' : 'text-slate-900'}`}>{supp.nama}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{supp.kode}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  {lang === 'en' ? `No supplier matches "${supplierQuery}".` : `Tidak ada supplier yang cocok dengan "${supplierQuery}".`}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-surface-700 flex justify-between text-[11px] text-slate-500">
              <span>{lang === 'en' ? 'Use ↑ ↓ to select' : 'Gunakan ↑ ↓ untuk memilih'}</span>
              <span>
                <kbd className="shortcut-badge">Enter</kbd> {lang === 'en' ? 'to confirm, ' : 'untuk konfirmasi, '}
                <kbd className="shortcut-badge">Esc</kbd> {lang === 'en' ? 'cancel' : 'batal'}
              </span>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
