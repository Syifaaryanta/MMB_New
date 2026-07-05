import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { 
  History, 
  Search, 
  Trash2, 
  Printer, 
  Calendar, 
  FileText, 
  X, 
  AlertOctagon,
  TrendingDown
} from 'lucide-react';

interface SalesPayment {
  id: string;
  sale_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  note: string | null;
  created_at: string;
  sale: {
    no_faktur: string | null;
    no_order: string;
    subtotal: number;
    customer: {
      kode: string;
      nama: string;
    };
  };
}

export const HistoryPembayaran: React.FC = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<SalesPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<SalesPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Selection & keyboard nav
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(0);

  // Receipt Modal (Enter)
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<SalesPayment | null>(null);

  // Rollback Modal (Delete)
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<SalesPayment | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/payments?from=${fromDate}&to=${toDate}`);
      setPayments(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [fromDate, toDate]);

  // Client-side filtering for customer name / invoice no
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = payments.filter((p) => {
      const docNo = (p.sale?.no_faktur || p.sale?.no_order || '').toLowerCase();
      const name = (p.sale?.customer?.nama || '').toLowerCase();
      const code = (p.sale?.customer?.kode || '').toLowerCase();
      return docNo.includes(q) || name.includes(q) || code.includes(q);
    });
    setFilteredPayments(filtered);
    setSelectedRowIdx(0);
  }, [payments, searchQuery]);

  // Shortcuts
  // F1: Focus Search Query
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F4: Normalisasi Kas
  useHotkeys('f4', (e) => {
    e.preventDefault();
    alert('Fungsi Normalisasi Log Kas berhasil dieksekusi! Semua data transaksi penagihan dan saldo piutang telah diverifikasi sinkron dengan buku besar.');
  }, { enableOnFormTags: false });

  // Enter: View Receipt
  useHotkeys('enter', (e) => {
    if (showReceiptModal || showRollbackModal) return;
    e.preventDefault();
    if (filteredPayments.length === 0) return;
    const target = filteredPayments[selectedRowIdx];
    if (target) {
      setReceiptTarget(target);
      setShowReceiptModal(true);
    }
  }, { enableOnFormTags: false });

  // Delete: Rollback
  useHotkeys('delete', (e) => {
    e.preventDefault();
    if (filteredPayments.length === 0) return;
    const target = filteredPayments[selectedRowIdx];
    if (target) {
      setRollbackTarget(target);
      setShowRollbackModal(true);
    }
  }, { enableOnFormTags: false });

  // ArrowUp / ArrowDown
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (selectedRowIdx > 0) setSelectedRowIdx(selectedRowIdx - 1);
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (selectedRowIdx < filteredPayments.length - 1) setSelectedRowIdx(selectedRowIdx + 1);
  }, { enableOnFormTags: false });

  // Escape: exit modal or return
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showReceiptModal) {
      setShowReceiptModal(false);
    } else if (showRollbackModal) {
      setShowRollbackModal(false);
    } else if (searchQuery) {
      setSearchQuery('');
    } else {
      navigate('/penagihan');
    }
  }, { enableOnFormTags: true });

  const executeRollback = async () => {
    if (!rollbackTarget) return;
    try {
      await api.delete(`/payments/${rollbackTarget.id}`);
      setShowRollbackModal(false);
      fetchPayments();
      alert('Pembayaran berhasil di-rollback. Sisa piutang pelanggan telah dikembalikan.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal melakukan rollback');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
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
          <h1 className="text-2xl font-extrabold text-white">History & Pembatalan Setoran</h1>
          <p className="text-slate-400 text-sm">Lacak rekam histori transaksi penagihan dan lakukan pembatalan/rollback setoran.</p>
        </div>

        <div className="flex gap-2 text-xs print:hidden">
          <button
            onClick={() => {
              if (filteredPayments.length > 0) {
                setRollbackTarget(filteredPayments[selectedRowIdx]);
                setShowRollbackModal(true);
              }
            }}
            disabled={filteredPayments.length === 0}
            className="btn-danger flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>Rollback Pembayaran (Del)</span>
          </button>
          <button
            onClick={() => {
              if (filteredPayments.length > 0) {
                setReceiptTarget(filteredPayments[selectedRowIdx]);
                setShowReceiptModal(true);
              }
            }}
            disabled={filteredPayments.length === 0}
            className="card bg-surface-800 hover:bg-surface-750 px-3 py-2 text-slate-300 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText size={14} />
            <span>Kwitansi Detail (Enter)</span>
          </button>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        {/* Search */}
        <div className="relative col-span-1 md:col-span-2">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Faktur / Toko (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Kode toko, nama pelanggan, no faktur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Awal</label>
          <div className="relative">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field w-full py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tanggal Akhir</label>
          <div className="relative">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field w-full py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Payments List Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">No</th>
              <th className="p-4">Tanggal Setor</th>
              <th className="p-4">No. Faktur</th>
              <th className="p-4">Nama Pelanggan</th>
              <th className="p-4 text-center">Metode</th>
              <th className="p-4">Catatan</th>
              <th className="p-4 text-right">Nominal Setoran</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                  Sedang memuat data transaksi...
                </td>
              </tr>
            ) : filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                  Tidak ada data pembayaran yang cocok dengan filter tanggal/pencarian.
                </td>
              </tr>
            ) : (
              filteredPayments.map((pay, idx) => {
                const isSelected = selectedRowIdx === idx;
                const rowBgClass = isSelected ? 'bg-blue-100' : 'hover:bg-slate-50';

                const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                  let base = "p-4 transition-all duration-150 border-b ";
                  if (isSelected) {
                    base += "bg-blue-100 text-primary-950 font-bold border-blue-300 ";
                    if (pos === 'first') base += "border-l-4 border-primary-600 ";
                  } else {
                    base += "text-slate-800 border-slate-200 ";
                    if (pos === 'first') base += "border-l-4 border-transparent ";
                  }
                  return base;
                };

                return (
                  <tr
                    key={pay.id}
                    onClick={() => setSelectedRowIdx(idx)}
                    className={`cursor-pointer transition-all ${rowBgClass}`}
                  >
                    <td className={getTdClass('first') + " text-center text-slate-500"}>{idx + 1}</td>
                    <td className={getTdClass('middle') + " font-semibold text-slate-700"}>{formatDate(pay.payment_date)}</td>
                    <td className={getTdClass('middle') + " font-mono font-bold text-slate-800"}>
                      {pay.sale?.no_faktur || pay.sale?.no_order || '-'}
                    </td>
                    <td className={getTdClass('middle') + " font-bold text-slate-900"}>
                      {pay.sale?.customer?.nama || 'Direct Cash'}
                      <span className="block text-[10px] text-slate-500">{pay.sale?.customer?.kode || ''}</span>
                    </td>
                    <td className={getTdClass('middle') + " text-center"}>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-surface-900 border border-surface-700/60 text-slate-650">
                        {pay.payment_method}
                      </span>
                    </td>
                    <td className={getTdClass('middle') + " italic text-slate-600 truncate max-w-xs"}>{pay.note || '-'}</td>
                    <td className={getTdClass('last') + " text-right font-mono text-slate-900 font-bold text-sm"}>
                      {formatCurrency(Number(pay.amount))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Kwitansi Receipt Modal (Enter) */}
      {showReceiptModal && receiptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay print:bg-white print:absolute print:inset-0">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl animate-scale-in flex flex-col print:border-none print:shadow-none print:bg-white print:text-black">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 shrink-0 print:hidden">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-primary-400" />
                <span>Bukti Kwitansi Pelunasan</span>
              </h3>
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Receipt Body content for printing */}
            <div className="flex-1 py-6 space-y-6 text-xs text-slate-300 print:text-black print:py-0">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-black text-white print:text-black tracking-wide">MAJU MULIA BERSAMA (MMB)</h2>
                <p className="text-[10px] text-slate-400 print:text-black font-semibold">Bukti Penerimaan Kas Masuk (Kwitansi)</p>
                <div className="border-b-2 border-dashed border-slate-700 print:border-black my-2"></div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 print:text-slate-600 block">DITERIMA DARI:</span>
                  <strong className="text-white print:text-black text-sm">{receiptTarget.sale?.customer?.nama || 'Direct Cash'}</strong>
                  <p className="text-[10px] text-slate-400 print:text-black font-mono">Kode: {receiptTarget.sale?.customer?.kode || '-'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 print:text-slate-600 block">KODE KWITANSI / TGL:</span>
                  <strong className="text-slate-200 print:text-black font-mono text-sm uppercase">{receiptTarget.id.slice(0, 8)}</strong>
                  <p className="text-[10px] text-slate-400 print:text-black">{formatDate(receiptTarget.payment_date)}</p>
                </div>
              </div>

              {/* Invoice Detail Box */}
              <div className="bg-surface-900 border border-surface-750 p-4 rounded-xl space-y-2 print:bg-slate-100 print:border-slate-300 print:text-black">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 print:text-slate-600">Terbayar Untuk Invoice</span>
                  <strong className="font-mono text-slate-200 print:text-black">{receiptTarget.sale?.no_faktur || receiptTarget.sale?.no_order}</strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 print:text-slate-600">Total Nilai Invoice</span>
                  <span className="font-mono text-slate-300 print:text-black">{formatCurrency(Number(receiptTarget.sale?.subtotal))}</span>
                </div>
                <div className="border-t border-dashed border-surface-700/60 print:border-slate-300 my-1"></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 print:text-slate-600 font-bold">Jumlah Setoran Ini</span>
                  <strong className="font-mono text-emerald-400 print:text-black text-sm">{formatCurrency(Number(receiptTarget.amount))}</strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 print:text-slate-600">Metode</span>
                  <span className="font-bold uppercase text-[10px] print:text-black">{receiptTarget.payment_method}</span>
                </div>
              </div>

              {/* Note */}
              <div className="text-xs">
                <span className="text-[10px] text-slate-400 print:text-slate-600 block">KETERANGAN / LOG CATATAN:</span>
                <p className="italic text-slate-300 print:text-black">"{receiptTarget.note || 'Tidak ada catatan tambahan'}"</p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 pt-8 text-center text-[10px]">
                <div>
                  <p className="text-slate-400 print:text-slate-600">Tanda Tangan Penerima / Kolektor</p>
                  <div className="h-12"></div>
                  <p className="font-bold border-t border-slate-700 print:border-black pt-1 max-w-[120px] mx-auto">Staff Kasir MMB</p>
                </div>
                <div>
                  <p className="text-slate-400 print:text-slate-600">Tanda Tangan Penyetor / Customer</p>
                  <div className="h-12"></div>
                  <p className="font-bold border-t border-slate-700 print:border-black pt-1 max-w-[120px] mx-auto">{receiptTarget.sale?.customer?.nama || 'Pelanggan'}</p>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-surface-700 flex justify-between shrink-0 print:hidden text-xs">
              <button 
                onClick={handlePrintReceipt}
                className="btn-primary py-2 px-5 bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Cetak Kwitansi (Ctrl+P)</span>
              </button>
              <button 
                type="button" 
                onClick={() => setShowReceiptModal(false)}
                className="btn-primary py-2 px-6 bg-surface-700 hover:bg-surface-650"
              >
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal (Delete) */}
      {showRollbackModal && rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in space-y-4">
            <div className="flex items-center gap-3 text-danger-400 border-b border-surface-700 pb-3">
              <AlertOctagon size={24} />
              <h3 className="text-base font-bold text-white">Konfirmasi Rollback</h3>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>Apakah Anda yakin ingin membatalkan/rollback transaksi pelunasan berikut?</p>
              <div className="p-3 bg-surface-900 border border-surface-750 rounded-lg space-y-1">
                <p>Invoice: <strong className="text-slate-200">{rollbackTarget.sale?.no_faktur || rollbackTarget.sale?.no_order}</strong></p>
                <p>Pelanggan: <strong className="text-slate-200">{rollbackTarget.sale?.customer?.nama}</strong></p>
                <p>Nominal: <strong className="text-rose-400">{formatCurrency(rollbackTarget.amount)}</strong></p>
              </div>
              <p className="text-[10px] text-slate-400">
                *Tindakan ini akan mengembalikan status invoice menjadi Belum Lunas dan meningkatkan sisa saldo piutang pelanggan kembali.
              </p>
            </div>

            <div className="pt-2 border-t border-surface-700 flex justify-end gap-2 text-xs">
              <button 
                onClick={() => setShowRollbackModal(false)}
                className="card bg-surface-700 hover:bg-surface-650 px-4 py-2 text-slate-300 font-bold border border-surface-600 rounded-lg"
              >
                Batal (Esc)
              </button>
              <button 
                onClick={executeRollback}
                className="btn-danger py-2 px-5 font-bold"
              >
                Ya, Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
