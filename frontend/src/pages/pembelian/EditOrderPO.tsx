import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate, formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { Search, Save, CheckSquare, Plus, Trash2, X, AlertCircle, ShoppingCart, User, AlertTriangle, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface Supplier {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  no_telp: string | null;
  jatuh_tempo_bulan: number;
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
  id: string;
  qty: number;
  harga_beli: number;
  subtotal: number;
  created_at: string;
  purchase: {
    id: string;
    no_order: string;
    order_date: string;
    supplier_id: string;
    supplier: {
      id: string;
      kode: string;
      nama: string;
    };
  };
}

export const EditOrderPO: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const noOrderParam = searchParams.get('no_order');

  // Search PO
  const [poQuery, setPoQuery] = useState(noOrderParam || '');
  const [activePo, setActivePo] = useState<any | null>(null);

  // Edit PO Fields
  const [orderDate, setOrderDate] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [terms, setTerms] = useState('tunai');
  const [items, setItems] = useState<POItem[]>([]);

  // Item Form Fields
  const [prodQuery, setProdQuery] = useState('');
  const [selectedProd, setSelectedProd] = useState<Product | null>(null);
  const [qty, setQty] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');

  // Modals / Popups state
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [focusedProdIdx, setFocusedProdIdx] = useState(0);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [showSupplierPopup, setShowSupplierPopup] = useState(false);
  const [focusedSuppIdx, setFocusedSuppIdx] = useState(0);

  // Highlighted Row Index in Table
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<'supplier' | 'terms' | 'search' | 'qty' | 'price' | 'table'>('search');

  // History analysis states
  const [thisSupplierHistory, setThisSupplierHistory] = useState<PriceHistoryItem | null>(null);
  const [otherSuppliersHistory, setOtherSuppliersHistory] = useState<PriceHistoryItem[]>([]);

  // Alert modals states
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showDraftConfirmModal, setShowDraftConfirmModal] = useState(false);
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false);
  const [showEmptyQtyAlert, setShowEmptyQtyAlert] = useState(false);
  const [showPoNotFoundPopup, setShowPoNotFoundPopup] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Focus Refs
  const poSearchInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const termsSelectRef = useRef<HTMLDivElement>(null);

  const productPopupRef = useRef<HTMLDivElement>(null);
  const supplierPopupRef = useRef<HTMLDivElement>(null);

  // Focus po search input or load param on mount
  useEffect(() => {
    if (noOrderParam) {
      loadDraftPO(noOrderParam);
    } else {
      poSearchInputRef.current?.focus();
    }
  }, [noOrderParam]);

  // Focus product popup modal when shown
  useEffect(() => {
    if (showProductPopup) {
      productPopupRef.current?.focus();
    }
  }, [showProductPopup]);

  // Focus supplier popup modal when shown
  useEffect(() => {
    if (showSupplierPopup) {
      supplierPopupRef.current?.focus();
    }
  }, [showSupplierPopup]);

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

  // Fetch suppliers
  useEffect(() => {
    if (!supplierQuery) {
      setSuppliers([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.get(`/suppliers?q=${supplierQuery}`);
        setSuppliers(res.data.data || []);
        setFocusedSuppIdx(0);
      } catch (err) {
        console.error(err);
      }
    }, 150);

    return () => clearTimeout(delay);
  }, [supplierQuery]);

  // Load supplier price history & other suppliers history when selectedProd changes
  useEffect(() => {
    if (selectedProd && selectedSupplier) {
      // 1. Fetch from supplier_id (this supplier)
      api.get(`/products/${selectedProd.id}/price-history?supplier_id=${selectedSupplier.id}&limit=1`)
        .then((res) => {
          setThisSupplierHistory(res.data[0] || null);
          if (res.data[0]) {
            setPrice(res.data[0].harga_beli);
          } else {
            setPrice('');
          }
        })
        .catch((err) => console.error(err));

      // 2. Fetch other suppliers history (filtered unique per supplier)
      api.get(`/products/${selectedProd.id}/price-history`)
        .then((res) => {
          const list: PriceHistoryItem[] = res.data || [];
          const filtered = list.filter((x) => x.purchase.supplier_id !== selectedSupplier.id);
          const seen = new Set<string>();
          const uniqueSuppliers: PriceHistoryItem[] = [];
          for (const item of filtered) {
            const suppName = item.purchase.supplier.nama;
            if (!seen.has(suppName)) {
              seen.add(suppName);
              uniqueSuppliers.push(item);
            }
          }
          setOtherSuppliersHistory(uniqueSuppliers);
        })
        .catch((err) => console.error(err));
    } else {
      setThisSupplierHistory(null);
      setOtherSuppliersHistory([]);
    }
  }, [selectedProd, selectedSupplier]);

  // Fetch PO by no_order / exact search
  const loadDraftPO = async (queryStr: string) => {
    if (!queryStr) return;
    setIsLoading(true);
    try {
      const res = await api.get('/purchases?status=draft');
      const allDrafts = res.data.data || [];
      const match = allDrafts.find((d: any) => d.no_order.toLowerCase() === queryStr.trim().toLowerCase());

      if (!match) {
        setShowPoNotFoundPopup(true);
        setIsLoading(false);
        return;
      }

      // Load specific PO details
      const detailRes = await api.get(`/purchases/${match.id}`);
      const po = detailRes.data;

      setActivePo(po);
      setOrderDate(po.order_date.slice(0, 10));
      setSelectedSupplier(po.supplier);
      setSupplierQuery(po.supplier.nama);
      setTerms(po.terms);
      setItems(po.purchase_items.map((i: any) => ({
        product_id: i.product_id,
        product_kode: i.product.kode,
        product_nama: i.product.nama,
        satuan: i.product.satuan,
        qty: Number(i.qty),
        harga_beli: Number(i.harga_beli),
      })));

      setActiveStep('supplier');
      setTimeout(() => {
        supplierInputRef.current?.focus();
        supplierInputRef.current?.select();
      }, 150);
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat detail draft PO', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePoSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDraftPO(poQuery);
  };

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

  const handleSupplierKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSupplier && supplierQuery.trim().toLowerCase() === selectedSupplier.nama.toLowerCase()) {
        setActiveStep('terms');
        setTimeout(() => termsSelectRef.current?.focus(), 50);
      } else {
        setShowSupplierPopup(true);
        setFocusedSuppIdx(0);
      }
    }
  };

  const selectSupplier = (s: Supplier) => {
    setSelectedSupplier(s);
    setSupplierQuery(s.nama);
    setShowSupplierPopup(false);
    setActiveStep('terms');
    setTimeout(() => termsSelectRef.current?.focus(), 50);
  };

  const handleSupplierPopupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowSupplierPopup(false);
      supplierInputRef.current?.focus();
      return;
    }
    if (suppliers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuppIdx((prev) => (prev + 1) % suppliers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuppIdx((prev) => (prev - 1 + suppliers.length) % suppliers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectSupplier(suppliers[focusedSuppIdx]);
    }
  };

  const handleTermsKeyDown = (e: React.KeyboardEvent) => {
    const list = ['tunai', '1', '2', '3'];
    const currIdx = list.indexOf(terms);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setTerms(list[(currIdx + 1) % list.length]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setTerms(list[(currIdx - 1 + list.length) % list.length]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setActiveStep('search');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      priceInputRef.current?.focus();
      priceInputRef.current?.select();
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addItemToTable();
    }
  };

  const addItemToTable = () => {
    if (!selectedProd) return;
    if (!qty || Number(qty) <= 0) {
      setShowEmptyQtyAlert(true);
      return;
    }
    const finalPrice = price === '' ? 0 : Number(price);

    const existingIdx = items.findIndex((item) => item.product_id === selectedProd.id);

    if (existingIdx !== -1) {
      const updatedItems = [...items];
      updatedItems[existingIdx].qty += Number(qty);
      updatedItems[existingIdx].harga_beli = finalPrice;
      setItems(updatedItems);
    } else {
      const newItem: POItem = {
        product_id: selectedProd.id,
        product_kode: selectedProd.kode,
        product_nama: selectedProd.nama,
        satuan: selectedProd.satuan,
        qty: Number(qty),
        harga_beli: finalPrice,
      };
      setItems((prev) => [...prev, newItem]);
    }

    // Reset row inputs
    setProdQuery('');
    setSelectedProd(null);
    setQty('');
    setPrice('');
    setActiveStep('search');

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const deleteRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setSelectedRowIdx(null);
  };

  const handleUpdatePO = async (isFinal: boolean) => {
    if (!activePo || !selectedSupplier || items.length === 0) return;

    setIsSaving(true);
    try {
      const payload = {
        supplier_id: selectedSupplier.id,
        order_date: orderDate,
        terms,
        items,
      };

      await api.put(`/purchases/${activePo.id}`, payload);

      if (isFinal) {
        await api.patch(`/purchases/${activePo.id}/complete`);
      }

      showToast(`PO draft berhasil diperbarui ${isFinal ? 'dan diselesaikan' : ''}`, 'success');
      navigate('/pembelian');
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui Purchase Order', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard Shortcuts
  // F1: Focus Pemasok (Supplier)
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (activePo) {
      setActiveStep('supplier');
      supplierInputRef.current?.focus();
      supplierInputRef.current?.select();
    }
  }, { enableOnFormTags: true });

  // F2: Focus Cari Produk
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (activePo) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true });

  // F3: Blur input and focus on table row selection
  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (activePo && items.length > 0) {
      (document.activeElement as HTMLElement)?.blur();
      setSelectedRowIdx(0);
      setActiveStep('table');
    }
  }, { enableOnFormTags: true });

  // F10: Selesaikan PO
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (activePo && items.length > 0) {
      setShowCompleteConfirmModal(true);
    }
  }, { enableOnFormTags: true });

  // Delete row shortcut when a row is selected
  useHotkeys('del', (e) => {
    e.preventDefault();
    if (activePo && selectedRowIdx !== null) {
      deleteRow(selectedRowIdx);
    }
  }, { enableOnFormTags: false });

  // Table row navigation arrows
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (activePo && items.length > 0) {
      setSelectedRowIdx((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
    }
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (activePo && items.length > 0) {
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
      handleUpdatePO(false); // Save draft
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
      handleUpdatePO(true); // Complete PO
    }
  };

  // Esc: Cancel / Save draft / Dismiss alerts
  useHotkeys('esc', (e) => {
    if (showEmptyQtyAlert) {
      e.preventDefault();
      setShowEmptyQtyAlert(false);
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 50);
      return;
    }
    if (showPoNotFoundPopup) {
      e.preventDefault();
      setShowPoNotFoundPopup(false);
      setTimeout(() => {
        poSearchInputRef.current?.focus();
        poSearchInputRef.current?.select();
      }, 50);
      return;
    }
    if (showProductPopup || showSupplierPopup || showCancelConfirmModal || showDraftConfirmModal || showCompleteConfirmModal) return;
    e.preventDefault();
    if (!activePo) {
      navigate('/pembelian');
      return;
    }
    if (items.length === 0) {
      setShowCancelConfirmModal(true);
    } else {
      setShowDraftConfirmModal(true);
    }
  }, { enableOnFormTags: true });

  // Enter: Dismiss alert popups
  useHotkeys('enter', (e) => {
    if (showEmptyQtyAlert) {
      e.preventDefault();
      setShowEmptyQtyAlert(false);
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 50);
    } else if (showPoNotFoundPopup) {
      e.preventDefault();
      setShowPoNotFoundPopup(false);
      setTimeout(() => {
        poSearchInputRef.current?.focus();
        poSearchInputRef.current?.select();
      }, 50);
    }
  }, { enableOnFormTags: true });

  const grandTotal = items.reduce((sum, item) => sum + (item.qty * item.harga_beli), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Edit Order PO</h1>
          <p className="text-slate-400">Ubah data Purchase Order yang berstatus Draft</p>
        </div>
        {activePo && (
          <div className="flex gap-2">
            <button onClick={() => setShowCompleteConfirmModal(true)} className="btn-primary" disabled={isSaving || items.length === 0}>
              <CheckSquare size={16} />
              <span>Selesaikan PO (F10)</span>
            </button>
          </div>
        )}
      </div>

      {!activePo ? (
        /* PO Search Mode with Guide Card (Sama seperti SO) */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 max-w-4xl mx-auto items-stretch animate-scale-in">
          {/* Cari Draft card */}
          <div className="md:col-span-3 h-full bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-center space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Search size={18} className="text-primary-600" />
              <span>Cari Draft PO</span>
            </h3>
            <form onSubmit={handlePoSearchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-405 mb-1.5 font-semibold">Nomor PO (Ketik lengkap)</label>
                <input
                  ref={poSearchInputRef}
                  type="text"
                  required
                  value={poQuery}
                  onChange={(e) => setPoQuery(e.target.value)}
                  placeholder="Contoh: PO260001"
                  className="input-field font-mono uppercase w-full py-2.5 text-xs text-slate-800 border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 !text-white font-bold text-xs transition-all shadow-md shadow-primary-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Memuat...' : 'Cari & Edit'}
              </button>
            </form>
          </div>

          {/* Guide Card */}
          <div className="md:col-span-2 h-full bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 text-xs text-slate-600 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider">Petunjuk Edit PO</h4>
              <ul className="space-y-2 list-decimal list-inside text-slate-500 leading-relaxed">
                <li>Cari nomor order PO bertipe <strong>Draft</strong> untuk melakukan perubahan.</li>
                <li>Masukkan nomor order lengkap atau cari di menu <strong>Draft Order</strong>.</li>
                <li>Modul ini memungkinkan penambahan barang, koreksi qty, harga beli, dan termin pembayaran sebelum order diselesaikan.</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-400 font-mono">
              Tekan <kbd className="shortcut-badge">Esc</kbd> untuk kembali ke menu Pembelian.
            </div>
          </div>
        </div>
      ) : (
        /* PO Editor Grid Mode */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Left Column (Inputs & Table) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplier / Date Meta Info Card */}
            <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-surface-800 border-surface-700/80">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nomor PO (Read-Only)</label>
                <input
                  type="text"
                  readOnly
                  value={activePo.no_order}
                  className="input-field py-2 bg-surface-900 border-surface-700 text-slate-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Tanggal Order</label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div className="relative">
                <label className="block text-[11px] text-slate-400 mb-1">Supplier (F1)</label>
                <input
                  ref={supplierInputRef}
                  type="text"
                  value={supplierQuery}
                  onChange={(e) => setSupplierQuery(e.target.value)}
                  onFocus={() => {
                    setActiveStep('supplier');
                  }}
                  onKeyDown={handleSupplierKeyDown}
                  className={`input-field py-2 text-xs w-full ${activeStep === 'supplier' ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}`}
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Termin</label>
                <div
                  ref={termsSelectRef}
                  tabIndex={0}
                  onKeyDown={handleTermsKeyDown}
                  onFocus={() => setActiveStep('terms')}
                  className={`flex gap-2 p-1 bg-surface-900 border border-surface-700 rounded-lg outline-none transition-all ${
                    activeStep === 'terms' ? 'ring-2 ring-primary-500/20' : ''
                  }`}
                >
                  {[
                    { val: 'tunai', label: 'Tunai' },
                    { val: '1', label: '1 Bulan' },
                    { val: '2', label: '2 Bulan' },
                    { val: '3', label: '3 Bulan' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => {
                        setTerms(opt.val);
                        setActiveStep('terms');
                      }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        terms === opt.val
                          ? 'bg-primary-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Row Inputs */}
            <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-surface-800 border-surface-700/80">
              <div className="relative sm:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">Cari Produk (F2)</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={prodQuery}
                  onChange={(e) => setProdQuery(e.target.value)}
                  onKeyDown={handleProductKeyDown}
                  onFocus={() => setActiveStep('search')}
                  placeholder="Tekan Enter untuk membuka pencarian produk..."
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Kuantitas</label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  onKeyDown={handleQtyKeyDown}
                  onFocus={() => setActiveStep('qty')}
                  placeholder="0.00"
                  className="input-field py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Harga Beli</label>
                <input
                  ref={priceInputRef}
                  type="text"
                  value={formatRupiahInput(price)}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : parseRupiahInput(e.target.value))}
                  onKeyDown={handlePriceKeyDown}
                  onFocus={() => setActiveStep('price')}
                  placeholder="Rp 0"
                  className="input-field py-2 text-xs text-emerald-400 font-bold"
                />
              </div>
            </div>

            {/* Selected Product Banner */}
            {selectedProd && (
              <div className="p-3 bg-surface-900 border border-surface-700/50 rounded-lg flex items-center justify-between text-xs animate-scale-in">
                <div className="flex gap-4">
                  <span className="text-slate-400">Barang Terpilih: <strong className="text-slate-200">{selectedProd.nama}</strong></span>
                  <span className="text-slate-400">Ketersediaan Stok: <strong className="text-emerald-400">{selectedProd.stok} {selectedProd.satuan}</strong></span>
                </div>
                <button onClick={() => setSelectedProd(null)} className="text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Table Belanjaan PO */}
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
                    {items.length > 0 ? (
                      items.map((item, idx) => {
                        const isFocused = idx === selectedRowIdx && activeStep === 'table';
                        const rowBgClass = isFocused ? 'bg-blue-100' : idx === selectedRowIdx ? 'bg-slate-50' : 'hover:bg-slate-50';

                        const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                          let base = "p-4 transition-all duration-150 border-b ";
                          if (isFocused) {
                            base += "bg-blue-100 text-primary-950 font-bold border-blue-300 ";
                            if (pos === 'first') base += "border-l-4 border-primary-600 ";
                          } else if (idx === selectedRowIdx) {
                            base += "bg-slate-50 text-slate-800 border-slate-200 ";
                            if (pos === 'first') base += "border-l-4 border-slate-350 ";
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
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 text-xs italic">
                          Belum ada item ditambahkan. Cari produk di atas atau tekan F2.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Footer */}
              <div className="flex justify-between items-center p-4 bg-surface-800/50 border-t border-surface-700">
                <div className="text-xs text-slate-500">
                  {items.length} items. Tekan <kbd className="shortcut-badge text-[10px]">F3</kbd> ke tabel, <kbd className="shortcut-badge text-[10px]">Delete</kbd> untuk hapus baris.
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Grand Total PO</span>
                  <span className="text-xl font-black text-emerald-400 currency">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Sidebar guide / History analysis) */}
          <div className="space-y-6 lg:col-span-1">
            {/* Price History Card */}
            {activeStep === 'price' && selectedProd ? (
              <div className="card p-6 space-y-4 animate-scale-in">
                <div className="border-b border-surface-700 pb-3">
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <ShoppingCart size={16} className="text-primary-400" />
                    <span>Analisis Riwayat Harga Beli</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{selectedProd.nama}</p>
                </div>

                {/* This Supplier Price History */}
                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Harga Terakhir Supplier Ini</span>
                  <div
                    onClick={() => thisSupplierHistory && setPrice(thisSupplierHistory.harga_beli)}
                    className={`p-3 bg-surface-900 border border-blue-500/30 rounded-lg space-y-1 ${thisSupplierHistory ? 'cursor-pointer hover:bg-surface-850' : ''}`}
                  >
                    {thisSupplierHistory ? (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Harga Terakhir:</span>
                          <span className="font-extrabold text-primary-400">{formatCurrency(thisSupplierHistory.harga_beli)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Tanggal:</span>
                          <span className="font-bold text-slate-200">{formatDate(thisSupplierHistory.purchase.order_date)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono pt-0.5 border-t border-surface-800">
                          <span>No. PO:</span>
                          <span>{thisSupplierHistory.purchase.no_order}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 text-xs italic">Belum pernah beli dari supplier ini.</div>
                    )}
                  </div>
                </div>

                {/* Other Suppliers Price History */}
                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Riwayat dari Supplier Lainnya</span>
                  {otherSuppliersHistory.length > 0 ? (
                    <div className="space-y-2">
                      {otherSuppliersHistory.map((item, index) => (
                        <div
                          key={index}
                          onClick={() => setPrice(item.harga_beli)}
                          className="p-3 bg-surface-900 border border-surface-700/50 rounded-lg space-y-1 cursor-pointer hover:bg-surface-850"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-bold text-slate-200 block text-xs truncate max-w-[120px]" title={item.purchase.supplier.nama}>
                                {item.purchase.supplier.nama}
                              </span>
                              <span className="text-[9px] text-slate-500 block">Tanggal: {formatDate(item.purchase.order_date)}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-emerald-400 text-xs">{formatCurrency(item.harga_beli)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono pt-0.5 border-t border-surface-800">
                            <span>No. PO:</span>
                            <span>{item.purchase.no_order}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs italic">Tidak ada riwayat dari supplier lainnya.</div>
                  )}
                </div>
              </div>
            ) : (
              /* Shortcut Guide */
              <div className="card p-6 space-y-4 animate-scale-in">
                <div className="border-b border-surface-700 pb-3">
                  <h4 className="text-sm font-extrabold text-white">Panduan Pintasan PO</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Navigasi keyboard cepat</p>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">F1</kbd> untuk cari supplier</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">F2</kbd> untuk cari produk</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">F3</kbd> untuk ke baris tabel</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">F10</kbd> untuk menyelesaikan PO</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">Enter</kbd> untuk konfirmasi field / tambah item</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">Arrow keys</kbd> untuk berpindah kolom/baris</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">Delete</kbd> untuk menghapus baris terpilih</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">Esc</kbd> untuk batal / simpan draft</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supplier Selection Popup Modal */}
      {showSupplierPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div
            ref={supplierPopupRef}
            tabIndex={0}
            onKeyDown={handleSupplierPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-xl w-full mx-auto shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>Pilih Supplier</span>
              </h3>
              <button onClick={() => setShowSupplierPopup(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              <input
                type="text"
                placeholder="Cari berdasarkan nama supplier..."
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
                className="input-field py-2 text-xs w-full"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {suppliers.length > 0 ? (
                suppliers.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => selectSupplier(s)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${idx === focusedSuppIdx
                        ? 'border-primary-500 bg-primary-600/10 text-primary-400 font-semibold ring-2 ring-primary-500/20 scale-[1.01]'
                        : 'border-surface-700 hover:bg-surface-750 text-slate-350 bg-surface-900'
                      }`}
                  >
                    <div>
                      <p className="font-semibold text-black">{s.nama}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{s.kode}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Tidak ada supplier yang cocok dengan "{supplierQuery}".
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
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${idx === focusedProdIdx
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
                  handleUpdatePO(false); // Save as draft
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
                  handleUpdatePO(true); // Complete PO
                }}
                className="btn-primary py-2 px-4 text-xs bg-emerald-500 hover:bg-emerald-600 font-bold text-black"
              >
                Konfirmasi & Masuk Receiving (Y)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Qty warning popup */}
      {showEmptyQtyAlert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
          <div className="bg-white rounded-xl max-w-sm w-full mx-auto shadow-2xl animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-danger-600 text-white px-6 py-4 flex flex-col items-center justify-center gap-2">
              <AlertTriangle size={24} className="shrink-0 text-white animate-bounce" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-center">Kuantitas Kosong!</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-xs text-slate-650 leading-relaxed mb-6 font-medium">
                Kuantitas (Qty) tidak boleh kosong atau 0. Silakan isi kuantitas terlebih dahulu.
              </p>
              <div className="flex justify-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmptyQtyAlert(false);
                    setTimeout(() => {
                      qtyInputRef.current?.focus();
                      qtyInputRef.current?.select();
                    }, 50);
                  }}
                  className="px-6 py-2 rounded-lg bg-danger-600 !text-white text-xs font-bold hover:bg-danger-750 transition-all shadow-md"
                >
                  Tutup (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Draft PO Not Found warning popup */}
      {showPoNotFoundPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
          <div className="bg-white rounded-xl max-w-sm w-full mx-auto shadow-2xl animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-danger-600 text-white px-6 py-4 flex flex-col items-center justify-center gap-2">
              <AlertTriangle size={24} className="shrink-0 text-white" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-center">Draft PO Tidak Ditemukan</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-xs text-slate-650 leading-relaxed mb-6 font-medium">
                Nomor draft PO yang dicari tidak ditemukan. Pastikan status PO masih berupa <strong>Draft</strong>.
              </p>
              <div className="flex justify-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowPoNotFoundPopup(false);
                    setTimeout(() => {
                      poSearchInputRef.current?.focus();
                      poSearchInputRef.current?.select();
                    }, 50);
                  }}
                  className="px-6 py-2 rounded-lg bg-danger-600 !text-white text-xs font-bold hover:bg-danger-750 transition-all shadow-md animate-pulse"
                >
                  Tutup (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg font-semibold text-xs flex items-center gap-2 animate-slide-in text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-danger-600'
          }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-white" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-white" />
          )}
          <span className="!text-white">{toast.message}</span>
        </div>
      )}
    </div>
  );
};
