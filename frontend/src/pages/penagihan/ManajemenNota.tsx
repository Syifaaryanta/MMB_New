import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { 
  Search, 
  RefreshCw, 
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';

interface InvoiceNota {
  id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  due_date: string | null;
  customer_nama: string;
  subtotal: number;
  nota_merah: boolean;
  nota_putih: boolean;
  nota_kuning: boolean;
  sales_payments: Array<{ amount: number }>;
}

interface CustomerGroup {
  customer_nama: string;
  invoices: InvoiceNota[];
}

export const ManajemenNota: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceNota[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceNota[]>([]);
  const [groupedInvoices, setGroupedInvoices] = useState<CustomerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [popupFocusedIndex, setPopupFocusedIndex] = useState(0);

  // Keyboard navigation & editing state
  const [selectedCustIdx, setSelectedCustIdx] = useState<number>(0);
  const [selectedInvoiceIdx, setSelectedInvoiceIdx] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeCol, setActiveCol] = useState<'merah' | 'putih' | 'kuning'>('merah');
  const [expandedCustNames, setExpandedCustNames] = useState<Record<string, boolean>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPopupRef = useRef<HTMLDivElement>(null);

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

  // Group filtered invoices by customer name
  useEffect(() => {
    const groupsMap: Record<string, InvoiceNota[]> = {};
    filteredInvoices.forEach((inv) => {
      if (!groupsMap[inv.customer_nama]) {
        groupsMap[inv.customer_nama] = [];
      }
      groupsMap[inv.customer_nama].push(inv);
    });

    const groups = Object.keys(groupsMap).map((name) => ({
      customer_nama: name,
      invoices: groupsMap[name],
    }));

    setGroupedInvoices(groups);
  }, [filteredInvoices]);

  // Handle searchQuery filtering (reset selection/expansions ONLY when search query changes)
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = invoices.filter((inv) => {
      const docNo = (inv.no_faktur || inv.no_order).toLowerCase();
      const cust = inv.customer_nama.toLowerCase();
      return docNo.includes(query) || cust.includes(query);
    });
    setFilteredInvoices(filtered);
    setSelectedCustIdx(0);
    setSelectedInvoiceIdx(null);
    setExpandedCustNames({});
  }, [searchQuery]);

  // Update filteredInvoices when flat invoices list is modified (e.g., checkbox toggled) without resetting selections
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = invoices.filter((inv) => {
      const docNo = (inv.no_faktur || inv.no_order).toLowerCase();
      const cust = inv.customer_nama.toLowerCase();
      return docNo.includes(query) || cust.includes(query);
    });
    setFilteredInvoices(filtered);
  }, [invoices]);

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
    setIsConfirmed(false);
    setIsEditMode(false);
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F2: Focus checklist / enter edit mode on the first item
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (groupedInvoices.length === 0) return;
    const group = groupedInvoices[selectedCustIdx];
    if (group && group.invoices.length > 0) {
      setExpandedCustNames(prev => ({ ...prev, [group.customer_nama]: true }));
      setSelectedInvoiceIdx(0);
      setIsEditMode(true);
      setActiveCol('merah');
    }
  }, { enableOnFormTags: false });

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
            
            // If fully paid: Red is checked (returns to office), White is unchecked (handed to customer)
            if (remaining <= 0) {
              const updated = {
                ...inv,
                nota_merah: true,
                nota_putih: false,
              };
              // Persist to database
              await api.patch(`/sales/${inv.id}/nota`, {
                nota_merah: true,
                nota_putih: false,
              });
              return updated;
            } else {
              // If unpaid: Red is unchecked, White is checked
              const updated = {
                ...inv,
                nota_merah: false,
                nota_putih: true,
              };
              // Persist to database
              await api.patch(`/sales/${inv.id}/nota`, {
                nota_merah: false,
                nota_putih: true,
              });
              return updated;
            }
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
    if (groupedInvoices.length > 0 && expandedCustNames[groupedInvoices[selectedCustIdx].customer_nama]) {
      const group = groupedInvoices[selectedCustIdx];
      setExpandedCustNames(prev => ({ ...prev, [group.customer_nama]: false }));
      setSelectedInvoiceIdx(null);
      setIsEditMode(false);
    } else if (isEditMode) {
      setIsEditMode(false);
    } else if (searchQuery) {
      setSearchQuery('');
      setIsConfirmed(false);
    } else {
      navigate('/penagihan');
    }
  }, { enableOnFormTags: true }, [groupedInvoices, selectedCustIdx, expandedCustNames, isEditMode, searchQuery]);

  // ArrowUp / ArrowDown: Navigation
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (groupedInvoices.length === 0) return;

    if (selectedInvoiceIdx !== null) {
      if (selectedInvoiceIdx > 0) {
        setSelectedInvoiceIdx(selectedInvoiceIdx - 1);
      } else {
        setSelectedInvoiceIdx(null);
        setIsEditMode(false);
      }
    } else {
      if (selectedCustIdx > 0) {
        const prevCustIdx = selectedCustIdx - 1;
        setSelectedCustIdx(prevCustIdx);
        
        const prevGroup = groupedInvoices[prevCustIdx];
        const prevName = prevGroup.customer_nama;
        if (expandedCustNames[prevName] && prevGroup.invoices.length > 0) {
          setSelectedInvoiceIdx(prevGroup.invoices.length - 1);
        } else {
          setSelectedInvoiceIdx(null);
        }
      }
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (groupedInvoices.length === 0) return;

    if (selectedInvoiceIdx !== null) {
      const group = groupedInvoices[selectedCustIdx];
      if (group && selectedInvoiceIdx < group.invoices.length - 1) {
        setSelectedInvoiceIdx(selectedInvoiceIdx + 1);
      } else {
        if (selectedCustIdx < groupedInvoices.length - 1) {
          setSelectedCustIdx(selectedCustIdx + 1);
          setSelectedInvoiceIdx(null);
          setIsEditMode(false);
        }
      }
    } else {
      const group = groupedInvoices[selectedCustIdx];
      const isExpanded = !!expandedCustNames[group.customer_nama];
      if (isExpanded && group.invoices.length > 0) {
        setSelectedInvoiceIdx(0);
      } else {
        if (selectedCustIdx < groupedInvoices.length - 1) {
          setSelectedCustIdx(selectedCustIdx + 1);
          setSelectedInvoiceIdx(null);
        }
      }
    }
  }, { enableOnFormTags: false });

  // Enter: enter edit mode / expand customer card
  useHotkeys('enter', (e) => {
    e.preventDefault();
    if (groupedInvoices.length === 0) return;

    if (selectedInvoiceIdx === null) {
      const group = groupedInvoices[selectedCustIdx];
      setExpandedCustNames(prev => ({
        ...prev,
        [group.customer_nama]: true
      }));
      if (group.invoices.length > 0) {
        setSelectedInvoiceIdx(0);
      }
    } else {
      if (isEditMode) {
        toggleActiveCheckbox();
      } else {
        setIsEditMode(true);
        setActiveCol('merah');
      }
    }
  }, { enableOnFormTags: false }, [groupedInvoices, selectedCustIdx, expandedCustNames, selectedInvoiceIdx, isEditMode, activeCol]);

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
    if (selectedInvoiceIdx === null) return;
    const group = groupedInvoices[selectedCustIdx];
    if (!group) return;
    const target = group.invoices[selectedInvoiceIdx];
    if (!target) return;

    const key = `nota_${activeCol}` as 'nota_merah' | 'nota_putih' | 'nota_kuning';
    const updatedVal = !target[key];
    const updatedTarget = {
      ...target,
      [key]: updatedVal,
    };

    // Update screen state immediately
    const updatedInvoices = invoices.map((inv) => {
      if (inv.id === target.id) {
        return updatedTarget;
      }
      return inv;
    });

    setInvoices(updatedInvoices);
    saveNotaStatus(updatedTarget); // Save/sync automatically with backend
  };

  const handleSearchPopupKeyDown = (e: React.KeyboardEvent) => {
    if (groupedInvoices.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPopupFocusedIndex((prev) => (prev + 1) % groupedInvoices.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPopupFocusedIndex((prev) => (prev - 1 + groupedInvoices.length) % groupedInvoices.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setSelectedCustIdx(popupFocusedIndex);
      setSelectedInvoiceIdx(null);
      setExpandedCustNames({});
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

  const handleRowClick = (cIdx: number, iIdx: number) => {
    setSelectedCustIdx(cIdx);
    setSelectedInvoiceIdx(iIdx);
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
      </div>

      {/* Control Board */}
      <div className="card p-4 space-y-4">
        {/* Search */}
        <div className="relative w-full">
          <label className="block text-[11px] text-slate-400 mb-1.5 font-semibold uppercase tracking-wider">Cari Pelanggan (F1)</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-500" />
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
              className="input-field w-full pl-10 py-2.5 text-xs font-semibold"
            />
          </div>
        </div>

        {/* Sync Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-xs text-slate-400 pt-2.5 border-t border-slate-100/10">
          <p className="flex items-center gap-1.5">
            Tekan <kbd className="shortcut-badge text-primary-400 font-bold px-1.5 py-0.5 bg-slate-800 rounded">F4</kbd> untuk sinkronisasi otomatis status nota lunas di database.
          </p>
          <p className="text-[10px] text-slate-500 italic mt-1 md:mt-0">
            *Nota yang sisa piutangnya Rp 0 akan tercentang Merah, Putih, & Kuning sekaligus.
          </p>
        </div>
      </div>

      {/* Customer Groups / Instructions states */}
      {!searchQuery.trim() ? (
        <div className="card p-16 text-center text-slate-400 border border-slate-200 bg-white flex flex-col items-center justify-center gap-3 rounded-xl shadow-md">
          <div className="p-4 bg-slate-50 rounded-full border border-slate-100 shadow-inner">
            <Search size={28} className="text-primary-500/80 animate-pulse" />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-500 font-medium">
            Silakan ketik nama customer pada kolom pencarian untuk menampilkan data.
          </p>
        </div>
      ) : !isConfirmed ? (
        <div className="card p-16 text-center text-slate-400 border border-slate-200 bg-white flex flex-col items-center justify-center gap-3 rounded-xl shadow-md">
          <div className="p-4 bg-slate-50 rounded-full border border-slate-100 shadow-inner">
            <Search size={28} className="text-amber-500/80 animate-bounce" />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-500 font-medium">
            Tekan <span className="font-extrabold text-blue-600 font-mono">Enter</span> untuk memilih customer dan menampilkan data.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedInvoices.map((group, cIdx) => {
            const isCustSelected = selectedCustIdx === cIdx && selectedInvoiceIdx === null;
            const isExpanded = !!expandedCustNames[group.customer_nama];

            return (
              <div
                key={group.customer_nama}
                className={`card p-0 overflow-hidden border transition-all ${
                  isCustSelected ? 'card-hovered border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                }`}
              >
                {/* Customer Card Header */}
                <div
                  onClick={() => {
                    setSelectedCustIdx(cIdx);
                    setSelectedInvoiceIdx(null);
                    setExpandedCustNames(prev => ({ ...prev, [group.customer_nama]: !prev[group.customer_nama] }));
                  }}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-blue-50/20 bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">
                        {group.customer_nama}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Total {group.invoices.length} Invoice
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded Invoices Table */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                          <th className="p-4 w-12 text-center">No</th>
                          <th className="p-4">No. Invoice</th>
                          <th className="p-4">Tgl Transaksi</th>
                          <th className="p-4">Jatuh Tempo</th>
                          <th className="p-4 text-right">Nilai Belanja</th>
                          
                          {/* Colored Nota Columns */}
                          <th className="p-4 text-center w-28 bg-rose-50/20 border-l border-slate-200">
                            Merah (Finance)
                          </th>
                          <th className="p-4 text-center w-28 bg-blue-50/20 border-l border-slate-200">
                            Putih (Customer)
                          </th>
                          <th className="p-4 text-center w-28 bg-amber-50/20 border-l border-slate-200">
                            Kuning (Gudang)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.invoices.map((inv, iIdx) => {
                          const isInvSelected = selectedCustIdx === cIdx && selectedInvoiceIdx === iIdx;
                          const isMerahActive = isInvSelected && isEditMode && activeCol === 'merah';
                          const isPutihActive = isInvSelected && isEditMode && activeCol === 'putih';
                          const isKuningActive = isInvSelected && isEditMode && activeCol === 'kuning';
                          const rowBgClass = isInvSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/50';

                          const getTdClass = (pos: 'first' | 'middle' | 'last', customBg?: string) => {
                            let base = "p-4 transition-all duration-150 border-b border-slate-200 ";
                            if (isInvSelected) {
                              base += "bg-blue-50/50 text-slate-900 font-bold ";
                              if (pos === 'first') base += "border-l-4 border-blue-600 ";
                            } else {
                              base += (customBg || "text-slate-800") + " ";
                              if (pos === 'first') base += "border-l-4 border-transparent ";
                            }
                            return base;
                          };

                          return (
                            <tr
                              key={inv.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(cIdx, iIdx);
                              }}
                              className={`cursor-pointer transition-all ${rowBgClass}`}
                            >
                              <td className={getTdClass('first') + " text-center text-slate-500"}>{iIdx + 1}</td>
                              <td className={getTdClass('middle') + " font-mono font-bold text-slate-855"}>
                                {inv.no_faktur || inv.no_order}
                              </td>
                              <td className={getTdClass('middle') + " text-slate-650"}>{formatDate(inv.order_date)}</td>
                              <td className={getTdClass('middle') + " text-slate-650"}>
                                {inv.due_date ? formatDate(inv.due_date) : '-'}
                              </td>
                              <td className={getTdClass('middle') + " text-right font-mono text-slate-800"}>
                                {formatCurrency(Number(inv.subtotal))}
                              </td>
                              
                              {/* Nota Merah Checkbox */}
                              <td className={getTdClass('middle', 'bg-rose-50/30') + ` text-center border-l border-slate-200 transition-all ${
                                isMerahActive ? 'ring-2 ring-rose-500 ring-inset bg-rose-100/50' : ''
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
                                  className="rounded border-slate-350 bg-white text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                                />
                              </td>

                              {/* Nota Putih Checkbox */}
                              <td className={getTdClass('middle', 'bg-blue-50/10') + ` text-center border-l border-slate-200 transition-all ${
                                isPutihActive ? 'ring-2 ring-blue-500 ring-inset bg-blue-100/50' : ''
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
                                  className="rounded border-slate-355 bg-white text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                              </td>

                              {/* Nota Kuning Checkbox */}
                              <td className={getTdClass('last', 'bg-amber-50/30') + ` text-center border-l border-slate-200 transition-all ${
                                isKuningActive ? 'ring-2 ring-amber-500 ring-inset bg-amber-100/50' : ''
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
                                  className="rounded border-slate-350 bg-white text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                />
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
              ) : groupedInvoices.length === 0 ? (
                <div className="py-8 text-center text-slate-500 italic text-xs">
                  Tidak ada pelanggan yang cocok dengan pencarian "{searchQuery}".
                </div>
              ) : (
                groupedInvoices.map((group, idx) => (
                  <button
                    type="button"
                    key={group.customer_nama}
                    onClick={() => {
                      setSelectedCustIdx(idx);
                      setSelectedInvoiceIdx(null);
                      setExpandedCustNames({});
                      setShowSearchPopup(false);
                      setIsConfirmed(true);
                      setTimeout(() => {
                        document.body.focus();
                      }, 50);
                    }}
                    onMouseEnter={() => setPopupFocusedIndex(idx)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-xs transition-all border rounded-lg cursor-pointer ${
                      idx === popupFocusedIndex
                        ? 'border-primary-500 bg-primary-600/10 text-primary-400 font-semibold ring-2 ring-primary-500/20 scale-[1.01]'
                        : 'border-surface-700 hover:bg-surface-750 text-slate-355 bg-surface-900'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-white">{group.customer_nama}</p>
                      <p className="text-[10px] text-slate-450 mt-0.5">
                        Jumlah Nota: {group.invoices.length}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-rose-400 block">
                        Total Belanja: {formatCurrency(group.invoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0))}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
