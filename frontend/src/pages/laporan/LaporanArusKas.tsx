import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
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
  const [data, setData] = useState<CashFlowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fromRef = useRef<HTMLInputElement>(null);

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
    fromRef.current?.focus();
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
    if (!data) return;
    const totalInflow = Number(data.masuk_tunai) + Number(data.masuk_piutang);
    const totalOutflow = Number(data.keluar_pembelian);
    const netFlow = totalInflow - totalOutflow;

    const reportRows = [
      { Kategori: 'ARUS KAS MASUK (INFLOW)', Keterangan: 'Penjualan Tunai Langsung', Jumlah: Number(data.masuk_tunai) },
      { Kategori: 'ARUS KAS MASUK (INFLOW)', Keterangan: 'Pelunasan & Angsuran Piutang', Jumlah: Number(data.masuk_piutang) },
      { Kategori: 'TOTAL ARUS KAS MASUK', Keterangan: '', Jumlah: totalInflow },
      { Kategori: 'ARUS KAS KELUAR (OUTFLOW)', Keterangan: 'Pembelian & Pengadaan Barang', Jumlah: totalOutflow },
      { Kategori: 'TOTAL ARUS KAS KELUAR', Keterangan: '', Jumlah: totalOutflow },
      { Kategori: 'ARUS KAS BERSIH (NET FLOW)', Keterangan: '', Jumlah: netFlow },
    ];

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Arus Kas');
    XLSX.writeFile(wb, `Laporan_Arus_Kas_${fromDate}_to_${toDate}.xlsx`);
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
          <h1 className="text-2xl font-extrabold text-white">Laporan Arus Kas (Cash Flow)</h1>
          <p className="text-slate-400 text-sm">Pemantauan kas masuk (Tunai & Piutang) vs kas keluar (Pembelian Gudang).</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={!data}
            className="card bg-surface-800 hover:bg-surface-750 px-3.5 py-2 text-slate-355 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} />
            <span>Ekspor Excel (F2)</span>
          </button>
        </div>
      </div>

      {/* Filter Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date From */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Awal (F1)</label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={fromRef}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Akhir</label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Hints */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-500">
          <p>Laporan ini menghitung realisasi dana kas fisik yang masuk dan keluar.</p>
          <p className="mt-1">Pintasan: <kbd className="shortcut-badge">F1</kbd> filter tanggal, <kbd className="shortcut-badge">F2</kbd> ekspor Excel.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-28 skeleton rounded-xl" />
          <div className="h-64 skeleton rounded-xl" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Statement Box */}
          <div className="card p-6 col-span-1 lg:col-span-2 space-y-6">
            <h3 className="text-sm font-extrabold text-white border-b border-surface-700 pb-2 flex items-center gap-1.5">
              <Activity size={16} className="text-primary-400" />
              <span>LAPORAN AKTIVITAS ARUS KAS PERIODE</span>
            </h3>

            {/* Inflow Section */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <TrendingUp size={12} />
                <span>Arus Kas Masuk (Cash Inflow)</span>
              </h4>
              <div className="pl-4 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-350">Penjualan Tunai Langsung</span>
                  <span className="font-mono text-slate-200">{formatCurrency(data.masuk_tunai)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-350">Pelunasan & Angsuran Piutang (AR)</span>
                  <span className="font-mono text-slate-200">{formatCurrency(data.masuk_piutang)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-surface-750 font-bold text-white">
                  <span>Total Penerimaan Kas Masuk</span>
                  <span className="font-mono text-emerald-400">{formatCurrency(totalInflow)}</span>
                </div>
              </div>
            </div>

            {/* Outflow Section */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                <TrendingDown size={12} />
                <span>Arus Kas Keluar (Cash Outflow)</span>
              </h4>
              <div className="pl-4 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-350">Pembelian & Pengadaan Barang (AP)</span>
                  <span className="font-mono text-slate-200">{formatCurrency(data.keluar_pembelian)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-surface-750 font-bold text-white">
                  <span>Total Pengeluaran Kas Keluar</span>
                  <span className="font-mono text-rose-400">{formatCurrency(totalOutflow)}</span>
                </div>
              </div>
            </div>

            {/* Net Flow Section */}
            <div className="pt-4 border-t-2 border-dashed border-surface-700 flex justify-between items-center">
              <div>
                <strong className="text-xs uppercase text-slate-200 block">Surplus / Defisit Kas Bersih</strong>
                <span className="text-[10px] text-slate-500">Arus masuk bersih dalam periode</span>
              </div>
              <strong className={`font-mono text-lg font-black ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                {formatCurrency(netCashFlow)}
              </strong>
            </div>
          </div>

          {/* Quick Metrics Side Card */}
          <div className="space-y-6">
            {/* Surplus/Defisit Visual Indicator */}
            <div className={`card p-6 border text-center space-y-3 ${
              netCashFlow >= 0 
                ? 'border-emerald-500/20 bg-emerald-950/5' 
                : 'border-rose-500/20 bg-rose-950/5'
            }`}>
              <div className={`p-4 rounded-full mx-auto w-16 h-16 flex items-center justify-center ${
                netCashFlow >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
              }`}>
                <Wallet size={28} />
              </div>
              <div className="space-y-1">
                <strong className="text-sm text-white block">Status Kas Operasional</strong>
                <p className={`text-xs font-bold ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netCashFlow >= 0 ? 'SURPLUS NET INFLOW' : 'DEFISIT NET OUTFLOW'}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {netCashFlow >= 0 
                  ? 'Kondisi keuangan sehat dengan perolehan kas masuk melebihi beban belanja.'
                  : 'Pengeluaran untuk pembelian melebihi kas masuk dari penjualan tunai dan tagihan piutang.'
                }
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center text-slate-400 italic text-xs border border-surface-700">
          Gagal memuat rekam data laporan arus kas.
        </div>
      )}
    </div>
  );
};
