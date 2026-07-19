import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatExtraChargeDesc } from '@/lib/utils';
import {
  Search,
  ChevronRight,
  FileText,
  User,
  Calendar,
  Check,
  ChevronDown
} from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  no_telp: string | null;
}

interface SaleItem {
  id: string;
  product_kode: string;
  product_nama: string;
  qty: number;
  unit_price: number;
  total: number;
}

interface SalesPayment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  note: string | null;
}

interface InvoiceDetail {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  due_date: string | null;
  subtotal: number;
  biaya_pengiriman: number;
  extra_charge_amount: number;
  extra_charge_desc: string | null;
  paid_amount: number;
  remaining: number;
  limit_bulan: number;
  nota_merah: boolean;
  nota_putih: boolean;
  nota_kuning: boolean;
  sender_note: string | null;
  sale_items: SaleItem[];
  sales_payments: SalesPayment[];
  is_cash: boolean;
}

interface CustomerLunasGroup {
  customer: Customer;
  invoices: InvoiceDetail[];
}

const getStoredState = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const PelangganLunas: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<CustomerLunasGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<CustomerLunasGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState(() => getStoredState('lunas_searchQuery', ''));
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selection state
  const [selectedCustIdx, setSelectedCustIdx] = useState<number>(() => getStoredState('lunas_selectedCustIdx', 0));
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(() => getStoredState('lunas_expandedInvoiceId', null));

  const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      firstDay: formatDateStr(firstDay),
      today: formatDateStr(now)
    };
  };

  const defaults = getDefaultDates();
  const [fromDate, setFromDate] = useState(() => getStoredState('lunas_fromDate', defaults.firstDay));
  const [toDate, setToDate] = useState(() => getStoredState('lunas_toDate', defaults.today));
  const [tempSearchQuery, setTempSearchQuery] = useState(() => getStoredState('lunas_tempSearchQuery', ''));
  const [showPopup, setShowPopup] = useState(() => getStoredState('lunas_showPopup', true));

  const [focusedPanel, setFocusedPanel] = useState<'customer-list' | 'invoice-list'>(() => getStoredState('lunas_focusedPanel', 'customer-list'));
  const [selectedInvoiceIdx, setSelectedInvoiceIdx] = useState<number | null>(() => getStoredState('lunas_selectedInvoiceIdx', null));

  const fromDatePopupRef = useRef<HTMLInputElement>(null);
  const toDatePopupRef = useRef<HTMLInputElement>(null);
  const nameFilterPopupRef = useRef<HTMLInputElement>(null);

  const customerContainerRef = useRef<HTMLDivElement>(null);
  const customerRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const invoiceRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (focusedPanel === 'customer-list' && customerContainerRef.current && customerRowRefs.current[selectedCustIdx]) {
      const container = customerContainerRef.current;
      const activeEl = customerRowRefs.current[selectedCustIdx];
      if (activeEl) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();

        if (activeRect.top < containerRect.top) {
          container.scrollTop -= (containerRect.top - activeRect.top + 8);
        } else if (activeRect.bottom > containerRect.bottom) {
          container.scrollTop += (activeRect.bottom - containerRect.bottom + 8);
        }
      }
    }
  }, [selectedCustIdx, focusedPanel]);

  useEffect(() => {
    if (focusedPanel === 'invoice-list' && selectedInvoiceIdx !== null && invoiceRowRefs.current[selectedInvoiceIdx]) {
      const activeEl = invoiceRowRefs.current[selectedInvoiceIdx];
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
      }
    }
  }, [selectedInvoiceIdx, focusedPanel]);

  useEffect(() => {
    localStorage.setItem('lunas_searchQuery', JSON.stringify(searchQuery));
    localStorage.setItem('lunas_selectedCustIdx', JSON.stringify(selectedCustIdx));
    localStorage.setItem('lunas_expandedInvoiceId', JSON.stringify(expandedInvoiceId));
    localStorage.setItem('lunas_fromDate', JSON.stringify(fromDate));
    localStorage.setItem('lunas_toDate', JSON.stringify(toDate));
    localStorage.setItem('lunas_tempSearchQuery', JSON.stringify(tempSearchQuery));
    localStorage.setItem('lunas_showPopup', JSON.stringify(showPopup));
    localStorage.setItem('lunas_focusedPanel', JSON.stringify(focusedPanel));
    localStorage.setItem('lunas_selectedInvoiceIdx', JSON.stringify(selectedInvoiceIdx));
  }, [
    searchQuery, selectedCustIdx, expandedInvoiceId, fromDate, toDate,
    tempSearchQuery, showPopup, focusedPanel, selectedInvoiceIdx
  ]);

  const fetchLunasData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/payments/lunas?q=${tempSearchQuery}`);
      const rawData = res.data || [];

      const getLatestGroupPaymentDate = (g: any) => {
        let maxTime = 0;
        g.invoices.forEach((inv: any) => {
          inv.sales_payments.forEach((p: any) => {
            const t = new Date(p.payment_date).getTime();
            if (t > maxTime) maxTime = t;
          });
        });
        return maxTime;
      };

      const sortedGroups = rawData.map((group: any) => {
        const filteredInvoices = group.invoices.filter((inv: any) => {
          const latestPaymentTime = inv.sales_payments.length > 0
            ? Math.max(...inv.sales_payments.map((p: any) => new Date(p.payment_date).getTime()))
            : new Date(inv.order_date).getTime();
          
          const fromTime = new Date(fromDate + 'T00:00:00').getTime();
          const toTime = new Date(toDate + 'T23:59:59').getTime();
          
          return latestPaymentTime >= fromTime && latestPaymentTime <= toTime;
        });

        const sortedInvoices = [...filteredInvoices].sort((a: any, b: any) => {
          const latestA = a.sales_payments.length > 0
            ? Math.max(...a.sales_payments.map((p: any) => new Date(p.payment_date).getTime()))
            : new Date(a.order_date).getTime();
          const latestB = b.sales_payments.length > 0
            ? Math.max(...b.sales_payments.map((p: any) => new Date(p.payment_date).getTime()))
            : new Date(b.order_date).getTime();

          if (latestA !== latestB) {
            return latestB - latestA; // newest first
          }
          return b.no_order.localeCompare(a.no_order, undefined, { numeric: true, sensitivity: 'base' });
        });
        return { ...group, invoices: sortedInvoices };
      })
      .filter((g: any) => g.invoices.length > 0)
      .sort((a: any, b: any) => {
        return getLatestGroupPaymentDate(b) - getLatestGroupPaymentDate(a); // newest first
      });

      setGroups(sortedGroups);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopupSubmit = () => {
    setSearchQuery(tempSearchQuery);
    setShowPopup(false);
    setFocusedPanel('customer-list');
    setSelectedCustIdx(0);
    setSelectedInvoiceIdx(null);
    setExpandedInvoiceId(null);
    fetchLunasData();
  };

  useEffect(() => {
    if (showPopup) {
      setTimeout(() => {
        fromDatePopupRef.current?.focus();
        fromDatePopupRef.current?.select();
      }, 50);
    }
  }, [showPopup]);

  // Filter groups client-side
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = groups.filter((g) => {
      const custName = g.customer.nama.toLowerCase();
      const custCode = g.customer.kode.toLowerCase();
      const matchesInvoices = g.invoices.some(
        (inv) =>
          (inv.no_faktur || '').toLowerCase().includes(q) ||
          inv.no_order.toLowerCase().includes(q)
      );
      return custName.includes(q) || custCode.includes(q) || matchesInvoices;
    });

    setFilteredGroups(filtered);
    setSelectedCustIdx(0);
    setExpandedInvoiceId(null);
  }, [groups, searchQuery]);

  // Global keydown event handler for main page keyboard navigation
  useEffect(() => {
    if (showPopup) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.preventDefault();
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (e.key.toLowerCase() === 'f1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (focusedPanel === 'customer-list') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (selectedCustIdx > 0) {
            setSelectedCustIdx(selectedCustIdx - 1);
            setExpandedInvoiceId(null);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (selectedCustIdx < filteredGroups.length - 1) {
            setSelectedCustIdx(selectedCustIdx + 1);
            setExpandedInvoiceId(null);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const activeGrp = filteredGroups[selectedCustIdx];
          if (activeGrp && activeGrp.invoices.length > 0) {
            setFocusedPanel('invoice-list');
            setSelectedInvoiceIdx(0);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowPopup(true);
        }
      } else if (focusedPanel === 'invoice-list') {
        const activeGrp = filteredGroups[selectedCustIdx];
        if (!activeGrp) return;

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (selectedInvoiceIdx !== null && selectedInvoiceIdx > 0) {
            setSelectedInvoiceIdx(selectedInvoiceIdx - 1);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (selectedInvoiceIdx !== null && selectedInvoiceIdx < activeGrp.invoices.length - 1) {
            setSelectedInvoiceIdx(selectedInvoiceIdx + 1);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedInvoiceIdx !== null) {
            const invoice = activeGrp.invoices[selectedInvoiceIdx];
            if (invoice) {
              setExpandedInvoiceId(prev => prev === invoice.id ? null : invoice.id);
            }
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (expandedInvoiceId !== null) {
            setExpandedInvoiceId(null);
          } else {
            setFocusedPanel('customer-list');
            setSelectedInvoiceIdx(null);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPopup, focusedPanel, selectedCustIdx, selectedInvoiceIdx, expandedInvoiceId, filteredGroups]);

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

  const cleanPaymentNote = (note: string | null | undefined): string => {
    if (!note) return '-';
    let cleaned = note.replace(/\[Session ID:\s*[^\]]+\]/gi, '');
    cleaned = cleaned.replace(/Sesi Penagihan:\s*/gi, '');
    cleaned = cleaned.replace(/Sesi Pembayaran AP:\s*/gi, '');
    cleaned = cleaned.trim();
    if (!cleaned || cleaned === '-') return '-';
    return cleaned;
  };

  const activeGroup = filteredGroups[selectedCustIdx] || null;

  if (showPopup) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-800">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Pelanggan Lunas & Rincian Nota</h1>
            <p className="text-slate-500 text-sm">Daftar pelanggan yang telah menyelesaikan kewajiban pembayarannya (lunas) beserta detail nota penjualan.</p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-primary-600 text-white px-6 py-4 text-center border-b border-primary-700/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Filter Pencarian Nota Lunas</h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePopupSubmit();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Tanggal Awal</label>
                  <input
                    ref={fromDatePopupRef}
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        toDatePopupRef.current?.focus();
                        toDatePopupRef.current?.select();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        navigate('/penagihan');
                      }
                    }}
                    className="input-field w-full py-2 text-xs text-slate-850 border border-slate-200 rounded-lg bg-white font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Tanggal Akhir</label>
                  <input
                    ref={toDatePopupRef}
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        nameFilterPopupRef.current?.focus();
                        nameFilterPopupRef.current?.select();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        navigate('/penagihan');
                      }
                    }}
                    className="input-field w-full py-2 text-xs text-slate-850 border border-slate-200 rounded-lg bg-white font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">
                  Nama Customer (Opsional)
                </label>
                <input
                  ref={nameFilterPopupRef}
                  type="text"
                  placeholder="Semua / Ketik Nama"
                  value={tempSearchQuery}
                  onChange={(e) => setTempSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePopupSubmit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      navigate('/penagihan');
                    }
                  }}
                  className="input-field w-full py-2 text-xs text-slate-850 border border-slate-200 rounded-lg bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 font-bold">
                <button
                  type="button"
                  onClick={() => navigate('/penagihan')}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs hover:bg-slate-50 transition-all cursor-pointer font-bold"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-550 text-white text-xs rounded-lg transition-all shadow-md shadow-primary-500/10 cursor-pointer font-bold"
                >
                  Tampilkan (Enter)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Pelanggan Lunas & Rincian Nota</h1>
          <p className="text-slate-500 text-sm">Daftar pelanggan yang telah menyelesaikan kewajiban pembayarannya (lunas) beserta detail nota penjualan.</p>
        </div>
        <button
          onClick={() => navigate('/penagihan')}
          className="btn btn-secondary self-start md:self-auto flex items-center gap-2"
        >
          Kembali (Esc)
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row items-center gap-4 bg-white border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Cari nama pelanggan, kode, atau no order... (F1)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field w-full pl-10"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shrink-0">
          <Calendar size={14} className="text-slate-400" />
          <span>Periode:</span>
          <span className="text-slate-800 font-mono font-black">{formatDate(fromDate)}</span>
          <span className="text-slate-400 font-normal">s/d</span>
          <span className="text-slate-800 font-mono font-black">{formatDate(toDate)}</span>
        </div>
      </div>

      {/* Main Split Panel Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[500px]">
          <div className="lg:col-span-1 skeleton rounded-xl" />
          <div className="lg:col-span-3 skeleton rounded-xl" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <FileText className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-lg font-bold">Tidak ada data pelanggan lunas</p>
          <p className="text-sm">Tidak ditemukan data yang cocok dengan kriteria pencarian Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

          {/* Panel Kiri: Daftar Customer */}
          <div
            ref={customerContainerRef}
            className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-1 animate-slide-left"
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Daftar Pelanggan ({filteredGroups.length})</h2>
            </div>
            {filteredGroups.map((group, idx) => {
              const isSelected = idx === selectedCustIdx;
              const isFocused = isSelected && (focusedPanel === 'customer-list');
              const totalAmountPaid = group.invoices.reduce((sum, inv) => sum + (Number(inv.subtotal) + Number(inv.biaya_pengiriman || 0)), 0);
              return (
                <button
                  ref={el => { customerRowRefs.current[idx] = el; }}
                  key={group.customer.id}
                  onClick={() => {
                    setSelectedCustIdx(idx);
                    setExpandedInvoiceId(null);
                    setFocusedPanel('customer-list');
                    setSelectedInvoiceIdx(null);
                  }}
                  className={`w-full text-left card p-4 border transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer ${
                    isFocused
                      ? 'border-blue-600 ring-2 ring-blue-500 bg-blue-50/10 shadow-md scale-[1.01]'
                      : isSelected
                      ? 'border-slate-350 bg-slate-100/50'
                      : 'border-slate-200 bg-white'
                    }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 block">
                      {group.customer.kode}
                    </span>
                    <h3 className="font-bold text-slate-800 text-base leading-tight flex items-center gap-2">
                      {isFocused && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full inline-block animate-pulse shrink-0" />
                      )}
                      <span>{group.customer.nama}</span>
                    </h3>
                    <p className="text-xs text-emerald-600 font-semibold">
                      Total Lunas: {formatCurrency(totalAmountPaid)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full font-bold">
                      {group.invoices.length} Nota
                    </span>
                    <ChevronRight size={16} className={isSelected ? 'text-primary-600' : 'text-slate-400'} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Panel Kanan: Rincian Nota Lunas */}
          <div className="lg:col-span-3 space-y-4 animate-slide-right">
            {activeGroup && (
              <>
                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                    <div className="p-3 bg-primary-50 text-primary-600 rounded-xl">
                      <User size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{activeGroup.customer.nama}</h2>
                      <p className="text-sm text-slate-500">Kode: {activeGroup.customer.kode} | Alamat: {activeGroup.customer.alamat || '-'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-700">Daftar Nota Lunas</h3>
                    </div>
                    <div className="space-y-3">
                      {activeGroup.invoices.map((invoice, idx) => {
                        const grandTotal = Number(invoice.subtotal) + Number(invoice.biaya_pengiriman || 0);
                        const isExpanded = expandedInvoiceId === invoice.id;
                        const isInvoiceSelected = idx === selectedInvoiceIdx;
                        const isInvoiceFocused = isInvoiceSelected && (focusedPanel === 'invoice-list');
                        return (
                          <div
                            ref={el => { invoiceRowRefs.current[idx] = el; }}
                            key={invoice.id}
                            className={`border rounded-xl bg-white overflow-hidden shadow-sm transition-all ${
                              isInvoiceFocused
                                ? 'border-primary-500 ring-2 ring-primary-500/30 scale-[1.005]'
                                : isInvoiceSelected
                                ? 'border-slate-350 bg-slate-50/60'
                                : 'border-slate-200'
                            }`}
                          >
                            {/* Invoice Header Bar */}
                            <div
                              onClick={() => {
                                setFocusedPanel('invoice-list');
                                setSelectedInvoiceIdx(idx);
                                setExpandedInvoiceId(isExpanded ? null : invoice.id);
                              }}
                              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-bold text-blue-600">
                                    {invoice.no_order}
                                  </span>
                                  {invoice.is_cash ? (
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                      Cash
                                    </span>
                                  ) : (
                                    <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                      Kredit ({invoice.limit_bulan} Bln)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                  <Calendar size={12} />
                                  <span>Tgl Order: {formatDate(invoice.order_date)}</span>
                                  {invoice.due_date && (
                                    <>
                                      <span>•</span>
                                      <span>Jatuh Tempo: {formatDate(invoice.due_date)}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between md:justify-end gap-6">
                                <div className="text-right">
                                  <span className="text-xs text-slate-500 block">Total Nilai Nota</span>
                                  <span className="font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
                                </div>

                                {/* Physical Nota Checks */}
                                <div className="flex gap-2">
                                  <div
                                    title="Nota Merah (Finance)"
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${invoice.nota_merah ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-400'
                                      }`}
                                  >
                                    M
                                  </div>
                                  <div
                                    title="Nota Kuning (Gudang)"
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${invoice.nota_kuning ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400'
                                      }`}
                                  >
                                    K
                                  </div>
                                </div>

                                <ChevronDown
                                  size={18}
                                  className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                                    }`}
                                />
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">

                                {/* Items Table */}
                                <div className="space-y-2">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Rincian Barang</h4>
                                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-600 text-left border-b border-slate-200">
                                          <th className="p-2 pl-3">Barang</th>
                                          <th className="p-2 text-center">Qty</th>
                                          <th className="p-2 text-right">Harga Satuan</th>
                                          <th className="p-2 text-right pr-3">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {invoice.sale_items.map((item) => (
                                          <tr key={item.id} className="border-b border-slate-100 text-slate-700 bg-white">
                                            <td className="p-2 pl-3">
                                              <span className="font-semibold block">{item.product_nama}</span>
                                              <span className="text-xs text-slate-500 font-mono">{item.product_kode}</span>
                                            </td>
                                            <td className="p-2 text-center font-mono">{item.qty}</td>
                                            <td className="p-2 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                                            <td className="p-2 text-right font-mono pr-3 font-bold text-slate-900">{formatCurrency(item.total)}</td>
                                          </tr>
                                        ))}
                                        {invoice.biaya_pengiriman > 0 && (
                                          <tr className="border-b border-slate-100 text-slate-700 bg-white">
                                            <td className="p-2 pl-3 font-semibold text-slate-500" colSpan={3}>Biaya Pengiriman</td>
                                            <td className="p-2 text-right font-mono pr-3 font-bold text-slate-900">{formatCurrency(invoice.biaya_pengiriman)}</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Payments list */}
                                {invoice.sales_payments.length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Histori Pembayaran Cicilan</h4>
                                    <div className="space-y-2">
                                      {invoice.sales_payments.map((pmt) => (
                                        <div
                                          key={pmt.id}
                                          className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                                        >
                                          <div className="space-y-0.5">
                                            <div className="font-semibold text-slate-900">
                                              Setoran: {formatCurrency(pmt.amount)}
                                            </div>
                                            <div className="text-slate-500">
                                              Tgl: {formatDate(pmt.payment_date)} | Metode: <span className="uppercase font-semibold">{pmt.payment_method}</span>
                                            </div>
                                            <div className="text-slate-500 italic mt-0.5">
                                              Catatan Pelunasan: {cleanPaymentNote(pmt.note)}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                                            <Check size={12} />
                                            <span>Selesai</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Notes & metadata */}
                                <div className="pt-3 text-xs space-y-1 text-slate-600 border-t border-slate-200/60 mt-3">
                                  {invoice.sender_note && (
                                    <div className="flex gap-1.5">
                                      <span className="font-bold text-slate-500">Keterangan:</span>
                                      <span className="italic">{invoice.sender_note}</span>
                                    </div>
                                  )}
                                  {invoice.extra_charge_desc && (
                                    <div className="flex gap-1.5">
                                      <span className="font-bold text-slate-500">Biaya Tambahan ({formatCurrency(invoice.extra_charge_amount)}):</span>
                                      <span className="italic">{formatExtraChargeDesc(invoice.extra_charge_desc)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
