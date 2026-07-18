import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { Database, Users, Truck, ChevronRight } from 'lucide-react';

interface MasterDataStats {
  customers: number;
  suppliers: number;
}

export const MasterDataMenu: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MasterDataStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [custRes, suppRes] = await Promise.all([
          api.get('/customers?limit=1'),
          api.get('/suppliers?limit=1'),
        ]);
        setStats({
          customers: custRes.data.total || 0,
          suppliers: suppRes.data.total || 0,
        });
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
      title: 'Master Pelanggan (Customer)',
      desc: 'Kelola profil data pelanggan, alamat, kontak, limit kredit, dan termin jatuh tempo.',
      path: '/master-data/customer',
      icon: Users,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      title: 'Master Supplier',
      desc: 'Kelola profil data pemasok barang, alamat, kontak, dan termin pembayaran.',
      path: '/master-data/supplier',
      icon: Truck,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
  ];

  // Hotkeys
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/dashboard');
  });

  useHotkeys('1', () => navigate('/master-data/customer'));
  useHotkeys('2', () => navigate('/master-data/supplier'));

  // Keyboard Grid Navigation
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
    setFocusedIdx((prev) => (prev + 1) % subMenus.length);
  }, { enableOnFormTags: false }, [subMenus.length]);

  useHotkeys('up', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev - 1 + subMenus.length) % subMenus.length);
  }, { enableOnFormTags: false }, [subMenus.length]);

  useHotkeys('enter', (e) => {
    e.preventDefault();
    navigate(subMenus[focusedIdx].path);
  }, { enableOnFormTags: false }, [focusedIdx]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-xl bg-primary-600/10 text-primary-400">
            <Database size={22} />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Modul Master Data</h1>
        </div>
        <p className="text-slate-400 ml-[52px]">
          Kelola data profil pelanggan (Customer) dan pemasok barang (Supplier) MMB.
        </p>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1 */}
          <div className="card p-6 flex items-center justify-between border-l-4 border-blue-500 bg-surface-800">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Pelanggan</span>
              <span className="text-2xl font-black text-blue-400">{stats.customers} Pelanggan</span>
            </div>
            <div className="p-3 bg-blue-950 text-blue-400 rounded-xl">
              <Users size={24} />
            </div>
          </div>

          {/* Card 2 */}
          <div className="card p-6 flex items-center justify-between border-l-4 border-amber-500 bg-surface-800">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Supplier</span>
              <span className="text-2xl font-black text-amber-400">{stats.suppliers} Supplier</span>
            </div>
            <div className="p-3 bg-amber-950 text-amber-400 rounded-xl">
              <Truck size={24} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Grid Sub-Menus */}
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
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    {menu.title}
                  </h3>
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
