import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Clock, Search, X, CheckSquare, Trash2, Calendar, User, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';

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
  const [deleteCheckState, setDeleteCheckState] = useState<{
    status: 'idle' | 'can_delete';
    targetItem: Purchase | null;
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
    try {
      const res = await api.get(`/purchases/${draft.id}`);
      setSelectedDraftDetail(res.data);
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat detail draft PO', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCompletePO = async (poId: string) => {
    setIsDetailLoading(true);
    try {
      await api.patch(`/purchases/${poId}/complete`);
      showToast('Draft PO berhasil diselesaikan', 'success');
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

  const confirmDeletePurchase = async () => {
    const target = deleteCheckState.targetItem;
    if (!target) return;
    try {
      setIsLoading(true);
      await api.delete(`/purchases/${target.id}`);
      showToast(`Draft PO "${target.no_order}" berhasil dihapus`, 'success');
      fetchDrafts();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Gagal menghapus draft PO', 'error');
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
    if (!showCompleteConfirmModal) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true }, [selectedDraftDetail, showCompleteConfirmModal]);

  // Escape Key handling
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (deleteCheckState.status === 'can_delete') {
      setDeleteCheckState({ status: 'idle', targetItem: null });
      return;
    }
    if (showCompleteConfirmModal) {
      setShowCompleteConfirmModal(false);
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
    navigate('/pembelian');
  }, { enableOnFormTags: true }, [deleteCheckState, showCompleteConfirmModal, selectedDraftDetail, isTableFocused]);

  // Enter Key handling
  useHotkeys('enter', (e) => {
    if (deleteCheckState.status === 'can_delete') {
      e.preventDefault();
      e.stopPropagation();
      confirmDeletePurchase();
      return;
    }
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    if (showCompleteConfirmModal) {
      return;
    }
    if (selectedDraftDetail) {
      e.preventDefault();
      navigate(`/pembelian/edit-order?no_order=${selectedDraftDetail.no_order}`);
      return;
    }
    if (isTableFocused) {
      if (filteredDrafts.length > 0 && selectedIdx < filteredDrafts.length) {
        e.preventDefault();
        handleOpenDetail(filteredDrafts[selectedIdx]);
      }
    }
  }, { enableOnFormTags: true }, [deleteCheckState, filteredDrafts, selectedIdx, selectedDraftDetail, showCompleteConfirmModal]);

  // P Key handling
  useHotkeys('p', (e) => {
    if (selectedDraftDetail && !showCompleteConfirmModal) {
      e.preventDefault();
      setShowCompleteConfirmModal(true);
    }
  }, { enableOnFormTags: true }, [selectedDraftDetail, showCompleteConfirmModal]);

  // F10 Key handling
  useHotkeys('f10', (e) => {
    if (selectedDraftDetail && !showCompleteConfirmModal) {
      e.preventDefault();
      setShowCompleteConfirmModal(true);
    }
  }, { enableOnFormTags: true }, [selectedDraftDetail, showCompleteConfirmModal]);

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

  // Delete draft PO
  useHotkeys('del', (e) => {
    if (selectedDraftDetail || showCompleteConfirmModal) return;
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    e.preventDefault();
    if (filteredDrafts.length > 0 && selectedIdx < filteredDrafts.length) {
      handleDelete(filteredDrafts[selectedIdx].id, filteredDrafts[selectedIdx].no_order);
    }
  }, { enableOnFormTags: true }, [selectedDraftDetail, showCompleteConfirmModal, filteredDrafts, selectedIdx]);

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
                      );
                    })}
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
        </>
      ) : (
        /* PO Draft Detail View (In-place) */
        <div className="space-y-4 animate-fade-in text-slate-800">
          {/* Detail Page Title (Teks saja) */}
          <div className="pb-1">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <span>Detail Draft Order PO: {selectedDraftDetail.no_order}</span>
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
                  {/* Card 1: Informasi PO */}
                  <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="bg-blue-50 border-b border-blue-100 px-3.5 py-2">
                      <h3 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Informasi PO</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-3.5 text-xs text-slate-655">
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">No. PO</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{selectedDraftDetail.no_order}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal Order</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{formatDate(selectedDraftDetail.order_date)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Termin</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block uppercase">{selectedDraftDetail.terms || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Status Cetak</span>
                        <span className="text-xs font-bold mt-0.5 block text-amber-600">Belum Cetak (Draft)</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Pemasok (Supplier) */}
                  <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                    <div className="bg-amber-50 border-b border-amber-100 px-3.5 py-2">
                      <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pemasok (Supplier)</h3>
                    </div>
                    <div className="space-y-3.5 p-3.5 text-xs text-slate-655">
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Nama Supplier</span>
                        <span className="text-xs font-extrabold text-slate-855 mt-0.5 block">{selectedDraftDetail.supplier?.nama}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Alamat Pemasok</span>
                        <span className="text-xs font-semibold text-slate-700 mt-0.5 block leading-normal">
                          {selectedDraftDetail.supplier?.alamat || 'Alamat tidak dicantumkan'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Kode Supplier</span>
                        <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{selectedDraftDetail.supplier?.kode || '-'}</span>
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
                          <th className="p-3 text-right w-36">Harga Beli</th>
                          <th className="p-3 text-right w-40">Total Harga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedDraftDetail.purchase_items?.map((item: any, idx: number) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-855">
                            <td className="p-3 text-center font-semibold text-slate-550">{idx + 1}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                                {item.product?.kode || '-'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-800">{item.product?.nama || '-'}</td>
                            <td className="p-3 text-center font-bold text-slate-700">{Number(item.qty)}</td>
                            <td className="p-3 text-right font-semibold text-slate-600">{formatCurrency(Number(item.harga_beli))}</td>
                            <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(Number(item.subtotal))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-end gap-2 text-xs">
                      <div className="flex gap-6 items-center">
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Grand Total Draft</span>
                        <span className="text-base font-extrabold text-emerald-600 font-mono">
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
                  onClick={() => navigate(`/pembelian/edit-order?no_order=${selectedDraftDetail.no_order}`)}
                  className="px-5 py-2.5 rounded-lg border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 focus:outline-none"
                >
                  <span>Edit Draft</span>
                  <kbd className="text-[10px] text-blue-500 font-bold font-mono uppercase bg-blue-50 border border-blue-200 px-1 py-0.5 rounded ml-1">Enter</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCompleteConfirmModal(true)}
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/10 flex items-center gap-2 focus:outline-none"
                >
                  <span>Selesaikan Draft</span>
                  <kbd className="text-[10px] text-emerald-200 font-bold font-mono uppercase bg-emerald-700 px-1.5 py-0.5 rounded ml-1">P / F10</kbd>
                </button>
              </div>
            </>
          )}
        </div>
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

      {/* Delete Confirmation Modal */}
      {deleteCheckState.status === 'can_delete' && deleteCheckState.targetItem && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={() => setDeleteCheckState({ status: 'idle', targetItem: null })}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden text-slate-800 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              {/* Amber Header */}
              <div className="flex flex-col items-center justify-center gap-2 bg-amber-500 border-b border-amber-600 px-5 py-4 text-center w-full">
                <div className="p-2 bg-white/20 rounded-full">
                  <AlertTriangle size={20} className="text-white" />
                </div>
                <div className="flex flex-col items-center text-center">
                  <h2 className="font-extrabold text-sm text-white uppercase tracking-wider">Konfirmasi Hapus Draft PO</h2>
                  <p className="text-xs text-amber-50 mt-1 font-semibold text-white">Tindakan ini tidak memengaruhi stok barang karena status PO masih Draft</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5 bg-white text-xs">
                <p className="text-slate-700 font-semibold leading-relaxed">
                  Apakah Anda yakin ingin menghapus draft PO <span className="font-extrabold text-slate-900">"{deleteCheckState.targetItem.no_order}"</span>?
                </p>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5 text-xs text-slate-650">
                  <div><span className="font-bold">Tanggal PO:</span> {formatDate(deleteCheckState.targetItem.order_date)}</div>
                  <div><span className="font-bold">Supplier:</span> {deleteCheckState.targetItem.supplier.nama}</div>
                  <div><span className="font-bold">Total Nilai PO:</span> {formatCurrency(deleteCheckState.targetItem.subtotal)}</div>
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
                  onClick={confirmDeletePurchase}
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
