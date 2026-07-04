import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Package,
  AlertTriangle,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Clock,
  ClipboardList,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface KPI {
  total_omzet: number;
  total_transaksi: number;
  total_pembelian: number;
  total_produk: number;
  total_customer: number;
  total_supplier: number;
  pending_receiving: number;
  total_piutang: number;
  stok_kritis: number;
  today_omzet: number;
  today_transaksi: number;
  today_barang_keluar: number;
}

interface TrendData {
  date: string;
  omzet: number;
  pembelian: number;
  penjualan: number;
}

interface RecentBarangKeluar {
  id: string;
  no_order: string;
  customer: string;
  total: number;
  itemCount: number;
  totalQty: number;
  waktu: string | null;
}

// Target harian: Rp 33.000.000 | bulanan: Rp 1.000.000.000
const TARGET_HARIAN = 33_000_000;
const TARGET_BULANAN = 1_000_000_000;

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'30' | '180' | '365'>('30');
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [recentBarangKeluar, setRecentBarangKeluar] = useState<RecentBarangKeluar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [isCalendarFocused, setIsCalendarFocused] = useState(false);

  const getFormattedDateString = (year: number, month: number, day: number): string => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const getDailySales = (day: number): number => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = getFormattedDateString(year, month, day);
    const found = trend.find((t) => t.date === dateStr);
    return found ? found.omzet : 0;
  };

  const getDayColorClass = (day: number): string => {
    const sales = getDailySales(day);
    if (sales === 0) return 'bg-rose-500/10 text-rose-300 border-rose-500/10 hover:bg-rose-500/20';
    if (sales >= TARGET_HARIAN) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30';
    if (sales >= 15_000_000) return 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30';
    return 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20';
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    return days;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const fetchDashboardData = async (currentPeriod: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [kpiRes, recentRes] = await Promise.all([
        api.get(`/dashboard/kpi?period=${currentPeriod}`),
        api.get('/dashboard/recent-barang-keluar'),
      ]);
      setKpi(kpiRes.data.kpi);
      setTrend(kpiRes.data.trend || []);
      setRecentBarangKeluar(recentRes.data.items || []);
    } catch (err) {
      setError('Gagal memuat data dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(period);
  }, [period]);

  useEffect(() => {
    const event = new CustomEvent('calendar-focus-change', { detail: isCalendarFocused });
    window.dispatchEvent(event);
    return () => {
      window.dispatchEvent(new CustomEvent('calendar-focus-change', { detail: false }));
    };
  }, [isCalendarFocused]);

  // Keyboard Shortcuts
  useHotkeys('f1', (e) => { e.preventDefault(); setPeriod('30'); }, { enableOnFormTags: false });
  useHotkeys('f2', (e) => { e.preventDefault(); setPeriod('180'); }, { enableOnFormTags: false });
  useHotkeys('f3', (e) => { e.preventDefault(); setPeriod('365'); }, { enableOnFormTags: false });
  useHotkeys('f4', (e) => { e.preventDefault(); navigate('/penjualan/list', { state: { skipFilter: true } }); }, { enableOnFormTags: false });
  useHotkeys('f5', (e) => { e.preventDefault(); fetchDashboardData(period); }, { enableOnFormTags: false });
  useHotkeys('f6', (e) => {
    e.preventDefault();
    setIsCalendarFocused(true);
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today.getDate());
  }, { enableOnFormTags: false });
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (isCalendarFocused) {
      setIsCalendarFocused(false);
      setSelectedDay(null);
    } else {
      setPeriod('30');
    }
  }, { enableOnFormTags: false }, [isCalendarFocused]);
  useHotkeys('5', (e) => { e.preventDefault(); navigate('/master-data'); }, { enableOnFormTags: false });
  useHotkeys('6', (e) => { e.preventDefault(); navigate('/pembelian/history'); }, { enableOnFormTags: false });

  // Arrow Keys & Enter for Calendar (Hanya aktif saat isCalendarFocused = true)
  useHotkeys('left', (e) => {
    if (!isCalendarFocused || selectedDay === null) return;
    e.preventDefault();
    const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay - 1);
    setCurrentDate(prevDate);
    setSelectedDay(prevDate.getDate());
  }, { enableOnFormTags: false }, [isCalendarFocused, selectedDay, currentDate]);

  useHotkeys('right', (e) => {
    if (!isCalendarFocused || selectedDay === null) return;
    e.preventDefault();
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay + 1);
    setCurrentDate(nextDate);
    setSelectedDay(nextDate.getDate());
  }, { enableOnFormTags: false }, [isCalendarFocused, selectedDay, currentDate]);

  useHotkeys('up', (e) => {
    if (!isCalendarFocused || selectedDay === null) return;
    e.preventDefault();
    const prevWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay - 7);
    setCurrentDate(prevWeek);
    setSelectedDay(prevWeek.getDate());
  }, { enableOnFormTags: false }, [isCalendarFocused, selectedDay, currentDate]);

  useHotkeys('down', (e) => {
    if (!isCalendarFocused || selectedDay === null) return;
    e.preventDefault();
    const nextWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay + 7);
    setCurrentDate(nextWeek);
    setSelectedDay(nextWeek.getDate());
  }, { enableOnFormTags: false }, [isCalendarFocused, selectedDay, currentDate]);

  useHotkeys('enter', (e) => {
    if (!isCalendarFocused || selectedDay === null) return;
    e.preventDefault();
    const dateStr = getFormattedDateString(currentDate.getFullYear(), currentDate.getMonth(), selectedDay);
    navigate('/penjualan/list', { state: { date: dateStr } });
  }, { enableOnFormTags: false }, [isCalendarFocused, selectedDay, currentDate]);

  const getPeriodLabel = () => {
    if (period === '30') return '30 Hari Terakhir';
    if (period === '180') return '6 Bulan Terakhir';
    return '1 Tahun Terakhir';
  };

  const formatWaktu = (waktu: string | null): string => {
    if (!waktu) return '-';
    try {
      return new Date(waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch { return '-'; }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Dashboard Operasional</h1>
          <p className="text-slate-400">Ringkasan kinerja MMB untuk periode {getPeriodLabel()}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg p-0.5 bg-surface-800 border border-surface-700">
            <button
              onClick={() => setPeriod('30')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${period === '30' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              30 Hari (F1)
            </button>
            <button
              onClick={() => setPeriod('180')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${period === '180' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              6 Bulan (F2)
            </button>
            <button
              onClick={() => setPeriod('365')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${period === '365' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              1 Tahun (F3)
            </button>
          </div>

          <button
            onClick={() => fetchDashboardData(period)}
            className="btn-secondary px-3 py-2 text-xs"
            title="Refresh Data (F5)"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {isLoading && !kpi ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 skeleton" />
          ))}
        </div>
      ) : kpi ? (
        <>
          {/* Baris 1: KPI Stats Cards — 4 kolom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card-stat">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Omzet SO</p>
                  <p className="text-2xl font-bold mt-1 text-white currency">{formatCurrency(kpi.total_omzet)}</p>
                </div>
                <div className="p-2 bg-primary-950/50 border border-primary-500/30 rounded-lg text-primary-400">
                  <TrendingUp size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="badge badge-green font-mono">{kpi.total_transaksi} SO</span>
                <span>telah selesai diproses</span>
              </div>
            </div>

            <div className="card-stat">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Pembelian PO</p>
                  <p className="text-2xl font-bold mt-1 text-white currency">{formatCurrency(kpi.total_pembelian)}</p>
                </div>
                <div className="p-2 bg-purple-950/50 border border-purple-500/30 rounded-lg text-purple-400">
                  <ShoppingCart size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="badge badge-blue font-mono">{kpi.pending_receiving} PO</span>
                <span>menunggu penerimaan fisik</span>
              </div>
            </div>

            <div className="card-stat">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Transaksi</p>
                  <p className="text-2xl font-bold mt-1 text-white">{formatNumber(kpi.total_transaksi)} SO</p>
                </div>
                <div className="p-2 bg-blue-950/50 border border-blue-500/30 rounded-lg text-blue-400">
                  <ClipboardList size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="text-blue-400 font-semibold flex items-center gap-0.5">Total invoice Sales Order selesai</span>
              </div>
            </div>

            <div className="card-stat">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inventory SKU <span className="text-[10px] text-amber-400 font-mono">[F4]</span></p>
                  <p className="text-2xl font-bold mt-1 text-white">{kpi.total_produk} Barang</p>
                </div>
                <div className="p-2 bg-amber-950/50 border border-amber-500/30 rounded-lg text-amber-400">
                  <Package size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                {kpi.stok_kritis > 0 ? (
                  <span className="badge badge-red font-mono flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {kpi.stok_kritis} Kritis
                  </span>
                ) : (
                  <span className="badge badge-green font-mono">Stok Aman</span>
                )}
                <span>stok di bawah batas minimal</span>
              </div>
            </div>
          </div>

          {/* Baris 2: Grafik Tren + Barang Keluar Hari Ini (Di atas Kalender) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="card lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Tren Nominal Penjualan vs Pembelian</h3>

                </div>
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar size={12} /> Chart Data Real-time
                </span>
              </div>
              <div className="h-[300px] w-full">
                {trend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    Tidak ada data transaksi pada periode ini
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(str) => {
                          try {
                            return new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                          } catch { return str; }
                        }}
                      />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `Rp ${val / 1000000}M`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e2535', borderColor: '#3d4f6b', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}
                        itemStyle={{ color: '#fff', fontSize: '13px' }}
                        formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                        labelFormatter={(label) => `Tanggal: ${new Date(label).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="omzet" name="Nominal Penjualan (Rp)" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="pembelian" name="Nominal Pembelian (Rp)" stroke="#eab308" strokeWidth={2.5} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Transaksi Hari Ini */}
            <div className="card space-y-4 flex flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    <ClipboardList size={16} className="text-blue-400" />
                    Transaksi Hari Ini
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 font-mono px-1.5 py-0.5 rounded border border-blue-500/20">F4</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Total: <span className="font-bold text-blue-300">{kpi.today_transaksi} Transaksi</span>
                  </p>
                </div>
                <button
                  onClick={() => navigate('/penjualan/list', { state: { skipFilter: true } })}
                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                  title="Lihat history penjualan"
                >
                  <ArrowUpRight size={16} />
                </button>
              </div>

              {/* List 5 transaksi terbaru */}
              <div className="flex-1 space-y-2">
                {recentBarangKeluar.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
                    <Package size={24} className="text-slate-600" />
                    <p className="text-xs text-slate-500">Belum ada transaksi hari ini</p>
                  </div>
                ) : (
                  recentBarangKeluar.slice(0, 5).map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => navigate('/penjualan/list', { state: { skipFilter: true } })}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface-800/50 border border-surface-700/40 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-left group"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                          {item.customer}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {item.no_order} · {item.itemCount} item ({item.totalQty} pcs)
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-emerald-400 currency">{formatCurrency(item.total)}</p>
                        <p className="text-[10px] text-slate-500 flex items-center justify-end gap-0.5">
                          <Clock size={9} />
                          {formatWaktu(item.waktu)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Footer link ke history */}
              <button
                onClick={() => navigate('/penjualan/list', { state: { skipFilter: true } })}
                className="flex items-center justify-center gap-1.5 w-full py-2 text-xs text-slate-400 hover:text-blue-400 border border-dashed border-surface-700 hover:border-blue-500/40 rounded-xl transition-all"
              >
                Lihat Semua History Penjualan (F4)
                <ArrowUpRight size={12} />
              </button>
            </div>
          </div>

          {/* Baris 3: Kalender Kepadatan (Lebar sama dengan Grafik) + Card Detail Tanggal (Tepat di bawah Barang Keluar) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kalender (col-span-2 agar ukurannya sama dengan grafik di atasnya) */}
            <div className="card space-y-4 lg:col-span-2">
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    <Calendar size={16} className="text-primary-400" />
                    <span>Kalender Kepadatan</span>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-mono px-1.5 py-0.5 rounded border border-indigo-500/20">F6</span>
                  </h3>
                  <div className="flex gap-1 items-center">
                    <button onClick={prevMonth} className="p-1 hover:bg-surface-750 text-slate-400 hover:text-white rounded transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-semibold text-white px-1 whitespace-nowrap">
                      {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={nextMonth} className="p-1 hover:bg-surface-750 text-slate-400 hover:text-white rounded transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Day Labels */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-500 border-b border-surface-700/40 pb-1.5">
                  {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((dayLabel, idx) => (
                    <span key={idx}>{dayLabel}</span>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays().map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="h-10 md:h-12" />;
                    }
                    const isSelected = selectedDay === day;
                    const sales = getDailySales(day);

                    // Check if this cell is today
                    const todayObj = new Date();
                    const isToday = currentDate.getFullYear() === todayObj.getFullYear() &&
                      currentDate.getMonth() === todayObj.getMonth() &&
                      day === todayObj.getDate();

                    let bgClass = '';
                    let textClass = '';
                    let borderClass = '';

                    if (sales === 0) {
                      bgClass = isSelected ? 'bg-rose-500/25' : 'bg-rose-500/10 hover:bg-rose-500/20';
                      textClass = 'text-slate-900';
                      borderClass = isSelected ? 'border-rose-500/35' : 'border-rose-500/10';
                    } else if (sales >= 33000000) {
                      bgClass = isSelected ? 'bg-emerald-500/35' : 'bg-emerald-500/20 hover:bg-emerald-500/30';
                      textClass = 'text-slate-900';
                      borderClass = isSelected ? 'border-emerald-500/50' : 'border-emerald-500/40';
                    } else if (sales >= 15000000) {
                      bgClass = isSelected ? 'bg-amber-500/35' : 'bg-amber-500/20 hover:bg-amber-500/30';
                      textClass = 'text-slate-900';
                      borderClass = isSelected ? 'border-amber-500/50' : 'border-amber-500/40';
                    } else {
                      bgClass = isSelected ? 'bg-rose-500/25' : 'bg-rose-500/10 hover:bg-rose-500/20';
                      textClass = 'text-slate-900';
                      borderClass = isSelected ? 'border-rose-500/35' : 'border-rose-500/20';
                    }

                    if (isToday) {
                      borderClass = 'border-sky-400 border-2 shadow-[0_0_8px_rgba(56,189,248,0.3)]';
                    }

                    const scaleClass = isSelected ? 'scale-105 z-10 font-bold' : '';

                    return (
                      <button
                        key={`day-${day}`}
                        onClick={() => {
                          setSelectedDay(day);
                          setIsCalendarFocused(true);
                        }}
                        className={`h-10 md:h-12 text-[11px] font-semibold rounded flex items-center justify-center transition-all ${bgClass} ${textClass} ${borderClass} ${scaleClass}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Legenda warna */}
                <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-2 border-t border-surface-700/40">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40 inline-block" />
                    Tinggi
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40 inline-block" />
                    Sedang
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/10 border border-rose-500/20 inline-block" />
                    Rendah
                  </span>
                </div>
              </div>
            </div>

            {/* Card Detail Tanggal (col-span-1 agar di bawah persis card barang keluar dengan ukuran sama) */}
            <div className="card space-y-4 lg:col-span-1 flex flex-col justify-start">
              <div className="flex items-center justify-between pb-3 border-b border-surface-700/40">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-primary-400" />
                  <span>Detail Transaksi Harian</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/20">Enter</span>
                </h3>
              </div>

              {selectedDay ? (
                (() => {
                  const year = currentDate.getFullYear();
                  const month = currentDate.getMonth();
                  const dateStr = getFormattedDateString(year, month, selectedDay);
                  const dayData = trend.find((t) => t.date === dateStr) || { omzet: 0, pembelian: 0, penjualan: 0 };

                  const isHigh = dayData.omzet >= TARGET_HARIAN;
                  const isMedium = dayData.omzet >= 15_000_000;

                  const targetStatus = isHigh ? 'Tinggi' : isMedium ? 'Sedang' : 'Rendah';
                  const statusColor = isHigh ? 'text-emerald-400' : isMedium ? 'text-amber-400' : 'text-rose-400';
                  const badgeBg = isHigh ? 'bg-emerald-500/10 border-emerald-500/30' : isMedium ? 'bg-amber-500/10 border-amber-500/30' : 'bg-rose-500/10 border-rose-500/20';

                  const progressPct = Math.min((dayData.omzet / TARGET_HARIAN) * 100, 100);
                  const aov = dayData.penjualan > 0 ? Math.round(dayData.omzet / dayData.penjualan) : 0;
                  const ratio = dayData.omzet > 0 ? Math.round((dayData.pembelian / dayData.omzet) * 100) : 0;

                  return (
                    <div className="space-y-4">
                      {/* Tanggal & Status */}
                      <div className="flex justify-between items-center pb-2 border-b border-surface-700/40">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tanggal Terpilih</p>
                          <h4 className="text-sm font-bold text-white mt-0.5">
                            {new Date(year, month, selectedDay).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </h4>
                        </div>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${statusColor} ${badgeBg}`}>
                          {targetStatus}
                        </span>
                      </div>

                      {/* Progress Bar target harian */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Target Harian</span>
                          <span className={`font-bold ${statusColor}`}>{progressPct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-surface-800 rounded-full overflow-hidden border border-surface-700/50">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isHigh ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : isMedium ? 'bg-amber-400' : 'bg-rose-500'}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Rincian Angka/KPI List */}
                      <div className="space-y-2 pt-2">
                        {/* Omzet Card */}
                        <div className="p-2.5 bg-surface-800/40 border border-surface-700/50 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={14} className="text-emerald-400" />
                            <span className="text-[11px] text-slate-300">Omzet Penjualan</span>
                          </div>
                          <span className="text-xs font-bold text-white">{formatCurrency(dayData.omzet)}</span>
                        </div>

                        {/* Pembelian Card */}
                        <div className="p-2.5 bg-surface-800/40 border border-surface-700/50 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShoppingCart size={14} className="text-amber-400" />
                            <span className="text-[11px] text-slate-300">Pembelian PO</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-white">{formatCurrency(dayData.pembelian)}</div>
                          </div>
                        </div>

                        {/* Volume Transaksi Card */}
                        <div className="p-2.5 bg-surface-800/40 border border-surface-700/50 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-blue-400" />
                            <span className="text-[11px] text-slate-300">Jumlah Transaksi</span>
                          </div>
                          <span className="text-xs font-bold text-white">{dayData.penjualan} </span>
                        </div>

                        {/* AOV Card */}
                        <div className="p-2.5 bg-surface-800/40 border border-surface-700/50 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign size={14} className="text-purple-400" />
                            <span className="text-[11px] text-slate-300">AOV (Rata-rata Order)</span>
                          </div>
                          <span className="text-xs font-bold text-white">{formatCurrency(aov)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="p-3 bg-surface-850 rounded-full text-slate-500 border border-surface-700/40">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Rincian Transaksi Harian</p>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto">Klik salah satu tanggal pada kalender kepadatan di sebelah kiri untuk melihat statistik rinciannya.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 text-center text-slate-400 border border-dashed border-surface-700 rounded-xl">
          Gagal mengambil ringkasan KPI dashboard
        </div>
      )}
    </div>
  );
};