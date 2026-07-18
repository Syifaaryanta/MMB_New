import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Clock, Search, X, CheckSquare, Trash2, Calendar, User, CheckCircle, XCircle } from 'lucide-react';

interface PurchaseItem {
  id: string;
  product: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  };
  qty: number;
  harga_beli: number;
  subtotal: number;
}

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  supplier: {
    id: string;
    kode: string;
    nama: string;
    alamat: string | null;
    no_telp: string | null;
  };
  terms: string;
  subtotal: number;
  purchase_items?: PurchaseItem[];
}

export const DraftPO: React.FC = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Purchase[]>([]);
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
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false);

  const fetchDrafts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/purchases?status=draft');
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
    d.supplier.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDetail = async (draft: Purchase) => {
    setIsDetailLoading(true);
    setIsPopupOpen(true);
    try {
      const res = await api.get(`/purchases/${draft.id}`);
      setSelectedDraftDetail(res.data);
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat detail draft PO', 'error');
      setIsPopupOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCompletePO = async (poId: string) => {
    setIsDetailLoading(true);
    try {
      await api.patch(`/purchases/${poId}/complete`);
      showToast('Draft PO berhasil diselesaikan', 'success');
      setIsPopupOpen(false);
      setSelectedDraftDetail(null);
      setTimeout(() => {
        navigate('/pembelian');
      }, 500);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyelesaikan draft PO', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleDelete = async (id: string, no: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus draft PO "${no}"?`)) {
      try {
        await api.delete(`/purchases/${id}`);
        showToast(`Draft PO "${no}" berhasil dihapus`, 'success');
        fetchDrafts();
      } catch (err) {
        console.error(err);
        showToast('Gagal menghapus draft PO', 'error');
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
    if (!isPopupOpen && !showCompleteConfirmModal) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true });

  // Escape Key handling
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showCompleteConfirmModal) {
      setShowCompleteConfirmModal(false);
      return;
    }
    if (isPopupOpen) {
      setIsPopupOpen(false);
      setSelectedDraftDetail(null);
      setIsTableFocused(true);
      return;
    }
    if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      return;
    }
    navigate('/pembelian');
  }, { enableOnFormTags: true });

  // Enter Key handling
  useHotkeys('enter', (e) => {
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    if (showCompleteConfirmModal) {
      return;
    }
    if (isPopupOpen) {
      if (selectedDraftDetail) {
        e.preventDefault();
        navigate(`/pembelian/edit-order?no_order=${selectedDraftDetail.no_order}`);
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

  // P / F10 Key handling for Selesaikan PO inside popup detail
  useHotkeys('p', (e) => {
    if (isPopupOpen && selectedDraftDetail) {
      e.preventDefault();
      setShowCompleteConfirmModal(true);
    }
  }, { enableOnFormTags: true });

  useHotkeys('f10', (e) => {
    if (isPopupOpen && selectedDraftDetail) {
      e.preventDefault();
      setShowCompleteConfirmModal(true);
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

  // Delete draft PO
  useHotkeys('del', (e) => {
    if (isPopupOpen || showCompleteConfirmModal) return;
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    e.preventDefault();
    if (filteredDrafts.length > 0 && selectedIdx < filteredDrafts.length) {
      handleDelete(filteredDrafts[selectedIdx].id, filteredDrafts[selectedIdx].no_order);
    }
  }, { enableOnFormTags: true });

  const handleCompleteConfirmModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowCompleteConfirmModal(false);
    } else if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      e.stopPropagation();
      setShowCompleteConfirmModal(false);
      handleCompletePO(selectedDraftDetail.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Draft Order Pembelian (PO)</h1>
          <p className="text-slate-400">Daftar transaksi pemesanan barang yang ditunda atau belum diselesaikan</p>
        </div>
      </div>

      {/* Search Bar & Realtime Clock */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search size={16} />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Cari berdasarkan nama pemasok atau nomor PO... (Tekan F1)"
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
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 skeleton" />
          ))}
        </div>
      ) : filteredDrafts.length > 0 ? (
        <div className="card p-0 overflow-hidden border border-surface-700 shadow-sm">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">No</th>
                  <th className="p-4">No Order</th>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Supplier</th>
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
                      <td className={getTdClass('middle') + " font-bold text-slate-900"}>{d.supplier.nama}</td>
                      <td className={getTdClass('middle') + " text-center"}>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 border border-slate-200 text-slate-750">
                          {d.purchase_items?.length || 0} Barang
                        </span>
                      </td>
                      <td className={getTdClass('last') + " text-right font-bold text-slate-900 currency"}>
                        {formatCurrency(Number(d.subtotal))}
                      </td>
                    </tr>
                  )})}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/20">
          <Clock className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-400">Tidak ada Draft Order</h3>
          <p className="text-sm mt-1">Semua order pembelian aktif telah diselesaikan atau diterima.</p>
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
                    <h3 className="text-lg font-bold">Detail Draft Order PO</h3>
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
                    {/* Supplier Info */}
                    <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <h4 className="text-xs font-bold text-primary-600 uppercase tracking-wider">Informasi Pemasok</h4>
                      <div className="grid grid-cols-3 gap-y-1.5 text-xs text-slate-700">
                        <span className="text-slate-400 font-semibold">Kode:</span>
                        <span className="col-span-2 text-slate-900 font-mono font-medium">{selectedDraftDetail.supplier?.kode}</span>
                        <span className="text-slate-400 font-semibold">Nama:</span>
                        <span className="col-span-2 text-slate-900 font-bold">{selectedDraftDetail.supplier?.nama}</span>
                        <span className="text-slate-400 font-semibold">Telepon:</span>
                        <span className="col-span-2 text-slate-900">{selectedDraftDetail.supplier?.no_telp || '-'}</span>
                        <span className="text-slate-400 font-semibold">Alamat:</span>
                        <span className="col-span-2 text-slate-900 leading-relaxed">{selectedDraftDetail.supplier?.alamat || 'Alamat tidak dicantumkan'}</span>
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
                          {selectedDraftDetail.terms === 'tunai' ? 'Tunai' : `${selectedDraftDetail.terms} Bulan`}
                        </span>
                        <span className="text-slate-400 font-semibold">Catatan:</span>
                        <span className="col-span-2 text-slate-900 italic">
                          {selectedDraftDetail.note ? `"${selectedDraftDetail.note}"` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-750 uppercase tracking-wider">Item Barang</h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[250px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                            <th className="p-3 w-10 text-center">No</th>
                            <th className="p-3">Kode</th>
                            <th className="p-3">Nama Barang</th>
                            <th className="p-3 text-right w-24">Kuantitas</th>
                            <th className="p-3 text-right w-32">Harga Beli</th>
                            <th className="p-3 text-right w-32">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedDraftDetail.purchase_items?.map((item: any, index: number) => (
                            <tr key={item.id} className="bg-white hover:bg-slate-50 text-slate-800">
                              <td className="p-3 text-center text-slate-400">{index + 1}</td>
                              <td className="p-3 font-mono text-slate-650">{item.product?.kode}</td>
                              <td className="p-3 font-semibold text-slate-900">{item.product?.nama}</td>
                              <td className="p-3 text-right font-medium text-slate-755">
                                {Number(item.qty)}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-600">
                                {formatCurrency(Number(item.harga_beli))}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(Number(item.subtotal))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="flex flex-col items-end space-y-1.5 pt-4 border-t border-slate-100">
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
                    onClick={() => navigate(`/pembelian/edit-order?no_order=${selectedDraftDetail.no_order}`)}
                    className="px-4 py-2 rounded-lg bg-primary-600 !text-white text-xs font-bold hover:bg-primary-500 transition-all shadow-md shadow-primary-500/10"
                  >
                    Edit Draft (Enter)
                  </button>
                  <button
                    onClick={() => setShowCompleteConfirmModal(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 !text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
                  >
                    Selesaikan PO (F10)
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-white rounded-xl">
                <span className="text-slate-400 text-sm">Gagal memuat detail draft PO</span>
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Complete PO Confirmation Modal */}
      {showCompleteConfirmModal && selectedDraftDetail && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay p-4">
          <div
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={handleCompleteConfirmModalKeyDown}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-auto shadow-2xl animate-scale-in outline-none flex flex-col text-slate-800"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-emerald-400 border-b border-slate-100 pb-3 mb-4 text-center">
              <CheckSquare size={28} className="text-emerald-400" />
              <h3 className="text-lg font-bold text-slate-900">Selesaikan Purchase Order</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium text-center">
              PO ini akan diselesaikan dan datanya akan masuk ke antrean <strong className="text-slate-900">Menu Receiving</strong>.
              Stok di gudang tidak akan bertambah sebelum barang fisik secara resmi diterima.
            </p>
            <div className="flex justify-center gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowCompleteConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all bg-white"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompleteConfirmModal(false);
                  handleCompletePO(selectedDraftDetail.id);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 !text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-md shadow-emerald-500/10 font-bold"
              >
                Selesaikan (Y)
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg font-semibold text-xs flex items-center gap-2 animate-slide-in text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-danger-600'
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
