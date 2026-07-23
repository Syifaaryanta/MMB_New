import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { TrendingUp, PlusCircle, Clock, List, FileText, ChevronRight, Undo2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PenjualanStats {
  hariIni: number;
  mingguIni: number;
  bulanIni: number;
  total: number;
}

export const PenjualanMenu: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
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
      title: lang === 'en' ? 'Create Sales Order (POS)' : 'Buat Order SO (POS)',
      desc: lang === 'en' ? 'Start a new sales order, manage customers, credit limits, and delivery.' : 'Mulai pesanan penjualan baru, kelola pelanggan, limit kredit, dan pengiriman.',
      path: '/penjualan/buat',
      icon: PlusCircle,
      iconColor: 'text-primary-400',
      iconBg: 'bg-primary-50',
    },
    {
      title: lang === 'en' ? 'Pending Sales Orders (Draft)' : 'Order Penjualan Tertunda (Draft)',
      desc: lang === 'en' ? 'Reopen a pending draft sales order to complete it.' : 'Buka kembali draf nota penjualan yang ditunda untuk diselesaikan.',
      path: '/penjualan/draft',
      icon: Clock,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-50',
    },
    {
      title: lang === 'en' ? 'Edit Sales Invoice' : 'Edit Nota Penjualan',
      desc: lang === 'en' ? 'Search active invoices (Draft/Complete) to revise items or delivery.' : 'Cari nota penjualan aktif (Draft/Complete) untuk direvisi barang/pengirimannya.',
      path: '/penjualan/edit',
      icon: FileText,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50',
    },
    {
      title: lang === 'en' ? 'Sales Return' : 'Retur Penjualan (Sales Return)',
      desc: lang === 'en' ? 'Manage customer returns, item replacement, receivable deduction, or refund.' : 'Kelola pengembalian barang dari customer, ganti barang, potong piutang, atau refund.',
      path: '/penjualan/retur',
      icon: Undo2,
      iconColor: 'text-rose-500',
      iconBg: 'bg-rose-50',
    },
    {
      title: lang === 'en' ? 'Sales List & History' : 'Daftar & Histori Penjualan',
      desc: lang === 'en' ? 'Track complete invoice history, reprint invoices, or cancel transactions.' : 'Lacak riwayat lengkap nota faktur penjualan, reprint nota, atau pembatalan.',
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
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">
          {lang === 'en' ? 'Sales Module (Point of Sale)' : 'Modul Penjualan (Point of Sale)'}
        </h1>
        <p className="text-slate-400">
          {lang === 'en'
            ? 'Record sales transactions (SO), verify credit limits, and print invoices.'
            : 'Pencatatan kasir penjualan barang (SO), verifikasi kredit limit, dan cetak faktur.'}
        </p>
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
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? "Today's Revenue" : 'Omzet Hari Ini'}
            </span>
            <span className="text-xl font-bold text-white mt-1 currency">{formatCurrency(stats.hariIni)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'This Week Revenue' : 'Omzet Minggu Ini'}
            </span>
            <span className="text-xl font-bold text-primary-400 mt-1 currency">{formatCurrency(stats.mingguIni)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'This Month Revenue' : 'Omzet Bulan Ini'}
            </span>
            <span className="text-xl font-bold text-emerald-400 mt-1 currency">{formatCurrency(stats.bulanIni)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'Total Cumulative' : 'Total Akumulasi'}
            </span>
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
              className={`card text-left p-6 flex items-center gap-5 border transition-all duration-150 cursor-pointer ${isFocused
                ? 'card-focused ring-2 ring-primary-500/30 scale-[1.01]'
                : 'border-surface-700/50 hover:bg-surface-800'
                }`}
            >
              <div className={`p-3 rounded-xl shrink-0 ${menu.iconColor} ${menu.iconBg}`}>
                <Icon size={24} />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-bold text-lg text-white truncate">{menu.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{menu.desc}</p>
              </div>
              <ChevronRight size={16} className={`shrink-0 ${isFocused ? 'text-primary-400 animate-pulse' : 'text-slate-500'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
