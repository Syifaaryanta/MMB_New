import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Calendar, User, FileText, X, Eye, Trash2, Printer, AlertTriangle, Info } from 'lucide-react';

interface Sale {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  customer_nama: string;
  subtotal: number;
  status: string;
  diantar: boolean;
  limit_bulan: number;
  due_date: string | null;
  print_count?: number;
}

export const DaftarPenjualan: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromHistory = searchParams.get('from') === 'history';
  const initDate = (location.state as any)?.date || '';

  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Active SO Detail
  const [activeSo, setActiveSo] = useState<any | null>(null);
  const [isInfoHidden, setIsInfoHidden] = useState(false);

  // Filters Screen
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const defaultFromDate = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const defaultToDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const initSkipFilter = (location.state as any)?.skipFilter || false;
  const [showFilterPage, setShowFilterPage] = useState(!initDate && !initSkipFilter);
  const [fromDate, setFromDate] = useState(initDate || defaultFromDate);
  const [toDate, setToDate] = useState(initDate || defaultToDate);
  const [noOrderFilter, setNoOrderFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteCheckState, setDeleteCheckState] = useState<{
    status: 'idle' | 'checking' | 'cannot_delete' | 'can_delete';
    amountPaid: number;
    targetItem: Sale | null;
  }>({ status: 'idle', amountPaid: 0, targetItem: null });

  const [showConfirmReissue, setShowConfirmReissue] = useState(false);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [sortOption, setSortOption] = useState<'asli' | 'abjad' | 'qty' | 'harga'>('asli');

  const getSortedItems = (itemList: any[]) => {
    if (!itemList) return [];
    const list = [...itemList];
    if (sortOption === 'abjad') {
      return list.sort((a, b) => a.product_nama.localeCompare(b.product_nama));
    } else if (sortOption === 'qty') {
      return list.sort((a, b) => Number(b.qty) - Number(a.qty));
    } else if (sortOption === 'harga') {
      return list.sort((a, b) => Number(b.unit_price) - Number(a.unit_price));
    }
    return list;
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (initDate) {
      setIsLoading(true);
      api.get(`/sales?status=completed&from=${initDate}&to=${initDate}&limit=1000`)
        .then((res) => {
          setSales(res.data.data || []);
          setTotal(res.data.total || 0);
          setSelectedIdx(0);
          setShowFilterPage(false);
          setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
          }, 150);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else if (initSkipFilter) {
      setIsLoading(true);
      api.get(`/sales?status=completed&from=${defaultFromDate}&to=${defaultToDate}&limit=1000`)
        .then((res) => {
          setSales(res.data.data || []);
          setTotal(res.data.total || 0);
          setSelectedIdx(0);
          setShowFilterPage(false);
          setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
          }, 150);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [initDate, initSkipFilter]);

  useEffect(() => {
    if (showFilterPage) {
      setTimeout(() => {
        fromDateRef.current?.focus();
        fromDateRef.current?.select();
      }, 150);
    }
  }, [showFilterPage]);

  const filteredSales = sales.filter((s) =>
    s.customer_nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const confirmDeleteSale = async () => {
    const target = deleteCheckState.targetItem;
    if (!target) return;
    try {
      setIsLoading(true);
      await api.delete(`/sales/${target.id}`);
      showToast('Transaksi berhasil dibatalkan dan stok dikembalikan', 'success');
      let url = `/sales?status=completed&limit=1000`;
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;
      const res = await api.get(url);
      setSales(res.data.data || []);
      setSelectedIdx(0);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Gagal membatalkan transaksi', 'error');
    } finally {
      setIsLoading(false);
      setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null });
    }
  };

  const triggerDelete = async () => {
    const target = filteredSales[selectedIdx];
    if (!target) return;

    setDeleteCheckState({ status: 'checking', amountPaid: 0, targetItem: target });
    try {
      const res = await api.get(`/sales/${target.id}`);
      const saleDetail = res.data;
      const payments = saleDetail.sales_payments || [];
      const allocations = saleDetail.billing_allocations || [];
      const returns = saleDetail.sale_returns || [];

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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSales.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        searchInputRef.current?.blur();
      }
    }
  };

  const handleOpenDetail = async (so: Sale) => {
    try {
      const res = await api.get(`/sales/${so.id}`);
      setActiveSo(res.data);
      setIsInfoHidden(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFilterSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      let url = `/sales?status=completed&limit=1000`;
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;

      const res = await api.get(url);
      let list = res.data.data || [];

      if (noOrderFilter.trim()) {
        const query = noOrderFilter.trim().toLowerCase();
        list = list.filter((s: Sale) => 
          (s.no_order && s.no_order.toLowerCase().includes(query)) ||
          (s.no_faktur && s.no_faktur.toLowerCase().includes(query))
        );
      }

      setSales(list);
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

  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');

  const handlePrint = async (format: 'thermal' | 'a4') => {
    setPrintFormat(format);
    if (!activeSo) return;
    try {
      setIsLoading(true);
      const res = await api.patch(`/sales/${activeSo.id}/print`);
      setActiveSo(res.data);
      setSales((prev) => prev.map((s) => (s.id === activeSo.id ? res.data : s)));
      setTimeout(() => {
        window.print();
      }, 250);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Gagal memproses cetak ulang nota', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard Shortcuts
  // Enter: View SO detail
  useHotkeys('enter', (e) => {
    if (deleteCheckState.status === 'can_delete') {
      e.preventDefault();
      confirmDeleteSale();
    } else if (deleteCheckState.status === 'cannot_delete') {
      e.preventDefault();
      setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null });
    } else if (showConfirmReissue) {
      e.preventDefault();
      setShowConfirmReissue(false);
      setShowPrintConfirm(true);
    } else if (showPrintConfirm) {
      e.preventDefault();
      setShowPrintConfirm(false);
    } else if (isTableFocused && !activeSo && deleteCheckState.status === 'idle' && filteredSales[selectedIdx]) {
      e.preventDefault();
      handleOpenDetail(filteredSales[selectedIdx]);
    }
  }, { enableOnFormTags: true }, [deleteCheckState, showConfirmReissue, showPrintConfirm, isTableFocused, activeSo, filteredSales, selectedIdx]);

  // Delete key: Trigger delete modal
  useHotkeys('del, delete', (e) => {
    if (isTableFocused && !activeSo && deleteCheckState.status === 'idle' && filteredSales[selectedIdx]) {
      e.preventDefault();
      triggerDelete();
    }
  }, { enableOnFormTags: false }, [isTableFocused, activeSo, deleteCheckState, filteredSales, selectedIdx]);

  // F1: Focus search input or toggle detail info visibility
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (activeSo) {
      setIsInfoHidden((prev) => !prev);
    } else {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true }, [activeSo]);

  // F2: Open Filter Popup
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (!activeSo) setShowFilterPage(true);
  }, { enableOnFormTags: true }, [activeSo]);

  // Arrow up/down navigation
  useHotkeys('up', (e) => {
    if (isTableFocused && !activeSo && deleteCheckState.status === 'idle') {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(0, p - 1));
    }
  }, { enableOnFormTags: false }, [isTableFocused, activeSo, deleteCheckState]);

  useHotkeys('down', (e) => {
    if (isTableFocused && !activeSo && deleteCheckState.status === 'idle') {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(filteredSales.length - 1, p + 1));
    }
  }, { enableOnFormTags: false }, [isTableFocused, activeSo, deleteCheckState, filteredSales]);

  // Escape to close detail or go back
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showPrintConfirm) {
      setShowPrintConfirm(false);
    } else if (showConfirmReissue) {
      setShowConfirmReissue(false);
    } else if (deleteCheckState.status !== 'idle') {
      setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null });
    } else if (activeSo) {
      setActiveSo(null);
      setIsInfoHidden(false);
    } else if (showFilterPage) {
      navigate(fromHistory ? '/history' : '/penjualan');
    } else if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else {
      setShowFilterPage(true);
    }
  }, { enableOnFormTags: true }, [showPrintConfirm, showConfirmReissue, deleteCheckState, activeSo, showFilterPage, isTableFocused, fromHistory]);

  // Y key to confirm reissue
  useHotkeys('y', (e) => {
    if (showConfirmReissue) {
      e.preventDefault();
      setShowConfirmReissue(false);
      setShowPrintConfirm(true);
    }
  }, { enableOnFormTags: true });

  // P inside format confirm or detail page to trigger print reissue
  useHotkeys('p', (e) => {
    if (showPrintConfirm) {
      e.preventDefault();
      setShowPrintConfirm(false);
      handlePrint(printFormat);
    } else if (activeSo && !showPrintConfirm && !showConfirmReissue && !showDeleteConfirm) {
      e.preventDefault();
      setShowConfirmReissue(true);
    }
  }, { enableOnFormTags: true });

  // Arrow Keys inside print confirm to choose options
  useHotkeys('up', (e) => {
    if (showPrintConfirm) {
      e.preventDefault();
      setPrintFormat('thermal');
    }
  }, { enableOnFormTags: true });

  useHotkeys('down', (e) => {
    if (showPrintConfirm) {
      e.preventDefault();
      setPrintFormat('a4');
    }
  }, { enableOnFormTags: true });

  useHotkeys('right', (e) => {
    if (showPrintConfirm) {
      e.preventDefault();
      const sortOptions: Array<'asli' | 'abjad' | 'qty' | 'harga'> = ['asli', 'abjad', 'qty', 'harga'];
      const currentIndex = sortOptions.indexOf(sortOption);
      const nextIndex = (currentIndex + 1) % sortOptions.length;
      setSortOption(sortOptions[nextIndex]);
    }
  }, { enableOnFormTags: true });

  useHotkeys('left', (e) => {
    if (showPrintConfirm) {
      e.preventDefault();
      const sortOptions: Array<'asli' | 'abjad' | 'qty' | 'harga'> = ['asli', 'abjad', 'qty', 'harga'];
      const currentIndex = sortOptions.indexOf(sortOption);
      const nextIndex = (currentIndex - 1 + sortOptions.length) % sortOptions.length;
      setSortOption(sortOptions[nextIndex]);
    }
  }, { enableOnFormTags: true });

  if (showFilterPage) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Daftar Nota Penjualan</h1>
            <p className="text-slate-400">Daftar transaksi penjualan (SO) yang telah diselesaikan</p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-primary-600 text-white px-6 py-4 text-center border-b border-primary-700/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Filter Pencarian SO</h3>
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
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Nomor Order</label>
                <input
                  ref={noOrderFilterRef}
                  type="text"
                  placeholder="Semua / Ketik No Order"
                  value={noOrderFilter}
                  onChange={(e) => setNoOrderFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFilterSubmit(e))}
                  className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/penjualan')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-650 text-xs font-bold hover:bg-slate-50 transition-all"
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
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Daftar Nota Penjualan</h1>
            <p className="text-slate-400">Daftar transaksi penjualan (SO) yang telah diselesaikan</p>
          </div>
        </div>

        {!activeSo ? (
          /* SO List Grid */
          <div className="space-y-4">
            {/* Inline Search Bar & Filter Button */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Cari nama customer (F1)..."
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
                <div className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 font-semibold flex items-center gap-2 bg-white shadow-sm font-mono">
                  <Calendar size={14} className="text-primary-600" />
                  <span>{formatDate(fromDate)} - {formatDate(toDate)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilterPage(true)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  Filter Tanggal & No Order (F2)
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 skeleton" />
                ))}
              </div>
            ) : filteredSales.length > 0 ? (
              <div className="card p-0 overflow-hidden border border-surface-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">No Order</th>
                      <th className="p-4">No Faktur</th>
                      <th className="p-4">Pelanggan</th>
                      <th className="p-4">Tanggal Order</th>
                      <th className="p-4">Jatuh Tempo</th>
                      <th className="p-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((s, idx) => {
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
                          key={s.id}
                          ref={(el) => {
                            rowRefs.current[idx] = el;
                          }}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setIsTableFocused(true);
                          }}
                          onDoubleClick={() => handleOpenDetail(s)}
                          className={`cursor-pointer ${rowBgClass}`}
                        >
                          <td className={getTdClass('first')}>
                            <span className="px-2 py-0.5 rounded bg-blue-50/80 text-primary-700 border border-blue-100 font-mono font-bold text-xs inline-block">
                              {s.no_order}
                            </span>
                          </td>
                          <td className={getTdClass('middle') + " font-mono"}>
                            {s.no_faktur || '-'}
                          </td>
                          <td className={getTdClass('middle') + " font-semibold"}>
                            {s.customer_nama}
                          </td>
                          <td className={getTdClass('middle')}>
                            {formatDate(s.order_date)}
                          </td>
                          <td className={getTdClass('middle')}>
                            {s.due_date ? formatDate(s.due_date) : '-'}
                          </td>
                          <td className={getTdClass('last') + " text-right font-black text-slate-900"}>
                            {formatCurrency(Number(s.subtotal))}
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
                <h3 className="text-lg font-bold text-slate-400">Tidak ada data SO ditemukan</h3>
                <p className="text-sm mt-1">Gunakan filter F1 untuk melakukan pencarian penjualan.</p>
              </div>
            )}
          </div>
        ) : (
          /* SO Detail View (3 Cards Layout) */
          <div className="space-y-4 animate-fade-in text-slate-800">
            {/* Detail Page Title (Teks saja) */}
            <div className="pb-1">
              <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <span>Detail Order: {activeSo.no_order}</span>
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-1">Status: <span className="font-bold text-blue-600 uppercase">{activeSo.status}</span></p>
            </div>

            {/* 3 Separate Cards Layout */}
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
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activeSo.no_order}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">No. Faktur</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activeSo.no_faktur || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Tanggal Order</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{formatDate(activeSo.order_date)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Pengiriman</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        {activeSo.diantar ? 'Diantar' : 'Diambil'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Jatuh Tempo</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        {activeSo.limit_bulan !== undefined ? `${activeSo.limit_bulan + 1} Bulan` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Status Cetak</span>
                      <span className={`text-xs font-bold mt-0.5 block ${activeSo.print_count && activeSo.print_count > 0 ? 'text-green-650' : 'text-amber-600'}`}>
                        {activeSo.print_count && activeSo.print_count > 0 ? `Sudah Cetak (${activeSo.print_count}x)` : 'Belum Cetak'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Data Customer */}
                <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                  <div className="bg-amber-50 border-b border-amber-100 px-3.5 py-2">
                    <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Data Customer</h3>
                  </div>
                  <div className="space-y-3.5 p-3.5 text-xs text-slate-600">
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Nama Customer</span>
                      <span className="text-xs font-extrabold text-slate-850 mt-0.5 block">{activeSo.customer_nama}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Alamat Pengiriman</span>
                      <span className="text-xs font-semibold text-slate-700 mt-0.5 block leading-normal">
                        {activeSo.customer_alamat || 'Alamat tidak dicantumkan'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">No. Telepon / Kontak</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activeSo.customer_telp || '-'}</span>
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
                        <th className="p-3 text-right w-36">Harga Satuan</th>
                        <th className="p-3 text-right w-40">Total Harga</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {activeSo.sale_items.map((item: any, idx: number) => {
                        const returnedQty = activeSo.sale_returns?.reduce((sum: number, ret: any) => {
                          const retItem = ret.items?.find((it: any) => it.product_id === item.product_id);
                          return sum + (retItem ? Number(retItem.qty) : 0);
                        }, 0) || 0;
                        const isReturned = returnedQty > 0;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-855">
                            <td className="p-3 text-center font-semibold text-slate-550">{idx + 1}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                                {item.product_kode}
                              </span>
                            </td>
                            <td className={`p-3 font-bold ${isReturned ? 'text-rose-700 font-extrabold' : 'text-slate-800'}`}>{item.product_nama}</td>
                            <td className={`p-3 text-center font-bold ${isReturned ? 'text-rose-700' : 'text-slate-700'}`}>
                              {Number(item.qty)}
                              {isReturned && (
                                <span className="text-[10px] block text-red-500 font-bold mt-0.5">
                                  (Retur: {returnedQty})
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-semibold text-slate-600">
                              {formatCurrency(Number(item.unit_price))}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-900">
                              {formatCurrency(Number(item.total))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-end gap-2 text-xs">
                    {Number(activeSo.extra_charge_amount) !== 0 && (
                      <div className="flex gap-4 text-xs font-semibold text-slate-650">
                        <span>Penyesuaian ({activeSo.extra_charge_desc}):</span>
                        <span className="font-mono text-slate-800">{formatCurrency(Number(activeSo.extra_charge_amount))}</span>
                      </div>
                    )}
                    <div className="flex gap-6 items-center">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Subtotal Keseluruhan</span>
                      <span className="text-base font-extrabold text-blue-600 font-mono">
                        {formatCurrency(Number(activeSo.subtotal))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Buttons (Styled beautifully) */}
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
                  setActiveSo(null);
                  setIsInfoHidden(false);
                }}
                className="px-5 py-2.5 rounded-lg border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 focus:outline-none"
              >
                <span>Tutup</span>
                <kbd className="text-[10px] text-blue-500 font-bold font-mono uppercase bg-blue-50 border border-blue-200 px-1 py-0.5 rounded ml-1">Esc</kbd>
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmReissue(true)}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10 flex items-center gap-2 focus:outline-none"
              >
                <Printer size={15} />
                <span>Cetak Nota</span>
                <kbd className="text-[10px] text-blue-200 font-bold font-mono uppercase bg-blue-700 px-1.5 py-0.5 rounded ml-1">P</kbd>
              </button>
            </div>
          </div>
        )}

        {/* Simple Reissue Confirmation Modal (Modal A) */}
        {showConfirmReissue && activeSo && (
          <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
            <div className="bg-white rounded-xl max-w-sm w-full mx-auto shadow-2xl animate-scale-in text-slate-800 overflow-hidden border border-blue-200">
              <div className="bg-primary-600 text-white px-6 py-4 flex flex-col items-center justify-center gap-2 border-b border-primary-700/80">
                <Printer size={24} className="shrink-0 text-white animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-center text-white">Cetak Ulang Nota</h3>
              </div>
              <div className="p-6 text-center">
                <p className="text-xs text-slate-600 leading-relaxed mb-6 font-medium">
                  Apakah Anda yakin ingin mencetak ulang nota ini?
                </p>
                <div className="flex justify-center gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowConfirmReissue(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all focus:ring-2 focus:ring-slate-500/20"
                  >
                    Batal (Esc)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmReissue(false);
                      setShowPrintConfirm(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-550 transition-all shadow-md focus:ring-2 focus:ring-primary-500/20"
                  >
                    Ya, Lanjut (Enter/Y)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* Print Confirmation Dialog (Modal B) */}
        {showPrintConfirm && activeSo && (
          <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
            <div className="bg-white border border-blue-200 rounded-xl p-6 max-w-3xl w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-800">
              
              {/* Header */}
              <div className="flex justify-between items-center w-full border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Printer size={18} className="text-primary-600" />
                  <span>Konfirmasi Cetak Nota</span>
                </h3>
                <button
                  onClick={() => setShowPrintConfirm(false)}
                  className="text-slate-450 hover:text-slate-650 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Subtitle */}
              <p className="text-xs text-slate-500 mt-4 font-medium">
                Pilih urutan item, lalu pilih aksi: Simpan sebagai Draft (Enter) atau Print (P).
              </p>

              {/* Sorting Pills */}
              <div className="flex gap-2.5 mt-4">
                {(['asli', 'abjad', 'qty', 'harga'] as const).map((opt) => {
                  const labelMap = {
                    asli: 'Urutan Asli',
                    abjad: 'Abjad (A-Z)',
                    qty: 'Qty Terbanyak',
                    harga: 'Harga Tertinggi',
                  };
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSortOption(opt)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        sortOption === opt
                          ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {labelMap[opt]}
                    </button>
                  );
                })}
              </div>

              {/* Items Preview Table */}
              <div className="mt-4 border border-blue-200 rounded-lg overflow-hidden max-h-[250px] overflow-y-auto bg-slate-50">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-blue-250 text-slate-700 font-bold">
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3 text-right w-20">Qty</th>
                      <th className="p-3 text-right w-32">Harga</th>
                      <th className="p-3 text-right w-32">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 bg-white">
                    {getSortedItems(activeSo.sale_items).map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 text-slate-800">
                        <td className="p-3 font-semibold text-slate-900">{item.product_nama}</td>
                        <td className="p-3 text-right font-medium text-slate-700">{Number(item.qty)}</td>
                        <td className="p-3 text-right font-mono font-medium text-slate-600">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Format Cetak Indicator & Selector (Panah Atas/Bawah) */}
              <div className="mt-3 flex justify-between items-center bg-blue-50/40 border border-blue-100 rounded-lg px-4 py-2.5 text-xs">
                <span className="font-semibold text-slate-600">Format Cetak terpilih:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary-700 capitalize">{printFormat} Invoice</span>
                  <span className="text-[10px] text-slate-400 font-medium">(Panah Atas/Bawah untuk mengubah)</span>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPrintConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-650 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Batal (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Simpan Draft (Enter)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintConfirm(false);
                    handlePrint(printFormat);
                  }}
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-500 transition-all shadow-md shadow-primary-500/10"
                >
                  Print (P)
                </button>
              </div>

            </div>
          </div>
        </ModalPortal>
        )}

      </div>

      {/* Print Layout */}
      {activeSo && (
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
                <p>No. Faktur: {activeSo.no_faktur || activeSo.no_order}</p>
                <p>Tanggal: {formatDate(activeSo.order_date)}</p>
                <p>Pelanggan: {activeSo.customer_nama}</p>
                <p>Termin: {activeSo.limit_bulan + 1} Bulan</p>
                <p>Status: LUNAS (KREDIT J.TEMPO)</p>
                <p className="border-t border-dashed border-black my-1.5"></p>
              </div>
              <div className="space-y-1">
                {getSortedItems(activeSo.sale_items).map((item: any) => (
                  <div key={item.id} className="space-y-0.5">
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
                {Number(activeSo.extra_charge_amount) !== 0 && (
                  <p>Adj ({activeSo.extra_charge_desc}): {formatCurrency(Number(activeSo.extra_charge_amount))}</p>
                )}
                <p className="font-bold text-xs">Total: {formatCurrency(Number(activeSo.subtotal))}</p>
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
                  <p className="text-xs font-semibold font-mono">{activeSo.no_faktur || activeSo.no_order}</p>
                  <p className="text-[10px] mt-2">Tanggal: {formatDate(activeSo.order_date)}</p>
                  {activeSo.due_date && (
                    <p className="text-[10px] text-red-600 font-bold">Jatuh Tempo: {formatDate(activeSo.due_date)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <p className="font-bold uppercase text-slate-500">Pelanggan:</p>
                  <p className="font-bold text-xs">{activeSo.customer_nama}</p>
                  <p>{activeSo.customer_alamat || 'Alamat tidak dicantumkan'}</p>
                  <p>Telp: {activeSo.customer_telp || '-'}</p>
                </div>
                <div>
                  <p className="font-bold uppercase text-slate-500">Pengiriman & Catatan:</p>
                  <p className="font-semibold">{activeSo.diantar ? '🚚 DIANTAR SOPIR' : '🚶 DIAMBIL SENDIRI'}</p>
                  {activeSo.sender_note && <p className="italic mt-1">"{activeSo.sender_note}"</p>}
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
                  {getSortedItems(activeSo.sale_items).map((item: any, idx: number) => (
                    <tr key={item.id} className="align-top">
                      <td className="p-1.5 border-r border-black text-center">{idx + 1}</td>
                      <td className="p-1.5 border-r border-black font-mono">{item.product_kode}</td>
                      <td className="p-1.5 border-r border-black font-bold">{item.product_nama}</td>
                      <td className="p-1.5 border-r border-black text-right">{Number(item.qty)}</td>
                      <td className="p-1.5 border-r border-black text-right">{formatCurrency(Number(item.unit_price))}</td>
                      <td className="p-1.5 text-right">{formatCurrency(Number(item.total))}</td>
                    </tr>
                  ))}
                  {Number(activeSo.extra_charge_amount) !== 0 && (
                    <tr>
                      <td colSpan={5} className="p-1.5 border-r border-black text-right font-bold uppercase">
                        Penyesuaian ({activeSo.extra_charge_desc})
                      </td>
                      <td className="p-1.5 text-right font-bold">
                        {formatCurrency(Number(activeSo.extra_charge_amount))}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 border-t border-black">
                    <td colSpan={5} className="p-1.5 border-r border-black text-right font-bold uppercase">
                      Grand Total Penjualan
                    </td>
                    <td className="p-1.5 text-right font-black">
                      {formatCurrency(Number(activeSo.subtotal))}
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
                  <p className="underline font-bold">({activeSo.creator?.nama || '____________________'})</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteCheckState.status === 'checking' && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-white border border-slate-200 rounded-xl p-6 max-w-xs w-full shadow-2xl animate-scale-in text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Memeriksa status pembayaran transaksi...</p>
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
              <div className="flex flex-col items-center justify-center gap-2 bg-red-500/10 border-b border-red-500/20 px-5 py-4 text-white text-center w-full">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <X size={18} className="text-red-400" />
                </div>
                <div className="flex flex-col items-center text-center">
                  <h2 className="font-bold text-sm text-black">Transaksi Tidak Dapat Dihapus</h2>
                  <p className="text-xs text-red-405 mt-0.5 font-semibold">Sudah memiliki riwayat pembayaran atau retur</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5 bg-white text-xs">
                <p className="text-slate-700 font-semibold leading-relaxed">
                  Data transaksi penjualan <span className="font-extrabold text-slate-900">"{deleteCheckState.targetItem.no_order}"</span> tidak dapat dihapus karena sudah memiliki pelunasan/pembayaran sebagian sebesar <span className="text-red-650 font-extrabold">{formatCurrency(deleteCheckState.amountPaid)}</span> atau sudah memiliki dokumen retur.
                </p>
                <p className="text-slate-500 mt-2">
                  Harap batalkan/hapus pembayaran terkait di menu penagihan/pelunasan terlebih dahulu sebelum menghapus transaksi ini.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100 justify-end">
                <button
                  onClick={() => setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null })}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-yellow-300 transition-all shadow-md shadow-red-500/20"
                >
                  Tutup (Enter / Esc)
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
              <div className="flex flex-col items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-5 py-4 text-white text-center w-full">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <AlertTriangle size={18} className="text-amber-400" />
                </div>
                <div className="flex flex-col items-center text-center">
                  <h2 className="font-bold text-sm text-white">Konfirmasi Batal Transaksi</h2>
                  <p className="text-xs text-amber-400 mt-0.5 font-semibold">Tindakan ini akan mengembalikan stok barang ke gudang</p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5 bg-white text-xs">
                <p className="text-slate-700 font-semibold leading-relaxed">
                  Apakah Anda yakin ingin membatalkan dan menghapus transaksi order <span className="font-extrabold text-slate-900">"{deleteCheckState.targetItem.no_order}"</span>?
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
                  onClick={() => setDeleteCheckState({ status: 'idle', amountPaid: 0, targetItem: null })}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-250 text-slate-600 hover:bg-slate-100 transition-all bg-white"
                >
                  Batal (Esc)
                </button>
                <button
                  onClick={confirmDeleteSale}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-yellow-300 transition-all shadow-md shadow-red-500/20"
                >
                  Ya, Batalkan (Enter)
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
