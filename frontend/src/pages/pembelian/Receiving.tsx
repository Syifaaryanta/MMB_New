import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckSquare, Calendar, User, Search, Play, FileText, Check, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  supplier: {
    id: string;
    kode: string;
    nama: string;
  };
  subtotal: number;
}

interface PurchaseItem {
  id: string;
  product: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  };
  qty: number;
}

export const Receiving: React.FC = () => {
  const navigate = useNavigate();

  // PO List States
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Active PO Checklist States
  const [activePo, setActivePo] = useState<any | null>(null);
  const [poItems, setPoItems] = useState<PurchaseItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [activeItemIdx, setActiveItemIdx] = useState(0);

  // Filter Modal
  const [showFilterModal, setShowFilterModal] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Focus Refs
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
      let url = `/purchases?status=completed`;
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;
      if (supplierId) url += `&supplier_id=${supplierId}`;

      const res = await api.get(url);
      setPurchases(res.data.data || []);
      setSelectedIdx(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChecklist = async (po: Purchase) => {
    try {
      const res = await api.get(`/purchases/${po.id}`);
      setActivePo(res.data);
      setPoItems(res.data.purchase_items || []);
      setCheckedItems({});
      setActiveItemIdx(0);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCheckItem = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleFinalize = async () => {
    if (!activePo) return;

    // Verify all items are checked
    const uncheckedCount = poItems.filter((i) => !checkedItems[i.id]).length;
    if (uncheckedCount > 0) {
      if (!confirm(`Terdapat ${uncheckedCount} barang belum di-checklist. Lanjutkan penerimaan?`)) {
        return;
      }
    }

    try {
      await api.patch(`/purchases/${activePo.id}/receive`);
      alert('Penerimaan PO diselesaikan! Stok gudang berhasil bertambah.');
      setActivePo(null);
      // Refresh list
      handleFilterSubmit({ preventDefault: () => {} } as any);
    } catch (err) {
      alert('Gagal menyelesaikan penerimaan PO');
    }
  };

  // Keyboard Shortcuts for List Mode
  // Enter: Open PO checklist
  useHotkeys('enter', (e) => {
    e.preventDefault();
    if (!activePo && purchases.length > 0) {
      handleOpenChecklist(purchases[selectedIdx]);
    }
  }, { enableOnFormTags: false });

  // Keyboard Shortcuts for Checklist Mode
  // Space / Enter: Toggle item checklist
  useHotkeys('space, enter', (e) => {
    e.preventDefault();
    if (activePo && poItems.length > 0) {
      toggleCheckItem(poItems[activeItemIdx].id);
    }
  }, { enableOnFormTags: false });

  // F1: Open Filter popup again
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (!activePo) setShowFilterModal(true);
  }, { enableOnFormTags: true });

  // F10: Finalize receiving
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (activePo) handleFinalize();
  }, { enableOnFormTags: true });

  // Arrow up/down
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (activePo) {
      setActiveItemIdx((p) => Math.max(0, p - 1));
    } else {
      setSelectedIdx((p) => Math.max(0, p - 1));
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (activePo) {
      setActiveItemIdx((p) => Math.min(poItems.length - 1, p + 1));
    } else {
      setSelectedIdx((p) => Math.min(purchases.length - 1, p + 1));
    }
  }, { enableOnFormTags: false });

  // Escape: Close checklist / Go back
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
          <h1 className="text-2xl font-extrabold text-white">Receiving Gudang (Penerimaan PO)</h1>
          <p className="text-slate-400">Verifikasi fisik barang yang datang untuk menyelesaikan Purchase Order</p>
        </div>
        {!activePo && (
          <button onClick={() => setShowFilterModal(true)} className="btn-secondary text-xs">
            Filter Pencarian (F1)
          </button>
        )}
      </div>

      {!activePo ? (
        /* PO List Mode */
        <div className="space-y-4">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Menampilkan PO yang siap diterima (Completed). Tekan <kbd className="shortcut-badge text-[10px]">Enter</kbd> untuk buka lembar checklist.</span>
          </div>

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
                      <th className="p-4 text-right">Subtotal</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700/50">
                    {purchases.map((p, idx) => (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedIdx(idx)}
                        onDoubleClick={() => handleOpenChecklist(p)}
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
                        <td className="p-4 font-mono font-semibold text-slate-250">{p.no_order}</td>
                        <td className="p-4 font-bold text-white">{p.supplier.nama}</td>
                        <td className="p-4 text-slate-400">{formatDate(p.order_date)}</td>
                        <td className="p-4 text-right font-bold text-slate-200 currency">
                          {formatCurrency(Number(p.subtotal))}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleOpenChecklist(p)}
                            className="btn-secondary py-1 px-2.5 text-xs text-emerald-400"
                          >
                            <Play size={12} />
                            <span>Proses Terima</span>
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
              <CheckSquare className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-400">Tidak ada PO yang Siap Diterima</h3>
              <p className="text-sm mt-1">Gunakan filter untuk mencari tanggal lain atau buat order PO baru.</p>
            </div>
          )}
        </div>
      ) : (
        /* Checklist Mode */
        <div className="space-y-6 animate-fade-in">
          {/* Active PO Info */}
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-surface-800">
            <div>
              <p className="text-xs text-slate-400">Penerimaan PO</p>
              <p className="text-sm font-bold text-white font-mono">{activePo.no_order}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Pemasok</p>
              <p className="text-sm font-bold text-white truncate">{activePo.supplier.nama}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Tanggal Order</p>
              <p className="text-sm font-bold text-white">{formatDate(activePo.order_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Termin</p>
              <p className="text-sm font-bold text-slate-300 uppercase">{activePo.terms}</p>
            </div>
          </div>

          {/* Checklist table */}
          <div className="card p-0 overflow-hidden border border-surface-700">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase">
                  <th className="p-4 w-16 text-center">Status</th>
                  <th className="p-4">Kode Barang</th>
                  <th className="p-4">Nama Barang</th>
                  <th className="p-4">Satuan</th>
                  <th className="p-4 text-right">Kuantitas Pesanan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {poItems.map((item, idx) => {
                  const isChecked = !!checkedItems[item.id];
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setActiveItemIdx(idx)}
                      className={`hover:bg-surface-800/10 cursor-pointer transition-colors ${
                        idx === activeItemIdx ? 'table-row-selected' : ''
                      }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCheckItem(item.id)}
                          className="w-4 h-4 rounded border-surface-650 bg-surface-900 text-primary-600 accent-primary-500"
                        />
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-300">{item.product.kode}</td>
                      <td className="p-4 font-bold text-white">{item.product.nama}</td>
                      <td className="p-4 text-slate-400">{item.product.satuan}</td>
                      <td className="p-4 text-right font-bold text-slate-200">{Number(item.qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Checklist table info footer */}
            <div className="p-4 bg-surface-800/50 border-t border-surface-700 flex justify-between items-center text-xs text-slate-400">
              <div>
                Tekan <kbd className="shortcut-badge text-[10px]">Space / Enter</kbd> untuk menandai barang.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActivePo(null)} className="btn-secondary py-1.5 px-3">
                  Batal
                </button>
                <button onClick={handleFinalize} className="btn-success py-1.5 px-3">
                  <Check size={14} />
                  <span>Selesaikan Penerimaan (F10)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 mb-4">
              <h3 className="text-lg font-bold text-white">Filter Penerimaan PO</h3>
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
                  Cari / Proses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
