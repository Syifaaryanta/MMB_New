import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { exportStyledExcel } from '@/lib/excelHelper';
import { 
  Wallet, 
  Calendar, 
  Download, 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Activity
} from 'lucide-react';

interface CashFlowData {
  masuk_tunai: number;
  masuk_piutang: number;
  keluar_pembelian: number;
}

export const LaporanArusKas: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [data, setData] = useState<CashFlowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);

  const fetchArusKas = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/laporan/arus-kas?from=${fromDate}&to=${toDate}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArusKas();
  }, [fromDate, toDate]);

  // Shortcuts
  // F1: Focus Date Filter
  useHotkeys('f1', (e) => {
    e.preventDefault();
    fromDateRef.current?.focus();
    fromDateRef.current?.select();
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

  const exportToExcel = () => {
    if (!data) return;
    const totalInflow = Number(data.masuk_tunai) + Number(data.masuk_piutang);
    const totalOutflow = Number(data.keluar_pembelian);
    const netFlow = totalInflow - totalOutflow;

    const reportRows = [
      {
        Kategori: lang === 'en' ? 'CASH INFLOW' : 'ARUS KAS MASUK (INFLOW)',
        Keterangan: lang === 'en' ? 'Direct Cash Sales' : 'Penjualan Tunai Langsung',
        Jumlah: Number(data.masuk_tunai)
      },
      {
        Kategori: lang === 'en' ? 'CASH INFLOW' : 'ARUS KAS MASUK (INFLOW)',
        Keterangan: lang === 'en' ? 'Receivables Collection & Installments' : 'Pelunasan & Angsuran Piutang',
        Jumlah: Number(data.masuk_piutang)
      },
      {
        Kategori: lang === 'en' ? 'TOTAL CASH INFLOW' : 'TOTAL ARUS KAS MASUK',
        Keterangan: '',
        Jumlah: totalInflow
      },
      {
        Kategori: lang === 'en' ? 'CASH OUTFLOW' : 'ARUS KAS KELUAR (OUTFLOW)',
        Keterangan: lang === 'en' ? 'Purchases & Procurement' : 'Pembelian & Pengadaan Barang',
        Jumlah: totalOutflow
      },
      {
        Kategori: lang === 'en' ? 'TOTAL CASH OUTFLOW' : 'TOTAL ARUS KAS KELUAR',
        Keterangan: '',
        Jumlah: totalOutflow
      },
      {
        Kategori: lang === 'en' ? 'NET CASH FLOW' : 'ARUS KAS BERSIH (NET FLOW)',
        Keterangan: '',
        Jumlah: netFlow
      },
    ];

    exportStyledExcel(
      reportRows,
      `Laporan_Arus_Kas_${fromDate}_to_${toDate}.xlsx`,
      lang === 'en' ? 'Cash Flow Statement' : 'Laporan Arus Kas (Cash Flow)',
      [],
      ['Kategori'],
      ['Jumlah']
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const totalInflow = data ? Number(data.masuk_tunai) + Number(data.masuk_piutang) : 0;
  const totalOutflow = data ? Number(data.keluar_pembelian) : 0;
  const netCashFlow = totalInflow - totalOutflow;

  return (
    <div className="space-y-4 text-slate-800 animate-fade-in">
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
            {lang === 'en' ? 'Cash Flow Statement' : 'Laporan Arus Kas (Cash Flow)'}
          </h1>
          <p className="text-slate-555 text-xs mt-1">
            {lang === 'en'
              ? 'Monitoring cash inflow (Cash & Receivables) vs cash outflow (Warehouse Purchases).'
              : 'Pemantauan kas masuk (Tunai & Piutang) vs kas keluar (Pembelian Gudang).'}
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
          <label className="block text-[10px] text-slate-555 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Start Date (F1)' : 'Tanggal Awal (F1)'}
          </label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={fromDateRef}
              type="date"
              value={fromDate}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toDateRef.current?.focus())}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[10px] text-slate-555 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'End Date' : 'Tanggal Akhir'}
          </label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={toDateRef}
              type="date"
              value={toDate}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toDateRef.current?.blur())}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Hints */}
        <div className="text-left md:text-right flex flex-col justify-end text-[10px] text-slate-500 leading-relaxed font-semibold">
          <p>
            {lang === 'en'
              ? 'This report calculates the realization of physical cash inflow and outflow.'
              : 'Laporan ini menghitung realisasi dana kas fisik yang masuk dan keluar.'}
          </p>
          <p className="mt-0.5 font-semibold text-slate-400">
            {lang === 'en'
              ? 'Shortcuts: F1 date filter, F10 export Excel.'
              : 'Pintasan: F1 filter tanggal, F10 ekspor Excel.'}
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {data && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-scale-in">
          {/* Card 1: Kas Masuk */}
          <div className="bg-white border border-slate-200 rounded-xl py-2.5 px-4 shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">
                {lang === 'en' ? 'Total Cash Inflow' : 'Total Kas Masuk (Inflow)'}
              </span>
              <span className="text-lg font-extrabold text-emerald-600 block mt-0.5 font-mono">{formatCurrency(totalInflow)}</span>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>

          {/* Card 2: Kas Keluar */}
          <div className="bg-white border border-slate-200 rounded-xl py-2.5 px-4 shadow-sm flex items-center justify-between border-l-4 border-l-rose-500">
            <div>
              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">
                {lang === 'en' ? 'Total Cash Outflow' : 'Total Kas Keluar (Outflow)'}
              </span>
              <span className="text-lg font-extrabold text-rose-600 block mt-0.5 font-mono">{formatCurrency(totalOutflow)}</span>
            </div>
            <div className="p-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl">
              <TrendingDown size={16} />
            </div>
          </div>

          {/* Card 3: Saldo Bersih */}
          <div className={`bg-white border border-slate-200 rounded-xl py-2.5 px-4 shadow-sm flex items-center justify-between border-l-4 ${
            netCashFlow >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'
          }`}>
            <div>
              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">
                {lang === 'en' ? 'Net Cash Balance' : 'Saldo Kas Bersih'}
              </span>
              <span className={`text-lg font-extrabold block mt-0.5 font-mono ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(netCashFlow)}
              </span>
            </div>
            <div className={`p-2 rounded-xl border ${
              netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-650 border-rose-105'
            }`}>
              <Wallet size={16} />
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-28 skeleton rounded-xl bg-slate-200 animate-pulse border border-slate-200" />
          <div className="h-64 skeleton rounded-xl bg-slate-200 animate-pulse border border-slate-200" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Statement Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm col-span-1 lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
              <Activity size={16} className="text-primary-600" />
              <span>{lang === 'en' ? 'Physical Cash Flow Activity' : 'Aktivitas Aliran Dana Kas Fisik'}</span>
            </h3>

            {/* Inflow Section */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{lang === 'en' ? 'Cash Inflow' : 'Arus Kas Masuk (Cash Inflow)'}</span>
              </h4>
              <div className="pl-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 hover:bg-slate-50/50 px-2 rounded transition-colors">
                  <span className="text-slate-650 font-medium">{lang === 'en' ? 'Direct Cash Sales' : 'Penjualan Tunai Langsung'}</span>
                  <span className="font-mono text-slate-800 font-bold">{formatCurrency(data.masuk_tunai)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 hover:bg-slate-50/50 px-2 rounded transition-colors">
                  <span className="text-slate-655 font-medium">
                    {lang === 'en' ? 'Collection & Receivables Installments (AR)' : 'Pelunasan & Angsuran Piutang (AR)'}
                  </span>
                  <span className="font-mono text-slate-800 font-bold">{formatCurrency(data.masuk_piutang)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-t border-slate-100 font-bold text-slate-900 px-2 bg-slate-50/50 rounded mt-0.5">
                  <span className="text-slate-800">{lang === 'en' ? 'Total Inflow' : 'Total Arus Masuk'}</span>
                  <span className="font-mono text-emerald-600 text-xs font-extrabold">{formatCurrency(totalInflow)}</span>
                </div>
              </div>
            </div>

            {/* Outflow Section */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>{lang === 'en' ? 'Cash Outflow' : 'Arus Kas Keluar (Cash Outflow)'}</span>
              </h4>
              <div className="pl-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 hover:bg-slate-50/50 px-2 rounded transition-colors">
                  <span className="text-slate-650 font-medium">{lang === 'en' ? 'Purchases & Procurement (AP)' : 'Pembelian & Pengadaan Barang (AP)'}</span>
                  <span className="font-mono text-slate-800 font-bold">{formatCurrency(data.keluar_pembelian)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-t border-slate-100 font-bold text-slate-900 px-2 bg-slate-50/50 rounded mt-0.5">
                  <span className="text-slate-800">{lang === 'en' ? 'Total Outflow' : 'Total Arus Keluar'}</span>
                  <span className="font-mono text-rose-600 text-xs font-extrabold">{formatCurrency(totalOutflow)}</span>
                </div>
              </div>
            </div>

            {/* Net Flow Section */}
            <div className="pt-3 border-t border-dashed border-slate-200/80 flex justify-between items-center px-2 bg-slate-50 rounded-lg p-2.5">
              <div>
                <strong className="text-xs uppercase text-slate-855 block font-bold">
                  {lang === 'en' ? 'Net Cash Surplus / Deficit' : 'Surplus / Defisit Kas Bersih'}
                </strong>
                <span className="text-[10px] text-slate-500 font-medium">
                  {lang === 'en' ? 'Net physical cash flow difference' : 'Selisih aliran kas fisik bersih'}
                </span>
              </div>
              <strong className={`font-mono text-sm sm:text-base font-black ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(netCashFlow)}
              </strong>
            </div>
          </div>

          {/* Quick Metrics Side Card */}
          <div className="space-y-4">
            {/* Surplus/Defisit Visual Indicator */}
            <div className={`bg-white border rounded-xl p-4 shadow-sm text-center space-y-2.5 border-t-4 ${
              netCashFlow >= 0 
                ? 'border-t-emerald-500' 
                : 'border-t-rose-500'
            }`}>
              <div className={`p-3 rounded-full mx-auto w-12 h-12 flex items-center justify-center ${
                netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-650 border border-rose-100'
              }`}>
                <Wallet size={20} />
              </div>
              <div className="space-y-1">
                <strong className="text-xs text-slate-800 block font-bold">{lang === 'en' ? 'Cash Flow Status' : 'Status Aliran Kas'}</strong>
                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                  netCashFlow >= 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}>
                  {netCashFlow >= 0 ? 'SURPLUS NET INFLOW' : 'DEFISIT NET OUTFLOW'}
                </span>
              </div>
              <p className="text-[10px] text-slate-550 leading-relaxed font-medium">
                {netCashFlow >= 0 
                  ? (lang === 'en'
                      ? 'Operational financial condition is healthy. Cash sales and collection of receivables are sufficient to fund warehouse purchase expenses.'
                      : 'Kondisi keuangan operasional sehat. Penerimaan dari penjualan tunai dan pelunasan piutang sanggup mendanai beban operasional belanja gudang.')
                  : (lang === 'en'
                      ? 'Cash outflow exceeds inflow. Expense reduction or accelerated collections of receivables are required.'
                      : 'Arus dana keluar melebihi penerimaan. Perlu dilakukan efisiensi belanja barang atau akselerasi penagihan piutang dari customer.')
                }
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-550 italic text-xs shadow-sm">
          {lang === 'en' ? 'Failed to load cash flow statement data.' : 'Gagal memuat rekam data laporan arus kas.'}
        </div>
      )}
    </div>
  );
};
