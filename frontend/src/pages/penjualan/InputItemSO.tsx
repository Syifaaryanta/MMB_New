import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate, formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { Search, Save, Printer, Plus, Trash2, X, AlertCircle, ShoppingCart, Truck, User, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
  limit_kredit: number;
  saldo_piutang: number;
  alamat?: string | null;
  no_telp?: string | null;
}

interface Product {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  product_prices: Array<{
    supplier_id: string;
    harga_beli: number;
  }>;
}

interface SOItem {
  product_id: string;
  product_kode: string;
  product_nama: string;
  qty: number;
  unit_price: number;
  total: number;
}

export const InputItemSO: React.FC = () => {
  const navigate = useNavigate();

  // SO metadata from step 1
  const [soMeta, setSoMeta] = useState<{ noOrder: string; orderDate: string; customer: Customer; diantar: boolean; limitBulan: number } | null>(null);

  // Table items
  const [items, setItems] = useState<SOItem[]>(() => {
    const saved = sessionStorage.getItem('so_items');
    return saved ? JSON.parse(saved) : [];
  });
  const [showMetaInfo, setShowMetaInfo] = useState(true);

  // Form input item row
  const [prodQuery, setProdQuery] = useState('');
  const [selectedProd, setSelectedProd] = useState<Product | null>(null);
  const [qty, setQty] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');

  // Dropdown list & Popup
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [focusedProdIdx, setFocusedProdIdx] = useState(0);

  // Adjustments & Notes
  const [adjustmentDesc, setAdjustmentDesc] = useState(() => sessionStorage.getItem('so_adjustmentDesc') || '');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(() => {
    const saved = sessionStorage.getItem('so_adjustmentAmount');
    return saved ? Number(saved) : 0;
  });
  const [senderNote, setSenderNote] = useState(() => sessionStorage.getItem('so_senderNote') || '');

  // Custom states for pricing history, step tracking and panel visibility
  const [productHistoryData, setProductHistoryData] = useState<any>(null);
  const [activeStep, setActiveStep] = useState<'search' | 'qty' | 'price' | 'adjust' | 'table'>('search');
  const [showAdjustmentsPanel, setShowAdjustmentsPanel] = useState(() => {
    const saved = sessionStorage.getItem('so_showAdjustmentsPanel');
    return saved ? JSON.parse(saved) : false;
  });

  // Selected row in table
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);

  // Validation modals
  const [showStockAlert, setShowStockAlert] = useState(false);
  const [stockAlertMsg, setStockAlertMsg] = useState('');
  const [showZeroStockPopup, setShowZeroStockPopup] = useState(false);
  const [zeroStockProduct, setZeroStockProduct] = useState<Product | null>(null);

  // Print Dialog Modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [completedSoId, setCompletedSoId] = useState<string | null>(null);
  const [completedSo, setCompletedSo] = useState<any | null>(null);
  const [showConfirmPrintModal, setShowConfirmPrintModal] = useState(false);
  const [sortOption, setSortOption] = useState<'asli' | 'abjad' | 'qty' | 'harga'>('asli');

  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showDraftConfirmModal, setShowDraftConfirmModal] = useState(false);
  const [showEmptyQtyAlert, setShowEmptyQtyAlert] = useState(false);

  // Duplicate alert modal status
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [adjustmentAmountInput, setAdjustmentAmountInput] = useState(() => sessionStorage.getItem('so_adjustmentAmountInput') || '');

  // Sync to sessionStorage on change
  useEffect(() => {
    sessionStorage.setItem('so_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    sessionStorage.setItem('so_adjustmentDesc', adjustmentDesc);
  }, [adjustmentDesc]);

  useEffect(() => {
    sessionStorage.setItem('so_adjustmentAmount', String(adjustmentAmount));
  }, [adjustmentAmount]);

  useEffect(() => {
    sessionStorage.setItem('so_adjustmentAmountInput', adjustmentAmountInput);
  }, [adjustmentAmountInput]);

  useEffect(() => {
    sessionStorage.setItem('so_senderNote', senderNote);
  }, [senderNote]);

  useEffect(() => {
    sessionStorage.setItem('so_showAdjustmentsPanel', String(showAdjustmentsPanel));
  }, [showAdjustmentsPanel]);

  // Focus Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const adjustmentDescRef = useRef<HTMLInputElement>(null);
  const adjustmentAmountRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const productPopupRef = useRef<HTMLDivElement>(null);

  const btnAsliRef = useRef<HTMLButtonElement>(null);
  const btnAbjadRef = useRef<HTMLButtonElement>(null);
  const btnQtyRef = useRef<HTMLButtonElement>(null);
  const btnHargaRef = useRef<HTMLButtonElement>(null);

  // Focus modal popups when shown
  useEffect(() => {
    if (showProductPopup) {
      productPopupRef.current?.focus();
    }
  }, [showProductPopup]);

  // Focus active sorting button inside Print Confirmation Modal
  useEffect(() => {
    if (showConfirmPrintModal) {
      setTimeout(() => {
        if (sortOption === 'asli') btnAsliRef.current?.focus();
        else if (sortOption === 'abjad') btnAbjadRef.current?.focus();
        else if (sortOption === 'qty') btnQtyRef.current?.focus();
        else if (sortOption === 'harga') btnHargaRef.current?.focus();
      }, 50);
    }
  }, [showConfirmPrintModal, sortOption]);

  useEffect(() => {
    const raw = sessionStorage.getItem('so_step1');
    if (!raw) {
      navigate('/penjualan/buat');
      return;
    }
    setSoMeta(JSON.parse(raw));

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

  const selectProduct = async (p: Product) => {
    if (Number(p.stok) <= 0) {
      setZeroStockProduct(p);
      setShowZeroStockPopup(true);
      setShowProductPopup(false);
      return;
    }

    setSelectedProd(p);
    setProdQuery(p.nama);
    setShowProductPopup(false);

    try {
      const res = await api.get(`/customers/${soMeta?.customer.id}/product-history/${p.id}`);
      setProductHistoryData(res.data);
      if (res.data.last_sale) {
        setPrice(res.data.last_sale.unit_price);
      } else {
        setPrice('');
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat harga produk', err);
      setPrice('');
    }

    // Focus Qty input immediately (use 150ms to ensure modal unmount and browser focus restore has finished)
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 150);

    try {
      const res = await api.get(`/customers/${soMeta?.customer.id}/product-history/${p.id}`);
      setProductHistoryData(res.data);
      if (res.data.last_sale) {
        setPrice(res.data.last_sale.unit_price);
      } else {
        setPrice('');
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat harga produk', err);
      setPrice('');
    }
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

  const addItemToTable = () => {
    if (!selectedProd) return;

    // Check duplicate
    const isDuplicate = items.some(item => item.product_id === selectedProd.id);
    if (isDuplicate) {
      setDuplicateMsg(`Barang "${selectedProd.nama}" sudah ada di daftar input SO!`);
      setShowDuplicateModal(true);
      return;
    }

    if (!qty || Number(qty) <= 0) {
      setShowEmptyQtyAlert(true);
      return;
    }
    if (!price || Number(price) <= 0) {
      alert("Harga jual tidak boleh kosong atau 0!");
      priceInputRef.current?.focus();
      return;
    }

    if (Number(qty) > Number(selectedProd.stok)) {
      const maxStok = Number(selectedProd.stok);
      setQty(maxStok);
      setStockAlertMsg(`Stok ${selectedProd.nama} tidak mencukupi. Tersedia: ${maxStok}. Kuantitas otomatis disesuaikan menjadi ${maxStok}.`);
      setShowStockAlert(true);
      return;
    }

    const newItem: SOItem = {
      product_id: selectedProd.id,
      product_kode: selectedProd.kode,
      product_nama: selectedProd.nama,
      qty: Number(qty),
      unit_price: Number(price),
      total: Number(qty) * Number(price),
    };

    setItems((prev) => [...prev, newItem]);

    setProdQuery('');
    setSelectedProd(null);
    setQty('');
    setPrice('');
    setProductHistoryData(null);

    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

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
        if (selectedProd && current >= Number(selectedProd.stok)) {
          return Number(selectedProd.stok);
        }
        return current + 1;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setQty((prev) => (typeof prev === 'number' ? Math.max(1, prev - 1) : 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedProd && Number(qty) > Number(selectedProd.stok)) {
        const maxStok = Number(selectedProd.stok);
        setQty(maxStok);
        setStockAlertMsg(`Stok ${selectedProd.nama} tidak mencukupi. Tersedia: ${maxStok}. Kuantitas otomatis disesuaikan menjadi ${maxStok}.`);
        setShowStockAlert(true);
        return;
      }
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

  const deleteRow = (idx: number) => {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      if (updated.length === 0) {
        setSelectedRowIdx(null);
        setActiveStep('search');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        setSelectedRowIdx((prevIdx) => {
          if (prevIdx === null) return null;
          return Math.min(prevIdx, updated.length - 1);
        });
      }
      return updated;
    });
    showToast('Item berhasil dihapus dari daftar', 'success');
  };

  const handleSaveDraftAction = async (toDraftPage?: boolean) => {
    if (!soMeta || items.length === 0) return;
    try {
      const payload = {
        customer_id: soMeta.customer.id,
        order_date: soMeta.orderDate,
        diantar: soMeta.diantar,
        limit_bulan: soMeta.limitBulan,
        extra_charge_desc: adjustmentDesc,
        extra_charge_amount: adjustmentAmount,
        sender_note: senderNote,
        items,
      };

      // Simpan draft di DB
      await api.post('/sales', payload);
      showToast('Draft SO berhasil disimpan', 'success');

      sessionStorage.removeItem('so_step1');
      setShowConfirmPrintModal(false);
      if (toDraftPage) {
        navigate('/penjualan/draft');
      } else {
        navigate('/penjualan');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Gagal menyimpan draft order', 'error');
    }
  };

  const handlePrintAction = async () => {
    if (!soMeta || items.length === 0) return;
    try {
      // Dapatkan data items yang telah diurutkan sesuai dengan pilihan user
      const sortedItems = getSortedItems(items);

      const payload = {
        customer_id: soMeta.customer.id,
        order_date: soMeta.orderDate,
        diantar: soMeta.diantar,
        limit_bulan: soMeta.limitBulan,
        extra_charge_desc: adjustmentDesc,
        extra_charge_amount: adjustmentAmount,
        sender_note: senderNote,
        items: sortedItems,
      };

      // 1. Buat order di DB (awalnya draft)
      const res = await api.post('/sales', payload);
      const soId = res.data.id;

      // 2. Selesaikan order (status menjadi completed, potong stok, dll)
      await api.patch(`/sales/${soId}/complete`);

      // 3. Terbitkan nomor faktur
      const printRes = await api.patch(`/sales/${soId}/print`);

      setCompletedSo(printRes.data);
      setCompletedSoId(soId);
      showToast('Order SO berhasil disimpan', 'success');

      sessionStorage.removeItem('so_step1');
      setShowConfirmPrintModal(false);

      // Trigger print thermal/A4 langsung
      setTimeout(() => {
        window.print();
        navigate('/penjualan');
      }, 250);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Gagal menyimpan & mencetak penjualan', 'error');
    }
  };

  const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
    if (activeStep === 'table' && selectedRowIdx !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRowIdx((prev) => (prev !== null && prev < items.length - 1) ? prev + 1 : prev);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRowIdx((prev) => (prev !== null && prev > 0) ? prev - 1 : prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedRowIdx(null);
        setActiveStep('search');
        searchInputRef.current?.focus();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        deleteRow(selectedRowIdx);
      }
    }
  };

  // Keyboard Shortcuts
  // F1: Focus product search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F2: Toggle Adjustment & Notes panel
  useHotkeys('f2', (e) => {
    e.preventDefault();
    adjustmentDescRef.current?.focus();
  }, { enableOnFormTags: true });

  // F3: Focus table rows
  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (items.length > 0) {
      setActiveStep('table');
      setSelectedRowIdx(0);
    }
  }, { enableOnFormTags: true });

  // F10: Save Order / Show Print Confirmation Modal
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (items.length > 0) {
      setShowConfirmPrintModal(true);
    }
  }, { enableOnFormTags: true });

  // Ctrl+S: Complete SO Transaction / Show Print Confirmation Modal
  useHotkeys('ctrl+s', (e) => {
    e.preventDefault();
    if (items.length > 0) {
      setShowConfirmPrintModal(true);
    }
  }, { enableOnFormTags: true });

  // Delete row
  useHotkeys('del', (e) => {
    e.preventDefault();
    if (selectedRowIdx !== null) {
      deleteRow(selectedRowIdx);
    }
  }, { enableOnFormTags: false });

  // Escape handling
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showEmptyQtyAlert) {
      setShowEmptyQtyAlert(false);
      setTimeout(() => qtyInputRef.current?.focus(), 50);
    } else if (showZeroStockPopup) {
      setShowZeroStockPopup(false);
      setZeroStockProduct(null);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (showConfirmPrintModal) {
      setShowConfirmPrintModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (showProductPopup) {
      setShowProductPopup(false);
      searchInputRef.current?.focus();
    } else if (showPrintModal) {
      setShowPrintModal(false);
      navigate('/penjualan');
    } else if (showStockAlert) {
      setShowStockAlert(false);
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    } else if (showCancelConfirmModal) {
      setShowCancelConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (showDraftConfirmModal) {
      setShowDraftConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      if (items.length === 0) {
        setShowCancelConfirmModal(true);
      } else {
        setShowDraftConfirmModal(true);
      }
    }
  }, { enableOnFormTags: true });

  // Enter key handling for warnings
  useHotkeys('enter', (e) => {
    if (showEmptyQtyAlert) {
      e.preventDefault();
      setShowEmptyQtyAlert(false);
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 50);
    } else if (showZeroStockPopup) {
      e.preventDefault();
      setShowZeroStockPopup(false);
      setZeroStockProduct(null);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    } else if (showStockAlert) {
      e.preventDefault();
      setShowStockAlert(false);
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 50);
    }
  }, { enableOnFormTags: true });

  const handlePrint = async () => {
    if (!completedSoId) return;
    try {
      const res = await api.patch(`/sales/${completedSoId}/print`);
      setCompletedSo(res.data);
      setTimeout(() => {
        window.print();
        setShowPrintModal(false);
        navigate('/penjualan');
      }, 200);
    } catch (err) {
      console.error(err);
      alert('Gagal menerbitkan nomor faktur');
    }
  };

  const handlePrintModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setPrintFormat((f) => (f === 'thermal' ? 'a4' : 'thermal'));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handlePrint();
    }
  };

  const getSortedItems = (itemList: SOItem[]) => {
    const list = [...itemList];
    if (sortOption === 'abjad') {
      return list.sort((a, b) => a.product_nama.localeCompare(b.product_nama));
    } else if (sortOption === 'qty') {
      return list.sort((a, b) => b.qty - a.qty);
    } else if (sortOption === 'harga') {
      return list.sort((a, b) => b.unit_price - a.unit_price);
    }
    return list;
  };

  const handleConfirmPrintModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowConfirmPrintModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveDraftAction();
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      handlePrintAction();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const sortOptions: Array<'asli' | 'abjad' | 'qty' | 'harga'> = ['asli', 'abjad', 'qty', 'harga'];
      const currentIndex = sortOptions.indexOf(sortOption);
      const nextIndex = (currentIndex + 1) % sortOptions.length;
      setSortOption(sortOptions[nextIndex]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const sortOptions: Array<'asli' | 'abjad' | 'qty' | 'harga'> = ['asli', 'abjad', 'qty', 'harga'];
      const currentIndex = sortOptions.indexOf(sortOption);
      const nextIndex = (currentIndex - 1 + sortOptions.length) % sortOptions.length;
      setSortOption(sortOptions[nextIndex]);
    }
  };

  const handleDuplicateModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setShowDuplicateModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const handleCancelConfirmModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowCancelConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      sessionStorage.removeItem('so_step1');
      setShowCancelConfirmModal(false);
      navigate('/penjualan');
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
      handleSaveDraftAction(true);
    }
  };

  const itemsSubtotal = items.reduce((sum, i) => sum + i.total, 0);
  const grandTotal = itemsSubtotal + adjustmentAmount;

  return (
    <div className="space-y-6" onKeyDown={handleGlobalKeyDown}>
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Kasir Input SO (Step 2)</h1>
            <p className="text-slate-400">Masukkan item belanjaan dan selesaikan transaksi kasir</p>
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer & Term Info Panel */}
            {soMeta && showMetaInfo && (
              <div className="card card-hovered p-6 shadow-xl grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5 uppercase tracking-wider text-[10px] font-bold">Nomor SO</span>
                  <span className="font-mono font-bold text-white text-sm">{soMeta.noOrder}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5 uppercase tracking-wider text-[10px] font-bold">Pelanggan</span>
                  <span className="font-bold text-slate-200 text-sm block truncate">{soMeta.customer.nama}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Tlp: {soMeta.customer.no_telp || '-'}</span>
                  <span className="text-[10px] text-slate-400 block truncate">Alamat: {soMeta.customer.alamat || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5 uppercase tracking-wider text-[10px] font-bold">Sisa Limit Kredit</span>
                  <span className={`font-bold text-sm block ${soMeta.customer.limit_kredit - soMeta.customer.saldo_piutang <= 0 ? 'text-danger-400' : 'text-emerald-400'}`}>
                    {formatCurrency(Math.max(0, soMeta.customer.limit_kredit - soMeta.customer.saldo_piutang))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5 uppercase tracking-wider text-[10px] font-bold">Metode / J.Tempo</span>
                  <span className="font-bold text-slate-200 block mt-0.5">
                    {soMeta.limitBulan > 0 ? `Kredit (${soMeta.limitBulan} Bulan)` : 'Tunai / Cash'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5 uppercase tracking-wider text-[10px] font-bold">Status Kirim</span>
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5 mt-0.5">
                    {soMeta.diantar ? (
                      <>
                        <Truck size={14} className="text-primary-400" />
                        <span>Diantar Sopir</span>
                      </>
                    ) : (
                      <>
                        <User size={14} className="text-slate-400" />
                        <span>Diambil Sendiri</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Input Row Grid Form */}
            <div className="card p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Product Autocomplete */}
                <div className="md:col-span-2 relative">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Cari Produk (F1)</label>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Ketik kode atau nama produk..."
                    value={prodQuery}
                    onChange={(e) => {
                      setProdQuery(e.target.value);
                    }}
                    onFocus={() => {
                      setActiveStep('search');
                    }}
                    onKeyDown={handleProductKeyDown}
                    className="input-field w-full py-2.5 text-sm animate-fade-in"
                  />
                </div>

                {/* Qty */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Qty</label>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    placeholder="Kuantitas"
                    value={qty}
                    onChange={(e) => setQty(e.target.value ? Number(e.target.value) : '')}
                    onFocus={() => {
                      setActiveStep('qty');
                    }}
                    onBlur={() => {
                      if (selectedProd && qty && Number(qty) > Number(selectedProd.stok)) {
                        const maxStok = Number(selectedProd.stok);
                        setQty(maxStok);
                        setStockAlertMsg(`Stok ${selectedProd.nama} tidak mencukupi. Tersedia: ${maxStok}. Kuantitas otomatis disesuaikan menjadi ${maxStok}.`);
                        setShowStockAlert(true);
                      }
                    }}
                    onKeyDown={handleQtyKeyDown}
                    className="input-field w-full py-2.5 text-sm text-right font-mono"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Harga Jual</label>
                  <input
                    ref={priceInputRef}
                    type="text"
                    placeholder="Harga Jual"
                    value={formatRupiahInput(price)}
                    onChange={(e) => setPrice(e.target.value ? parseRupiahInput(e.target.value) : '')}
                    onFocus={() => {
                      setActiveStep('price');
                    }}
                    onKeyDown={handlePriceKeyDown}
                    className="input-field w-full py-2.5 text-sm text-right font-mono"
                  />
                </div>
              </div>

              {selectedProd && (
                <div className="p-3 bg-surface-900 border border-surface-700/50 rounded-lg flex items-center justify-between text-xs animate-scale-in">
                  <div className="flex gap-4">
                    <span className="text-slate-400">Barang Terpilih: <strong className="text-slate-200">{selectedProd.nama}</strong></span>
                    <span className="text-slate-400">Ketersediaan Stok: <strong className="text-emerald-400">{selectedProd.stok} {selectedProd.satuan}</strong></span>
                  </div>
                  <button onClick={() => { setSelectedProd(null); setProductHistoryData(null); }} className="text-slate-400 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Added Items Table Grid */}
            <div className="card card-hovered p-0 overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="p-4 w-12 text-center">No</th>
                    <th className="p-4">Kode SKU</th>
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
                            key={item.product_id}
                          onClick={() => {
                            (document.activeElement as HTMLElement)?.blur();
                            setSelectedRowIdx(idx);
                            setActiveStep('table');
                          }}
                            className={`cursor-pointer transition-all ${rowBgClass}`}
                          >
                            <td className={getTdClass('first') + " text-center text-slate-500 font-mono text-xs"}>{idx + 1}</td>
                            <td className={getTdClass('middle') + " font-mono text-slate-700 font-semibold"}>{item.product_kode}</td>
                            <td className={getTdClass('middle') + " font-bold text-slate-900"}>{item.product_nama}</td>
                            <td className={getTdClass('middle') + " text-right text-slate-800 font-semibold"}>{item.qty}</td>
                            <td className={getTdClass('middle') + " text-right font-mono text-slate-700"}>
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className={getTdClass('last') + " text-right font-mono text-slate-900 font-bold"}>
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 text-xs italic">
                        Belum ada item belanja ditambahkan. Cari barang di atas atau tekan F2.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Grand Totals (Bawah Kanan Tabel) */}
            <div className="flex justify-end mt-2 animate-fade-in pr-4">
              <div className="flex flex-col text-right space-y-1.5 min-w-[280px]">
                <div className="flex justify-between items-center text-xs gap-4">
                  <span className="text-slate-400 font-medium">Subtotal Belanja:</span>
                  <span className="font-semibold text-slate-200 currency">{formatCurrency(itemsSubtotal)}</span>
                </div>
                {adjustmentAmount !== 0 && (
                  <div className="flex justify-between items-center text-xs gap-4">
                    <span className="text-slate-400 font-medium">Penyesuaian ({adjustmentDesc || 'F2'}):</span>
                    <span className={`font-semibold currency ${adjustmentAmount < 0 ? 'text-danger-400' : 'text-emerald-400'}`}>
                      {adjustmentAmount < 0 ? '-' : '+'}{formatCurrency(Math.abs(adjustmentAmount))}
                    </span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-surface-700/50 flex justify-between items-center gap-4">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Grand Total:</span>
                  <span className="text-xl font-black text-emerald-400 currency">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column Sidebar */}
          <div className="space-y-6 lg:col-span-1">
            {/* Price History Card (Conditional) */}
            {activeStep === 'price' && productHistoryData && (
              <div className="card card-hovered p-6 space-y-4 animate-scale-in">
                <div className="border-b border-surface-700 pb-3">
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <ShoppingCart size={16} className="text-primary-400" />
                    <span>Analisis Riwayat Harga</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{selectedProd?.nama}</p>
                </div>

                {/* Last Unit Price Customer */}
                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Harga Terakhir Customer Ini</span>
                  <div className="p-3 bg-surface-900 border border-blue-500/30 rounded-lg space-y-1">
                    {productHistoryData.last_sale ? (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Harga Terakhir:</span>
                          <span className="font-extrabold text-primary-400">
                            {formatCurrency(productHistoryData.last_sale.unit_price)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Terakhir Order:</span>
                          <span className="font-bold text-slate-200">
                            {new Date(productHistoryData.last_sale.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono pt-0.5 border-t border-surface-800">
                          <span>No. SO:</span>
                          <span>{productHistoryData.last_sale.no_order}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-450">Harga Terakhir:</span>
                          <span className="font-semibold text-slate-550">-</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-450">Terakhir Order:</span>
                          <span className="font-bold text-slate-500">0</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Harga Beli Supplier History */}
                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Harga Modal Supplier (Terkini & Sebelumnya)</span>
                  {productHistoryData.purchase_history && productHistoryData.purchase_history.length > 0 ? (
                    <div className="space-y-2">
                      {productHistoryData.purchase_history.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 bg-surface-900 border border-surface-700/50 rounded-lg space-y-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-slate-200 block text-xs truncate max-w-[140px]">{item.supplier_name}</span>
                              <span className="text-[9px] text-slate-500 block">
                                Tanggal: {new Date(item.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            <div>
                              <span className="font-extrabold text-emerald-400 text-xs block text-right">
                                {formatCurrency(item.latest_price)}
                              </span>
                              <span className="text-[9px] text-slate-450 block text-right mt-0.5">
                                Stok: {item.stok}
                              </span>
                            </div>
                          </div>

                          {/* Selisih Harga */}
                          {item.difference !== null && (
                            <div className="flex justify-between items-center text-[10px] pt-1 border-t border-surface-800">
                              <span className="text-slate-500">Selisih:</span>
                              <span className={`font-bold ${item.difference > 0 ? 'text-emerald-400' : item.difference < 0 ? 'text-danger-400' : 'text-slate-400'}`}>
                                {item.difference > 0 ? '+' : ''}{formatCurrency(item.difference)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-surface-900 border border-surface-700/50 rounded-lg text-slate-500 text-xs">
                      Belum ada riwayat pembelian modal dari supplier.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Panduan Pintasan */}
            {!(activeStep === 'price' && productHistoryData) && (
              <div className="card card-hovered p-6 space-y-4 animate-scale-in">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-surface-700">Panduan Pintasan</h4>
                <ul className="text-xs text-slate-450 space-y-2.5 list-disc list-inside">
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">F1</kbd> untuk mulai cari barang</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">F2</kbd> untuk menuju kolom Penyesuaian & Notes</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">F3</kbd> untuk masuk/navigasi tabel belanjaan</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">Enter</kbd> pada kolom Qty / Harga untuk lanjut</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">Ctrl+S</kbd> untuk simpan</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">F10</kbd> untuk simpan order</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">Delete</kbd> untuk menghapus baris terpilih</li>
                  <li>Tekan <kbd className="shortcut-badge text-[9px]">Esc</kbd> untuk batal / keluar kasir</li>
                </ul>
              </div>
            )}

            {/* Adjustment & Notes Panel (Always Shown) */}
            <div className="card card-hovered p-6 space-y-6 border border-surface-700 animate-scale-in">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-surface-700">Adjustment & Notes</h3>

              {/* Adjustments */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Penjelasan Penyesuaian (F2)</label>
                  <input
                    ref={adjustmentDescRef}
                    type="text"
                    placeholder="Potongan / Ongkos kirim..."
                    value={adjustmentDesc}
                    onChange={(e) => setAdjustmentDesc(e.target.value)}
                    onFocus={() => setActiveStep('adjust')}
                    onKeyDown={(e) => e.key === 'Enter' && adjustmentAmountRef.current?.focus()}
                    className="input-field w-full py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Jumlah Penyesuaian (Rp)</label>
                  <input
                    ref={adjustmentAmountRef}
                    type="text"
                    placeholder="0"
                    value={adjustmentAmountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || val === '-') {
                        setAdjustmentAmountInput(val);
                        setAdjustmentAmount(0);
                      } else {
                        const parsed = parseRupiahInput(val);
                        setAdjustmentAmount(parsed);
                        setAdjustmentAmountInput(formatRupiahInput(parsed));
                      }
                    }}
                    onFocus={() => setActiveStep('adjust')}
                    onKeyDown={(e) => e.key === 'Enter' && noteInputRef.current?.focus()}
                    className="input-field w-full py-2 text-xs font-mono text-right"
                  />
                </div>
              </div>

              {/* Sender Note */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Catatan Pengiriman (F10)</label>
                <textarea
                  ref={noteInputRef}
                  rows={3}
                  placeholder="Input Keterangan"
                  value={senderNote}
                  onChange={(e) => setSenderNote(e.target.value)}
                  onFocus={() => setActiveStep('adjust')}
                  className="input-field w-full py-2 text-xs resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Confirmation Modal */}
      {showConfirmPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            onKeyDown={handleConfirmPrintModalKeyDown}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-800"
          >
            {/* Header */}
            <div className="flex justify-between items-center w-full border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Printer size={18} className="text-primary-600" />
                <span>Konfirmasi Cetak Nota</span>
              </h3>
              <button
                onClick={() => setShowConfirmPrintModal(false)}
                className="text-slate-450 hover:text-slate-650 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Subtitle */}
            <p className="text-xs text-slate-500 mt-4 font-medium">
              Pilih urutan item, lalu pilih aksi: Simpan sebagai Draft (Enter) atau Print (P).
            </p>

            {/* Sorting Pills */}
            <div className="flex gap-2.5 mt-4">
              <button
                ref={btnAsliRef}
                type="button"
                onClick={() => setSortOption('asli')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${sortOption === 'asli'
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Urutan Asli
              </button>
              <button
                ref={btnAbjadRef}
                type="button"
                onClick={() => setSortOption('abjad')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${sortOption === 'abjad'
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Abjad (A-Z)
              </button>
              <button
                ref={btnQtyRef}
                type="button"
                onClick={() => setSortOption('qty')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${sortOption === 'qty'
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Qty Terbanyak
              </button>
              <button
                ref={btnHargaRef}
                type="button"
                onClick={() => setSortOption('harga')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${sortOption === 'harga'
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                Harga Tertinggi
              </button>
            </div>

            {/* Items Preview Table */}
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden max-h-[250px] overflow-y-auto bg-slate-50">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-250 text-slate-700 font-bold">
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3 text-right w-20">Qty</th>
                    <th className="p-3 text-right w-32">Harga</th>
                    <th className="p-3 text-right w-32">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {getSortedItems(items).map((item, idx) => (
                    <tr key={idx} className="bg-white hover:bg-slate-50 text-slate-800">
                      <td className="p-3 font-semibold text-slate-900">{item.product_nama}</td>
                      <td className="p-3 text-right font-medium text-slate-700">{item.qty}</td>
                      <td className="p-3 text-right font-mono font-medium text-slate-600">{formatCurrency(item.unit_price)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowConfirmPrintModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={() => handleSaveDraftAction()}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all"
              >
                Simpan Draft (Enter)
              </button>
              <button
                type="button"
                onClick={handlePrintAction}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-500 transition-all shadow-md shadow-primary-500/10"
              >
                Print (P)
              </button>
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
              <h3 className="text-lg font-bold text-white">Konfirmasi Batal Order</h3>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed mb-6 font-medium text-center">
              Order belum di-input. Jika Anda membatalkan, seluruh data order penjualan ini akan terhapus sepenuhnya.
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
                  sessionStorage.removeItem('so_step1');
                  setShowCancelConfirmModal(false);
                  navigate('/penjualan');
                }}
                className="btn-primary py-2 px-4 text-xs bg-danger-600 hover:bg-danger-500 font-bold"
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
              Order penjualan ini akan disimpan sebagai <strong className="text-white">Draft</strong>.
              Stok di inventory akan tetap berkurang sesuai dengan barang yang telah di-input.
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
                  handleSaveDraftAction(true);
                }}
                className="btn-primary py-2 px-4 text-xs bg-amber-500 hover:bg-amber-600 font-bold text-black"
              >
                Simpan & Ke Draft (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock warning modal */}
      {showStockAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-2.5 text-danger-400 border-b border-surface-700 pb-3 mb-4">
              <AlertCircle size={20} />
              <h3 className="text-lg font-bold text-white">Stok Tidak Mencukupi</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6">{stockAlertMsg}</p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowStockAlert(false);
                  qtyInputRef.current?.focus();
                  qtyInputRef.current?.select();
                }}
                className="btn-primary py-2 px-4 text-xs bg-danger-600 hover:bg-danger-550 !text-white font-bold"
              >
                Tutup (Enter)
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

      {/* Duplicate Alert Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={handleDuplicateModalKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-200"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-amber-400 border-b border-surface-700 pb-3 mb-4 text-center">
              <AlertTriangle size={28} className="text-amber-400" />
              <h3 className="text-lg font-bold text-white">Barang Sudah Diinput</h3>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed mb-6 font-medium text-center">
              {duplicateMsg}
            </p>
            <div className="flex justify-center border-t border-surface-700/50 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="btn-primary py-2 px-6 text-xs bg-amber-500 hover:bg-amber-600 font-bold text-black"
                autoFocus
              >
                OK (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg font-semibold text-xs flex items-center gap-2 animate-slide-in text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-danger-600'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-white" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-white" />
          )}
          <span className="!text-white">{toast.message}</span>
        </div>
      )}

      {/* Zero stock warning popup */}
      {showZeroStockPopup && zeroStockProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
          <div className="bg-white rounded-xl max-w-sm w-full mx-auto shadow-2xl animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-danger-600 text-white px-6 py-4 flex flex-col items-center justify-center gap-2">
              <AlertTriangle size={24} className="shrink-0 text-white" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-center">Stok Kosong!</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-xs text-slate-650 leading-relaxed mb-6 font-medium">
                Stok barang <strong>{zeroStockProduct.nama}</strong> di gudang kosong (0). Anda tidak dapat melakukan transaksi untuk barang ini.
              </p>
              <div className="flex justify-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowZeroStockPopup(false);
                    setZeroStockProduct(null);
                    setTimeout(() => {
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
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

      {/* Product Selection Popup Modal (Sama persis dengan modul inventory/InformasiHarga) */}
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
                      <span className="text-xs text-slate-400">Stok: {p.stok} {p.satuan}</span>
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

      {/* Invoice Complete / Print Dialog */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            onKeyDown={handlePrintModalKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in outline-none"
            ref={(el) => el?.focus()}
          >
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <Printer size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Transaksi Berhasil Disimpan</h3>
                <p className="text-xs text-slate-400 mt-1">Pilih format cetak nota belanja (Gunakan Panah Kiri/Kanan):</p>
              </div>

              {/* Selector */}
              <div className="flex gap-2 p-1.5 bg-surface-900 border border-surface-750 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPrintFormat('thermal')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${printFormat === 'thermal' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Kasir Thermal (58mm)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('a4')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${printFormat === 'a4' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Nota A4 / Kertas
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn-primary w-full py-2 flex items-center justify-center gap-1.5 text-xs"
                >
                  <Printer size={14} />
                  <span>Cetak Nota Belanja (Enter)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintModal(false);
                    navigate('/penjualan');
                  }}
                  className="btn-secondary w-full py-2 text-xs"
                >
                  Selesai Tanpa Cetak (Esc)
                </button>
              </div>

              <div className="pt-4 border-t border-surface-700 flex justify-between text-[10px] text-slate-500">
                <span>Tekan <kbd className="shortcut-badge text-[9px]">Enter</kbd> untuk Cetak</span>
                <span>Tekan <kbd className="shortcut-badge text-[9px]">Esc</kbd> untuk Selesai</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Layout */}
      {completedSo && (() => {
        const sortedPrintItems = getSortedItems(completedSo.sale_items.map((item: any) => ({
          product_id: item.product_id,
          product_kode: item.product_kode,
          product_nama: item.product_nama,
          qty: Number(item.qty),
          unit_price: Number(item.unit_price),
          total: Number(item.qty) * Number(item.unit_price),
        })));

        return (
          <div className="hidden print:block text-black bg-white font-mono text-[11px] leading-relaxed p-4">
            {printFormat === 'thermal' ? (
              /* Thermal Print (58mm/80mm layout) */
              <div className="w-[72mm] mx-auto p-1 space-y-3">
                <div className="text-center">
                  <h2 className="font-bold text-sm uppercase">Maju Mulia Bersama</h2>
                  <p className="text-[10px]">Jl. Raya Industri Utama No. 88, Bekasi</p>
                  <p className="text-[10px]">Telp: 021-89876543</p>
                  <p className="border-t border-dashed border-black my-1.5"></p>
                </div>
                <div className="space-y-0.5">
                  <p>No. Faktur: {completedSo.no_faktur || completedSo.no_order}</p>
                  <p>Tanggal: {formatDate(completedSo.order_date)}</p>
                  <p>Pelanggan: {completedSo.customer_nama}</p>
                  <p>Termin: {completedSo.limit_bulan > 0 ? `Kredit (${completedSo.limit_bulan} Bulan)` : 'Tunai'}</p>
                  <p>Status: {completedSo.limit_bulan > 0 ? 'BELUM LUNAS (KREDIT J.TEMPO)' : 'LUNAS'}</p>
                  {completedSo.sender_note && <p>Keterangan: {completedSo.sender_note}</p>}
                  <p className="border-t border-dashed border-black my-1.5"></p>
                </div>
                <div className="space-y-1">
                  {sortedPrintItems.map((item: any, idx: number) => (
                    <div key={idx} className="space-y-0.5">
                      <p className="font-bold">{item.product_nama}</p>
                      <div className="flex justify-between text-[10px]">
                        <span>{Number(item.qty)} x {formatCurrency(Number(item.unit_price))}</span>
                        <span>{formatCurrency(Number(item.total))}</span>
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-dashed border-black my-1.5"></p>
                </div>
                <div className="space-y-0.5 text-right font-semibold">
                  {Number(completedSo.extra_charge_amount) !== 0 && (
                    <p>Adj ({completedSo.extra_charge_desc}): {formatCurrency(Number(completedSo.extra_charge_amount))}</p>
                  )}
                  <p className="font-bold text-xs">Total: {formatCurrency(Number(completedSo.subtotal))}</p>
                </div>
                <div className="text-center text-[9px] pt-3 space-y-0.5">
                  <p>Terima Kasih Atas Kunjungan Anda</p>
                  <p>Barang yang sudah dibeli tidak dapat ditukar</p>
                </div>
              </div>
            ) : (
              /* A4 Print Layout */
              <div className="space-y-6 max-w-[21cm] mx-auto p-4">
                <div className="flex justify-between items-start border-b border-black pb-4">
                  <div>
                    <h1 className="text-lg font-bold uppercase tracking-wider">Maju Mulia Bersama</h1>
                    <p className="text-xs text-slate-700">Distributor Bahan Bangunan & Logam</p>
                    <p className="text-xs text-slate-700">Jl. Raya Industri Utama No. 88, Cikarang, Bekasi</p>
                    <p className="text-xs text-slate-700">Telp: (021) 89876543 | Email: contact@mmb.com</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-base font-bold uppercase">Faktur Penjualan</h2>
                    <p className="text-xs font-semibold font-mono">{completedSo.no_faktur || completedSo.no_order}</p>
                    <p className="text-[10px] mt-2">Tanggal: {formatDate(completedSo.order_date)}</p>
                    {completedSo.due_date && (
                      <p className="text-[10px] text-red-600 font-bold">Jatuh Tempo: {formatDate(completedSo.due_date)}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[10px]">
                  <div>
                    <p className="font-bold uppercase text-slate-500">Pelanggan:</p>
                    <p className="font-bold text-xs">{completedSo.customer_nama}</p>
                    <p>{completedSo.customer_alamat || 'Alamat tidak dicantumkan'}</p>
                    <p>Telp: {completedSo.customer_telp || '-'}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-slate-500">Pengiriman & Catatan:</p>
                    <p className="font-semibold">{completedSo.diantar ? '🚚 DIANTAR SOPIR' : '🚶 DIAMBIL SENDIRI'}</p>
                    {completedSo.sender_note && <p className="italic mt-1">"{completedSo.sender_note}"</p>}
                  </div>
                </div>

                <table className="w-full text-left text-[10px] border-collapse border border-black">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black font-bold uppercase text-[9px]">
                      <th className="p-1.5 border-r border-black w-8 text-center">No</th>
                      <th className="p-1.5 border-r border-black">Kode Barang</th>
                      <th className="p-1.5 border-r border-black">Nama Produk</th>
                      <th className="p-1.5 border-r border-black text-right w-20">Kuantitas</th>
                      <th className="p-1.5 border-r border-black text-right w-28">Harga</th>
                      <th className="p-1.5 text-right w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    {sortedPrintItems.map((item: any, idx: number) => (
                      <tr key={idx} className="align-top">
                        <td className="p-1.5 border-r border-black text-center">{idx + 1}</td>
                        <td className="p-1.5 border-r border-black font-mono">{item.product_kode}</td>
                        <td className="p-1.5 border-r border-black font-bold">{item.product_nama}</td>
                        <td className="p-1.5 border-r border-black text-right">{Number(item.qty)}</td>
                        <td className="p-1.5 border-r border-black text-right">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="p-1.5 text-right">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                    {Number(completedSo.extra_charge_amount) !== 0 && (
                      <tr>
                        <td colSpan={5} className="p-1.5 border-r border-black text-right font-bold uppercase">
                          Penyesuaian ({completedSo.extra_charge_desc})
                        </td>
                        <td className="p-1.5 text-right font-bold">
                          {formatCurrency(Number(completedSo.extra_charge_amount))}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-50 border-t border-black">
                      <td colSpan={5} className="p-1.5 border-r border-black text-right font-bold uppercase">
                        Grand Total Penjualan
                      </td>
                      <td className="p-1.5 text-right font-black">
                        {formatCurrency(Number(completedSo.subtotal))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-3 gap-4 text-center text-[9px] pt-8">
                  <div className="space-y-10">
                    <p>Penerima / Customer</p>
                    <p className="underline font-bold">( ____________________ )</p>
                  </div>
                  <div className="space-y-10">
                    <p>Sopir / Pengirim</p>
                    <p className="underline font-bold">( ____________________ )</p>
                  </div>
                  <div className="space-y-10">
                    <p>Hormat Kami, Kasir</p>
                    <p className="underline font-bold">({completedSo.creator?.nama || '____________________'})</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
