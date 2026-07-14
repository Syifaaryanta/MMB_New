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
  Printer,
  Save,
  Truck
} from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
  alamat: string;
  no_telp: string;
  limit_kredit: string;
  saldo_piutang: string;
}

interface CustomerGroup {
  customer: Customer;
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
  biaya_pengiriman: string; // Decimal from database
  extra_charge_amount?: string | number;
  extra_charge_desc?: string | null;
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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilterOptionIdx, setSelectedFilterOptionIdx] = useState<number>(0);
  const filterModalRef = useRef<HTMLDivElement>(null);

  // Expanded customers
  const [expandedCustIds, setExpandedCustIds] = useState<Record<string, boolean>>({});

  // Keyboard navigation
  const [selectedCustIdx, setSelectedCustIdx] = useState<number>(0);
  const [selectedInvoiceIdx, setSelectedInvoiceIdx] = useState<number | null>(null);

  // Refs for focusing
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paymentModeFifoRef = useRef<HTMLButtonElement>(null);
  const paymentModeManualRef = useRef<HTMLButtonElement>(null);
  const paymentDateRef = useRef<HTMLInputElement>(null);
  const paymentAmountRef = useRef<HTMLInputElement>(null);
  const paymentMethodCashRef = useRef<HTMLButtonElement>(null);
  const paymentMethodTransferRef = useRef<HTMLButtonElement>(null);
  const paymentNoteRef = useRef<HTMLTextAreaElement>(null);
  const syncNotaYaRef = useRef<HTMLButtonElement>(null);
  const syncNotaTidakRef = useRef<HTMLButtonElement>(null);

  // Modal payment setoran (global / multi-nota)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'fifo' | 'manual'>('fifo');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [manualAmounts, setManualAmounts] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [syncNotaOtomatis, setSyncNotaOtomatis] = useState(true);

  // Modal invoice detail (F4)
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Modal print receipt
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptSession, setReceiptSession] = useState<any | null>(null);

  // Modal print billing
  const [showBillingPrintModal, setShowBillingPrintModal] = useState(false);
  const [printBillingGroup, setPrintBillingGroup] = useState<CustomerGroup | null>(null);

  // Customer search selection popup modal
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [popupFocusedIndex, setPopupFocusedIndex] = useState(0);
  const searchPopupRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

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
    if (!searchQuery.trim()) {
      setData([]);
      return;
    }
    fetchData();
  }, [searchQuery]);

  // Focus filter modal when opened
  useEffect(() => {
    if (showFilterModal) {
      setTimeout(() => {
        filterModalRef.current?.focus();
      }, 50);
    }
  }, [showFilterModal]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Focus search popup when opened
  useEffect(() => {
    if (showSearchPopup) {
      setTimeout(() => {
        searchPopupRef.current?.focus();
      }, 50);
    }
  }, [showSearchPopup]);

  // Focus FIFO mode button when payment modal opened
  useEffect(() => {
    if (showPaymentModal) {
      setTimeout(() => {
        paymentModeFifoRef.current?.focus();
      }, 50);
    }
  }, [showPaymentModal]);

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

  // F3: Toggle Status Filter Popup
  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (showFilterModal) {
      setShowFilterModal(false);
    } else {
      setSelectedFilterOptionIdx(['all', 'overdue', 'lancar'].indexOf(statusFilter));
      setShowFilterModal(true);
    }
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
    if (showFilterModal) {
      setSelectedFilterOptionIdx((curr) => (curr > 0 ? curr - 1 : 2));
      return;
    }
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
  }, { enableOnFormTags: false }, [showFilterModal, filteredData, selectedInvoiceIdx, selectedCustIdx, expandedCustIds]);

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (showFilterModal) {
      setSelectedFilterOptionIdx((curr) => (curr < 2 ? curr + 1 : 0));
      return;
    }
    if (filteredData.length === 0) return;

    const currentCust = filteredData[selectedCustIdx];
    const isExpanded = expandedCustIds[currentCust.customer.id];

    if (isExpanded && (selectedInvoiceIdx === null || selectedInvoiceIdx < currentCust.invoices.length - 1)) {
      setSelectedInvoiceIdx(selectedInvoiceIdx === null ? 0 : selectedInvoiceIdx + 1);
    } else if (selectedCustIdx < filteredData.length - 1) {
      setSelectedCustIdx(selectedCustIdx + 1);
      setSelectedInvoiceIdx(null);
    }
  }, { enableOnFormTags: false }, [showFilterModal, filteredData, selectedCustIdx, expandedCustIds, selectedInvoiceIdx]);

  // Enter: Expand/Collapse or Confirm Filter selection or Focus input field
  useHotkeys('enter', (e) => {
    if (showFilterModal) {
      e.preventDefault();
      const options: ('all' | 'overdue' | 'lancar')[] = ['all', 'overdue', 'lancar'];
      setStatusFilter(options[selectedFilterOptionIdx]);
      setShowFilterModal(false);
      return;
    }
    if (showSearchPopup) return;
    if (showPaymentModal || showDetailModal || showReceiptModal || showBillingPrintModal) return;

    if (selectedInvoiceIdx !== null) {
      e.preventDefault();
      const customerGroup = filteredData[selectedCustIdx];
      if (customerGroup && customerGroup.invoices[selectedInvoiceIdx]) {
        const selectedInv = customerGroup.invoices[selectedInvoiceIdx];
        const inputEl = document.getElementById(`input-pengiriman-${selectedInv.id}`) as HTMLInputElement;
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }
      }
      return;
    }

    e.preventDefault();
    if (filteredData.length === 0) return;
    const custId = filteredData[selectedCustIdx].customer.id;
    setExpandedCustIds((prev) => ({
      ...prev,
      [custId]: true,
    }));

    const customerGroup = filteredData[selectedCustIdx];
    if (customerGroup && customerGroup.invoices.length > 0) {
      setSelectedInvoiceIdx(0);
    }
  }, { enableOnFormTags: false }, [showFilterModal, selectedFilterOptionIdx, showSearchPopup, showPaymentModal, showDetailModal, showReceiptModal, showBillingPrintModal, selectedInvoiceIdx, selectedCustIdx, filteredData, expandedCustIds]);

  // Escape: Reset search / return
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showSearchPopup) {
      setShowSearchPopup(false);
      searchInputRef.current?.focus();
    } else if (showFilterModal) {
      setShowFilterModal(false);
    } else if (showBillingPrintModal) {
      setShowBillingPrintModal(false);
    } else if (showPaymentModal) {
      setShowPaymentModal(false);
    } else if (showDetailModal) {
      setShowDetailModal(false);
    } else if (showReceiptModal) {
      setShowReceiptModal(false);
    } else if (filteredData.length > 0 && expandedCustIds[filteredData[selectedCustIdx].customer.id]) {
      const custId = filteredData[selectedCustIdx].customer.id;
      setExpandedCustIds(prev => ({ ...prev, [custId]: false }));
      setSelectedInvoiceIdx(null);
    } else if (searchQuery) {
      setSearchQuery('');
      setIsConfirmed(false);
    } else {
      navigate('/penagihan');
    }
  }, { enableOnFormTags: true }, [showSearchPopup, showFilterModal, showBillingPrintModal, showPaymentModal, showDetailModal, showReceiptModal, searchQuery, filteredData, selectedCustIdx, expandedCustIds]);

  // P key: Print receipt when receipt modal is active
  useHotkeys('p', (e) => {
    if (showReceiptModal) {
      e.preventDefault();
      printReceipt();
    }
  }, { enableOnFormTags: true });

  const handleSearchPopupKeyDown = (e: React.KeyboardEvent) => {
    if (filteredData.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPopupFocusedIndex((prev) => (prev + 1) % filteredData.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPopupFocusedIndex((prev) => (prev - 1 + filteredData.length) % filteredData.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setSelectedCustIdx(popupFocusedIndex);
      setSelectedInvoiceIdx(null);
      setExpandedCustIds({});
      setShowSearchPopup(false);
      setIsConfirmed(true);
      setTimeout(() => {
        document.body.focus();
      }, 50);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSearchPopup(false);
      searchInputRef.current?.focus();
    }
  };

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
      showToast('Gagal mengambil detail invoice', 'error');
      setShowDetailModal(false);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openPaymentModal = () => {
    if (selectedCustIdx === null) return;
    const customerGroup = filteredData[selectedCustIdx];
    if (!customerGroup) return;

    // Reset payment values
    setPaymentMode('fifo');
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNote('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setSyncNotaOtomatis(true);

    const initialManual: Record<string, number> = {};
    customerGroup.invoices.forEach(inv => {
      initialManual[inv.id] = 0;
    });
    setManualAmounts(initialManual);

    setShowPaymentModal(true);
  };

  // Inline update for Travel/Bus Delivery Costs
  const handleUpdateOngkir = async (saleId: string, amount: number) => {
    try {
      await api.patch(`/sales/${saleId}/ongkir`, { biaya_pengiriman: amount });
      fetchData(); // reload values
    } catch (err) {
      console.error(err);
      showToast('Gagal mengupdate ongkir', 'error');
    }
  };

  const savePayment = async (shouldPrint: boolean) => {
    const customerGroup = filteredData[selectedCustIdx];
    if (!customerGroup) return;

    let payload: any = {
      customer_id: customerGroup.customer.id,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      mode: paymentMode,
      catatan: paymentNote,
      sync_nota_otomatis: syncNotaOtomatis,
    };

    if (paymentMode === 'fifo') {
      if (!paymentAmount || Number(paymentAmount) <= 0) {
        showToast('Silakan masukkan nominal setoran yang valid.', 'error');
        return;
      }
      payload.total_amount = Number(paymentAmount);
    } else {
      const activeAllocations = Object.entries(manualAmounts)
        .filter(([_, amount]) => amount > 0)
        .map(([sale_id, amount]) => ({ sale_id, amount }));

      if (activeAllocations.length === 0) {
        showToast('Silakan isi nominal pembayaran minimal untuk satu nota.', 'error');
        return;
      }
      payload.allocations = activeAllocations;
      payload.total_amount = activeAllocations.reduce((sum, a) => sum + a.amount, 0);
    }

    try {
      const res = await api.post('/payments/session', payload);
      setShowPaymentModal(false);
      fetchData(); // reload list

      if (shouldPrint) {
        // Load session details for printing receipt
        const sessionDetail = await api.get(`/payments/sessions/${res.data.billingSession.id}`);
        setReceiptSession(sessionDetail.data);
        setShowReceiptModal(true);
      } else {
        showToast('Setoran berhasil disimpan.', 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Gagal menyimpan setoran penagihan', 'error');
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePayment(true);
  };

  const printReceipt = () => {
    window.print();
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

  // Calculated variables for FIFO preview
  const getFifoAllocations = () => {
    const customerGroup = filteredData[selectedCustIdx];
    if (!customerGroup || paymentMode !== 'fifo' || !paymentAmount) return [];

    let remainingUang = Number(paymentAmount);
    return customerGroup.invoices.map((inv) => {
      const sisa = inv.remaining;
      const allocated = Math.min(remainingUang, sisa);
      remainingUang -= allocated;

      return {
        id: inv.id,
        no_order: inv.no_order,
        no_faktur: inv.no_faktur,
        remaining: sisa,
        allocated,
        remainingAfter: sisa - allocated,
      };
    });
  };

  const fifoAllocations = getFifoAllocations();
  const manualTotal = Object.values(manualAmounts).reduce((sum, v) => sum + v, 0);

  if (showDetailModal && detailInvoiceId) {
    return (
      <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50 text-slate-800 p-6 rounded-2xl border border-blue-100 shadow-xl space-y-4 animate-scale-in">
        {/* Header Board */}
        <div className="bg-blue-600 -mx-6 -mt-6 p-4 px-6 flex justify-between items-center text-white rounded-t-2xl shrink-0">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <FileText size={18} />
            <span>Rincian Nota Penjualan</span>
          </h3>
          <button
            onClick={() => setShowDetailModal(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white border border-blue-500 rounded-lg shadow-sm cursor-pointer transition-all duration-200"
          >
            ← Kembali (Esc)
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[82vh] pr-1">
          {isLoadingDetail ? (
            <div className="py-24 text-center text-blue-500 font-bold animate-pulse text-sm">Memuat rincian nota...</div>
          ) : detailInvoice ? (
            <>
              {/* Ultra-Compact Metadata Row */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-3 bg-white border border-blue-100 rounded-xl shadow-sm text-xs shrink-0">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">No Faktur</span>
                  <strong className="text-slate-900 font-mono text-[11px]">{detailInvoice.no_faktur || detailInvoice.no_order}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Tanggal Order</span>
                  <strong className="text-slate-800 text-[11px]">{formatDate(detailInvoice.order_date)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Termin</span>
                  <strong className="text-slate-800 text-[11px]">{detailInvoice.limit_bulan > 0 ? `Kredit (${detailInvoice.limit_bulan} Bln)` : 'Tunai'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Pengiriman</span>
                  <strong className="text-blue-700 text-[11px]">{detailInvoice.diantar ? ' Diantar' : ' Diambil'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Pelanggan</span>
                  <strong className="text-slate-900 text-[11px] block truncate" title={`${detailInvoice.customer_nama} (${detailInvoice.customer_telp || '-'})`}>
                    {detailInvoice.customer_nama}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Catatan</span>
                  <span className="text-slate-600 text-[11px] block truncate" title={detailInvoice.sender_note || 'Tidak ada catatan'}>
                    {detailInvoice.sender_note || '-'}
                  </span>
                </div>
              </div>

              {/* Items List Table - Low Padding */}
              <div className="border border-blue-100 rounded-xl overflow-hidden bg-white shadow-sm shrink-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-blue-50 text-blue-900 font-bold uppercase text-[9px] border-b border-blue-100">
                      <th className="py-2 px-3 w-10 text-center">No</th>
                      <th className="py-2 px-3">Kode SKU</th>
                      <th className="py-2 px-3">Nama Barang</th>
                      <th className="py-2 px-3 text-right w-20">Qty</th>
                      <th className="py-2 px-3 text-right w-28">Harga</th>
                      <th className="py-2 px-3 text-right w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {detailInvoice.sale_items?.map((item: any, idx: number) => (
                      <tr key={item.id} className="text-slate-700 hover:bg-blue-50/10">
                        <td className="py-1.5 px-3 text-center text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-500">{item.product_kode}</td>
                        <td className="py-1.5 px-3 font-extrabold text-slate-900">{item.product_nama}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-800">{Number(item.qty)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-650">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-blue-900 font-black">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                    {Number(detailInvoice.extra_charge_amount) !== 0 && (
                      <tr className="text-slate-600 font-semibold bg-slate-50/50">
                        <td colSpan={5} className="py-1.5 px-3 text-right uppercase text-[10px]">Biaya Tambahan ({detailInvoice.extra_charge_desc || 'Gojek/Grab'})</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-800 font-bold">{formatCurrency(Number(detailInvoice.extra_charge_amount))}</td>
                      </tr>
                    )}
                    {Number(detailInvoice.biaya_pengiriman) !== 0 && (
                      <tr className="text-slate-600 font-semibold bg-slate-50/50">
                        <td colSpan={5} className="py-1.5 px-3 text-right uppercase text-[10px]">Pengiriman</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-800 font-bold">{formatCurrency(Number(detailInvoice.biaya_pengiriman))}</td>
                      </tr>
                    )}
                    <tr className="bg-blue-50/40 font-black border-t border-blue-100">
                      <td colSpan={5} className="py-2 px-3 text-right uppercase text-[10px] text-blue-900">Grand Total</td>
                      <td className="py-2 px-3 text-right font-mono text-blue-950 font-black text-xs">{formatCurrency(Number(detailInvoice.subtotal) + Number(detailInvoice.biaya_pengiriman))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Logs - Compact */}
              <div className="p-3 bg-white border border-blue-100 rounded-xl shadow-sm space-y-2 shrink-0">
                <h4 className="text-[10px] uppercase font-black text-slate-500 border-b border-slate-100 pb-1 mb-1">Riwayat Angsuran Setoran</h4>
                {detailInvoice.sales_payments && detailInvoice.sales_payments.length > 0 ? (
                  <div className="space-y-1.5">
                    {detailInvoice.sales_payments.map((pay: any) => (
                      <div key={pay.id} className="py-1.5 px-3 bg-blue-50/20 hover:bg-blue-50/40 border border-blue-100/30 rounded-lg flex justify-between items-center transition-all text-[11px]">
                        <div>
                          <p className="font-extrabold text-blue-950">Setoran: {formatCurrency(Number(pay.amount))}</p>
                          <p className="text-[10px] text-slate-500">Catatan: {pay.note || '-'}</p>
                        </div>
                        <div className="text-right text-[10px] text-slate-400 font-semibold flex items-center gap-2">
                          <span>{formatDate(pay.payment_date)}</span>
                          <span className="font-mono uppercase text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{pay.payment_method}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">Belum ada angsuran tercatat untuk nota ini.</p>
                )}
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-rose-500 font-bold">Gagal mengambil rincian detail.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Penagihan Piutang Customer (AR)</h1>
          <p className="text-slate-400 text-sm">Monitoring daftar invoice kredit aktif, input biaya travel/bus, dan catat angsuran piutang global.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={openPaymentModal}
            disabled={filteredData.length === 0}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <DollarSign size={14} />
            <span>Bayar Tagihan Multi-Nota (F10)</span>
          </button>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 flex flex-col md:flex-row md:items-end gap-4">
        {/* Search */}
        <div className="relative flex-grow">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Pelanggan (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nama pelanggan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsConfirmed(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    setPopupFocusedIndex(0);
                    setShowSearchPopup(true);
                  }
                }
              }}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Status Filter Trigger */}
        <div className="w-full md:w-64">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Filter Status Piutang (F3)</label>
          <button
            type="button"
            onClick={() => {
              setSelectedFilterOptionIdx(['all', 'overdue', 'lancar'].indexOf(statusFilter));
              setShowFilterModal(true);
            }}
            className="input-field w-full py-2 px-3 text-xs flex justify-between items-center text-slate-350 bg-surface-900 border border-surface-750 hover:bg-surface-750 hover:text-white transition-all text-left font-bold cursor-pointer"
          >
            <span>
              {statusFilter === 'all' && 'Semua'}
              {statusFilter === 'overdue' && 'Overdue'}
              {statusFilter === 'lancar' && 'Hampir'}
            </span>
            <ChevronDown size={14} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* Customer List Card Grid */}
      {!searchQuery.trim() ? (
        <div className="card p-16 text-center text-slate-400 border border-surface-700/60 bg-surface-800/20 flex flex-col items-center justify-center gap-3 rounded-xl">
          <div className="p-4 bg-surface-750/50 rounded-full border border-surface-700 shadow-inner">
            <Search size={28} className="text-primary-500/80 animate-pulse" />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-400 font-medium">
            Silakan ketik nama customer pada kolom pencarian untuk menampilkan data piutang.
          </p>
        </div>
      ) : !isConfirmed ? (
        <div className="card p-16 text-center text-slate-400 border border-surface-700/60 bg-surface-800/20 flex flex-col items-center justify-center gap-3 rounded-xl">
          <div className="p-4 bg-surface-750/50 rounded-full border border-surface-700 shadow-inner">
            <Search size={28} className="text-amber-500/80 animate-bounce" />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-400 font-medium">
            Tekan <span className="font-extrabold text-blue-600 font-mono">Enter</span> untuk memilih customer dan menampilkan data piutang.
          </p>
        </div>
      ) : isLoading ? (
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
                className={`card p-0 overflow-hidden border transition-all ${isSelected ? 'card-hovered border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                  }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => {
                    setSelectedCustIdx(cIdx);
                    setSelectedInvoiceIdx(null);
                    setExpandedCustIds(prev => ({ ...prev, [cust.id]: !prev[cust.id] }));
                  }}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-blue-50/20 bg-transparent`}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrintBillingGroup(group);
                        setShowBillingPrintModal(true);
                      }}
                      className="btn-primary py-1.5 px-3 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={12} />
                      <span>Cetak Penagihan</span>
                    </button>

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
                          <th className="p-3 w-10 text-center">No</th>
                          <th className="p-3 w-32">No. Faktur</th>
                          <th className="p-3 w-28">Tgl Order</th>
                          <th className="p-3 w-28">Jatuh Tempo</th>
                          <th className="p-3 text-right w-32">Subtotal Barang</th>
                          <th className="p-3 text-right w-36">Biaya Tambahan (SO)</th>
                          <th className="p-3 text-center w-36">Pengiriman</th>
                          <th className="p-3 text-right w-32">Total Nota</th>
                          <th className="p-3 text-right w-32">Terbayar</th>
                          <th className="p-3 text-right w-32">Sisa Tagihan</th>
                          <th className="p-3 text-center w-28">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-750">
                        {group.invoices.map((inv, iIdx) => {
                          const isInvSelected = selectedCustIdx === cIdx && selectedInvoiceIdx === iIdx;
                          const grandTotal = Number(inv.subtotal) + Number(inv.biaya_pengiriman);
                          const itemsSubtotal = Number(inv.subtotal) - Number(inv.extra_charge_amount || 0);

                          const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                            let base = "p-3 transition-all duration-150 border-b border-surface-750 ";
                            if (isInvSelected) {
                              base = "p-3 transition-all duration-150 border-b border-blue-300 bg-blue-100 ";
                              if (pos === 'first') base += "border-l-4 border-primary-600 ";
                            }
                            return base;
                          };

                          return (
                            <tr
                              key={inv.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustIdx(cIdx);
                                setSelectedInvoiceIdx(iIdx);
                              }}
                              className={`hover:bg-surface-750/30 cursor-pointer ${isInvSelected ? 'bg-blue-100' : 'text-slate-300'
                                }`}
                            >
                              <td className={`${getTdClass('first')} text-center ${isInvSelected ? 'text-primary-950 font-bold' : 'text-slate-500'}`}>
                                {iIdx + 1}
                              </td>
                              <td className={`${getTdClass('middle')} font-mono font-bold ${isInvSelected ? 'text-primary-950' : 'text-slate-200'}`}>
                                {inv.no_faktur || inv.no_order}
                              </td>
                              <td className={`${getTdClass('middle')} ${isInvSelected ? 'text-slate-800' : ''}`}>
                                {formatDate(inv.order_date)}
                              </td>
                              <td className={`${getTdClass('middle')} font-bold ${isInvSelected
                                ? (inv.is_overdue ? 'text-danger-700' : 'text-slate-750')
                                : (inv.is_overdue ? 'text-danger-400' : 'text-slate-400')
                                }`}>
                                {formatDate(inv.due_date)}
                              </td>
                              <td className={`${getTdClass('middle')} text-right font-mono ${isInvSelected ? 'text-slate-800' : ''}`}>
                                {formatCurrency(itemsSubtotal)}
                              </td>
                              <td className={`${getTdClass('middle')} text-right`}>
                                <span className={`font-mono block ${isInvSelected ? 'text-slate-800' : 'text-slate-300'}`}>
                                  {formatCurrency(Number(inv.extra_charge_amount || 0))}
                                </span>
                                {inv.extra_charge_desc && (
                                  <span className={`text-[9px] block mt-0.5 truncate max-w-[120px] font-medium ${isInvSelected ? 'text-slate-650' : 'text-slate-450'}`} title={inv.extra_charge_desc}>
                                    {inv.extra_charge_desc}
                                  </span>
                                )}
                              </td>
                              <td className={`${getTdClass('middle')} text-center`} onClick={(e) => e.stopPropagation()}>
                                <input
                                  id={`input-pengiriman-${inv.id}`}
                                  key={`${inv.id}-${inv.biaya_pengiriman}`}
                                  type="text"
                                  defaultValue={formatRupiahInput(Number(inv.biaya_pengiriman))}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseRupiahInput(e.target.value);
                                    e.target.value = formatRupiahInput(val);
                                  }}
                                  onBlur={(e) => {
                                    const val = parseRupiahInput(e.target.value);
                                    if (val !== Number(inv.biaya_pengiriman)) {
                                      handleUpdateOngkir(inv.id, val);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault();
                                      (e.target as HTMLInputElement).blur();
                                      document.body.focus();
                                      return;
                                    }
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const val = parseRupiahInput((e.target as HTMLInputElement).value);
                                      if (val !== Number(inv.biaya_pengiriman)) {
                                        handleUpdateOngkir(inv.id, val);
                                      }

                                      // Blur input
                                      (e.target as HTMLInputElement).blur();

                                      // Move highlighting and focus to the next row
                                      const currentGroup = filteredData[selectedCustIdx];
                                      if (currentGroup && selectedInvoiceIdx !== null && selectedInvoiceIdx < currentGroup.invoices.length - 1) {
                                        const nextIdx = selectedInvoiceIdx + 1;
                                        setSelectedInvoiceIdx(nextIdx);
                                        const nextInv = currentGroup.invoices[nextIdx];
                                        setTimeout(() => {
                                          const nextInput = document.getElementById(`input-pengiriman-${nextInv.id}`) as HTMLInputElement;
                                          if (nextInput) {
                                            nextInput.focus();
                                            nextInput.select();
                                          }
                                        }, 50);
                                      }
                                    }
                                  }}
                                  className={`input-field py-1 px-2 text-right text-xs font-mono w-28 text-white font-bold focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all ${isInvSelected ? 'bg-primary-955/80 border-primary-600' : 'bg-surface-900 border-primary-500/40'
                                    }`}
                                />
                              </td>
                              <td className={`${getTdClass('middle')} text-right font-mono font-bold ${isInvSelected ? 'text-primary-950' : 'text-white'}`}>
                                {formatCurrency(grandTotal)}
                              </td>
                              <td className={`${getTdClass('middle')} text-right font-mono ${isInvSelected ? 'text-emerald-700 font-bold' : 'text-emerald-400'}`}>
                                {formatCurrency(Number(inv.paid_amount))}
                              </td>
                              <td className={`${getTdClass('middle')} text-right font-mono font-bold ${isInvSelected ? 'text-rose-700' : 'text-rose-400'}`}>
                                {formatCurrency(Number(inv.remaining))}
                              </td>
                              <td className={`${getTdClass('last')} text-center`}>
                                {inv.is_overdue ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger-955 text-danger-400 border border-danger-700/30 inline-flex items-center gap-1">
                                    <AlertTriangle size={10} /> Overdue
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-955 text-yellow-400 border border-yellow-700/30 inline-flex items-center gap-1">
                                    <CheckCircle size={10} /> Hampir
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="pt-2 p-3 text-[10px] text-slate-400 flex justify-between bg-surface-900/50">
                      <span>Tekan <kbd className="shortcut-badge">F4</kbd> lihat rincian nota | <kbd className="shortcut-badge">F10</kbd> catat setoran</span>
                      <span>Gunakan panah <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk navigasi</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Selection Search Popup Modal */}
      {showSearchPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={searchPopupRef}
            tabIndex={0}
            onKeyDown={handleSearchPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col text-slate-200"
          >
            <div className="flex justify-between items-center w-full border-b border-surface-700 pb-3 shrink-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>Pilih Pelanggan (Customer)</span>
              </h3>
              <button
                onClick={() => {
                  setShowSearchPopup(false);
                  searchInputRef.current?.focus();
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {isLoading ? (
                <div className="py-8 text-center text-slate-500 italic text-xs">
                  Memuat data pelanggan...
                </div>
              ) : filteredData.length === 0 ? (
                <div className="py-8 text-center text-slate-500 italic text-xs">
                  Tidak ada pelanggan yang cocok dengan pencarian "{searchQuery}".
                </div>
              ) : (
                filteredData.map((group, idx) => (
                  <button
                    type="button"
                    key={group.customer.id}
                    onClick={() => {
                      setSelectedCustIdx(idx);
                      setSelectedInvoiceIdx(null);
                      setExpandedCustIds({});
                      setShowSearchPopup(false);
                      setIsConfirmed(true);
                      setTimeout(() => {
                        document.body.focus();
                      }, 50);
                    }}
                    onMouseEnter={() => setPopupFocusedIndex(idx)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-xs transition-all border rounded-lg cursor-pointer ${idx === popupFocusedIndex
                      ? 'border-primary-500 bg-primary-600/10 text-primary-400 font-semibold ring-2 ring-primary-500/20 scale-[1.01]'
                      : 'border-surface-700 hover:bg-surface-750 text-slate-350 bg-surface-900'
                      }`}
                  >
                    <div>
                      <p className="font-semibold text-white">{group.customer.nama}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Alamat: {group.customer.alamat || '-'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Kode: {group.customer.kode}</span>
                      <span className="text-[11px] font-bold text-rose-400 block mt-0.5">Piutang: {formatCurrency(group.total_piutang)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-surface-700 flex justify-between text-[10px] text-slate-500 shrink-0">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> pilih | <kbd className="shortcut-badge">Esc</kbd> tutup</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Status Modal (F3) */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={filterModalRef}
            tabIndex={0}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in space-y-4 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedFilterOptionIdx((curr) => (curr > 0 ? curr - 1 : 2));
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedFilterOptionIdx((curr) => (curr < 2 ? curr + 1 : 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const options: ('all' | 'overdue' | 'lancar')[] = ['all', 'overdue', 'lancar'];
                setStatusFilter(options[selectedFilterOptionIdx]);
                setShowFilterModal(false);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowFilterModal(false);
              }
            }}
          >
            <div className="flex justify-between items-center border-b border-surface-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Filter Status Piutang (F3)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { key: 'all', label: 'Semua Status', color: 'bg-primary-600' },
                { key: 'overdue', label: 'Overdue (Jatuh Tempo)', color: 'bg-danger-600' },
                { key: 'lancar', label: 'Hampir', color: 'bg-yellow-500' },
              ].map((opt, idx) => {
                const isSelected = selectedFilterOptionIdx === idx;
                const isCurrent = statusFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(opt.key as any);
                      setShowFilterModal(false);
                    }}
                    onMouseEnter={() => setSelectedFilterOptionIdx(idx)}
                    className={`w-full text-left p-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${isSelected
                      ? 'bg-primary-600/10 border-primary-500 text-primary-400 font-semibold'
                      : 'bg-surface-900 border-surface-750 text-slate-400 hover:bg-surface-850 hover:text-slate-200'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                      <span>{opt.label}</span>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] text-primary-500 font-normal italic">Aktif</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 text-[10px] text-slate-500 flex justify-between">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> pilih | <kbd className="shortcut-badge">Esc</kbd> tutup</span>
            </div>
          </div>
        </div>
      )}

      {/* Setoran Payment Modal (F10) */}
      {showPaymentModal && filteredData[selectedCustIdx] && (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row items-center justify-center gap-4 p-4 modal-overlay overflow-y-auto">
          <form
            onSubmit={submitPayment}
            className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header with Blue Color */}
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign size={18} />
                <span>Pencatatan Setoran Pembayaran Multi-Nota</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-blue-100 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-slate-800">
              {/* Customer Info Card in Light Theme */}
              <div className="p-3 bg-blue-50/50 border border-blue-100/60 rounded-lg text-xs space-y-1 shrink-0">
                <p className="text-slate-655">Customer: <strong className="text-slate-900">{filteredData[selectedCustIdx].customer.nama} ({filteredData[selectedCustIdx].customer.kode})</strong></p>
                <p className="text-slate-655">Total Piutang Aktif: <strong className="text-rose-600 font-bold">{formatCurrency(filteredData[selectedCustIdx].total_piutang)}</strong></p>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-655 mb-1">Mode Pembayaran</label>
                <div className="flex gap-2">
                  <button
                    ref={paymentModeFifoRef}
                    type="button"
                    onClick={() => setPaymentMode('fifo')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        paymentModeManualRef.current?.focus();
                        setPaymentMode('manual');
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        paymentDateRef.current?.focus();
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${paymentMode === 'fifo'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    FIFO Otomatis (Nota Terlama)
                  </button>
                  <button
                    ref={paymentModeManualRef}
                    type="button"
                    onClick={() => setPaymentMode('manual')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        paymentModeFifoRef.current?.focus();
                        setPaymentMode('fifo');
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        paymentDateRef.current?.focus();
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${paymentMode === 'manual'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Pilihan Manual Per Nota
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-655 mb-1">Tanggal Setoran</label>
                <input
                  ref={paymentDateRef}
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (paymentMode === 'fifo') {
                        paymentAmountRef.current?.focus();
                      } else {
                        const currentGroup = filteredData[selectedCustIdx];
                        if (currentGroup && currentGroup.invoices.length > 0) {
                          const firstInv = currentGroup.invoices[0];
                          setTimeout(() => {
                            const firstInput = document.getElementById(`modal-manual-input-${firstInv.id}`) as HTMLInputElement;
                            firstInput?.focus();
                            firstInput?.select();
                          }, 50);
                        }
                      }
                    }
                  }}
                  required
                  className="input-field w-full py-2 text-xs bg-slate-50 border border-slate-250 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
              </div>

              {/* FIFO Mode Amount Input */}
              {paymentMode === 'fifo' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-655 mb-1">Nominal Setoran (Rp)</label>
                  <input
                    ref={paymentAmountRef}
                    type="text"
                    value={formatRupiahInput(paymentAmount)}
                    onChange={(e) => setPaymentAmount(e.target.value ? parseRupiahInput(e.target.value) : '')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        paymentMethodCashRef.current?.focus();
                      }
                    }}
                    required
                    placeholder="Masukkan nominal setoran..."
                    className="input-field w-full py-2 text-xs font-mono text-right bg-slate-50 border border-slate-250 text-emerald-600 font-bold focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-655 mb-1">Metode Setoran</label>
                <div className="flex gap-2">
                  <button
                    ref={paymentMethodCashRef}
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        paymentMethodTransferRef.current?.focus();
                        setPaymentMethod('transfer');
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        (syncNotaOtomatis ? syncNotaYaRef : syncNotaTidakRef).current?.focus();
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${paymentMethod === 'cash'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Tunai / Cash
                  </button>
                  <button
                    ref={paymentMethodTransferRef}
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        paymentMethodCashRef.current?.focus();
                        setPaymentMethod('cash');
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        (syncNotaOtomatis ? syncNotaYaRef : syncNotaTidakRef).current?.focus();
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${paymentMethod === 'transfer'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Transfer Bank
                  </button>
                </div>
              </div>

              {/* Automatic Nota Synchronization Button Toggle */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-655 mb-1">
                  Otomatisasi Manajemen Nota (Merah/Putih)
                </label>
                <div className="flex gap-2">
                  <button
                    ref={syncNotaYaRef}
                    type="button"
                    onClick={() => setSyncNotaOtomatis(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        syncNotaTidakRef.current?.focus();
                        setSyncNotaOtomatis(false);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        paymentNoteRef.current?.focus();
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${syncNotaOtomatis
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Ya
                  </button>
                  <button
                    ref={syncNotaTidakRef}
                    type="button"
                    onClick={() => setSyncNotaOtomatis(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        syncNotaYaRef.current?.focus();
                        setSyncNotaOtomatis(true);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        paymentNoteRef.current?.focus();
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${!syncNotaOtomatis
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Tidak
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Jika aktif: Nota Merah akan diceklis & Putih di-unceklis jika lunas. 
                  Jika belum lunas, Nota Putih akan diceklis & Merah di-unceklis.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-655 mb-1">Catatan Setoran</label>
                <textarea
                  ref={paymentNoteRef}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      savePayment(false); // Save without printing
                    }
                  }}
                  rows={2}
                  placeholder="Keterangan transfer bank, no giro, dll... (Opsional)"
                  className="input-field w-full py-1.5 text-xs resize-none bg-slate-50 border border-slate-250 text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end items-center text-xs shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary py-1.5 px-3 text-xs font-bold rounded-lg cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-350 text-slate-800 whitespace-nowrap"
                >
                  Batal (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => savePayment(false)}
                  className="btn-secondary py-1.5 px-3 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-350 text-slate-850 cursor-pointer whitespace-nowrap"
                >
                  Simpan
                </button>
                <button
                  type="submit"
                  className="btn-primary py-1.5 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cetak
                </button>
              </div>
            </div>
          </form>

          {/* FIFO Distribution Preview Side-Panel */}
          {paymentMode === 'fifo' && Number(paymentAmount) > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl w-full md:w-80 shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden shrink-0">
              <div className="bg-blue-600 px-5 py-4 flex items-center gap-2 text-white shrink-0">
                <FileText size={18} />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Preview Distribusi (FIFO)</h4>
              </div>
              <div className="p-4 overflow-y-auto space-y-2 text-xs flex-1 bg-slate-50/30">
                <div className="space-y-2 text-[11px]">
                  {fifoAllocations.map((alloc) => (
                    <div key={alloc.id} className="flex flex-col p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1">
                      <div className="flex justify-between font-mono font-bold text-slate-800">
                        <span>{alloc.no_faktur || alloc.no_order}</span>
                        {alloc.remainingAfter === 0 ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-0.5">Lunas ✓</span>
                        ) : (
                          <span className="text-amber-600 font-semibold flex items-center gap-0.5">Sebagian</span>
                        )}
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Tagihan Awal:</span>
                        <span>{formatCurrency(alloc.remaining)}</span>
                      </div>
                      <div className="flex justify-between border-t border-dashed border-slate-200 pt-1 font-semibold text-emerald-600">
                        <span>Bayar:</span>
                        <span>{formatCurrency(alloc.allocated)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Manual Mode Invoices Table Side-Panel */}
          {paymentMode === 'manual' && (
            <div className="bg-white border border-slate-200 rounded-xl w-full md:w-96 shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden shrink-0">
              <div className="bg-blue-600 px-5 py-4 flex items-center gap-2 text-white shrink-0">
                <FileText size={18} />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Input Setoran Per Nota</h4>
              </div>
              <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/30">
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto bg-white shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr className="text-slate-500 text-[10px] font-bold uppercase">
                        <th className="p-2">No. Faktur</th>
                        <th className="p-2 text-right">Sisa Tagihan</th>
                        <th className="p-2 text-center w-36">Nominal Bayar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData[selectedCustIdx].invoices.map((inv, idx, invoices) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50">
                          <td className="p-2 font-mono text-slate-700">{inv.no_faktur || inv.no_order}</td>
                          <td className="p-2 text-right font-mono text-rose-600">{formatCurrency(inv.remaining)}</td>
                          <td className="p-1.5 text-center">
                            <input
                              id={`modal-manual-input-${inv.id}`}
                               type="text"
                               value={formatRupiahInput(manualAmounts[inv.id] || 0)}
                               onFocus={(e) => {
                                 e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                               }}
                               onChange={(e) => {
                                const val = parseRupiahInput(e.target.value);
                                setManualAmounts(prev => ({
                                  ...prev,
                                  [inv.id]: val,
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (idx < invoices.length - 1) {
                                    const nextInv = invoices[idx + 1];
                                    const nextInput = document.getElementById(`modal-manual-input-${nextInv.id}`) as HTMLInputElement;
                                    nextInput?.focus();
                                    nextInput?.select();
                                  } else {
                                    paymentMethodCashRef.current?.focus();
                                  }
                                } else if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  if (idx < invoices.length - 1) {
                                    const nextInv = invoices[idx + 1];
                                    const nextInput = document.getElementById(`modal-manual-input-${nextInv.id}`) as HTMLInputElement;
                                    nextInput?.focus();
                                    nextInput?.select();
                                  }
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  if (idx > 0) {
                                    const prevInv = invoices[idx - 1];
                                    const prevInput = document.getElementById(`modal-manual-input-${prevInv.id}`) as HTMLInputElement;
                                    prevInput?.focus();
                                    prevInput?.select();
                                  }
                                }
                              }}
                              className="input-field py-1 px-2 text-right text-xs font-mono w-28 bg-slate-50 border border-slate-250 text-emerald-600 font-semibold focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Total Setoran Manual</span>
                  <strong className="text-emerald-600 text-sm font-black">{formatCurrency(manualTotal)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal is rendered inline in full-page style above */}

      {/* Struk Cetak Pembayaran / Receipt Modal */}
      {showReceiptModal && receiptSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 shrink-0 print:hidden">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Printer size={20} className="text-primary-400" />
                <span>Bukti Setoran Pembayaran Piutang</span>
              </h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Print Area */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6 text-xs bg-white text-slate-900 p-8 rounded-lg mt-4 font-mono shadow-inner print:mt-0 print:p-0" id="print-receipt-area">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-extrabold tracking-wider uppercase text-slate-950">CV MAJU MULIA BERSAMA</h2>
                <p className="text-xs text-slate-600">Suku Cadang & Sparepart AC Mobil Terlengkap</p>
                <p className="text-[10px] text-slate-500 border-b border-slate-300 pb-2">Jl. Raya Timur Kudus, Indonesia | Telp: 0291-555-1234</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <p><strong>Customer:</strong> {receiptSession.allocations[0]?.sale?.customer?.nama || receiptSession.target_nama}</p>
                  <p><strong>Alamat:</strong> {receiptSession.allocations[0]?.sale?.customer?.alamat || '-'}</p>
                  <p><strong>Telp:</strong> {receiptSession.allocations[0]?.sale?.customer?.no_telp || '-'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p><strong>Tanggal Setoran:</strong> {formatDate(receiptSession.session_date)}</p>
                  <p><strong>Metode Pembayaran:</strong> <span className="uppercase">{receiptSession.payment_method}</span></p>
                  <p><strong>Kasir/Admin:</strong> {receiptSession.creator?.nama || '-'}</p>
                </div>
              </div>

              <div className="border-t border-b border-slate-300 py-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-2 w-8 text-center">No</th>
                      <th className="py-2">No. Nota</th>
                      <th className="py-2">Tgl Order</th>
                      <th className="py-2 text-right">Total Nota</th>
                      <th className="py-2 text-right">Bayar Hari Ini</th>
                      <th className="py-2 text-right">Sisa Tagihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receiptSession.allocations.map((alloc: any, idx: number) => {
                      const grandTotal = Number(alloc.sale.subtotal) + Number(alloc.sale.biaya_pengiriman);
                      return (
                        <tr key={alloc.id}>
                          <td className="py-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2 font-mono font-bold text-slate-900">{alloc.sale.no_faktur || alloc.sale.no_order}</td>
                          <td className="py-2 text-slate-600">{formatDate(alloc.sale.order_date)}</td>
                          <td className="py-2 text-right font-mono">{formatCurrency(grandTotal)}</td>
                          <td className="py-2 text-right font-mono text-emerald-700 font-bold">+{formatCurrency(Number(alloc.allocated_amount))}</td>
                          <td className="py-2 text-right font-mono text-rose-600">{formatCurrency(Number(alloc.remaining_after))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-end space-y-1.5">
                <div className="flex justify-between w-64 text-xs">
                  <span className="text-slate-600">Total Setoran:</span>
                  <strong className="text-emerald-700 font-black">{formatCurrency(Number(receiptSession.total_amount))}</strong>
                </div>
                <div className="flex justify-between w-64 text-[10px] text-slate-500 border-t border-slate-200 pt-1.5">
                  <span>Catatan:</span>
                  <span className="italic">{receiptSession.catatan || '-'}</span>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div>
                  <p className="text-slate-500">Penerima (Admin)</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-t border-slate-300 pt-1 inline-block px-4">({receiptSession.creator?.nama || 'Budi Santoso'})</p>
                </div>
                <div>
                  <p className="text-slate-500">Penyetor (Customer)</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-t border-slate-300 pt-1 inline-block px-4">({receiptSession.allocations[0]?.sale?.customer?.nama || 'Bengkel'})</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-700 flex justify-end gap-2 shrink-0 print:hidden">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="btn-secondary text-xs px-4"
              >
                Tutup (Esc)
              </button>
              <button
                onClick={printReceipt}
                className="btn-primary flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 px-5 font-bold"
              >
                <Printer size={14} />
                <span>Cetak Struk (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Struk Cetak Penagihan / Billing Print Modal */}
      {showBillingPrintModal && printBillingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-3xl w-full mx-4 shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 shrink-0 print:hidden">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Printer size={20} className="text-primary-400" />
                <span>Cetak Lembar Penagihan Piutang</span>
              </h3>
              <button
                onClick={() => setShowBillingPrintModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Print Area */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6 text-xs bg-white text-slate-900 p-8 rounded-lg mt-4 font-mono shadow-inner print:mt-0 print:p-0" id="print-billing-area">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-extrabold tracking-wider uppercase text-slate-950">CV MAJU MULIA BERSAMA</h2>
                <p className="text-xs text-slate-600">Suku Cadang & Sparepart AC Mobil Terlengkap</p>
                <p className="text-[10px] text-slate-500 border-b border-slate-300 pb-2">Jl. Raya Timur Kudus, Indonesia | Telp: 0291-555-1234</p>
              </div>

              <div className="text-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 underline">LEMBAR PENAGIHAN PIUTANG CUSTOMER</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-slate-800">
                <div className="space-y-1">
                  <p><strong>Customer:</strong> {printBillingGroup.customer.nama}</p>
                  <p><strong>Kode Cust:</strong> {printBillingGroup.customer.kode}</p>
                  <p><strong>Alamat:</strong> {printBillingGroup.customer.alamat || '-'}</p>
                  <p><strong>No Telp:</strong> {printBillingGroup.customer.no_telp || '-'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p><strong>Tanggal Tagihan:</strong> {formatDate(new Date().toISOString())}</p>
                  <p><strong>Limit Kredit:</strong> {formatCurrency(Number(printBillingGroup.customer.limit_kredit))}</p>
                </div>
              </div>

              <div className="border-t border-b border-slate-300 py-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-2 w-8 text-center">No</th>
                      <th className="py-2">No. Faktur</th>
                      <th className="py-2">Tgl Order</th>
                      <th className="py-2">Jatuh Tempo</th>
                      <th className="py-2 text-right">Total Nota</th>
                      <th className="py-2 text-right">Terbayar</th>
                      <th className="py-2 text-right">Sisa Tagihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {printBillingGroup.invoices.map((inv, idx) => {
                      const grandTotal = Number(inv.subtotal) + Number(inv.biaya_pengiriman);
                      return (
                        <tr key={inv.id}>
                          <td className="py-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2 font-mono font-bold text-slate-900">{inv.no_faktur || inv.no_order}</td>
                          <td className="py-2 text-slate-600">{formatDate(inv.order_date)}</td>
                          <td className="py-2 text-slate-650">{formatDate(inv.due_date)}</td>
                          <td className="py-2 text-right font-mono">{formatCurrency(grandTotal)}</td>
                          <td className="py-2 text-right font-mono text-emerald-700">{formatCurrency(Number(inv.paid_amount))}</td>
                          <td className="py-2 text-right font-mono text-rose-600 font-bold">{formatCurrency(Number(inv.remaining))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-end space-y-1.5 text-slate-800">
                <div className="flex justify-between w-64 text-xs font-bold border-b border-slate-300 pb-1">
                  <span>TOTAL PIUTANG:</span>
                  <span className="text-rose-600 font-black">{formatCurrency(printBillingGroup.total_piutang)}</span>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs text-slate-700">
                <div>
                  <p>Mengetahui (Kolektor/Admin)</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-t border-slate-300 pt-1 inline-block px-4">( ______________________ )</p>
                </div>
                <div>
                  <p>Penerima (Customer)</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-t border-slate-300 pt-1 inline-block px-4">( {printBillingGroup.customer.nama} )</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-700 flex justify-end gap-2 shrink-0 print:hidden">
              <button
                onClick={() => setShowBillingPrintModal(false)}
                className="btn-secondary text-xs px-4 bg-surface-700 hover:bg-surface-650 text-white rounded-lg cursor-pointer"
              >
                Tutup (Esc)
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 px-5 font-bold rounded-lg cursor-pointer"
              >
                <Printer size={14} />
                <span>Cetak Lembar Penagihan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-[9999] px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in bg-white border ${
          toast.type === 'success' ? 'border-blue-600 text-blue-600' : 'border-red-650 text-red-650'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} className="text-blue-600" /> : <AlertTriangle size={16} className="text-red-650" />}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Global CSS media print block */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-receipt-area, #print-receipt-area *,
          #print-billing-area, #print-billing-area * {
            visibility: visible;
          }
          #print-receipt-area, #print-billing-area {
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
