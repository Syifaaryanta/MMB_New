import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  DollarSign, 
  Calendar, 
  FileText, 
  CreditCard,
  AlertTriangle,
  CheckCircle,
  X,
  Printer
} from 'lucide-react';

interface CustomerGroup {
  customer: {
    id: string;
    kode: string;
    nama: string;
    alamat: string;
    no_telp: string;
    limit_kredit: string;
    saldo_piutang: string;
  };
  total_piutang: number;
  invoices: InvoiceDetail[];
}

interface InvoiceDetail {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  due_date: string | null;
  subtotal: number;
  paid_amount: number;
  remaining: number;
  is_overdue: boolean;
  diantar: boolean;
  limit_bulan: number;
  sender_note: string | null;
}

export const PiutangAktif: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerGroup[]>([]);
  const [filteredData, setFilteredData] = useState<CustomerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lancar' | 'overdue'>('all');

  // Expanded customers
  const [expandedCustIds, setExpandedCustIds] = useState<Record<string, boolean>>({});

  // Keyboard navigation
  const [selectedCustIdx, setSelectedCustIdx] = useState<number>(0);
  const [selectedInvoiceIdx, setSelectedInvoiceIdx] = useState<number | null>(null);

  // Refs for focusing
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal payment setoran
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<InvoiceDetail | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  // Modal invoice detail (F4)
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/payments/piutang?q=${searchQuery}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, [searchQuery]);

  // Apply status filter client side
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredData(data);
      return;
    }

    const filtered = data
      .map((group) => {
        const matchingInvoices = group.invoices.filter((inv) => {
          if (statusFilter === 'overdue') return inv.is_overdue;
          if (statusFilter === 'lancar') return !inv.is_overdue;
          return true;
        });

        return {
          ...group,
          invoices: matchingInvoices,
          total_piutang: matchingInvoices.reduce((sum, inv) => sum + inv.remaining, 0),
        };
      })
      .filter((group) => group.invoices.length > 0);

    setFilteredData(filtered);
  }, [data, statusFilter]);

  // Reset selected indexes when filtered data changes
  useEffect(() => {
    setSelectedCustIdx(0);
    setSelectedInvoiceIdx(null);
  }, [filteredData]);

  // Keyboard Shortcuts
  // F1: Focus Search Customer
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F3: Toggle Status Filter
  useHotkeys('f3', (e) => {
    e.preventDefault();
    setStatusFilter((curr) => {
      if (curr === 'all') return 'overdue';
      if (curr === 'overdue') return 'lancar';
      return 'all';
    });
  }, { enableOnFormTags: true });

  // F4: Detail transaction nota
  useHotkeys('f4', (e) => {
    e.preventDefault();
    openDetailModal();
  }, { enableOnFormTags: false });

  // F10: Process setoran payment
  useHotkeys('f10', (e) => {
    e.preventDefault();
    openPaymentModal();
  }, { enableOnFormTags: false });

  // ArrowUp / ArrowDown: Navigation
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (filteredData.length === 0) return;

    if (selectedInvoiceIdx !== null && selectedInvoiceIdx > 0) {
      setSelectedInvoiceIdx(selectedInvoiceIdx - 1);
    } else if (selectedInvoiceIdx === 0) {
      setSelectedInvoiceIdx(null); // return to customer head
    } else if (selectedCustIdx > 0) {
      const prevIdx = selectedCustIdx - 1;
      setSelectedCustIdx(prevIdx);
      const prevCust = filteredData[prevIdx];
      // if previous customer is expanded, focus their last invoice
      if (expandedCustIds[prevCust.customer.id] && prevCust.invoices.length > 0) {
        setSelectedInvoiceIdx(prevCust.invoices.length - 1);
      } else {
        setSelectedInvoiceIdx(null);
      }
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (filteredData.length === 0) return;

    const currentCust = filteredData[selectedCustIdx];
    const isExpanded = expandedCustIds[currentCust.customer.id];

    if (isExpanded && (selectedInvoiceIdx === null || selectedInvoiceIdx < currentCust.invoices.length - 1)) {
      setSelectedInvoiceIdx(selectedInvoiceIdx === null ? 0 : selectedInvoiceIdx + 1);
    } else if (selectedCustIdx < filteredData.length - 1) {
      setSelectedCustIdx(selectedCustIdx + 1);
      setSelectedInvoiceIdx(null);
    }
  }, { enableOnFormTags: false });

  // Enter: Expand/Collapse
  useHotkeys('enter', (e) => {
    if (showPaymentModal || showDetailModal) return;
    e.preventDefault();
    if (filteredData.length === 0) return;
    const custId = filteredData[selectedCustIdx].customer.id;
    setExpandedCustIds((prev) => ({
      ...prev,
      [custId]: !prev[custId],
    }));
  }, { enableOnFormTags: false });

  // Escape: Reset search / return
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showPaymentModal) {
      setShowPaymentModal(false);
    } else if (showDetailModal) {
      setShowDetailModal(false);
    } else if (searchQuery) {
      setSearchQuery('');
    } else {
      navigate('/penagihan');
    }
  }, { enableOnFormTags: true });

  const openDetailModal = async () => {
    if (selectedCustIdx === null) return;
    const customerGroup = filteredData[selectedCustIdx];
    if (!customerGroup || selectedInvoiceIdx === null) return;
    const inv = customerGroup.invoices[selectedInvoiceIdx];
    if (!inv) return;

    setDetailInvoiceId(inv.id);
    setShowDetailModal(true);
    setIsLoadingDetail(true);

    try {
      const res = await api.get(`/sales/${inv.id}`);
      setDetailInvoice(res.data);
    } catch (err) {
      console.error(err);
      alert('Gagal mengambil detail invoice');
      setShowDetailModal(false);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openPaymentModal = () => {
    if (selectedCustIdx === null || selectedInvoiceIdx === null) {
      alert('Silakan pilih nota tagihan terlebih dahulu menggunakan ArrowUp/Down.');
      return;
    }
    const customerGroup = filteredData[selectedCustIdx];
    const inv = customerGroup.invoices[selectedInvoiceIdx];
    if (!inv) return;

    setPaymentTargetInvoice(inv);
    setPaymentAmount(inv.remaining); // default to full payment
    setPaymentMethod('cash');
    setPaymentNote('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setShowPaymentModal(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetInvoice || !paymentAmount || Number(paymentAmount) <= 0) return;

    if (Number(paymentAmount) > paymentTargetInvoice.remaining) {
      if (!confirm('Nominal setoran melebihi sisa tagihan. Lanjutkan?')) return;
    }

    try {
      await api.post('/payments', {
        sale_id: paymentTargetInvoice.id,
        payment_date: paymentDate,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        note: paymentNote,
      });

      setShowPaymentModal(false);
      fetchData(); // reload
      alert('Setoran pembayaran piutang berhasil disimpan!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menyimpan pembayaran');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
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
          <h1 className="text-2xl font-extrabold text-white">Piutang Aktif</h1>
          <p className="text-slate-400 text-sm">Monitoring daftar invoice kredit aktif dan catat angsuran piutang.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button 
            onClick={openPaymentModal} 
            disabled={selectedInvoiceIdx === null}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <DollarSign size={14} />
            <span>Bayar Tagihan (F10)</span>
          </button>
          <button 
            onClick={openDetailModal} 
            disabled={selectedInvoiceIdx === null}
            className="card bg-surface-800 hover:bg-surface-750 px-3 py-2 text-slate-300 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText size={14} />
            <span>Detail Nota (F4)</span>
          </button>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Pelanggan (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Filter Status Piutang (F3)</label>
          <div className="flex gap-1.5 p-1 bg-surface-900 border border-surface-750 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 rounded font-bold transition-all ${statusFilter === 'all' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('overdue')}
              className={`flex-1 py-1.5 rounded font-bold transition-all ${statusFilter === 'overdue' ? 'bg-danger-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Overdue
            </button>
            <button
              onClick={() => setStatusFilter('lancar')}
              className={`flex-1 py-1.5 rounded font-bold transition-all ${statusFilter === 'lancar' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Lancar
            </button>
          </div>
        </div>

        {/* Hints */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-400 space-y-1">
          <p>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih pelanggan/nota.</p>
          <p>Tekan <kbd className="shortcut-badge">Enter</kbd> untuk expand/collapse rincian invoice.</p>
        </div>
      </div>

      {/* Customer List Card Grid */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 italic text-xs border border-surface-700">
          Tidak ada piutang aktif yang ditemukan berdasarkan filter pencarian.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map((group, cIdx) => {
            const cust = group.customer;
            const isExpanded = !!expandedCustIds[cust.id];
            const isSelected = selectedCustIdx === cIdx && selectedInvoiceIdx === null;

            return (
              <div 
                key={cust.id} 
                className={`card p-0 overflow-hidden border transition-all ${
                  isSelected ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-surface-700/60'
                }`}
              >
                {/* Header Row */}
                <div 
                  onClick={() => {
                    setSelectedCustIdx(cIdx);
                    setSelectedInvoiceIdx(null);
                    setExpandedCustIds(prev => ({ ...prev, [cust.id]: !prev[cust.id] }));
                  }}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-surface-750/30 ${
                    isSelected ? 'bg-surface-750/50' : 'bg-surface-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {cust.nama}
                        <span className="font-mono text-[10px] text-slate-400 bg-surface-900 px-1.5 py-0.5 rounded">{cust.kode}</span>
                      </h3>
                      <p className="text-slate-400 text-xs mt-0.5 truncate max-w-md">{cust.alamat}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-end sm:self-center text-right">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Limit Kredit</span>
                      <span className="text-xs text-slate-300 font-semibold">{formatCurrency(Number(cust.limit_kredit))}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Total Piutang</span>
                      <span className="text-sm font-black text-rose-400 currency">{formatCurrency(group.total_piutang)}</span>
                    </div>
                  </div>
                </div>

                {/* Invoices expanded section */}
                {isExpanded && (
                  <div className="border-t border-surface-700/60 bg-surface-900/30 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-surface-800/30 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-surface-750">
                          <th className="p-3 w-8 text-center">No</th>
                          <th className="p-3">No. Faktur</th>
                          <th className="p-3">Tgl Order</th>
                          <th className="p-3">Jatuh Tempo</th>
                          <th className="p-3 text-right">Total Transaksi</th>
                          <th className="p-3 text-right">Terbayar</th>
                          <th className="p-3 text-right">Sisa Tagihan</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-750">
                        {group.invoices.map((inv, iIdx) => {
                          const isInvSelected = selectedCustIdx === cIdx && selectedInvoiceIdx === iIdx;

                          return (
                            <tr
                              key={inv.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustIdx(cIdx);
                                setSelectedInvoiceIdx(iIdx);
                              }}
                              className={`hover:bg-surface-750/30 cursor-pointer ${
                                isInvSelected ? 'bg-primary-950/20 text-white font-semibold' : 'text-slate-300'
                              }`}
                            >
                              <td className="p-3 text-center text-slate-500">{iIdx + 1}</td>
                              <td className="p-3 font-mono font-bold text-slate-200">
                                {inv.no_faktur || inv.no_order}
                              </td>
                              <td className="p-3">{formatDate(inv.order_date)}</td>
                              <td className={`p-3 font-bold ${inv.is_overdue ? 'text-danger-400' : 'text-slate-400'}`}>
                                {formatDate(inv.due_date)}
                              </td>
                              <td className="p-3 text-right font-mono">{formatCurrency(Number(inv.subtotal))}</td>
                              <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(Number(inv.paid_amount))}</td>
                              <td className="p-3 text-right font-mono text-rose-400 font-bold">{formatCurrency(Number(inv.remaining))}</td>
                              <td className="p-3 text-center">
                                {inv.is_overdue ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger-950 text-danger-400 border border-danger-700/30 inline-flex items-center gap-1">
                                    <AlertTriangle size={10} /> Overdue
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/30 inline-flex items-center gap-1">
                                    <CheckCircle size={10} /> Lancar
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Setoran Payment Modal (F10) */}
      {showPaymentModal && paymentTargetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <form 
            onSubmit={submitPayment}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in space-y-4"
          >
            <div className="flex justify-between items-center border-b border-surface-700 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign size={20} className="text-emerald-400" />
                <span>Setoran Pembayaran Piutang</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-surface-900 border border-surface-750 rounded-lg text-xs space-y-1">
              <p className="text-slate-400">Invoice: <strong className="text-slate-200">{paymentTargetInvoice.no_faktur || paymentTargetInvoice.no_order}</strong></p>
              <p className="text-slate-400">Total Tagihan: <strong className="text-slate-200">{formatCurrency(paymentTargetInvoice.subtotal)}</strong></p>
              <p className="text-slate-400">Sisa Piutang: <strong className="text-rose-400">{formatCurrency(paymentTargetInvoice.remaining)}</strong></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tanggal Setoran</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="input-field w-full py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nominal Setoran (Rp)</label>
                <input
                  type="text"
                  value={formatRupiahInput(paymentAmount)}
                  onChange={(e) => setPaymentAmount(e.target.value ? parseRupiahInput(e.target.value) : '')}
                  required
                  autoFocus
                  className="input-field w-full py-2 text-xs font-mono text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Metode Setoran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input-field w-full py-2 text-xs"
                >
                  <option value="cash">Tunai / Cash</option>
                  <option value="transfer">Transfer Bank</option>
                  <option value="cheque">Giro / Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Catatan Setoran</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={2}
                  placeholder="Keterangan setoran transfer, no cheque, dll..."
                  className="input-field w-full py-1.5 text-xs resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-surface-700 flex justify-between items-center text-xs">
              <span className="text-slate-400">Tekan <kbd className="shortcut-badge">Esc</kbd> untuk batal</span>
              <button 
                type="submit" 
                className="btn-primary py-2 px-5 text-xs bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                Simpan Setoran
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoice Detail Modal (F4) */}
      {showDetailModal && detailInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-3xl w-full mx-4 shadow-2xl animate-scale-in flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={20} className="text-primary-400" />
                <span>Rincian Nota Penjualan</span>
              </h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-slate-500">Memuat rincian...</div>
              ) : detailInvoice ? (
                <>
                  {/* Meta Board */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-surface-900 border border-surface-750 rounded-xl">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">No Faktur</span>
                      <strong className="text-slate-200 font-mono text-sm">{detailInvoice.no_faktur || detailInvoice.no_order}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Tanggal Order</span>
                      <strong className="text-slate-200">{formatDate(detailInvoice.order_date)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Termin J.Tempo</span>
                      <strong className="text-slate-200">{detailInvoice.limit_bulan > 0 ? `Kredit (${detailInvoice.limit_bulan + 1} Bulan)` : 'Tunai'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Kirim</span>
                      <strong className="text-slate-200">{detailInvoice.diantar ? '🚚 Diantar' : '🚶 Diambil'}</strong>
                    </div>
                  </div>

                  {/* Customer Panel */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 border-b border-surface-750 pb-1 mb-1">Pelanggan</h4>
                      <p className="font-bold text-white">{detailInvoice.customer_nama}</p>
                      <p className="text-slate-400">{detailInvoice.customer_alamat}</p>
                      <p className="text-slate-400">Telp: {detailInvoice.customer_telp || '-'}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 border-b border-surface-750 pb-1 mb-1">Catatan Pengiriman</h4>
                      <p className="italic text-slate-400">"{detailInvoice.sender_note || 'Tidak ada catatan khusus'}"</p>
                    </div>
                  </div>

                  {/* Items List Table */}
                  <div className="border border-surface-700/60 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-850 text-slate-400 font-semibold uppercase text-[9px] border-b border-surface-700">
                          <th className="p-2 w-8 text-center">No</th>
                          <th className="p-2">Kode SKU</th>
                          <th className="p-2">Nama Barang</th>
                          <th className="p-2 text-right w-16">Qty</th>
                          <th className="p-2 text-right w-24">Harga</th>
                          <th className="p-2 text-right w-24">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-750">
                        {detailInvoice.sale_items?.map((item: any, idx: number) => (
                          <tr key={item.id} className="text-slate-350">
                            <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                            <td className="p-2 font-mono">{item.product_kode}</td>
                            <td className="p-2 font-bold text-slate-200">{item.product_nama}</td>
                            <td className="p-2 text-right font-semibold">{Number(item.qty)}</td>
                            <td className="p-2 text-right font-mono">{formatCurrency(Number(item.unit_price))}</td>
                            <td className="p-2 text-right font-mono text-white font-bold">{formatCurrency(Number(item.total))}</td>
                          </tr>
                        ))}
                        {Number(detailInvoice.extra_charge_amount) !== 0 && (
                          <tr className="text-slate-400 font-semibold">
                            <td colSpan={5} className="p-2 text-right uppercase">Adjustment ({detailInvoice.extra_charge_desc})</td>
                            <td className="p-2 text-right font-mono">{formatCurrency(Number(detailInvoice.extra_charge_amount))}</td>
                          </tr>
                        )}
                        <tr className="bg-surface-850 font-bold border-t border-surface-700">
                          <td colSpan={5} className="p-2 text-right uppercase text-[9px]">Grand Total</td>
                          <td className="p-2 text-right font-mono text-emerald-400 font-black text-sm">{formatCurrency(Number(detailInvoice.subtotal))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Payment Logs */}
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 border-b border-surface-750 pb-1 mb-1.5">Riwayat Angsuran Setoran</h4>
                    {detailInvoice.sales_payments && detailInvoice.sales_payments.length > 0 ? (
                      <div className="space-y-1.5">
                        {detailInvoice.sales_payments.map((pay: any) => (
                          <div key={pay.id} className="p-2.5 bg-surface-900 border border-surface-750/50 rounded-lg flex justify-between items-center">
                            <div>
                              <p className="font-bold text-slate-300">Setoran: {formatCurrency(Number(pay.amount))}</p>
                              <p className="text-[10px] text-slate-400">Catatan: {pay.note || '-'}</p>
                            </div>
                            <div className="text-right text-[10px] text-slate-400">
                              <p>{formatDate(pay.payment_date)}</p>
                              <p className="font-mono uppercase text-[9px]">{pay.payment_method}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Belum ada angsuran tercatat untuk nota ini.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-danger-400">Gagal mengambil rincian detail.</div>
              )}
            </div>

            <div className="pt-3 border-t border-surface-700 flex justify-end shrink-0">
              <button 
                type="button" 
                onClick={() => setShowDetailModal(false)}
                className="btn-primary py-2 px-6 text-xs bg-surface-700 hover:bg-surface-650"
              >
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
