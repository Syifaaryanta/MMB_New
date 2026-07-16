import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { CreditCard, FileSpreadsheet, History, FileCheck, ChevronRight, Wallet, ShoppingBag } from 'lucide-react';

interface PenagihanStats {
  totalPiutang: number;
  overdueCount: number;
}

export const PenagihanMenu: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PenagihanStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats/penagihan');
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
      title: 'Piutang Aktif',
      desc: 'Daftar piutang aktif per pelanggan, rincian nota, dan pencatatan angsuran/pelunasan).',
      path: '/penagihan/piutang',
      icon: CreditCard,
      iconColor: 'text-rose-500',
      iconBg: 'bg-rose-50',
      keyChar: '1',
    },
    {
      title: 'Pelunasan Supplier (AP)',
      desc: 'Kelola pembayaran hutang PO ke supplier dengan sistem angsuran FIFO atau Manual.',
      path: '/penagihan/supplier',
      icon: ShoppingBag,
      iconColor: 'text-sky-500',
      iconBg: 'bg-sky-50',
      keyChar: '2',
    },
    {
      title: 'Manajemen Nota (3-Color)',
      desc: 'Ceklis serah terima fisik Nota Merah (Finance), Putih (Customer), & Kuning (Gudang).',
      path: '/penagihan/nota',
      icon: FileCheck,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
      keyChar: '3',
    },
    {
      title: 'Pelanggan Lunas & Rincian Nota',
      desc: 'Lihat rincian riwayat nota penjualan pelanggan yang telah diselesaikan (lunas) secara lengkap.',
      path: '/penagihan/lunas',
      icon: FileCheck,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
      keyChar: '4',
    },
    {
      title: 'History Pembayaran Customer (AR)',
      desc: 'Audit log setoran cicilan piutang customer (AR) lengkap dengan cetak kuitansi.',
      path: '/penagihan/history-pembayaran',
      icon: History,
      iconColor: 'text-indigo-500',
      iconBg: 'bg-indigo-50',
      keyChar: '5',
    },
    {
      title: 'History Pelunasan Supplier (AP)',
      desc: 'Audit log pencatatan pembayaran PO supplier (AP) secara terperinci.',
      path: '/penagihan/history-pelunasan',
      icon: History,
      iconColor: 'text-violet-500',
      iconBg: 'bg-violet-50',
      keyChar: '6',
    },
  ];

  // Hotkeys
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/dashboard');
  });

  useHotkeys('1', () => navigate('/penagihan/piutang'));
  useHotkeys('2', () => navigate('/penagihan/supplier'));
  useHotkeys('3', () => navigate('/penagihan/nota'));
  useHotkeys('4', () => navigate('/penagihan/lunas'));
  useHotkeys('5', () => navigate('/penagihan/history-pembayaran'));
  useHotkeys('6', () => navigate('/penagihan/history-pelunasan'));

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
    setFocusedIdx((prev) => (prev + 2) % subMenus.length);
  }, { enableOnFormTags: false }, [subMenus.length]);

  useHotkeys('up', (e) => {
    e.preventDefault();
    setFocusedIdx((prev) => (prev - 2 + subMenus.length) % subMenus.length);
  }, { enableOnFormTags: false }, [subMenus.length]);

  useHotkeys('enter', (e) => {
    e.preventDefault();
    navigate(subMenus[focusedIdx].path);
  }, { enableOnFormTags: false }, [focusedIdx]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Modul Penagihan (AR & AP)</h1>
        <p className="text-slate-400">Monitoring piutang aktif, pelunasan hutang supplier, manajemen dokumen fisik nota, dan pencatatan kas masuk/keluar.</p>
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
          <div className="card p-6 flex items-center justify-between border-l-4 border-rose-500 bg-surface-800">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Sisa Piutang Aktif</span>
              <span className="text-2xl font-black text-rose-400 currency">{formatCurrency(stats.totalPiutang)}</span>
            </div>
            <div className="p-3 bg-rose-950 text-rose-400 rounded-xl">
              <Wallet size={24} />
            </div>
          </div>

          {/* Card 2 */}
          <div className="card p-6 flex items-center justify-between border-l-4 border-amber-500 bg-surface-800">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Nota Jatuh Tempo (Overdue)</span>
              <span className="text-2xl font-black text-amber-400">{stats.overdueCount} Nota</span>
            </div>
            <div className="p-3 bg-amber-950 text-amber-400 rounded-xl">
              <ClockIcon size={24} />
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
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    {menu.title}

                  </h3>
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

const ClockIcon = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
