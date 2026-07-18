import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Calendar, FileText, X, AlertTriangle, Info } from 'lucide-react';

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  supplier: {
    id: string;
    kode: string;
    nama: string;
  };
  terms: string;
  subtotal: number;
  status: string;
  received_at: string | null;
}

export const HistoryPembelian: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromHistory = searchParams.get('from') === 'history';

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Active PO Detail
  const [activePo, setActivePo] = useState<any | null>(null);
  const [isInfoHidden, setIsInfoHidden] = useState(false);

  // Real-time Clock State
  const [realtimeTime, setRealtimeTime] = useState('');

  // Filters Screen
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const defaultFromDate = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const defaultToDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const [showFilterPage, setShowFilterPage] = useState(true);
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [noOrderFilter, setNoOrderFilter] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [deleteCheckState, setDeleteCheckState] = useState<{
    status: 'idle' | 'checking' | 'cannot_delete' | 'can_delete';
    amountPaid: number;
    targetItem: Purchase | null;
  }>({ status: 'idle', amountPaid: 0, targetItem: null });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const noOrderFilterRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  useEffect(() => {
    const target = rowRefs.current[selectedIdx];
    if (target) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx]);

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

  useEffect(() => {
    if (showFilterPage) {
      setTimeout(() => {
        fromDateRef.current?.focus();
        fromDateRef.current?.select();
      }, 150);
    }
  }, [showFilterPage]);

  const filteredPurchases = purchases.filter((p) =>
    p.supplier?.nama?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPurchases.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        searchInputRef.current?.blur();
      }
    }
  };

  const handleOpenDetail = async (po: Purchase) => {
    try {
      const res = await api.get(`/purchases/${po.id}`);
      setActivePo(res.data);
      setIsInfoHidden(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFilterSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      let url = `/purchases?status=received&limit=1000`;
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;

      const res = await api.get(url);
      let list = res.data.data || [];

      if (noOrderFilter.trim()) {
        const query = noOrderFilter.trim().toLowerCase();
        list = list.filter((p: Purchase) =>
          p.no_order && p.no_order.toLowerCase().includes(query)
        );
      }

      setPurchases(list);
      setSelectedIdx(0);
      setShowFilterPage(false);
      setIsTableFocused(false);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 150);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeletePurchase = async () => {
    const target = deleteCheckState.targetItem;
    if (!target) return;
    try {
      setIsLoading(true);
      await api.delete(`/purchases/${target.id}`);
      showToast('Transaksi PO berhasil dihapus dan stok dikembalikan', 'success');

      // Refresh list
      let url = `/purchases?status=received&limit=1000`;
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;
      const res = await api.get(url);
      setPurchases(res.data.data || []);
      setSelectedIdx(0);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Gagal menghapus transaksi PO', 'error');
    } finally {
      setIsLoading(false);
      setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null });
    }
  };

  const triggerDelete = async () => {
    const target = filteredPurchases[selectedIdx];
    if (!target) return;

    setDeleteCheckState({ status: 'checking', amountPaid: 0, targetItem: target });
    try {
      const res = await api.get(`/purchases/${target.id}`);
      const poDetail = res.data;
      const payments = poDetail.supplier_payments || [];
      const allocations = poDetail.billing_allocations || [];
      const returns = poDetail.purchase_returns || [];

      const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) +
        allocations.reduce((sum: number, a: any) => sum + Number(a.allocated_amount), 0);
      const totalReturned = returns.reduce((sum: number, r: any) => sum + Number(r.total), 0);

      if (totalPaid > 0 || totalReturned > 0) {
        setDeleteCheckState({
          status: 'cannot_delete',
          amountPaid: totalPaid,
          targetItem: target
        });
      } else {
        setDeleteCheckState({
          status: 'can_delete',
          amountPaid: 0,
          targetItem: target
        });
      }
    } catch (err) {
      console.error(err);
      setDeleteCheckState({ status: 'cannot_delete', amountPaid: 0, targetItem: target });
    }
  };

  // Keyboard Shortcuts
  // Enter: View PO detail or confirm delete
  useHotkeys('enter', (e) => {
    if (deleteCheckState.status === 'can_delete') {
      e.preventDefault();
      confirmDeletePurchase();
    } else if (deleteCheckState.status === 'cannot_delete') {
      e.preventDefault();
      setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null });
    } else if (isTableFocused && !activePo && deleteCheckState.status === 'idle' && filteredPurchases[selectedIdx]) {
      e.preventDefault();
      handleOpenDetail(filteredPurchases[selectedIdx]);
    }
  }, { enableOnFormTags: true }, [deleteCheckState, isTableFocused, activePo, filteredPurchases, selectedIdx]);

  // Delete key: Trigger delete modal
  useHotkeys('del, delete', (e) => {
    if (isTableFocused && !activePo && deleteCheckState.status === 'idle' && filteredPurchases[selectedIdx]) {
      e.preventDefault();
      triggerDelete();
    }
  }, { enableOnFormTags: false }, [isTableFocused, activePo, deleteCheckState, filteredPurchases, selectedIdx]);

  // F1: Focus search input or toggle detail info visibility
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (activePo) {
      setIsInfoHidden((prev) => !prev);
    } else {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true }, [activePo]);

  // F2: Open Filter Popup
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (!activePo) setShowFilterPage(true);
  }, { enableOnFormTags: true }, [activePo]);

  // Arrow up/down navigation
  useHotkeys('up', (e) => {
    if (isTableFocused && !activePo && deleteCheckState.status === 'idle') {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(0, p - 1));
    }
  }, { enableOnFormTags: false }, [isTableFocused, activePo, deleteCheckState]);

  useHotkeys('down', (e) => {
    if (isTableFocused && !activePo && deleteCheckState.status === 'idle') {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(filteredPurchases.length - 1, p + 1));
    }
  }, { enableOnFormTags: false }, [isTableFocused, activePo, deleteCheckState, filteredPurchases]);

  // Escape to close detail or go back
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (deleteCheckState.status !== 'idle') {
      setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null });
    } else if (activePo) {
      setActivePo(null);
      setIsInfoHidden(false);
    } else if (showFilterPage) {
      navigate(fromHistory ? '/history' : '/pembelian');
    } else if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else {
      setShowFilterPage(true);
    }
  }, { enableOnFormTags: true }, [deleteCheckState, activePo, showFilterPage, isTableFocused, fromHistory]);

  // Y key to navigate to payment history (for supplier pelunasan)
  useHotkeys('y', (e) => {
    if (deleteCheckState.status === 'cannot_delete' && deleteCheckState.targetItem) {
      e.preventDefault();
      const noOrder = deleteCheckState.targetItem.no_order;
      setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null });
      navigate(`/penagihan/history-pelunasan?search=${noOrder}`);
    }
  }, { enableOnFormTags: true }, [deleteCheckState]);

  if (showFilterPage) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Histori Pembelian</h1>
            <p className="text-slate-400">Arsip lengkap transaksi pemesanan barang yang sudah diterima</p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-primary-600 text-white px-6 py-4 text-center border-b border-primary-700/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Filter Pencarian PO</h3>
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
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), noOrderFilterRef.current?.focus())}
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Nomor PO</label>
                <input
                  ref={noOrderFilterRef}
                  type="text"
                  placeholder="Semua / Ketik No PO"
                  value={noOrderFilter}
                  onChange={(e) => setNoOrderFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFilterSubmit(e))}
                  className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/pembelian')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-655 text-xs font-bold hover:bg-slate-50 transition-all"
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Histori Pembelian</h1>
          <p className="text-slate-400">Arsip lengkap transaksi pemesanan barang yang sudah diterima</p>
        </div>
      </div>

      {!activePo ? (
        /* PO List */
        <div className="space-y-4">
          {/* Inline Search Bar & Filter Button */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari nama supplier (F1)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsTableFocused(false);
                }}
                onKeyDown={handleSearchKeyDown}
                className="input-field pl-9 w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
              <div className="bg-surface-800 border border-surface-700 px-4 py-2.5 rounded-lg text-slate-350 font-mono text-xs flex items-center justify-center shadow-sm min-w-[200px]">
                {realtimeTime}
              </div>

              <div className="px-3 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 font-semibold flex items-center gap-2 bg-white shadow-sm font-mono">
                <Calendar size={14} className="text-primary-600" />
                <span>{formatDate(fromDate)} - {formatDate(toDate)}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowFilterPage(true)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                Filter Tanggal & No PO (F2)
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 skeleton" />
              ))}
            </div>
          ) : filteredPurchases.length > 0 ? (
            <div className="card p-0 overflow-hidden border border-surface-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">Nomor PO</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Tanggal Order</th>
                      <th className="p-4">Tanggal Terima</th>
                      <th className="p-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((p, idx) => {
                      const isFocused = idx === selectedIdx && isTableFocused;
                      const rowBgClass = isFocused ? 'bg-blue-100' : 'hover:bg-slate-50';

                      const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                        let base = "p-4 text-xs transition-all duration-150 border-b ";
                        if (isFocused) {
                          base += "bg-blue-100 text-primary-950 font-bold border-blue-300 ";
                          if (pos === 'first') base += "border-l-4 border-primary-600 ";
                        } else {
                          base += "text-slate-800 border-slate-200 ";
                        }
                        return base;
                      };

                      return (
                        <tr
                          key={p.id}
                          ref={(el) => {
                            rowRefs.current[idx] = el;
                          }}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setIsTableFocused(true);
                          }}
                          onDoubleClick={() => handleOpenDetail(p)}
                          className={`cursor-pointer ${rowBgClass}`}
                        >
                          <td className={getTdClass('first')}>
                            <span className="px-2 py-0.5 rounded bg-blue-50/80 text-primary-700 border border-blue-100 font-mono font-bold text-xs inline-block">
                              {p.no_order}
                            </span>
                          </td>
                          <td className={getTdClass('middle') + " font-semibold"}>
                            {p.supplier?.nama || '-'}
                          </td>
                          <td className={getTdClass('middle')}>
                            {formatDate(p.order_date)}
                          </td>
                          <td className={getTdClass('middle')}>
                            {p.received_at ? formatDate(p.received_at) : '-'}
                          </td>
                          <td className={getTdClass('last') + " text-right font-black text-slate-900"}>
                            {formatCurrency(Number(p.subtotal))}
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
              <Calendar className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-400">Tidak ada data PO ditemukan</h3>
              <p className="text-sm mt-1">Gunakan filter F2 untuk mencari berdasarkan tanggal dan supplier lain.</p>
            </div>
          )}
        </div>
      ) : (
        /* PO Detail View (3 Cards Layout) */
        <div className="space-y-4 animate-fade-in text-slate-800">
          {/* Detail Page Title (Teks saja) */}
          <div className="pb-1">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <span>Detail PO: {activePo.no_order}</span>
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">Status: <span className="font-bold text-emerald-600 uppercase">{activePo.status}</span></p>
          </div>

          {/* 3 Separate Cards Layout */}
          {!isInfoHidden && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Informasi PO */}
              <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="bg-blue-50 border-b border-blue-100 px-3.5 py-2">
                  <h3 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Informasi PO</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3.5 text-xs text-slate-650">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">No. PO</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activePo.no_order}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal Order</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{formatDate(activePo.order_date)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal Terima</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activePo.received_at ? formatDate(activePo.received_at) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Termin</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block uppercase">{activePo.terms}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Pemasok (Supplier) */}
              <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="bg-amber-50 border-b border-amber-100 px-3.5 py-2">
                  <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pemasok (Supplier)</h3>
                </div>
                <div className="space-y-3.5 p-3.5 text-xs text-slate-650">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Nama Supplier</span>
                    <span className="text-xs font-extrabold text-slate-855 mt-0.5 block">{activePo.supplier?.nama}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Alamat Pemasok</span>
                    <span className="text-xs font-semibold text-slate-700 mt-0.5 block leading-normal">
                      {activePo.supplier?.alamat || 'Alamat tidak dicantumkan'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Kode Supplier</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activePo.supplier?.kode || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Daftar Barang */}
          <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
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
                      <th className="p-3 text-right w-40">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activePo.purchase_items.map((item: any, idx: number) => {
                      const returnedQty = activePo.purchase_returns?.reduce((sum: number, ret: any) => {
                        const retItem = ret.items?.find((it: any) => it.product_id === item.product_id);
                        return sum + (retItem ? Number(retItem.qty) : 0);
                      }, 0) || 0;
                      const isReturned = returnedQty > 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-855">
                          <td className="p-3 text-center font-semibold text-slate-550">{idx + 1}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                              {item.product?.kode || '-'}
                            </span>
                          </td>
                          <td className={`p-3 font-bold ${isReturned ? 'text-rose-700 font-extrabold' : 'text-slate-800'}`}>{item.product?.nama || '-'}</td>
                          <td className={`p-3 text-center font-bold ${isReturned ? 'text-rose-700' : 'text-slate-700'}`}>
                            {Number(item.qty)}
                            {isReturned && (
                              <span className="text-[10px] block text-red-500 font-bold mt-0.5">
                                (Retur: {returnedQty})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-600">{formatCurrency(Number(item.harga_beli))}</td>
                          <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(Number(item.qty) * Number(item.harga_beli))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-end gap-2 text-xs">
                  <div className="flex gap-6 items-center">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Grand Total PO</span>
                    <span className="text-base font-extrabold text-emerald-600 font-mono">
                      {formatCurrency(Number(activePo.subtotal))}
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
                setActivePo(null);
                setIsInfoHidden(false);
              }}
              className="px-5 py-2.5 rounded-lg border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 focus:outline-none"
            >
              <span>Tutup</span>
              <kbd className="text-[10px] text-blue-500 font-bold font-mono uppercase bg-blue-50 border border-blue-200 px-1 py-0.5 rounded ml-1">Esc</kbd>
            </button>
          </div>
        </div>
      )}

      {deleteCheckState.status === 'checking' && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-white border border-slate-200 rounded-xl p-6 max-w-xs w-full shadow-2xl animate-scale-in text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Memeriksa status pembayaran PO...</p>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteCheckState.status === 'cannot_delete' && deleteCheckState.targetItem && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={() => setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null })}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden text-slate-800 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              {/* Danger/Blocked Header */}
              <div className="flex flex-col items-center justify-center gap-2 bg-red-600 border-b border-red-700 px-5 py-4 text-center w-full">
                <div className="p-2 bg-white/20 rounded-full">
                  <X size={20} className="text-white" />
                </div>
                <div className="flex flex-col items-center text-center">
                  <h2 className="font-extrabold text-sm text-white uppercase tracking-wider">Transaksi Tidak Dapat Dihapus</h2>
                  <p className="text-xs text-red-100 mt-1 font-semibold">Sudah memiliki riwayat pembayaran atau retur</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5 bg-white text-xs">
                <p className="text-slate-700 font-semibold leading-relaxed">
                  Data transaksi pembelian <span className="font-extrabold text-slate-900">"{deleteCheckState.targetItem.no_order}"</span> tidak dapat dihapus karena sudah memiliki pelunasan/pembayaran sebagian sebesar <span className="text-red-650 font-extrabold">{formatCurrency(deleteCheckState.amountPaid)}</span> atau sudah memiliki dokumen retur.
                </p>
                <p className="text-slate-500 mt-2">
                  Harap batalkan/hapus pembayaran terkait di menu penagihan/pelunasan terlebih dahulu sebelum menghapus transaksi ini.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100 justify-end">
                <button
                  onClick={() => setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null })}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all bg-white"
                >
                  Tutup (Esc)
                </button>
                <button
                  onClick={() => {
                    const noOrder = deleteCheckState.targetItem?.no_order;
                    setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null });
                    navigate(`/penagihan/history-pelunasan?search=${noOrder}`);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-yellow-300 transition-all shadow-md shadow-red-500/20"
                >
                  Lihat Pembayaran (Y)
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteCheckState.status === 'can_delete' && deleteCheckState.targetItem && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={() => setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null })}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden text-slate-800 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              {/* Amber Header */}
              <div className="flex flex-col items-center justify-center gap-2 bg-amber-500 border-b border-amber-600 px-5 py-4 text-center w-full">
                <div className="p-2 bg-white/20 rounded-full">
                  <AlertTriangle size={20} className="text-white" />
                </div>
                <div className="flex flex-col items-center text-center">
                  <h2 className="font-extrabold text-sm text-white uppercase tracking-wider">Konfirmasi Hapus Transaksi PO</h2>
                  <p className="text-xs text-amber-50 mt-1 font-semibold">Tindakan ini akan mengurangi stok barang di gudang</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5 bg-white text-xs">
                <p className="text-slate-700 font-semibold leading-relaxed">
                  Apakah Anda yakin ingin membatalkan dan menghapus transaksi Purchase Order <span className="font-extrabold text-slate-900">"{deleteCheckState.targetItem.no_order}"</span>? (Stok produk di gudang akan dikurangi)
                </p>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5 text-xs text-slate-655">
                  <div><span className="font-bold">Tanggal PO:</span> {formatDate(deleteCheckState.targetItem.order_date)}</div>
                  <div><span className="font-bold">Supplier:</span> {deleteCheckState.targetItem.supplier?.nama}</div>
                  <div><span className="font-bold">Total Nilai PO:</span> {formatCurrency(deleteCheckState.targetItem.subtotal)}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 px-5 py-4 bg-slate-50 border-t border-slate-100 justify-end">
                <button
                  onClick={() => setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null })}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-250 text-slate-600 hover:bg-slate-100 transition-all bg-white"
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

      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
          <div className={`px-4 py-3 rounded-lg shadow-lg text-white font-bold text-xs flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-danger-600'
            }`}>
            <span className="!text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
