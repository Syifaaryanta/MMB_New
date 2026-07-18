import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Calendar, FileText, X, History, ArrowDownCircle, ArrowUpCircle, Info } from 'lucide-react';

interface StockMovement {
  id: string;
  parent_id: string;
  type: 'incoming' | 'outgoing' | 'adjustment';
  no_order: string;
  no_faktur: string;
  tanggal: string;
  supplier: string;
  customer: string;
  staff: string;
  product_kode: string;
  product_nama: string;
  stok_berkurang: number;
  stok_bertambah: number;
  alasan: string;
}

export const HistoryBarangInOut: React.FC = () => {
  const navigate = useNavigate();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTableFocused, setIsTableFocused] = useState(false);

  // Active Details Modals
  const [activePo, setActivePo] = useState<any | null>(null);
  const [activeSo, setActiveSo] = useState<any | null>(null);
  const [activeAdj, setActiveAdj] = useState<StockMovement | null>(null);
  const [isInfoHidden, setIsInfoHidden] = useState(false);

  // Deletion States
  const [deleteAdjTarget, setDeleteAdjTarget] = useState<StockMovement | null>(null);
  const [showBlockedDeleteModal, setShowBlockedDeleteModal] = useState<boolean>(false);

  // Real-time Clock State
  const [realtimeTime, setRealtimeTime] = useState('');

  // Filters State
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const defaultFromDate = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const defaultToDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [noOrderFilter, setNoOrderFilter] = useState('');
  const [namaFilter, setNamaFilter] = useState('');
  const [barangFilter, setBarangFilter] = useState('');
  const [showFilterPage, setShowFilterPage] = useState(true);

  // Input Refs
  const noOrderRef = useRef<HTMLInputElement>(null);
  const namaRef = useRef<HTMLInputElement>(null);
  const barangRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Popup Refs
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const popupBarangRef = useRef<HTMLInputElement>(null);

  // Update Real-time Time Clock (every second)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const format = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }) + ' - ' + now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setRealtimeTime(format);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Scroll selected row into view
  useEffect(() => {
    if (isTableFocused && movements.length > 0) {
      const selectedRow = document.getElementById(`movement-row-${selectedIdx}`);
      if (selectedRow) {
        selectedRow.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedIdx, isTableFocused, movements.length]);

  // Focus popup fromDate on mount/show
  useEffect(() => {
    if (showFilterPage) {
      setTimeout(() => {
        fromDateRef.current?.focus();
        fromDateRef.current?.select();
      }, 150);
    }
  }, [showFilterPage]);

  // Fetch combined movements data
  const handleSearch = async (focusTableOnComplete = false) => {
    setIsLoading(true);
    try {
      let url = `/history/barang-inout?from=${fromDate}&to=${toDate}`;
      if (noOrderFilter.trim()) url += `&no_order=${encodeURIComponent(noOrderFilter.trim())}`;
      if (namaFilter.trim()) url += `&customer=${encodeURIComponent(namaFilter.trim())}&supplier=${encodeURIComponent(namaFilter.trim())}&staff=${encodeURIComponent(namaFilter.trim())}`;
      if (barangFilter.trim()) url += `&code_item=${encodeURIComponent(barangFilter.trim())}`;

      const res = await api.get(url);
      const dataList = res.data.data || [];
      
      setMovements(dataList);
      setSelectedIdx(0);

      if (focusTableOnComplete && dataList.length > 0) {
        setIsTableFocused(true);
        // Blur inputs
        noOrderRef.current?.blur();
        namaRef.current?.blur();
        barangRef.current?.blur();
      } else {
        setIsTableFocused(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    await handleSearch(true);
    setShowFilterPage(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(true);
    }
  };

  const handleOpenDetail = async (movement: StockMovement) => {
    try {
      if (movement.type === 'incoming') {
        const res = await api.get(`/purchases/${movement.parent_id}`);
        setActivePo(res.data);
      } else if (movement.type === 'outgoing') {
        const res = await api.get(`/sales/${movement.parent_id}`);
        setActiveSo(res.data);
      } else if (movement.type === 'adjustment') {
        setActiveAdj(movement);
      }
      setIsInfoHidden(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteAdjTarget) return;
    try {
      await api.delete(`/stock-adjustments/${deleteAdjTarget.id}`);
      setDeleteAdjTarget(null);
      handleSearch(false);
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus penyesuaian stok.');
    }
  };

  // Keyboard Shortcuts
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (activePo || activeSo) {
      setIsInfoHidden((prev) => !prev);
    } else if (!showFilterPage && !activePo && !activeSo && !activeAdj && !deleteAdjTarget && !showBlockedDeleteModal) {
      setIsTableFocused(false);
      noOrderRef.current?.focus();
      noOrderRef.current?.select();
    }
  }, { enableOnFormTags: true }, [showFilterPage, activePo, activeSo, activeAdj, deleteAdjTarget, showBlockedDeleteModal]);

  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (!showFilterPage && !activePo && !activeSo && !activeAdj && !deleteAdjTarget && !showBlockedDeleteModal) {
      setIsTableFocused(false);
      namaRef.current?.focus();
      namaRef.current?.select();
    }
  }, { enableOnFormTags: true }, [showFilterPage, activePo, activeSo, activeAdj, deleteAdjTarget, showBlockedDeleteModal]);

  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (!showFilterPage && !activePo && !activeSo && !activeAdj && !deleteAdjTarget && !showBlockedDeleteModal) {
      setIsTableFocused(false);
      barangRef.current?.focus();
      barangRef.current?.select();
    }
  }, { enableOnFormTags: true }, [showFilterPage, activePo, activeSo, activeAdj, deleteAdjTarget, showBlockedDeleteModal]);

  useHotkeys('enter', (e) => {
    if (showBlockedDeleteModal) {
      e.preventDefault();
      setShowBlockedDeleteModal(false);
      return;
    }
    if (!showFilterPage && isTableFocused && !activePo && !activeSo && !activeAdj && !deleteAdjTarget && movements[selectedIdx]) {
      e.preventDefault();
      handleOpenDetail(movements[selectedIdx]);
    }
  }, { enableOnFormTags: true }, [showFilterPage, isTableFocused, selectedIdx, movements, activePo, activeSo, activeAdj, deleteAdjTarget, showBlockedDeleteModal]);

  useHotkeys('up', (e) => {
    if (!showFilterPage && isTableFocused && !activePo && !activeSo && !activeAdj && !deleteAdjTarget && !showBlockedDeleteModal && movements.length > 0) {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(0, p - 1));
    }
  }, { enableOnFormTags: false }, [showFilterPage, isTableFocused, movements, activePo, activeSo, activeAdj, deleteAdjTarget, showBlockedDeleteModal]);

  useHotkeys('down', (e) => {
    if (!showFilterPage && isTableFocused && !activePo && !activeSo && !activeAdj && !deleteAdjTarget && !showBlockedDeleteModal && movements.length > 0) {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(movements.length - 1, p + 1));
    }
  }, { enableOnFormTags: false }, [showFilterPage, isTableFocused, movements, activePo, activeSo, activeAdj, deleteAdjTarget, showBlockedDeleteModal]);

  useHotkeys('delete, del', (e) => {
    if (!showFilterPage && isTableFocused && !activePo && !activeSo && !activeAdj && !deleteAdjTarget && !showBlockedDeleteModal && movements[selectedIdx]) {
      e.preventDefault();
      const target = movements[selectedIdx];
      if (target.type === 'adjustment') {
        setDeleteAdjTarget(target);
      } else {
        setShowBlockedDeleteModal(true);
      }
    }
  }, { enableOnFormTags: false }, [showFilterPage, isTableFocused, selectedIdx, movements, activePo, activeSo, activeAdj, deleteAdjTarget, showBlockedDeleteModal]);

  useHotkeys('y', (e) => {
    if (deleteAdjTarget) {
      e.preventDefault();
      handleConfirmDelete();
    }
  }, { enableOnFormTags: false }, [deleteAdjTarget]);

  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (deleteAdjTarget) {
      setDeleteAdjTarget(null);
    } else if (showBlockedDeleteModal) {
      setShowBlockedDeleteModal(false);
    } else if (activePo) {
      setActivePo(null);
    } else if (activeSo) {
      setActiveSo(null);
    } else if (activeAdj) {
      setActiveAdj(null);
    } else if (showFilterPage) {
      navigate('/history');
    } else if (isTableFocused) {
      setIsTableFocused(false);
      noOrderRef.current?.focus();
      noOrderRef.current?.select();
    } else {
      setShowFilterPage(true);
    }
  }, { enableOnFormTags: true }, [showFilterPage, activePo, activeSo, activeAdj, isTableFocused, deleteAdjTarget, showBlockedDeleteModal]);

  const hasDetailOpen = activePo || activeSo || activeAdj;

  if (showFilterPage) {
    return (
      <div className="space-y-6 text-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="mb-1">
              <h1 className="text-2xl font-extrabold text-white">Histori Pergerakan Barang</h1>
            </div>
            <p className="text-slate-400">Log pergerakan barang masuk (PO), keluar (SO), serta penyesuaian stok oleh staff</p>
          </div>
          <div className="bg-surface-800 border border-surface-700 px-4 py-2.5 rounded-lg text-slate-350 font-mono text-xs flex items-center justify-center shadow-sm min-w-[200px] self-start sm:self-auto">
            {realtimeTime}
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-primary-600 text-white px-6 py-4 text-center border-b border-primary-700">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Filter Pergerakan Barang</h3>
            </div>

            <form onSubmit={handleFilterSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Tanggal Awal</label>
                  <input
                    ref={fromDateRef}
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toDateRef.current?.focus())}
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Tanggal Akhir</label>
                  <input
                    ref={toDateRef}
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), popupBarangRef.current?.focus())}
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Nama / Kode Barang</label>
                <input
                  ref={popupBarangRef}
                  type="text"
                  placeholder="Ketik Nama atau Kode Barang"
                  value={barangFilter}
                  onChange={(e) => setBarangFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFilterSubmit(e))}
                  className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-550 transition-all shadow-md shadow-primary-500/10"
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
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="mb-1">
            <h1 className="text-2xl font-extrabold text-white">Histori Pergerakan Barang</h1>
          </div>
          <p className="text-slate-400">Log pergerakan barang masuk (PO), keluar (SO), serta penyesuaian stok oleh staff</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <div className="px-3 py-2.5 rounded-lg border border-surface-700 text-xs text-slate-350 font-semibold flex items-center gap-2 bg-surface-800/50 shadow-sm font-mono">
            <Calendar size={14} className="text-primary-400" />
            <span>{formatDate(fromDate)} - {formatDate(toDate)}</span>
          </div>
          <div className="bg-surface-800 border border-surface-700 px-4 py-2.5 rounded-lg text-slate-350 font-mono text-xs flex items-center justify-center shadow-sm min-w-[200px]">
            {realtimeTime}
          </div>
        </div>
      </div>

      {!hasDetailOpen ? (
        <div className="space-y-6">
          {/* Unified Filter Dashboard */}
          <div className="card p-6 bg-surface-800/40 border-surface-700/60 rounded-xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span>No. Order</span>
                  <span className="text-[10px] text-primary-400 font-bold font-mono">F1</span>
                </label>
                <div className="relative">
                  <input
                    ref={noOrderRef}
                    type="text"
                    placeholder="PO, SO, atau Faktur"
                    value={noOrderFilter}
                    onChange={(e) => setNoOrderFilter(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="input-field w-full py-2 px-3 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white uppercase font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span>Cust / Supp / Staff</span>
                  <span className="text-[10px] text-primary-400 font-bold font-mono">F2</span>
                </label>
                <input
                  ref={namaRef}
                  type="text"
                  placeholder="Ketik Nama"
                  value={namaFilter}
                  onChange={(e) => setNamaFilter(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="input-field w-full py-2 px-3 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span>Nama / Kode Barang</span>
                  <span className="text-[10px] text-primary-400 font-bold font-mono">F3</span>
                </label>
                <input
                  ref={barangRef}
                  type="text"
                  placeholder="Ketik Kode/Nama"
                  value={barangFilter}
                  onChange={(e) => setBarangFilter(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="input-field w-full py-2 px-3 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-surface-700/60">
              <div className="text-[11px] text-slate-500 flex items-center gap-3">
                <span>Pencarian Cepat:</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 text-slate-350 text-[10px] font-mono mr-1">F1-F3</kbd> Fokus Input</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 text-slate-350 text-[10px] font-mono mr-1">Enter</kbd> Cari & Fokus Tabel</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 text-slate-350 text-[10px] font-mono mr-1">↑ ↓</kbd> Pilih Baris</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 text-slate-350 text-[10px] font-mono mr-1">Enter</kbd> Detail</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 text-slate-350 text-[10px] font-mono mr-1">Esc</kbd> Batal / Kembali</span>
              </div>
            </div>
          </div>

          {/* Movements Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 skeleton" />
              ))}
            </div>
          ) : movements.length > 0 ? (
            <div ref={tableContainerRef} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-800 text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-surface-700">
                      <th className="p-3.5 w-12 text-center">#</th>
                      <th className="p-3.5">No. Order</th>
                      <th className="p-3.5">Tanggal</th>
                      <th className="p-3.5">No. Faktur</th>
                      <th className="p-3.5">Supplier</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Staff</th>
                      <th className="p-3.5">Nama Barang</th>
                      <th className="p-3.5 text-center w-36">Stok Berkurang</th>
                      <th className="p-3.5 text-center w-36">Stok Bertambah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((item, idx) => {
                      const isFocused = idx === selectedIdx && isTableFocused;

                      // Focus and Type styles mapping
                      const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                        let base = "p-3.5 text-xs transition-all duration-150 border-b ";
                        if (isFocused) {
                          if (item.type === 'incoming') {
                            base += "bg-emerald-50 text-emerald-950 font-bold border-emerald-200 ";
                            if (pos === 'first') base += "border-l-4 border-emerald-600 ";
                          } else if (item.type === 'outgoing') {
                            base += "bg-rose-50 text-rose-950 font-bold border-rose-200 ";
                            if (pos === 'first') base += "border-l-4 border-rose-600 ";
                          } else {
                            base += "bg-amber-50 text-amber-950 font-bold border-amber-200 ";
                            if (pos === 'first') base += "border-l-4 border-amber-600 ";
                          }
                        } else {
                          base += "text-slate-800 border-slate-200 ";
                        }
                        return base;
                      };

                      const getNoOrderBadge = () => {
                        if (item.type === 'incoming') {
                          return (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-xs inline-block">
                              {item.no_order}
                            </span>
                          );
                        }
                        if (item.type === 'outgoing') {
                          return (
                            <span className="px-2 py-0.5 rounded bg-blue-50/80 text-blue-700 border border-blue-100 font-mono font-bold text-xs inline-block">
                              {item.no_order}
                            </span>
                          );
                        }
                        return (
                          <span className="px-2 py-0.5 rounded bg-amber-50/80 text-amber-700 border border-amber-100 font-mono text-[10px] font-bold inline-block">
                            ADJUSTMENT
                          </span>
                        );
                      };

                      const getFakturValue = () => {
                        if (item.no_faktur && item.no_faktur !== '-') {
                          return (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-xs inline-block">
                              {item.no_faktur}
                            </span>
                          );
                        }
                        return <span className="text-slate-400 italic text-xs">-</span>;
                      };

                      return (
                        <tr
                          key={item.id}
                          id={`movement-row-${idx}`}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setIsTableFocused(true);
                          }}
                          onDoubleClick={() => handleOpenDetail(item)}
                          className="cursor-pointer hover:bg-slate-50 text-slate-800"
                        >
                          <td className={getTdClass('first') + " text-center font-semibold"}>{idx + 1}</td>
                          <td className={getTdClass('middle')}>{getNoOrderBadge()}</td>
                          <td className={getTdClass('middle') + " font-medium"}>{formatDate(item.tanggal)}</td>
                          <td className={getTdClass('middle')}>{getFakturValue()}</td>
                          <td className={getTdClass('middle')}>
                            {item.supplier !== '-' ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs inline-block">
                                {item.supplier}
                              </span>
                            ) : '-'}
                          </td>
                          <td className={getTdClass('middle') + " font-semibold"}>
                            {item.customer !== '-' ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs inline-block">
                                {item.customer}
                              </span>
                            ) : '-'}
                          </td>
                          <td className={getTdClass('middle') + " font-medium"}>
                            {item.type === 'adjustment' && item.staff !== '-' ? (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold inline-block">
                                {item.staff}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">{item.staff}</span>
                            )}
                          </td>
                          <td className={getTdClass('middle') + " font-bold"}>
                            {item.product_nama}
                            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{item.product_kode}</span>
                          </td>
                          <td className={getTdClass('middle') + " text-center font-bold"}>
                            {item.stok_berkurang > 0 ? (
                              item.type === 'adjustment' ? (
                                <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 font-bold text-xs inline-block shadow-sm">
                                  -{item.stok_berkurang}
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs inline-block shadow-sm">
                                  -{item.stok_berkurang}
                                </span>
                              )
                            ) : <span className="text-slate-400">-</span>}
                          </td>
                          <td className={getTdClass('last') + " text-center font-bold"}>
                            {item.stok_bertambah > 0 ? (
                              item.type === 'adjustment' ? (
                                <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 font-bold text-xs inline-block shadow-sm">
                                  +{item.stok_bertambah}
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold text-xs inline-block shadow-sm">
                                  +{item.stok_bertambah}
                                </span>
                              )
                            ) : <span className="text-slate-400">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-16 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/10">
              <History className="w-12 h-12 mb-3 opacity-40 text-slate-400 animate-pulse" />
              <h3 className="text-lg font-bold text-slate-400">Tidak ada data pergerakan barang ditemukan</h3>
              <p className="text-sm mt-1">Ubah filter pencarian untuk melihat data pergerakan lainnya.</p>
            </div>
          )}
        </div>
      ) : activePo ? (
        /* PO Detail Modal Component (Consistent with original HistoryBarangMasuk) */
        <div className="bg-white rounded-xl shadow-2xl border border-emerald-100 overflow-hidden animate-scale-in text-slate-800 flex flex-col">
          <div className="bg-emerald-600 !text-white px-6 py-3 flex justify-between items-center border-b border-emerald-700">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-white/10 rounded-md">
                <FileText size={14} className="!text-white" />
              </div>
              <h2 className="text-xs font-bold !text-white uppercase tracking-wider">Detail Penerimaan: {activePo.no_order}</h2>
            </div>
            <button onClick={() => { setActivePo(null); setIsInfoHidden(false); }} className="!text-white/80 hover:!text-white transition-colors focus:outline-none">
              <X size={16} className="!text-white" />
            </button>
          </div>

          <div className="p-5 bg-slate-50/50 space-y-4">
            {!isInfoHidden && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-down">
                {/* Info PO */}
                <div className="bg-gradient-to-br from-white to-emerald-50/40 p-4 rounded-xl border border-emerald-100 shadow-sm space-y-3">
                  <div className="border-b border-slate-100 pb-1.5">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Informasi Penerimaan</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">No. PO:</span>
                      <span className="text-xs font-bold text-slate-800 block">{activePo.no_order}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal Order:</span>
                      <span className="text-xs font-bold text-slate-800 block">{formatDate(activePo.order_date)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal Diterima:</span>
                      <span className="text-xs font-bold text-emerald-700 block">{activePo.received_at ? formatDate(activePo.received_at) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Termin:</span>
                      <span className="text-xs font-bold text-slate-800 block uppercase">{activePo.terms}</span>
                    </div>
                  </div>
                </div>

                {/* Supplier */}
                <div className="bg-gradient-to-br from-white to-emerald-50/40 p-4 rounded-xl border border-emerald-100 shadow-sm space-y-3">
                  <div className="border-b border-slate-100 pb-1.5">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Pemasok (Supplier)</h3>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Nama:</span>
                      <span className="text-xs font-bold text-slate-800 block">{activePo.supplier?.nama}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Alamat:</span>
                      <span className="text-xs font-medium text-slate-700 block leading-relaxed">{activePo.supplier?.alamat || 'Alamat tidak dicantumkan'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Product Items Table */}
            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm space-y-3">
              <div className="border-b border-slate-100 pb-1.5">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Daftar Barang yang Diterima</h3>
              </div>
              <div className="overflow-hidden rounded-lg border border-emerald-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-600 text-white font-bold text-xs uppercase">
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3 w-32 text-center">Kode</th>
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3 text-center w-20">Qty</th>
                      <th className="p-3 text-right w-36">Harga Beli</th>
                      <th className="p-3 text-right w-40">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 bg-white">
                    {(activePo.purchase_items || []).map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-800">
                        <td className="p-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {item.product?.kode || '-'}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{item.product?.nama || '-'}</td>
                        <td className="p-3 text-center font-bold text-slate-700">{Number(item.qty)}</td>
                        <td className="p-3 text-right font-semibold text-slate-500">{formatCurrency(Number(item.harga_beli))}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(Number(item.qty) * Number(item.harga_beli))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-slate-50/50 border-t border-emerald-200 p-3 flex justify-end gap-4 text-xs font-bold">
                  <span className="text-slate-800">Total Pembelian PO:</span>
                  <span className="text-emerald-600 font-black text-sm font-mono">{formatCurrency(Number(activePo.subtotal))}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsInfoHidden((prev) => !prev)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all bg-white flex items-center gap-1.5"
              >
                <span>{isInfoHidden ? 'Tampilkan Info' : 'Sembunyikan Info'}</span>
              </button>
              <button type="button" onClick={() => { setActivePo(null); setIsInfoHidden(false); }} className="px-5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm">
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      ) : activeSo ? (
        /* SO Detail Modal Component (Consistent with original HistoryBarangKeluar) */
        <div className="bg-white rounded-xl shadow-2xl border border-rose-100 overflow-hidden animate-scale-in text-slate-800 flex flex-col">
          <div className="bg-rose-600 !text-white px-6 py-3 flex justify-between items-center border-b border-rose-700">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-white/10 rounded-md">
                <FileText size={14} className="!text-white" />
              </div>
              <h2 className="text-xs font-bold !text-white uppercase tracking-wider">Detail Pengiriman: {activeSo.no_faktur || activeSo.no_order}</h2>
            </div>
            <button onClick={() => { setActiveSo(null); setIsInfoHidden(false); }} className="!text-white/80 hover:!text-white transition-colors focus:outline-none">
              <X size={16} className="!text-white" />
            </button>
          </div>

          <div className="p-5 bg-slate-50/50 space-y-4">
            {!isInfoHidden && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-down">
                {/* Info SO */}
                <div className="bg-gradient-to-br from-white to-rose-50/40 p-4 rounded-xl border border-rose-100 shadow-sm space-y-3">
                  <div className="border-b border-slate-100 pb-1.5">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Informasi Pengiriman</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">No. SO:</span>
                      <span className="text-xs font-bold text-slate-800 block font-mono">{activeSo.no_order}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">No. Faktur:</span>
                      <span className="text-xs font-bold text-slate-800 block font-mono">{activeSo.no_faktur || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal:</span>
                      <span className="text-xs font-bold text-slate-800 block">{formatDate(activeSo.order_date)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Status:</span>
                      <span className="text-xs font-bold text-rose-700 block uppercase">{activeSo.status}</span>
                    </div>
                  </div>
                </div>

                {/* Customer */}
                <div className="bg-gradient-to-br from-white to-rose-50/40 p-4 rounded-xl border border-rose-100 shadow-sm space-y-3">
                  <div className="border-b border-slate-100 pb-1.5">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Data Customer</h3>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Nama:</span>
                      <span className="text-xs font-bold text-slate-800 block">{activeSo.customer_nama || activeSo.customer?.nama || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Kode:</span>
                      <span className="text-xs font-mono font-bold text-slate-700 block">{activeSo.customer?.kode || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SO Items Table */}
            <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm space-y-3">
              <div className="border-b border-slate-100 pb-1.5">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Daftar Barang yang Dikirim</h3>
              </div>
              <div className="overflow-hidden rounded-lg border border-rose-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-rose-600 text-white font-bold text-xs uppercase">
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3 text-center w-20">Qty</th>
                      <th className="p-3 text-right w-36">Harga Jual</th>
                      <th className="p-3 text-right w-40">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 bg-white">
                    {(activeSo.sale_items || activeSo.items || []).map((item: any, idx: number) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors text-slate-800">
                        <td className="p-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.product_nama || item.product?.nama || '-'}</td>
                        <td className="p-3 text-center font-bold text-slate-700">{Number(item.qty)}</td>
                        <td className="p-3 text-right font-semibold text-slate-550">{formatCurrency(Number(item.unit_price || item.harga_jual || 0))}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(Number(item.qty) * Number(item.unit_price || item.harga_jual || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-slate-50/50 border-t border-rose-200 p-3 flex justify-end gap-4 text-xs font-bold">
                  <span className="text-slate-800">Total Penjualan SO:</span>
                  <span className="text-rose-600 font-black text-sm font-mono">{formatCurrency(Number(activeSo.subtotal))}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsInfoHidden((prev) => !prev)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all bg-white flex items-center gap-1.5"
              >
                <span>{isInfoHidden ? 'Tampilkan Info' : 'Sembunyikan Info'}</span>
              </button>
              <button type="button" onClick={() => { setActiveSo(null); setIsInfoHidden(false); }} className="px-5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm">
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      ) : activeAdj ? (
        /* Stock Adjustment Detail Modal Component */
        <div className="bg-white rounded-xl shadow-2xl border border-amber-100 overflow-hidden animate-scale-in text-slate-800 flex flex-col">
          <div className="bg-amber-600 !text-white px-6 py-3 flex justify-between items-center border-b border-amber-700">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-white/10 rounded-md">
                <Info size={14} className="!text-white" />
              </div>
              <h2 className="text-xs font-bold !text-white uppercase tracking-wider">Detail Penyesuaian Stok (Manual)</h2>
            </div>
            <button onClick={() => { setActiveAdj(null); }} className="!text-white/80 hover:!text-white transition-colors focus:outline-none">
              <X size={16} className="!text-white" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-white to-amber-50/40 p-4 rounded-xl border border-amber-100 shadow-sm space-y-3">
                <div className="border-b border-slate-100 pb-1.5">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Detail Perubahan</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal:</span>
                    <span className="text-xs font-bold text-slate-800 block">{formatDate(activeAdj.tanggal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Oleh Staff:</span>
                    <span className="text-xs font-bold text-slate-850 block">{activeAdj.staff}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Stok Berubah:</span>
                    <span className="text-xs font-bold block mt-0.5">
                      {activeAdj.stok_bertambah > 0 ? (
                        <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[11px] inline-block">
                          Bertambah +{activeAdj.stok_bertambah}
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[11px] inline-block">
                          Berkurang -{activeAdj.stok_berkurang}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white to-amber-50/40 p-4 rounded-xl border border-amber-100 shadow-sm space-y-3">
                <div className="border-b border-slate-100 pb-1.5">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Detail Barang</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Nama Barang:</span>
                    <span className="text-xs font-bold text-slate-850 block">{activeAdj.product_nama}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Kode Barang:</span>
                    <span className="text-xs font-mono font-bold text-slate-700 block">{activeAdj.product_kode}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reason Card */}
            <div className="bg-gradient-to-r from-amber-50/20 to-amber-50/60 p-4 rounded-xl border border-amber-100 shadow-sm space-y-2">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Alasan Penyesuaian Stok</h3>
              <p className="text-xs text-slate-700 font-medium leading-relaxed bg-white/70 p-3 rounded-lg border border-amber-100/50">
                {activeAdj.alasan || 'Tidak ada keterangan alasan tambahan.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setActiveAdj(null); }} className="px-5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm">
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Popup Delete Adjustment Confirmation Modal */}
      {deleteAdjTarget && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={() => setDeleteAdjTarget(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden text-slate-800 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Amber Header */}
            <div className="flex flex-col items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-5 py-4 text-white text-center w-full">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Info size={18} className="text-amber-400" />
              </div>
              <div className="flex flex-col items-center text-center">
                <h2 className="font-bold text-sm text-white">Hapus Penyesuaian Stok</h2>
                <p className="text-xs text-amber-400 mt-0.5 font-semibold">Tindakan ini akan mengembalikan stok barang di gudang</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-5 bg-white">
              <p className="text-slate-700 text-xs font-semibold leading-relaxed">
                Apakah Anda yakin ingin menghapus data penyesuaian stok produk <span className="font-extrabold text-slate-900">"{deleteAdjTarget.product_nama}"</span>?
              </p>
              <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5 text-xs text-slate-650">
                <div><span className="font-bold">Kode Barang:</span> <span className="font-mono">{deleteAdjTarget.product_kode}</span></div>
                <div><span className="font-bold">Staff:</span> {deleteAdjTarget.staff}</div>
                <div><span className="font-bold">Perubahan Qty:</span> {deleteAdjTarget.stok_bertambah > 0 ? `+${deleteAdjTarget.stok_bertambah}` : `-${deleteAdjTarget.stok_berkurang}`}</div>
                <div><span className="font-bold">Alasan:</span> {deleteAdjTarget.alasan}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 px-5 py-4 bg-slate-50 border-t border-slate-100 justify-end">
              <button
                onClick={() => setDeleteAdjTarget(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-250 text-slate-600 hover:bg-slate-100 transition-all bg-white"
              >
                Batal (Esc)
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-yellow-300 transition-all shadow-md shadow-red-500/20"
              >
                Ya, Hapus (Y)
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Popup Delete Blocked Modal */}
      {showBlockedDeleteModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowBlockedDeleteModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden text-slate-800 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Danger/Blocked Header */}
            <div className="flex flex-col items-center justify-center gap-2 bg-red-500/10 border-b border-red-500/20 px-5 py-4 text-white text-center w-full">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <X size={18} className="text-red-400" />
              </div>
              <div className="flex flex-col items-center text-center">
                <h2 className="font-bold text-sm text-white">Transaksi Tidak Dapat Dihapus</h2>
                <p className="text-xs text-red-400/80 mt-0.5 font-semibold">Gunakan menu pembelian/penjualan asal</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-5 bg-white">
              <p className="text-slate-700 text-xs font-semibold leading-relaxed">
                Data transaksi barang masuk (PO) atau keluar (SO) tidak bisa dihapus langsung dari menu pergerakan barang ini.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Jika ingin menghapusnya, silakan buka menu <span className="font-bold text-slate-750">Histori Pembelian</span> (untuk PO) atau <span className="font-bold text-slate-750">Histori Penjualan</span> (untuk SO).
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100 justify-end">
              <button
                onClick={() => setShowBlockedDeleteModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-yellow-300 transition-all shadow-md shadow-red-500/20"
              >
                Tutup (Enter / Esc)
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
