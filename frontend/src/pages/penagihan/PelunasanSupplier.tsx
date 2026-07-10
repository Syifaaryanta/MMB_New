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
  ShoppingBag,
  AlertTriangle,
  CheckCircle,
  X,
  Printer,
  Truck
} from 'lucide-react';

interface Supplier {
  id: string;
  kode: string;
  nama: string;
  alamat: string;
  no_telp: string;
  aktif: boolean;
}

interface SupplierGroup {
  supplier: Supplier;
  total_hutang: number;
  purchases: PurchaseDetail[];
}

interface PurchaseDetail {
  id: string;
  no_order: string;
  order_date: string;
  terms: string;
  subtotal: number;
  biaya_pengiriman: string;
  paid_amount: number;
  remaining: number;
}

export const PelunasanSupplier: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<SupplierGroup[]>([]);
  const [filteredData, setFilteredData] = useState<SupplierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded suppliers
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Record<string, boolean>>({});

  // Keyboard navigation
  const [selectedSuppIdx, setSelectedSuppIdx] = useState<number>(0);
  const [selectedPurchaseIdx, setSelectedPurchaseIdx] = useState<number | null>(null);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal payment setoran
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'fifo' | 'manual'>('fifo');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [manualAmounts, setManualAmounts] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  // Modal PO detail (F4)
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailPurchaseId, setDetailPurchaseId] = useState<string | null>(null);
  const [detailPurchase, setDetailPurchase] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Modal print receipt
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptSession, setReceiptSession] = useState<any | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/payments/supplier/debt?q=${searchQuery}`);
      setData(res.data);
      setFilteredData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery]);

  // Reset selection
  useEffect(() => {
    setSelectedSuppIdx(0);
    setSelectedPurchaseIdx(null);
  }, [filteredData]);

  // Shortcuts
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  useHotkeys('f4', (e) => {
    e.preventDefault();
    openDetailModal();
  }, { enableOnFormTags: false });

  useHotkeys('f10', (e) => {
    e.preventDefault();
    openPaymentModal();
  }, { enableOnFormTags: false });

  useHotkeys('up', (e) => {
    e.preventDefault();
    if (filteredData.length === 0) return;

    if (selectedPurchaseIdx !== null && selectedPurchaseIdx > 0) {
      setSelectedPurchaseIdx(selectedPurchaseIdx - 1);
    } else if (selectedPurchaseIdx === 0) {
      setSelectedPurchaseIdx(null);
    } else if (selectedSuppIdx > 0) {
      const prevIdx = selectedSuppIdx - 1;
      setSelectedSuppIdx(prevIdx);
      const prevSupp = filteredData[prevIdx];
      if (expandedSupplierIds[prevSupp.supplier.id] && prevSupp.purchases.length > 0) {
        setSelectedPurchaseIdx(prevSupp.purchases.length - 1);
      } else {
        setSelectedPurchaseIdx(null);
      }
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (filteredData.length === 0) return;

    const currentSupp = filteredData[selectedSuppIdx];
    const isExpanded = expandedSupplierIds[currentSupp.supplier.id];

    if (isExpanded && (selectedPurchaseIdx === null || selectedPurchaseIdx < currentSupp.purchases.length - 1)) {
      setSelectedPurchaseIdx(selectedPurchaseIdx === null ? 0 : selectedPurchaseIdx + 1);
    } else if (selectedSuppIdx < filteredData.length - 1) {
      setSelectedSuppIdx(selectedSuppIdx + 1);
      setSelectedPurchaseIdx(null);
    }
  }, { enableOnFormTags: false });

  useHotkeys('enter', (e) => {
    if (showPaymentModal || showDetailModal || showReceiptModal) return;
    e.preventDefault();
    if (filteredData.length === 0) return;
    const suppId = filteredData[selectedSuppIdx].supplier.id;
    setExpandedSupplierIds((prev) => ({
      ...prev,
      [suppId]: !prev[suppId],
    }));
  }, { enableOnFormTags: false });

  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showPaymentModal) {
      setShowPaymentModal(false);
    } else if (showDetailModal) {
      setShowDetailModal(false);
    } else if (showReceiptModal) {
      setShowReceiptModal(false);
    } else if (searchQuery) {
      setSearchQuery('');
    } else {
      navigate('/penagihan');
    }
  }, { enableOnFormTags: true });

  const openDetailModal = async () => {
    if (selectedSuppIdx === null || selectedPurchaseIdx === null) return;
    const group = filteredData[selectedSuppIdx];
    const pur = group.purchases[selectedPurchaseIdx];
    if (!pur) return;

    setDetailPurchaseId(pur.id);
    setShowDetailModal(true);
    setIsLoadingDetail(true);

    try {
      const res = await api.get(`/purchases/${pur.id}`);
      setDetailPurchase(res.data);
    } catch (err) {
      console.error(err);
      alert('Gagal mengambil detail PO');
      setShowDetailModal(false);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openPaymentModal = () => {
    if (selectedSuppIdx === null) return;
    const group = filteredData[selectedSuppIdx];
    if (!group) return;

    setPaymentMode('fifo');
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNote('');
    setPaymentDate(new Date().toISOString().slice(0, 10));

    const initialManual: Record<string, number> = {};
    group.purchases.forEach(pur => {
      initialManual[pur.id] = 0;
    });
    setManualAmounts(initialManual);

    setShowPaymentModal(true);
  };

  const handleUpdateOngkir = async (purchaseId: string, amount: number) => {
    try {
      await api.patch(`/purchases/${purchaseId}/ongkir`, { biaya_pengiriman: amount });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Gagal mengupdate ongkir');
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const group = filteredData[selectedSuppIdx];
    if (!group) return;

    let payload: any = {
      supplier_id: group.supplier.id,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      mode: paymentMode,
      catatan: paymentNote,
    };

    if (paymentMode === 'fifo') {
      if (!paymentAmount || Number(paymentAmount) <= 0) {
        alert('Silakan masukkan nominal setoran yang valid.');
        return;
      }
      payload.total_amount = Number(paymentAmount);
    } else {
      const activeAllocations = Object.entries(manualAmounts)
        .filter(([_, amount]) => amount > 0)
        .map(([purchase_id, amount]) => ({ purchase_id, amount }));

      if (activeAllocations.length === 0) {
        alert('Silakan isi nominal pembayaran minimal untuk satu nota PO.');
        return;
      }
      payload.allocations = activeAllocations;
      payload.total_amount = activeAllocations.reduce((sum, a) => sum + a.amount, 0);
    }

    try {
      const res = await api.post('/payments/supplier/session', payload);
      setShowPaymentModal(false);
      fetchData();

      // Load session for receipt
      const sessionDetail = await api.get(`/payments/sessions/${res.data.billingSession.id}`);
      setReceiptSession(sessionDetail.data);
      setShowReceiptModal(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menyimpan pembayaran ke supplier');
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

  const getFifoAllocations = () => {
    const group = filteredData[selectedSuppIdx];
    if (!group || paymentMode !== 'fifo' || !paymentAmount) return [];

    let remainingUang = Number(paymentAmount);
    return group.purchases.map((pur) => {
      const sisa = pur.remaining;
      const allocated = Math.min(remainingUang, sisa);
      remainingUang -= allocated;

      return {
        id: pur.id,
        no_order: pur.no_order,
        remaining: sisa,
        allocated,
        remainingAfter: sisa - allocated,
      };
    });
  };

  const fifoAllocations = getFifoAllocations();
  const manualTotal = Object.values(manualAmounts).reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Pelunasan Hutang Supplier (AP)</h1>
          <p className="text-slate-400 text-sm">Kelola pembayaran hutang PO ke supplier, input ongkir pengiriman, dan catat angsuran pembayaran.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button 
            onClick={openPaymentModal} 
            disabled={filteredData.length === 0}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <DollarSign size={14} />
            <span>Bayar PO Multi-Nota (F10)</span>
          </button>
          <button 
            onClick={openDetailModal} 
            disabled={selectedPurchaseIdx === null}
            className="card bg-surface-800 hover:bg-surface-750 px-3 py-2 text-slate-300 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText size={14} />
            <span>Detail PO (F4)</span>
          </button>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Supplier (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Hints */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-400 space-y-1 col-span-2">
          <p>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih supplier/PO.</p>
          <p>Tekan <kbd className="shortcut-badge">Enter</kbd> untuk expand/collapse daftar PO.</p>
        </div>
      </div>

      {/* Supplier List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 italic text-xs border border-surface-700">
          Tidak ada hutang aktif ke supplier yang ditemukan.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map((group, sIdx) => {
            const supp = group.supplier;
            const isExpanded = !!expandedSupplierIds[supp.id];
            const isSelected = selectedSuppIdx === sIdx && selectedPurchaseIdx === null;

            return (
              <div 
                key={supp.id} 
                className={`card p-0 overflow-hidden border transition-all ${
                  isSelected ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-surface-700/60'
                }`}
              >
                {/* Header Row */}
                <div 
                  onClick={() => {
                    setSelectedSuppIdx(sIdx);
                    setSelectedPurchaseIdx(null);
                    setExpandedSupplierIds(prev => ({ ...prev, [supp.id]: !prev[supp.id] }));
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
                        {supp.nama}
                        <span className="font-mono text-[10px] text-slate-400 bg-surface-900 px-1.5 py-0.5 rounded">{supp.kode}</span>
                      </h3>
                      <p className="text-slate-400 text-xs mt-0.5 truncate max-w-md">{supp.alamat || '-'}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Total Hutang PO</span>
                    <span className="text-sm font-black text-emerald-400 currency">{formatCurrency(group.total_hutang)}</span>
                  </div>
                </div>

                {/* Purchases Table */}
                {isExpanded && (
                  <div className="border-t border-surface-700/60 bg-surface-900/30 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-surface-800/30 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-surface-750">
                          <th className="p-3 w-8 text-center">No</th>
                          <th className="p-3">No. PO</th>
                          <th className="p-3">Tgl Order</th>
                          <th className="p-3">Subtotal Barang</th>
                          <th className="p-3 text-center w-36">Ongkir PO</th>
                          <th className="p-3 text-right">Total Tagihan</th>
                          <th className="p-3 text-right">Terbayar</th>
                          <th className="p-3 text-right">Sisa Hutang</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-750">
                        {group.purchases.map((pur, pIdx) => {
                          const isPurSelected = selectedSuppIdx === sIdx && selectedPurchaseIdx === pIdx;
                          const grandTotal = Number(pur.subtotal) + Number(pur.biaya_pengiriman);

                          return (
                            <tr
                              key={pur.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSuppIdx(sIdx);
                                setSelectedPurchaseIdx(pIdx);
                              }}
                              className={`hover:bg-surface-750/30 cursor-pointer ${
                                isPurSelected ? 'bg-primary-950/20 text-white font-semibold' : 'text-slate-300'
                              }`}
                            >
                              <td className="p-3 text-center text-slate-500">{pIdx + 1}</td>
                              <td className="p-3 font-mono font-bold text-slate-200">{pur.no_order}</td>
                              <td className="p-3">{formatDate(pur.order_date)}</td>
                              <td className="p-3 text-right font-mono">{formatCurrency(Number(pur.subtotal))}</td>
                              <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <Truck size={12} className="text-slate-400" />
                                  <input
                                    type="text"
                                    defaultValue={formatRupiahInput(Number(pur.biaya_pengiriman))}
                                    onBlur={(e) => {
                                      const val = parseRupiahInput(e.target.value);
                                      handleUpdateOngkir(pur.id, val);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = parseRupiahInput((e.target as HTMLInputElement).value);
                                        handleUpdateOngkir(pur.id, val);
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="input-field py-1 px-2 text-right text-xs font-mono w-24 bg-surface-900 border-surface-700/60"
                                  />
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-white font-bold">{formatCurrency(grandTotal)}</td>
                              <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(Number(pur.paid_amount))}</td>
                              <td className="p-3 text-right font-mono text-rose-400 font-bold">{formatCurrency(Number(pur.remaining))}</td>
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

      {/* Setoran Payment Modal */}
      {showPaymentModal && filteredData[selectedSuppIdx] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <form 
            onSubmit={submitPayment}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl animate-scale-in space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign size={20} className="text-emerald-400" />
                <span>Pencatatan Pembayaran Multi-PO Supplier</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-surface-900 border border-surface-750 rounded-lg text-xs space-y-1 shrink-0">
              <p className="text-slate-400">Supplier: <strong className="text-slate-200">{filteredData[selectedSuppIdx].supplier.nama}</strong></p>
              <p className="text-slate-400">Total Hutang PO: <strong className="text-emerald-400">{formatCurrency(filteredData[selectedSuppIdx].total_hutang)}</strong></p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-1">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Mode Pembayaran</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('fifo')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      paymentMode === 'fifo'
                        ? 'bg-primary-600/10 border-primary-500 text-primary-400'
                        : 'bg-surface-900 border-surface-750 text-slate-400'
                    }`}
                  >
                    FIFO Otomatis (PO Terlama)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('manual')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      paymentMode === 'manual'
                        ? 'bg-primary-600/10 border-primary-500 text-primary-400'
                        : 'bg-surface-900 border-surface-750 text-slate-400'
                    }`}
                  >
                    Pilihan Manual Per PO
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tanggal Pembayaran</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="input-field w-full py-2 text-xs bg-surface-900 border-surface-750"
                />
              </div>

              {paymentMode === 'fifo' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nominal Pembayaran (Rp)</label>
                    <input
                      type="text"
                      value={formatRupiahInput(paymentAmount)}
                      onChange={(e) => setPaymentAmount(e.target.value ? parseRupiahInput(e.target.value) : '')}
                      required
                      autoFocus
                      className="input-field w-full py-2 text-xs font-mono text-right bg-surface-900 border-surface-750 text-emerald-400 font-bold"
                    />
                  </div>

                  {Number(paymentAmount) > 0 && (
                    <div className="border border-surface-700/60 rounded-lg overflow-hidden bg-surface-900/40 p-3 space-y-2">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Preview Alokasi Pembayaran (FIFO)</h4>
                      <div className="space-y-1.5 max-h-[150px] overflow-y-auto text-[11px]">
                        {fifoAllocations.map((alloc) => (
                          <div key={alloc.id} className="flex justify-between items-center py-1 border-b border-surface-800 last:border-0">
                            <span className="font-mono text-slate-300">{alloc.no_order}</span>
                            <span className="text-slate-400">
                              Hutang: {formatCurrency(alloc.remaining)} →
                              <strong className="text-emerald-400 ml-1">Bayar: {formatCurrency(alloc.allocated)}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Input Pembayaran Per PO</label>
                  <div className="border border-surface-700/60 rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-850 sticky top-0 border-b border-surface-700">
                        <tr className="text-slate-400 text-[10px] font-bold uppercase">
                          <th className="p-2">No. PO</th>
                          <th className="p-2 text-right">Sisa Hutang</th>
                          <th className="p-2 text-center w-36">Bayar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-750">
                        {filteredData[selectedSuppIdx].purchases.map((pur) => (
                          <tr key={pur.id}>
                            <td className="p-2 font-mono">{pur.no_order}</td>
                            <td className="p-2 text-right font-mono text-rose-400">{formatCurrency(pur.remaining)}</td>
                            <td className="p-1.5 text-center">
                              <input
                                type="text"
                                value={formatRupiahInput(manualAmounts[pur.id] || 0)}
                                onChange={(e) => {
                                  const val = parseRupiahInput(e.target.value);
                                  setManualAmounts(prev => ({
                                    ...prev,
                                    [pur.id]: val,
                                  }));
                                }}
                                className="input-field py-1 px-2 text-right text-xs font-mono w-28 bg-surface-900 border-surface-750 text-emerald-400 font-semibold"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center text-xs p-2 bg-surface-900 border border-surface-750 rounded-lg">
                    <span className="text-slate-400 uppercase font-bold text-[10px]">Total Bayar Manual</span>
                    <strong className="text-emerald-400 text-sm font-black">{formatCurrency(manualTotal)}</strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Metode Setoran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input-field w-full py-2 text-xs bg-surface-900 border-surface-750 text-white"
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
                  placeholder="Keterangan setoran..."
                  className="input-field w-full py-1.5 text-xs bg-surface-900 border-surface-750 text-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-surface-700 flex justify-between items-center text-xs shrink-0">
              <span className="text-slate-400">Tekan <kbd className="shortcut-badge">Esc</kbd> untuk batal</span>
              <button 
                type="submit" 
                className="btn-primary py-2 px-5 text-xs bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                Simpan Pelunasan (Cetak Struk)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PO Detail Modal (F4) */}
      {showDetailModal && detailPurchaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-3xl w-full mx-4 shadow-2xl animate-scale-in flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={20} className="text-primary-400" />
                <span>Rincian Purchase Order (PO)</span>
              </h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-slate-500">Memuat rincian...</div>
              ) : detailPurchase ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-surface-900 border border-surface-750 rounded-xl">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">No PO</span>
                      <strong className="text-slate-200 font-mono text-sm">{detailPurchase.no_order}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Tanggal PO</span>
                      <strong className="text-slate-200">{formatDate(detailPurchase.order_date)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Termin</span>
                      <strong className="text-slate-200 uppercase">{detailPurchase.terms}</strong>
                    </div>
                  </div>

                  <div className="border border-surface-700/60 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-850 text-slate-400 font-semibold uppercase text-[9px] border-b border-surface-700">
                          <th className="p-2 w-8 text-center">No</th>
                          <th className="p-2">Barang</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Harga Beli</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-750">
                        {detailPurchase.purchase_items?.map((item: any, idx: number) => (
                          <tr key={item.id} className="text-slate-350">
                            <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                            <td className="p-2 font-bold text-slate-200">{item.product?.nama || 'Barang'}</td>
                            <td className="p-2 text-right font-semibold">{Number(item.qty)}</td>
                            <td className="p-2 text-right font-mono">{formatCurrency(Number(item.harga_beli))}</td>
                            <td className="p-2 text-right font-mono text-white font-bold">{formatCurrency(Number(item.subtotal))}</td>
                          </tr>
                        ))}
                        {Number(detailPurchase.biaya_pengiriman) !== 0 && (
                          <tr className="text-slate-400 font-semibold border-t border-surface-750/30">
                            <td colSpan={4} className="p-2 text-right uppercase">Biaya Pengiriman (Ongkir)</td>
                            <td className="p-2 text-right font-mono">{formatCurrency(Number(detailPurchase.biaya_pengiriman))}</td>
                          </tr>
                        )}
                        <tr className="bg-surface-850 font-bold border-t border-surface-700">
                          <td colSpan={4} className="p-2 text-right uppercase text-[9px]">Grand Total</td>
                          <td className="p-2 text-right font-mono text-emerald-400 font-black text-sm">{formatCurrency(Number(detailPurchase.subtotal) + Number(detailPurchase.biaya_pengiriman))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 border-b border-surface-750 pb-1 mb-1.5">Riwayat Pembayaran PO</h4>
                    {detailPurchase.supplier_payments && detailPurchase.supplier_payments.length > 0 ? (
                      <div className="space-y-1.5">
                        {detailPurchase.supplier_payments.map((pay: any) => (
                          <div key={pay.id} className="p-2.5 bg-surface-900 border border-surface-750/50 rounded-lg flex justify-between items-center">
                            <div>
                              <p className="font-bold text-slate-300">Bayar: {formatCurrency(Number(pay.amount))}</p>
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
                      <p className="text-xs text-slate-500 italic">Belum ada pembayaran tercatat untuk PO ini.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-danger-400">Gagal mengambil detail.</div>
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

      {/* Struk Cetak Pembayaran AP Receipt Modal */}
      {showReceiptModal && receiptSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 shrink-0 print:hidden">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Printer size={20} className="text-primary-400" />
                <span>Bukti Pengeluaran Kas (Pelunasan Supplier)</span>
              </h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 space-y-6 text-xs bg-white text-slate-900 p-8 rounded-lg mt-4 font-mono shadow-inner print:mt-0 print:p-0" id="print-receipt-area">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-extrabold tracking-wider uppercase text-slate-950">CV MAJU MULIA BERSAMA</h2>
                <p className="text-xs text-slate-600">Suku Cadang & Sparepart AC Mobil Terlengkap</p>
                <p className="text-[10px] text-slate-500 border-b border-slate-300 pb-2">Bukti Pembayaran Hutang Dagang (AP)</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <p><strong>Supplier:</strong> {receiptSession.allocations[0]?.purchase?.supplier?.nama || receiptSession.target_nama}</p>
                  <p><strong>Alamat:</strong> {receiptSession.allocations[0]?.purchase?.supplier?.alamat || '-'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p><strong>Tanggal Bayar:</strong> {formatDate(receiptSession.session_date)}</p>
                  <p><strong>Metode Pembayaran:</strong> <span className="uppercase">{receiptSession.payment_method}</span></p>
                  <p><strong>Admin:</strong> {receiptSession.creator?.nama || '-'}</p>
                </div>
              </div>

              <div className="border-t border-b border-slate-300 py-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-2 w-8 text-center">No</th>
                      <th className="py-2">No. PO</th>
                      <th className="py-2">Tgl PO</th>
                      <th className="py-2 text-right">Total PO</th>
                      <th className="py-2 text-right">Dibayar</th>
                      <th className="py-2 text-right">Sisa Hutang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receiptSession.allocations.map((alloc: any, idx: number) => {
                      const grandTotal = Number(alloc.purchase.subtotal) + Number(alloc.purchase.biaya_pengiriman);
                      return (
                        <tr key={alloc.id}>
                          <td className="py-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2 font-mono font-bold text-slate-900">{alloc.purchase.no_order}</td>
                          <td className="py-2 text-slate-600">{formatDate(alloc.purchase.order_date)}</td>
                          <td className="py-2 text-right font-mono">{formatCurrency(grandTotal)}</td>
                          <td className="py-2 text-right font-mono text-emerald-700 font-bold">-{formatCurrency(Number(alloc.allocated_amount))}</td>
                          <td className="py-2 text-right font-mono text-rose-600">{formatCurrency(Number(alloc.remaining_after))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-end space-y-1.5">
                <div className="flex justify-between w-64 text-xs">
                  <span className="text-slate-600">Total Dibayar:</span>
                  <strong className="text-emerald-700 font-black">{formatCurrency(Number(receiptSession.total_amount))}</strong>
                </div>
                <div className="flex justify-between w-64 text-[10px] text-slate-500 border-t border-slate-200 pt-1.5">
                  <span>Catatan:</span>
                  <span className="italic">{receiptSession.catatan || '-'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div>
                  <p className="text-slate-500">Pihak Pertama (Admin MMB)</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-t border-slate-300 pt-1 inline-block px-4">({receiptSession.creator?.nama || 'Budi Santoso'})</p>
                </div>
                <div>
                  <p className="text-slate-500">Pihak Kedua (Supplier)</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-t border-slate-300 pt-1 inline-block px-4">({receiptSession.allocations[0]?.purchase?.supplier?.nama || 'Supplier'})</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-700 flex justify-end gap-2 shrink-0 print:hidden">
              <button onClick={() => setShowReceiptModal(false)} className="btn-secondary text-xs px-4">
                Tutup (Esc)
              </button>
              <button 
                onClick={() => window.print()}
                className="btn-primary flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 px-5 font-bold"
              >
                <Printer size={14} />
                <span>Cetak Struk (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS media print block */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-receipt-area, #print-receipt-area * {
            visibility: visible;
          }
          #print-receipt-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none;
            background-color: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
};
