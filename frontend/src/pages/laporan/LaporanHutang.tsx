import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
import { 
  TrendingDown, 
  Search, 
  Download, 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  Layers,
  AlertOctagon
} from 'lucide-react';

interface Supplier {
  kode: string;
  nama: string;
  jatuh_tempo_bulan: number;
}

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  terms: string;
  status: string;
  subtotal: number;
  supplier: Supplier;
}

export const LaporanHutang: React.FC = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Summaries
  const [totalHutangVal, setTotalHutangVal] = useState(0);
  const [averageHutangVal, setAverageHutangVal] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchHutangData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/laporan/hutang');
      setPurchases(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHutangData();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = purchases.filter((p) => {
      const supplierName = (p.supplier?.nama || '').toLowerCase();
      const orderNo = p.no_order.toLowerCase();
      return supplierName.includes(q) || orderNo.includes(q);
    });

    setFilteredPurchases(filtered);

    // Calculations
    const sum = filtered.reduce((acc, curr) => acc + Number(curr.subtotal), 0);
    setTotalHutangVal(sum);
    setAverageHutangVal(filtered.length > 0 ? sum / filtered.length : 0);
  }, [purchases, searchQuery]);

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

  const exportToExcel = () => {
    if (purchases.length === 0) return;
    const excelRows = filteredPurchases.map((p) => {
      return {
        'No. Order PO': p.no_order,
        'Nama Supplier': p.supplier?.nama || '-',
        'Tanggal Order': formatDate(p.order_date),
        'Jatuh Tempo (Term)': p.terms,
        'Estimasi Jatuh Tempo': calculateDueDate(p.order_date, p.terms),
        'Status Penerimaan': p.status,
        'Nilai Hutang': Number(p.subtotal),
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hutang Dagang');
    XLSX.writeFile(wb, `Laporan_Hutang_Dagang_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

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

  // Helper to calculate estimated due date based on terms
  const calculateDueDate = (orderDateStr: string, terms: string) => {
    const orderDate = new Date(orderDateStr);
    let monthsToAdd = 0;
    if (terms === '1') monthsToAdd = 1;
    else if (terms === '2') monthsToAdd = 2;
    else if (terms === '3') monthsToAdd = 3;
    
    orderDate.setMonth(orderDate.getMonth() + monthsToAdd);
    return formatDate(orderDate.toISOString());
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
          <h1 className="text-2xl font-extrabold text-white">Laporan Hutang Dagang (AP)</h1>
          <p className="text-slate-400 text-sm">Rekapitulasi tagihan kewajiban pembelian kredit (Accounts Payable) ke supplier yang jatuh tempo.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={filteredPurchases.length === 0}
            className="card bg-surface-800 hover:bg-surface-750 px-3.5 py-2 text-slate-350 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} />
            <span>Ekspor Excel (F2)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outstanding Hutang</span>
            <span className="text-xl font-black text-white block mt-0.5">{formatCurrency(totalHutangVal)}</span>
          </div>
          <div className="p-2.5 bg-orange-950 text-orange-400 rounded-xl">
            <TrendingDown size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rata-rata Tagihan PO</span>
            <span className="text-xl font-black text-white block mt-0.5">{formatCurrency(averageHutangVal)}</span>
          </div>
          <div className="p-2.5 bg-indigo-950 text-indigo-400 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Banyak Faktur Hutang</span>
            <span className="text-xl font-black text-white block mt-0.5">{filteredPurchases.length} Nota PO</span>
          </div>
          <div className="p-2.5 bg-amber-950 text-amber-400 rounded-xl">
            <Layers size={20} />
          </div>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div className="relative max-w-md">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Supplier / No PO (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama supplier atau no order PO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Hints */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-500">
          <p>Laporan ini hanya memuat transaksi pembelian berstatus kredit yang belum di-rollback.</p>
          <p className="mt-1">Pintasan: <kbd className="shortcut-badge">F1</kbd> cari data, <kbd className="shortcut-badge">F2</kbd> ekspor Excel.</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">No</th>
              <th className="p-4">No. Order PO</th>
              <th className="p-4">Nama Supplier</th>
              <th className="p-4">Tanggal Order</th>
              <th className="p-4 text-center">Termin J.Tempo</th>
              <th className="p-4">Estimasi Jatuh Tempo</th>
              <th className="p-4 text-center">Status Penerimaan</th>
              <th className="p-4 text-right">Nilai Hutang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-750">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  Sedang merekap data tagihan supplier...
                </td>
              </tr>
            ) : filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  Tidak ada data hutang dagang terdeteksi untuk filter ini.
                </td>
              </tr>
            ) : (
              filteredPurchases.map((p, idx) => {
                return (
                  <tr key={p.id} className="hover:bg-surface-750/30 text-slate-350">
                    <td className="p-4 text-center text-slate-500">{idx + 1}</td>
                    <td className="p-4 font-mono font-bold text-slate-200">{p.no_order}</td>
                    <td className="p-4 font-bold text-slate-200">
                      {p.supplier?.nama || '-'}
                      <span className="block text-[10px] text-slate-500">{p.supplier?.kode}</span>
                    </td>
                    <td className="p-4">{formatDate(p.order_date)}</td>
                    <td className="p-4 text-center font-semibold text-slate-400">
                      {p.terms === 'tunai' ? 'Tunai' : `${p.terms} Bulan`}
                    </td>
                    <td className="p-4 text-slate-400 font-bold">
                      {calculateDueDate(p.order_date, p.terms)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        p.status === 'received' 
                          ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/20' 
                          : 'bg-yellow-950/30 text-yellow-400 border border-yellow-800/20'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-orange-400 text-sm">
                      {formatCurrency(Number(p.subtotal))}
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
