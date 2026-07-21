import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { exportStyledExcel } from '@/lib/excelHelper';
import {
  CreditCard,
  Search,
  Download,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Clock
} from 'lucide-react';

interface AgingInvoice {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  due_date: string;
  customer_nama: string;
  subtotal: number;
  paid_amount: number;
  remaining: number;
  days_overdue: number;
  customer: {
    kode: string;
    nama: string;
  };
}

export const LaporanPenagihan: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<AgingInvoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<AgingInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [agingBucketFilter, setAgingBucketFilter] = useState<'all' | 'safe' | '30' | '60' | '90' | '90plus'>('all');

  // Keyboard navigation & table focus
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Aging Summary Totals
  const [bucketTotals, setBucketTotals] = useState({
    safe: 0,     // Belum Jatuh Tempo
    days30: 0,   // 1 - 30 Hari
    days60: 0,   // 31 - 60 Hari
    days90: 0,   // 61 - 90 Hari
    over90: 0,   // > 90 Hari
    total: 0
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const fetchAgingData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/laporan/penagihan-piutang');
      setInvoices(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgingData();
  }, []);

  useEffect(() => {
    // Process aging buckets
    let safe = 0;
    let days30 = 0;
    let days60 = 0;
    let days90 = 0;
    let over90 = 0;
    let total = 0;

    invoices.forEach((inv) => {
      const rem = Number(inv.remaining);
      const days = Number(inv.days_overdue);
      total += rem;

      if (days <= 0) {
        safe += rem;
      } else if (days <= 30) {
        days30 += rem;
      } else if (days <= 60) {
        days60 += rem;
      } else if (days <= 90) {
        days90 += rem;
      } else {
        over90 += rem;
      }
    });

    setBucketTotals({ safe, days30, days60, days90, over90, total });

    // Apply filters
    const q = searchQuery.toLowerCase();
    const filtered = invoices.filter((inv) => {
      const matchesSearch = inv.customer_nama.toLowerCase().includes(q) ||
        (inv.no_faktur || inv.no_order).toLowerCase().includes(q);

      const days = Number(inv.days_overdue);

      if (agingBucketFilter === 'safe') return matchesSearch && days <= 0;
      if (agingBucketFilter === '30') return matchesSearch && days > 0 && days <= 30;
      if (agingBucketFilter === '60') return matchesSearch && days > 30 && days <= 60;
      if (agingBucketFilter === '90') return matchesSearch && days > 60 && days <= 90;
      if (agingBucketFilter === '90plus') return matchesSearch && days > 90;

      return matchesSearch;
    });

    setFilteredInvoices(filtered);
  }, [invoices, searchQuery, agingBucketFilter]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [filteredInvoices]);

  // Shortcuts
  // F1: Focus Search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
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
    if (!isTableFocused || filteredInvoices.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(prev + 1, filteredInvoices.length - 1));
  }, { enableOnFormTags: false }, [isTableFocused, filteredInvoices]);

  useHotkeys('up', (e) => {
    if (!isTableFocused || filteredInvoices.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(prev - 1, 0));
  }, { enableOnFormTags: false }, [isTableFocused, filteredInvoices]);

  // Scroll focused row into view
  useEffect(() => {
    const target = rowRefs.current[selectedIdx];
    if (target && isTableFocused) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx, isTableFocused]);

  const exportToExcel = () => {
    if (invoices.length === 0) return;
    const excelRows = filteredInvoices.map((inv) => {
      const days = Number(inv.days_overdue);
      let statusStr = 'Belum Jatuh Tempo';
      if (days > 90) statusStr = '> 90 Hari Overdue';
      else if (days > 60) statusStr = '61 - 90 Hari Overdue';
      else if (days > 30) statusStr = '31 - 60 Hari Overdue';
      else if (days > 0) statusStr = '1 - 30 Hari Overdue';

      return {
        'No. Faktur': inv.no_faktur || inv.no_order,
        'Nama Pelanggan': inv.customer_nama,
        'Tanggal Faktur': formatDate(inv.order_date),
        'Jatuh Tempo': formatDate(inv.due_date),
        'Terlambat (Hari)': days > 0 ? days : 0,
        'Kategori Umur': statusStr,
        'Total Belanja': Number(inv.subtotal),
        'Terbayar': Number(inv.paid_amount),
        'Sisa Piutang': Number(inv.remaining),
      };
    });

    exportStyledExcel(
      excelRows,
      `Laporan_Aging_Piutang_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Laporan Struktur Umur Piutang (Aging)',
      ['Terlambat (Hari)'],
      ['No. Faktur', 'Tanggal Faktur', 'Jatuh Tempo', 'Kategori Umur'],
      ['Total Belanja', 'Terbayar', 'Sisa Piutang']
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
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getBucketPercent = (val: number) => {
    if (bucketTotals.total === 0) return '0%';
    return `${Math.round((val / bucketTotals.total) * 100)}%`;
  };

  const handleFilterEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredInvoices.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.blur();
        }
      }
    }
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/laporan')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 transition-colors font-semibold focus:outline-none"
          >
            <ArrowLeft size={12} /> Kembali ke Menu (Esc)
          </button>
          <h1 className="text-2xl font-extrabold text-slate-950">Laporan Aging Piutang (AR)</h1>
          <p className="text-slate-550 text-xs mt-1">Analisa struktur umur kredit piutang (Aging Report) dan jatuh tempo pembayaran pelanggan.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button
            onClick={exportToExcel}
            disabled={filteredInvoices.length === 0}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>Ekspor Excel (F10)</span>
          </button>
        </div>
      </div>

      {/* Aging Buckets Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        {/* Bucket Safe */}
        <button
          onClick={() => setAgingBucketFilter(agingBucketFilter === 'safe' ? 'all' : 'safe')}
          className={`bg-white border rounded-xl p-5 text-left cursor-pointer transition-all shadow-sm flex items-center justify-between border-l-4 border-l-primary-500 ${agingBucketFilter === 'safe'
              ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/10'
              : 'border-slate-200 hover:bg-slate-50/50'
            }`}
        >
          <div>
            <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wider block">Belum J.Tempo</span>
            <span className="text-sm font-extrabold text-slate-900 mt-1 block font-mono">{formatCurrency(bucketTotals.safe)}</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-semibold">Porsi: {getBucketPercent(bucketTotals.safe)}</span>
          </div>
          <div className="p-2.5 bg-primary-50 text-primary-600 border border-primary-100 rounded-xl">
            <Clock size={16} />
          </div>
        </button>

        {/* Bucket 1-30 */}
        <button
          onClick={() => setAgingBucketFilter(agingBucketFilter === '30' ? 'all' : '30')}
          className={`bg-white border rounded-xl p-5 text-left cursor-pointer transition-all shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500 ${agingBucketFilter === '30'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10'
              : 'border-slate-200 hover:bg-slate-50/50'
            }`}
        >
          <div>
            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">1 - 30 Hari</span>
            <span className="text-sm font-extrabold text-emerald-700 mt-1 block font-mono">{formatCurrency(bucketTotals.days30)}</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-semibold">Porsi: {getBucketPercent(bucketTotals.days30)}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
            <TrendingUp size={16} />
          </div>
        </button>

        {/* Bucket 31-60 */}
        <button
          onClick={() => setAgingBucketFilter(agingBucketFilter === '60' ? 'all' : '60')}
          className={`bg-white border rounded-xl p-5 text-left cursor-pointer transition-all shadow-sm flex items-center justify-between border-l-4 border-l-amber-500 ${agingBucketFilter === '60'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10'
              : 'border-slate-200 hover:bg-slate-50/50'
            }`}
        >
          <div>
            <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">31 - 60 Hari</span>
            <span className="text-sm font-extrabold text-amber-700 mt-1 block font-mono">{formatCurrency(bucketTotals.days60)}</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-semibold">Porsi: {getBucketPercent(bucketTotals.days60)}</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl">
            <Calendar size={16} />
          </div>
        </button>

        {/* Bucket 61-90 */}
        <button
          onClick={() => setAgingBucketFilter(agingBucketFilter === '90' ? 'all' : '90')}
          className={`bg-white border rounded-xl p-5 text-left cursor-pointer transition-all shadow-sm flex items-center justify-between border-l-4 border-l-orange-500 ${agingBucketFilter === '90'
              ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/10'
              : 'border-slate-200 hover:bg-slate-50/50'
            }`}
        >
          <div>
            <span className="text-[9px] font-bold text-orange-600 uppercase tracking-wider block">61 - 90 Hari</span>
            <span className="text-sm font-extrabold text-orange-700 mt-1 block font-mono">{formatCurrency(bucketTotals.days90)}</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-semibold">Porsi: {getBucketPercent(bucketTotals.days90)}</span>
          </div>
          <div className="p-2.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-xl">
            <AlertTriangle size={16} />
          </div>
        </button>

        {/* Bucket 90+ */}
        <button
          onClick={() => setAgingBucketFilter(agingBucketFilter === '90plus' ? 'all' : '90plus')}
          className={`bg-white border rounded-xl p-5 text-left cursor-pointer transition-all shadow-sm flex items-center justify-between border-l-4 border-l-rose-500 ${agingBucketFilter === '90plus'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/10'
              : 'border-slate-200 hover:bg-slate-50/50'
            }`}
        >
          <div>
            <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider block">&gt; 90 Hari (Macet)</span>
            <span className="text-sm font-extrabold text-rose-700 mt-1 block font-mono">{formatCurrency(bucketTotals.over90)}</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-semibold">Porsi: {getBucketPercent(bucketTotals.over90)}</span>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-650 border border-rose-100 rounded-xl">
            <AlertTriangle size={16} />
          </div>
        </button>
      </div>

      {/* Control Board */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="md:col-span-2">
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Cari Pelanggan / Nota (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama customer atau nomor faktur..."
              value={searchQuery}
              onKeyDown={handleFilterEnter}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Selected Bucket Info */}
        <div className="flex flex-col justify-center text-xs">
          <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Metode Tampilan Filter</span>
          <p className="text-slate-700 mt-1.5 font-medium">
            Menampilkan: <strong className="text-primary-700 uppercase">{agingBucketFilter === 'all' ? 'Semua Faktur Piutang' : `Kategori ${agingBucketFilter}`}</strong>
          </p>
        </div>

        {/* Hints */}
        <div className="text-left md:text-right flex flex-col justify-end text-[10px] text-slate-500 leading-relaxed">
          <p>kotak porsi umur piutang di atas untuk memfilter data secara cepat.</p>
          <p className="mt-0.5">Pintasan: <kbd className="shortcut-badge text-[9px]">F1</kbd> cari, <kbd className="shortcut-badge text-[9px]">F10</kbd> ekspor Excel.</p>
        </div>
      </div>

      {/* Main Table */}
      <div
        className={`bg-white rounded-xl border shadow-xs overflow-hidden transition-all ${isTableFocused ? 'ring-2 ring-primary-500/20 border-primary-300' : 'border-slate-200'
          }`}
        onClick={() => setIsTableFocused(true)}
      >
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-3 w-12 text-center">No</th>
              <th className="p-3">No. Faktur</th>
              <th className="p-3">Nama Pelanggan</th>
              <th className="p-3">Tgl Faktur</th>
              <th className="p-3">Jatuh Tempo</th>
              <th className="p-3 text-center">Hari Keterlambatan</th>
              <th className="p-3 text-right">Nilai Faktur</th>
              <th className="p-3 text-right">Sisa Piutang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  Sedang menyusun struktur umur piutang...
                </td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  Tidak ada piutang aktif dalam kategori filter terpilih.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv, idx) => {
                const days = Number(inv.days_overdue);
                let agingClass = 'text-slate-500 font-medium';
                if (days > 90) agingClass = 'text-red-650 font-black';
                else if (days > 60) agingClass = 'text-orange-600 font-bold';
                else if (days > 30) agingClass = 'text-amber-600 font-semibold';
                else if (days > 0) agingClass = 'text-emerald-600 font-semibold';

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
                  <tr
                    key={inv.id}
                    ref={(el) => { rowRefs.current[idx] = el; }}
                    onClick={() => {
                      setIsTableFocused(true);
                      setSelectedIdx(idx);
                    }}
                    className="hover:bg-slate-50/50 cursor-pointer"
                  >
                    <td className={getTdClass('first') + " text-center text-slate-400"}>{idx + 1}</td>
                    <td className={getTdClass('middle') + " font-mono font-bold"}>
                      {inv.no_faktur || inv.no_order}
                    </td>
                    <td className={getTdClass('middle') + " font-bold"}>
                      {inv.customer_nama}
                      <span className="block text-[10px] text-slate-500 font-normal">{inv.customer?.kode}</span>
                    </td>
                    <td className={getTdClass('middle')}>{formatDate(inv.order_date)}</td>
                    <td className={getTdClass('middle') + " font-semibold text-slate-500"}>{formatDate(inv.due_date)}</td>
                    <td className={getTdClass('middle') + ` text-center ${agingClass}`}>
                      {days > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {days} Hari
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">Belum J.Tempo</span>
                      )}
                    </td>
                    <td className={getTdClass('middle') + " text-right font-mono"}>{formatCurrency(Number(inv.subtotal))}</td>
                    <td className={getTdClass('last') + " text-right font-mono font-bold text-rose-600 text-sm"}>
                      {formatCurrency(Number(inv.remaining))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end text-[10px] text-slate-400 mt-2">
        <span>Gunakan kursor atau klik tabel untuk fokus, tombol <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih.</span>
      </div>
    </div>
  );
};
