import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { exportStyledExcel } from '@/lib/excelHelper';
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

  // Keyboard navigation & table focus
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

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

  useEffect(() => {
    setSelectedIdx(0);
  }, [filteredPurchases]);

  // Shortcuts
  // F1: Focus Search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
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

  // Keyboard Table Navigation
  useHotkeys('down', (e) => {
    if (!isTableFocused || filteredPurchases.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(prev + 1, filteredPurchases.length - 1));
  }, { enableOnFormTags: false }, [isTableFocused, filteredPurchases]);

  useHotkeys('up', (e) => {
    if (!isTableFocused || filteredPurchases.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(prev - 1, 0));
  }, { enableOnFormTags: false }, [isTableFocused, filteredPurchases]);

  // Scroll focused row into view
  useEffect(() => {
    const target = rowRefs.current[selectedIdx];
    if (target && isTableFocused) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx, isTableFocused]);

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

    exportStyledExcel(
      excelRows,
      `Laporan_Hutang_Dagang_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Laporan Hutang Dagang',
      [],
      ['No. Order PO', 'Tanggal Order', 'Jatuh Tempo (Term)', 'Estimasi Jatuh Tempo', 'Status Penerimaan'],
      ['Nilai Hutang']
    );
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

  const handleFilterEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPurchases.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.blur();
        }
      }
    }
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
            <ArrowLeft size={12} /> Kembali ke Menu (Esc)
          </button>
          <h1 className="text-2xl font-extrabold text-slate-950">Laporan Hutang Dagang (AP)</h1>
          <p className="text-slate-550 text-xs mt-1">Rekapitulasi tagihan kewajiban pembelian kredit (Accounts Payable) ke supplier yang jatuh tempo.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={filteredPurchases.length === 0}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>Ekspor Excel (F10)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-orange-500">
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Total Outstanding Hutang</span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">{formatCurrency(totalHutangVal)}</span>
          </div>
          <div className="p-2.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-xl">
            <TrendingDown size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-indigo-500">
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Rata-rata Tagihan PO</span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">{formatCurrency(averageHutangVal)}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Banyak Faktur Hutang</span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">{filteredPurchases.length} Nota PO</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl">
            <Layers size={20} />
          </div>
        </div>
      </div>

      {/* Control Board */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative w-full md:col-span-2">
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Cari Supplier / No PO (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama supplier atau no order PO..."
              value={searchQuery}
              onKeyDown={handleFilterEnter}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Hints */}
        <div className="text-left md:text-right flex flex-col justify-end text-[10px] text-slate-500 leading-relaxed">
          <p>Laporan ini hanya memuat transaksi pembelian berstatus kredit yang aktif.</p>
          <p className="mt-0.5">Pintasan: <kbd className="shortcut-badge text-[9px]">F1</kbd> cari data, <kbd className="shortcut-badge text-[9px]">F10</kbd> ekspor Excel.</p>
        </div>
      </div>

      {/* Main Table */}
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
              <th className="p-3">No. Order PO</th>
              <th className="p-3">Nama Supplier</th>
              <th className="p-3">Tanggal Order</th>
              <th className="p-3 text-center">Termin J.Tempo</th>
              <th className="p-3">Estimasi Jatuh Tempo</th>
              <th className="p-3 text-center">Status Penerimaan</th>
              <th className="p-3 text-right">Nilai Hutang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-505 italic">
                  Sedang merekap data tagihan supplier...
                </td>
              </tr>
            ) : filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  Tidak ada data hutang dagang terdeteksi untuk filter ini.
                </td>
              </tr>
            ) : (
              filteredPurchases.map((p, idx) => {
                const isSelected = isTableFocused && selectedIdx === idx;

                const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                  let base = 'p-3 text-xs align-middle transition-colors ';
                  if (isSelected) {
                    base += 'bg-blue-100 text-primary-950 font-bold ';
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
                    key={p.id}
                    ref={(el) => { rowRefs.current[idx] = el; }}
                    onClick={() => {
                      setIsTableFocused(true);
                      setSelectedIdx(idx);
                    }}
                    className="hover:bg-slate-50/50 cursor-pointer"
                  >
                    <td className={getTdClass('first') + " text-center text-slate-400"}>{idx + 1}</td>
                    <td className={getTdClass('middle') + " font-mono font-bold"}>{p.no_order}</td>
                    <td className={getTdClass('middle') + " font-bold"}>
                      {p.supplier?.nama || '-'}
                      <span className="block text-[10px] text-slate-500 font-normal">{p.supplier?.kode}</span>
                    </td>
                    <td className={getTdClass('middle')}>{formatDate(p.order_date)}</td>
                    <td className={getTdClass('middle') + " text-center font-semibold text-slate-550"}>
                      {p.terms === 'tunai' ? 'Tunai' : `${p.terms} Bulan`}
                    </td>
                    <td className={getTdClass('middle') + " text-slate-700 font-bold"}>
                      {calculateDueDate(p.order_date, p.terms)}
                    </td>
                    <td className={getTdClass('middle') + " text-center"}>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        p.status === 'received' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className={getTdClass('last') + " text-right font-mono font-bold text-orange-600 text-sm"}>
                      {formatCurrency(Number(p.subtotal))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end text-[10px] text-slate-400 mt-2">
        <span>Gunakan kursor atau klik tabel untuk fokus, tombol <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih.</span>
      </div>
    </div>
  );
};
