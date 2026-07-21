import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { ShoppingCart, Clock, CheckSquare, Users, History, FileText, ChevronRight, Redo2 } from 'lucide-react';

interface PembelianStats {
  totalPO: number;
  menungguTerima: number;
  sudahDiterima: number;
  supplierAktif: number;
}

export const PembelianMenu: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [stats, setStats] = useState<PembelianStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats/pembelian');
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
      title: lang === 'en' ? 'Create Purchase Order' : 'Buat Order PO',
      desc: lang === 'en' ? 'Create a new Purchase Order to the supplier.' : 'Buat surat pesanan pembelian baru (Purchase Order) ke supplier.',
      path: '/pembelian/order',
      icon: ShoppingCart,
      iconColor: 'text-primary-400',
      iconBg: 'bg-primary-50',
    },
    {
      title: lang === 'en' ? 'Pending Orders (Draft)' : 'Order Tertunda (Draft)',
      desc: lang === 'en' ? 'Continue filling draft PO or delete draft transactions.' : 'Lanjutkan pengisian draf PO atau hapus draf transaksi.',
      path: '/pembelian/draft',
      icon: Clock,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-50',
    },
    {
      title: lang === 'en' ? 'Edit Purchase Order' : 'Edit Order PO',
      desc: lang === 'en' ? 'Search active PO numbers with draft or completed status to edit.' : 'Cari nomor PO aktif yang berstatus draf atau selesai untuk diedit.',
      path: '/pembelian/edit-order',
      icon: FileText,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50',
    },
    {
      title: lang === 'en' ? 'Purchase Receiving' : 'Receiving Pembelian',
      desc: lang === 'en' ? 'Record physical receipt of goods to the warehouse to add stock.' : 'Pencatatan penerimaan fisik barang ke gudang untuk menambah stok.',
      path: '/pembelian/receiving',
      icon: CheckSquare,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
    },
    {
      title: lang === 'en' ? 'Purchase Return' : 'Retur Pembelian (Purchase Return)',
      desc: lang === 'en' ? 'Record goods returned to supplier, deduct payable, or replace items.' : 'Pencatatan barang yang dikembalikan ke supplier, potong hutang, atau ganti barang.',
      path: '/pembelian/retur',
      icon: Redo2,
      iconColor: 'text-rose-500',
      iconBg: 'bg-rose-50',
    },
    {
      title: lang === 'en' ? 'Purchase History' : 'Histori Pembelian',
      desc: lang === 'en' ? 'List of completed PO notes with item details.' : 'Daftar riwayat nota PO yang telah diselesaikan beserta detail item.',
      path: '/pembelian/history-pembelian',
      icon: History,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
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
          {lang === 'en' ? 'Purchasing Module (PO)' : 'Modul Pembelian (PO)'}
        </h1>
        <p className="text-slate-400">
          {lang === 'en'
            ? 'Manage incoming goods procurement, purchase orders, and warehouse receiving.'
            : 'Kelola pengadaan barang masuk, purchase order, dan receiving gudang.'}
        </p>
      </div>

      {/* Stats Cards */}
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
              {lang === 'en' ? 'Total PO Created' : 'Total PO Dibuat'}
            </span>
            <span className="text-2xl font-bold text-white mt-1">{stats.totalPO}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'Awaiting Receiving' : 'Menunggu Penerimaan'}
            </span>
            <span className="text-2xl font-bold text-yellow-400 mt-1">{stats.menungguTerima}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'Already Received' : 'Sudah Diterima (Received)'}
            </span>
            <span className="text-2xl font-bold text-emerald-400 mt-1">{stats.sudahDiterima}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'Registered Suppliers' : 'Supplier Terdaftar'}
            </span>
            <span className="text-2xl font-bold text-primary-400 mt-1">{stats.supplierAktif}</span>
          </div>
        </div>
      ) : null}

      {/* Grid Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subMenus.map((menu, idx) => {
          const Icon = menu.icon;
          const isFocused = idx === focusedIdx;
          return (
            <button
              key={menu.path}
              onClick={() => navigate(menu.path)}
              className={`card text-left p-6 flex gap-5 border transition-all duration-150 cursor-pointer ${isFocused
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
    </div>
  );
};
