import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Calendar, FileText, X, PackageCheck } from 'lucide-react';

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  supplier: {
    id: string;
    kode: string;
    nama: string;
    alamat?: string;
  };
  terms: string;
  subtotal: number;
  status: string;
  received_at: string | null;
}

export const HistoryBarangMasuk: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();

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

  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const noOrderFilterRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Update Real-time Time Clock (every second)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const format = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }) + ' - ' + now.toLocaleTimeString(lang === 'en' ? 'en-US' : 'id-ID', {
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
  }, [lang]);

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

  // Keyboard Shortcuts
  useHotkeys('enter', (e) => {
    if (isTableFocused && !activePo && filteredPurchases[selectedIdx]) {
      e.preventDefault();
      handleOpenDetail(filteredPurchases[selectedIdx]);
    }
  }, { enableOnFormTags: false });

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

  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (!activePo) setShowFilterPage(true);
  }, { enableOnFormTags: true });

  useHotkeys('up', (e) => {
    if (isTableFocused && !activePo) {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(0, p - 1));
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    if (isTableFocused && !activePo) {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(filteredPurchases.length - 1, p + 1));
    }
  }, { enableOnFormTags: false });

  // Escape: always go back to /history
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (activePo) {
      setActivePo(null);
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <PackageCheck size={18} />
              </div>
              <h1 className="text-2xl font-extrabold text-white">
                {lang === 'en' ? 'Incoming Goods History' : 'Histori Barang Masuk'}
              </h1>
            </div>
            <p className="text-slate-400 ml-10">
              {lang === 'en'
                ? 'Log of incoming goods to warehouse from Purchase Orders (received)'
                : 'Log penerimaan barang ke gudang dari Purchase Order (received)'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-emerald-600 text-white px-6 py-4 text-center border-b border-emerald-700/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {lang === 'en' ? 'Search Filter Incoming Goods' : 'Filter Pencarian Barang Masuk'}
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
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-lg bg-white"
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
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), noOrderFilterRef.current?.focus())}
                    className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">
                  {lang === 'en' ? 'PO Number' : 'Nomor PO'}
                </label>
                <input
                  ref={noOrderFilterRef}
                  type="text"
                  placeholder={lang === 'en' ? 'All / Type PO No.' : 'Semua / Ketik No PO'}
                  value={noOrderFilter}
                  onChange={(e) => setNoOrderFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFilterSubmit(e))}
                  className="input-field w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-lg bg-white font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-655 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  {lang === 'en' ? 'Back' : 'Kembali'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-550 transition-all shadow-md shadow-emerald-500/10"
                >
                  {lang === 'en' ? 'Show (Enter)' : 'Tampilkan (Enter)'}
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
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <PackageCheck size={18} />
            </div>
            <h1 className="text-2xl font-extrabold text-white">
              {lang === 'en' ? 'Incoming Goods History' : 'Histori Barang Masuk'}
            </h1>
          </div>
          <p className="text-slate-400 ml-10">
            {lang === 'en'
              ? 'Log of incoming goods to warehouse from Purchase Orders (received)'
              : 'Log penerimaan barang ke gudang dari Purchase Order (received)'}
          </p>
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
                placeholder={lang === 'en' ? 'Search supplier name (F1)...' : 'Cari nama supplier (F1)...'}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsTableFocused(false);
                }}
                onKeyDown={handleSearchKeyDown}
                className="input-field pl-9 w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-lg bg-white shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
              <div className="bg-surface-800 border border-surface-700 px-4 py-2.5 rounded-lg text-slate-350 font-mono text-xs flex items-center justify-center shadow-sm min-w-[200px]">
                {realtimeTime}
              </div>

              <div className="px-3 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 font-semibold flex items-center gap-2 bg-white shadow-sm font-mono">
                <Calendar size={14} className="text-emerald-600" />
                <span>{formatDate(fromDate)} - {formatDate(toDate)}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowFilterPage(true)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                {lang === 'en' ? 'Filter Date & PO No. (F2)' : 'Filter Tanggal & No PO (F2)'}
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
                      <th className="p-4">{lang === 'en' ? 'PO Number' : 'Nomor PO'}</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">{lang === 'en' ? 'Order Date' : 'Tanggal Order'}</th>
                      <th className="p-4">{lang === 'en' ? 'Date Received' : 'Tanggal Diterima'}</th>
                      <th className="p-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((p, idx) => {
                      const isFocused = idx === selectedIdx && isTableFocused;
                      const rowBgClass = isFocused ? 'bg-emerald-100' : 'hover:bg-slate-50';

                      const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                        let base = "p-4 text-xs transition-all duration-150 border-b ";
                        if (isFocused) {
                          base += "bg-emerald-100 text-emerald-950 font-bold border-emerald-300 ";
                          if (pos === 'first') base += "border-l-4 border-emerald-600 ";
                        } else {
                          base += "text-slate-800 border-slate-200 ";
                        }
                        return base;
                      };

                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setIsTableFocused(true);
                          }}
                          onDoubleClick={() => handleOpenDetail(p)}
                          className={`cursor-pointer ${rowBgClass}`}
                        >
                          <td className={getTdClass('first')}>
                            <span className="px-2 py-0.5 rounded bg-emerald-50/80 text-emerald-700 border border-emerald-100 font-mono font-bold text-xs inline-block">
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
              <PackageCheck className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-400">
                {lang === 'en' ? 'No incoming goods data found' : 'Tidak ada data barang masuk ditemukan'}
              </h3>
              <p className="text-sm mt-1">
                {lang === 'en'
                  ? 'Use filter F2 to search by date and PO number.'
                  : 'Gunakan filter F2 untuk mencari berdasarkan tanggal dan nomor PO.'}
              </p>
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
              <span>{lang === 'en' ? 'Receiving Detail:' : 'Detail Penerimaan:'} {activePo.no_order}</span>
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Status:{' '}
              <span className="font-bold text-emerald-600 uppercase">
                {lang === 'en' ? 'RECEIVED' : 'DITERIMA'}
              </span>
            </p>
          </div>

          {/* 3 Separate Cards Layout */}
          {!isInfoHidden && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Informasi Penerimaan */}
              <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="bg-blue-50 border-b border-blue-100 px-3.5 py-2">
                  <h3 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                    {lang === 'en' ? 'Receiving Info' : 'Informasi Penerimaan'}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3.5 text-xs text-slate-600">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'PO No.' : 'No. PO'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activePo.no_order}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Order Date' : 'Tanggal Order'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{formatDate(activePo.order_date)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Date Received' : 'Tanggal Diterima'}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 mt-0.5 block font-mono">{activePo.received_at ? formatDate(activePo.received_at) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Term' : 'Termin'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block uppercase">{activePo.terms}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Pemasok (Supplier) */}
              <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="bg-amber-50 border-b border-amber-100 px-3.5 py-2">
                  <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                    {lang === 'en' ? 'Supplier' : 'Pemasok (Supplier)'}
                  </h3>
                </div>
                <div className="space-y-3.5 p-3.5 text-xs text-slate-600">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Supplier Name' : 'Nama Supplier'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-850 mt-0.5 block">{activePo.supplier?.nama}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Supplier Address' : 'Alamat Pemasok'}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 mt-0.5 block leading-normal">
                      {activePo.supplier?.alamat || (lang === 'en' ? 'Address not listed' : 'Alamat tidak dicantumkan')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Supplier Code' : 'Kode Supplier'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activePo.supplier?.kode || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Daftar Barang */}
          <div className="card p-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                {lang === 'en' ? 'List of Received Items' : 'Daftar Barang yang Diterima'}
              </h3>
            </div>
            <div className="p-4">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3 w-32 text-center">{lang === 'en' ? 'Code' : 'Kode'}</th>
                      <th className="p-3">{lang === 'en' ? 'Product Name' : 'Nama Barang'}</th>
                      <th className="p-3 text-center w-24">Qty</th>
                      <th className="p-3 text-right w-36">{lang === 'en' ? 'Purchase Price' : 'Harga Beli'}</th>
                      <th className="p-3 text-right w-40">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activePo.purchase_items.map((item: any, idx: number) => (
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
                        <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(Number(item.qty) * Number(item.harga_beli))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-end gap-2 text-xs">
                  <div className="flex gap-6 items-center">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      {lang === 'en' ? 'Total Incoming Goods' : 'Total Barang Masuk'}
                    </span>
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
                setActivePo(null);
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
    </div>
  );
};
