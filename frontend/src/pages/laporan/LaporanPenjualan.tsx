import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
import { 
  TrendingUp, 
  Search, 
  Calendar, 
  Download, 
  ArrowLeft, 
  ChevronRight,
  ChevronDown,
  DollarSign,
  FileText
} from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
}

interface SaleItem {
  id: string;
  product_kode: string;
  product_nama: string;
  qty: number;
  unit_price: number;
  total: number;
}

interface Sale {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  customer_nama: string;
  subtotal: number;
  diantar: boolean;
  limit_bulan: number;
  sale_items: SaleItem[];
  customer: Customer;
  sales_payments: Array<{ amount: number }>;
}

export const LaporanPenjualan: React.FC = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Expandable invoice details
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

  // Summary state
  const [totalSalesVal, setTotalSalesVal] = useState(0);
  const [totalTransCount, setTotalTransCount] = useState(0);

  const fromRef = useRef<HTMLInputElement>(null);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers?limit=100');
      setCustomers(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSalesData = async () => {
    setIsLoading(true);
    try {
      let url = `/laporan/penjualan-detail?from=${fromDate}&to=${toDate}`;
      if (selectedCustomerId) url += `&customer_id=${selectedCustomerId}`;
      
      const res = await api.get(url);
      const data = res.data || [];
      setSales(data);

      const sum = data.reduce((acc: number, s: Sale) => acc + Number(s.subtotal), 0);
      setTotalSalesVal(sum);
      setTotalTransCount(data.length);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [fromDate, toDate, selectedCustomerId]);

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
    if (sales.length === 0) return;
    const excelRows = sales.map((sale) => {
      const totalPaid = sale.sales_payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const sisaPiutang = Number(sale.subtotal) - totalPaid;
      return {
        'No. Faktur': sale.no_faktur || sale.no_order,
        'Tanggal Jual': formatDate(sale.order_date),
        'Nama Pelanggan': sale.customer_nama,
        'Jenis Pembayaran': sale.limit_bulan > 0 ? `Kredit (${sale.limit_bulan + 1} Bulan)` : 'Tunai',
        'Total Invoice': Number(sale.subtotal),
        'Total Terbayar': totalPaid,
        'Sisa Piutang': sisaPiutang,
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detail Penjualan');
    XLSX.writeFile(wb, `Laporan_Penjualan_Detail_${fromDate}_to_${toDate}.xlsx`);
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
          <h1 className="text-2xl font-extrabold text-white">Laporan Penjualan Detail</h1>
          <p className="text-slate-400 text-sm">Log transaksi barang terjual, nominal omzet, dan sisa penagihan.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={sales.length === 0}
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Omzet Terjual</span>
            <span className="text-2xl font-black text-white block mt-0.5">{formatCurrency(totalSalesVal)}</span>
          </div>
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Banyak Transaksi Sukses</span>
            <span className="text-2xl font-black text-white block mt-0.5">{totalTransCount} Nota</span>
          </div>
          <div className="p-3 bg-indigo-950 text-indigo-400 rounded-xl">
            <TrendingUp size={20} />
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

        {/* Customer Select */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Filter Pelanggan</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="input-field w-full py-1.5 text-xs"
          >
            <option value="">Semua Pelanggan</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama} ({c.kode})
              </option>
            ))}
          </select>
        </div>

        {/* Info */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-500">
          <p>Pilih range tanggal atau pelanggan tertentu untuk menyaring log.</p>
          <p className="mt-1">Pintasan: <kbd className="shortcut-badge">F1</kbd> filter tanggal, <kbd className="shortcut-badge">F2</kbd> ekspor Excel.</p>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">Detail</th>
              <th className="p-4">No. Faktur</th>
              <th className="p-4">Tanggal Jual</th>
              <th className="p-4">Nama Pelanggan</th>
              <th className="p-4 text-center">Jenis Bayar</th>
              <th className="p-4 text-right">Terbayar</th>
              <th className="p-4 text-right">Sisa Piutang</th>
              <th className="p-4 text-right">Nilai Belanja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-750">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                  Sedang mengambil log penjualan detail...
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  Tidak ada transaksi penjualan terdeteksi pada periode filter ini.
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const isExpanded = !!expandedInvoiceIds[sale.id];
                const totalPaid = sale.sales_payments.reduce((acc, p) => acc + Number(p.amount), 0);
                const sisaPiutang = Number(sale.subtotal) - totalPaid;

                return (
                  <React.Fragment key={sale.id}>
                    {/* Header Row */}
                    <tr 
                      onClick={() => setExpandedInvoiceIds(prev => ({ ...prev, [sale.id]: !isExpanded }))}
                      className="hover:bg-surface-750/30 cursor-pointer text-slate-300"
                    >
                      <td className="p-4 text-center text-slate-500">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-200">
                        {sale.no_faktur || sale.no_order}
                      </td>
                      <td className="p-4">{formatDate(sale.order_date)}</td>
                      <td className="p-4 font-bold text-slate-250">{sale.customer_nama}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          sale.limit_bulan > 0 
                            ? 'bg-rose-950/30 text-rose-400 border border-rose-800/20' 
                            : 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/20'
                        }`}>
                          {sale.limit_bulan > 0 ? `Kredit (${sale.limit_bulan + 1} Bln)` : 'Tunai'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-emerald-400">{formatCurrency(totalPaid)}</td>
                      <td className={`p-4 text-right font-mono ${sisaPiutang > 0 ? 'text-rose-450 font-semibold' : 'text-slate-400'}`}>
                        {formatCurrency(sisaPiutang)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-white text-sm">
                        {formatCurrency(Number(sale.subtotal))}
                      </td>
                    </tr>

                    {/* Expanded Detail Rows */}
                    {isExpanded && (
                      <tr className="bg-surface-850/40">
                        <td colSpan={8} className="p-4 border-t border-b border-surface-700/60">
                          <div className="space-y-3 pl-8">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                              <FileText size={12} className="text-primary-400" />
                              <span>Rincian Barang & Kuantitas Belanja</span>
                            </div>

                            <div className="border border-surface-750 rounded-lg overflow-hidden max-w-4xl">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-surface-800 text-slate-400 font-semibold border-b border-surface-750">
                                    <th className="p-2 w-8 text-center">No</th>
                                    <th className="p-2">Kode SKU</th>
                                    <th className="p-2">Nama Produk</th>
                                    <th className="p-2 text-right w-20">Kuantitas</th>
                                    <th className="p-2 text-right w-28">Harga Jual</th>
                                    <th className="p-2 text-right w-28">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-750">
                                  {sale.sale_items?.map((item, idx) => (
                                    <tr key={item.id} className="text-slate-350 hover:bg-surface-800/10">
                                      <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                                      <td className="p-2 font-mono text-slate-400">{item.product_kode}</td>
                                      <td className="p-2 font-bold text-slate-200">{item.product_nama}</td>
                                      <td className="p-2 text-right font-semibold text-white">{Number(item.qty)}</td>
                                      <td className="p-2 text-right font-mono">{formatCurrency(Number(item.unit_price))}</td>
                                      <td className="p-2 text-right font-mono text-white font-bold">{formatCurrency(Number(item.total))}</td>
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
