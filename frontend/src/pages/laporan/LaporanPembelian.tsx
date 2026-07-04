import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
import { 
  ShoppingBag, 
  Calendar, 
  Download, 
  ArrowLeft, 
  ChevronRight,
  ChevronDown,
  DollarSign,
  FileText
} from 'lucide-react';

interface Supplier {
  id: string;
  kode: string;
  nama: string;
}

interface PurchaseItem {
  id: string;
  qty: number;
  harga_beli: number;
  subtotal: number;
  product?: {
    kode: string;
    nama: string;
  };
}

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  terms: string;
  status: string;
  received_at: string | null;
  subtotal: number;
  supplier: Supplier;
  purchase_items: PurchaseItem[];
}

export const LaporanPembelian: React.FC = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // Expandable invoice details
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

  // Summary state
  const [totalPurchasesVal, setTotalPurchasesVal] = useState(0);
  const [totalTransCount, setTotalTransCount] = useState(0);

  const fromRef = useRef<HTMLInputElement>(null);

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers?limit=100');
      setSuppliers(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPurchasesData = async () => {
    setIsLoading(true);
    try {
      let url = `/laporan/pembelian-detail?from=${fromDate}&to=${toDate}`;
      if (selectedSupplierId) url += `&supplier_id=${selectedSupplierId}`;
      
      const res = await api.get(url);
      const data = res.data || [];
      setPurchases(data);

      const sum = data.reduce((acc: number, p: Purchase) => acc + Number(p.subtotal), 0);
      setTotalPurchasesVal(sum);
      setTotalTransCount(data.length);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchPurchasesData();
  }, [fromDate, toDate, selectedSupplierId]);

  // Shortcuts
  // F1: Focus Date Filter
  useHotkeys('f1', (e) => {
    e.preventDefault();
    fromRef.current?.focus();
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
    const excelRows = purchases.map((p) => {
      return {
        'No. Order PO': p.no_order,
        'Tanggal Order': formatDate(p.order_date),
        'Nama Supplier': p.supplier?.nama || '-',
        'Termin': p.terms,
        'Status': p.status,
        'Tanggal Diterima': p.received_at ? formatDate(p.received_at) : '-',
        'Nilai Transaksi': Number(p.subtotal),
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detail Pembelian');
    XLSX.writeFile(wb, `Laporan_Pembelian_Detail_${fromDate}_to_${toDate}.xlsx`);
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
          <h1 className="text-2xl font-extrabold text-white">Laporan Pembelian Detail</h1>
          <p className="text-slate-400 text-sm">Rekapitulasi transaksi pembelian barang masuk dari supplier.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={purchases.length === 0}
            className="card bg-surface-800 hover:bg-surface-750 px-3.5 py-2 text-slate-350 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} />
            <span>Ekspor Excel (F2)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metric 1 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pengeluaran Beli</span>
            <span className="text-2xl font-black text-white block mt-0.5">{formatCurrency(totalPurchasesVal)}</span>
          </div>
          <div className="p-3 bg-indigo-950 text-indigo-400 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Banyak Transaksi PO</span>
            <span className="text-2xl font-black text-white block mt-0.5">{totalTransCount} Nota</span>
          </div>
          <div className="p-3 bg-indigo-950 text-indigo-400 rounded-xl">
            <ShoppingBag size={20} />
          </div>
        </div>
      </div>

      {/* Filter Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Date From */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Awal (F1)</label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={fromRef}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Akhir</label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Supplier Select */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Filter Supplier</label>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="input-field w-full py-1.5 text-xs"
          >
            <option value="">Semua Supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} ({s.kode})
              </option>
            ))}
          </select>
        </div>

        {/* Info */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-500">
          <p>Saring riwayat PO berdasarkan pemasok dan filter tanggal.</p>
          <p className="mt-1">Pintasan: <kbd className="shortcut-badge">F1</kbd> filter tanggal, <kbd className="shortcut-badge">F2</kbd> ekspor Excel.</p>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">Detail</th>
              <th className="p-4">No. Order PO</th>
              <th className="p-4">Tanggal Order</th>
              <th className="p-4">Nama Supplier</th>
              <th className="p-4 text-center">Termin</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4">Tgl Terima</th>
              <th className="p-4 text-right">Nilai Pembelian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-750">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  Sedang mengambil log pembelian detail...
                </td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  Tidak ada transaksi pembelian terdeteksi pada periode filter ini.
                </td>
              </tr>
            ) : (
              purchases.map((purchase) => {
                const isExpanded = !!expandedInvoiceIds[purchase.id];

                return (
                  <React.Fragment key={purchase.id}>
                    {/* Header Row */}
                    <tr 
                      onClick={() => setExpandedInvoiceIds(prev => ({ ...prev, [purchase.id]: !isExpanded }))}
                      className="hover:bg-surface-750/30 cursor-pointer text-slate-350"
                    >
                      <td className="p-4 text-center text-slate-500">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-200">
                        {purchase.no_order}
                      </td>
                      <td className="p-4">{formatDate(purchase.order_date)}</td>
                      <td className="p-4 font-bold text-slate-250">{purchase.supplier?.nama || '-'}</td>
                      <td className="p-4 text-center font-semibold capitalize text-slate-400">
                        {purchase.terms}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          purchase.status === 'received' 
                            ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/20' 
                            : 'bg-yellow-950/30 text-yellow-400 border border-yellow-800/20'
                        }`}>
                          {purchase.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{purchase.received_at ? formatDate(purchase.received_at) : '-'}</td>
                      <td className="p-4 text-right font-mono font-bold text-white text-sm">
                        {formatCurrency(Number(purchase.subtotal))}
                      </td>
                    </tr>

                    {/* Expanded Detail Rows */}
                    {isExpanded && (
                      <tr className="bg-surface-850/40">
                        <td colSpan={8} className="p-4 border-t border-b border-surface-700/60">
                          <div className="space-y-3 pl-8">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                              <FileText size={12} className="text-indigo-400" />
                              <span>Rincian Barang & Kuantitas PO</span>
                            </div>

                            <div className="border border-surface-750 rounded-lg overflow-hidden max-w-4xl">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-surface-800 text-slate-400 font-semibold border-b border-surface-750">
                                    <th className="p-2 w-8 text-center">No</th>
                                    <th className="p-2">Kode SKU</th>
                                    <th className="p-2">Nama Produk</th>
                                    <th className="p-2 text-right w-20">Kuantitas</th>
                                    <th className="p-2 text-right w-28">Harga Beli</th>
                                    <th className="p-2 text-right w-28">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-750">
                                  {purchase.purchase_items?.map((item, idx) => (
                                    <tr key={item.id} className="text-slate-350 hover:bg-surface-800/10">
                                      <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                                      <td className="p-2 font-mono text-slate-400">{item.product?.kode || '-'}</td>
                                      <td className="p-2 font-bold text-slate-200">{item.product?.nama || '-'}</td>
                                      <td className="p-2 text-right font-semibold text-white">{Number(item.qty)}</td>
                                      <td className="p-2 text-right font-mono">{formatCurrency(Number(item.harga_beli))}</td>
                                      <td className="p-2 text-right font-mono text-white font-bold">{formatCurrency(Number(item.subtotal))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
