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
      iconColor: 'text-primary-600',
      iconBg: 'bg-primary-50',
      num: '1',
    },
    {
      title: 'Penjualan Detail',
      desc: 'Margin laba kotor, rincian produk terjual, dan status transaksi per pelanggan.',
      path: '/laporan/penjualan-detail',
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      num: '2',
    },
    {
      title: 'Pembelian Detail',
      desc: 'Analisa barang masuk, supplier pengirim, dan harga beli historis.',
      path: '/laporan/pembelian-detail',
      icon: ShoppingBag,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      num: '3',
    },
    {
      title: 'Stok Persediaan',
      desc: 'Nilai aset persediaan gudang saat ini dan monitoring stok kritis.',
      path: '/laporan/stok-persediaan',
      icon: Package,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      num: '4',
    },
    {
      title: 'Penagihan Piutang (AR)',
      desc: 'Laporan umur piutang (aging report) per customer (30, 60, 90+ hari).',
      path: '/laporan/penagihan-piutang',
      icon: CreditCard,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      num: '5',
    },
    {
      title: 'Laporan Hutang (AP)',
      desc: 'Daftar hutang jatuh tempo ke supplier berdasarkan invoice pembelian kredit.',
      path: '/laporan/hutang',
      icon: TrendingDown,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
      num: '6',
    },
    {
      title: 'Arus Kas (Cash Flow)',
      desc: 'Rekapitulasi total kas masuk (Tunai/Pelunasan) vs total kas keluar (Pembelian).',
      path: '/laporan/arus-kas',
      icon: Wallet,
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-50',
      num: '7',
    },
    {
      title: 'Audit Log Aktivitas',
      desc: 'Lacak riwayat penyesuaian stok manual gudang dan aktivitas krusial.',
      path: '/laporan/audit-aktivitas',
      icon: ShieldAlert,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
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
    setFocusedIdx((prev) => (prev + 2) % reports.length);
  }, { enableOnFormTags: false });

  useHotkeys('up', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev - 2 + reports.length) % reports.length);
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
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-950">Modul Pelaporan Bisnis</h1>
        <p className="text-slate-550 mt-1">Analisa laporan omzet penjualan, stok gudang, hutang piutang, dan rekam audit kas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((rep, idx) => {
          const Icon = rep.icon;
          const isFocused = idx === focusedIdx;
          return (
            <button
              key={rep.path}
              onClick={() => navigate(rep.path)}
              className={`card text-left p-6 flex gap-5 border transition-all duration-150 cursor-pointer ${isFocused ? 'card-focused ring-2 ring-primary-500/30 scale-[1.01]' : 'border-slate-200/80 bg-white hover:bg-slate-50'
                }`}
            >
              <div className={`p-3 rounded-xl shrink-0 ${rep.iconColor} ${rep.iconBg}`}>
                <Icon size={24} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    {rep.title}
                  </h3>
                  <ChevronRight size={16} className={isFocused ? 'text-primary-600 animate-pulse' : 'text-slate-400'} />
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {rep.desc}
                </p>
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
