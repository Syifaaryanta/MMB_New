import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
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

  // Shortcuts
  // F1: Focus Search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F2: Export Excel
  useHotkeys('f2', (e) => {
    e.preventDefault();
    exportToExcel();
  }, { enableOnFormTags: false });

  // Escape: Return to menu
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/laporan');
  }, { enableOnFormTags: true });

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

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aging Report');
    XLSX.writeFile(wb, `Laporan_Aging_Piutang_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate('/laporan')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={12} /> Kembali ke Menu (Esc)
          </button>
          <h1 className="text-2xl font-extrabold text-white">Laporan Aging Piutang (AR)</h1>
          <p className="text-slate-400 text-sm">Analisa struktur umur kredit piutang (Aging Report) dan jatuh tempo pembayaran pelanggan.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={filteredInvoices.length === 0}
            className="card bg-surface-800 hover:bg-surface-750 px-3.5 py-2 text-slate-350 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} />
            <span>Ekspor Excel (F2)</span>
          </button>
        </div>
      </div>

      {/* Aging Buckets Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Bucket Safe */}
        <button 
          onClick={() => setAgingBucketFilter(agingBucketFilter === 'safe' ? 'all' : 'safe')}
          className={`card p-4 text-left border cursor-pointer transition-all ${
            agingBucketFilter === 'safe' ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-surface-700/60'
          }`}
        >
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Belum J.Tempo</span>
          <span className="text-base font-black text-slate-200 mt-1 block">{formatCurrency(bucketTotals.safe)}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Porsi: {getBucketPercent(bucketTotals.safe)}</span>
        </button>

        {/* Bucket 1-30 */}
        <button 
          onClick={() => setAgingBucketFilter(agingBucketFilter === '30' ? 'all' : '30')}
          className={`card p-4 text-left border cursor-pointer transition-all ${
            agingBucketFilter === '30' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-surface-700/60'
          }`}
        >
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">1 - 30 Hari</span>
          <span className="text-base font-black text-emerald-400 mt-1 block">{formatCurrency(bucketTotals.days30)}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Porsi: {getBucketPercent(bucketTotals.days30)}</span>
        </button>

        {/* Bucket 31-60 */}
        <button 
          onClick={() => setAgingBucketFilter(agingBucketFilter === '60' ? 'all' : '60')}
          className={`card p-4 text-left border cursor-pointer transition-all ${
            agingBucketFilter === '60' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-surface-700/60'
          }`}
        >
          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">31 - 60 Hari</span>
          <span className="text-base font-black text-amber-400 mt-1 block">{formatCurrency(bucketTotals.days60)}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Porsi: {getBucketPercent(bucketTotals.days60)}</span>
        </button>

        {/* Bucket 61-90 */}
        <button 
          onClick={() => setAgingBucketFilter(agingBucketFilter === '90' ? 'all' : '90')}
          className={`card p-4 text-left border cursor-pointer transition-all ${
            agingBucketFilter === '90' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-surface-700/60'
          }`}
        >
          <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider block">61 - 90 Hari</span>
          <span className="text-base font-black text-orange-400 mt-1 block">{formatCurrency(bucketTotals.days90)}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Porsi: {getBucketPercent(bucketTotals.days90)}</span>
        </button>

        {/* Bucket 90+ */}
        <button 
          onClick={() => setAgingBucketFilter(agingBucketFilter === '90plus' ? 'all' : '90plus')}
          className={`card p-4 text-left border cursor-pointer transition-all ${
            agingBucketFilter === '90plus' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-surface-700/60'
          }`}
        >
          <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block">&gt; 90 Hari (Macet)</span>
          <span className="text-base font-black text-rose-400 mt-1 block">{formatCurrency(bucketTotals.over90)}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Porsi: {getBucketPercent(bucketTotals.over90)}</span>
        </button>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Pelanggan / Nota (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama customer atau nomor faktur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Selected Bucket Info */}
        <div className="flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Metode Tampilan Filter</span>
          <p className="text-xs text-slate-200 mt-1">
            Menampilkan: <strong className="text-primary-400 uppercase">{agingBucketFilter === 'all' ? 'Semua Faktur Piutang' : `Kategori ${agingBucketFilter}`}</strong>
          </p>
        </div>

        {/* Hints */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-500">
          <p>Klik kotak porsi umur piutang di atas untuk memfilter data secara cepat.</p>
          <p className="mt-1">Pintasan: <kbd className="shortcut-badge">F1</kbd> cari, <kbd className="shortcut-badge">F2</kbd> ekspor Excel.</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">No</th>
              <th className="p-4">No. Faktur</th>
              <th className="p-4">Nama Pelanggan</th>
              <th className="p-4">Tgl Faktur</th>
              <th className="p-4">Jatuh Tempo</th>
              <th className="p-4 text-center">Hari Keterlambatan</th>
              <th className="p-4 text-right">Nilai Faktur</th>
              <th className="p-4 text-right">Sisa Piutang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-750">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  Sedang menyusun struktur umur piutang...
                </td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  Tidak ada piutang aktif dalam kategori filter terpilih.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv, idx) => {
                const days = Number(inv.days_overdue);
                let agingClass = 'text-slate-400';
                if (days > 90) agingClass = 'text-red-400 font-black';
                else if (days > 60) agingClass = 'text-orange-400 font-bold';
                else if (days > 30) agingClass = 'text-amber-400';
                else if (days > 0) agingClass = 'text-emerald-400';

                return (
                  <tr key={inv.id} className="hover:bg-surface-750/30 text-slate-350">
                    <td className="p-4 text-center text-slate-500">{idx + 1}</td>
                    <td className="p-4 font-mono font-bold text-slate-200">
                      {inv.no_faktur || inv.no_order}
                    </td>
                    <td className="p-4 font-bold text-slate-200">
                      {inv.customer_nama}
                      <span className="block text-[10px] text-slate-500">{inv.customer?.kode}</span>
                    </td>
                    <td className="p-4">{formatDate(inv.order_date)}</td>
                    <td className="p-4 font-semibold text-slate-400">{formatDate(inv.due_date)}</td>
                    <td className={`p-4 text-center ${agingClass}`}>
                      {days > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {days} Hari
                        </span>
                      ) : (
                        <span className="text-slate-500 font-normal">Belum J.Tempo</span>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono">{formatCurrency(Number(inv.subtotal))}</td>
                    <td className="p-4 text-right font-mono font-bold text-rose-450 text-sm">
                      {formatCurrency(Number(inv.remaining))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
