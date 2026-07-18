import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Clock, Search, X, Printer, Trash2, Truck, User, CheckCircle, XCircle } from 'lucide-react';

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

  // Real-time Clock State
  const [realtimeTime, setRealtimeTime] = useState('');

  // Focus & Navigation States
  const [isTableFocused, setIsTableFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement | null>>(new Map());

  // Detail Popup States
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedDraftDetail, setSelectedDraftDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

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
    setIsPopupOpen(true);
    try {
      const res = await api.get(`/sales/${draft.id}`);
      setSelectedDraftDetail(res.data);
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat detail draft SO', 'error');
      setIsPopupOpen(false);
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
        setIsPopupOpen(false);
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

  const handleDelete = async (id: string, no: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus draft SO "${no}"?`)) {
      try {
        await api.delete(`/sales/${id}`);
        showToast(`Draft SO "${no}" berhasil dihapus`, 'success');
        fetchDrafts();
      } catch (err) {
        console.error(err);
        showToast('Gagal menghapus draft SO', 'error');
      }
    }
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
  // F1 Key handling to focus search input
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (!isPopupOpen && !showConfirmPrintModal) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true });

  // Escape Key handling
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showConfirmPrintModal) {
      setShowConfirmPrintModal(false);
      return;
    }
    if (isPopupOpen) {
      setIsPopupOpen(false);
      setSelectedDraftDetail(null);
      // return to table focus
      setIsTableFocused(true);
      return;
    }
    if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      return;
    }
    navigate('/penjualan');
  }, { enableOnFormTags: true });

  // Enter Key handling
  useHotkeys('enter', (e) => {
    // If typing in search bar, do not trigger global Enter hotkey logic
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    if (showConfirmPrintModal) {
      return;
    }
    if (isPopupOpen) {
      if (selectedDraftDetail) {
        e.preventDefault();
        // Redirect to Edit Nota Penjualan page
        navigate(`/penjualan/edit?no_order=${selectedDraftDetail.no_order}`);
      }
      return;
    }
    if (isTableFocused) {
      if (filteredDrafts.length > 0 && selectedIdx < filteredDrafts.length) {
        e.preventDefault();
        handleOpenDetail(filteredDrafts[selectedIdx]);
      }
    }
  }, { enableOnFormTags: true });

  // P Key handling (case-insensitive)
  useHotkeys('p', (e) => {
    if (isPopupOpen && selectedDraftDetail) {
      e.preventDefault();
      if (showConfirmPrintModal) {
        handlePrintAndComplete(selectedDraftDetail.id);
      } else {
        setShowConfirmPrintModal(true);
      }
    }
  }, { enableOnFormTags: true });

  // Arrow Keys handling
  useHotkeys('up', (e) => {
    if (isPopupOpen) return;
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(0, prev - 1));
  }, { enableOnFormTags: true });

  useHotkeys('down', (e) => {
    if (isPopupOpen) return;
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(filteredDrafts.length - 1, prev + 1));
  }, { enableOnFormTags: true });

  // Delete draft SO
  useHotkeys('del', (e) => {
    if (isPopupOpen || showConfirmPrintModal) return;
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    e.preventDefault();
    if (filteredDrafts.length > 0 && selectedIdx < filteredDrafts.length) {
      handleDelete(filteredDrafts[selectedIdx].id, filteredDrafts[selectedIdx].no_order);
    }
  }, { enableOnFormTags: true });

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
                  )
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

      {/* Detail Modal Popup */}
      {isPopupOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full mx-auto shadow-2xl animate-scale-in outline-none flex flex-col max-h-[90vh] text-slate-800">
            {isDetailLoading && !selectedDraftDetail ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-white rounded-xl">
                <span className="text-slate-400 text-sm">Memuat detail draft...</span>
              </div>
            ) : selectedDraftDetail ? (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 bg-primary-600 rounded-t-xl text-white">
                  <div>
                    <h3 className="text-lg font-bold">Detail Draft Order</h3>
                    <p className="text-xs text-primary-200 font-mono mt-0.5">{selectedDraftDetail.no_order}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsPopupOpen(false);
                      setSelectedDraftDetail(null);
                    }}
                    className="p-1 rounded-lg hover:bg-primary-700 text-primary-200 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                  {/* Grid Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Customer Info */}
                    <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <h4 className="text-xs font-bold text-primary-600 uppercase tracking-wider">Informasi Pelanggan</h4>
                      <div className="grid grid-cols-3 gap-y-1.5 text-xs text-slate-700">
                        <span className="text-slate-400 font-semibold">Kode:</span>
                        <span className="col-span-2 text-slate-900 font-mono font-medium">{selectedDraftDetail.customer?.kode}</span>
                        <span className="text-slate-400 font-semibold">Nama:</span>
                        <span className="col-span-2 text-slate-900 font-bold">{selectedDraftDetail.customer_nama}</span>
                        <span className="text-slate-400 font-semibold">Telepon:</span>
                        <span className="col-span-2 text-slate-900">{selectedDraftDetail.customer_telp || '-'}</span>
                        <span className="text-slate-400 font-semibold">Alamat:</span>
                        <span className="col-span-2 text-slate-900 leading-relaxed">{selectedDraftDetail.customer_alamat || 'Alamat tidak dicantumkan'}</span>
                      </div>
                    </div>

                    {/* Order Meta Info */}
                    <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <h4 className="text-xs font-bold text-primary-600 uppercase tracking-wider">Informasi Transaksi</h4>
                      <div className="grid grid-cols-3 gap-y-1.5 text-xs text-slate-700">
                        <span className="text-slate-400 font-semibold">Tanggal:</span>
                        <span className="col-span-2 text-slate-900">{formatDate(selectedDraftDetail.order_date)}</span>
                        <span className="text-slate-400 font-semibold">Termin:</span>
                        <span className="col-span-2 text-slate-900">
                          {selectedDraftDetail.limit_bulan > 0 ? `${selectedDraftDetail.limit_bulan} Bulan` : 'Tunai'}
                        </span>
                        <span className="text-slate-400 font-semibold">Pengiriman:</span>
                        <span className="col-span-2 text-slate-900 flex items-center gap-1.5 font-medium">
                          {selectedDraftDetail.diantar ? (
                            <>
                              <Truck size={14} className="text-slate-500" />
                              <span>DIANTAR</span>
                            </>
                          ) : (
                            <>
                              <User size={14} className="text-slate-500" />
                              <span>DIAMBIL</span>
                            </>
                          )}
                        </span>
                        <span className="text-slate-400 font-semibold">Catatan:</span>
                        <span className="col-span-2 text-slate-900 italic">
                          {selectedDraftDetail.sender_note ? `"${selectedDraftDetail.sender_note}"` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items Card List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-750 uppercase tracking-wider">Item Barang</h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {selectedDraftDetail.sale_items?.map((item: any, index: number) => {
                        const unitPrice = Number(item.unit_price);
                        const total = Number(item.total);

                        return (
                          <div key={item.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                            {/* Product Header */}
                            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                              <div>
                                <h4 className="font-bold text-sm text-slate-800">
                                  {item.product_nama || item.product?.nama || '-'}
                                </h4>
                                <p className="text-[11px] text-slate-450 font-mono mt-0.5">{item.product_kode || item.product?.kode || '-'}</p>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200/50">
                                Qty: {Number(item.qty)}
                              </span>
                            </div>

                            {/* Price Details Grid */}
                            <div className="grid grid-cols-2 gap-4 pt-1">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Harga Satuan</span>
                                <strong className="text-xs font-bold text-slate-650 block">{formatCurrency(unitPrice)}</strong>
                              </div>
                              <div className="space-y-0.5 text-right">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Total Nilai</span>
                                <strong className="text-base font-extrabold text-blue-600 block">{formatCurrency(total)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="flex flex-col items-end space-y-1.5 pt-4 border-t border-slate-100">
                    {Number(selectedDraftDetail.extra_charge_amount) !== 0 && (
                      <div className="flex gap-4 text-xs font-mono text-slate-500">
                        <span>Penyesuaian ({selectedDraftDetail.extra_charge_desc}):</span>
                        <span>{formatCurrency(Number(selectedDraftDetail.extra_charge_amount))}</span>
                      </div>
                    )}
                    <div className="flex gap-6 items-center">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Grand Total:</span>
                      <span className="text-xl font-extrabold text-emerald-600 font-mono">
                        {formatCurrency(Number(selectedDraftDetail.subtotal))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Footer (Actions) */}
                <div className="bg-slate-50 p-4 rounded-b-xl flex justify-end gap-3 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setIsPopupOpen(false);
                      setSelectedDraftDetail(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all bg-white shadow-sm"
                  >
                    Batal (Esc)
                  </button>
                  <button
                    onClick={() => navigate(`/penjualan/edit?no_order=${selectedDraftDetail.no_order}`)}
                    className="px-4 py-2 rounded-lg bg-primary-600 !text-white text-xs font-bold hover:bg-primary-500 transition-all shadow-md shadow-primary-500/10"
                  >
                    Edit Draft (Enter)
                  </button>
                  <button
                    onClick={() => {
                      setSortOption('asli');
                      setShowConfirmPrintModal(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 !text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
                  >
                    <Printer size={14} /> Print (P)
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-white rounded-xl">
                <span className="text-slate-400 text-sm">Gagal memuat detail draft SO</span>
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
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
                  {Number(completedSo.extra_charge_amount) !== 0 && (
                    <p>Adj ({completedSo.extra_charge_desc}): {formatCurrency(Number(completedSo.extra_charge_amount))}</p>
                  )}
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
                    {Number(completedSo.extra_charge_amount) !== 0 && (
                      <tr>
                        <td colSpan={5} className="p-1.5 border-r border-black text-right font-bold uppercase">
                          Penyesuaian ({completedSo.extra_charge_desc})
                        </td>
                        <td className="p-1.5 text-right font-bold">
                          {formatCurrency(Number(completedSo.extra_charge_amount))}
                        </td>
                      </tr>
                    )}
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
