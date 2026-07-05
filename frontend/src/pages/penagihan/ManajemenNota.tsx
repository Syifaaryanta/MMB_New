import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { 
  FileCheck, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  RefreshCw, 
  HelpCircle,
  X
} from 'lucide-react';

interface InvoiceNota {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  customer_nama: string;
  subtotal: number;
  nota_merah: boolean;
  nota_putih: boolean;
  nota_kuning: boolean;
  sales_payments: Array<{ amount: number }>;
}

export const ManajemenNota: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceNota[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceNota[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard navigation & editing state
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeCol, setActiveCol] = useState<'merah' | 'putih' | 'kuning'>('merah');

  // Modal manual helper
  const [showHelp, setShowHelp] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/sales?status=completed');
      setInvoices(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Filter list client-side based on invoice no, customer name
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = invoices.filter((inv) => {
      const docNo = (inv.no_faktur || inv.no_order).toLowerCase();
      const cust = inv.customer_nama.toLowerCase();
      return docNo.includes(query) || cust.includes(query);
    });
    setFilteredInvoices(filtered);
    setSelectedRowIdx(0);
  }, [invoices, searchQuery]);

  // Save specific invoice nota changes
  const saveNotaStatus = async (invoice: InvoiceNota) => {
    try {
      await api.patch(`/sales/${invoice.id}/nota`, {
        nota_merah: invoice.nota_merah,
        nota_putih: invoice.nota_putih,
        nota_kuning: invoice.nota_kuning,
      });
    } catch (err) {
      console.error('Gagal menyimpan status nota', err);
    }
  };

  // Keyboard Hotkeys
  // F1: Focus Search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    setIsEditMode(false);
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F4: Auto-sync based on payment completion
  useHotkeys('f4', async (e) => {
    e.preventDefault();
    if (filteredInvoices.length === 0) return;
    if (confirm('Lakukan sinkronisasi checklist dokumen nota fisik berdasarkan status lunas invoice?')) {
      setIsLoading(true);
      try {
        const updatedList = await Promise.all(
          invoices.map(async (inv) => {
            const totalPaid = inv.sales_payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const remaining = Number(inv.subtotal) - totalPaid;
            
            // If fully paid, check all copies (White, Red, Yellow)
            if (remaining <= 0) {
              const updated = {
                ...inv,
                nota_merah: true,
                nota_putih: true,
                nota_kuning: true,
              };
              // Persist to database
              await api.patch(`/sales/${inv.id}/nota`, {
                nota_merah: true,
                nota_putih: true,
                nota_kuning: true,
              });
              return updated;
            }
            return inv;
          })
        );
        setInvoices(updatedList);
        alert('Sinkronisasi dokumen nota lunas berhasil diselesaikan!');
      } catch (err) {
        console.error(err);
        alert('Gagal mensinkronisasikan dokumen nota');
      } finally {
        setIsLoading(false);
      }
    }
  }, { enableOnFormTags: false });

  // Escape: exit mode edit or return
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (isEditMode) {
      setIsEditMode(false);
      // save current row just in case
      const activeInv = filteredInvoices[selectedRowIdx];
      if (activeInv) saveNotaStatus(activeInv);
    } else if (searchQuery) {
      setSearchQuery('');
    } else {
      navigate('/penagihan');
    }
  }, { enableOnFormTags: true });

  // ArrowUp / ArrowDown: Navigation
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (filteredInvoices.length === 0) return;
    if (selectedRowIdx > 0) {
      if (isEditMode) {
        // save the old row first
        saveNotaStatus(filteredInvoices[selectedRowIdx]);
      }
      setSelectedRowIdx(selectedRowIdx - 1);
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (filteredInvoices.length === 0) return;
    if (selectedRowIdx < filteredInvoices.length - 1) {
      if (isEditMode) {
        // save the old row first
        saveNotaStatus(filteredInvoices[selectedRowIdx]);
      }
      setSelectedRowIdx(selectedRowIdx + 1);
    }
  }, { enableOnFormTags: false });

  // Enter: enter edit mode
  useHotkeys('enter', (e) => {
    if (isEditMode) {
      e.preventDefault();
      // Toggle the active checkbox
      toggleActiveCheckbox();
    } else {
      e.preventDefault();
      setIsEditMode(true);
      setActiveCol('merah'); // default column
    }
  }, { enableOnFormTags: false });

  // Spacebar: toggle checkbox in edit mode
  useHotkeys('space', (e) => {
    if (isEditMode) {
      e.preventDefault();
      toggleActiveCheckbox();
    }
  }, { enableOnFormTags: false });

  // ArrowLeft / ArrowRight: slide columns in edit mode
  useHotkeys('left', (e) => {
    if (isEditMode) {
      e.preventDefault();
      if (activeCol === 'putih') setActiveCol('merah');
      else if (activeCol === 'kuning') setActiveCol('putih');
    }
  }, { enableOnFormTags: false });

  useHotkeys('right', (e) => {
    if (isEditMode) {
      e.preventDefault();
      if (activeCol === 'merah') setActiveCol('putih');
      else if (activeCol === 'putih') setActiveCol('kuning');
    }
  }, { enableOnFormTags: false });

  const toggleActiveCheckbox = () => {
    const target = filteredInvoices[selectedRowIdx];
    if (!target) return;

    const key = `nota_${activeCol}` as 'nota_merah' | 'nota_putih' | 'nota_kuning';
    const updatedVal = !target[key];

    // Update screen state immediately
    const updatedInvoices = invoices.map((inv) => {
      if (inv.id === target.id) {
        return {
          ...inv,
          [key]: updatedVal,
        };
      }
      return inv;
    });

    setInvoices(updatedInvoices);
  };

  const handleRowClick = (idx: number) => {
    if (isEditMode && selectedRowIdx !== idx) {
      saveNotaStatus(filteredInvoices[selectedRowIdx]);
    }
    setSelectedRowIdx(idx);
    setIsEditMode(true);
    setActiveCol('merah');
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Manajemen Dokumen Nota</h1>
          <p className="text-slate-400 text-sm">Pemeriksaan fisik dokumen serah terima nota 3-warna (Merah, Putih, Kuning).</p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={() => setShowHelp(true)}
            className="card bg-surface-800 hover:bg-surface-750 px-3 py-2 text-slate-300 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5"
          >
            <HelpCircle size={14} />
            <span>Petunjuk Shortcut</span>
          </button>
          <button 
            onClick={fetchInvoices}
            className="card bg-surface-800 hover:bg-surface-750 px-3 py-2 text-slate-350 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            <span>Refresh Data</span>
          </button>
          <button 
            onClick={() => {
              if (isEditMode) {
                saveNotaStatus(filteredInvoices[selectedRowIdx]);
                setIsEditMode(false);
                alert('Penyimpanan status dokumen selesai.');
              }
            }}
            disabled={!isEditMode}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={14} />
            <span>Simpan Perubahan (Esc)</span>
          </button>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div className="relative max-w-md">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari No Invoice / Pelanggan (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Ketik no invoice atau nama toko..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Sync Controls */}
        <div className="text-right flex flex-col justify-end text-[11px] text-slate-400">
          <p>
            Tekan <kbd className="shortcut-badge text-primary-400 font-bold">F4</kbd> untuk sinkronisasi otomatis
            status nota lunas di database.
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            *Nota yang sisa piutangnya Rp 0 akan tercentang Merah, Putih, & Kuning sekaligus.
          </p>
        </div>
      </div>

      {/* Main Checklist Grid Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">No</th>
              <th className="p-4">No. Invoice</th>
              <th className="p-4">Tgl Transaksi</th>
              <th className="p-4">Nama Pelanggan</th>
              <th className="p-4 text-right">Nilai Belanja</th>
              
              {/* Colored Nota Columns */}
              <th className="p-4 text-center w-28 bg-rose-950/20 border-l border-surface-700/30">
                Merah (Finance)
              </th>
              <th className="p-4 text-center w-28 bg-slate-900/30 border-l border-surface-700/30">
                Putih (Customer)
              </th>
              <th className="p-4 text-center w-28 bg-amber-950/20 border-l border-surface-700/30">
                Kuning (Gudang)
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="animate-spin text-primary-500" size={16} />
                    <span>Mengambil data invoice...</span>
                  </div>
                </td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  Tidak ada invoice completed ditemukan.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv, idx) => {
                const isSelected = selectedRowIdx === idx;
                const isMerahActive = isSelected && isEditMode && activeCol === 'merah';
                const isPutihActive = isSelected && isEditMode && activeCol === 'putih';
                const isKuningActive = isSelected && isEditMode && activeCol === 'kuning';
                const rowBgClass = isSelected ? 'bg-blue-100' : 'hover:bg-slate-50';

                const getTdClass = (pos: 'first' | 'middle' | 'last', customBg?: string) => {
                  let base = "p-4 transition-all duration-150 border-b ";
                  if (isSelected) {
                    base += "bg-blue-100 text-primary-950 font-bold border-blue-300 ";
                    if (pos === 'first') base += "border-l-4 border-primary-600 ";
                  } else {
                    base += (customBg || "text-slate-800") + " border-slate-200 ";
                    if (pos === 'first') base += "border-l-4 border-transparent ";
                  }
                  return base;
                };

                return (
                  <tr
                    key={inv.id}
                    onClick={() => handleRowClick(idx)}
                    className={`cursor-pointer transition-all ${rowBgClass}`}
                  >
                    <td className={getTdClass('first') + " text-center text-slate-500"}>{idx + 1}</td>
                    <td className={getTdClass('middle') + " font-mono font-bold text-slate-800"}>
                      {inv.no_faktur || inv.no_order}
                    </td>
                    <td className={getTdClass('middle') + " text-slate-700"}>{formatDate(inv.order_date)}</td>
                    <td className={getTdClass('middle') + " font-bold text-slate-900"}>{inv.customer_nama}</td>
                    <td className={getTdClass('middle') + " text-right font-mono text-slate-800"}>{formatCurrency(Number(inv.subtotal))}</td>
                    
                    {/* Nota Merah Checkbox */}
                    <td className={getTdClass('middle', 'bg-rose-50/60') + ` text-center border-l border-slate-200 transition-all ${
                      isMerahActive ? 'ring-2 ring-rose-500 ring-inset bg-rose-100' : ''
                    }`}>
                      <input
                        type="checkbox"
                        checked={inv.nota_merah}
                        onChange={(e) => {
                          const updated = invoices.map(i => i.id === inv.id ? { ...i, nota_merah: e.target.checked } : i);
                          setInvoices(updated);
                          saveNotaStatus({ ...inv, nota_merah: e.target.checked });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300 bg-white text-rose-550 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* ... */}
                    {/* Nota Putih Checkbox */}
                    <td className={getTdClass('middle', 'bg-slate-50/60') + ` text-center border-l border-slate-200 transition-all ${
                      isPutihActive ? 'ring-2 ring-primary-500 ring-inset bg-blue-50' : ''
                    }`}>
                      <input
                        type="checkbox"
                        checked={inv.nota_putih}
                        onChange={(e) => {
                          const updated = invoices.map(i => i.id === inv.id ? { ...i, nota_putih: e.target.checked } : i);
                          setInvoices(updated);
                          saveNotaStatus({ ...inv, nota_putih: e.target.checked });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300 bg-white text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Nota Kuning Checkbox */}
                    <td className={getTdClass('last', 'bg-amber-50/60') + ` text-center border-l border-slate-200 transition-all ${
                      isKuningActive ? 'ring-2 ring-amber-500 ring-inset bg-amber-100' : ''
                    }`}>
                      <input
                        type="checkbox"
                        checked={inv.nota_kuning}
                        onChange={(e) => {
                          const updated = invoices.map(i => i.id === inv.id ? { ...i, nota_kuning: e.target.checked } : i);
                          setInvoices(updated);
                          saveNotaStatus({ ...inv, nota_kuning: e.target.checked });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300 bg-white text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Instructions Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in space-y-4">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle size={18} className="text-primary-400" />
                <span>Petunjuk Shortcut Keyboard</span>
              </h3>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-350 space-y-3">
              <p>Halaman ini dirancang untuk pembaruan cepat checklist fisik nota:</p>
              <ul className="list-disc pl-4 space-y-2">
                <li><kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> : Berpindah baris invoice.</li>
                <li><kbd className="shortcut-badge">Enter</kbd> : Masuk ke mode edit baris (Kursor hijau akan muncul).</li>
                <li><kbd className="shortcut-badge">←</kbd> <kbd className="shortcut-badge">→</kbd> : Geser kursor kolom (Merah ➡️ Putih ➡️ Kuning).</li>
                <li><kbd className="shortcut-badge">Space</kbd> / <kbd className="shortcut-badge">Enter</kbd> : Toggle checklist nota.</li>
                <li><kbd className="shortcut-badge">F4</kbd> : Sinkronisasi checklist otomatis untuk semua nota lunas.</li>
                <li><kbd className="shortcut-badge">Esc</kbd> : Keluar mode edit (menyimpan otomatis) atau kembali ke menu.</li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setShowHelp(false)}
                className="btn-primary py-1.5 px-4 text-xs"
              >
                Mengerti (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
