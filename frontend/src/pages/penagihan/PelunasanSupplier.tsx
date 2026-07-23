import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
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
import { ModalPortal } from '@/components/ui/ModalPortal';

interface Supplier {
  id: string;
  kode: string;
  nama: string;
  alamat: string;
  no_telp: string;
  jatuh_tempo_bulan: number;
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
  no_faktur: string | null;
  order_date: string;
  due_date: string | null;
  terms: string;
  subtotal: number;
  biaya_pengiriman: string; // Decimal from database
  extra_charge_amount?: string | number;
  extra_charge_desc?: string | null;
  paid_amount: number;
  remaining: number;
  is_overdue: boolean;
  diantar: boolean;
  limit_bulan: number;
  sender_note?: string | null;
}

const getStoredState = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const PelunasanSupplier: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [data, setData] = useState<SupplierGroup[]>([]);
  const [filteredData, setFilteredData] = useState<SupplierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState(() => getStoredState('pelunasan_supp_searchQuery', ''));
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'lancar'>(() => getStoredState('pelunasan_supp_statusFilter', 'all'));
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilterOptionIdx, setSelectedFilterOptionIdx] = useState(0);
  const filterModalRef = useRef<HTMLDivElement>(null);

  // Expanded suppliers
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Record<string, boolean>>({});

  // Keyboard navigation indexes
  const [selectedSuppIdx, setSelectedSuppIdx] = useState<number>(() => getStoredState('pelunasan_supp_selectedSuppIdx', 0));
  const [selectedPurchaseIdx, setSelectedPurchaseIdx] = useState<number | null>(() => getStoredState('pelunasan_supp_selectedPurchaseIdx', null));

  // Refs for focusing
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paymentModeFifoRef = useRef<HTMLButtonElement>(null);
  const paymentModeManualRef = useRef<HTMLButtonElement>(null);
  const paymentDateRef = useRef<HTMLInputElement>(null);
  const paymentAmountRef = useRef<HTMLInputElement>(null);
  const paymentMethodCashRef = useRef<HTMLButtonElement>(null);
  const paymentMethodTransferRef = useRef<HTMLButtonElement>(null);
  const paymentNoteRef = useRef<HTMLTextAreaElement>(null);

  // Modal payment (global / multi-purchase)
  const [showPaymentModal, setShowPaymentModal] = useState(() => getStoredState('pelunasan_supp_showPaymentModal', false));
  const [paymentMode, setPaymentMode] = useState<'fifo' | 'manual'>(() => getStoredState('pelunasan_supp_paymentMode', 'fifo'));
  const [paymentAmount, setPaymentAmount] = useState<number | ''>(() => getStoredState('pelunasan_supp_paymentAmount', ''));
  const [manualAmounts, setManualAmounts] = useState<Record<string, number>>(() => getStoredState('pelunasan_supp_manualAmounts', {}));
  const [paymentMethod, setPaymentMethod] = useState(() => getStoredState('pelunasan_supp_paymentMethod', 'cash'));
  const [paymentNote, setPaymentNote] = useState(() => getStoredState('pelunasan_supp_paymentNote', ''));
  const [paymentDate, setPaymentDate] = useState(() => getStoredState('pelunasan_supp_paymentDate', new Date().toISOString().slice(0, 10)));

  // Modal PO detail (F4)
  const [showDetailModal, setShowDetailModal] = useState(() => getStoredState('pelunasan_supp_showDetailModal', false));
  const [detailPurchaseId, setDetailPurchaseId] = useState<string | null>(() => getStoredState('pelunasan_supp_detailPurchaseId', null));
  const [detailPurchase, setDetailPurchase] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Supplier search selection popup modal
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(() => getStoredState('pelunasan_supp_isConfirmed', false));
  const [popupFocusedIndex, setPopupFocusedIndex] = useState(0);
  const searchPopupRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const supplierRowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const purchaseRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    if (showSearchPopup) {
      const target = itemRefs.current[popupFocusedIndex];
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [popupFocusedIndex, showSearchPopup]);

  useEffect(() => {
    if (selectedPurchaseIdx === null && supplierRowRefs.current[selectedSuppIdx]) {
      supplierRowRefs.current[selectedSuppIdx]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedSuppIdx, selectedPurchaseIdx]);

  useEffect(() => {
    if (selectedPurchaseIdx !== null) {
      const activeKey = `${selectedSuppIdx}-${selectedPurchaseIdx}`;
      if (purchaseRowRefs.current[activeKey]) {
        purchaseRowRefs.current[activeKey]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedSuppIdx, selectedPurchaseIdx]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const cleanPaymentNote = (note: string | null | undefined): string => {
    if (!note) return '-';
    let cleaned = note.replace(/\[Session ID:\s*[^\]]+\]/gi, '');
    cleaned = cleaned.replace(/Sesi Penagihan:\s*/gi, '');
    cleaned = cleaned.replace(/Sesi Pembayaran AP:\s*/gi, '');
    cleaned = cleaned.trim();
    if (!cleaned || cleaned === '-') return '-';
    return cleaned;
  };

  useEffect(() => {
    localStorage.setItem('pelunasan_supp_searchQuery', JSON.stringify(searchQuery));
    localStorage.setItem('pelunasan_supp_statusFilter', JSON.stringify(statusFilter));
    localStorage.setItem('pelunasan_supp_selectedSuppIdx', JSON.stringify(selectedSuppIdx));
    localStorage.setItem('pelunasan_supp_selectedPurchaseIdx', JSON.stringify(selectedPurchaseIdx));
    localStorage.setItem('pelunasan_supp_showPaymentModal', JSON.stringify(showPaymentModal));
    localStorage.setItem('pelunasan_supp_paymentMode', JSON.stringify(paymentMode));
    localStorage.setItem('pelunasan_supp_paymentAmount', JSON.stringify(paymentAmount));
    localStorage.setItem('pelunasan_supp_manualAmounts', JSON.stringify(manualAmounts));
    localStorage.setItem('pelunasan_supp_paymentMethod', JSON.stringify(paymentMethod));
    localStorage.setItem('pelunasan_supp_paymentNote', JSON.stringify(paymentNote));
    localStorage.setItem('pelunasan_supp_paymentDate', JSON.stringify(paymentDate));
    localStorage.setItem('pelunasan_supp_showDetailModal', JSON.stringify(showDetailModal));
    localStorage.setItem('pelunasan_supp_detailPurchaseId', JSON.stringify(detailPurchaseId));
    localStorage.setItem('pelunasan_supp_isConfirmed', JSON.stringify(isConfirmed));
  }, [
    searchQuery, statusFilter, selectedSuppIdx, selectedPurchaseIdx,
    showPaymentModal, paymentMode, paymentAmount, manualAmounts, paymentMethod,
    paymentNote, paymentDate, showDetailModal, detailPurchaseId, isConfirmed
  ]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/payments/supplier/debt?q=${searchQuery}`);

      // Process data to calculate due_date, is_overdue, limit_bulan, no_faktur, etc.
      const processed: SupplierGroup[] = res.data.map((group: any) => {
        const purchases = group.purchases.map((pur: any) => {
          const limit_bulan = pur.terms === 'tunai' ? 0 : (parseInt(pur.terms, 10) || 0);
          let due_date = null;
          if (limit_bulan > 0) {
            const d = new Date(pur.order_date);
            d.setMonth(d.getMonth() + limit_bulan);
            due_date = d.toISOString().slice(0, 10);
          }
          const is_overdue = due_date ? new Date() > new Date(due_date) : false;

          return {
            ...pur,
            no_faktur: pur.no_order, // fallback to no_order
            due_date,
            is_overdue,
            limit_bulan,
            diantar: false, // default for PO
          };
        });

        return {
          ...group,
          purchases,
        };
      });

      setData(processed);
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
        const matchingPurchases = group.purchases.filter((pur) => {
          if (statusFilter === 'overdue') return pur.is_overdue;
          if (statusFilter === 'lancar') return !pur.is_overdue;
          return true;
        });

        return {
          ...group,
          purchases: matchingPurchases,
          total_hutang: matchingPurchases.reduce((sum, pur) => sum + pur.remaining, 0),
        };
      })
      .filter((group) => group.purchases.length > 0);

    setFilteredData(filtered);
  }, [data, statusFilter]);

  // Reset selected indexes when filtered data changes
  useEffect(() => {
    setSelectedSuppIdx(0);
    setSelectedPurchaseIdx(null);
  }, [filteredData]);

  // Keyboard Shortcuts
  // F1: Focus Search Supplier
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

  // F4: Detail transaction PO
  useHotkeys('f4', (e) => {
    e.preventDefault();
    openDetailModal();
  }, { enableOnFormTags: false }, [selectedSuppIdx, selectedPurchaseIdx, filteredData]);

  // F10: Process payment — menggunakan window event listener agar tidak diblok browser
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        e.stopPropagation();
        console.log('[F10 useEffect] filteredData.length:', filteredData.length, 'selectedSuppIdx:', selectedSuppIdx);
        if (filteredData.length > 0) {
          openPaymentModal();
        }
      }
    };
    window.addEventListener('keydown', handler, true); // capture phase
    return () => window.removeEventListener('keydown', handler, true);
  }, [filteredData, selectedSuppIdx]);

  // ArrowUp / ArrowDown: Navigation
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (showFilterModal) {
      setSelectedFilterOptionIdx((curr) => (curr > 0 ? curr - 1 : 2));
      return;
    }
    if (filteredData.length === 0) return;

    if (selectedPurchaseIdx !== null && selectedPurchaseIdx > 0) {
      setSelectedPurchaseIdx(selectedPurchaseIdx - 1);
    } else if (selectedPurchaseIdx === 0) {
      setSelectedPurchaseIdx(null); // return to supplier head
    } else if (selectedSuppIdx > 0) {
      const prevIdx = selectedSuppIdx - 1;
      setSelectedSuppIdx(prevIdx);
      const prevSupp = filteredData[prevIdx];
      // if previous supplier is expanded, focus their last purchase
      if (expandedSupplierIds[prevSupp.supplier.id] && prevSupp.purchases.length > 0) {
        setSelectedPurchaseIdx(prevSupp.purchases.length - 1);
      } else {
        setSelectedPurchaseIdx(null);
      }
    }
  }, { enableOnFormTags: false }, [showFilterModal, filteredData, selectedPurchaseIdx, selectedSuppIdx, expandedSupplierIds]);

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (showFilterModal) {
      setSelectedFilterOptionIdx((curr) => (curr < 2 ? curr + 1 : 0));
      return;
    }
    if (filteredData.length === 0) return;

    const currentSupp = filteredData[selectedSuppIdx];
    const isExpanded = expandedSupplierIds[currentSupp.supplier.id];

    if (isExpanded && (selectedPurchaseIdx === null || selectedPurchaseIdx < currentSupp.purchases.length - 1)) {
      setSelectedPurchaseIdx(selectedPurchaseIdx === null ? 0 : selectedPurchaseIdx + 1);
    } else if (selectedSuppIdx < filteredData.length - 1) {
      setSelectedSuppIdx(selectedSuppIdx + 1);
      setSelectedPurchaseIdx(null);
    }
  }, { enableOnFormTags: false }, [showFilterModal, filteredData, selectedSuppIdx, selectedPurchaseIdx, expandedSupplierIds]);

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
    if (showPaymentModal || showDetailModal) return;

    if (selectedPurchaseIdx !== null) {
      e.preventDefault();
      const supplierGroup = filteredData[selectedSuppIdx];
      if (supplierGroup && supplierGroup.purchases[selectedPurchaseIdx]) {
        const selectedPur = supplierGroup.purchases[selectedPurchaseIdx];
        const inputEl = document.getElementById(`input-pengiriman-${selectedPur.id}`) as HTMLInputElement;
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }
      }
      return;
    }

    e.preventDefault();
    if (filteredData.length === 0) return;
    const suppId = filteredData[selectedSuppIdx].supplier.id;
    setExpandedSupplierIds((prev) => ({
      ...prev,
      [suppId]: true,
    }));

    const supplierGroup = filteredData[selectedSuppIdx];
    if (supplierGroup && supplierGroup.purchases.length > 0) {
      setSelectedPurchaseIdx(0);
    }
  }, { enableOnFormTags: false }, [showFilterModal, selectedFilterOptionIdx, showSearchPopup, showPaymentModal, showDetailModal, selectedPurchaseIdx, selectedSuppIdx, filteredData, expandedSupplierIds]);

  // Escape: Reset search / return
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showSearchPopup) {
      setShowSearchPopup(false);
      searchInputRef.current?.focus();
    } else if (showFilterModal) {
      setShowFilterModal(false);
    } else if (showPaymentModal) {
      setShowPaymentModal(false);
    } else if (showDetailModal) {
      setShowDetailModal(false);
    } else if (filteredData.length > 0 && expandedSupplierIds[filteredData[selectedSuppIdx].supplier.id]) {
      const suppId = filteredData[selectedSuppIdx].supplier.id;
      setExpandedSupplierIds(prev => ({ ...prev, [suppId]: false }));
      setSelectedPurchaseIdx(null);
    } else if (searchQuery) {
      setSearchQuery('');
      setIsConfirmed(false);
    } else {
      navigate('/penagihan');
    }
  }, { enableOnFormTags: true }, [showSearchPopup, showFilterModal, showPaymentModal, showDetailModal, searchQuery, filteredData, selectedSuppIdx, expandedSupplierIds]);

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
      setSelectedSuppIdx(popupFocusedIndex);
      setSelectedPurchaseIdx(null);
      setExpandedSupplierIds({});
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
    if (selectedSuppIdx === null) return;
    const supplierGroup = filteredData[selectedSuppIdx];
    if (!supplierGroup || selectedPurchaseIdx === null) return;
    const pur = supplierGroup.purchases[selectedPurchaseIdx];
    if (!pur) return;

    setDetailPurchaseId(pur.id);
    setShowDetailModal(true);
    setIsLoadingDetail(true);
    try {
      const res = await api.get(`/purchases/${pur.id}`);
      setDetailPurchase(res.data);
    } catch (err) {
      console.error(err);
      showToast(lang === 'en' ? 'Failed to fetch PO details' : 'Gagal mengambil detail PO', 'error');
      setShowDetailModal(false);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openPaymentModal = () => {
    console.log('[openPaymentModal] called, selectedSuppIdx:', selectedSuppIdx, 'filteredData.length:', filteredData.length);
    const supplierGroup = filteredData[selectedSuppIdx];
    if (!supplierGroup) { console.log('[openPaymentModal] EARLY RETURN: no supplierGroup at idx', selectedSuppIdx); return; }

    // Reset payment values
    setPaymentMode('fifo');
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNote('');
    setPaymentDate(new Date().toISOString().slice(0, 10));

    const initialManual: Record<string, number> = {};
    supplierGroup.purchases.forEach(pur => {
      initialManual[pur.id] = 0;
    });
    setManualAmounts(initialManual);

    setShowPaymentModal(true);
  };

  // Inline update for Travel/Bus Delivery Costs
  const handleUpdateOngkir = async (purchaseId: string, amount: number) => {
    try {
      await api.patch(`/purchases/${purchaseId}/ongkir`, { biaya_pengiriman: amount });
      fetchData(); // reload values
    } catch (err) {
      console.error(err);
      showToast(lang === 'en' ? 'Failed to update delivery cost' : 'Gagal mengupdate biaya pengiriman', 'error');
    }
  };

  const savePayment = async () => {
    const supplierGroup = filteredData[selectedSuppIdx];
    if (!supplierGroup) return;

    let payload: any = {
      supplier_id: supplierGroup.supplier.id,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      mode: paymentMode,
      catatan: paymentNote,
    };

    if (paymentMode === 'fifo') {
      if (!paymentAmount || Number(paymentAmount) <= 0) {
        showToast(lang === 'en' ? 'Please enter a valid settlement amount.' : 'Silakan masukkan nominal pelunasan yang valid.', 'error');
        return;
      }
      const limit = supplierGroup.total_hutang || 0;
      if (Number(paymentAmount) > Number(limit)) {
        showToast(lang === 'en' ? 'Settlement amount exceeds total active debt!' : 'Nominal pelunasan melebihi total hutang aktif!', 'error');
        return;
      }
      payload.total_amount = Number(paymentAmount);
    } else {
      const activeAllocations = Object.entries(manualAmounts)
        .filter(([_, amount]) => amount > 0)
        .map(([purchase_id, amount]) => ({ purchase_id, amount }));

      if (activeAllocations.length === 0) {
        showToast(lang === 'en' ? 'Please enter a payment amount for at least one PO.' : 'Silakan isi nominal pembayaran minimal untuk satu PO.', 'error');
        return;
      }
      payload.allocations = activeAllocations;
      payload.total_amount = activeAllocations.reduce((sum, a) => sum + a.amount, 0);
    }

    try {
      await api.post('/payments/supplier/session', payload);
      setShowPaymentModal(false);
      fetchData(); // reload list
      showToast(lang === 'en' ? 'Settlement successfully saved.' : 'Pelunasan berhasil disimpan.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || (lang === 'en' ? 'Failed to save debt settlement' : 'Gagal menyimpan pelunasan hutang'), 'error');
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

  // Calculated variables for FIFO preview
  const getFifoAllocations = () => {
    const supplierGroup = filteredData[selectedSuppIdx];
    if (!supplierGroup || paymentMode !== 'fifo' || !paymentAmount) return [];

    let remainingUang = Number(paymentAmount);
    return supplierGroup.purchases.map((pur) => {
      const sisa = pur.remaining;
      const allocated = Math.min(remainingUang, sisa);
      remainingUang -= allocated;

      return {
        id: pur.id,
        no_order: pur.no_order,
        no_faktur: pur.no_faktur,
        remaining: sisa,
        allocated,
        remainingAfter: sisa - allocated,
      };
    });
  };  const fifoAllocations = getFifoAllocations();
  const manualTotal = Object.values(manualAmounts).reduce((sum, v) => sum + v, 0);

  if (showDetailModal && detailPurchaseId) {
    return (
      <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50 text-slate-800 p-6 rounded-2xl border border-blue-100 shadow-xl space-y-4 animate-scale-in">
        {/* Header Board */}
        <div className="bg-blue-600 -mx-6 -mt-6 p-4 px-6 flex justify-between items-center text-white rounded-t-2xl shrink-0">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <FileText size={18} />
            <span>
              {lang === 'en' ? 'Purchase Order (PO) Details' : 'Rincian Purchase Order (PO)'}
            </span>
          </h3>
          <button
            onClick={() => setShowDetailModal(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white border border-blue-500 rounded-lg shadow-sm cursor-pointer transition-all duration-200"
          >
            {lang === 'en' ? '← Back (Esc)' : '← Kembali (Esc)'}
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[82vh] pr-1">
          {isLoadingDetail ? (
            <div className="py-24 text-center text-blue-500 font-bold animate-pulse text-sm">
              {lang === 'en' ? 'Loading PO details...' : 'Memuat rincian PO...'}
            </div>
          ) : detailPurchase ? (
            <>
              {/* Ultra-Compact Metadata Row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-white border border-blue-100 rounded-xl shadow-sm text-xs shrink-0">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                    {lang === 'en' ? 'PO No.' : 'No. PO'}
                  </span>
                  <strong className="text-slate-900 font-mono text-[11px]">{detailPurchase.no_order}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                    {lang === 'en' ? 'PO Date' : 'Tanggal PO'}
                  </span>
                  <strong className="text-slate-800 text-[11px]">{formatDate(detailPurchase.order_date)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                    {lang === 'en' ? 'Terms' : 'Termin'}
                  </span>
                  <strong className="text-slate-800 text-[11px] uppercase">
                    {detailPurchase.terms === 'tunai'
                      ? (lang === 'en' ? 'Cash' : 'Tunai')
                      : (lang === 'en' ? `Credit (${detailPurchase.terms} Mos)` : `Kredit (${detailPurchase.terms} Bln)`)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Supplier</span>
                  <strong className="text-slate-900 text-[11px] block truncate" title={`${detailPurchase.supplier?.nama} (${detailPurchase.supplier?.no_telp || '-'})`}>
                    {detailPurchase.supplier?.nama}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                    {lang === 'en' ? 'Created By' : 'Pembuat'}
                  </span>
                  <span className="text-slate-600 text-[11px] block truncate" title={detailPurchase.creator?.nama || 'Administrator'}>
                    {detailPurchase.creator?.nama || 'Administrator'}
                  </span>
                </div>
              </div>

              {/* Items List Table - Low Padding */}
              <div className="border border-blue-100 rounded-xl overflow-hidden bg-white shadow-sm shrink-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-blue-50 text-blue-900 font-bold uppercase text-[9px] border-b border-blue-100">
                      <th className="py-2 px-3 w-10 text-center">No</th>
                      <th className="py-2 px-3">{lang === 'en' ? 'SKU Code' : 'Kode SKU'}</th>
                      <th className="py-2 px-3">{lang === 'en' ? 'Product Name' : 'Nama Barang'}</th>
                      <th className="py-2 px-3 text-right w-20">Qty</th>
                      <th className="py-2 px-3 text-right w-28">{lang === 'en' ? 'Purchase Price' : 'Harga Beli'}</th>
                      <th className="py-2 px-3 text-right w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {detailPurchase.purchase_items?.map((item: any, idx: number) => (
                      <tr key={item.id} className="text-slate-700 hover:bg-blue-50/10">
                        <td className="py-1.5 px-3 text-center text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-500">{item.product?.kode}</td>
                        <td className="py-1.5 px-3 font-extrabold text-slate-900">{item.product?.nama}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-800">{Number(item.qty)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-650">{formatCurrency(Number(item.harga_beli))}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-blue-900 font-black">{formatCurrency(Number(item.subtotal))}</td>
                      </tr>
                    ))}
                    {Number(detailPurchase.biaya_pengiriman) !== 0 && (
                      <tr className="text-slate-600 font-semibold bg-slate-50/50">
                        <td colSpan={5} className="py-1.5 px-3 text-right uppercase text-[10px]">
                          {lang === 'en' ? 'Shipping' : 'Pengiriman'}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-800 font-bold">{formatCurrency(Number(detailPurchase.biaya_pengiriman))}</td>
                      </tr>
                    )}
                    <tr className="bg-blue-50/40 font-black border-t border-blue-100">
                      <td colSpan={5} className="py-2 px-3 text-right uppercase text-[10px] text-blue-900">Grand Total</td>
                      <td className="py-2 px-3 text-right font-mono text-blue-955 font-black text-xs">{formatCurrency(Number(detailPurchase.subtotal) + Number(detailPurchase.biaya_pengiriman))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Logs - Compact */}
              <div className="p-3 bg-white border border-blue-100 rounded-xl shadow-sm space-y-2 shrink-0">
                <h4 className="text-[10px] uppercase font-black text-slate-500 border-b border-slate-100 pb-1 mb-1">
                  {lang === 'en' ? 'PO Payment History' : 'Riwayat Pembayaran PO'}
                </h4>
                {detailPurchase.supplier_payments && detailPurchase.supplier_payments.length > 0 ? (
                  <div className="space-y-1.5">
                    {detailPurchase.supplier_payments.map((pay: any) => (
                      <div key={pay.id} className="py-1.5 px-3 bg-blue-50/20 hover:bg-blue-50/40 border border-blue-100/30 rounded-lg flex justify-between items-center transition-all text-[11px]">
                        <div>
                          <p className="font-extrabold text-blue-955">
                            {lang === 'en' ? 'Pay:' : 'Bayar:'} {formatCurrency(Number(pay.amount))}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {lang === 'en' ? 'Note:' : 'Catatan:'} {cleanPaymentNote(pay.note)}
                          </p>
                        </div>
                        <div className="text-right text-[10px] text-slate-400 font-semibold flex items-center gap-2">
                          <span>{formatDate(pay.payment_date)}</span>
                          <span className="font-mono uppercase text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{pay.payment_method}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    {lang === 'en' ? 'No payment history yet for this PO.' : 'Belum ada riwayat pembayaran untuk PO ini.'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-rose-500 font-bold">
              {lang === 'en' ? 'Failed to load details.' : 'Gagal memuat detail data.'}
            </div>
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
          <h1 className="text-2xl font-extrabold text-white">
            {lang === 'en' ? 'Supplier Debt Settlement (AP)' : 'Pelunasan Hutang Supplier (AP)'}
          </h1>
          <p className="text-slate-400 text-sm">
            {lang === 'en'
              ? 'Monitor active credit POs, enter shipping fees, and record global supplier debt payments.'
              : 'Monitoring daftar PO kredit aktif, input biaya pengiriman, dan catat angsuran hutang global.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={openPaymentModal}
            disabled={filteredData.length === 0}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <DollarSign size={14} />
            <span>{lang === 'en' ? 'Pay Multi-PO Debt (F10)' : 'Bayar Hutang Multi-PO (F10)'}</span>
          </button>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 flex flex-col md:flex-row md:items-end gap-4">
        {/* Search */}
        <div className="relative flex-grow">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">
            {lang === 'en' ? 'Search Supplier (F1)' : 'Cari Pemasok (F1)'}
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={lang === 'en' ? 'Supplier name...' : 'Nama pemasok...'}
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
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">
            {lang === 'en' ? 'Filter Status (F3)' : 'Filter Status (F3)'}
          </label>
          <button
            onClick={() => {
              setSelectedFilterOptionIdx(['all', 'overdue', 'lancar'].indexOf(statusFilter));
              setShowFilterModal(true);
            }}
            className="input-field w-full py-2 px-3 text-xs flex items-center justify-between bg-surface-900 border border-surface-750 text-white font-bold cursor-pointer rounded-lg hover:bg-surface-850 transition-colors"
          >
            <span>
              {statusFilter === 'all' && (lang === 'en' ? 'All' : 'Semua')}
              {statusFilter === 'overdue' && 'Overdue'}
              {statusFilter === 'lancar' && (lang === 'en' ? 'Active' : 'Hampir')}
            </span>
            <ChevronDown size={14} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* Supplier List Card Grid */}
      {!searchQuery.trim() ? (
        <div className="card p-16 text-center text-slate-400 border border-surface-700/60 bg-surface-800/20 flex flex-col items-center justify-center gap-3 rounded-xl">
          <div className="p-4 bg-surface-750/50 rounded-full border border-surface-700 shadow-inner">
            <Search size={28} className="text-primary-500/80 animate-pulse" />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-400 font-medium">
            {lang === 'en'
              ? 'Please type a supplier name in the search field to view debt records.'
              : 'Silakan ketik nama supplier pada kolom pencarian untuk menampilkan data hutang.'}
          </p>
        </div>
      ) : !isConfirmed ? (
        <div className="card p-16 text-center text-slate-400 border border-surface-700/60 bg-surface-800/20 flex flex-col items-center justify-center gap-3 rounded-xl">
          <div className="p-4 bg-surface-750/50 rounded-full border border-surface-700 shadow-inner">
            <Search size={28} className="text-amber-500/80 animate-bounce" />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-400 font-medium">
            {lang === 'en' ? (
              <>
                Press <span className="font-extrabold text-blue-600 font-mono">Enter</span> to select supplier and load debt details.
              </>
            ) : (
              <>
                Tekan <span className="font-extrabold text-blue-600 font-mono">Enter</span> untuk memilih supplier dan menampilkan data hutang.
              </>
            )}
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
          {lang === 'en'
            ? 'No active debts found matching search filter.'
            : 'Tidak ada hutang aktif yang ditemukan berdasarkan filter pencarian.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map((group, cIdx) => {
            const supp = group.supplier;
            const isExpanded = !!expandedSupplierIds[supp.id];
            const isSelected = selectedSuppIdx === cIdx && selectedPurchaseIdx === null;

            return (
              <div
                key={supp.id}
                ref={(el) => {
                  supplierRowRefs.current[cIdx] = el;
                }}
                className={`card p-0 overflow-hidden border transition-all ${isSelected ? 'card-hovered border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                  }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => {
                    setSelectedSuppIdx(cIdx);
                    setSelectedPurchaseIdx(null);
                    setExpandedSupplierIds(prev => ({ ...prev, [supp.id]: !prev[supp.id] }));
                  }}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-blue-50/20 bg-transparent`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <div>
                      <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                        <span>{supp.nama}</span>
                        <span className="text-[10px] bg-surface-700 text-slate-400 font-mono font-normal py-0.5 px-2 rounded-full border border-surface-650">
                          {lang === 'en' ? 'Code:' : 'Kode:'} {supp.kode}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {lang === 'en' ? 'Address:' : 'Alamat:'} {supp.alamat || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">
                        {lang === 'en' ? 'Total Remaining Debt' : 'Total Sisa Hutang'}
                      </span>
                      <strong className="text-sm font-black text-rose-500">{formatCurrency(group.total_hutang)}</strong>
                    </div>
                  </div>
                </div>

                {/* Purchases Table (Sub-Grid) */}
                {isExpanded && (
                  <div className="border-t border-surface-750 bg-surface-900/60 p-4">
                    <div className="overflow-x-auto rounded-lg">
                      <table className="w-full text-left text-xs border-collapse no-outer-border">
                        <thead>
                          <tr className="bg-surface-850/80 text-slate-400 font-bold uppercase text-[9px] border-b border-surface-750">
                            <th className="p-2 w-12 text-center">No</th>
                            <th className="p-2 w-32">{lang === 'en' ? 'PO No.' : 'No. PO'}</th>
                            <th className="p-2 w-28">{lang === 'en' ? 'Order Date' : 'Tgl Order'}</th>
                            <th className="p-2 w-28">{lang === 'en' ? 'Due Date' : 'Jatuh Tempo'}</th>
                            <th className="p-2 w-24">Terms</th>
                            <th className="p-2 w-32 text-right">{lang === 'en' ? 'Total PO' : 'Total PO'}</th>
                            <th className="p-2 w-36 text-center">{lang === 'en' ? 'Shipping (F2)' : 'Pengiriman (F2)'}</th>
                            <th className="p-2 w-32 text-right">{lang === 'en' ? 'Paid' : 'Terbayar'}</th>
                            <th className="p-2 w-36 text-right">{lang === 'en' ? 'Remaining Debt' : 'Sisa Hutang'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-750/50">
                          {group.purchases.map((pur, pIdx) => {
                            const isPurSelected = selectedSuppIdx === cIdx && selectedPurchaseIdx === pIdx;
                            const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                              let base = "p-2 font-medium ";
                              if (isPurSelected) {
                                base += "bg-blue-100/90 text-slate-900 border-y border-blue-300 ";
                                if (pos === 'first') base += "border-l rounded-l-lg ";
                                  if (pos === 'last') base += "border-r rounded-r-lg ";
                              } else {
                                base += "border-b border-surface-750/30 ";
                              }
                              return base;
                            };

                            return (
                              <tr
                                key={pur.id}
                                ref={(el) => {
                                  purchaseRowRefs.current[`${cIdx}-${pIdx}`] = el;
                                }}
                                onClick={() => {
                                  setSelectedSuppIdx(cIdx);
                                  setSelectedPurchaseIdx(pIdx);
                                }}
                                className={`hover:bg-surface-750/30 cursor-pointer ${isPurSelected ? 'bg-blue-100' : 'text-slate-300'
                                  }`}
                              >
                                <td className={`${getTdClass('first')} text-center ${isPurSelected ? 'text-primary-950 font-bold' : 'text-slate-500'}`}>
                                  {pIdx + 1}
                                </td>
                                <td className={`${getTdClass('middle')} font-mono font-bold ${isPurSelected ? 'text-primary-955' : 'text-slate-200'}`}>
                                  {pur.no_order}
                                </td>
                                <td className={`${getTdClass('middle')} ${isPurSelected ? 'text-slate-800' : ''}`}>
                                  {formatDate(pur.order_date)}
                                </td>
                                <td className={`${getTdClass('middle')} font-bold ${isPurSelected
                                  ? (pur.is_overdue ? 'text-danger-700' : 'text-slate-750')
                                  : (pur.is_overdue ? 'text-danger-400' : 'text-slate-400')
                                  }`}>
                                  {formatDate(pur.due_date)}
                                </td>
                                <td className={`${getTdClass('middle')} uppercase ${isPurSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                                  {pur.terms === 'tunai' ? 'Tunai' : `Kredit (${pur.terms} Bln)`}
                                </td>
                                <td className={`${getTdClass('middle')} text-right font-mono ${isPurSelected ? 'text-slate-800' : ''}`}>
                                  {formatCurrency(Number(pur.subtotal) + Number(pur.biaya_pengiriman))}
                                </td>
                                <td className={`${getTdClass('middle')} text-center`} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    id={`input-pengiriman-${pur.id}`}
                                    key={`${pur.id}-${pur.biaya_pengiriman}`}
                                    type="text"
                                    defaultValue={formatRupiahInput(Number(pur.biaya_pengiriman))}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const val = parseRupiahInput(e.target.value);
                                      e.target.value = formatRupiahInput(val);
                                    }}
                                    onBlur={(e) => {
                                      const val = parseRupiahInput(e.target.value);
                                      if (val !== Number(pur.biaya_pengiriman)) {
                                        handleUpdateOngkir(pur.id, val);
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
                                        if (val !== Number(pur.biaya_pengiriman)) {
                                          handleUpdateOngkir(pur.id, val);
                                        }
                                        (e.target as HTMLInputElement).blur();
                                        // Move highlighting and focus to the next row
                                        const currentGroup = filteredData[selectedSuppIdx];
                                        if (currentGroup && selectedPurchaseIdx !== null && selectedPurchaseIdx < currentGroup.purchases.length - 1) {
                                          const nextIdx = selectedPurchaseIdx + 1;
                                          setSelectedPurchaseIdx(nextIdx);
                                          const nextPur = currentGroup.purchases[nextIdx];
                                          setTimeout(() => {
                                            const nextInput = document.getElementById(`input-pengiriman-${nextPur.id}`) as HTMLInputElement;
                                            if (nextInput) {
                                              nextInput.focus();
                                              nextInput.select();
                                            }
                                          }, 50);
                                        }
                                      }
                                    }}
                                    className={`input-field py-1 px-2 text-right text-xs font-mono w-28 text-white font-bold focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all ${isPurSelected ? 'bg-primary-955/80 border-primary-600' : 'bg-surface-900 border-primary-500/40'
                                      }`}
                                  />
                                </td>
                                <td className={`${getTdClass('middle')} text-right font-mono font-bold ${isPurSelected ? 'text-primary-950' : 'text-white'}`}>
                                  {formatCurrency(pur.paid_amount)}
                                </td>
                                <td className={`${getTdClass('last')} text-right font-mono font-extrabold ${isPurSelected ? 'text-rose-900' : 'text-rose-400'}`}>
                                  {formatCurrency(pur.remaining)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="pt-2 text-[10px] text-slate-500 flex justify-between">
                      <span>
                        {lang === 'en' ? (
                          <>Press <kbd className="shortcut-badge">F4</kbd> view PO items <kbd className="shortcut-badge">F10</kbd> record payment</>
                        ) : (
                          <>Tekan <kbd className="shortcut-badge">F4</kbd> lihat item PO <kbd className="shortcut-badge">F10</kbd> catat pelunasan</>
                        )}
                      </span>
                      <span>
                        {lang === 'en' ? (
                          <>Use arrows <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> to navigate</>
                        ) : (
                          <>Gunakan panah <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk navigasi</>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Status Modal (F3) */}
      {showFilterModal && (
        <ModalPortal>
          <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in modal-overlay">
          <div
            ref={filterModalRef}
            tabIndex={0}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in space-y-4 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setShowFilterModal(false);
              }
            }}
          >
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 shrink-0">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>
                  {lang === 'en' ? 'Filter Debt Status (F3)' : 'Filter Status Piutang (F3)'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { label: lang === 'en' ? 'All Debt Statuses' : 'Semua Status Hutang', color: 'bg-slate-400' },
                { label: lang === 'en' ? 'Overdue Only' : 'Hanya Jatuh Tempo (Overdue)', color: 'bg-rose-500' },
                { label: lang === 'en' ? 'Near Due / Active' : 'Hampir Jatuh Tempo (Lancar)', color: 'bg-emerald-500' }
              ].map((opt, idx) => {
                const isSelected = idx === selectedFilterOptionIdx;
                const options: ('all' | 'overdue' | 'lancar')[] = ['all', 'overdue', 'lancar'];
                const isCurrent = statusFilter === options[idx];

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setStatusFilter(options[idx]);
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
                      <span className="text-[10px] text-primary-500 font-normal italic">
                        {lang === 'en' ? 'Active' : 'Aktif'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 text-[10px] text-slate-500 flex justify-between">
              <span>
                {lang === 'en' ? (
                  <>Use <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> to select</>
                ) : (
                  <>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</>
                )}
              </span>
              <span>
                {lang === 'en' ? (
                  <><kbd className="shortcut-badge">Enter</kbd> select | <kbd className="shortcut-badge">Esc</kbd> close</>
                ) : (
                  <><kbd className="shortcut-badge">Enter</kbd> pilih | <kbd className="shortcut-badge">Esc</kbd> tutup</>
                )}
              </span>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Customer Selection Search Popup Modal */}
      {showSearchPopup && (
        <ModalPortal>
          <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in modal-overlay">
          <div
            ref={searchPopupRef}
            tabIndex={0}
            onKeyDown={handleSearchPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col text-slate-200"
          >
            <div className="flex justify-between items-center w-full border-b border-surface-700 pb-3 shrink-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>
                  {lang === 'en' ? 'Select Supplier' : 'Pilih Pemasok (Supplier)'}
                </span>
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
                  {lang === 'en' ? 'Loading supplier data...' : 'Memuat data pelanggan...'}
                </div>
              ) : filteredData.length === 0 ? (
                <div className="py-8 text-center text-slate-500 italic text-xs">
                  {lang === 'en'
                    ? `No suppliers match search query "${searchQuery}".`
                    : `Tidak ada pelanggan yang cocok dengan pencarian "${searchQuery}".`}
                </div>
              ) : (
                filteredData.map((group, idx) => (
                  <button
                    type="button"
                    key={group.supplier.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onClick={() => {
                      setSelectedSuppIdx(idx);
                      setSelectedPurchaseIdx(null);
                      setExpandedSupplierIds({});
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
                      <p className="font-semibold text-slate-850">{group.supplier.nama}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {lang === 'en' ? 'Address:' : 'Alamat:'} {group.supplier.alamat || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">
                        {lang === 'en' ? 'Code:' : 'Kode:'} {group.supplier.kode}
                      </span>
                      <span className="text-[11px] font-bold text-rose-400 block mt-0.5">
                        {lang === 'en' ? 'Debt:' : 'Hutang:'} {formatCurrency(group.total_hutang)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-surface-700 flex justify-between text-[10px] text-slate-500 shrink-0">
              <span>
                {lang === 'en' ? (
                  <>Use <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> to select</>
                ) : (
                  <>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</>
                )}
              </span>
              <span>
                {lang === 'en' ? (
                  <><kbd className="shortcut-badge">Enter</kbd> select | <kbd className="shortcut-badge">Esc</kbd> close</>
                ) : (
                  <><kbd className="shortcut-badge">Enter</kbd> pilih | <kbd className="shortcut-badge">Esc</kbd> tutup</>
                )}
              </span>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Global Supplier Payment Modal (F10) */}
      {showPaymentModal && filteredData[selectedSuppIdx] && (
        <ModalPortal>
          <div className="absolute inset-0 z-[9999] flex flex-col md:flex-row items-center justify-center gap-4 p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in modal-overlay">
          <form
            onSubmit={(e) => { e.preventDefault(); savePayment(); }}
            className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign size={18} />
                <span>
                  {lang === 'en' ? 'Record Supplier Debt Settlement' : 'Catat Pelunasan Hutang Supplier'}
                </span>
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
              {/* Supplier Info */}
              <div className="p-3 bg-blue-50/50 border border-blue-100/60 rounded-lg text-xs space-y-1 shrink-0">
                <p className="text-slate-655">Supplier: <strong className="text-slate-900">{filteredData[selectedSuppIdx].supplier.nama} ({filteredData[selectedSuppIdx].supplier.kode})</strong></p>
                <p className="text-slate-655">
                  {lang === 'en' ? 'Total Remaining Debt:' : 'Total Sisa Hutang:'} <strong className="text-rose-600 font-bold">{formatCurrency(filteredData[selectedSuppIdx].total_hutang)}</strong>
                </p>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-655 mb-1">
                  {lang === 'en' ? 'Payment Mode' : 'Mode Pembayaran'}
                </label>
                <div className="flex gap-2">
                  <button
                    ref={paymentModeFifoRef}
                    type="button"
                    onClick={() => setPaymentMode('fifo')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') { e.preventDefault(); paymentModeManualRef.current?.focus(); setPaymentMode('manual'); }
                      else if (e.key === 'Enter') { e.preventDefault(); paymentDateRef.current?.focus(); }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${paymentMode === 'fifo' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'}`}
                  >
                    {lang === 'en' ? 'Automatic FIFO (Oldest PO)' : 'FIFO Otomatis (PO Terlama)'}
                  </button>
                  <button
                    ref={paymentModeManualRef}
                    type="button"
                    onClick={() => setPaymentMode('manual')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') { e.preventDefault(); paymentModeFifoRef.current?.focus(); setPaymentMode('fifo'); }
                      else if (e.key === 'Enter') { e.preventDefault(); paymentDateRef.current?.focus(); }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${paymentMode === 'manual' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'}`}
                  >
                    {lang === 'en' ? 'Manual Selection Per PO' : 'Pilihan Manual Per PO'}
                  </button>
                </div>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-655 mb-1">
                  {lang === 'en' ? 'Settlement Date' : 'Tanggal Pelunasan'}
                </label>
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
                        const currentGroup = filteredData[selectedSuppIdx];
                        if (currentGroup && currentGroup.purchases.length > 0) {
                          const firstPur = currentGroup.purchases[0];
                          setTimeout(() => {
                            const firstInput = document.getElementById(`modal-manual-input-${firstPur.id}`) as HTMLInputElement;
                            firstInput?.focus(); firstInput?.select();
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
                  <label className="block text-xs font-semibold text-slate-655 mb-1">
                    {lang === 'en' ? 'Settlement Amount (Rp)' : 'Nominal Pelunasan (Rp)'}
                  </label>
                  <input
                    ref={paymentAmountRef}
                    type="text"
                    value={formatRupiahInput(paymentAmount)}
                    onChange={(e) => setPaymentAmount(e.target.value ? parseRupiahInput(e.target.value) : '')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const limit = filteredData[selectedSuppIdx]?.total_hutang || 0;
                        if (Number(paymentAmount) > Number(limit)) {
                          showToast(
                            lang === 'en'
                              ? 'Settlement amount exceeds total active debt!'
                              : 'Nominal pelunasan melebihi total hutang aktif!',
                            'error'
                          );
                          return;
                        }
                        paymentMethodCashRef.current?.focus();
                      }
                    }}
                    required
                    placeholder={lang === 'en' ? 'Enter settlement amount...' : 'Masukkan nominal pelunasan...'}
                    className="input-field w-full py-2 text-xs font-mono text-right bg-slate-50 border border-slate-250 text-emerald-600 font-bold focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  />
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-655 mb-1">
                  {lang === 'en' ? 'Payment Method' : 'Metode Pembayaran'}
                </label>
                <div className="flex gap-2">
                  <button
                    ref={paymentMethodCashRef}
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') { e.preventDefault(); paymentMethodTransferRef.current?.focus(); setPaymentMethod('transfer'); }
                      else if (e.key === 'Enter') { e.preventDefault(); paymentNoteRef.current?.focus(); }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${paymentMethod === 'cash' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'}`}
                  >
                    {lang === 'en' ? 'Cash' : 'Tunai / Cash'}
                  </button>
                  <button
                    ref={paymentMethodTransferRef}
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') { e.preventDefault(); paymentMethodCashRef.current?.focus(); setPaymentMethod('cash'); }
                      else if (e.key === 'Enter') { e.preventDefault(); paymentNoteRef.current?.focus(); }
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${paymentMethod === 'transfer' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 border-slate-250 text-slate-500 hover:bg-slate-100'}`}
                  >
                    {lang === 'en' ? 'Bank Transfer' : 'Transfer Bank'}
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-655 mb-1">
                  {lang === 'en' ? 'Payment Note' : 'Catatan Pembayaran'}
                </label>
                <textarea
                  ref={paymentNoteRef}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); savePayment(); } }}
                  rows={2}
                  placeholder={
                    lang === 'en'
                      ? 'Bank transfer details, reference no, etc... (Optional)'
                      : 'Keterangan transfer bank, no referensi, dll... (Opsional)'
                  }
                  className="input-field w-full py-1.5 text-xs resize-none bg-slate-50 border border-slate-250 text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end items-center text-xs shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary py-1.5 px-3 text-xs font-bold rounded-lg cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-350 text-slate-800 whitespace-nowrap"
                >
                  {lang === 'en' ? 'Cancel (Esc)' : 'Batal (Esc)'}
                </button>
                <button
                  type="submit"
                  className="btn-primary py-1.5 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  {lang === 'en' ? 'Save Settlement' : 'Simpan Pelunasan'}
                </button>
              </div>
            </div>
          </form>

          {/* FIFO Distribution Preview Side-Panel */}
          {paymentMode === 'fifo' && Number(paymentAmount) > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl w-full md:w-80 shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden shrink-0">
              <div className="bg-blue-600 px-5 py-4 flex items-center gap-2 text-white shrink-0">
                <FileText size={18} />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'en' ? 'Distribution Preview (FIFO)' : 'Preview Distribusi (FIFO)'}
                </h4>
              </div>
              <div className="p-4 overflow-y-auto space-y-2 text-xs flex-1 bg-slate-50/30">
                <div className="space-y-2 text-[11px]">
                  {fifoAllocations.map((alloc) => (
                    <div key={alloc.id} className="flex flex-col p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1">
                      <div className="flex justify-between font-mono font-bold text-slate-800">
                        <span>{alloc.no_faktur || alloc.no_order}</span>
                        {alloc.remainingAfter === 0 ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                            {lang === 'en' ? 'Paid ✓' : 'Lunas ✓'}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                            {lang === 'en' ? 'Partial' : 'Sebagian'}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>{lang === 'en' ? 'Initial Debt:' : 'Hutang Awal:'}</span>
                        <span>{formatCurrency(alloc.remaining)}</span>
                      </div>
                      <div className="flex justify-between border-t border-dashed border-slate-200 pt-1 font-semibold text-emerald-600">
                        <span>{lang === 'en' ? 'Pay:' : 'Bayar:'}</span>
                        <span>{formatCurrency(alloc.allocated)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Manual Mode Purchases Table Side-Panel */}
          {paymentMode === 'manual' && (
            <div className="bg-white border border-slate-200 rounded-xl w-full md:w-96 shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden shrink-0">
              <div className="bg-blue-600 px-5 py-4 flex items-center gap-2 text-white shrink-0">
                <FileText size={18} />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'en' ? 'Enter Settlement Per PO' : 'Input Pelunasan Per PO'}
                </h4>
              </div>
              <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/30">
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto bg-white shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr className="text-slate-500 text-[10px] font-bold uppercase">
                        <th className="p-2">{lang === 'en' ? 'PO No.' : 'No. PO'}</th>
                        <th className="p-2 text-right">{lang === 'en' ? 'Remaining Debt' : 'Sisa Hutang'}</th>
                        <th className="p-2 text-center w-36">{lang === 'en' ? 'Pay Amount' : 'Nominal Bayar'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData[selectedSuppIdx].purchases.map((pur, idx, purchases) => (
                        <tr key={pur.id} className="hover:bg-slate-50/50">
                          <td className="p-2 font-mono text-slate-700">{pur.no_order}</td>
                          <td className="p-2 text-right font-mono text-rose-600">{formatCurrency(pur.remaining)}</td>
                          <td className="p-1.5 text-center">
                            <input
                              id={`modal-manual-input-${pur.id}`}
                              type="text"
                              value={formatRupiahInput(manualAmounts[pur.id] || 0)}
                              onFocus={(e) => {
                                e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                              }}
                              onChange={(e) => {
                                const val = parseRupiahInput(e.target.value);
                                setManualAmounts(prev => ({ ...prev, [pur.id]: val }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (idx < purchases.length - 1) {
                                    const nextPur = purchases[idx + 1];
                                    const nextInput = document.getElementById(`modal-manual-input-${nextPur.id}`) as HTMLInputElement;
                                    nextInput?.focus(); nextInput?.select();
                                  } else { paymentMethodCashRef.current?.focus(); }
                                } else if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  if (idx < purchases.length - 1) {
                                    const nextPur = purchases[idx + 1];
                                    const nextInput = document.getElementById(`modal-manual-input-${nextPur.id}`) as HTMLInputElement;
                                    nextInput?.focus(); nextInput?.select();
                                  }
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  if (idx > 0) {
                                    const prevPur = purchases[idx - 1];
                                    const prevInput = document.getElementById(`modal-manual-input-${prevPur.id}`) as HTMLInputElement;
                                    prevInput?.focus(); prevInput?.select();
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
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Total Pelunasan Manual</span>
                  <strong className="text-emerald-600 text-sm font-black">{formatCurrency(manualTotal)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
        </ModalPortal>
      )}

      {toast && (
        <ModalPortal>
          <div className={`fixed bottom-4 right-4 z-[100000] px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in bg-white border ${
            toast.type === 'success' ? 'border-blue-600 text-blue-600' : 'border-danger-600 text-danger-600'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} className="text-blue-600" /> : <AlertTriangle size={16} className="text-danger-600" />}
            <span className={`text-xs font-bold ${toast.type === 'success' ? 'text-blue-600' : 'text-danger-600'}`}>
              {toast.message}
            </span>
          </div>
        </ModalPortal>
      )}

      {/* Global CSS style overrides for table borders */}
      <style>{`
        main table.no-outer-border {
          border: none !important;
        }
      `}</style>
    </div>
  );
};
