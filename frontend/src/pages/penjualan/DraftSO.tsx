import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate, parseAdjustments, formatExtraChargeDesc } from '@/lib/utils';
import { Clock, Search, X, Printer, Trash2, Truck, User, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';

interface SaleItem {
  id: string;
  product_nama: string;
  qty: number;
  product?: {
    satuan: string;
  };
}

interface Sale {
  id: string;
  no_order: string;
  order_date: string;
  customer_nama: string;
  subtotal: number;
  sale_items?: SaleItem[];
}

export const DraftSO: React.FC = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteCheckState, setDeleteCheckState] = useState<{
    status: 'idle' | 'can_delete';
    targetItem: Sale | null;
  }>({ status: 'idle', targetItem: null });

  // Real-time Clock State
  const [realtimeTime, setRealtimeTime] = useState('');

  // Focus & Navigation States
  const [isTableFocused, setIsTableFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement | null>>(new Map());

  // Detail View States
  const [selectedDraftDetail, setSelectedDraftDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isInfoHidden, setIsInfoHidden] = useState(false);

  // Printing States
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [completedSo, setCompletedSo] = useState<any | null>(null);

  // Print Confirmation Modal States
  const [showConfirmPrintModal, setShowConfirmPrintModal] = useState(false);
  const [sortOption, setSortOption] = useState<'asli' | 'abjad' | 'qty' | 'harga'>('asli');
  const confirmModalRef = useRef<HTMLDivElement>(null);

  const fetchDrafts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/sales?status=draft');
      setDrafts(res.data.data || []);
      setSelectedIdx(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

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

  // Focus confirmation modal when it shows up
  useEffect(() => {
    if (showConfirmPrintModal) {
      confirmModalRef.current?.focus();
    }
  }, [showConfirmPrintModal]);

  // Reset selected row index and list focus when search text changes
  useEffect(() => {
    setSelectedIdx(0);
    setIsTableFocused(false);
  }, [searchQuery]);

  // Handle auto-scroll for active row when selected index or table focus changes
  useEffect(() => {
    if (isTableFocused) {
      const activeRow = rowRefs.current.get(selectedIdx);
      if (activeRow) {
        activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIdx, isTableFocused]);

  const filteredDrafts = drafts.filter((d) =>
    d.no_order.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.customer_nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDetail = async (draft: Sale) => {
    setIsDetailLoading(true);
    try {
      const res = await api.get(`/sales/${draft.id}`);
      setSelectedDraftDetail(res.data);
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat detail draft SO', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handlePrintAndComplete = async (draftId: string) => {
    setIsDetailLoading(true);
    try {
      // 1. Complete the draft (moves to completed history)
      await api.patch(`/sales/${draftId}/complete`);
      // 2. Fetch invoice printed data
      const printRes = await api.patch(`/sales/${draftId}/print`);
      setCompletedSo(printRes.data);

      showToast('Draft SO berhasil diselesaikan', 'success');

      // Trigger print dialogue
      setTimeout(() => {
        window.print();
        // Reset states and refresh list
        setShowConfirmPrintModal(false);
        setSelectedDraftDetail(null);
        setCompletedSo(null);
        fetchDrafts();
      }, 300);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyelesaikan dan mencetak draft SO', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const confirmDeleteSale = async () => {
    const target = deleteCheckState.targetItem;
    if (!target) return;
    try {
      setIsLoading(true);
      await api.delete(`/sales/${target.id}`);
      showToast(`Draft SO "${target.no_order}" berhasil dihapus`, 'success');
      fetchDrafts();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Gagal menghapus draft SO', 'error');
    } finally {
      setIsLoading(false);
      setDeleteCheckState({ status: 'idle', targetItem: null });
    }
  };

  const handleDelete = async (id: string, no: string) => {
    const target = filteredDrafts.find(d => d.id === id);
    if (!target) return;
    setDeleteCheckState({
      status: 'can_delete',
      targetItem: target
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredDrafts.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        searchInputRef.current?.blur();
      }
    }
  };

  // Keyboard Shortcuts via useHotkeys
  // F1 Key handling
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (selectedDraftDetail) {
      setIsInfoHidden((prev) => !prev);
      return;
    }
    if (!showConfirmPrintModal) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true }, [selectedDraftDetail, showConfirmPrintModal]);

  // Escape Key handling
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (deleteCheckState.status === 'can_delete') {
      setDeleteCheckState({ status: 'idle', targetItem: null });
      return;
    }
    if (showConfirmPrintModal) {
      setShowConfirmPrintModal(false);
      return;
    }
    if (selectedDraftDetail) {
      setSelectedDraftDetail(null);
      setIsInfoHidden(false);
      setIsTableFocused(true);
      return;
    }
    if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      return;
    }
    navigate('/penjualan');
  }, { enableOnFormTags: true }, [deleteCheckState, showConfirmPrintModal, selectedDraftDetail, isTableFocused]);

  // Enter Key handling
  useHotkeys('enter', (e) => {
    if (deleteCheckState.status === 'can_delete') {
      e.preventDefault();
      e.stopPropagation();
      confirmDeleteSale();
      return;
    }
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    if (showConfirmPrintModal) {
      return;
    }
    if (selectedDraftDetail) {
      e.preventDefault();
      navigate(`/penjualan/edit?no_order=${selectedDraftDetail.no_order}`);
      return;
    }
    if (isTableFocused) {
      if (filteredDrafts.length > 0 && selectedIdx < filteredDrafts.length) {
        e.preventDefault();
        handleOpenDetail(filteredDrafts[selectedIdx]);
      }
    }
  }, { enableOnFormTags: true }, [deleteCheckState, filteredDrafts, selectedIdx, selectedDraftDetail, showConfirmPrintModal]);

  // P Key handling
  useHotkeys('p', (e) => {
    if (selectedDraftDetail && !showConfirmPrintModal) {
      e.preventDefault();
      setSortOption('asli');
      setShowConfirmPrintModal(true);
    }
  }, { enableOnFormTags: true }, [selectedDraftDetail, showConfirmPrintModal]);

  // Arrow Keys handling
  useHotkeys('up', (e) => {
    if (selectedDraftDetail) return;
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(0, prev - 1));
  }, { enableOnFormTags: true }, [selectedDraftDetail]);

  useHotkeys('down', (e) => {
    if (selectedDraftDetail) return;
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(filteredDrafts.length - 1, prev + 1));
  }, { enableOnFormTags: true }, [selectedDraftDetail, filteredDrafts]);

  // Delete draft SO
  useHotkeys('del', (e) => {
    if (selectedDraftDetail || showConfirmPrintModal) return;
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    e.preventDefault();
    if (filteredDrafts.length > 0 && selectedIdx < filteredDrafts.length) {
      handleDelete(filteredDrafts[selectedIdx].id, filteredDrafts[selectedIdx].no_order);
    }
  }, { enableOnFormTags: true }, [selectedDraftDetail, showConfirmPrintModal, filteredDrafts, selectedIdx]);

  const getSortedItems = (itemList: any[]) => {
    const list = [...itemList];
    if (sortOption === 'abjad') {
      return list.sort((a, b) => (a.product_nama || '').localeCompare(b.product_nama || ''));
    } else if (sortOption === 'qty') {
      return list.sort((a, b) => Number(b.qty) - Number(a.qty));
    } else if (sortOption === 'harga') {
      return list.sort((a, b) => Number(b.unit_price) - Number(a.unit_price));
    }
    return list;
  };

  const handleConfirmPrintModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowConfirmPrintModal(false);
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      handlePrintAndComplete(selectedDraftDetail.id);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const sortOptions: Array<'asli' | 'abjad' | 'qty' | 'harga'> = ['asli', 'abjad', 'qty', 'harga'];
      const currentIndex = sortOptions.indexOf(sortOption);
      const nextIndex = (currentIndex + 1) % sortOptions.length;
      setSortOption(sortOptions[nextIndex]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const sortOptions: Array<'asli' | 'abjad' | 'qty' | 'harga'> = ['asli', 'abjad', 'qty', 'harga'];
      const currentIndex = sortOptions.indexOf(sortOption);
      const nextIndex = (currentIndex - 1 + sortOptions.length) % sortOptions.length;
      setSortOption(sortOptions[nextIndex]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Draft Order Penjualan (SO)</h1>
          <p className="text-slate-400">Daftar transaksi kasir penjualan yang ditunda atau belum difinalisasi</p>
        </div>
      </div>

      {!selectedDraftDetail ? (
        <>
          {/* Search Bar & Realtime Clock */}
          <div className="print:hidden flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari berdasarkan nama pelanggan atau nomor SO... (Tekan F1)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="input-field pl-9 w-full py-2 text-xs"
                autoFocus
              />
            </div>
            <div className="bg-surface-800 border border-surface-700 px-4 py-2 rounded-lg text-slate-300 font-mono text-xs flex items-center justify-center shrink-0 shadow-sm min-w-[220px]">
              {realtimeTime}
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="print:hidden space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 skeleton" />
              ))}
            </div>
          ) : filteredDrafts.length > 0 ? (
            <div className="print:hidden card p-0 overflow-hidden border border-surface-700 shadow-sm">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4 w-12 text-center">No</th>
                      <th className="p-4">No Order</th>
                      <th className="p-4">Tanggal</th>
                      <th className="p-4">Pelanggan</th>
                      <th className="p-4 text-center">Jumlah Barang</th>
                      <th className="p-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrafts.map((d, idx) => {
                      const isFocused = idx === selectedIdx && isTableFocused;
                      const rowBgClass = isFocused ? 'bg-blue-100' : 'hover:bg-slate-50';

                      const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                        let base = "p-4 text-xs transition-all duration-150 border-b ";
                        if (isFocused) {
                          base += "bg-blue-100 text-primary-950 font-bold border-blue-300 ";
                          if (pos === 'first') base += "border-l-4 border-primary-600 ";
                        } else {
                          base += "text-slate-800 border-slate-200 ";
                          if (pos === 'first') base += "border-l-4 border-transparent ";
                        }
                        return base;
                      };

                      return (
                        <tr
                          key={d.id}
                          ref={(el) => {
                            rowRefs.current.set(idx, el);
                          }}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setIsTableFocused(true);
                          }}
                          onDoubleClick={() => handleOpenDetail(d)}
                          className={`cursor-pointer transition-all ${rowBgClass}`}
                        >
                          <td className={getTdClass('first') + " text-center text-slate-500 font-mono text-xs"}>{idx + 1}</td>
                          <td className={getTdClass('middle') + " font-mono"}>
                            <span className="px-2 py-0.5 rounded bg-blue-50/80 text-primary-700 border border-blue-100 font-mono font-bold text-xs inline-block">
                              {d.no_order}
                            </span>
                          </td>
                          <td className={getTdClass('middle') + " text-slate-700 font-medium"}>
                            {formatDate(d.order_date)}
                          </td>
                          <td className={getTdClass('middle') + " font-bold text-slate-900"}>{d.customer_nama}</td>
                          <td className={getTdClass('middle') + " text-center"}>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 border border-slate-200 text-slate-750">
                              {d.sale_items?.length || 0} Barang
                            </span>
                          </td>
                          <td className={getTdClass('last') + " text-right font-bold text-slate-900 currency"}>
                            {formatCurrency(Number(d.subtotal))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="print:hidden flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/20">
              <Clock className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-400">Tidak ada Draft Order SO</h3>
              <p className="text-sm mt-1">Semua order penjualan aktif telah diselesaikan atau dicetak.</p>
            </div>
          )}
        </>
      ) : (
        /* SO Draft Detail View (In-place) */
        <div className="space-y-4 animate-fade-in text-slate-800">
          {/* Detail Page Title (Teks saja) */}
          <div className="pb-1">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <span>Detail Draft Order: {selectedDraftDetail.no_order}</span>
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">Status: <span className="font-bold text-amber-600 uppercase">DRAFT</span></p>
          </div>

          {isDetailLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-400 text-sm">Memuat detail draft...</span>
            </div>
          ) : (
            <>
              {/* 2 Separate Cards Layout */}
              {!isInfoHidden && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Informasi Order */}
                  <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="bg-blue-50 border-b border-blue-100 px-3.5 py-2">
                      <h3 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Informasi Order</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-3.5 text-xs text-slate-600">
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">No. Order</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{selectedDraftDetail.no_order}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">No. Faktur</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{selectedDraftDetail.no_faktur || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal Order</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{formatDate(selectedDraftDetail.order_date)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Pengiriman</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                          {selectedDraftDetail.diantar ? 'Diantar' : 'Diambil'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Jatuh Tempo</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                          {selectedDraftDetail.limit_bulan !== undefined ? `${selectedDraftDetail.limit_bulan + 1} Bulan` : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Status Cetak</span>
                        <span className="text-xs font-bold mt-0.5 block text-amber-600">Belum Cetak (Draft)</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Data Customer */}
                  <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="bg-amber-50 border-b border-amber-100 px-3.5 py-2">
                      <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Data Customer</h3>
                    </div>
                    <div className="space-y-3.5 p-3.5 text-xs text-slate-655">
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Nama Customer</span>
                        <span className="text-xs font-extrabold text-slate-850 mt-0.5 block">{selectedDraftDetail.customer_nama}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Alamat Pengiriman</span>
                        <span className="text-xs font-semibold text-slate-700 mt-0.5 block leading-normal">
                          {selectedDraftDetail.customer_alamat || 'Alamat tidak dicantumkan'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">No. Telepon / Kontak</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{selectedDraftDetail.customer_telp || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Card 3: Daftar Barang */}
              <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
                  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Daftar Barang</h3>
                </div>
                <div className="p-4">
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3 w-32 text-center">Kode</th>
                          <th className="p-3">Nama Barang</th>
                          <th className="p-3 text-center w-24">Qty</th>
                          <th className="p-3 text-right w-36">Harga Satuan</th>
                          <th className="p-3 text-right w-40">Total Harga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedDraftDetail.sale_items?.map((item: any, idx: number) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-855">
                            <td className="p-3 text-center font-semibold text-slate-550">{idx + 1}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                                {item.product_kode || item.product?.kode || '-'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-800">{item.product_nama || item.product?.nama || '-'}</td>
                            <td className="p-3 text-center font-bold text-slate-700">{Number(item.qty)}</td>
                            <td className="p-3 text-right font-semibold text-slate-600">{formatCurrency(Number(item.unit_price))}</td>
                            <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(Number(item.total))}</td>
                          </tr>
                        ))}
                        {parseAdjustments(selectedDraftDetail.extra_charge_desc, selectedDraftDetail.extra_charge_amount).map((adj, index) => (
                          <tr key={`adj-${index}`} className="hover:bg-slate-50 transition-colors text-slate-855">
                            <td className="p-3 text-center font-semibold text-slate-400">-</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-slate-100 text-slate-500 border border-slate-200/60">
                                ADJ
                              </span>
                            </td>
                            <td className="p-3 font-bold italic text-slate-600">{adj.product_nama}</td>
                            <td className="p-3 text-center font-semibold text-slate-400">-</td>
                            <td className={`p-3 text-right font-mono font-bold ${adj.total < 0 ? 'text-danger-600' : 'text-emerald-600'}`}>
                              {adj.total < 0 ? '-' : '+'}{formatCurrency(Math.abs(adj.total))}
                            </td>
                            <td className={`p-3 text-right font-mono font-bold ${adj.total < 0 ? 'text-danger-600' : 'text-emerald-600'}`}>
                              {adj.total < 0 ? '-' : '+'}{formatCurrency(Math.abs(adj.total))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-end gap-2 text-xs">
                      <div className="flex gap-6 items-center">
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Grand Total Draft</span>
                        <span className="text-base font-extrabold text-blue-600 font-mono">
                          {formatCurrency(Number(selectedDraftDetail.subtotal))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Buttons */}
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsInfoHidden((prev) => !prev)}
                  className="px-5 py-2.5 rounded-lg border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 focus:outline-none"
                >
                  <span>{isInfoHidden ? 'Tampilkan Info' : 'Sembunyikan Info'}</span>
                  <kbd className="text-[10px] text-blue-500 font-bold font-mono uppercase bg-blue-50 border border-blue-200 px-1 py-0.5 rounded ml-1">F1</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDraftDetail(null);
                    setIsInfoHidden(false);
                  }}
                  className="px-5 py-2.5 rounded-lg border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 focus:outline-none"
                >
                  <span>Tutup</span>
                  <kbd className="text-[10px] text-blue-500 font-bold font-mono uppercase bg-blue-50 border border-blue-200 px-1 py-0.5 rounded ml-1">Esc</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/penjualan/edit?no_order=${selectedDraftDetail.no_order}`)}
                  className="px-5 py-2.5 rounded-lg border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 focus:outline-none"
                >
                  <span>Edit Draft</span>
                  <kbd className="text-[10px] text-blue-500 font-bold font-mono uppercase bg-blue-50 border border-blue-200 px-1 py-0.5 rounded ml-1">Enter</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortOption('asli');
                    setShowConfirmPrintModal(true);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10 flex items-center gap-2 focus:outline-none"
                >
                  <Printer size={15} />
                  <span>Selesaikan & Cetak</span>
                  <kbd className="text-[10px] text-blue-200 font-bold font-mono uppercase bg-blue-700 px-1.5 py-0.5 rounded ml-1">P</kbd>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Print Confirmation Modal */}
      {showConfirmPrintModal && selectedDraftDetail && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay p-4">
          <div
            ref={confirmModalRef}
            tabIndex={0}
            onKeyDown={handleConfirmPrintModalKeyDown}
            className="bg-white rounded-xl p-6 max-w-3xl w-full mx-auto shadow-2xl animate-scale-in outline-none flex flex-col text-slate-800"
          >
            {/* Header */}
            <div className="flex justify-between items-center w-full border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Printer size={18} className="text-primary-600" />
                <span>Konfirmasi Cetak Nota</span>
              </h3>
              <button
                onClick={() => setShowConfirmPrintModal(false)}
                className="text-slate-450 hover:text-slate-650 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Subtitle */}
            <p className="text-xs text-slate-500 mt-4 font-medium">
              Pilih urutan item, lalu klik Print (P) untuk mencetak dan menyelesaikan draft order ini.
            </p>

            {/* Sorting Pills */}
            <div className="flex flex-wrap gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setSortOption('asli')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${sortOption === 'asli'
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Urutan Asli
              </button>
              <button
                type="button"
                onClick={() => setSortOption('abjad')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${sortOption === 'abjad'
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Abjad (A-Z)
              </button>
              <button
                type="button"
                onClick={() => setSortOption('qty')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${sortOption === 'qty'
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Qty Terbanyak
              </button>
              <button
                type="button"
                onClick={() => setSortOption('harga')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${sortOption === 'harga'
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Harga Tertinggi
              </button>
            </div>

            {/* Items Preview Table */}
            <div className="mt-4 rounded-lg overflow-hidden max-h-[250px] overflow-y-auto bg-slate-50">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-250 text-slate-700 font-bold">
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3 text-right w-20">Qty</th>
                    <th className="p-3 text-right w-32">Harga</th>
                    <th className="p-3 text-right w-32">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {getSortedItems(selectedDraftDetail.sale_items || []).map((item: any, idx: number) => (
                    <tr key={idx} className="bg-white hover:bg-slate-50 text-slate-800">
                      <td className="p-3 font-semibold text-slate-900">{item.product_nama || item.product?.nama}</td>
                      <td className="p-3 text-right font-medium text-slate-700">{Number(item.qty)}</td>
                      <td className="p-3 text-right font-mono font-medium text-slate-600">{formatCurrency(Number(item.unit_price))}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatCurrency(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowConfirmPrintModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all bg-white"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={() => handlePrintAndComplete(selectedDraftDetail.id)}
                className="px-4 py-2 rounded-lg bg-emerald-600 !text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-md shadow-emerald-500/10"
              >
                Print (P)
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Print Layout */}
      {completedSo && (() => {
        const sortedPrintItems = getSortedItems(completedSo.sale_items.map((item: any) => ({
          product_id: item.product_id,
          product_kode: item.product_kode,
          product_nama: item.product_nama,
          qty: Number(item.qty),
          unit_price: Number(item.unit_price),
          total: Number(item.qty) * Number(item.unit_price),
        })));

        return (
          <div className="hidden print:block text-black bg-white font-mono text-[11px] leading-relaxed p-4">
            {printFormat === 'thermal' ? (
              /* Thermal Print (58mm/80mm layout) */
              <div className="w-[72mm] mx-auto p-1 space-y-3">
                <div className="text-center">
                  <h2 className="font-bold text-sm uppercase">Maju Mulia Bersama</h2>
                  <p className="text-[10px]">Jl. Raya Industri Utama No. 88, Bekasi</p>
                  <p className="text-[10px]">Telp: 021-89876543</p>
                  <p className="border-t border-dashed border-black my-1.5"></p>
                </div>
                <div className="space-y-0.5">
                  <p>No. Faktur: {completedSo.no_faktur || completedSo.no_order}</p>
                  <p>Tanggal: {formatDate(completedSo.order_date)}</p>
                  <p>Pelanggan: {completedSo.customer_nama}</p>
                  <p>Termin: {completedSo.limit_bulan > 0 ? `${completedSo.limit_bulan} Bulan` : 'Tunai'}</p>
                  <p>Status: {completedSo.limit_bulan > 0 ? 'BELUM LUNAS (KREDIT J.TEMPO)' : 'LUNAS'}</p>
                  {completedSo.sender_note && <p>Keterangan: {completedSo.sender_note}</p>}
                  <p className="border-t border-dashed border-black my-1.5"></p>
                </div>
                <div className="space-y-1">
                  {sortedPrintItems.map((item: any, idx: number) => (
                    <div key={idx} className="space-y-0.5">
                      <p className="font-bold">{item.product_nama}</p>
                      <div className="flex justify-between text-[10px]">
                        <span>{Number(item.qty)} x {formatCurrency(Number(item.unit_price))}</span>
                        <span>{formatCurrency(Number(item.total))}</span>
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-dashed border-black my-1.5"></p>
                </div>
                <div className="space-y-0.5 text-right font-semibold">
                  {parseAdjustments(completedSo.extra_charge_desc, completedSo.extra_charge_amount).map((adj, index) => (
                    <p key={index}>{adj.product_nama}: {adj.total < 0 ? '' : '+'}{formatCurrency(adj.total)}</p>
                  ))}
                  <p className="font-bold text-xs">Total: {formatCurrency(Number(completedSo.subtotal))}</p>
                </div>
                <div className="text-center text-[9px] pt-3 space-y-0.5">
                  <p>Terima Kasih Atas Kunjungan Anda</p>
                  <p>Barang yang sudah dibeli tidak dapat ditukar</p>
                </div>
              </div>
            ) : (
              /* A4 Print Layout */
              <div className="space-y-6 max-w-[21cm] mx-auto p-4">
                <div className="flex justify-between items-start border-b border-black pb-4">
                  <div>
                    <h1 className="text-lg font-bold uppercase tracking-wider">Maju Mulia Bersama</h1>
                    <p className="text-xs text-slate-700">Distributor Bahan Bangunan & Logam</p>
                    <p className="text-xs text-slate-700">Jl. Raya Industri Utama No. 88, Cikarang, Bekasi</p>
                    <p className="text-xs text-slate-700">Telp: (021) 89876543 | Email: contact@mmb.com</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-base font-bold uppercase">Faktur Penjualan</h2>
                    <p className="text-xs font-semibold font-mono">{completedSo.no_faktur || completedSo.no_order}</p>
                    <p className="text-[10px] mt-2">Tanggal: {formatDate(completedSo.order_date)}</p>
                    {completedSo.due_date && (
                      <p className="text-[10px] text-red-600 font-bold">Jatuh Tempo: {formatDate(completedSo.due_date)}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[10px]">
                  <div>
                    <p className="font-bold uppercase text-slate-500">Pelanggan:</p>
                    <p className="font-bold text-xs">{completedSo.customer_nama}</p>
                    <p>{completedSo.customer_alamat || 'Alamat tidak dicantumkan'}</p>
                    <p>Telp: {completedSo.customer_telp || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-slate-500">Pengiriman & Catatan:</p>
                    <p className="font-semibold flex items-center gap-1">
                      {completedSo.diantar ? (
                        <>
                          <Truck size={14} className="text-black" />
                          <span>DIANTAR SOPIR</span>
                        </>
                      ) : (
                        <>
                          <User size={14} className="text-black" />
                          <span>DIAMBIL</span>
                        </>
                      )}
                    </p>
                    {completedSo.sender_note && <p className="italic mt-1">"{completedSo.sender_note}"</p>}
                  </div>
                </div>

                <table className="w-full text-left text-[10px] border-collapse border border-black">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black font-bold uppercase text-[9px]">
                      <th className="p-1.5 border-r border-black w-8 text-center">No</th>
                      <th className="p-1.5 border-r border-black">Kode Barang</th>
                      <th className="p-1.5 border-r border-black">Nama Produk</th>
                      <th className="p-1.5 border-r border-black text-right w-20">Kuantitas</th>
                      <th className="p-1.5 border-r border-black text-right w-28">Harga</th>
                      <th className="p-1.5 text-right w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    {sortedPrintItems.map((item: any, idx: number) => (
                      <tr key={idx} className="align-top">
                        <td className="p-1.5 border-r border-black text-center">{idx + 1}</td>
                        <td className="p-1.5 border-r border-black font-mono">{item.product_kode}</td>
                        <td className="p-1.5 border-r border-black font-bold">{item.product_nama}</td>
                        <td className="p-1.5 border-r border-black text-right">{Number(item.qty)}</td>
                        <td className="p-1.5 border-r border-black text-right">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="p-1.5 text-right">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                    {parseAdjustments(completedSo.extra_charge_desc, completedSo.extra_charge_amount).map((adj, index) => (
                      <tr key={`adj-${index}`} className="align-top">
                        <td className="p-1.5 border-r border-black text-center">-</td>
                        <td className="p-1.5 border-r border-black font-mono">ADJ</td>
                        <td className="p-1.5 border-r border-black font-bold italic">{adj.product_nama}</td>
                        <td className="p-1.5 border-r border-black text-right">-</td>
                        <td className="p-1.5 border-r border-black text-right font-mono font-bold">
                          {adj.total < 0 ? '-' : '+'}{formatCurrency(Math.abs(adj.total))}
                        </td>
                        <td className="p-1.5 text-right font-bold font-mono">
                          {adj.total < 0 ? '-' : '+'}{formatCurrency(Math.abs(adj.total))}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 border-t border-black">
                      <td colSpan={5} className="p-1.5 border-r border-black text-right font-bold uppercase">
                        Grand Total Penjualan
                      </td>
                      <td className="p-1.5 text-right font-black">
                        {formatCurrency(Number(completedSo.subtotal))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-3 gap-4 text-center text-[9px] pt-8">
                  <div className="space-y-10">
                    <p>Penerima / Customer</p>
                    <p className="underline font-bold">( ____________________ )</p>
                  </div>
                  <div className="space-y-10">
                    <p>Sopir / Pengirim</p>
                    <p className="underline font-bold">( ____________________ )</p>
                  </div>
                  <div className="space-y-10">
                    <p>Hormat Kami, Kasir</p>
                    <p className="underline font-bold">({completedSo.creator?.nama || '____________________'})</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {deleteCheckState.status === 'can_delete' && deleteCheckState.targetItem && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in" onClick={() => setDeleteCheckState({ status: 'idle', targetItem: null })}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden text-slate-800 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              {/* Amber Header */}
              <div className="flex flex-col items-center justify-center gap-2 bg-amber-500 border-b border-amber-600 px-5 py-4 text-center w-full">
                <div className="p-2 bg-white/20 rounded-full">
                  <AlertTriangle size={20} className="text-white" />
                </div>
                <div className="flex flex-col items-center text-center">
                  <h2 className="font-extrabold text-sm text-white uppercase tracking-wider">Konfirmasi Hapus Draft SO</h2>
                  <p className="text-xs text-amber-50 mt-1 font-semibold text-white">Tindakan ini akan mengembalikan stok barang ke gudang</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5 bg-white text-xs">
                <p className="text-slate-700 font-semibold leading-relaxed">
                  Apakah Anda yakin ingin menghapus draft SO <span className="font-extrabold text-slate-900">"{deleteCheckState.targetItem.no_order}"</span>?
                </p>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5 text-xs text-slate-650">
                  <div><span className="font-bold">Tanggal SO:</span> {formatDate(deleteCheckState.targetItem.order_date)}</div>
                  <div><span className="font-bold">Customer:</span> {deleteCheckState.targetItem.customer_nama}</div>
                  <div><span className="font-bold">Total Nilai SO:</span> {formatCurrency(deleteCheckState.targetItem.subtotal)}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 px-5 py-4 bg-slate-50 border-t border-slate-100 justify-end">
                <button
                  onClick={() => setDeleteCheckState({ status: 'idle', targetItem: null })}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-250 text-slate-650 hover:bg-slate-100 transition-all bg-white"
                >
                  Batal (Esc)
                </button>
                <button
                  onClick={confirmDeleteSale}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-yellow-300 transition-all shadow-md shadow-red-500/20"
                >
                  Ya, Hapus (Enter)
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg font-semibold text-xs flex items-center gap-2 animate-slide-in text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-danger-600'
          }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-white" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-white" />
          )}
          <span className="!text-white">{toast.message}</span>
        </div>
      )}
    </div>
  );
};
