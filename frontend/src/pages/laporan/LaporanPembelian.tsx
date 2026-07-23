import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { exportStyledExcel } from '@/lib/excelHelper';
import { 
  ShoppingBag, 
  Calendar, 
  Download, 
  ArrowLeft, 
  ChevronRight,
  ChevronDown,
  DollarSign,
  FileText,
  Search
} from 'lucide-react';

interface Supplier {
  id: string;
  kode: string;
  nama: string;
  alamat?: string | null;
}

interface PurchaseItem {
  id: string;
  qty: number;
  harga_beli: number;
  subtotal: number;
  product?: {
    kode: string;
    nama: string;
  };
}

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  terms: string;
  status: string;
  received_at: string | null;
  subtotal: number;
  supplier: Supplier;
  purchase_items: PurchaseItem[];
}

export const LaporanPembelian: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter popup page visibility
  const [showFilterPage, setShowFilterPage] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierSearch, setSupplierSearch] = useState('');

  // Expandable invoice details
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

  // Keyboard navigation & table focus
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const fromDateMainRef = useRef<HTMLInputElement>(null);
  const toDateMainRef = useRef<HTMLInputElement>(null);
  const supplierMainSearchRef = useRef<HTMLInputElement>(null);
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const supplierSearchRef = useRef<HTMLInputElement>(null);

  const fetchPurchasesData = async () => {
    setIsLoading(true);
    try {
      const url = `/laporan/pembelian-detail?from=${fromDate}&to=${toDate}`;
      const res = await api.get(url);
      const data = res.data || [];
      setPurchases(data);
      setIsTableFocused(true);
      setSelectedIdx(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!showFilterPage) {
      fetchPurchasesData();
    }
  }, [fromDate, toDate, showFilterPage]);

  useEffect(() => {
    if (showFilterPage) {
      setTimeout(() => {
        fromDateRef.current?.focus();
        fromDateRef.current?.select();
      }, 150);
    }
  }, [showFilterPage]);

  const filteredPurchases = purchases.filter((purchase) => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (purchase.supplier?.nama && purchase.supplier.nama.toLowerCase().includes(q)) ||
      (purchase.supplier?.kode && purchase.supplier.kode.toLowerCase().includes(q))
    );
  });

  const totalPurchasesVal = filteredPurchases.reduce((acc, p) => acc + Number(p.subtotal), 0);
  const totalTransCount = filteredPurchases.length;

  useEffect(() => {
    setSelectedIdx(0);
  }, [purchases, supplierSearch]);

  // Shortcuts
  // F1: Focus Date Filter
  useHotkeys('f1', (e) => {
    e.preventDefault();
    fromDateMainRef.current?.focus();
    fromDateMainRef.current?.select();
    setIsTableFocused(false);
  }, { enableOnFormTags: true });

  // F2: Focus Supplier Search
  useHotkeys('f2', (e) => {
    e.preventDefault();
    supplierMainSearchRef.current?.focus();
    supplierMainSearchRef.current?.select();
    setIsTableFocused(false);
  }, { enableOnFormTags: true });

  // F10: Export Excel
  useHotkeys('f10', (e) => {
    e.preventDefault();
    exportToExcel();
  }, { enableOnFormTags: false });

  // Escape: Return to menu
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/laporan');
  }, { enableOnFormTags: true });

  // Keyboard Table Navigation
  useHotkeys('down', (e) => {
    if (!isTableFocused || filteredPurchases.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(prev + 1, filteredPurchases.length - 1));
  }, { enableOnFormTags: false }, [isTableFocused, filteredPurchases]);

  useHotkeys('up', (e) => {
    if (!isTableFocused || filteredPurchases.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(prev - 1, 0));
  }, { enableOnFormTags: false }, [isTableFocused, filteredPurchases]);

  useHotkeys('enter', (e) => {
    if (!isTableFocused || filteredPurchases.length === 0) return;
    e.preventDefault();
    const activePurchase = filteredPurchases[selectedIdx];
    if (activePurchase) {
      setExpandedInvoiceIds(prev => (prev[activePurchase.id] ? {} : { [activePurchase.id]: true }));
    }
  }, { enableOnFormTags: false }, [isTableFocused, filteredPurchases, selectedIdx]);

  // Scroll focused row into view
  useEffect(() => {
    const target = rowRefs.current[selectedIdx];
    if (target && isTableFocused) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx, isTableFocused]);

  const exportToExcel = () => {
    if (filteredPurchases.length === 0) return;
    const excelRows = filteredPurchases.map((p) => {
      return {
        [lang === 'en' ? 'PO Order No.' : 'No. Order PO']: p.no_order,
        [lang === 'en' ? 'Order Date' : 'Tanggal Order']: formatDate(p.order_date),
        [lang === 'en' ? 'Supplier Name' : 'Nama Supplier']: p.supplier?.nama || '-',
        [lang === 'en' ? 'Term' : 'Termin']: p.terms === 'tunai' ? (lang === 'en' ? 'Cash' : 'Tunai') : `${p.terms} ${lang === 'en' ? 'Months' : 'Bulan'}`,
        [lang === 'en' ? 'Status' : 'Status']: p.status,
        [lang === 'en' ? 'Received Date' : 'Tanggal Diterima']: p.received_at ? formatDate(p.received_at) : '-',
        [lang === 'en' ? 'Transaction Value' : 'Nilai Transaksi']: Number(p.subtotal),
      };
    });

    exportStyledExcel(
      excelRows,
      `Laporan_Pembelian_Detail_${fromDate}_to_${toDate}.xlsx`,
      lang === 'en' ? 'Purchase Details Report' : 'Laporan Detail Pembelian',
      [],
      [
        lang === 'en' ? 'PO Order No.' : 'No. Order PO',
        lang === 'en' ? 'Order Date' : 'Tanggal Order',
        lang === 'en' ? 'Term' : 'Termin',
        lang === 'en' ? 'Status' : 'Status',
        lang === 'en' ? 'Received Date' : 'Tanggal Diterima'
      ],
      [lang === 'en' ? 'Transaction Value' : 'Nilai Transaksi']
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleFilterEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (purchases.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.blur();
        }
      }
    }
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowFilterPage(false);
  };

  if (showFilterPage) {
    return (
      <div className="space-y-6 text-slate-800 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button 
              onClick={() => navigate('/laporan')}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 transition-colors font-semibold focus:outline-none"
            >
              <ArrowLeft size={12} /> {lang === 'en' ? 'Back to Menu (Esc)' : 'Kembali ke Menu (Esc)'}
            </button>
            <h1 className="text-2xl font-extrabold text-slate-950">
              {lang === 'en' ? 'Purchase Details Report' : 'Laporan Pembelian Detail'}
            </h1>
            <p className="text-slate-550 text-xs mt-1">
              {lang === 'en'
                ? 'Summary of incoming goods purchase transactions from suppliers.'
                : 'Rekapitulasi transaksi pembelian barang masuk dari supplier.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-855 overflow-hidden">
            <div className="bg-primary-600 text-white px-6 py-4 text-center border-b border-primary-700/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {lang === 'en' ? 'Purchase Report Filter' : 'Filter Laporan Pembelian'}
              </h3>
            </div>

            <form onSubmit={handleFilterSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1.5 uppercase">
                    {lang === 'en' ? 'Start Date' : 'Tanggal Awal'}
                  </label>
                  <input
                    ref={fromDateRef}
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toDateRef.current?.focus())}
                    className="input-field w-full py-2 text-xs text-slate-800 border border-slate-350 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1.5 uppercase">
                    {lang === 'en' ? 'End Date' : 'Tanggal Akhir'}
                  </label>
                  <input
                    ref={toDateRef}
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), supplierSearchRef.current?.focus())}
                    className="input-field w-full py-2 text-xs text-slate-800 border border-slate-350 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-505 mb-1.5 uppercase">
                  {lang === 'en' ? 'Supplier Name / Code' : 'Nama / Kode Supplier'}
                </label>
                <input
                  ref={supplierSearchRef}
                  type="text"
                  placeholder={lang === 'en' ? 'All / Type Name or Code' : 'Semua / Ketik Nama atau Kode'}
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFilterSubmit(e))}
                  className="input-field w-full py-2 text-xs text-slate-800 border border-slate-350 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/laporan')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-650 text-xs font-bold hover:bg-slate-50 transition-all bg-white"
                >
                  {lang === 'en' ? 'Back' : 'Kembali'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-550 transition-all shadow-md shadow-primary-500/10"
                >
                  {lang === 'en' ? 'Show Report (Enter)' : 'Tampilkan Laporan (Enter)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/laporan')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 transition-colors font-semibold focus:outline-none"
          >
            <ArrowLeft size={12} /> {lang === 'en' ? 'Back to Menu (Esc)' : 'Kembali ke Menu (Esc)'}
          </button>
          <h1 className="text-2xl font-extrabold text-slate-950">
            {lang === 'en' ? 'Purchase Details Report' : 'Laporan Pembelian Detail'}
          </h1>
          <p className="text-slate-550 text-xs mt-1">
            {lang === 'en'
              ? 'Summary of incoming goods purchase transactions from suppliers.'
              : 'Rekapitulasi transaksi pembelian barang masuk dari supplier.'}
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={filteredPurchases.length === 0}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>{lang === 'en' ? 'Export Excel (F10)' : 'Ekspor Excel (F10)'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-indigo-500">
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">
              {lang === 'en' ? 'Total Purchase Expenditure' : 'Total Pengeluaran Beli'}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">{formatCurrency(totalPurchasesVal)}</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">
              {lang === 'en' ? 'Total PO Transactions' : 'Banyak Transaksi PO'}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">
              {totalTransCount} {lang === 'en' ? 'PO Invoices' : 'Nota'}
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl">
            <ShoppingBag size={20} />
          </div>
        </div>
      </div>

      {/* Filter Board */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Date From */}
        <div>
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Start Date (F1)' : 'Tanggal Awal (F1)'}
          </label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={fromDateMainRef}
              type="date"
              value={fromDate}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toDateMainRef.current?.focus())}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'End Date' : 'Tanggal Akhir'}
          </label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={toDateMainRef}
              type="date"
              value={toDate}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), supplierMainSearchRef.current?.focus())}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Supplier Search Bar */}
        <div>
          <label className="block text-[10px] text-slate-550 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Search Supplier (F2)' : 'Cari Supplier (F2)'}
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={supplierMainSearchRef}
              type="text"
              placeholder={lang === 'en' ? 'Type name / code...' : 'Ketik nama / kode...'}
              value={supplierSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredPurchases.length > 0) {
                    setIsTableFocused(true);
                    setSelectedIdx(0);
                    supplierMainSearchRef.current?.blur();
                  }
                }
              }}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-855"
            />
          </div>
        </div>

        {/* Info */}
        <div className="text-left md:text-right flex flex-col justify-end text-[10px] text-slate-500 leading-relaxed font-semibold">
          <p>
            {lang === 'en'
              ? 'Filter PO history based on supplier and date filters.'
              : 'Saring riwayat PO berdasarkan pemasok dan filter tanggal.'}
          </p>
          <p className="mt-0.5 font-semibold text-slate-400">
            {lang === 'en'
              ? 'Shortcuts: F1 date filter, F2 search supplier, F10 export Excel.'
              : 'Pintasan: F1 filter tanggal, F2 cari supplier, F10 ekspor Excel.'}
          </p>
        </div>
      </div>

      {/* Main Data Table */}
      <div 
        className={`bg-white rounded-xl border shadow-xs overflow-hidden transition-all ${
          isTableFocused ? 'ring-2 ring-primary-500/20 border-primary-300' : 'border-slate-200'
        }`}
        onClick={() => setIsTableFocused(true)}
      >
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-3 w-12 text-center">{lang === 'en' ? 'Detail' : 'Detail'}</th>
              <th className="p-3">{lang === 'en' ? 'PO Order No.' : 'No. Order PO'}</th>
              <th className="p-3">{lang === 'en' ? 'Order Date' : 'Tanggal Order'}</th>
              <th className="p-3">{lang === 'en' ? 'Supplier Name' : 'Nama Supplier'}</th>
              <th className="p-3 text-center">{lang === 'en' ? 'Term' : 'Termin'}</th>
              <th className="p-3 text-center">{lang === 'en' ? 'Status' : 'Status'}</th>
              <th className="p-3">{lang === 'en' ? 'Received Date' : 'Tgl Terima'}</th>
              <th className="p-3 text-right">{lang === 'en' ? 'Purchase Value' : 'Nilai Pembelian'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  {lang === 'en' ? 'Fetching purchase detail logs...' : 'Sedang mengambil log pembelian detail...'}
                </td>
              </tr>
            ) : filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  {lang === 'en'
                    ? 'No purchase transactions detected in this filter period.'
                    : 'Tidak ada transaksi pembelian terdeteksi pada periode filter ini.'}
                </td>
              </tr>
            ) : (
              filteredPurchases.map((purchase, idx) => {
                const isExpanded = !!expandedInvoiceIds[purchase.id];
                const isSelected = isTableFocused && selectedIdx === idx;

                const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                  let base = 'p-3 text-xs align-middle transition-colors ';
                  if (isSelected) {
                    base += 'bg-blue-100 text-primary-950 font-bold ';
                    if (pos === 'first') {
                      base += 'border-l-4 border-primary-600 ';
                    }
                  } else {
                    base += 'text-slate-700 border-b border-slate-100 ';
                  }
                  return base;
                };

                return (
                  <React.Fragment key={purchase.id}>
                    {/* Header Row */}
                    <tr 
                      ref={(el) => { rowRefs.current[idx] = el; }}
                      onClick={() => {
                        setIsTableFocused(true);
                        setSelectedIdx(idx);
                        setExpandedInvoiceIds(prev => (prev[purchase.id] ? {} : { [purchase.id]: true }));
                      }}
                      className="hover:bg-slate-50/50 cursor-pointer"
                    >
                      <td className={getTdClass('first') + " text-center text-slate-400"}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className={getTdClass('middle') + " font-mono font-bold"}>
                        {purchase.no_order}
                      </td>
                      <td className={getTdClass('middle')}>{formatDate(purchase.order_date)}</td>
                      <td className={getTdClass('middle')}>
                        <div className="font-bold">{purchase.supplier?.nama || '-'}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5 max-w-xs truncate">
                          {purchase.supplier?.alamat || '-'}
                        </div>
                      </td>
                      <td className={getTdClass('middle') + " text-center font-semibold capitalize text-slate-500"}>
                        {purchase.terms === 'tunai' ? (lang === 'en' ? 'Cash' : 'Tunai') : `${purchase.terms} ${lang === 'en' ? 'Months' : 'Bln'}`}
                      </td>
                      <td className={getTdClass('middle') + " text-center"}>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          purchase.status === 'received' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        }`}>
                          {purchase.status}
                        </span>
                      </td>
                      <td className={getTdClass('middle') + " text-slate-500"}>{purchase.received_at ? formatDate(purchase.received_at) : '-'}</td>
                      <td className={getTdClass('last') + " text-right font-mono font-bold text-slate-900"}>
                        {formatCurrency(Number(purchase.subtotal))}
                      </td>
                    </tr>

                    {/* Expanded Detail Rows */}
                    {isExpanded && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={8} className="py-3 px-3 border-t border-b border-slate-200">
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                              <FileText size={12} className="text-primary-600" />
                              <span>{lang === 'en' ? 'Items Details & PO Quantities' : 'Rincian Barang & Kuantitas PO'}</span>
                            </div>

                            <div className="border border-slate-200 rounded-lg overflow-hidden max-w-4xl bg-white shadow-xs">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[9px]">
                                    <th className="p-2 w-8 text-center">No</th>
                                    <th className="p-2">{lang === 'en' ? 'SKU Code' : 'Kode SKU'}</th>
                                    <th className="p-2">{lang === 'en' ? 'Product Name' : 'Nama Produk'}</th>
                                    <th className="p-2 text-right w-20">{lang === 'en' ? 'Quantity' : 'Kuantitas'}</th>
                                    <th className="p-2 text-right w-28">{lang === 'en' ? 'Purchase Price' : 'Harga Beli'}</th>
                                    <th className="p-2 text-right w-28">{lang === 'en' ? 'Subtotal' : 'Subtotal'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {purchase.purchase_items?.map((item, itemIdx) => (
                                    <tr key={item.id} className="hover:bg-slate-50/40">
                                      <td className="p-2 text-center text-slate-400">{itemIdx + 1}</td>
                                      <td className="p-2 font-mono text-slate-555">{item.product?.kode || '-'}</td>
                                      <td className="p-2 font-bold text-slate-900">{item.product?.nama || '-'}</td>
                                      <td className="p-2 text-right font-semibold text-slate-800">{Number(item.qty)}</td>
                                      <td className="p-2 text-right font-mono text-slate-600">{formatCurrency(Number(item.harga_beli))}</td>
                                      <td className="p-2 text-right font-mono text-slate-900 font-bold">{formatCurrency(Number(item.subtotal))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end text-[10px] text-slate-400 mt-2">
        <span>
          {lang === 'en'
            ? 'Use cursor or click table to focus, ↑ ↓ keys to select, Enter for item details.'
            : 'Gunakan kursor atau klik tabel untuk fokus, tombol ↑ ↓ untuk memilih, Enter detail item.'}
        </span>
      </div>
    </div>
  );
};
