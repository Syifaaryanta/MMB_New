import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  PackageCheck,
  PackageMinus,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  ChevronRight,
  History,
} from 'lucide-react';

export const HistoryMenu: React.FC = () => {
  const navigate = useNavigate();
  const [focusedIdx, setFocusedIdx] = useState(0);

  const subMenus = [
    {
      title: 'Histori Barang Masuk',
      desc: 'Log penerimaan barang ke gudang dari Purchase Order yang sudah diterima.',
      path: '/history/barang-masuk',
      icon: PackageCheck,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      badge: 'Gudang',
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'Histori Barang Keluar',
      desc: 'Log pengiriman barang ke pelanggan dari Sales Order yang sudah selesai.',
      path: '/history/barang-keluar',
      icon: PackageMinus,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      badge: 'Gudang',
      badgeColor: 'bg-rose-100 text-rose-700',
    },
    {
      title: 'Histori Penjualan',
      desc: 'Riwayat Sales Order (SO) yang sudah selesai beserta detail item dan customer.',
      path: '/penjualan/list?from=history',
      icon: TrendingUp,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      badge: 'Penjualan',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      title: 'Histori Pembelian',
      desc: 'Riwayat Purchase Order (PO) yang sudah diterima beserta detail item dan supplier.',
      path: '/pembelian/history-pembelian?from=history',
      icon: ShoppingCart,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      badge: 'Pembelian',
      badgeColor: 'bg-amber-100 text-amber-700',
    },
    {
      title: 'Histori Penagihan',
      desc: 'Riwayat pembayaran piutang dan pelunasan nota dari pelanggan.',
      path: '/penagihan/riwayat?from=history',
      icon: CreditCard,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
      badge: 'Penagihan',
      badgeColor: 'bg-purple-100 text-purple-700',
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
    setFocusedIdx((prev) => (prev + 3) % subMenus.length);
  }, { enableOnFormTags: false });

  useHotkeys('up', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev - 3 + subMenus.length) % subMenus.length);
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
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-xl bg-primary-600/10 text-primary-400">
            <History size={22} />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Histori Transaksi</h1>
        </div>
        <p className="text-slate-400 ml-[52px]">
          Pusat riwayat seluruh pergerakan barang dan transaksi bisnis MMB.
        </p>
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-surface-800/50 border border-surface-700 rounded-lg px-4 py-2 w-fit">
        <span>Navigasi:</span>
        <kbd className="shortcut-badge">← →</kbd>
        <kbd className="shortcut-badge">↑ ↓</kbd>
        <span>pilih menu</span>
        <span className="mx-1 text-slate-600">|</span>
        <kbd className="shortcut-badge">Enter</kbd>
        <span>buka</span>
        <span className="mx-1 text-slate-600">|</span>
        <kbd className="shortcut-badge">Esc</kbd>
        <span>kembali ke Dashboard</span>
      </div>

      {/* Grid Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subMenus.map((menu, idx) => {
          const Icon = menu.icon;
          const isFocused = idx === focusedIdx;
          return (
            <button
              key={menu.path}
              onClick={() => navigate(menu.path)}
              className={`card text-left p-6 flex gap-4 border transition-all duration-150 cursor-pointer ${
                isFocused
                  ? 'card-focused ring-2 ring-primary-500/30 scale-[1.01]'
                  : 'border-surface-700/50 hover:bg-surface-800'
              }`}
            >
              <div className={`p-3 rounded-xl shrink-0 ${menu.iconColor} ${menu.iconBg}`}>
                <Icon size={20} />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-base text-white">{menu.title}</h3>
                  <ChevronRight
                    size={14}
                    className={isFocused ? 'text-primary-400 animate-pulse' : 'text-slate-500'}
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{menu.desc}</p>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${menu.badgeColor}`}>
                  {menu.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
