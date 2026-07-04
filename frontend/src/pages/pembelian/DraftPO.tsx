import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Play, Trash2, ArrowRight, Clock, AlertTriangle } from 'lucide-react';

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
}

export const DraftPO: React.FC = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const fetchDrafts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/purchases?status=draft');
      setDrafts(res.data.data || []);
      setSelectedIdx(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleResume = (po: Purchase) => {
    // Construct step1 meta
    const poMeta = {
      noOrder: po.no_order,
      orderDate: po.order_date.slice(0, 10),
      supplier: po.supplier,
      terms: po.terms,
    };
    sessionStorage.setItem('po_step1', JSON.stringify(poMeta));
    navigate('/pembelian/input');
  };

  const handleDelete = async (id: string, no: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus draft PO "${no}"?`)) {
      try {
        await api.delete(`/purchases/${id}`);
        fetchDrafts();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Keyboard Shortcuts
  // Enter: Resume draft editing
  useHotkeys('enter', (e) => {
    e.preventDefault();
    if (drafts.length > 0) {
      handleResume(drafts[selectedIdx]);
    }
  }, { enableOnFormTags: false });

  // Delete draft PO
  useHotkeys('del', (e) => {
    e.preventDefault();
    if (drafts.length > 0) {
      handleDelete(drafts[selectedIdx].id, drafts[selectedIdx].no_order);
    }
  }, { enableOnFormTags: false });

  // Arrow up/down
  useHotkeys('up', (e) => {
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(0, prev - 1));
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(drafts.length - 1, prev + 1));
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
          <h1 className="text-2xl font-extrabold text-white">Draft Order PO</h1>
          <p className="text-slate-400">Daftar transaksi pemesanan barang yang belum diselesaikan</p>
        </div>
        <button onClick={() => navigate('/pembelian')} className="btn-secondary text-xs">
          Kembali ke PO
        </button>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-400">
        <span>Gunakan <kbd className="shortcut-badge text-[10px]">Arrow Up/Down</kbd> untuk memilih, <kbd className="shortcut-badge text-[10px]">Enter</kbd> untuk melanjutkan, <kbd className="shortcut-badge text-[10px]">Del</kbd> untuk hapus.</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 skeleton" />
          ))}
        </div>
      ) : drafts.length > 0 ? (
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
                {drafts.map((d, idx) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedIdx(idx)}
                    onDoubleClick={() => handleResume(d)}
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
                    <td className="p-4 font-mono font-semibold text-slate-200">{d.no_order}</td>
                    <td className="p-4 font-bold text-white">{d.supplier.nama}</td>
                    <td className="p-4 text-slate-400">{formatDate(d.order_date)}</td>
                    <td className="p-4 text-right font-bold text-slate-200 currency">
                      {formatCurrency(Number(d.subtotal))}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleResume(d)}
                          className="btn-secondary py-1 px-2.5 text-xs text-primary-400"
                        >
                          <Play size={12} />
                          <span>Lanjutkan</span>
                        </button>
                        <button
                          onClick={() => handleDelete(d.id, d.no_order)}
                          className="btn-secondary p-1.5 rounded-lg text-danger-400 hover:bg-danger-600/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/20">
          <Clock className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-400">Tidak ada Draft Order</h3>
          <p className="text-sm mt-1">Semua order pembelian aktif telah diselesaikan atau diterima.</p>
        </div>
      )}
    </div>
  );
};
