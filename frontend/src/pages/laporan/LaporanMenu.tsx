import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingBag, 
  Package, 
  CreditCard, 
  TrendingDown, 
  Wallet, 
  ShieldAlert, 
  ChevronRight 
} from 'lucide-react';

export const LaporanMenu: React.FC = () => {
  const navigate = useNavigate();
  const [focusedIdx, setFocusedIdx] = useState(0);

  const reports = [
    {
      title: 'Ringkasan Bisnis',
      desc: 'Ikhtisar total omzet, transaksi, pembelian, piutang, dan jumlah produk aktif.',
      path: '/laporan/ringkasan-bisnis',
      icon: BarChart3,
      color: 'text-primary-400 border-primary-500/20 hover:bg-primary-900/10',
      num: '1',
    },
    {
      title: 'Penjualan Detail',
      desc: 'Margin laba kotor, rincian produk terjual, dan status transaksi per pelanggan.',
      path: '/laporan/penjualan-detail',
      icon: TrendingUp,
      color: 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-900/10',
      num: '2',
    },
    {
      title: 'Pembelian Detail',
      desc: 'Analisa barang masuk, supplier pengirim, dan harga beli historis.',
      path: '/laporan/pembelian-detail',
      icon: ShoppingBag,
      color: 'text-indigo-400 border-indigo-500/20 hover:bg-indigo-900/10',
      num: '3',
    },
    {
      title: 'Stok Persediaan',
      desc: 'Nilai aset persediaan gudang saat ini dan monitoring stok kritis.',
      path: '/laporan/stok-persediaan',
      icon: Package,
      color: 'text-amber-400 border-amber-500/20 hover:bg-amber-900/10',
      num: '4',
    },
    {
      title: 'Penagihan Piutang (AR)',
      desc: 'Laporan umur piutang (aging report) per customer (30, 60, 90+ hari).',
      path: '/laporan/penagihan-piutang',
      icon: CreditCard,
      color: 'text-rose-400 border-rose-500/20 hover:bg-rose-900/10',
      num: '5',
    },
    {
      title: 'Laporan Hutang (AP)',
      desc: 'Daftar hutang jatuh tempo ke supplier berdasarkan invoice pembelian kredit.',
      path: '/laporan/hutang',
      icon: TrendingDown,
      color: 'text-orange-400 border-orange-500/20 hover:bg-orange-900/10',
      num: '6',
    },
    {
      title: 'Arus Kas (Cash Flow)',
      desc: 'Rekapitulasi total kas masuk (Tunai/Pelunasan) vs total kas keluar (Pembelian).',
      path: '/laporan/arus-kas',
      icon: Wallet,
      color: 'text-teal-400 border-teal-500/20 hover:bg-teal-900/10',
      num: '7',
    },
    {
      title: 'Audit Log Aktivitas',
      desc: 'Lacak riwayat penyesuaian stok manual gudang dan aktivitas krusial.',
      path: '/laporan/audit-aktivitas',
      icon: ShieldAlert,
      color: 'text-red-400 border-red-500/20 hover:bg-red-900/10',
      num: '8',
    },
  ];

  // Hotkeys 1-8
  useHotkeys('1', () => navigate('/laporan/ringkasan-bisnis'));
  useHotkeys('2', () => navigate('/laporan/penjualan-detail'));
  useHotkeys('3', () => navigate('/laporan/pembelian-detail'));
  useHotkeys('4', () => navigate('/laporan/stok-persediaan'));
  useHotkeys('5', () => navigate('/laporan/penagihan-piutang'));
  useHotkeys('6', () => navigate('/laporan/hutang'));
  useHotkeys('7', () => navigate('/laporan/arus-kas'));
  useHotkeys('8', () => navigate('/laporan/audit-aktivitas'));

  // Keyboard Grid Navigation
  useHotkeys('right', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev + 1) % reports.length);
  }, { enableOnFormTags: false });

  useHotkeys('left', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev - 1 + reports.length) % reports.length);
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    // 4 columns layout: down adds 4, wrapping around
    setFocusedIdx((prev) => (prev + 4) % reports.length);
  }, { enableOnFormTags: false });

  useHotkeys('up', (e) => {
    e.preventDefault();
    // 4 columns layout: up subtracts 4, wrapping around
    setFocusedIdx((prev) => (prev - 4 + reports.length) % reports.length);
  }, { enableOnFormTags: false });

  useHotkeys('enter', (e) => {
    e.preventDefault();
    navigate(reports[focusedIdx].path);
  }, { enableOnFormTags: false });

  // Escape to Dashboard
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/dashboard');
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Modul Pelaporan Bisnis</h1>
        <p className="text-slate-400">Analisa laporan omzet penjualan, stok gudang, hutang piutang, dan rekam audit kas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {reports.map((rep, idx) => {
          const Icon = rep.icon;
          const isFocused = idx === focusedIdx;
          return (
            <button
              key={rep.path}
              onClick={() => navigate(rep.path)}
              className={`card text-left p-6 flex flex-col justify-between border transition-all cursor-pointer h-48 ${
                isFocused ? 'card-focused ring-2 ring-primary-500/30 scale-[1.01]' : rep.color
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <div className="p-3 bg-surface-800 rounded-xl shrink-0 border border-surface-700/50">
                  <Icon size={20} className={isFocused ? 'text-primary-500' : ''} />
                </div>
                <span className="shortcut-badge text-[9px] uppercase tracking-normal">Tekan {rep.num}</span>
              </div>
              <div className="space-y-1 mt-4 w-full">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">{rep.title}</h3>
                  <ChevronRight size={14} className={isFocused ? 'text-primary-400 animate-pulse' : 'text-slate-500'} />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{rep.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end text-[11px] text-slate-500 mt-4">
        <span>Gunakan <kbd className="shortcut-badge">←</kbd> <kbd className="shortcut-badge">→</kbd> <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih, <kbd className="shortcut-badge">Enter</kbd> masuk, <kbd className="shortcut-badge">Esc</kbd> keluar</span>
      </div>
    </div>
  );
};
