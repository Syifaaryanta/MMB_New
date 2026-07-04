import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ArrowLeftRight, Package, ShieldAlert, FileText, Search, Grid } from 'lucide-react';

interface AdjustmentLog {
  id: string;
  product_kode: string;
  product_nama: string;
  adjustment_date: string;
  stock_before: number;
  stock_after: number;
  qty_delta: number;
  staff_nama: string;
  alasan: string;
  created_at: string;
}

interface EntityLog {
  id: string;
  no_order: string;
  order_date: string;
  type: 'Beli (PO)' | 'Jual (SO)';
  entity_nama: string;
  subtotal: number;
}

export const HistoryTransaksi: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'instansi' | 'barang'>('instansi');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Logs
  const [entityLogs, setEntityLogs] = useState<EntityLog[]>([]);
  const [adjustmentLogs, setAdjustmentLogs] = useState<AdjustmentLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'instansi') {
        // Fetch completed POs and SOs, map them to standard format
        const [poRes, soRes] = await Promise.all([
          api.get('/purchases?status=received&limit=50'),
          api.get('/sales?status=completed&limit=50'),
        ]);

        const poMapped = (poRes.data.data || []).map((po: any) => ({
          id: po.id,
          no_order: po.no_order,
          order_date: po.order_date,
          type: 'Beli (PO)' as const,
          entity_nama: po.supplier.nama,
          subtotal: Number(po.subtotal),
        }));

        const soMapped = (soRes.data.data || []).map((so: any) => ({
          id: so.id,
          no_order: so.no_faktur || so.no_order,
          order_date: so.order_date,
          type: 'Jual (SO)' as const,
          entity_nama: so.customer_nama,
          subtotal: Number(so.subtotal),
        }));

        const combined = [...poMapped, ...soMapped]
          .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());

        // Apply filter
        const filtered = searchQuery
          ? combined.filter((c) => c.entity_nama.toLowerCase().includes(searchQuery.toLowerCase()) || c.no_order.toLowerCase().includes(searchQuery.toLowerCase()))
          : combined;

        setEntityLogs(filtered);
      } else {
        // Fetch audit logs / stock adjustments
        const res = await api.get(`/stock-adjustments?limit=100`);
        const data = res.data.data || [];
        const filtered = searchQuery
          ? data.filter((d: any) => d.product_nama.toLowerCase().includes(searchQuery.toLowerCase()) || d.product_kode.toLowerCase().includes(searchQuery.toLowerCase()))
          : data;
        setAdjustmentLogs(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab, searchQuery]);

  // Keyboard Shortcuts
  // Arrow Left/Right to toggle tabs
  useHotkeys('left, right', (e) => {
    e.preventDefault();
    setActiveTab((t) => (t === 'instansi' ? 'barang' : 'instansi'));
  }, { enableOnFormTags: false });

  // Escape to go back
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/pembelian');
  }, { enableOnFormTags: true });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Histori Transaksi Gudang</h1>
          <p className="text-slate-400">Jurnal audit log keluar-masuk barang dan penyesuaian stok MMB</p>
        </div>
        <button onClick={() => navigate('/pembelian')} className="btn-secondary text-xs">
          Kembali ke PO
        </button>
      </div>

      {/* Tabs */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-surface-700 pb-px">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('instansi')}
            className={`py-2 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'instansi'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Riwayat per Instansi (Supplier/Customer)
          </button>
          <button
            onClick={() => setActiveTab('barang')}
            className={`py-2 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'barang'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Riwayat per Barang (Audit Log)
          </button>
        </div>

        <div className="text-xs text-slate-500 hidden sm:inline">
          Gunakan <kbd className="shortcut-badge text-[10px]">Panah Kiri/Kanan</kbd> untuk ganti Tab
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative w-full sm:max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
          <Search size={16} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={activeTab === 'instansi' ? 'Cari nama supplier/customer...' : 'Cari nama/kode barang...'}
          className="input-field pl-9"
        />
      </div>

      {/* Log list rendering */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 skeleton" />
          ))}
        </div>
      ) : activeTab === 'instansi' ? (
        /* Tab 1: Instansi Log Table */
        entityLogs.length > 0 ? (
          <div className="card p-0 overflow-hidden border border-surface-700">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Tipe</th>
                  <th className="p-4">Nomor Order / Faktur</th>
                  <th className="p-4">Nama Instansi</th>
                  <th className="p-4 text-right">Nilai Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {entityLogs.map((l, i) => (
                  <tr key={i} className="hover:bg-surface-850 transition-colors">
                    <td className="p-4 text-slate-350">{formatDate(l.order_date)}</td>
                    <td className="p-4">
                      <span className={`badge ${l.type === 'Beli (PO)' ? 'badge-blue' : 'badge-green'}`}>
                        {l.type}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-semibold text-slate-300">{l.no_order}</td>
                    <td className="p-4 font-bold text-white">{l.entity_nama}</td>
                    <td className="p-4 text-right font-bold text-slate-200 currency">
                      {formatCurrency(l.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-12 bg-surface-800/20 border border-dashed border-surface-700 rounded-xl text-slate-500">
            Tidak ada riwayat transaksi instansi ditemukan.
          </div>
        )
      ) : (
        /* Tab 2: Stock Adjustment Log Table */
        adjustmentLogs.length > 0 ? (
          <div className="card p-0 overflow-hidden border border-surface-700 animate-fade-in">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4">Waktu Log</th>
                  <th className="p-4">Kode SKU</th>
                  <th className="p-4">Nama Barang</th>
                  <th className="p-4 text-right">Sebelum</th>
                  <th className="p-4 text-right">Perubahan (Delta)</th>
                  <th className="p-4 text-right">Stok Akhir</th>
                  <th className="p-4">Alasan Perubahan</th>
                  <th className="p-4">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {adjustmentLogs.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-850">
                    <td className="p-4 text-xs text-slate-400">{formatDate(a.adjustment_date)}</td>
                    <td className="p-4 font-mono font-semibold text-slate-300">{a.product_kode}</td>
                    <td className="p-4 font-bold text-white">{a.product_nama}</td>
                    <td className="p-4 text-right text-slate-400">{Number(a.stock_before)}</td>
                    <td className={`p-4 text-right font-bold ${a.qty_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {a.qty_delta > 0 ? `+${a.qty_delta}` : a.qty_delta}
                    </td>
                    <td className="p-4 text-right font-bold text-white">{Number(a.stock_after)}</td>
                    <td className="p-4 text-slate-300 max-w-xs truncate" title={a.alasan}>
                      {a.alasan}
                    </td>
                    <td className="p-4 text-xs text-slate-400">{a.staff_nama}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-12 bg-surface-800/20 border border-dashed border-surface-700 rounded-xl text-slate-500">
            Tidak ada log penyesuaian stok/mutasi barang terdaftar.
          </div>
        )
      )}
    </div>
  );
};
