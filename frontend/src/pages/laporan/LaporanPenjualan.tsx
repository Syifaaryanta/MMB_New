import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { exportStyledExcel } from '@/lib/excelHelper';
import { 
  TrendingUp, 
  Search, 
  Calendar, 
  Download, 
  ArrowLeft, 
  ChevronRight,
  ChevronDown,
  DollarSign,
  FileText
} from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
  alamat?: string | null;
}

interface SaleItem {
  id: string;
  product_kode: string;
  product_nama: string;
  qty: number;
  unit_price: number;
  total: number;
}

interface Sale {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  customer_nama: string;
  customer_alamat?: string | null;
  subtotal: number;
  diantar: boolean;
  limit_bulan: number;
  sale_items: SaleItem[];
  customer: Customer;
  sales_payments: Array<{ amount: number }>;
}

export const LaporanPenjualan: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [sales, setSales] = useState<Sale[]>([]);
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
  const [customerSearch, setCustomerSearch] = useState('');

  // Expandable invoice details
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

  // Keyboard navigation & table focus
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const fromDateMainRef = useRef<HTMLInputElement>(null);
  const toDateMainRef = useRef<HTMLInputElement>(null);
  const customerMainSearchRef = useRef<HTMLInputElement>(null);
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);

  const fetchSalesData = async () => {
    setIsLoading(true);
    try {
      const url = `/laporan/penjualan-detail?from=${fromDate}&to=${toDate}`;
      const res = await api.get(url);
      const data = res.data || [];
      setSales(data);
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
      fetchSalesData();
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

  const filteredSales = sales.filter((sale) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      sale.customer_nama.toLowerCase().includes(q) ||
      (sale.customer?.kode && sale.customer.kode.toLowerCase().includes(q))
    );
  });

  const totalSalesVal = filteredSales.reduce((acc, s) => acc + Number(s.subtotal), 0);
  const totalTransCount = filteredSales.length;

  useEffect(() => {
    setSelectedIdx(0);
  }, [sales, customerSearch]);

  // Shortcuts
  // F1: Focus Date Filter
  useHotkeys('f1', (e) => {
    e.preventDefault();
    fromDateMainRef.current?.focus();
    fromDateMainRef.current?.select();
    setIsTableFocused(false);
  }, { enableOnFormTags: true });

  // F2: Focus Customer Search
  useHotkeys('f2', (e) => {
    e.preventDefault();
    customerMainSearchRef.current?.focus();
    customerMainSearchRef.current?.select();
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
    if (!isTableFocused || filteredSales.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(prev + 1, filteredSales.length - 1));
  }, { enableOnFormTags: false }, [isTableFocused, filteredSales]);

  useHotkeys('up', (e) => {
    if (!isTableFocused || filteredSales.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(prev - 1, 0));
  }, { enableOnFormTags: false }, [isTableFocused, filteredSales]);

  useHotkeys('enter', (e) => {
    if (!isTableFocused || filteredSales.length === 0) return;
    e.preventDefault();
    const activeSale = filteredSales[selectedIdx];
    if (activeSale) {
      setExpandedInvoiceIds(prev => (prev[activeSale.id] ? {} : { [activeSale.id]: true }));
    }
  }, { enableOnFormTags: false }, [isTableFocused, filteredSales, selectedIdx]);

  // Scroll focused row into view
  useEffect(() => {
    const target = rowRefs.current[selectedIdx];
    if (target && isTableFocused) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx, isTableFocused]);

  const exportToExcel = () => {
    if (filteredSales.length === 0) return;
    const excelRows = filteredSales.map((sale) => {
      const totalPaid = sale.sales_payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const sisaPiutang = Number(sale.subtotal) - totalPaid;
      return {
        [lang === 'en' ? 'Invoice No.' : 'No. Faktur']: sale.no_faktur || sale.no_order,
        [lang === 'en' ? 'Sales Date' : 'Tanggal Jual']: formatDate(sale.order_date),
        [lang === 'en' ? 'Customer Name' : 'Nama Pelanggan']: sale.customer_nama,
        [lang === 'en' ? 'Payment Method' : 'Jenis Pembayaran']: sale.limit_bulan > 0 ? (lang === 'en' ? `Credit (${sale.limit_bulan + 1} Months)` : `Kredit (${sale.limit_bulan + 1} Bulan)`) : (lang === 'en' ? 'Cash' : 'Tunai'),
        [lang === 'en' ? 'Invoice Total' : 'Total Invoice']: Number(sale.subtotal),
        [lang === 'en' ? 'Total Paid' : 'Total Terbayar']: totalPaid,
        [lang === 'en' ? 'Remaining Receivable' : 'Sisa Piutang']: sisaPiutang,
      };
    });

    exportStyledExcel(
      excelRows,
      `Laporan_Penjualan_Detail_${fromDate}_to_${toDate}.xlsx`,
      lang === 'en' ? 'Sales Details Report' : 'Laporan Detail Penjualan',
      [],
      [
        lang === 'en' ? 'Invoice No.' : 'No. Faktur',
        lang === 'en' ? 'Sales Date' : 'Tanggal Jual',
        lang === 'en' ? 'Payment Method' : 'Jenis Pembayaran'
      ],
      [
        lang === 'en' ? 'Invoice Total' : 'Total Invoice',
        lang === 'en' ? 'Total Paid' : 'Total Terbayar',
        lang === 'en' ? 'Remaining Receivable' : 'Sisa Piutang'
      ]
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
              {lang === 'en' ? 'Sales Details Report' : 'Laporan Penjualan Detail'}
            </h1>
            <p className="text-slate-550 text-xs mt-1">
              {lang === 'en'
                ? 'Log of sold items transaction, total revenue, and outstanding billing.'
                : 'Log transaksi barang terjual, nominal omzet, dan sisa penagihan.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-855 overflow-hidden">
            <div className="bg-primary-600 text-white px-6 py-4 text-center border-b border-primary-700/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {lang === 'en' ? 'Sales Report Filter' : 'Filter Laporan Penjualan'}
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
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), customerSearchRef.current?.focus())}
                    className="input-field w-full py-2 text-xs text-slate-800 border border-slate-350 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-505 mb-1.5 uppercase">
                  {lang === 'en' ? 'Customer Name / Code' : 'Nama / Kode Pelanggan'}
                </label>
                <input
                  ref={customerSearchRef}
                  type="text"
                  placeholder={lang === 'en' ? 'All / Type Name or Code' : 'Semua / Ketik Nama atau Kode'}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
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
            {lang === 'en' ? 'Sales Details Report' : 'Laporan Penjualan Detail'}
          </h1>
          <p className="text-slate-550 text-xs mt-1">
            {lang === 'en'
              ? 'Log of sold items transaction, total revenue, and outstanding billing.'
              : 'Log transaksi barang terjual, nominal omzet, dan sisa penagihan.'}
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={filteredSales.length === 0}
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">
              {lang === 'en' ? 'Total Sales Revenue' : 'Total Omzet Terjual'}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">{formatCurrency(totalSalesVal)}</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-indigo-500">
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">
              {lang === 'en' ? 'Total Successful Transactions' : 'Banyak Transaksi Sukses'}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">
              {totalTransCount} {lang === 'en' ? 'Invoices' : 'Nota'}
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
            <TrendingUp size={20} />
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
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), customerMainSearchRef.current?.focus())}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Customer Search Bar */}
        <div>
          <label className="block text-[10px] text-slate-550 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Search Customer (F2)' : 'Cari Pelanggan (F2)'}
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={customerMainSearchRef}
              type="text"
              placeholder={lang === 'en' ? 'Type name / code...' : 'Ketik nama / kode...'}
              value={customerSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredSales.length > 0) {
                    setIsTableFocused(true);
                    setSelectedIdx(0);
                    customerMainSearchRef.current?.blur();
                  }
                }
              }}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-855"
            />
          </div>
        </div>

        {/* Info */}
        <div className="text-left md:text-right flex flex-col justify-end text-[10px] text-slate-500 leading-relaxed font-semibold">
          <p>
            {lang === 'en'
              ? 'Select date range or specific customer to filter logs.'
              : 'Pilih range tanggal atau pelanggan tertentu untuk menyaring log.'}
          </p>
          <p className="mt-0.5 font-semibold text-slate-400">
            {lang === 'en'
              ? 'Shortcuts: F1 date filter, F2 search customer, F10 export Excel.'
              : 'Pintasan: F1 filter tanggal, F2 cari pelanggan, F10 ekspor Excel.'}
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
              <th className="p-3">{lang === 'en' ? 'Invoice No.' : 'No. Faktur'}</th>
              <th className="p-3">{lang === 'en' ? 'Sales Date' : 'Tanggal Jual'}</th>
              <th className="p-3">{lang === 'en' ? 'Customer Name' : 'Nama Pelanggan'}</th>
              <th className="p-3 text-center">{lang === 'en' ? 'Pay Type' : 'Jenis Bayar'}</th>
              <th className="p-3 text-right">{lang === 'en' ? 'Paid' : 'Terbayar'}</th>
              <th className="p-3 text-right">{lang === 'en' ? 'Remaining' : 'Sisa Piutang'}</th>
              <th className="p-3 text-right">{lang === 'en' ? 'Amount' : 'Nilai Belanja'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  {lang === 'en' ? 'Fetching sales detail logs...' : 'Sedang mengambil log penjualan detail...'}
                </td>
              </tr>
            ) : filteredSales.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  {lang === 'en'
                    ? 'No sales transactions detected in this filter period.'
                    : 'Tidak ada transaksi penjualan terdeteksi pada periode filter ini.'}
                </td>
              </tr>
            ) : (
              filteredSales.map((sale, idx) => {
                const isExpanded = !!expandedInvoiceIds[sale.id];
                const totalPaid = sale.sales_payments.reduce((acc, p) => acc + Number(p.amount), 0);
                const sisaPiutang = Number(sale.subtotal) - totalPaid;
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
                  <React.Fragment key={sale.id}>
                    {/* Header Row */}
                    <tr 
                      ref={(el) => { rowRefs.current[idx] = el; }}
                      onClick={() => {
                        setIsTableFocused(true);
                        setSelectedIdx(idx);
                        setExpandedInvoiceIds(prev => (prev[sale.id] ? {} : { [sale.id]: true }));
                      }}
                      className="hover:bg-slate-50/50 cursor-pointer"
                    >
                      <td className={getTdClass('first') + " text-center text-slate-400"}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className={getTdClass('middle') + " font-mono font-bold"}>
                        {sale.no_faktur || sale.no_order}
                      </td>
                      <td className={getTdClass('middle')}>{formatDate(sale.order_date)}</td>
                      <td className={getTdClass('middle')}>
                        <div className="font-bold">{sale.customer_nama}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5 max-w-xs truncate">
                          {sale.customer?.alamat || sale.customer_alamat || '-'}
                        </div>
                      </td>
                      <td className={getTdClass('middle') + " text-center"}>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          sale.limit_bulan > 0 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {sale.limit_bulan > 0 
                            ? (lang === 'en' ? `Credit (${sale.limit_bulan + 1} Mos)` : `Kredit (${sale.limit_bulan + 1} Bln)`) 
                            : (lang === 'en' ? 'Cash' : 'Tunai')}
                        </span>
                      </td>
                      <td className={getTdClass('middle') + " text-right font-mono text-emerald-600 font-semibold"}>{formatCurrency(totalPaid)}</td>
                      <td className={getTdClass('middle') + ` text-right font-mono ${sisaPiutang > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                        {formatCurrency(sisaPiutang)}
                      </td>
                      <td className={getTdClass('last') + " text-right font-mono font-bold text-slate-900"}>
                        {formatCurrency(Number(sale.subtotal))}
                      </td>
                    </tr>

                    {/* Expanded Detail Rows */}
                    {isExpanded && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={8} className="py-3 px-3 border-t border-b border-slate-200">
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                              <FileText size={12} className="text-primary-600" />
                              <span>{lang === 'en' ? 'Items Details & Purchased Quantities' : 'Rincian Barang & Kuantitas Belanja'}</span>
                            </div>

                            <div className="border border-slate-200 rounded-lg overflow-hidden max-w-4xl bg-white shadow-xs">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[9px]">
                                    <th className="p-2 w-8 text-center">No</th>
                                    <th className="p-2">{lang === 'en' ? 'SKU Code' : 'Kode SKU'}</th>
                                    <th className="p-2">{lang === 'en' ? 'Product Name' : 'Nama Produk'}</th>
                                    <th className="p-2 text-right w-20">{lang === 'en' ? 'Quantity' : 'Kuantitas'}</th>
                                    <th className="p-2 text-right w-28">{lang === 'en' ? 'Unit Price' : 'Harga Jual'}</th>
                                    <th className="p-2 text-right w-28">{lang === 'en' ? 'Subtotal' : 'Subtotal'}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {sale.sale_items?.map((item, itemIdx) => (
                                    <tr key={item.id} className="hover:bg-slate-50/40">
                                      <td className="p-2 text-center text-slate-400">{itemIdx + 1}</td>
                                      <td className="p-2 font-mono text-slate-555">{item.product_kode}</td>
                                      <td className="p-2 font-bold text-slate-900">{item.product_nama}</td>
                                      <td className="p-2 text-right font-semibold text-slate-800">{Number(item.qty)}</td>
                                      <td className="p-2 text-right font-mono text-slate-600">{formatCurrency(Number(item.unit_price))}</td>
                                      <td className="p-2 text-right font-mono text-slate-900 font-bold">{formatCurrency(Number(item.total))}</td>
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
