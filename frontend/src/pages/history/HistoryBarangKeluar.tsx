import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Calendar, FileText, X, PackageMinus } from 'lucide-react';

interface Sale {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  customer_nama: string;
  subtotal: number;
  status: string;
  diantar: boolean;
}

export const HistoryBarangKeluar: React.FC = () => {
  const navigate = useNavigate();

  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Active SO Detail
  const [activeSo, setActiveSo] = useState<any | null>(null);
  const [isInfoHidden, setIsInfoHidden] = useState(false);

  // Real-time Clock
  const [realtimeTime, setRealtimeTime] = useState('');

  // Filters
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

  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const noOrderFilterRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clock
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

  const filteredSales = sales.filter((s) =>
    s.customer_nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // Keyboard Shortcuts
  useHotkeys('enter', (e) => {
    if (isTableFocused && !activeSo && filteredSales[selectedIdx]) {
      e.preventDefault();
      handleOpenDetail(filteredSales[selectedIdx]);
    }
  }, { enableOnFormTags: false });

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

  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (!activeSo) setShowFilterPage(true);
  }, { enableOnFormTags: true });

  useHotkeys('up', (e) => {
    if (isTableFocused && !activeSo) {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(0, p - 1));
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    if (isTableFocused && !activeSo) {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(filteredSales.length - 1, p + 1));
    }
  }, { enableOnFormTags: false });

  // Escape: always back to /history
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (activeSo) {
      setActiveSo(null);
      setIsInfoHidden(false);
    } else if (showFilterPage) {
      navigate('/history');
    } else if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else {
      setShowFilterPage(true);
    }
  }, { enableOnFormTags: true });

  if (showFilterPage) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <PackageMinus size={18} />
              </div>
              <h1 className="text-2xl font-extrabold text-white">Histori Barang Keluar</h1>
            </div>
            <p className="text-slate-400 ml-10">Log pengiriman barang ke pelanggan dari Sales Order yang sudah selesai</p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-rose-600 text-white px-6 py-4 text-center border-b border-rose-700/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Filter Pencarian Barang Keluar</h3>
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
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-lg bg-white"
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
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Nomor SO / Faktur</label>
                <input
                  ref={noOrderFilterRef}
                  type="text"
                  placeholder="Semua / Ketik No SO atau No Faktur"
                  value={noOrderFilter}
                  onChange={(e) => setNoOrderFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFilterSubmit(e))}
                  className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-lg bg-white font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-655 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-550 transition-all shadow-md shadow-rose-500/10"
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
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <PackageMinus size={18} />
            </div>
            <h1 className="text-2xl font-extrabold text-white">Histori Barang Keluar</h1>
          </div>
          <p className="text-slate-400 ml-10">Log pengiriman barang ke pelanggan dari Sales Order yang sudah selesai</p>
        </div>
      </div>

      {!activeSo ? (
        <div className="space-y-4">
          {/* Search & Filter bar */}
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
                className="input-field pl-9 w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-lg bg-white shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
              <div className="bg-surface-800 border border-surface-700 px-4 py-2.5 rounded-lg text-slate-350 font-mono text-xs flex items-center justify-center shadow-sm min-w-[200px]">
                {realtimeTime}
              </div>

              <div className="px-3 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 font-semibold flex items-center gap-2 bg-white shadow-sm font-mono">
                <Calendar size={14} className="text-rose-600" />
                <span>{formatDate(fromDate)} - {formatDate(toDate)}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowFilterPage(true)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                Filter Tanggal & No SO (F2)
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
                      <th className="p-4">Nomor SO</th>
                      <th className="p-4">No Faktur</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Tanggal Order</th>
                      <th className="p-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((s, idx) => {
                      const isFocused = idx === selectedIdx && isTableFocused;
                      const rowBgClass = isFocused ? 'bg-rose-100' : 'hover:bg-slate-50';

                      const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                        let base = "p-4 text-xs transition-all duration-150 border-b ";
                        if (isFocused) {
                          base += "bg-rose-100 text-rose-950 font-bold border-rose-300 ";
                          if (pos === 'first') base += "border-l-4 border-rose-600 ";
                        } else {
                          base += "text-slate-800 border-slate-200 ";
                        }
                        return base;
                      };

                      return (
                        <tr
                          key={s.id}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setIsTableFocused(true);
                          }}
                          onDoubleClick={() => handleOpenDetail(s)}
                          className={`cursor-pointer ${rowBgClass}`}
                        >
                          <td className={getTdClass('first')}>
                            <span className="px-2 py-0.5 rounded bg-rose-50/80 text-rose-700 border border-rose-100 font-mono font-bold text-xs inline-block">
                              {s.no_order}
                            </span>
                          </td>
                          <td className={getTdClass('middle')}>
                            {s.no_faktur ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50/80 text-blue-700 border border-blue-100 font-mono font-bold text-xs inline-block">
                                {s.no_faktur}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">-</span>
                            )}
                          </td>
                          <td className={getTdClass('middle') + " font-semibold"}>
                            {s.customer_nama || '-'}
                          </td>
                          <td className={getTdClass('middle')}>
                            {formatDate(s.order_date)}
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
              <PackageMinus className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-400">Tidak ada data barang keluar ditemukan</h3>
              <p className="text-sm mt-1">Gunakan filter F2 untuk mencari berdasarkan tanggal dan nomor SO.</p>
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
              <span>Detail Pengiriman: {activeSo.no_faktur || activeSo.no_order}</span>
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">Status: <span className="font-bold text-blue-600 uppercase">{activeSo.status}</span></p>
          </div>

          {/* 3 Separate Cards Layout */}
          {!isInfoHidden && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Informasi Pengiriman */}
              <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="bg-blue-50 border-b border-blue-100 px-3.5 py-2">
                  <h3 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Informasi Pengiriman</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3.5 text-xs text-slate-600">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">No. SO</span>
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
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Status</span>
                    <span className="text-xs font-bold text-rose-700 mt-0.5 block uppercase">{activeSo.status}</span>
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
                    <span className="text-xs font-extrabold text-slate-855 mt-0.5 block">{activeSo.customer_nama || activeSo.customer?.nama || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Kode Customer</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activeSo.customer?.kode || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Daftar Barang */}
          <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Daftar Barang yang Dikirim</h3>
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
                      <th className="p-3 text-right w-36">Harga Jual</th>
                      <th className="p-3 text-right w-40">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(activeSo.sale_items || activeSo.items || []).map((item: any, idx: number) => {
                      const returnedQty = activeSo.sale_returns?.reduce((sum: number, ret: any) => {
                        const retItem = ret.items?.find((it: any) => it.product_id === item.product_id);
                        return sum + (retItem ? Number(retItem.qty) : 0);
                      }, 0) || 0;
                      const isReturned = returnedQty > 0;
                      const unitPrice = Number(item.unit_price || item.harga_jual || 0);
                      const total = Number(item.total || (Number(item.qty) * unitPrice));

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors text-slate-855">
                          <td className="p-3 text-center font-semibold text-slate-550">{idx + 1}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                              {item.product_kode || item.product?.kode || '-'}
                            </span>
                          </td>
                          <td className={`p-3 font-bold ${isReturned ? 'text-rose-700 font-extrabold' : 'text-slate-800'}`}>{item.product_nama || item.product?.nama || '-'}</td>
                          <td className={`p-3 text-center font-bold ${isReturned ? 'text-rose-700' : 'text-slate-700'}`}>
                            {Number(item.qty)}
                            {isReturned && (
                              <span className="text-[10px] block text-red-500 font-bold mt-0.5">
                                (Retur: {returnedQty})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-600">{formatCurrency(unitPrice)}</td>
                          <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-end gap-2 text-xs">
                  <div className="flex gap-6 items-center">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Total Barang Keluar</span>
                    <span className="text-base font-extrabold text-rose-600 font-mono">
                      {formatCurrency(Number(activeSo.subtotal))}
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
                setActiveSo(null);
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
    </div>
  );
};
