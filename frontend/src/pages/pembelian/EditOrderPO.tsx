import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
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

const rankResults = (items: any[], query: string, searchKeys: string[] = ['nama', 'kode']) => {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return [...items].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
  }
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  return items
    .map((item) => {
      let matchedCount = 0;
      let minMatchIndex = Infinity;

      tokens.forEach((token) => {
        let foundInKey = false;
        searchKeys.forEach((key) => {
          const value = (item[key] || '').toLowerCase();
          const idx = value.indexOf(token);
          if (idx !== -1) {
            foundInKey = true;
            minMatchIndex = Math.min(minMatchIndex, idx);
          }
        });
        if (foundInKey) matchedCount++;
      });

      return { item, matchedCount, minMatchIndex };
    })
    .filter((res) => res.matchedCount > 0)
    .sort((a, b) => {
      if (b.matchedCount !== a.matchedCount) {
        return b.matchedCount - a.matchedCount;
      }
      if (a.minMatchIndex !== b.minMatchIndex) {
        return a.minMatchIndex - b.minMatchIndex;
      }
      return (a.item.nama || '').localeCompare(b.item.nama || '');
    })
    .map((res) => res.item);
};

export const EditOrderPO: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
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
  const [catatan, setCatatan] = useState('');

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
  const supplierItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const productItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showSupplierPopup) {
      const target = supplierItemRefs.current[focusedSuppIdx];
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedSuppIdx, showSupplierPopup]);

  useEffect(() => {
    if (showProductPopup) {
      const target = productItemRefs.current[focusedProdIdx];
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedProdIdx, showProductPopup]);

  useEffect(() => {
    if (activeStep === 'table' && selectedRowIdx !== null && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedRowIdx, activeStep]);

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
      setTimeout(() => {
        productPopupRef.current?.focus();
      }, 100);
    }
  }, [showProductPopup]);

  // Focus supplier popup modal when shown
  useEffect(() => {
    if (showSupplierPopup) {
      setTimeout(() => {
        supplierPopupRef.current?.focus();
      }, 100);
    }
  }, [showSupplierPopup]);

  // Fetch products
  useEffect(() => {
    if (!prodQuery.trim()) {
      setProducts([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.get(`/products?q=${prodQuery}&limit=50`);
        const rawData = res.data.data || [];
        const ranked = rankResults(rawData, prodQuery);
        setProducts(ranked);
        setFocusedProdIdx(0);
      } catch (err) {
        console.error(err);
      }
    }, 150);

    return () => clearTimeout(delay);
  }, [prodQuery]);

  // Fetch suppliers
  useEffect(() => {
    if (!supplierQuery.trim() || (selectedSupplier && selectedSupplier.nama === supplierQuery)) {
      setSuppliers([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.get(`/suppliers?q=${supplierQuery}&limit=50`);
        const rawData = res.data.data || [];
        const ranked = rankResults(rawData, supplierQuery);
        setSuppliers(ranked);
        setFocusedSuppIdx(0);
      } catch (err) {
        console.error(err);
      }
    }, 150);

    return () => clearTimeout(delay);
  }, [supplierQuery, selectedSupplier]);

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
      const res = await api.get('/purchases?limit=1000');
      const allPos = res.data.data || [];
      const match = allPos.find((d: any) => d.no_order.toLowerCase() === queryStr.trim().toLowerCase());

      if (!match) {
        setShowPoNotFoundPopup(true);
        setIsLoading(false);
        return;
      }

      if (match.status === 'received') {
        showToast(
          lang === 'en'
            ? 'This PO has already been validated/received in the warehouse and cannot be edited anymore'
            : 'PO ini sudah divalidasi/diterima di gudang dan tidak dapat diedit lagi',
          'error'
        );
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
      showToast(
        lang === 'en' ? 'Failed to load draft PO details' : 'Gagal memuat detail draft PO',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePoSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDraftPO(poQuery);
  };

  const handleProductKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      qtyInputRef.current?.focus();
      setTimeout(() => qtyInputRef.current?.select(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = prodQuery.trim();
      if (!trimmed) {
        try {
          const res = await api.get('/products?limit=50');
          const rawData = res.data.data || [];
          const ranked = rankResults(rawData, '');
          setProducts(ranked);
        } catch (err) {
          console.error(err);
        }
      }
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

  const handleSupplierKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = supplierQuery.trim();
      if (selectedSupplier && trimmed.toLowerCase() === selectedSupplier.nama.toLowerCase()) {
        setActiveStep('terms');
        setTimeout(() => termsSelectRef.current?.focus(), 50);
      } else {
        if (!trimmed) {
          try {
            const res = await api.get(`/suppliers?limit=50`);
            const rawData = res.data.data || [];
            const ranked = rankResults(rawData, '');
            setSuppliers(ranked);
          } catch (err) {
            console.error(err);
          }
        }
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

      showToast(
        lang === 'en'
          ? `Draft PO successfully updated ${isFinal ? 'and completed' : ''}`
          : `PO draft berhasil diperbarui ${isFinal ? 'dan diselesaikan' : ''}`,
        'success'
      );
      navigate('/pembelian');
    } catch (err) {
      console.error(err);
      showToast(
        lang === 'en' ? 'Failed to update Purchase Order' : 'Gagal memperbarui Purchase Order',
        'error'
      );
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

  // F3: Pindah fokus ke cari produk (F2 alias)
  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (activePo) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true });

  // F4: Blur input and focus on table row selection
  useHotkeys('f4', (e) => {
    e.preventDefault();
    if (activePo && items.length > 0) {
      setSelectedRowIdx(0);
      setActiveStep('table');
      setTimeout(() => tableContainerRef.current?.focus(), 30);
    }
  }, { enableOnFormTags: true });

  // F6: Focus Keterangan/Catatan field
  useHotkeys('f6', (e) => {
    e.preventDefault();
    if (activePo) {
      noteInputRef.current?.focus();
      noteInputRef.current?.select();
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
  useHotkeys('delete, del', (e) => {
    const activeEl = document.activeElement;
    const isFormTag = activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.tagName === 'SELECT'
    );
    if (isFormTag) return;

    if (activeStep === 'table' && selectedRowIdx !== null) {
      e.preventDefault();
      deleteRow(selectedRowIdx);
    }
  }, { enableOnFormTags: true }, [activeStep, selectedRowIdx]);

  // Table row navigation arrows
  useHotkeys('up', (e) => {
    if (activeStep === 'table' && selectedRowIdx !== null) {
      e.preventDefault();
      setSelectedRowIdx((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
    }
  }, { enableOnFormTags: false }, [activeStep, selectedRowIdx]);

  useHotkeys('down', (e) => {
    if (activeStep === 'table' && selectedRowIdx !== null) {
      e.preventDefault();
      setSelectedRowIdx((prev) => (prev === null ? 0 : Math.min(items.length - 1, prev + 1)));
    }
  }, { enableOnFormTags: false }, [activeStep, selectedRowIdx, items]);

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
          <h1 className="text-2xl font-extrabold text-white">
            {lang === 'en' ? 'Edit PO Order' : 'Edit Order PO'}
          </h1>
          <p className="text-slate-400">
            {lang === 'en'
              ? 'Modify Purchase Order with Draft status or Not Received'
              : 'Ubah data Purchase Order yang berstatus Draft atau Belum Diterima'}
          </p>
        </div>
        {activePo && (
          <div className="flex gap-2">
            <button onClick={() => setShowCompleteConfirmModal(true)} className="btn-primary" disabled={isSaving || items.length === 0}>
              <CheckSquare size={16} />
              <span>{lang === 'en' ? 'Complete PO (F10)' : 'Selesaikan PO (F10)'}</span>
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
              <span>{lang === 'en' ? 'Search PO' : 'Cari PO'}</span>
            </h3>
            <form onSubmit={handlePoSearchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-405 mb-1.5 font-semibold">
                  {lang === 'en' ? 'PO Number (Type complete)' : 'Nomor PO (Ketik lengkap)'}
                </label>
                <input
                  ref={poSearchInputRef}
                  type="text"
                  required
                  value={poQuery}
                  onChange={(e) => setPoQuery(e.target.value)}
                  placeholder={lang === 'en' ? 'Example: PO260001' : 'Contoh: PO260001'}
                  className="input-field font-mono uppercase w-full py-2.5 text-xs text-slate-800 border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 !text-white font-bold text-xs transition-all shadow-md shadow-primary-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (lang === 'en' ? 'Loading...' : 'Memuat...') : (lang === 'en' ? 'Search & Edit' : 'Cari & Edit')}
              </button>
            </form>
          </div>

          {/* Guide Card */}
          <div className="md:col-span-2 h-full bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 text-xs text-slate-600 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider">
                {lang === 'en' ? 'PO Edit Guide' : 'Petunjuk Edit PO'}
              </h4>
              <ul className="space-y-2 list-decimal list-inside text-slate-500 leading-relaxed">
                {lang === 'en' ? (
                  <>
                    <li>Search for PO order numbers of type <strong>Draft</strong> or <strong>Not Received</strong> to make changes.</li>
                    <li>Enter the complete order number or search in the <strong>Draft Order</strong> menu.</li>
                    <li>This module allows adding items, correcting qty, purchase prices, and payment terms before the order is completed.</li>
                  </>
                ) : (
                  <>
                    <li>Cari nomor order PO bertipe <strong>Draft</strong> atau <strong>Belum Diterima</strong> untuk melakukan perubahan.</li>
                    <li>Masukkan nomor order lengkap atau cari di menu <strong>Draft Order</strong>.</li>
                    <li>Modul ini memungkinkan penambahan barang, koreksi qty, harga beli, dan termin pembayaran sebelum order diselesaikan.</li>
                  </>
                )}
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-400 font-mono">
              {lang === 'en' ? 'Press Esc to return to the Purchases menu.' : 'Tekan Esc untuk kembali ke menu Pembelian.'}
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
                <label className="block text-[11px] text-slate-400 mb-1">
                  {lang === 'en' ? 'PO Number (Read-Only)' : 'Nomor PO (Read-Only)'}
                </label>
                <input
                  type="text"
                  readOnly
                  value={activePo.no_order}
                  className="input-field py-2 bg-surface-900 border-surface-700 text-slate-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {lang === 'en' ? 'Order Date' : 'Tanggal Order'}
                </label>
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
                <label className="block text-[11px] text-slate-400 mb-1">{lang === 'en' ? 'Terms' : 'Termin'}</label>
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
                    { val: 'tunai', label: lang === 'en' ? 'Cash' : 'Tunai' },
                    { val: '1', label: lang === 'en' ? '1 Month' : '1 Bulan' },
                    { val: '2', label: lang === 'en' ? '2 Months' : '2 Bulan' },
                    { val: '3', label: lang === 'en' ? '3 Months' : '3 Bulan' },
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
                <label className="block text-[11px] text-slate-400 mb-1">
                  {lang === 'en' ? 'Search Product (F2)' : 'Cari Produk (F2)'}
                </label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={prodQuery}
                  onChange={(e) => setProdQuery(e.target.value)}
                  onKeyDown={handleProductKeyDown}
                  onFocus={() => setActiveStep('search')}
                  placeholder={lang === 'en' ? 'Press Enter to open product search...' : 'Tekan Enter untuk membuka pencarian produk...'}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {lang === 'en' ? 'Quantity' : 'Kuantitas'}
                </label>
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
                <label className="block text-[11px] text-slate-400 mb-1">
                  {lang === 'en' ? 'Purchase Price' : 'Harga Beli'}
                </label>
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
                  <span className="text-slate-400">
                    {lang === 'en' ? 'Selected Product: ' : 'Barang Terpilih: '}<strong className="text-slate-200">{selectedProd.nama}</strong>
                  </span>
                  <span className="text-slate-400">
                    {lang === 'en' ? 'Available Stock: ' : 'Ketersediaan Stok: '}<strong className="text-emerald-400">{selectedProd.stok} {selectedProd.satuan}</strong>
                  </span>
                </div>
                <button onClick={() => setSelectedProd(null)} className="text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Table Belanjaan PO */}
            <div className="card p-0 overflow-hidden border border-surface-700">
              <div
                ref={tableContainerRef}
                tabIndex={0}
                className="overflow-x-auto max-h-[360px] overflow-y-auto outline-none no-focus-outline"
              >
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4 w-12 text-center">No</th>
                      <th className="p-4">{lang === 'en' ? 'Item Code' : 'Kode Barang'}</th>
                      <th className="p-4">{lang === 'en' ? 'Item Name' : 'Nama Barang'}</th>
                      <th className="p-4 text-right">Qty</th>
                      <th className="p-4 text-right">{lang === 'en' ? 'Unit Price' : 'Harga Satuan'}</th>
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
                            ref={idx === selectedRowIdx ? activeRowRef : null}
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
                          {lang === 'en'
                            ? 'No items added yet. Search products above or press F2.'
                            : 'Belum ada item ditambahkan. Cari produk di atas atau tekan F2.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Footer */}
              <div className="flex justify-between items-center p-4 bg-surface-800/50 border-t border-surface-700">
                <div className="text-xs text-slate-500">
                  {lang === 'en'
                    ? `${items.length} item(s). Press F4 to table, Delete to remove row.`
                    : `${items.length} items. Tekan F4 ke tabel, Delete untuk hapus baris.`}
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Grand Total PO</span>
                  <span className="text-xl font-black text-emerald-400 currency">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Keterangan Field */}
              <div className="px-4 pb-4 pt-2 bg-surface-800/30 border-t border-surface-700/50">
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  {lang === 'en' ? 'Notes / Remarks (F6)' : 'Keterangan / Catatan (F6)'}
                </label>
                <input
                  ref={noteInputRef}
                  type="text"
                  placeholder={lang === 'en' ? 'Enter PO remarks or notes...' : 'Input keterangan atau catatan PO...'}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  onFocus={() => setActiveStep('search')}
                  className="input-field py-2 text-xs w-full"
                />
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
                    <span>{lang === 'en' ? 'Purchase Price History Analysis' : 'Analisis Riwayat Harga Beli'}</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{selectedProd.nama}</p>
                </div>

                {/* This Supplier Price History */}
                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">
                    {lang === 'en' ? 'Last Price From This Supplier' : 'Harga Terakhir Supplier Ini'}
                  </span>
                  <div
                    onClick={() => thisSupplierHistory && setPrice(thisSupplierHistory.harga_beli)}
                    className={`p-3 bg-surface-900 border border-blue-500/30 rounded-lg space-y-1 ${thisSupplierHistory ? 'cursor-pointer hover:bg-surface-850' : ''}`}
                  >
                    {thisSupplierHistory ? (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">{lang === 'en' ? 'Last Price:' : 'Harga Terakhir:'}</span>
                          <span className="font-extrabold text-primary-400">{formatCurrency(thisSupplierHistory.harga_beli)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">{lang === 'en' ? 'Date:' : 'Tanggal:'}</span>
                          <span className="font-bold text-slate-200">{formatDate(thisSupplierHistory.purchase.order_date)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono pt-0.5 border-t border-surface-800">
                          <span>No. PO:</span>
                          <span>{thisSupplierHistory.purchase.no_order}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 text-xs italic">
                        {lang === 'en' ? 'Never purchased from this supplier.' : 'Belum pernah beli dari supplier ini.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Other Suppliers Price History */}
                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">
                    {lang === 'en' ? 'History from Other Suppliers' : 'Riwayat dari Supplier Lainnya'}
                  </span>
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
                              <span className="text-[9px] text-slate-500 block">
                                {lang === 'en' ? 'Date' : 'Tanggal'}: {formatDate(item.purchase.order_date)}
                              </span>
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
                    <div className="text-slate-500 text-xs italic">
                      {lang === 'en' ? 'No history from other suppliers.' : 'Tidak ada riwayat dari supplier lainnya.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Shortcut Guide */
              <div className="card p-6 space-y-4 animate-scale-in">
                <div className="border-b border-surface-700 pb-3">
                  <h4 className="text-sm font-extrabold text-white">
                    {lang === 'en' ? 'PO Shortcuts Guide' : 'Panduan Pintasan PO'}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {lang === 'en' ? 'Fast keyboard navigation' : 'Navigasi keyboard cepat'}
                  </p>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  {lang === 'en' ? (
                    <>
                      <li>Press <kbd className="shortcut-badge text-[9px]">F1</kbd> to search supplier</li>
                      <li>Press <kbd className="shortcut-badge text-[9px]">F2</kbd> to search product</li>
                      <li>Press <kbd className="shortcut-badge text-[9px]">F4</kbd> to focus table row</li>
                      <li>Press <kbd className="shortcut-badge text-[9px]">↑ ↓</kbd> to navigate table rows</li>
                      <li>Press <kbd className="shortcut-badge text-[9px]">Delete</kbd> to delete highlighted row</li>
                      <li>Press <kbd className="shortcut-badge text-[9px]">F6</kbd> to go to Notes column</li>
                      <li>Press <kbd className="shortcut-badge text-[9px]">F10</kbd> to complete PO</li>
                      <li>Press <kbd className="shortcut-badge text-[9px]">Enter</kbd> to confirm field / add item</li>
                      <li>Press <kbd className="shortcut-badge text-[9px]">Esc</kbd> to cancel / save draft</li>
                    </>
                  ) : (
                    <>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F1</kbd> untuk cari supplier</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F2</kbd> untuk cari produk</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F4</kbd> untuk fokus ke baris tabel</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">↑ ↓</kbd> untuk navigasi baris tabel</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">Delete</kbd> untuk menghapus baris terpilih</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F6</kbd> untuk menuju kolom Keterangan</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F10</kbd> untuk menyelesaikan PO</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">Enter</kbd> untuk konfirmasi field / tambah item</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">Esc</kbd> untuk batal / simpan draft</li>
                    </>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supplier Selection Popup Modal */}
      {showSupplierPopup && (
        <ModalPortal>
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
                <span>{lang === 'en' ? 'Select Supplier' : 'Pilih Supplier'}</span>
              </h3>
              <button onClick={() => setShowSupplierPopup(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              <input
                type="text"
                placeholder={lang === 'en' ? 'Search by supplier name...' : 'Cari berdasarkan nama supplier...'}
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
                    ref={(el) => {
                      supplierItemRefs.current[idx] = el;
                    }}
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
                  {lang === 'en' ? `No supplier matches "${supplierQuery}".` : `Tidak ada supplier yang cocok dengan "${supplierQuery}".`}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-surface-700 flex justify-between text-[11px] text-slate-500">
              <span>{lang === 'en' ? 'Use ↑ ↓ to select' : 'Gunakan ↑ ↓ untuk memilih'}</span>
              <span>
                <kbd className="shortcut-badge">Enter</kbd> {lang === 'en' ? 'to confirm, ' : 'untuk konfirmasi, '}
                <kbd className="shortcut-badge">Esc</kbd> {lang === 'en' ? 'cancel' : 'batal'}
              </span>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Product Selection Popup Modal */}
      {showProductPopup && (
        <ModalPortal>
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
                <span>{lang === 'en' ? 'Select Product' : 'Pilih Produk'}</span>
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
                    ref={(el) => {
                      productItemRefs.current[idx] = el;
                    }}
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
                      <span className="text-xs text-slate-400">{lang === 'en' ? 'Stock' : 'Stok'}: {Number(p.stok)} {p.satuan}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  {lang === 'en' ? `No product matches "${prodQuery}".` : `Tidak ada produk yang cocok dengan "${prodQuery}".`}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-surface-700 flex justify-between text-[11px] text-slate-500">
              <span>{lang === 'en' ? 'Use ↑ ↓ to select' : 'Gunakan ↑ ↓ untuk memilih'}</span>
              <span>
                <kbd className="shortcut-badge">Enter</kbd> {lang === 'en' ? 'to confirm, ' : 'untuk konfirmasi, '}
                <kbd className="shortcut-badge">Esc</kbd> {lang === 'en' ? 'cancel' : 'batal'}
              </span>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirmModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={handleCancelConfirmModalKeyDown}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-800"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-danger-600 border-b border-slate-100 pb-3 mb-4 text-center">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold text-slate-900">
                {lang === 'en' ? 'Confirm Cancel PO' : 'Konfirmasi Batal PO'}
              </h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed mb-6 font-semibold text-center">
              {lang === 'en'
                ? 'PO items have not been saved. If you cancel, all this purchase order metadata will be permanently deleted.'
                : 'PO belum di-input. Jika Anda membatalkan, seluruh data order pembelian ini akan terhapus sepenuhnya.'}
            </p>
            <div className="flex justify-center gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirmModal(false);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all bg-white"
              >
                {lang === 'en' ? 'Back (Esc)' : 'Kembali (Esc)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirmModal(false);
                  navigate('/pembelian');
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-danger-600 hover:bg-danger-700 text-white transition-all shadow-md shadow-danger-500/10"
              >
                {lang === 'en' ? 'Confirm & Exit (Enter)' : 'Konfirmasi & Keluar (Enter)'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Draft Confirmation Modal */}
      {showDraftConfirmModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={handleDraftConfirmModalKeyDown}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-800"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-amber-600 border-b border-slate-100 pb-3 mb-4 text-center">
              <Save size={28} className="text-amber-600" />
              <h3 className="text-lg font-bold text-slate-900">
                {lang === 'en' ? 'Save as Draft' : 'Simpan sebagai Draft'}
              </h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed mb-6 font-semibold text-center">
              {lang === 'en'
                ? 'This PO will be saved as Draft. Warehouse stock will not change until the physical items are officially received (Receiving).'
                : 'PO ini akan disimpan sebagai Draft. Stok di gudang tidak akan berubah sampai barang ini secara resmi diterima (Receiving).'}
            </p>
            <div className="flex justify-center gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowDraftConfirmModal(false);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all bg-white"
              >
                {lang === 'en' ? 'Cancel (Esc)' : 'Batal (Esc)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDraftConfirmModal(false);
                  handleUpdatePO(false); // Save as draft
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-md shadow-amber-500/10"
              >
                {lang === 'en' ? 'Save & Go to Draft (Enter)' : 'Simpan & Ke Draft (Enter)'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Complete PO Confirmation Modal */}
      {showCompleteConfirmModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={handleCompleteConfirmModalKeyDown}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-800"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-emerald-650 border-b border-slate-200 pb-3 mb-4 text-center">
              <CheckSquare size={28} className="text-emerald-500" />
              <h3 className="text-lg font-bold text-slate-900">
                {lang === 'en' ? 'Complete Purchase Order' : 'Selesaikan Purchase Order'}
              </h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed mb-6 font-medium text-center">
              {lang === 'en'
                ? 'This PO will be completed and sent to the Receiving Menu queue. Warehouse stock will not increase until physical items are officially received.'
                : 'PO ini akan diselesaikan dan datanya akan masuk ke antrean Menu Receiving. Stok di gudang tidak akan bertambah sebelum barang fisik secara resmi diterima.'}
            </p>
            <div className="flex justify-center gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCompleteConfirmModal(false);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="py-2 px-4 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all"
              >
                {lang === 'en' ? 'Cancel (Esc)' : 'Batal (Esc)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompleteConfirmModal(false);
                  handleUpdatePO(true); // Complete PO
                }}
                className="btn-primary py-2 px-4 text-xs bg-emerald-500 hover:bg-emerald-600 font-bold text-black"
              >
                {lang === 'en' ? 'Confirm & Enter Receiving (Y)' : 'Konfirmasi & Masuk Receiving (Y)'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Empty Qty warning popup */}
      {showEmptyQtyAlert && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
          <div className="bg-white rounded-xl max-w-sm w-full mx-auto shadow-2xl animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-danger-600 text-white px-6 py-4 flex flex-col items-center justify-center gap-2">
              <AlertTriangle size={24} className="shrink-0 text-white animate-bounce" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-center">
                {lang === 'en' ? 'Quantity Empty!' : 'Kuantitas Kosong!'}
              </h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-xs text-slate-650 leading-relaxed mb-6 font-medium">
                {lang === 'en'
                  ? 'Quantity (Qty) cannot be empty or 0. Please fill in the quantity first.'
                  : 'Kuantitas (Qty) tidak boleh kosong atau 0. Silakan isi kuantitas terlebih dahulu.'}
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
                  {lang === 'en' ? 'Close (Enter)' : 'Tutup (Enter)'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Draft PO Not Found warning popup */}
      {showPoNotFoundPopup && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
          <div className="bg-white rounded-xl max-w-sm w-full mx-auto shadow-2xl animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-danger-600 text-white px-6 py-4 flex flex-col items-center justify-center gap-2">
              <AlertTriangle size={24} className="shrink-0 text-white" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-center">
                {lang === 'en' ? 'Draft PO Not Found' : 'Draft PO Tidak Ditemukan'}
              </h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-xs text-slate-655 leading-relaxed mb-6 font-medium">
                {lang === 'en'
                  ? 'The searched draft PO number was not found. Make sure the PO status is still Draft.'
                  : 'Nomor draft PO yang dicari tidak ditemukan. Pastikan status PO masih berupa Draft.'}
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
                  {lang === 'en' ? 'Close (Enter)' : 'Tutup (Enter)'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
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
