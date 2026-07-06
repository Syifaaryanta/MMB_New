import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Search,
  ChevronRight,
  X,
  Undo2,
  ArrowRightLeft
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

  const [returns, setReturns] = useState<UnifiedReturn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTableFocused, setIsTableFocused] = useState(false);

  // Active Detail Modal State
  const [activeReturn, setActiveReturn] = useState<UnifiedReturn | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listTableRef = useRef<HTMLTableElement>(null);

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
    fetchReturns();
  }, [fromDate, toDate]);

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
    if (isTableFocused && !isDetailOpen && filteredReturns.length > 0) {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, filteredReturns.length - 1));
    }
  }, { enableOnFormTags: false }, [isTableFocused, isDetailOpen, filteredReturns]);

  useHotkeys('up', (e) => {
    if (isTableFocused && !isDetailOpen && filteredReturns.length > 0) {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    }
  }, { enableOnFormTags: false }, [isTableFocused, isDetailOpen, filteredReturns]);

  useHotkeys('enter', (e) => {
    if (isTableFocused && !isDetailOpen && filteredReturns[selectedIdx]) {
      e.preventDefault();
      handleOpenDetail(filteredReturns[selectedIdx]);
    }
  }, { enableOnFormTags: false }, [isTableFocused, isDetailOpen, filteredReturns, selectedIdx]);

  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (isDetailOpen) {
      setIsDetailOpen(false);
    } else if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
    } else {
      navigate('/history');
    }
  }, { enableOnFormTags: true }, [isTableFocused, isDetailOpen]);

  // Shortcut to focus search (F1)
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (!isDetailOpen) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true }, [isDetailOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredReturns.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        searchInputRef.current?.blur();
      }
    }
  };

  const handleOpenDetail = (ret: UnifiedReturn) => {
    setActiveReturn(ret);
    setIsDetailOpen(true);
  };

  const getMetodeLabel = (m: string, type: 'purchase' | 'sale') => {
    if (m === 'potong_hutang') return 'Potong Hutang';
    if (m === 'potong_piutang') return 'Potong Piutang';
    if (m === 'tukar_barang') return 'Tukar Barang';
    if (m === 'refund_tunai') return 'Refund Tunai';
    return m;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span>Histori Transaksi</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Histori Return</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-950 mt-1 flex items-center gap-2">
            <ArrowRightLeft className="text-rose-500" size={24} />
            Histori Return (PO & SO Return)
          </h1>
          <p className="text-slate-550 text-xs mt-1">
            Menampilkan gabungan catatan retur pembelian (Supplier) dan retur penjualan (Customer).
          </p>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari no retur, PO/SO asal, nama supplier/customer, nama barang..."
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
            <span className="text-slate-400 text-xs font-semibold">s/d</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field py-1.5 px-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white w-full"
            />
          </div>

          {/* Type filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="input-field w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
            >
              <option value="all">Semua Jenis Retur (PO & SO)</option>
              <option value="purchase">Retur Pembelian (PO)</option>
              <option value="sale">Retur Penjualan (SO)</option>
            </select>
          </div>
        </div>

        {/* Keyboard hints info panel */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-550 border-t pt-3">
          <div className="flex items-center gap-2">
            <span className="bg-slate-100 border px-1.5 py-0.5 rounded text-slate-700 font-bold">F1</span>
            <span>Focus Cari</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="bg-slate-100 border px-1.5 py-0.5 rounded text-slate-700 font-bold">Esc</span>
            <span>Kembali ke Menu Histori</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Gunakan</span>
            <kbd className="bg-slate-100 border px-1 rounded text-slate-700 font-bold">↑</kbd>
            <kbd className="bg-slate-100 border px-1 rounded text-slate-700 font-bold">↓</kbd>
            <span>navigasi baris tabel,</span>
            <kbd className="bg-slate-100 border px-1 rounded text-slate-700 font-bold">Enter</kbd>
            <span>buka detail.</span>
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
                  <th className="p-4 w-32">Jenis Retur</th>
                  <th className="p-4">No Retur</th>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">No PO/SO Asal</th>
                  <th className="p-4">Supplier/Customer</th>
                  <th className="p-4">Kompensasi</th>
                  <th className="p-4 text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((ret, idx) => {
                  const isFocused = idx === selectedIdx && isTableFocused;
                  const rowClass = isFocused
                    ? 'bg-rose-50/50 border-l-4 border-rose-500 font-bold'
                    : 'hover:bg-slate-50/50 transition-colors';

                  return (
                    <tr
                      key={ret.id}
                      onClick={() => {
                        setSelectedIdx(idx);
                        setIsTableFocused(true);
                      }}
                      onDoubleClick={() => handleOpenDetail(ret)}
                      className={`cursor-pointer ${rowClass}`}
                    >
                      <td className="p-4 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          ret.type === 'purchase'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}>
                          {ret.type === 'purchase' ? 'Pembelian PO' : 'Penjualan SO'}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800">{ret.no_retur}</td>
                      <td className="p-4 text-slate-600">{formatDate(ret.retur_date)}</td>
                      <td className="p-4 font-mono text-slate-700">{ret.no_order}</td>
                      <td className="p-4 text-slate-900 font-semibold">{ret.party_nama}</td>
                      <td className="p-4">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          ret.metode_kompensasi.includes('hutang') || ret.metode_kompensasi.includes('piutang')
                            ? 'bg-amber-100 text-amber-800'
                            : ret.metode_kompensasi === 'tukar_barang'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {getMetodeLabel(ret.metode_kompensasi, ret.type)}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(ret.total)}</td>
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
          <h3 className="text-lg font-bold text-slate-700">Tidak Ada Data Retur</h3>
          <p className="text-slate-400 text-sm mt-1">
            Tidak ditemukan transaksi retur dalam rentang tanggal dan kriteria filter saat ini.
          </p>
        </div>
      )}

      {/* DETAIL MODAL POPUP */}
      {isDetailOpen && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsDetailOpen(false)} />

          <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-scale-in z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase font-mono tracking-wider ${
                  activeReturn.type === 'purchase' ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  Detail Retur {activeReturn.type === 'purchase' ? 'Pembelian PO' : 'Penjualan SO'}
                </span>
                <h2 className="text-base font-bold text-slate-800 mt-1 flex items-center gap-2 font-mono">
                  {activeReturn.no_retur}
                </h2>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Nomor Transaksi Asal</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5 font-mono">{activeReturn.no_order}</p>
                </div>
                {activeReturn.no_faktur && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Nomor Faktur</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 font-mono">{activeReturn.no_faktur}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Tanggal Retur</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{formatDate(activeReturn.retur_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Metode Kompensasi</p>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-0.5 ${
                    activeReturn.type === 'purchase' ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {getMetodeLabel(activeReturn.metode_kompensasi, activeReturn.type)}
                  </span>
                </div>
                <div className="col-span-2 md:col-span-4 border-t pt-3 mt-1">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">
                    {activeReturn.type === 'purchase' ? 'Nama Supplier' : 'Nama Customer'}
                  </p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{activeReturn.party_nama}</p>
                </div>
                {activeReturn.catatan && (
                  <div className="col-span-2 md:col-span-4 border-t pt-3 mt-1">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Catatan / Alasan</p>
                    <p className="text-xs text-slate-655 mt-0.5 whitespace-pre-wrap leading-relaxed">
                      {activeReturn.catatan}
                    </p>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3">Kode</th>
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3 text-center">Jumlah Retur</th>
                      <th className="p-3 text-center">Kondisi</th>
                      <th className="p-3 text-right">Harga Satuan</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeReturn.items?.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 text-slate-500 font-mono">{item.product_kode}</td>
                        <td className="p-3 font-semibold text-slate-850">{item.product_nama}</td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {Number(item.qty)} {item.product?.satuan || 'pcs'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            item.kondisi === 'bagus' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {item.kondisi}
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-600">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Nilai Retur</span>
                <p className={`text-base font-extrabold ${
                  activeReturn.type === 'purchase' ? 'text-red-600' : 'text-indigo-600'
                }`}>{formatCurrency(activeReturn.total)}</p>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-1.5 text-xs font-bold bg-slate-850 text-white rounded-lg hover:bg-slate-700 transition-colors shadow"
              >
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
