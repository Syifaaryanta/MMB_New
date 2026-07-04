import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Calendar, User, FileText, X, Eye, FileSpreadsheet } from 'lucide-react';

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  supplier: {
    id: string;
    kode: string;
    nama: string;
  };
  terms: string;
  subtotal: number;
  status: string;
  received_at: string | null;
}

export const HistoryPembelian: React.FC = () => {
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Active PO Detail Modal
  const [activePo, setActivePo] = useState<any | null>(null);

  // Filters Modal
  const [showFilterModal, setShowFilterModal] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const supplierSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    // Load suppliers
    api.get('/suppliers?limit=100').then((res) => {
      setSuppliers(res.data.data || []);
    });

    setTimeout(() => fromDateRef.current?.focus(), 150);
  }, []);

  const handleFilterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowFilterModal(false);
    setIsLoading(true);

    try {
      let url = `/purchases?status=received`;
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;
      if (supplierId) url += `&supplier_id=${supplierId}`;

      const res = await api.get(url);
      setPurchases(res.data.data || []);
      setTotal(res.data.total || 0);
      setSelectedIdx(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (po: Purchase) => {
    try {
      const res = await api.get(`/purchases/${po.id}`);
      setActivePo(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Keyboard Shortcuts
  // Enter: View PO detail
  useHotkeys('enter', (e) => {
    e.preventDefault();
    if (!activePo && purchases.length > 0) {
      handleOpenDetail(purchases[selectedIdx]);
    }
  }, { enableOnFormTags: false });

  // F1: Open Filter Popup
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (!activePo) setShowFilterModal(true);
  }, { enableOnFormTags: true });

  // Arrow up/down navigation
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (!activePo) setSelectedIdx((p) => Math.max(0, p - 1));
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (!activePo) setSelectedIdx((p) => Math.min(purchases.length - 1, p + 1));
  }, { enableOnFormTags: false });

  // Escape to close detail or go back
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (activePo) {
      setActivePo(null);
    } else {
      navigate('/pembelian');
    }
  }, { enableOnFormTags: true });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Histori Pembelian</h1>
          <p className="text-slate-400">Arsip lengkap transaksi pemesanan barang yang sudah diterima</p>
        </div>
        {!activePo && (
          <button onClick={() => setShowFilterModal(true)} className="btn-secondary text-xs">
            Filter Rentang PO (F1)
          </button>
        )}
      </div>

      {!activePo ? (
        /* PO List */
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 skeleton" />
              ))}
            </div>
          ) : purchases.length > 0 ? (
            <div className="card p-0 overflow-hidden border border-surface-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4 w-12"></th>
                      <th className="p-4">Nomor PO</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Tanggal Order</th>
                      <th className="p-4">Tanggal Terima</th>
                      <th className="p-4 text-right">Subtotal</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700/50">
                    {purchases.map((p, idx) => (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedIdx(idx)}
                        onDoubleClick={() => handleOpenDetail(p)}
                        className={`hover:bg-surface-800/10 cursor-pointer transition-colors ${
                          idx === selectedIdx ? 'table-row-selected' : ''
                        }`}
                      >
                        <td className="p-4 text-center">
                          <input
                            type="radio"
                            checked={idx === selectedIdx}
                            onChange={() => setSelectedIdx(idx)}
                            className="accent-primary-500"
                          />
                        </td>
                        <td className="p-4 font-mono font-semibold text-slate-200">{p.no_order}</td>
                        <td className="p-4 font-bold text-white">{p.supplier.nama}</td>
                        <td className="p-4 text-slate-400">{formatDate(p.order_date)}</td>
                        <td className="p-4 text-slate-400">
                          {p.received_at ? formatDate(p.received_at) : '-'}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-200 currency">
                          {formatCurrency(Number(p.subtotal))}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleOpenDetail(p)}
                            className="btn-secondary py-1 px-2.5 text-xs text-primary-400 hover:text-white"
                          >
                            <Eye size={12} />
                            <span>Lihat Detail</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/20">
              <Calendar className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-400">Tidak ada data PO ditemukan</h3>
              <p className="text-sm mt-1">Gunakan filter F1 untuk mencari berdasarkan tanggal dan supplier lain.</p>
            </div>
          )}
        </div>
      ) : (
        /* PO Detail Modal View */
        <div className="space-y-6 animate-fade-in">
          {/* Metadata Card */}
          <div className="card p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-surface-800">
            <div>
              <p className="text-xs text-slate-400">Nomor PO</p>
              <p className="text-sm font-bold text-white font-mono">{activePo.no_order}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Supplier</p>
              <p className="text-sm font-bold text-white truncate">{activePo.supplier.nama}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Jatuh Tempo Termin</p>
              <p className="text-sm font-bold text-slate-350 uppercase">{activePo.terms}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Tanggal Order / Terima</p>
              <p className="text-xs font-semibold text-slate-200 mt-1">
                Order: {formatDate(activePo.order_date)}
              </p>
              {activePo.received_at && (
                <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                  Terima: {formatDate(activePo.received_at)}
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="card p-0 overflow-hidden border border-surface-700">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase">
                  <th className="p-4 w-12 text-center">No</th>
                  <th className="p-4">Kode</th>
                  <th className="p-4">Nama Produk</th>
                  <th className="p-4 text-right">Kuantitas</th>
                  <th className="p-4 text-right">Harga Beli</th>
                  <th className="p-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {activePo.purchase_items.map((item: any, idx: number) => (
                  <tr key={item.id} className="hover:bg-surface-800/10">
                    <td className="p-4 text-center text-slate-500">{idx + 1}</td>
                    <td className="p-4 font-mono font-semibold text-slate-300">{item.product.kode}</td>
                    <td className="p-4 font-bold text-white">{item.product.nama}</td>
                    <td className="p-4 text-right font-semibold text-slate-200">{Number(item.qty)}</td>
                    <td className="p-4 text-right text-emerald-400 font-semibold currency">
                      {formatCurrency(Number(item.harga_beli))}
                    </td>
                    <td className="p-4 text-right text-white font-bold currency">
                      {formatCurrency(Number(item.qty) * Number(item.harga_beli))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Footer */}
            <div className="flex justify-between items-center p-4 bg-surface-800/50 border-t border-surface-700">
              <div className="text-xs text-slate-500">
                Pembuat Nota: <span className="font-semibold text-slate-300">{activePo.creator?.nama || '-'}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase block">Grand Total PO</span>
                <span className="text-lg font-black text-emerald-400 currency">{formatCurrency(Number(activePo.subtotal))}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setActivePo(null)} className="btn-secondary">
              Tutup Detail (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 mb-4">
              <h3 className="text-lg font-bold text-white">Filter Histori PO</h3>
              <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFilterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Tanggal Awal</label>
                <input
                  ref={fromDateRef}
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && toDateRef.current?.focus()}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Tanggal Akhir</label>
                <input
                  ref={toDateRef}
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && supplierSelectRef.current?.focus()}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Pemasok (Supplier)</label>
                <select
                  ref={supplierSelectRef}
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="input-field py-2 text-xs"
                >
                  <option value="">Semua Pemasok</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-700">
                <button type="button" onClick={() => setShowFilterModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  Tampilkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
