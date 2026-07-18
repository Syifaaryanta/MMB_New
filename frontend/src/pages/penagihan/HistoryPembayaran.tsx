import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Search,
  Calendar,
  User,
  Printer,
  Trash2,
  AlertOctagon,
  FileText,
  X,
  Check,
  ChevronDown,
  CreditCard
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface Creator {
  nama: string;
}

interface SaleInfo {
  no_faktur: string | null;
  no_order: string;
  customer?: {
    nama: string;
    kode: string;
    alamat?: string | null;
  };
}

interface BillingAllocation {
  id: string;
  allocated_amount: number;
  is_full_payment: boolean;
  remaining_after: number;
  sale: SaleInfo | null;
}

interface BillingSession {
  id: string;
  session_date: string;
  tipe: 'customer';
  target_id: string;
  target_nama: string;
  target_alamat: string | null;
  total_amount: number;
  payment_method: string;
  mode: string;
  catatan: string | null;
  created_at: string;
  creator: Creator | null;
  allocations: BillingAllocation[];
}

const getStoredState = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const HistoryPembayaran: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromHistory = searchParams.get('from') === 'history';
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const activeTab = 'customer';

  // Logs data state
  const [sessions, setSessions] = useState<BillingSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<BillingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [fromDate, setFromDate] = useState(() => getStoredState('hist_pemb_fromDate', ''));
  const [toDate, setToDate] = useState(() => getStoredState('hist_pemb_toDate', new Date().toISOString().slice(0, 10)));
  const [searchQuery, setSearchQuery] = useState(() => getStoredState('hist_pemb_searchQuery', ''));
  const [tempSearchQuery, setTempSearchQuery] = useState(() => getStoredState('hist_pemb_tempSearchQuery', ''));
  const [showPopup, setShowPopup] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'partial' | 'unpaid'>(() => getStoredState('hist_pemb_statusFilter', 'all'));
  const [isFilterFocused, setIsFilterFocused] = useState(false);
  const [focusedFilterIdx, setFocusedFilterIdx] = useState(0);

  // Selection & Detail state
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(() => getStoredState('hist_pemb_expandedSessionId', null));
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(() => getStoredState('hist_pemb_selectedRowIdx', 0));
  const [isTableFocused, setIsTableFocused] = useState(false);

  // Rollback Modal State
  const [showRollbackModal, setShowRollbackModal] = useState(() => getStoredState('hist_pemb_showRollbackModal', false));
  const [rollbackTarget, setRollbackTarget] = useState<BillingSession | null>(() => getStoredState('hist_pemb_rollbackTarget', null));
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Print Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(() => getStoredState('hist_pemb_showReceiptModal', false));
  const [receiptTarget, setReceiptTarget] = useState<BillingSession | null>(() => getStoredState('hist_pemb_receiptTarget', null));

  // Refs for navigation
  const fromDatePopupRef = useRef<HTMLInputElement>(null);
  const toDatePopupRef = useRef<HTMLInputElement>(null);
  const nameFilterPopupRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  const filterOptions = [
    { key: 'all', label: 'Semua Data' },
    { key: 'unpaid', label: 'Belum Lunas' }
  ] as const;

  // Auto scroll focused row
  useEffect(() => {
    const target = rowRefs.current[selectedRowIdx];
    if (target) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedRowIdx]);

  useEffect(() => {
    localStorage.setItem('hist_pemb_fromDate', JSON.stringify(fromDate));
    localStorage.setItem('hist_pemb_toDate', JSON.stringify(toDate));
    localStorage.setItem('hist_pemb_searchQuery', JSON.stringify(searchQuery));
    localStorage.setItem('hist_pemb_tempSearchQuery', JSON.stringify(tempSearchQuery));
    localStorage.setItem('hist_pemb_showPopup', JSON.stringify(showPopup));
    localStorage.setItem('hist_pemb_statusFilter', JSON.stringify(statusFilter));
    localStorage.setItem('hist_pemb_expandedSessionId', JSON.stringify(expandedSessionId));
    localStorage.setItem('hist_pemb_selectedRowIdx', JSON.stringify(selectedRowIdx));
    localStorage.setItem('hist_pemb_showRollbackModal', JSON.stringify(showRollbackModal));
    localStorage.setItem('hist_pemb_rollbackTarget', JSON.stringify(rollbackTarget));
    localStorage.setItem('hist_pemb_showReceiptModal', JSON.stringify(showReceiptModal));
    localStorage.setItem('hist_pemb_receiptTarget', JSON.stringify(receiptTarget));
  }, [
    fromDate, toDate, searchQuery, tempSearchQuery, showPopup, statusFilter,
    expandedSessionId, selectedRowIdx, showRollbackModal, rollbackTarget,
    showReceiptModal, receiptTarget
  ]);

  // Fetch oldest unpaid date on mount
  useEffect(() => {
    const fetchOldestUnpaid = async () => {
      const storedFromDate = localStorage.getItem('hist_pemb_fromDate');
      if (storedFromDate && storedFromDate !== '""') return;

      try {
        const res = await api.get('/payments/oldest-unpaid');
        if (res.data && res.data.date) {
          setFromDate(res.data.date);
        } else {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          setFromDate(d.toISOString().slice(0, 10));
        }
      } catch (err) {
        console.error(err);
        const d = new Date();
        d.setDate(d.getDate() - 30);
        setFromDate(d.toISOString().slice(0, 10));
      }
    };
    fetchOldestUnpaid();
  }, []);

  // Pre-filter by search query from search parameter (e.g. from SO detail delete blocked popup)
  useEffect(() => {
    const searchVal = searchParams.get('search');
    if (searchVal) {
      setSearchQuery(searchVal);
      setTempSearchQuery(searchVal);
      setShowPopup(false);
      setFromDate('2020-01-01');
      const todayStr = new Date().toISOString().slice(0, 10);
      setToDate(todayStr);
      setIsTableFocused(true);
    }
  }, [searchParams]);

  // Set focus to the first input when popup is shown
  useEffect(() => {
    if (showPopup) {
      setTimeout(() => {
        fromDatePopupRef.current?.focus();
        fromDatePopupRef.current?.select();
      }, 150);
    }
  }, [showPopup]);

  // Reset selection index when filters change
  useEffect(() => {
    setSelectedRowIdx(0);
  }, [sessions, searchQuery, statusFilter]);

  // Fetch billing sessions
  const fetchSessions = async () => {
    if (!fromDate || !toDate) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/payments/sessions?tipe=${activeTab}&from=${fromDate}&to=${toDate}`);
      setSessions(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch sessions when date range changes, but only if popup is closed
  useEffect(() => {
    if (!showPopup) {
      fetchSessions();
    }
  }, [fromDate, toDate, showPopup]);

  // Client-side search and status filtering
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = sessions.filter((s) => {
      const targetName = s.target_nama.toLowerCase();
      const notes = (s.catatan || '').toLowerCase();
      const sessionId = s.id.toLowerCase();
      const method = s.payment_method.toLowerCase();
      const invoiceMatch = s.allocations.some((alloc) => {
        const noOrder = alloc.sale?.no_order || '';
        return noOrder.toLowerCase().includes(q);
      });

      const textMatch = (
        targetName.includes(q) ||
        notes.includes(q) ||
        sessionId.includes(q) ||
        method.includes(q) ||
        invoiceMatch
      );
      if (!textMatch) return false;

      // Status filters
      const sisa = s.allocations.reduce((sum, alloc) => sum + Number(alloc.remaining_after), 0);
      if (statusFilter === 'unpaid') {
        return sisa > 0;
      }
      if (statusFilter === 'partial') {
        return sisa > 0 && s.allocations.some(a => a.is_full_payment);
      }
      return true;
    });

    setFilteredSessions(filtered);
    setExpandedSessionId(null);
  }, [sessions, searchQuery, statusFilter]);

  const handlePopupSubmit = () => {
    setShowPopup(false);
    setSearchQuery(tempSearchQuery);
    setIsTableFocused(true);
    setSelectedRowIdx(0);
  };

  // Keyboard Navigation Hotkeys
  // F1: Focus search input
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (!showPopup) {
      setIsFilterFocused(false);
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true }, [showPopup]);

  // F2: Focus filter buttons group
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (!showPopup) {
      setIsFilterFocused(true);
      setIsTableFocused(false);
      searchInputRef.current?.blur();
      const activeIdx = filterOptions.findIndex(o => o.key === statusFilter);
      setFocusedFilterIdx(activeIdx >= 0 ? activeIdx : 0);
    }
  }, { enableOnFormTags: true }, [showPopup, statusFilter]);

  // Arrow Left: change filter button focus
  useHotkeys('left', (e) => {
    if (!showPopup && isFilterFocused) {
      e.preventDefault();
      setFocusedFilterIdx(prev => (prev === 0 ? 1 : prev - 1));
    }
  }, { enableOnFormTags: false }, [showPopup, isFilterFocused]);

  // Arrow Right: change filter button focus
  useHotkeys('right', (e) => {
    if (!showPopup && isFilterFocused) {
      e.preventDefault();
      setFocusedFilterIdx(prev => (prev === 1 ? 0 : prev + 1));
    }
  }, { enableOnFormTags: false }, [showPopup, isFilterFocused]);

  // Arrow Up: navigate rows
  useHotkeys('up', (e) => {
    if (!showPopup && isTableFocused && !isFilterFocused) {
      e.preventDefault();
      if (selectedRowIdx > 0) {
        setSelectedRowIdx(selectedRowIdx - 1);
      }
    }
  }, { enableOnFormTags: false }, [selectedRowIdx, showPopup, isTableFocused, isFilterFocused]);

  // Arrow Down: navigate rows
  useHotkeys('down', (e) => {
    if (!showPopup && isTableFocused && !isFilterFocused) {
      e.preventDefault();
      if (selectedRowIdx < filteredSessions.length - 1) {
        setSelectedRowIdx(selectedRowIdx + 1);
      }
    }
  }, { enableOnFormTags: false }, [selectedRowIdx, filteredSessions, showPopup, isTableFocused, isFilterFocused]);

  // PageUp: scroll 10 rows up
  useHotkeys('pageup', (e) => {
    if (!showPopup && isTableFocused && !isFilterFocused) {
      e.preventDefault();
      setSelectedRowIdx(prev => Math.max(0, prev - 10));
    }
  }, { enableOnFormTags: false }, [showPopup, isTableFocused, isFilterFocused]);

  // PageDown: scroll 10 rows down
  useHotkeys('pagedown', (e) => {
    if (!showPopup && isTableFocused && !isFilterFocused) {
      e.preventDefault();
      setSelectedRowIdx(prev => Math.min(filteredSessions.length - 1, prev + 10));
    }
  }, { enableOnFormTags: false }, [showPopup, isTableFocused, isFilterFocused, filteredSessions]);

  // Enter key handler (filter selection or row allocation toggle)
  useHotkeys('enter', (e) => {
    if (!showPopup) {
      if (isFilterFocused) {
        e.preventDefault();
        setStatusFilter(filterOptions[focusedFilterIdx].key);
        setIsFilterFocused(false);
        setIsTableFocused(true);
      } else if (isTableFocused && filteredSessions.length > 0) {
        e.preventDefault();
        const target = filteredSessions[selectedRowIdx];
        if (target) {
          setExpandedSessionId(expandedSessionId === target.id ? null : target.id);
        }
      }
    }
  }, { enableOnFormTags: false }, [showPopup, isFilterFocused, isTableFocused, filteredSessions, selectedRowIdx, expandedSessionId, focusedFilterIdx]);

  // Escape key handler
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showReceiptModal) {
      setShowReceiptModal(false);
    } else if (showRollbackModal) {
      setShowRollbackModal(false);
    } else if (expandedSessionId) {
      setExpandedSessionId(null);
    } else if (isFilterFocused) {
      setIsFilterFocused(false);
      setIsTableFocused(true);
    } else if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else if (searchQuery) {
      setSearchQuery('');
    } else {
      navigate(fromHistory ? '/history' : '/penagihan');
    }
  }, { enableOnFormTags: true }, [showReceiptModal, showRollbackModal, expandedSessionId, isFilterFocused, isTableFocused, searchQuery, fromHistory]);

  // P or p: Print Receipt
  useHotkeys('p', (e) => {
    if (!showPopup && isTableFocused && filteredSessions.length > 0) {
      e.preventDefault();
      const target = filteredSessions[selectedRowIdx];
      if (target) {
        setReceiptTarget(target);
        setShowReceiptModal(true);
      }
    }
  }, { enableOnFormTags: false }, [showPopup, isTableFocused, filteredSessions, selectedRowIdx]);
  // Delete or del: Rollback Transaction
  useHotkeys('delete', (e) => {
    if (!showPopup && isTableFocused && isAdmin && filteredSessions.length > 0) {
      e.preventDefault();
      const target = filteredSessions[selectedRowIdx];
      if (target) {
        setRollbackTarget(target);
        setShowRollbackModal(true);
      }
    }
  }, { enableOnFormTags: false }, [showPopup, isTableFocused, isAdmin, filteredSessions, selectedRowIdx]);

  // Y key: Confirm Rollback Transaction when modal is open
  useHotkeys('y', (e) => {
    if (showRollbackModal && rollbackTarget && !isRollingBack) {
      e.preventDefault();
      handleRollback();
    }
  }, { enableOnFormTags: true }, [showRollbackModal, rollbackTarget, isRollingBack]);

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setIsRollingBack(true);
    try {
      await api.delete(`/payments/sessions/${rollbackTarget.id}`);
      setShowRollbackModal(false);
      setRollbackTarget(null);
      fetchSessions();
    } catch (err) {
      console.error(err);
      alert('Gagal melakukan rollback transaksi');
    } finally {
      setIsRollingBack(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (showPopup) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-800">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">History Pembayaran Customer</h1>
            <p className="text-slate-500 text-sm">Buku log histori pencatatan setoran cicilan piutang customer (AR).</p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-primary-600 text-white px-6 py-4 text-center border-b border-primary-700/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Filter Pencarian Log</h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePopupSubmit();
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Tanggal Awal</label>
                  <input
                    ref={fromDatePopupRef}
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        toDatePopupRef.current?.focus();
                        toDatePopupRef.current?.select();
                      }
                    }}
                    className="input-field w-full py-2 text-xs text-slate-850 border border-slate-200 rounded-lg bg-white font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Tanggal Akhir</label>
                  <input
                    ref={toDatePopupRef}
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        nameFilterPopupRef.current?.focus();
                        nameFilterPopupRef.current?.select();
                      }
                    }}
                    className="input-field w-full py-2 text-xs text-slate-850 border border-slate-200 rounded-lg bg-white font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">
                  Nama Customer (Opsional)
                </label>
                <input
                  ref={nameFilterPopupRef}
                  type="text"
                  placeholder="Semua / Ketik Nama"
                  value={tempSearchQuery}
                  onChange={(e) => setTempSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePopupSubmit();
                    }
                  }}
                  className="input-field w-full py-2 text-xs text-slate-855 border border-slate-200 rounded-lg bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 font-bold">
                <button
                  type="button"
                  onClick={() => navigate('/penagihan')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs hover:bg-slate-50 transition-all cursor-pointer font-bold"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-550 text-white text-xs rounded-lg transition-all shadow-md shadow-primary-500/10 cursor-pointer font-bold"
                >
                  Tampilkan (Enter)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">History Pembayaran Customer (AR)</h1>
          <p className="text-slate-500 text-sm">Buku log histori pencatatan setoran cicilan piutang customer (AR).</p>
        </div>
      </div>

      {/* Search and Period Filter */}
      <div className="card p-5 space-y-4 bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="flex-1 w-full relative">
            <label className="text-xs font-semibold text-slate-500 block mb-1">Cari Transaksi</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari nama customer, no order, catatan, atau metode... (F1)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredSessions.length > 0) {
                      setIsTableFocused(true);
                      setSelectedRowIdx(0);
                      searchInputRef.current?.blur();
                    }
                  }
                }}
                className="input-field w-full pl-10"
              />
            </div>
          </div>

          {/* Period (Read-only) */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 block">Periode Tanggal</span>
            <div
              onClick={() => setShowPopup(true)}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors h-[38px] shadow-sm"
              title="Klik untuk mengubah tanggal filter"
            >
              <Calendar size={14} className="text-slate-400" />
              <span>{fromDate ? formatDate(fromDate) : '-'} s/d {toDate ? formatDate(toDate) : '-'}</span>
            </div>
          </div>

          {/* Status filters buttons */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 block">Status Pelunasan</span>
            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 h-[38px]">
                {filterOptions.map((opt, idx) => {
                  const isActive = statusFilter === opt.key;
                  const isFocused = isFilterFocused && idx === focusedFilterIdx;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setStatusFilter(opt.key);
                        setIsFilterFocused(false);
                        setIsTableFocused(true);
                      }}
                      className={`px-4 py-1 text-xs font-bold rounded transition-all cursor-pointer ${isActive
                        ? 'bg-white text-primary-700 shadow-sm border border-slate-200/80 font-bold'
                        : 'text-slate-600 hover:text-slate-900 border border-transparent font-medium'
                        } ${isFocused
                          ? 'ring-2 ring-primary-500 ring-offset-1 bg-blue-50/50'
                          : ''
                        }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <kbd className="text-[10px] text-slate-400 font-bold font-mono uppercase bg-slate-50 border border-slate-200 px-2 py-1 rounded shadow-sm h-[38px] flex items-center justify-center">F2</kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 bg-white border border-slate-200">
          <FileText className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-lg font-bold">Tidak ada log transaksi</p>
          <p className="text-sm">Tidak ditemukan riwayat pembayaran pada rentang tanggal atau pencarian terpilih.</p>
        </div>
      ) : (
        <div className="card bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Tanggal</th>
                  <th className="p-4">Pelanggan</th>
                  <th className="p-4 text-center">Metode</th>
                  <th className="p-4">Total Bayar</th>
                  <th className="p-4">Sisa Tagihan</th>
                  <th className="p-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((session, idx) => {
                  const isExpanded = expandedSessionId === session.id;
                  const isSelected = idx === selectedRowIdx;
                  const sisa = session.allocations.reduce((sum, alloc) => sum + Number(alloc.remaining_after), 0);
                  const isFocused = isSelected && isTableFocused;
                  const isSelectedInactive = isSelected && !isTableFocused;

                  const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                    let base = "p-4 transition-all duration-150 border-b border-slate-150 ";
                    if (isFocused) {
                      base += "bg-blue-100/90 text-primary-950 font-bold border-blue-300 ";
                      if (pos === 'first') base += "border-l-4 border-primary-600 ";
                    } else if (isSelectedInactive) {
                      base += "bg-blue-50/40 text-slate-900 border-blue-200 ";
                      if (pos === 'first') base += "border-l-4 border-primary-300 ";
                    } else {
                      base += "text-slate-800 ";
                      if (pos === 'first') base += "border-l-4 border-transparent ";
                    }
                    return base;
                  };

                  return (
                    <React.Fragment key={session.id}>
                      {/* Row Utama */}
                      <tr
                        ref={el => { rowRefs.current[idx] = el; }}
                        onClick={() => {
                          setSelectedRowIdx(idx);
                          setIsTableFocused(true);
                          setIsFilterFocused(false);
                        }}
                        onDoubleClick={() => {
                          setExpandedSessionId(isExpanded ? null : session.id);
                        }}
                        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/10' : ''
                          }`}
                      >
                        <td className={`${getTdClass('first')} pl-6 font-medium whitespace-nowrap`}>
                          {formatDate(session.session_date)}
                        </td>
                        <td className={getTdClass('middle')}>
                          <span className="font-bold text-slate-900 block">{session.target_nama}</span>
                          {session.target_alamat && (
                            <span className="text-xs text-slate-500 block max-w-[250px] truncate" title={session.target_alamat}>
                              {session.target_alamat}
                            </span>
                          )}
                        </td>
                        <td className={`${getTdClass('middle')} text-center whitespace-nowrap`}>
                          <span className="bg-slate-100 border border-slate-200 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase">
                            {session.payment_method}
                          </span>
                        </td>
                        <td className={`${getTdClass('middle')} font-mono font-bold text-green-600 whitespace-nowrap`}>
                          {formatCurrency(session.total_amount)}
                        </td>
                        <td className={`${getTdClass('middle')} font-mono font-bold text-rose-600 whitespace-nowrap`}>
                          {formatCurrency(sisa)}
                        </td>
                        <td className={`${getTdClass('last')} max-w-[250px] truncate text-slate-700`}>
                          {session.catatan || '-'}
                        </td>
                      </tr>

                      {/* Dropdown Alokasi Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0 bg-slate-50/50 border-t border-b border-slate-200">
                            <div className="p-5 pl-10 space-y-3 bg-slate-50/30">
                              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Rincian Alokasi Nota Penagihan ({session.allocations.length})</h4>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setReceiptTarget(session);
                                      setShowReceiptModal(true);
                                    }}
                                    className="btn py-1 px-3 text-xs flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-600 font-semibold cursor-pointer rounded-lg shadow-sm"
                                    title="Cetak Kuitansi (Shortcut: P)"
                                  >
                                    <Printer size={12} />
                                    <span>Cetak Kuitansi (P)</span>
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => {
                                        setRollbackTarget(session);
                                        setShowRollbackModal(true);
                                      }}
                                      className="btn py-1 px-3 text-xs flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-semibold cursor-pointer rounded-lg shadow-sm"
                                      title="Rollback / Batalkan (Shortcut: Delete)"
                                    >
                                      <Trash2 size={12} />
                                      <span>Rollback (Del)</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {session.allocations
                                    .filter(alloc => statusFilter === 'all' || !alloc.is_full_payment)
                                    .map((alloc) => {
                                      const docNo = alloc.sale?.no_order || '-';
                                      return (
                                      <div
                                        key={alloc.id}
                                        className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="font-mono text-sm font-bold text-blue-600">
                                            Order: {docNo}
                                          </div>
                                          {alloc.is_full_payment ? (
                                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                              Lunas
                                            </span>
                                          ) : (
                                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                              Belum Lunas
                                            </span>
                                          )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                                          <div>
                                            <span className="text-slate-500 block">Alokasi Bayar</span>
                                            <span className="font-bold text-slate-900 font-mono">{formatCurrency(alloc.allocated_amount)}</span>
                                          </div>
                                          <div>
                                            <span className="text-slate-500 block">Sisa Tagihan</span>
                                            <span className="font-bold text-slate-700 font-mono">{formatCurrency(alloc.remaining_after)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Rollback Modal */}
      {showRollbackModal && rollbackTarget && (
        <ModalPortal>
          <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in text-slate-800">
          <div className="bg-white rounded-xl max-w-sm w-full mx-auto shadow-2xl animate-scale-in overflow-hidden border border-danger-200/60">
            <div className="bg-danger-600 text-white px-6 py-4 flex flex-col items-center justify-center gap-2 border-b border-danger-700/80">
              <AlertOctagon size={24} className="shrink-0 text-white animate-bounce" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-center text-white">Konfirmasi Rollback</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-xs text-slate-655 leading-relaxed mb-4 font-medium">
                Apakah Anda yakin ingin membatalkan (rollback) sesi transaksi pembayaran ini?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[10px] text-left mb-4 text-slate-700">
                <div>Target: {rollbackTarget.target_nama}</div>
                <div>Nilai: {formatCurrency(rollbackTarget.total_amount)}</div>
                <div>Tanggal: {formatDate(rollbackTarget.session_date)}</div>
              </div>
              <p className="text-rose-600 font-bold text-[10px] leading-normal mb-6">
                🚨 Tindakan ini akan menghapus sesi pembayaran dari log kasir dan mengembalikan saldo tagihan nota ke posisi semula.
              </p>
              <div className="flex justify-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowRollbackModal(false);
                    setRollbackTarget(null);
                  }}
                  disabled={isRollingBack}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-605 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer focus:ring-2 focus:ring-slate-500/20"
                >
                  Batal (Esc)
                </button>
                <button
                  type="button"
                  onClick={handleRollback}
                  disabled={isRollingBack}
                  className="px-4 py-2 rounded-lg bg-danger-600 hover:bg-danger-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer focus:ring-2 focus:ring-danger-500/20"
                >
                  {isRollingBack ? 'Proses...' : 'Ya, Rollback (Y)'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Receipt Modal (Printable) */}
      {showReceiptModal && receiptTarget && (
        <ModalPortal>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="card max-w-2xl w-full p-6 space-y-6 relative bg-white border border-slate-200 shadow-xl rounded-xl">
            <button
              onClick={() => {
                setShowReceiptModal(false);
                setReceiptTarget(null);
              }}
              className="absolute right-4 top-4 p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
              <Printer size={20} className="text-primary-600" />
              <span>Bukti Tanda Terima Pembayaran</span>
            </h3>

            {/* Receipt Printable Area */}
            <div id="receipt-print-area" className="p-6 bg-white text-black rounded-lg space-y-6 font-sans">
              <div className="flex justify-between items-start border-b-2 border-black pb-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-black">CV. MAKMUR MANDIRI BERSAMA</h1>
                  <p className="text-xs text-gray-655 mt-1">Sistem Keuangan Modul Penagihan Piutang</p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-bold text-gray-800">KUITANSI</h2>
                  <p className="text-xs text-gray-500 font-mono">No: {receiptTarget.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-800">
                <div>
                  <div className="text-xs text-gray-500">Telah Terima Dari:</div>
                  <div className="font-bold text-base text-black">{receiptTarget.target_nama}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Tanggal Transaksi:</div>
                  <div className="font-bold text-black">{formatDate(receiptTarget.session_date)}</div>
                </div>
              </div>

              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase">
                      <th className="p-3 pl-4">No. Order</th>
                      <th className="p-3 text-right">Alokasi Bayar</th>
                      <th className="p-3 text-right">Sisa Tagihan</th>
                      <th className="p-3 pr-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptTarget.allocations.map((alloc) => (
                      <tr key={alloc.id} className="border-b border-gray-200 text-gray-900 font-medium">
                        <td className="p-3 pl-4 font-mono">
                          {alloc.sale?.no_order || '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          {formatCurrency(alloc.allocated_amount)}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600">
                          {formatCurrency(alloc.remaining_after)}
                        </td>
                        <td className="p-3 pr-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${alloc.is_full_payment
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                            }`}>
                            {alloc.is_full_payment ? 'Lunas' : 'Dicicil'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-end pt-4">
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 font-semibold uppercase">Total Pembayaran</div>
                  <div className="text-xl font-black text-black font-mono">{formatCurrency(receiptTarget.total_amount)}</div>
                </div>
                <div className="text-center w-48 text-sm">
                  <div className="text-xs text-gray-500 mb-12">Kasir Keuangan</div>
                  <div className="border-b border-black pb-1 font-bold text-black">{receiptTarget.creator?.nama || 'Admin Keuangan'}</div>
                  <div className="text-[10px] text-gray-500 mt-1">CV. Makmur Mandiri Bersama</div>
                </div>
              </div>

              <div className="text-[9px] text-gray-400 border-t border-gray-200 pt-3 text-center font-mono">
                Dicetak secara otomatis melalui MMB ERP System pada {new Date().toLocaleString('id-ID')}
              </div>
            </div>

            {/* Print Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptTarget(null);
                }}
                className="btn btn-secondary"
              >
                Tutup
              </button>
              <button
                onClick={handlePrint}
                className="btn btn-primary flex items-center gap-2"
              >
                <Printer size={18} />
                <span>Cetak Kuitansi</span>
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* CSS untuk Kebutuhan Print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-print-area, #receipt-print-area * {
            visibility: visible;
          }
          #receipt-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            padding: 0;
            margin: 0;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
};
