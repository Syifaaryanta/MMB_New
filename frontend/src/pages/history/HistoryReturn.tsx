import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Search,
  ChevronRight,
  X,
  Undo2,
  ArrowRightLeft,
  AlertTriangle
} from 'lucide-react';

interface ReturnItem {
  id: string;
  retur_id: string;
  product_id: string;
  product_kode: string;
  product_nama: string;
  qty: number;
  unit_price: number;
  total: number;
  kondisi: string;
  product?: {
    satuan: string;
  };
}

interface UnifiedReturn {
  id: string;
  type: 'purchase' | 'sale'; // tagged during merge
  no_retur: string;
  original_id: string; // purchase_id or sale_id
  no_order: string;
  no_faktur?: string | null;
  party_id: string; // supplier_id or customer_id
  party_nama: string; // supplier_nama or customer_nama
  retur_date: string;
  total: number;
  metode_kompensasi: string;
  catatan: string | null;
  created_at: string;
  items: ReturnItem[];
}

export const HistoryReturn: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();

  const [returns, setReturns] = useState<UnifiedReturn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTableFocused, setIsTableFocused] = useState(false);

  // Active Detail Modal State
  const [activeReturn, setActiveReturn] = useState<UnifiedReturn | null>(null);
  const [isInfoHidden, setIsInfoHidden] = useState(false);

  // Filters State
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const defaultFromDate = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const defaultToDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'sale'>('all');

  const [showFilterPage, setShowFilterPage] = useState(true);

  // Delete Check State
  const [deleteCheckState, setDeleteCheckState] = useState<{
    status: 'idle' | 'can_delete';
    targetItem: UnifiedReturn | null;
  }>({
    status: 'idle',
    targetItem: null,
  });

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const popupSearchRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listTableRef = useRef<HTMLTableElement>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  // Load Data from API
  const fetchReturns = async () => {
    setIsLoading(true);
    try {
      // Build query string
      let queryParams = `?limit=1000`;
      if (fromDate) queryParams += `&from=${fromDate}`;
      if (toDate) queryParams += `&to=${toDate}`;

      // Fetch both PO and SO returns concurrently
      const [purchaseRes, saleRes] = await Promise.all([
        api.get(`/purchase-returns${queryParams}`).catch(() => ({ data: { data: [] } })),
        api.get(`/sale-returns${queryParams}`).catch(() => ({ data: { data: [] } }))
      ]);

      const purchaseReturnsRaw = purchaseRes.data.data || [];
      const saleReturnsRaw = saleRes.data.data || [];

      // Map & Tag
      const purchaseReturns = purchaseReturnsRaw.map((item: any) => ({
        ...item,
        type: 'purchase',
        party_id: item.supplier_id,
        party_nama: item.supplier_nama,
        total: Number(item.total)
      }));

      const saleReturns = saleReturnsRaw.map((item: any) => ({
        ...item,
        type: 'sale',
        party_id: item.customer_id,
        party_nama: item.customer_nama,
        total: Number(item.total)
      }));

      // Merge and sort by date descending, then created_at descending
      const merged = [...purchaseReturns, ...saleReturns].sort((a, b) => {
        const dateA = new Date(a.retur_date).getTime();
        const dateB = new Date(b.retur_date).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setReturns(merged);
      setSelectedIdx(0);
      setIsTableFocused(false);
    } catch (err) {
      console.error('Error fetching returns history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!showFilterPage) {
      fetchReturns();
    }
  }, [fromDate, toDate, showFilterPage]);

  // Focus popup fromDate on mount/show
  useEffect(() => {
    if (showFilterPage) {
      setTimeout(() => {
        fromDateRef.current?.focus();
        fromDateRef.current?.select();
      }, 150);
    }
  }, [showFilterPage]);

  // Focus search input when filter page is closed
  useEffect(() => {
    if (!showFilterPage) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 150);
    }
  }, [showFilterPage]);

  // Scroll focused row into view
  useEffect(() => {
    const target = rowRefs.current[selectedIdx];
    if (target && isTableFocused) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx, isTableFocused]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmDeleteReturn = async () => {
    const target = deleteCheckState.targetItem;
    if (!target) return;
    try {
      setIsLoading(true);
      const url = target.type === 'purchase' ? `/purchase-returns/${target.id}` : `/sale-returns/${target.id}`;
      await api.delete(url);
      showToast(
        lang === 'en'
          ? 'Return transaction deleted successfully and stock adjusted'
          : 'Transaksi retur berhasil dihapus dan stok disesuaikan',
        'success'
      );
      await fetchReturns();
    } catch (err: any) {
      console.error(err);
      showToast(
        err.response?.data?.error ||
          (lang === 'en' ? 'Failed to delete return transaction' : 'Gagal menghapus transaksi retur'),
        'error'
      );
    } finally {
      setIsLoading(false);
      setDeleteCheckState({ status: 'idle', targetItem: null });
    }
  };

  const handleFilterSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    await fetchReturns();
    setShowFilterPage(false);
  };

  // Client-side Filter for Real-time Search
  const filteredReturns = returns.filter((item) => {
    // 1. Type filter
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;

    // 2. Search query filter (no_retur, no_order, party_nama, product_nama)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchHeader =
        item.no_retur.toLowerCase().includes(q) ||
        item.no_order.toLowerCase().includes(q) ||
        (item.no_faktur && item.no_faktur.toLowerCase().includes(q)) ||
        item.party_nama.toLowerCase().includes(q);

      const matchItems = item.items?.some(
        (it) =>
          it.product_nama.toLowerCase().includes(q) ||
          it.product_kode.toLowerCase().includes(q)
      );

      return matchHeader || matchItems;
    }

    return true;
  });

  // Keyboard Navigation & Actions
  useHotkeys('down', (e) => {
    if (isTableFocused && !activeReturn && deleteCheckState.status === 'idle' && filteredReturns.length > 0) {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, filteredReturns.length - 1));
    }
  }, { enableOnFormTags: false }, [isTableFocused, activeReturn, filteredReturns, deleteCheckState]);

  useHotkeys('up', (e) => {
    if (isTableFocused && !activeReturn && deleteCheckState.status === 'idle' && filteredReturns.length > 0) {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    }
  }, { enableOnFormTags: false }, [isTableFocused, activeReturn, filteredReturns, deleteCheckState]);

  useHotkeys('enter', (e) => {
    if (document.activeElement === searchInputRef.current) {
      return;
    }
    if (deleteCheckState.status === 'can_delete') {
      e.preventDefault();
      confirmDeleteReturn();
    } else if (isTableFocused && !activeReturn && filteredReturns[selectedIdx]) {
      e.preventDefault();
      handleOpenDetail(filteredReturns[selectedIdx]);
    }
  }, { enableOnFormTags: true }, [isTableFocused, activeReturn, filteredReturns, selectedIdx, deleteCheckState]);

  useHotkeys('del, delete', (e) => {
    if (isTableFocused && !activeReturn && deleteCheckState.status === 'idle' && filteredReturns[selectedIdx]) {
      e.preventDefault();
      setDeleteCheckState({
        status: 'can_delete',
        targetItem: filteredReturns[selectedIdx],
      });
    }
  }, { enableOnFormTags: false }, [isTableFocused, activeReturn, deleteCheckState, filteredReturns, selectedIdx]);

  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (deleteCheckState.status === 'can_delete') {
      setDeleteCheckState({ status: 'idle', targetItem: null });
    } else if (activeReturn) {
      setActiveReturn(null);
      setIsInfoHidden(false);
    } else if (!showFilterPage) {
      setShowFilterPage(true);
    } else {
      navigate('/history');
    }
  }, { enableOnFormTags: true }, [isTableFocused, activeReturn, showFilterPage, deleteCheckState]);

  // Shortcut to focus search or toggle info (F1)
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (activeReturn) {
      setIsInfoHidden((prev) => !prev);
    } else {
      if (showFilterPage) {
        fromDateRef.current?.focus();
        fromDateRef.current?.select();
      } else {
        setIsTableFocused(false);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
  }, { enableOnFormTags: true }, [activeReturn, showFilterPage]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredReturns.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        searchInputRef.current?.blur();
      }
    }
  };

  const handleOpenDetail = (ret: UnifiedReturn) => {
    setActiveReturn(ret);
    setIsInfoHidden(false);
  };

  const getMetodeLabel = (m: string, type: 'purchase' | 'sale') => {
    if (m === 'potong_hutang') return lang === 'en' ? 'Deduct Payable' : 'Potong Hutang';
    if (m === 'potong_piutang') return lang === 'en' ? 'Deduct Receivable' : 'Potong Piutang';
    if (m === 'tukar_barang') return lang === 'en' ? 'Exchange Goods' : 'Tukar Barang';
    if (m === 'refund_tunai') return lang === 'en' ? 'Cash Refund' : 'Refund Tunai';
    return m;
  };

  if (showFilterPage) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <span>{lang === 'en' ? 'Transaction History' : 'Histori Transaksi'}</span>
              <ChevronRight size={14} />
              <span className="text-slate-900 font-medium">{lang === 'en' ? 'Return History' : 'Histori Return'}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-950 mt-1">
              {lang === 'en' ? 'Return History (PO & SO Return)' : 'Histori Return (PO & SO Return)'}
            </h1>
            <p className="text-slate-550 text-xs mt-1">
              {lang === 'en'
                ? 'Displays combined records of purchase returns (Supplier) and sales returns (Customer).'
                : 'Menampilkan gabungan catatan retur pembelian (Supplier) dan retur penjualan (Customer).'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[45vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-rose-600 text-white px-6 py-4 text-center border-b border-rose-700">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {lang === 'en' ? 'Filter Return History' : 'Filter Histori Return'}
              </h3>
            </div>

            <form onSubmit={handleFilterSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">
                    {lang === 'en' ? 'Start Date' : 'Tanggal Awal'}
                  </label>
                  <input
                    ref={fromDateRef}
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toDateRef.current?.focus())}
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">
                    {lang === 'en' ? 'End Date' : 'Tanggal Akhir'}
                  </label>
                  <input
                    ref={toDateRef}
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), popupSearchRef.current?.focus())}
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">
                  {lang === 'en' ? 'Search (Product Name / SKU)' : 'Cari (Nama / Kode Barang)'}
                </label>
                <input
                  ref={popupSearchRef}
                  type="text"
                  placeholder={lang === 'en' ? 'Type Name, SKU, Supplier, Customer, Return No...' : 'Ketik Nama, Kode, Supplier, Customer, No Retur...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFilterSubmit(e))}
                  className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-lg bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all bg-white"
                >
                  {lang === 'en' ? 'Back' : 'Kembali'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all shadow-md shadow-rose-500/10"
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span>{lang === 'en' ? 'Transaction History' : 'Histori Transaksi'}</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">{lang === 'en' ? 'Return History' : 'Histori Return'}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-950 mt-1">
            {lang === 'en' ? 'Return History (PO & SO Return)' : 'Histori Return (PO & SO Return)'}
          </h1>
          <p className="text-slate-550 text-xs mt-1">
            {lang === 'en'
              ? 'Displays combined records of purchase returns (Supplier) and sales returns (Customer).'
              : 'Menampilkan gabungan catatan retur pembelian (Supplier) dan retur penjualan (Customer).'}
          </p>
        </div>
      </div>

      {/* Main Container */}
      {!activeReturn ? (
        /* Toolbar and Main List Table */
        <div className="space-y-6">
          {/* Toolbar / Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search bar */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={lang === 'en' ? 'Search return no, origin PO/SO, supplier/customer name, product name...' : 'Cari no retur, PO/SO asal, nama supplier/customer, nama barang...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="input-field pl-9 w-full py-2 text-xs border border-slate-350 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  autoFocus
                />
              </div>

              {/* Date range filters */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input-field py-1.5 px-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white w-full"
                />
                <span className="text-slate-400 text-xs font-semibold">{lang === 'en' ? 'to' : 's/d'}</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input-field py-1.5 px-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white w-full"
                />
              </div>
            </div>

            {/* Keyboard hints info panel */}
            <div className="pt-2">
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                <span>{lang === 'en' ? 'Quick Search:' : 'Pencarian Cepat:'}</span>
                <span><kbd className="shortcut-badge text-[10px]">F1</kbd> {lang === 'en' ? 'Focus Search' : 'Fokus Cari'}</span>
                <span><kbd className="shortcut-badge text-[10px]">Esc</kbd> {lang === 'en' ? 'Back to History Menu' : 'Kembali ke Menu Histori'}</span>
                <span><kbd className="shortcut-badge text-[10px]">↑ ↓</kbd> {lang === 'en' ? 'Select Row' : 'Pilih Baris'}</span>
                <span><kbd className="shortcut-badge text-[10px]">Enter</kbd> {lang === 'en' ? 'Detail' : 'Detail'}</span>
              </div>
            </div>
          </div>

          {/* Main Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 skeleton rounded-xl bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : filteredReturns.length > 0 ? (
            <div className="card p-0 overflow-hidden border border-slate-250 shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table ref={listTableRef} className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-4 w-12 text-center">No</th>
                      <th className="p-4 w-32">{lang === 'en' ? 'Return Type' : 'Jenis Retur'}</th>
                      <th className="p-4">{lang === 'en' ? 'Return No' : 'No Retur'}</th>
                      <th className="p-4">{lang === 'en' ? 'Date' : 'Tanggal'}</th>
                      <th className="p-4">{lang === 'en' ? 'Origin PO/SO No' : 'No PO/SO Asal'}</th>
                      <th className="p-4">Supplier/Customer</th>
                      <th className="p-4">{lang === 'en' ? 'Compensation' : 'Kompensasi'}</th>
                      <th className="p-4 text-right">{lang === 'en' ? 'Total Value' : 'Total Nilai'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReturns.map((ret, idx) => {
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
                          key={ret.id}
                          ref={(el) => {
                            rowRefs.current[idx] = el;
                          }}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setIsTableFocused(true);
                          }}
                          onDoubleClick={() => handleOpenDetail(ret)}
                          className={`cursor-pointer ${rowBgClass}`}
                        >
                          <td className={getTdClass('first') + " text-center font-mono text-slate-400"}>{idx + 1}</td>
                          <td className={getTdClass('middle')}>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${ret.type === 'purchase'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}>
                              {ret.type === 'purchase'
                                ? (lang === 'en' ? 'Purchase PO' : 'Pembelian PO')
                                : (lang === 'en' ? 'Sales SO' : 'Penjualan SO')}
                            </span>
                          </td>
                          <td className={getTdClass('middle') + " font-mono font-bold text-slate-800"}>{ret.no_retur}</td>
                          <td className={getTdClass('middle') + " text-slate-600"}>{formatDate(ret.retur_date)}</td>
                          <td className={getTdClass('middle') + " font-mono text-slate-700"}>{ret.no_order}</td>
                          <td className={getTdClass('middle') + " text-slate-900 font-semibold"}>{ret.party_nama}</td>
                          <td className={getTdClass('middle')}>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${ret.metode_kompensasi.includes('hutang') || ret.metode_kompensasi.includes('piutang')
                              ? 'bg-amber-100 text-amber-800'
                              : ret.metode_kompensasi === 'tukar_barang'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                              }`}>
                              {getMetodeLabel(ret.metode_kompensasi, ret.type)}
                            </span>
                          </td>
                          <td className={getTdClass('last') + " text-right font-bold text-slate-900"}>{formatCurrency(ret.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center border border-slate-200 bg-white">
              <Undo2 size={48} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-bold text-slate-700">
                {lang === 'en' ? 'No Return Data' : 'Tidak Ada Data Retur'}
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                {lang === 'en'
                  ? 'No return transactions found within the current date range and filters.'
                  : 'Tidak ditemukan transaksi retur dalam rentang tanggal dan kriteria filter saat ini.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Detail View (3 Cards Layout) */
        <div className="space-y-4 animate-fade-in text-slate-800">
          {/* Detail Page Title (Teks saja) */}
          <div className="pb-1">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-blue-600" />
              <span>
                {lang === 'en' ? 'Return Detail' : 'Detail Retur'}{' '}
                {activeReturn.type === 'purchase'
                  ? (lang === 'en' ? 'Purchase PO' : 'Pembelian PO')
                  : (lang === 'en' ? 'Sales SO' : 'Penjualan SO')}
                : {activeReturn.no_retur}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Status:{' '}
              <span className="font-bold text-blue-650 uppercase">
                {lang === 'en' ? 'RETURN PROCESS' : 'PROSES RETUR'}
              </span>
            </p>
          </div>

          {!isInfoHidden && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Informasi Retur */}
              <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="bg-blue-50 border-b border-blue-100 px-3.5 py-2">
                  <h3 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                    {lang === 'en' ? 'Return Info' : 'Informasi Retur'}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3.5 text-xs text-slate-655">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Origin Transaction No.' : 'No. Transaksi Asal'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activeReturn.no_order}</span>
                  </div>
                  {activeReturn.no_faktur && (
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                        {lang === 'en' ? 'Invoice No.' : 'No. Faktur'}
                      </span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activeReturn.no_faktur}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Return Date' : 'Tanggal Retur'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{formatDate(activeReturn.retur_date)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Compensation Method' : 'Metode Kompensasi'}
                    </span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-1 ${
                      activeReturn.type === 'purchase'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {getMetodeLabel(activeReturn.metode_kompensasi, activeReturn.type)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Pihak Terkait */}
              <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="bg-amber-50 border-b border-amber-100 px-3.5 py-2">
                  <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                    {activeReturn.type === 'purchase'
                      ? (lang === 'en' ? 'Supplier' : 'Pemasok (Supplier)')
                      : (lang === 'en' ? 'Customer Info' : 'Data Customer')}
                  </h3>
                </div>
                <div className="space-y-3.5 p-3.5 text-xs text-slate-655">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Name' : 'Nama'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-855 mt-0.5 block">{activeReturn.party_nama}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Party ID' : 'ID Pihak'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activeReturn.party_id}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Daftar Barang */}
          <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                {lang === 'en' ? 'List of Returned Items' : 'Daftar Barang yang Diretur'}
              </h3>
            </div>
            <div className="p-4">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                      <th className="p-3 w-12 text-center font-bold">#</th>
                      <th className="p-3 w-32 text-center font-bold">{lang === 'en' ? 'Code' : 'Kode'}</th>
                      <th className="p-3 font-bold">{lang === 'en' ? 'Product Name' : 'Nama Barang'}</th>
                      <th className="p-3 text-center w-24 font-bold">{lang === 'en' ? 'Return Qty' : 'Jumlah Retur'}</th>
                      <th className="p-3 text-center w-24 font-bold">{lang === 'en' ? 'Condition' : 'Kondisi'}</th>
                      <th className="p-3 text-right w-32 font-bold">{lang === 'en' ? 'Unit Price' : 'Harga Satuan'}</th>
                      <th className="p-3 text-right w-36 font-bold font-bold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activeReturn.items?.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-855">
                        <td className="p-3 text-center font-semibold text-slate-550">{idx + 1}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                            {item.product_kode}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-805">{item.product_nama}</td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {Number(item.qty)} {item.product?.satuan || 'pcs'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            item.kondisi === 'bagus'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {item.kondisi === 'bagus' ? (lang === 'en' ? 'good' : 'bagus') : (lang === 'en' ? 'damaged' : 'rusak')}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-600">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-end gap-2 text-xs">
                  <div className="flex gap-6 items-center">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      {lang === 'en' ? 'Total Return Value' : 'Total Nilai Retur'}
                    </span>
                    <span className={`text-base font-extrabold font-mono ${
                      activeReturn.type === 'purchase' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(Number(activeReturn.total))}
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
              <span>
                {isInfoHidden
                  ? (lang === 'en' ? 'Show Info' : 'Tampilkan Info')
                  : (lang === 'en' ? 'Hide Info' : 'Sembunyikan Info')}
              </span>
              <kbd className="text-[10px] text-blue-500 font-bold font-mono uppercase bg-blue-50 border border-blue-200 px-1 py-0.5 rounded ml-1">F1</kbd>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveReturn(null);
                setIsInfoHidden(false);
              }}
              className="px-5 py-2.5 rounded-lg border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 focus:outline-none"
            >
              <span>{lang === 'en' ? 'Close' : 'Tutup'}</span>
              <kbd className="text-[10px] text-blue-500 font-bold font-mono uppercase bg-blue-50 border border-blue-200 px-1 py-0.5 rounded ml-1">Esc</kbd>
            </button>
          </div>
        </div>
      )}

      {deleteCheckState.status === 'can_delete' && deleteCheckState.targetItem && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={() => setDeleteCheckState({ status: 'idle', targetItem: null })}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-surface-900 border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden text-slate-800 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              {/* Amber Header */}
              <div className="flex flex-col items-center justify-center gap-2 bg-amber-500 border-b border-amber-600 px-5 py-4 text-center w-full">
                <div className="p-2 bg-white/20 rounded-full">
                  <AlertTriangle size={20} className="text-white" />
                </div>
                <div className="flex flex-col items-center text-center">
                  <h2 className="font-extrabold text-sm text-white uppercase tracking-wider">
                    {lang === 'en' ? 'Confirm Return Transaction Deletion' : 'Konfirmasi Hapus Transaksi Retur'}
                  </h2>
                  <p className="text-xs text-amber-55 text-white mt-1 font-semibold">
                    {lang === 'en' ? 'This action will readjust warehouse stock levels' : 'Tindakan ini akan menyesuaikan kembali stok barang di gudang'}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5 bg-white text-xs">
                <p className="text-slate-700 font-semibold leading-relaxed">
                  {lang === 'en'
                    ? `Are you sure you want to cancel and delete the return transaction "${deleteCheckState.targetItem.no_retur}"?`
                    : `Apakah Anda yakin ingin membatalkan dan menghapus transaksi retur "${deleteCheckState.targetItem.no_retur}"?`}
                </p>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5 text-xs text-slate-655 font-semibold">
                  <div>
                    <span className="font-bold">{lang === 'en' ? 'Return Date:' : 'Tanggal Retur:'}</span>{' '}
                    {formatDate(deleteCheckState.targetItem.retur_date)}
                  </div>
                  <div>
                    <span className="font-bold">{lang === 'en' ? 'Return Type:' : 'Jenis Retur:'}</span>{' '}
                    {deleteCheckState.targetItem.type === 'purchase'
                      ? (lang === 'en' ? 'Purchase Return (PO)' : 'Retur Pembelian (PO)')
                      : (lang === 'en' ? 'Sales Return (SO)' : 'Retur Penjualan (SO)')}
                  </div>
                  <div><span className="font-bold">Supplier/Customer:</span> {deleteCheckState.targetItem.party_nama}</div>
                  <div>
                    <span className="font-bold">{lang === 'en' ? 'Total Return Value:' : 'Total Nilai Retur:'}</span>{' '}
                    {formatCurrency(deleteCheckState.targetItem.total)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 px-5 py-4 bg-slate-50 border-t border-slate-100 justify-end">
                <button
                  onClick={() => setDeleteCheckState({ status: 'idle', targetItem: null })}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-250 text-slate-650 hover:bg-slate-100 transition-all bg-white"
                >
                  {lang === 'en' ? 'Cancel (Esc)' : 'Batal (Esc)'}
                </button>
                <button
                  onClick={confirmDeleteReturn}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-yellow-300 transition-all shadow-md shadow-red-500/20"
                >
                  {lang === 'en' ? 'Yes, Delete (Enter)' : 'Ya, Hapus (Enter)'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
          <div className={`px-4 py-3 rounded-lg shadow-lg text-white font-bold text-xs flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-danger-600'
          }`}>
            <span className="!text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
