import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  DollarSign, 
  User, 
  FileText, 
  Activity,
  ArrowRight
} from 'lucide-react';

interface PaymentLog {
  id: string;
  sale_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  note: string | null;
  created_at: string;
  sale: {
    no_faktur: string | null;
    no_order: string;
    subtotal: number;
    customer: {
      kode: string;
      nama: string;
    };
  };
}

export const RiwayatPenagihan: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromHistory = searchParams.get('from') === 'history';
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<PaymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Summary Metrics
  const [totalCollected, setTotalCollected] = useState(0);
  const [averagePayment, setAveragePayment] = useState(0);

  // Keyboard navigation
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/payments?from=${fromDate}&to=${toDate}`);
      const data = res.data.data || [];
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fromDate, toDate]);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = logs.filter((log) => {
      const name = (log.sale?.customer?.nama || '').toLowerCase();
      const code = (log.sale?.customer?.kode || '').toLowerCase();
      const docNo = (log.sale?.no_faktur || log.sale?.no_order || '').toLowerCase();
      return name.includes(q) || code.includes(q) || docNo.includes(q);
    });

    setFilteredLogs(filtered);
    setSelectedRowIdx(0);

    // Compute metrics
    const sum = filtered.reduce((acc, curr) => acc + Number(curr.amount), 0);
    setTotalCollected(sum);
    setAveragePayment(filtered.length > 0 ? sum / filtered.length : 0);
  }, [logs, searchQuery]);

  // Shortcuts
  // F1: Focus Search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // Escape: Return to menu
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (searchQuery) {
      setSearchQuery('');
    } else {
      navigate(fromHistory ? '/history' : '/penagihan');
    }
  }, { enableOnFormTags: true });

  // ArrowUp / ArrowDown
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (selectedRowIdx > 0) setSelectedRowIdx(selectedRowIdx - 1);
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (selectedRowIdx < filteredLogs.length - 1) setSelectedRowIdx(selectedRowIdx + 1);
  }, { enableOnFormTags: false });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">Riwayat Setoran Penagihan</h1>
        <p className="text-slate-400 text-sm">Buku log harian audit angsuran pembayaran piutang pelanggan.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="card p-4 flex items-center justify-between bg-surface-800 border border-surface-700/60">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Setoran Terkumpul</span>
            <span className="text-xl font-black text-emerald-400 mt-1 block">{formatCurrency(totalCollected)}</span>
          </div>
          <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-lg">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card p-4 flex items-center justify-between bg-surface-800 border border-surface-700/60">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Rata-rata Setoran</span>
            <span className="text-xl font-black text-sky-400 mt-1 block">{formatCurrency(averagePayment)}</span>
          </div>
          <div className="p-2.5 bg-sky-950 text-sky-400 rounded-lg">
            <Activity size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card p-4 flex items-center justify-between bg-surface-800 border border-surface-700/60">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Transaksi Masuk</span>
            <span className="text-xl font-black text-amber-400 mt-1 block">{filteredLogs.length} Kali</span>
          </div>
          <div className="p-2.5 bg-amber-950 text-amber-400 rounded-lg">
            <FileSpreadsheet size={20} />
          </div>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative col-span-1 md:col-span-2">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Pelanggan / Faktur (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama pelanggan, kode toko, no faktur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* From Date */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Awal</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="input-field w-full py-1.5 text-xs"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Akhir</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="input-field w-full py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Log Feed / Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">No</th>
              <th className="p-4">Tanggal Masuk</th>
              <th className="p-4">Pelanggan</th>
              <th className="p-4">Referensi Faktur</th>
              <th className="p-4 text-center">Metode</th>
              <th className="p-4">Keterangan Catatan</th>
              <th className="p-4 text-right">Jumlah Uang</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                  Sedang memuat riwayat angsuran...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                  Belum ada catatan setoran masuk dalam periode ini.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => {
                const isSelected = selectedRowIdx === idx;
                const rowBgClass = isSelected ? 'bg-blue-100' : 'hover:bg-slate-50';

                const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                  let base = "p-4 transition-all duration-150 border-b ";
                  if (isSelected) {
                    base += "bg-blue-100 text-primary-950 font-bold border-blue-300 ";
                    if (pos === 'first') base += "border-l-4 border-primary-600 ";
                  } else {
                    base += "text-slate-800 border-slate-200 ";
                    if (pos === 'first') base += "border-l-4 border-transparent ";
                  }
                  return base;
                };

                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedRowIdx(idx)}
                    className={`cursor-pointer transition-all ${rowBgClass}`}
                  >
                    <td className={getTdClass('first') + " text-center text-slate-500"}>{idx + 1}</td>
                    <td className={getTdClass('middle') + " font-semibold text-slate-700"}>{formatDate(log.payment_date)}</td>
                    <td className={getTdClass('middle')}>
                      <div className="font-bold text-slate-900">{log.sale?.customer?.nama || 'Direct Cash'}</div>
                      <div className="text-[10px] text-slate-550 font-mono">{log.sale?.customer?.kode || '-'}</div>
                    </td>
                    <td className={getTdClass('middle') + " font-mono font-bold text-slate-800"}>
                      <div className="flex items-center gap-1">
                        <FileText size={12} className="text-slate-500" />
                        <span>{log.sale?.no_faktur || log.sale?.no_order || '-'}</span>
                      </div>
                    </td>
                    <td className={getTdClass('middle') + " text-center"}>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-surface-900 border border-surface-700/50 text-slate-600">
                        {log.payment_method}
                      </span>
                    </td>
                    <td className={getTdClass('middle') + " italic text-slate-600 truncate max-w-xs"}>{log.note || '-'}</td>
                    <td className={getTdClass('last') + " text-right font-mono text-slate-900 font-bold text-sm"}>
                      {formatCurrency(Number(log.amount))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
