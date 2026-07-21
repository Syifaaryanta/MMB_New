import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Package, Tags, Trash2, List, ChevronRight, Loader2 } from 'lucide-react';

interface GudangStats {
  totalSku: number;
  amanStok: number;
  kritisStok: number;
  totalSupplier: number;
}

export const GudangMenu: React.FC = () => {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const [stats, setStats] = useState<GudangStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keyboard navigation state
  const [focusedIdx, setFocusedIdx] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats/gudang');
        setStats(res.data);
      } catch (err) {
        console.error('Gagal memuat statistik gudang', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const subMenus = [
    {
      title: lang === 'en' ? 'Price Information' : 'Informasi Harga',
      desc: lang === 'en' ? 'Quick check of selling price, last purchase price, last sales qty, cost estimate.' : 'Cek cepat harga jual, harga beli terakhir, qty penjualan terakhir, estimasi cost.',
      path: '/gudang/cek-harga',
      icon: Tags,
      iconColor: 'text-primary-400',
      iconBg: 'bg-primary-50/10',
    },
    {
      title: lang === 'en' ? 'Manage Products (Catalog)' : 'Kelola Produk (Katalog)',
      desc: lang === 'en' ? 'Add/Edit products, manage supplier-price relations, quick archive.' : 'Tambah/Edit produk, kelola relasi supplier-harga, arsip cepat.',
      path: '/gudang/katalog',
      icon: Package,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50/10',
    },
    {
      title: lang === 'en' ? 'Archived Products' : 'Arsip Produk',
      desc: lang === 'en' ? 'View archived products and restore them.' : 'Lihat produk yang diarsipkan dan lakukan pemulihan (restore) produk.',
      path: '/gudang/archive',
      icon: Trash2,
      iconColor: 'text-danger-400',
      iconBg: 'bg-red-50/10',
    },
    {
      title: lang === 'en' ? 'Inventory List' : 'Daftar Inventori',
      desc: lang === 'en' ? 'Compact table view of all warehouse stock in real-time.' : 'Tampilan tabel ringkas dari seluruh persediaan gudang secara real-time.',
      path: '/gudang/cek-semua',
      icon: List,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50/10',
    },
  ];

  // Hotkeys for menu navigation
  useHotkeys('right', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev % 2 === 0 ? prev + 1 : prev - 1));
  }, { enableOnFormTags: false });

  useHotkeys('left', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev % 2 === 1 ? prev - 1 : prev + 1));
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
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">
          {lang === 'en' ? 'Inventory & Warehouse Module' : 'Modul Gudang & Inventori'}
        </h1>
        <p className="text-slate-400">
          {lang === 'en'
            ? 'Manage product stock, check prices, and manage the MMB product catalog.'
            : 'Kelola persediaan barang, cek harga jual-beli, dan kelola katalog produk MMB.'}
        </p>
      </div>

      {/* Mini Stats Dashboard */}
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
              {lang === 'en' ? 'Total Active SKU' : 'Total SKU Aktif'}
            </span>
            <span className="text-2xl font-bold text-white mt-1">{stats.totalSku}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'Safe Stock' : 'Stok Aman'}
            </span>
            <span className="text-2xl font-bold text-emerald-400 mt-1">{stats.amanStok}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'Critical Stock (Restock Needed)' : 'Stok Kritis (Perlu Restock)'}
            </span>
            <span className="text-2xl font-bold text-danger-400 mt-1">{stats.kritisStok}</span>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              {lang === 'en' ? 'Partner Suppliers' : 'Rekan Supplier'}
            </span>
            <span className="text-2xl font-bold text-primary-400 mt-1">{stats.totalSupplier}</span>
          </div>
        </div>
      ) : null}

      {/* Sub Navigation Cards */}
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
