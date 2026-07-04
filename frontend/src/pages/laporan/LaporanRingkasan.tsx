import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  CreditCard, 
  Package, 
  ArrowLeft 
} from 'lucide-react';

interface RingkasanData {
  total_omzet: number;
  total_transaksi: number;
  total_pembelian: number;
  total_piutang: number;
  total_produk: number;
}

export const LaporanRingkasan: React.FC = () => {
  const navigate = useNavigate();
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

  // F2: Export Excel
  useHotkeys('f2', (e) => {
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
    const reportRows = [
      { Indikator: 'Total Omzet Penjualan', Nilai: data.total_omzet },
      { Indikator: 'Total Transaksi Jual', Nilai: data.total_transaksi },
      { Indikator: 'Total Nilai Pembelian', Nilai: data.total_pembelian },
      { Indikator: 'Total Outstanding Piutang', Nilai: data.total_piutang },
      { Indikator: 'Total SKU Produk Aktif', Nilai: data.total_produk },
    ];

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Bisnis');
    XLSX.writeFile(wb, `Laporan_Ringkasan_Bisnis_${fromDate}_to_${toDate}.xlsx`);
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
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate('/laporan')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={12} /> Kembali ke Menu (Esc)
          </button>
          <h1 className="text-2xl font-extrabold text-white">Laporan Ringkasan Bisnis</h1>
          <p className="text-slate-400 text-sm">Ikhtisar performa penjualan, pembelian, piutang, dan stok dalam periode terpilih.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={!data}
            className="card bg-surface-800 hover:bg-surface-750 px-3.5 py-2 text-slate-350 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
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

        {/* Help box */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-500">
          <p>Ubah tanggal untuk menghitung ulang performa periode secara dinamis.</p>
          <p className="mt-1">Pintasan: <kbd className="shortcut-badge">F1</kbd> filter tanggal, <kbd className="shortcut-badge">F2</kbd> ekspor Excel.</p>
        </div>
      </div>

      {/* Grid Indicators */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Omzet */}
          <div className="card p-6 border-l-4 border-primary-500 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Omzet Penjualan</span>
              <span className="text-2xl font-black text-white block">{formatCurrency(data.total_omzet)}</span>
              <span className="text-[10px] text-slate-400 block">{data.total_transaksi} Transaksi selesai</span>
            </div>
            <div className="p-3.5 bg-primary-950/40 text-primary-400 border border-primary-800/20 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>

          {/* Card 2: Pembelian */}
          <div className="card p-6 border-l-4 border-indigo-500 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nilai Pembelian Barang</span>
              <span className="text-2xl font-black text-white block">{formatCurrency(data.total_pembelian)}</span>
              <span className="text-[10px] text-slate-400 block">Pesanan pembelian ke supplier</span>
            </div>
            <div className="p-3.5 bg-indigo-950/40 text-indigo-400 border border-indigo-800/20 rounded-xl">
              <ShoppingBag size={24} />
            </div>
          </div>

          {/* Card 3: Piutang */}
          <div className="card p-6 border-l-4 border-rose-500 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outstanding Piutang</span>
              <span className="text-2xl font-black text-rose-400 block">{formatCurrency(data.total_piutang)}</span>
              <span className="text-[10px] text-slate-400 block">Sisa kredit aktif customer</span>
            </div>
            <div className="p-3.5 bg-rose-950/40 text-rose-400 border border-rose-800/20 rounded-xl">
              <CreditCard size={24} />
            </div>
          </div>

          {/* Card 4: Produk */}
          <div className="card p-6 border-l-4 border-amber-500 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SKU Produk Aktif</span>
              <span className="text-2xl font-black text-white block">{data.total_produk} Item</span>
              <span className="text-[10px] text-slate-400 block">Jumlah database barang aktif</span>
            </div>
            <div className="p-3.5 bg-amber-950/40 text-amber-400 border border-amber-800/20 rounded-xl">
              <Package size={24} />
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center text-slate-400 italic text-xs border border-surface-700">
          Gagal mengambil data ringkasan bisnis.
        </div>
      )}
    </div>
  );
};
