import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { exportStyledExcel } from '@/lib/excelHelper';
import { 
  ShieldAlert, 
  Calendar, 
  Download, 
  ArrowLeft, 
  Search, 
  User, 
  FileText,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface AuditLog {
  id: string;
  adjustment_date: string;
  stock_before: number;
  stock_after: number;
  qty_delta: number;
  staff_nama: string;
  alasan: string;
  created_at: string;
  product: {
    kode: string;
    nama: string;
  } | null;
  creator: {
    nama: string;
  } | null;
}

export const LaporanAudit: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Selection & keyboard nav
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/laporan/audit-aktivitas?from=${fromDate}&to=${toDate}`);
      setLogs(res.data || []);
      setIsTableFocused(true);
      setSelectedIdx(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [fromDate, toDate]);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = logs.filter((log) => {
      const staff = (log.staff_nama || '').toLowerCase();
      const reason = log.alasan.toLowerCase();
      const prodName = (log.product?.nama || '').toLowerCase();
      const prodSku = (log.product?.kode || '').toLowerCase();

      return staff.includes(q) || reason.includes(q) || prodName.includes(q) || prodSku.includes(q);
    });

    setFilteredLogs(filtered);
    setSelectedIdx(0);
  }, [logs, searchQuery]);

  // Shortcuts
  // F1: Focus Search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
    setIsTableFocused(false);
  }, { enableOnFormTags: true });

  // F2: Focus Date Filter
  useHotkeys('f2', (e) => {
    e.preventDefault();
    fromDateRef.current?.focus();
    fromDateRef.current?.select();
    setIsTableFocused(false);
  }, { enableOnFormTags: true });

  // F10: Export Excel
  useHotkeys('f10', (e) => {
    e.preventDefault();
    exportToExcel();
  }, { enableOnFormTags: false });

  // Escape: Return to menu
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/laporan');
  }, { enableOnFormTags: true });

  // ArrowUp / ArrowDown
  useHotkeys('up', (e) => {
    if (!isTableFocused || filteredLogs.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(prev - 1, 0));
  }, { enableOnFormTags: false }, [isTableFocused, filteredLogs]);

  useHotkeys('down', (e) => {
    if (!isTableFocused || filteredLogs.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(prev + 1, filteredLogs.length - 1));
  }, { enableOnFormTags: false }, [isTableFocused, filteredLogs]);

  // Scroll focused row into view
  useEffect(() => {
    const target = rowRefs.current[selectedIdx];
    if (target && isTableFocused) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx, isTableFocused]);

  const exportToExcel = () => {
    if (logs.length === 0) return;
    const excelRows = filteredLogs.map((log) => {
      return {
        [lang === 'en' ? 'Adjustment Date' : 'Tanggal Penyesuaian']: formatDate(log.adjustment_date),
        [lang === 'en' ? 'Product Name' : 'Nama Produk']: log.product?.nama || (lang === 'en' ? 'Deleted Product' : 'Barang Terhapus'),
        [lang === 'en' ? 'SKU' : 'SKU']: log.product?.kode || '-',
        [lang === 'en' ? 'Initial Stock' : 'Stok Awal']: Number(log.stock_before),
        [lang === 'en' ? 'Final Stock' : 'Stok Akhir']: Number(log.stock_after),
        [lang === 'en' ? 'Stock Delta' : 'Selisih Stok (Delta)']: Number(log.qty_delta),
        [lang === 'en' ? 'Audit Staff' : 'Staff Auditor']: log.staff_nama || 'System',
        [lang === 'en' ? 'Adjustment Reason' : 'Alasan Penyesuaian']: log.alasan,
        [lang === 'en' ? 'Audit Time' : 'Waktu Audit']: new Date(log.created_at).toLocaleString(lang === 'en' ? 'en-US' : 'id-ID'),
      };
    });

    exportStyledExcel(
      excelRows,
      `Laporan_Audit_Aktivitas_${fromDate}_to_${toDate}.xlsx`,
      lang === 'en' ? 'Warehouse Activity Audit Report' : 'Laporan Audit Aktivitas Gudang',
      [lang === 'en' ? 'Initial Stock' : 'Stok Awal', lang === 'en' ? 'Final Stock' : 'Stok Akhir', lang === 'en' ? 'Stock Delta' : 'Selisih Stok (Delta)'],
      [lang === 'en' ? 'Adjustment Date' : 'Tanggal Penyesuaian', 'SKU', lang === 'en' ? 'Audit Time' : 'Waktu Audit'],
      []
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/laporan')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 transition-colors font-semibold focus:outline-none"
          >
            <ArrowLeft size={12} /> {lang === 'en' ? 'Back to Menu (Esc)' : 'Kembali ke Menu (Esc)'}
          </button>
          <h1 className="text-2xl font-extrabold text-slate-955">
            {lang === 'en' ? 'Activity Audit Report' : 'Laporan Audit Aktivitas'}
          </h1>
          <p className="text-slate-550 text-xs mt-1">
            {lang === 'en'
              ? 'Track manual stock adjustments history and logistics operational audit logs.'
              : 'Lacak rekam jejak histori perubahan stok manual gudang dan audit operasional logistik.'}
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>{lang === 'en' ? 'Export Excel (F10)' : 'Ekspor Excel (F10)'}</span>
          </button>
        </div>
      </div>

      {/* Filter Board */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Search Staff / Item / Reason (F1)' : 'Cari Staff / Barang / Alasan (F1)'}
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={lang === 'en' ? 'Staff name, SKU, product name, audit reason...' : 'Nama staff, SKU, nama barang, alasan audit...'}
              value={searchQuery}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), fromDateRef.current?.focus())}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Start Date (F2)' : 'Tanggal Awal (F2)'}
          </label>
          <input
            ref={fromDateRef}
            type="date"
            value={fromDate}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), toDateRef.current?.focus())}
            onChange={(e) => setFromDate(e.target.value)}
            className="input-field w-full py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'End Date' : 'Tanggal Akhir'}
          </label>
          <input
            ref={toDateRef}
            type="date"
            value={toDate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredLogs.length > 0) {
                  setIsTableFocused(true);
                  setSelectedIdx(0);
                  toDateRef.current?.blur();
                }
              }
            }}
            onChange={(e) => setToDate(e.target.value)}
            className="input-field w-full py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
          />
        </div>
      </div>

      {/* Main Log Table */}
      <div 
        className={`bg-white rounded-xl border shadow-xs overflow-hidden transition-all ${
          isTableFocused ? 'ring-2 ring-primary-500/20 border-primary-300' : 'border-slate-200'
        }`}
        onClick={() => setIsTableFocused(true)}
      >
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-3 w-12 text-center">No</th>
              <th className="p-3 w-32">{lang === 'en' ? 'Audit Time' : 'Waktu Audit'}</th>
              <th className="p-3">{lang === 'en' ? 'SKU / Product Name' : 'SKU / Nama Produk'}</th>
              <th className="p-3 text-center">{lang === 'en' ? 'Initial Stock' : 'Stok Awal'}</th>
              <th className="p-3 text-center">{lang === 'en' ? 'Final Stock' : 'Stok Akhir'}</th>
              <th className="p-3 text-center">{lang === 'en' ? 'Delta' : 'Selisih'}</th>
              <th className="p-3">{lang === 'en' ? 'Auditor Staff' : 'Staff Auditor'}</th>
              <th className="p-3">{lang === 'en' ? 'Adjustment Reason' : 'Alasan Penyesuaian'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  {lang === 'en' ? 'Fetching audit activity logs...' : 'Sedang mengambil log aktivitas audit...'}
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  {lang === 'en'
                    ? 'No audit activity data found within this filter period.'
                    : 'Tidak ada data aktivitas audit dalam periode filter ini.'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => {
                const isSelected = isTableFocused && selectedIdx === idx;
                const delta = Number(log.qty_delta);
                const isNegative = delta < 0;

                const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                  let base = 'p-3 text-xs align-middle transition-colors ';
                  if (isSelected) {
                    base += 'bg-blue-100 text-primary-955 font-bold ';
                    if (pos === 'first') {
                      base += 'border-l-4 border-primary-600 ';
                    }
                  } else {
                    base += 'text-slate-700 border-b border-slate-100 ';
                  }
                  return base;
                };

                return (
                  <tr
                    key={log.id}
                    ref={(el) => { rowRefs.current[idx] = el; }}
                    onClick={() => {
                      setIsTableFocused(true);
                      setSelectedIdx(idx);
                    }}
                    className="hover:bg-slate-50/50 cursor-pointer"
                  >
                    <td className={getTdClass('first') + " text-center text-slate-400"}>{idx + 1}</td>
                    <td className={getTdClass('middle') + " font-mono text-[10px]"}>
                      {new Date(log.created_at).toLocaleString(lang === 'en' ? 'en-US' : 'id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className={getTdClass('middle')}>
                      {log.product ? (
                        <>
                          <div className="font-bold">{log.product.nama}</div>
                          <div className="text-[10px] font-mono text-slate-500 font-normal">{log.product.kode}</div>
                        </>
                      ) : (
                        <span className="italic text-slate-400 font-normal">
                          {lang === 'en' ? 'Deleted Product' : 'Barang Terhapus'}
                        </span>
                      )}
                    </td>
                    <td className={getTdClass('middle') + " text-center font-mono"}>{Number(log.stock_before)}</td>
                    <td className={getTdClass('middle') + " text-center font-mono"}>{Number(log.stock_after)}</td>
                    <td className={getTdClass('middle') + " text-center"}>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold inline-flex items-center gap-0.5 ${
                        isNegative ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isNegative ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                        {isNegative ? delta : `+${delta}`}
                      </span>
                    </td>
                    <td className={getTdClass('middle') + " font-bold"}>
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-slate-400" />
                        <span>{log.staff_nama || 'System'}</span>
                      </div>
                    </td>
                    <td className={getTdClass('last') + " italic text-slate-550 font-medium"}>{log.alasan}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end text-[10px] text-slate-400 mt-2">
        <span>
          {lang === 'en'
            ? 'Use cursor or click table to focus, ↑ ↓ keys to select.'
            : 'Gunakan kursor atau klik tabel untuk fokus, tombol ↑ ↓ untuk memilih.'}
        </span>
      </div>
    </div>
  );
};
