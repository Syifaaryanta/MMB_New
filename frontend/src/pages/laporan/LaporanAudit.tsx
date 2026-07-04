import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
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
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/laporan/audit-aktivitas?from=${fromDate}&to=${toDate}`);
      setLogs(res.data || []);
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
      const staff = (log.staff_nama || log.creator?.nama || '').toLowerCase();
      const reason = log.alasan.toLowerCase();
      const prodName = (log.product?.nama || '').toLowerCase();
      const prodSku = (log.product?.kode || '').toLowerCase();

      return staff.includes(q) || reason.includes(q) || prodName.includes(q) || prodSku.includes(q);
    });

    setFilteredLogs(filtered);
    setSelectedRowIdx(0);
  }, [logs, searchQuery]);

  // Shortcuts
  // F1: Focus Search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F2: Export Excel
  useHotkeys('f2', (e) => {
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
    e.preventDefault();
    if (selectedRowIdx > 0) setSelectedRowIdx(selectedRowIdx - 1);
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (selectedRowIdx < filteredLogs.length - 1) setSelectedRowIdx(selectedRowIdx + 1);
  }, { enableOnFormTags: false });

  const exportToExcel = () => {
    if (logs.length === 0) return;
    const excelRows = filteredLogs.map((log) => {
      return {
        'Tanggal Penyesuaian': formatDate(log.adjustment_date),
        'Nama Produk': log.product?.nama || 'Barang Terhapus',
        'SKU': log.product?.kode || '-',
        'Stok Awal': Number(log.stock_before),
        'Stok Akhir': Number(log.stock_after),
        'Selisih Stok (Delta)': Number(log.qty_delta),
        'Staff Auditor': log.staff_nama || log.creator?.nama || 'System',
        'Alasan Penyesuaian': log.alasan,
        'Waktu Audit': new Date(log.created_at).toLocaleString('id-ID'),
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log Gudang');
    XLSX.writeFile(wb, `Laporan_Audit_Aktivitas_${fromDate}_to_${toDate}.xlsx`);
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
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate('/laporan')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={12} /> Kembali ke Menu (Esc)
          </button>
          <h1 className="text-2xl font-extrabold text-white">Laporan Audit Aktivitas</h1>
          <p className="text-slate-400 text-sm">Lacak rekam jejak histori perubahan stok manual gudang dan audit operasional logistik.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={filteredLogs.length === 0}
            className="card bg-surface-800 hover:bg-surface-750 px-3.5 py-2 text-slate-350 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} />
            <span>Ekspor Excel (F2)</span>
          </button>
        </div>
      </div>

      {/* Filter Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative col-span-1 md:col-span-2">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Staff / Barang / Alasan (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama staff, SKU, nama barang, alasan audit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Awal</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="input-field w-full py-1.5 text-xs"
          />
        </div>

        {/* Date To */}
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

      {/* Main Log Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">No</th>
              <th className="p-4 w-32">Waktu Audit</th>
              <th className="p-4">SKU / Nama Produk</th>
              <th className="p-4 text-center">Stok Awal</th>
              <th className="p-4 text-center">Stok Akhir</th>
              <th className="p-4 text-center">Selisih</th>
              <th className="p-4">Staff Auditor</th>
              <th className="p-4">Alasan Penyesuaian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-750">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  Sedang mengambil log aktivitas audit...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  Tidak ada data aktivitas audit dalam periode filter ini.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => {
                const isSelected = selectedRowIdx === idx;
                const delta = Number(log.qty_delta);
                const isNegative = delta < 0;

                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedRowIdx(idx)}
                    className={`hover:bg-surface-750/30 cursor-pointer ${
                      isSelected ? 'bg-surface-750/50 text-white font-semibold' : 'text-slate-350'
                    }`}
                  >
                    <td className="p-4 text-center text-slate-500">{idx + 1}</td>
                    <td className="p-4 font-mono text-slate-400 text-[10px]">
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="p-4">
                      {log.product ? (
                        <>
                          <div className="font-bold text-slate-200">{log.product.nama}</div>
                          <div className="text-[10px] font-mono text-slate-500">{log.product.kode}</div>
                        </>
                      ) : (
                        <span className="italic text-slate-500">Barang Terhapus</span>
                      )}
                    </td>
                    <td className="p-4 text-center font-mono">{Number(log.stock_before)}</td>
                    <td className="p-4 text-center font-mono">{Number(log.stock_after)}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold inline-flex items-center gap-0.5 ${
                        isNegative ? 'bg-rose-950/30 text-rose-450' : 'bg-emerald-950/30 text-emerald-400'
                      }`}>
                        {isNegative ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                        {isNegative ? delta : `+${delta}`}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-200 flex items-center gap-1.5">
                      <User size={12} className="text-slate-500" />
                      <span>{log.staff_nama || log.creator?.nama || 'System'}</span>
                    </td>
                    <td className="p-4 italic text-slate-400">{log.alasan}</td>
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
