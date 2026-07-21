import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from '@/lib/i18n';
import {
  PackageCheck,
  PackageMinus,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  ChevronRight,
  History,
  Undo2,
  DollarSign,
} from 'lucide-react';

export const HistoryMenu: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [focusedIdx, setFocusedIdx] = useState(0);

  const subMenus = [
    {
      title: lang === 'en' ? 'Goods In/Out History' : 'Histori Barang Masuk & Keluar',
      desc: lang === 'en' ? 'Log of goods movement: incoming (PO), outgoing (SO), and stock adjustments by staff.' : 'Log pergerakan barang masuk (PO), keluar (SO), serta penyesuaian stok oleh staff.',
      path: '/history/barang-inout',
      icon: History,
      iconColor: 'text-primary-600',
      iconBg: 'bg-primary-50',
    },
    {
      title: lang === 'en' ? 'Sales History' : 'Histori Penjualan',
      desc: lang === 'en' ? 'Completed Sales Orders (SO) with item details and customer info.' : 'Riwayat Sales Order (SO) yang sudah selesai beserta detail item dan customer.',
      path: '/penjualan/list?from=history',
      icon: TrendingUp,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      title: lang === 'en' ? 'Purchase History' : 'Histori Pembelian',
      desc: lang === 'en' ? 'Completed Purchase Orders (PO) with item details and supplier info.' : 'Riwayat Purchase Order (PO) yang sudah diterima beserta detail item dan supplier.',
      path: '/pembelian/history-pembelian?from=history',
      icon: ShoppingCart,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
    {
      title: lang === 'en' ? 'Customer Payment History' : 'Histori Pembayaran Pelanggan',
      desc: lang === 'en' ? 'History of cash receipts and invoice installment payments from customers.' : 'Riwayat penerimaan kas dan cicilan pembayaran nota dari pelanggan.',
      path: '/penagihan/history-pembayaran?from=history',
      icon: CreditCard,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
    },
    {
      title: lang === 'en' ? 'Supplier Settlement History' : 'Histori Pelunasan Supplier',
      desc: lang === 'en' ? 'History of cash expenditures for settling supplier invoices/payables.' : 'Riwayat pengeluaran kas untuk pelunasan nota/hutang belanja kepada supplier.',
      path: '/penagihan/history-pelunasan?from=history',
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      title: lang === 'en' ? 'Return History' : 'Histori Return / Retur',
      desc: lang === 'en' ? 'Combined history of purchase returns (PO) and sales returns (SO).' : 'Riwayat retur pembelian (PO) dan retur penjualan (SO) yang digabung.',
      path: '/history/retur',
      icon: Undo2,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
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
    setFocusedIdx((prev) => (prev + 2) % subMenus.length);
  }, { enableOnFormTags: false });

  useHotkeys('up', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev - 2 + subMenus.length) % subMenus.length);
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
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            {lang === 'en' ? 'Transaction History' : 'Histori Transaksi'}
          </h1>
        </div>
        <p className="text-slate-400 ml-[52px]">
          {lang === 'en'
            ? 'Central history of all goods movements and MMB business transactions.'
            : 'Pusat riwayat seluruh pergerakan barang dan transaksi bisnis MMB.'}
        </p>
      </div>

      {/* Grid Menu */}
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
                  <ChevronRight
                    size={16}
                    className={isFocused ? 'text-primary-400 animate-pulse' : 'text-slate-500'}
                  />
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{menu.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
