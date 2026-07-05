import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { Search, Save, CheckSquare, Plus, Trash2, Eye, EyeOff, AlertCircle, X, History, AlertTriangle } from 'lucide-react';

interface Supplier {
  id: string;
  kode: string;
  nama: string;
}

interface Product {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
}

interface POItem {
  product_id: string;
  product_kode: string;
  product_nama: string;
  satuan: string;
  qty: number;
  harga_beli: number;
}

interface PriceHistoryItem {
  purchase: {
    no_order: string;
    order_date: string;
    supplier: {
      nama: string;
    };
  };
  harga_beli: number;
}

export const InputItemPO: React.FC = () => {
  const navigate = useNavigate();

  // PO Meta from Step 1
  const [poMeta, setPoMeta] = useState<{ noOrder: string; orderDate: string; supplier: Supplier; terms: string } | null>(null);

  // Items List
  const [items, setItems] = useState<POItem[]>([]);
  const [showMetaInfo, setShowMetaInfo] = useState(true);

  // New Item Row State
  const [prodQuery, setProdQuery] = useState('');
  const [selectedProd, setSelectedProd] = useState<Product | null>(null);
  const [qty, setQty] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');

  // Active input step for sidebar layout
  const [activeStep, setActiveStep] = useState<'search' | 'qty' | 'price' | 'table'>('search');

  // Popup list for products
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [focusedProdIdx, setFocusedProdIdx] = useState(0);

  // History Popover (F4)
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Modals confirmation status
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showDraftConfirmModal, setShowDraftConfirmModal] = useState(false);
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false);

  // Highlighted Row Index in Table
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);

  // Focus Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const productPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('po_step1');
    if (!raw) {
      navigate('/pembelian/order');
      return;
    }
    setPoMeta(JSON.parse(raw));

    // Focus product query on mount
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  // Fetch products
  useEffect(() => {
    if (!prodQuery) {
      setProducts([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.get(`/products?q=${prodQuery}`);
        setProducts(res.data.data || []);
        setFocusedProdIdx(0);
      } catch (err) {
        console.error(err);
      }
    }, 150);

    return () => clearTimeout(delay);
  }, [prodQuery]);

  // Load price history
  const loadPriceHistory = async () => {
    if (!selectedProd || !poMeta) return;
    try {
      const res = await api.get(`/products/${selectedProd.id}/price-history`);
      const history = res.data || [];
      setPriceHistory(history);
      setShowHistory(true);

      // Auto-fill price only if there is history from the same supplier
      const historyThisSupplier = history.filter(
        (h: any) => h.purchase?.supplier?.nama === poMeta.supplier.nama
      );
      if (historyThisSupplier.length > 0) {
        setPrice(historyThisSupplier[0].harga_beli);
      } else {
        setPrice(''); // If no history from this supplier, keep price empty
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch price history automatically when selected product changes
  useEffect(() => {
    if (selectedProd) {
      loadPriceHistory();
    } else {
      setPriceHistory([]);
      setShowHistory(false);
    }
  }, [selectedProd]);

  // Focus product popup modal when shown
  useEffect(() => {
    if (showProductPopup) {
      productPopupRef.current?.focus();
    }
  }, [showProductPopup]);

  const handleProductKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      qtyInputRef.current?.focus();
      setTimeout(() => qtyInputRef.current?.select(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setShowProductPopup(true);
      setFocusedProdIdx(0);
    }
  };

  const selectProduct = (p: Product) => {
    setSelectedProd(p);
    setProdQuery(p.nama);
    setShowProductPopup(false);
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 150);
  };

  const handleProductPopupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowProductPopup(false);
      searchInputRef.current?.focus();
      return;
    }
    if (products.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedProdIdx((prev) => (prev + 1) % products.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedProdIdx((prev) => (prev - 1 + products.length) % products.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      selectProduct(products[focusedProdIdx]);
    }
  };

  // Navigations inside the row inputs
  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      priceInputRef.current?.focus();
      setTimeout(() => priceInputRef.current?.select(), 50);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      searchInputRef.current?.focus();
      setTimeout(() => searchInputRef.current?.select(), 50);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setQty((prev) => {
        const current = typeof prev === 'number' ? prev : 0;
        return current + 1;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setQty((prev) => (typeof prev === 'number' ? Math.max(1, prev - 1) : 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      priceInputRef.current?.focus();
      setTimeout(() => priceInputRef.current?.select(), 50);
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      qtyInputRef.current?.focus();
      setTimeout(() => qtyInputRef.current?.select(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addItemToTable();
    }
  };

  const addItemToTable = () => {
    if (!selectedProd || !qty || !price) return;

    const newItem: POItem = {
      product_id: selectedProd.id,
      product_kode: selectedProd.kode,
      product_nama: selectedProd.nama,
      satuan: selectedProd.satuan,
      qty: Number(qty),
      harga_beli: Number(price),
    };

    setItems((prev) => [...prev, newItem]);

    // Reset row inputs
    setProdQuery('');
    setSelectedProd(null);
    setQty('');
    setPrice('');
    setShowHistory(false);

    // Focus back on search
    searchInputRef.current?.focus();
  };

  const deleteRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setSelectedRowIdx(null);
  };

  // Save/Finalize PO to Database
  const submitPO = async (isFinal: boolean) => {
    if (!poMeta || items.length === 0) return;

    try {
      const payload = {
        supplier_id: poMeta.supplier.id,
        order_date: poMeta.orderDate,
        terms: poMeta.terms,
        items,
      };

      const res = await api.post('/purchases', payload);
      const poId = res.data.id;

      if (isFinal) {
        await api.patch(`/purchases/${poId}/complete`);
      }

      // Clear metadata & storage
      sessionStorage.removeItem('po_step1');
      navigate('/pembelian');
    } catch (err) {
      alert('Gagal memproses Purchase Order');
    }
  };

  // Keyboard Shortcuts
  // F2: Focus new product search
  useHotkeys('f2', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F3: Go to first row of table and focus table navigation
  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (items.length > 0) {
      (document.activeElement as HTMLElement)?.blur();
      setSelectedRowIdx(0);
      setActiveStep('table');
    }
  }, { enableOnFormTags: true });

  // F10: Selesaikan PO
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (items.length > 0) {
      setShowCompleteConfirmModal(true);
    }
  }, { enableOnFormTags: true });

  // Delete row shortcut when a row is selected
  useHotkeys('del', (e) => {
    e.preventDefault();
    if (selectedRowIdx !== null) {
      deleteRow(selectedRowIdx);
    }
  }, { enableOnFormTags: false });

  // Up/Down table arrows
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (items.length > 0) {
      setSelectedRowIdx((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (items.length > 0) {
      setSelectedRowIdx((prev) => (prev === null ? 0 : Math.min(items.length - 1, prev + 1)));
    }
  }, { enableOnFormTags: false });

  const handleCancelConfirmModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowCancelConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      sessionStorage.removeItem('po_step1');
      setShowCancelConfirmModal(false);
      navigate('/pembelian');
    }
  };

  const handleDraftConfirmModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowDraftConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setShowDraftConfirmModal(false);
      submitPO(false); // Save as draft
    }
  };

  const handleCompleteConfirmModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowCompleteConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      e.stopPropagation();
      setShowCompleteConfirmModal(false);
      submitPO(true); // Complete PO
    }
  };

  // Esc: Cancel / Save draft
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showProductPopup) {
      setShowProductPopup(false);
      searchInputRef.current?.focus();
    } else if (showCancelConfirmModal) {
      setShowCancelConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (showDraftConfirmModal) {
      setShowDraftConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (showCompleteConfirmModal) {
      setShowCompleteConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      if (items.length === 0) {
        setShowCancelConfirmModal(true);
      } else {
        setShowDraftConfirmModal(true);
      }
    }
  }, { enableOnFormTags: true });

  const grandTotal = items.reduce((sum, item) => sum + (item.qty * item.harga_beli), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Input Barang PO (Step 2)</h1>
          <p className="text-slate-400">Masukkan daftar barang dan harga beli dari supplier</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setShowCompleteConfirmModal(true)} className="btn-primary" disabled={items.length === 0}>
            <CheckSquare size={16} />
            <span>Selesaikan PO (F10)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Inputs & Table) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Meta Panel (F3) */}
          {poMeta && showMetaInfo && (
            <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-surface-800 border-surface-700/80 animate-fade-in">
              <div>
                <p className="text-xs text-slate-400">Nomor PO</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">{poMeta.noOrder}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Pemasok</p>
                <p className="text-sm font-bold text-white mt-0.5">{poMeta.supplier.nama}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tanggal Order</p>
                <p className="text-sm font-bold text-white mt-0.5">{poMeta.orderDate}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Termin</p>
                <p className="text-sm font-bold text-slate-200 mt-0.5 uppercase">{poMeta.terms}</p>
              </div>
            </div>
          )}

          {/* Grid Inputs for New Item */}
          <div className="card p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tambah Item Barang</h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              {/* Product Search */}
              <div className="relative sm:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">Cari Produk (F2)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={prodQuery}
                    onChange={(e) => {
                      setProdQuery(e.target.value);
                    }}
                    onFocus={() => {
                      setActiveStep('search');
                    }}
                    onKeyDown={handleProductKeyDown}
                    placeholder="Ketik Nama/Kode..."
                    className="input-field pl-9 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Qty */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Kuantitas</label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  onFocus={() => {
                    setActiveStep('qty');
                  }}
                  onKeyDown={handleQtyKeyDown}
                  placeholder="0.00"
                  className="input-field py-2 text-xs font-semibold"
                />
              </div>

              {/* Price & History trigger */}
              <div className="relative">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Harga Beli
                </label>
                <input
                  ref={priceInputRef}
                  type="text"
                  value={formatRupiahInput(price)}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : parseRupiahInput(e.target.value))}
                  onFocus={() => {
                    setActiveStep('price');
                  }}
                  onKeyDown={handlePriceKeyDown}
                  placeholder="Rp 0"
                  className="input-field py-2 text-xs text-emerald-400 font-bold"
                />
              </div>
            </div>

            {selectedProd && (
              <div className="p-3 bg-surface-900 border border-surface-700/50 rounded-lg flex items-center justify-between text-xs animate-scale-in text-slate-200">
                <div className="flex gap-4">
                  <span className="text-slate-400">Barang Terpilih: <strong className="text-slate-200">{selectedProd.nama}</strong></span>
                  <span className="text-slate-400">Ketersediaan Stok: <strong className="text-emerald-400">{selectedProd.stok} {selectedProd.satuan}</strong></span>
                </div>
                <button onClick={() => { setSelectedProd(null); setProdQuery(''); }} className="text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="card p-0 overflow-hidden border border-surface-700">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="p-4 w-12 text-center">No</th>
                    <th className="p-4">Kode Barang</th>
                    <th className="p-4">Nama Barang</th>
                    <th className="p-4 text-right">Qty</th>
                    <th className="p-4 text-right">Harga Satuan</th>
                    <th className="p-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isFocused = idx === selectedRowIdx;
                    const rowBgClass = isFocused ? 'bg-blue-100' : 'hover:bg-slate-50';

                    const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                      let base = "p-4 transition-all duration-150 border-b ";
                      if (isFocused) {
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
                        key={idx}
                        onClick={() => {
                          setSelectedRowIdx(idx);
                          setActiveStep('table');
                        }}
                        className={`cursor-pointer transition-colors ${rowBgClass}`}
                      >
                        <td className={getTdClass('first') + " text-center text-slate-500 font-mono text-xs"}>{idx + 1}</td>
                        <td className={getTdClass('middle') + " font-mono font-semibold text-slate-700"}>{item.product_kode}</td>
                        <td className={getTdClass('middle') + " font-bold text-slate-900"}>{item.product_nama}</td>
                        <td className={getTdClass('middle') + " text-right font-semibold text-slate-800"}>{item.qty}</td>
                        <td className={getTdClass('middle') + " text-right font-mono text-slate-700"}>
                          {formatCurrency(item.harga_beli)}
                        </td>
                        <td className={getTdClass('last') + " text-right font-mono text-slate-900 font-bold"}>
                          {formatCurrency(item.qty * item.harga_beli)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Total */}
            <div className="flex justify-between items-center p-4 bg-surface-800/50 border-t border-surface-700">
              <div className="text-xs text-slate-400">
                {items.length} item dimasukkan. Gunakan <kbd className="shortcut-badge ml-0.5">Arrow Up/Down</kbd> untuk menyorot baris dan <kbd className="shortcut-badge ml-0.5">Del</kbd> untuk menghapus.
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase tracking-wider block">Grand Total PO</span>
                <span className="text-xl font-black text-emerald-400 currency">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-6 lg:col-span-1">
          {/* Price History Card (Conditional) */}
          {activeStep === 'price' && selectedProd && (
            <div className="card card-hovered p-6 space-y-4 animate-scale-in">
              <div className="border-b border-surface-700 pb-3">
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <History className="text-primary-400 w-4 h-4" />
                  <span>Analisis Riwayat Harga Beli</span>
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{selectedProd.nama}</p>
              </div>

              {/* Harga Terakhir dari Supplier ini */}
              <div className="space-y-1.5">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Harga Terakhir Supplier Ini</span>
                <div className="p-3 bg-surface-900 border border-blue-500/30 rounded-lg space-y-1">
                  {(() => {
                    const historyThisSupplier = priceHistory.filter(
                      (h) => h.purchase?.supplier?.nama === poMeta?.supplier.nama
                    );
                    const lastPurchaseThisSupplier = historyThisSupplier[0];
                    return lastPurchaseThisSupplier ? (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Harga Terakhir:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPrice(lastPurchaseThisSupplier.harga_beli);
                              priceInputRef.current?.focus();
                            }}
                            className="font-extrabold text-primary-400 hover:underline"
                            title="Klik untuk menerapkan harga"
                          >
                            {formatCurrency(lastPurchaseThisSupplier.harga_beli)}
                          </button>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Tanggal Order:</span>
                          <span className="font-bold text-slate-200">
                            {new Date(lastPurchaseThisSupplier.purchase.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono pt-0.5 border-t border-surface-800">
                          <span>No. PO:</span>
                          <span>{lastPurchaseThisSupplier.purchase.no_order}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs italic block">Belum ada riwayat pembelian dari supplier ini.</span>
                    );
                  })()}
                </div>
              </div>

              {/* Riwayat Pembelian dari Supplier Lain */}
              <div className="space-y-1.5">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Riwayat dari Supplier Lain</span>
                {(() => {
                  const historyOtherSuppliers = priceHistory.filter(
                    (h) => h.purchase?.supplier?.nama !== poMeta?.supplier.nama
                  );
                  // Group by supplier name and select the latest one
                  const uniqueSuppliersMap = new Map<string, PriceHistoryItem>();
                  for (const h of historyOtherSuppliers) {
                    const supplierName = h.purchase?.supplier?.nama;
                    if (supplierName && !uniqueSuppliersMap.has(supplierName)) {
                      uniqueSuppliersMap.set(supplierName, h);
                    }
                  }
                  const uniqueOtherSuppliers = Array.from(uniqueSuppliersMap.values());

                  return uniqueOtherSuppliers.length > 0 ? (
                    <div className="space-y-2">
                      {uniqueOtherSuppliers.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="p-3 bg-surface-900 border border-surface-700/50 rounded-lg space-y-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-slate-200 block text-xs truncate max-w-[140px]">{item.purchase.supplier.nama}</span>
                              <span className="text-[9px] text-slate-500 block">
                                Tanggal: {new Date(item.purchase.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setPrice(item.harga_beli);
                                  priceInputRef.current?.focus();
                                }}
                                className="font-extrabold text-emerald-400 hover:underline text-xs block text-right"
                                title="Klik untuk menerapkan harga"
                              >
                                {formatCurrency(item.harga_beli)}
                              </button>
                              <span className="text-[9px] text-slate-500 block text-right mt-0.5 font-mono">
                                PO: {item.purchase.no_order}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-surface-900 border border-surface-700/50 rounded-lg text-slate-500 text-xs">
                      Tidak ada riwayat pembelian dari supplier lain.
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Panduan Pintasan */}
          {!(activeStep === 'price' && selectedProd) && (
            <div className="card card-hovered p-6 space-y-4 animate-scale-in">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-surface-700">Panduan Pintasan PO</h4>
              <ul className="text-xs text-slate-400 space-y-2.5 list-disc list-inside">
                <li>Tekan <kbd className="shortcut-badge text-[9px]">F2</kbd> untuk mulai cari barang</li>
                <li>Tekan <kbd className="shortcut-badge text-[9px]">F3</kbd> untuk berpindah ke tabel barang</li>
                <li>Tekan <kbd className="shortcut-badge text-[9px]">Enter</kbd> pada Cari Produk untuk membuka Popup</li>
                <li>Tekan <kbd className="shortcut-badge text-[9px]">ArrowRight</kbd> / <kbd className="shortcut-badge text-[9px]">ArrowLeft</kbd> untuk navigasi kolom</li>
                <li>Tekan <kbd className="shortcut-badge text-[9px]">Enter</kbd> pada kolom Harga Beli untuk tambah barang</li>
                <li>Tekan <kbd className="shortcut-badge text-[9px]">F10</kbd> untuk menyelesaikan PO</li>
                <li>Tekan <kbd className="shortcut-badge text-[9px]">Delete</kbd> untuk menghapus baris terpilih</li>
                <li>Tekan <kbd className="shortcut-badge text-[9px]">Esc</kbd> untuk batal / keluar PO</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Product Selection Popup Modal */}
      {showProductPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={productPopupRef}
            tabIndex={0}
            onKeyDown={handleProductPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>Pilih Produk</span>
              </h3>
              <button onClick={() => setShowProductPopup(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {products.length > 0 ? (
                products.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${
                      idx === focusedProdIdx
                        ? 'border-primary-500 bg-primary-600/10 text-primary-400 font-semibold ring-2 ring-primary-500/20 scale-[1.01]'
                        : 'border-surface-700 hover:bg-surface-750 text-slate-350 bg-surface-900'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-black">{p.nama}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{p.kode}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">Stok: {Number(p.stok)} {p.satuan}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Tidak ada produk yang cocok dengan "{prodQuery}".
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-surface-700 flex justify-between text-[11px] text-slate-500">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> untuk konfirmasi, <kbd className="shortcut-badge">Esc</kbd> batal</span>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={handleCancelConfirmModalKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-200"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-danger-400 border-b border-surface-700 pb-3 mb-4 text-center">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold text-white">Konfirmasi Batal PO</h3>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed mb-6 font-medium text-center">
              PO belum di-input. Jika Anda membatalkan, seluruh data order pembelian ini akan terhapus sepenuhnya.
            </p>
            <div className="flex justify-center gap-3 border-t border-surface-700/50 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirmModal(false);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="btn-secondary py-2 px-4 text-xs font-bold"
              >
                Kembali (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('po_step1');
                  setShowCancelConfirmModal(false);
                  navigate('/pembelian');
                }}
                className="btn-primary py-2 px-4 text-xs bg-danger-600 hover:bg-danger-550 font-bold"
              >
                Konfirmasi & Keluar (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Confirmation Modal */}
      {showDraftConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={handleDraftConfirmModalKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-200"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-amber-400 border-b border-surface-700 pb-3 mb-4 text-center">
              <Save size={28} className="text-amber-400" />
              <h3 className="text-lg font-bold text-white">Simpan sebagai Draft</h3>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed mb-6 font-medium text-center">
              PO ini akan disimpan sebagai <strong className="text-white">Draft</strong>.
              Stok di gudang tidak akan berubah sampai barang ini secara resmi diterima (Receiving).
            </p>
            <div className="flex justify-center gap-3 border-t border-surface-700/50 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowDraftConfirmModal(false);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="btn-secondary py-2 px-4 text-xs font-bold"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDraftConfirmModal(false);
                  submitPO(false); // Save as draft
                }}
                className="btn-primary py-2 px-4 text-xs bg-amber-500 hover:bg-amber-600 font-bold text-black"
              >
                Simpan & Ke Draft (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete PO Confirmation Modal */}
      {showCompleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={handleCompleteConfirmModalKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-200"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-emerald-400 border-b border-surface-700 pb-3 mb-4 text-center">
              <CheckSquare size={28} className="text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Selesaikan Purchase Order</h3>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed mb-6 font-medium text-center">
              PO ini akan diselesaikan dan datanya akan masuk ke antrean <strong className="text-white">Menu Receiving</strong>.
              Stok di gudang tidak akan bertambah sebelum barang fisik secara resmi diterima.
            </p>
            <div className="flex justify-center gap-3 border-t border-surface-700/50 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCompleteConfirmModal(false);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="btn-secondary py-2 px-4 text-xs font-bold"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompleteConfirmModal(false);
                  submitPO(true); // Complete PO
                }}
                className="btn-primary py-2 px-4 text-xs bg-emerald-500 hover:bg-emerald-600 font-bold text-black"
              >
                Konfirmasi & Masuk Receiving (Y)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
