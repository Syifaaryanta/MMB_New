import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { exportStyledExcel } from '@/lib/excelHelper';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  ShoppingBag, 
  CreditCard, 
  Package, 
  ArrowLeft,
  Percent,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';

interface RingkasanData {
  total_omzet: number;
  total_transaksi: number;
  total_pembelian: number;
  total_piutang: number;
  total_produk: number;
}

export const LaporanRingkasan: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [data, setData] = useState<RingkasanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Date filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fromRef = React.useRef<HTMLInputElement>(null);

  const fetchRingkasan = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/laporan/ringkasan-bisnis?from=${fromDate}&to=${toDate}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRingkasan();
  }, [fromDate, toDate]);

  // Shortcuts
  // F1: Focus Date Filter
  useHotkeys('f1', (e) => {
    e.preventDefault();
    fromRef.current?.focus();
  }, { enableOnFormTags: true });

  // F10: Export Excel
  useHotkeys('f10', (e) => {
    e.preventDefault();
    exportToExcel();
  }, { enableOnFormTags: false });

  // Escape: Return to Laporan menu
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/laporan');
  }, { enableOnFormTags: true });

  const exportToExcel = () => {
    if (!data) return;
    const profit = data.total_omzet - data.total_pembelian;
    const ratio = data.total_omzet > 0 ? (data.total_pembelian / data.total_omzet) * 100 : 0;
    const reportRows = [
      {
        Indikator: lang === 'en' ? 'Total Sales Revenue' : 'Total Omzet Penjualan',
        Nilai: data.total_omzet
      },
      {
        Indikator: lang === 'en' ? 'Total Sales Transactions' : 'Total Transaksi Jual',
        Nilai: data.total_transaksi
      },
      {
        Indikator: lang === 'en' ? 'Total Purchase Value' : 'Total Nilai Pembelian',
        Nilai: data.total_pembelian
      },
      {
        Indikator: lang === 'en' ? 'Total Outstanding Receivables' : 'Total Outstanding Piutang',
        Nilai: data.total_piutang
      },
      {
        Indikator: lang === 'en' ? 'Total Active Product SKUs' : 'Total SKU Produk Aktif',
        Nilai: data.total_produk
      },
      {
        Indikator: lang === 'en' ? 'Estimated Gross Profit (Revenue - Purchases)' : 'Estimasi Laba Kotor (Omzet - Pembelian)',
        Nilai: profit
      },
      {
        Indikator: lang === 'en' ? 'Purchase / Revenue Ratio (%)' : 'Rasio Belanja / Omzet (%)',
        Nilai: `${ratio.toFixed(1)}%`
      },
    ];

    exportStyledExcel(
      reportRows,
      `Laporan_Ringkasan_Bisnis_${fromDate}_to_${toDate}.xlsx`,
      lang === 'en' ? 'Business Summary' : 'Ringkasan Bisnis',
      ['Nilai'],
      ['Indikator']
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
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
            {lang === 'en' ? 'Business Summary Report' : 'Laporan Ringkasan Bisnis'}
          </h1>
          <p className="text-slate-555 text-xs mt-1">
            {lang === 'en'
              ? 'Overview of sales performance, purchases, receivables, and stock in the selected period.'
              : 'Ikhtisar performa penjualan, pembelian, piutang, dan stok dalam periode terpilih.'}
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={!data}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>{lang === 'en' ? 'Export Excel (F10)' : 'Ekspor Excel (F10)'}</span>
          </button>
        </div>
      </div>

      {/* Filter Board */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date From */}
        <div>
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Start Date (F1)' : 'Tanggal Awal (F1)'}
          </label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={fromRef}
              type="date"
              value={fromDate}
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
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Help box */}
        <div className="text-left md:text-right flex flex-col justify-end text-[10px] text-slate-555 leading-relaxed">
          <p>
            {lang === 'en'
              ? 'Change dates to dynamically recalculate period performance.'
              : 'Ubah tanggal untuk menghitung ulang performa periode secara dinamis.'}
          </p>
          <p className="mt-0.5 font-semibold text-slate-500">
            {lang === 'en'
              ? 'Shortcuts: F1 date filter, F10 export Excel.'
              : 'Pintasan: F1 filter tanggal, F10 ekspor Excel.'}
          </p>
        </div>
      </div>

      {/* Grid Indicators & Analytics */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-xl bg-slate-200 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Omzet */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-primary-500 transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === 'en' ? 'Total Sales Revenue' : 'Total Omzet Penjualan'}
                </span>
                <span className="text-xl font-black text-slate-900 block font-mono">{formatCurrency(data.total_omzet)}</span>
                <span className="text-[10px] text-slate-500 block font-medium">
                  {data.total_transaksi} {lang === 'en' ? 'Transactions completed' : 'Transaksi selesai'}
                </span>
              </div>
              <div className="p-3 bg-primary-50 text-primary-600 border border-primary-100 rounded-xl">
                <TrendingUp size={24} />
              </div>
            </div>

            {/* Card 2: Pembelian */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-indigo-500 transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === 'en' ? 'Purchase Value' : 'Nilai Pembelian Barang'}
                </span>
                <span className="text-xl font-black text-slate-900 block font-mono">{formatCurrency(data.total_pembelian)}</span>
                <span className="text-[10px] text-slate-500 block font-medium">
                  {lang === 'en' ? 'Purchase orders to suppliers' : 'Pesanan pembelian ke supplier'}
                </span>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
                <ShoppingBag size={24} />
              </div>
            </div>

            {/* Card 3: Piutang */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-rose-500 transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === 'en' ? 'Total Outstanding Receivables' : 'Total Outstanding Piutang'}
                </span>
                <span className="text-xl font-black text-rose-600 block font-mono">{formatCurrency(data.total_piutang)}</span>
                <span className="text-[10px] text-slate-500 block font-medium">
                  {lang === 'en' ? 'Active credit remaining' : 'Sisa kredit aktif customer'}
                </span>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl">
                <CreditCard size={24} />
              </div>
            </div>

            {/* Card 4: Produk */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-amber-500 transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === 'en' ? 'Active Product SKUs' : 'SKU Produk Aktif'}
                </span>
                <span className="text-xl font-black text-slate-900 block font-mono">
                  {data.total_produk} {lang === 'en' ? 'Items' : 'Item'}
                </span>
                <span className="text-[10px] text-slate-500 block font-medium">
                  {lang === 'en' ? 'Total active products in database' : 'Jumlah database barang aktif'}
                </span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl">
                <Package size={24} />
              </div>
            </div>

            {/* Card 5: Estimasi Laba Kotor */}
            {(() => {
              const profit = data.total_omzet - data.total_pembelian;
              const isPositive = profit >= 0;
              return (
                <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 ${isPositive ? 'border-l-emerald-500' : 'border-l-rose-500'} transition-all hover:shadow-md`}>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Estimated Gross Profit' : 'Estimasi Laba Kotor'}
                    </span>
                    <span className={`text-xl font-black block font-mono ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(profit)}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      {lang === 'en' ? 'Difference of Revenue - Purchases' : 'Selisih Omzet - Pembelian'}
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {isPositive ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  </div>
                </div>
              );
            })()}

            {/* Card 6: Rasio Belanja */}
            {(() => {
              const ratio = data.total_omzet > 0 ? (data.total_pembelian / data.total_omzet) * 100 : 0;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-teal-500 transition-all hover:shadow-md">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'en' ? 'Purchase / Revenue Ratio' : 'Rasio Belanja / Omzet'}
                    </span>
                    <span className="text-xl font-black text-slate-900 block font-mono">{ratio.toFixed(1)}%</span>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      {lang === 'en' ? 'Purchase portion of revenue' : 'Porsi belanja dari pendapatan'}
                    </span>
                  </div>
                  <div className="p-3 bg-teal-50 text-teal-600 border border-teal-100 rounded-xl">
                    <Percent size={24} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Chart & Analysis Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-primary-500" />
                {lang === 'en' ? 'Financial Comparison Chart' : 'Grafik Komparasi Keuangan'}
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: lang === 'en' ? 'Revenue' : 'Omzet', Nilai: data.total_omzet, color: '#3b82f6' },
                      { name: lang === 'en' ? 'Purchases' : 'Pembelian', Nilai: data.total_pembelian, color: '#6366f1' },
                      { name: lang === 'en' ? 'Receivables' : 'Piutang', Nilai: data.total_piutang, color: '#f43f5e' },
                    ]}
                    margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => {
                        if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
                        if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}Jt`;
                        return `Rp ${value}`;
                      }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      formatter={(value: any) => [formatCurrency(value), lang === 'en' ? 'Value' : 'Nilai']}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                    />
                    <Bar dataKey="Nilai" radius={[8, 8, 0, 0]}>
                      {
                        [
                          { color: '#3b82f6' },
                          { color: '#6366f1' },
                          { color: '#f43f5e' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Health Analysis Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  {lang === 'en' ? 'Analysis & Recommendations' : 'Analisa & Rekomendasi'}
                </h3>
                <div className="space-y-4">
                  {/* Metric 1 */}
                  {(() => {
                    const ratio = data.total_omzet > 0 ? (data.total_pembelian / data.total_omzet) * 100 : 0;
                    let text = lang === 'en' ? 'Purchases are balanced with sales.' : 'Belanja seimbang dengan penjualan.';
                    let statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
                    if (ratio > 90) {
                      text = lang === 'en' ? 'Purchases are too high, approaching revenue. Cash flow at risk.' : 'Belanja terlalu tinggi mendekati omzet. Arus kas berisiko.';
                      statusColor = 'text-rose-600 bg-rose-50 border-rose-100';
                    } else if (ratio > 70) {
                      text = lang === 'en' ? 'Purchases are high, monitor product margins.' : 'Belanja tinggi, awasi margin produk.';
                      statusColor = 'text-amber-600 bg-amber-50 border-amber-100';
                    }
                    return (
                      <div className={`p-3 rounded-lg border text-xs ${statusColor} space-y-1`}>
                        <span className="font-bold block">
                          {lang === 'en' ? 'Purchase Ratio Status' : 'Status Rasio Belanja'}
                        </span>
                        <p>{text}</p>
                      </div>
                    );
                  })()}

                  {/* Metric 2 */}
                  {(() => {
                    const ratioAR = data.total_omzet > 0 ? (data.total_piutang / data.total_omzet) * 100 : 0;
                    let text = lang === 'en' ? 'Receivables are at a safe level.' : 'Piutang berada pada tingkat aman.';
                    let statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
                    if (ratioAR > 50) {
                      text = lang === 'en' ? 'Receivables exceed 50% of revenue. Perform aggressive billing.' : 'Piutang melebihi 50% omzet. Lakukan penagihan agresif.';
                      statusColor = 'text-rose-600 bg-rose-50 border-rose-100';
                    } else if (ratioAR > 30) {
                      text = lang === 'en' ? 'Receivables are moderate, limit credit for new customers.' : 'Piutang sedang, batasi limit kredit pelanggan baru.';
                      statusColor = 'text-amber-600 bg-amber-50 border-amber-100';
                    }
                    return (
                      <div className={`p-3 rounded-lg border text-xs ${statusColor} space-y-1`}>
                        <span className="font-bold block">
                          {lang === 'en' ? 'Receivables Health Status' : 'Status Kesehatan Piutang'}
                        </span>
                        <p>{text}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-500">
                {lang === 'en'
                  ? '* Analysis is automatically updated whenever you change date filter above.'
                  : '* Analisa otomatis diperbarui setiap kali Anda memperbarui filter tanggal di atas.'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 italic text-xs shadow-sm">
          {lang === 'en' ? 'Failed to fetch business summary data.' : 'Gagal mengambil data ringkasan bisnis.'}
        </div>
      )}
    </div>
  );
};
