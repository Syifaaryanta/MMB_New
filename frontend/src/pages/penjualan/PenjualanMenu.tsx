import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { TrendingUp, PlusCircle, Clock, List, FileText, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PenjualanStats {
  hariIni: number;
  mingguIni: number;
  bulanIni: number;
  total: number;
}

export const PenjualanMenu: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PenjualanStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats/penjualan');
        setStats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const subMenus = [
    {
      title: 'Buat Order SO (POS)',
      desc: 'Mulai pesanan penjualan baru, kelola pelanggan, limit kredit, dan pengiriman.',
      path: '/penjualan/buat',
      icon: PlusCircle,
      iconColor: 'text-primary-400',
      iconBg: 'bg-primary-50',
    },
    {
      title: 'Order Penjualan Tertunda (Draft)',
      desc: 'Buka kembali draf nota penjualan yang ditunda untuk diselesaikan.',
      path: '/penjualan/draft',
      icon: Clock,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-50',
    },
    {
      title: 'Edit Nota Penjualan',
      desc: 'Cari nota penjualan aktif (Draft/Complete) untuk direvisi barang/pengirimannya.',
      path: '/penjualan/edit',
      icon: FileText,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50',
    },
    {
      title: 'Daftar & Histori Penjualan',
      desc: 'Lacak riwayat lengkap nota faktur penjualan, reprint nota, atau pembatalan.',
      path: '/penjualan/list',
      icon: List,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
    },
  ];

  // Keyboard Navigation
  useHotkeys('right', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev + 1) % subMenus.length);
  }, { enableOnFormTags: false });

  useHotkeys('left', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev - 1 + subMenus.length) % subMenus.length);
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev < 2 ? prev + 2 : prev - 2));
  }, { enableOnFormTags: false });

  useHotkeys('up', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev >= 2 ? prev - 2 : prev + 2));
  }, { enableOnFormTags: false });

  useHotkeys('enter', (e) => {
    e.preventDefault();
    navigate(subMenus[focusedIdx].path);
  }, { enableOnFormTags: false });

  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/dashboard');
  }, { enableOnFormTags: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Modul Penjualan (Point of Sale)</h1>
        <p className="text-slate-400">Pencatatan kasir penjualan barang (SO), verifikasi kredit limit, dan cetak faktur.</p>
      </div>

      {/* Stats Board */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 skeleton" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Omzet Hari Ini</span>
            <span className="text-xl font-bold text-white mt-1 currency">{formatCurrency(stats.hariIni)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Omzet Minggu Ini</span>
            <span className="text-xl font-bold text-primary-400 mt-1 currency">{formatCurrency(stats.mingguIni)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Omzet Bulan Ini</span>
            <span className="text-xl font-bold text-emerald-400 mt-1 currency">{formatCurrency(stats.bulanIni)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Akumulasi</span>
            <span className="text-xl font-bold text-indigo-400 mt-1 currency">{formatCurrency(stats.total)}</span>
          </div>
        </div>
      ) : null}

      {/* Sub Menu Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subMenus.map((menu, idx) => {
          const Icon = menu.icon;
          const isFocused = idx === focusedIdx;
          return (
            <button
              key={menu.path}
              onClick={() => navigate(menu.path)}
              className={`card text-left p-6 flex gap-5 border transition-all duration-150 cursor-pointer ${
                isFocused
                  ? 'card-focused ring-2 ring-primary-500/30 scale-[1.01]'
                  : 'border-surface-700/50 hover:bg-surface-800'
              }`}
            >
              <div className={`p-3 rounded-xl shrink-0 ${menu.iconColor} ${menu.iconBg}`}>
                <Icon size={24} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-white">{menu.title}</h3>
                  <ChevronRight size={16} className={isFocused ? 'text-primary-400 animate-pulse' : 'text-slate-500'} />
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{menu.desc}</p>
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
