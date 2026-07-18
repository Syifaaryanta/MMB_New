import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate, formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { Search, Save, Printer, Trash2, X, AlertCircle, ShoppingCart, Truck, User, AlertTriangle, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
  alamat?: string | null;
  no_telp?: string | null;
  limit_kredit: number;
  saldo_piutang: number;
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

export const EditPenjualan: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const noOrderParam = searchParams.get('no_order');

  // Search/Active SO metadata
  const [soQuery, setSoQuery] = useState(noOrderParam || '');
  const [activeSo, setActiveSo] = useState<any | null>(null);

  // Customer Autocomplete & Info
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [focusedCustIdx, setFocusedCustIdx] = useState(0);

  // Delivery & Terms
  const [diantar, setDiantar] = useState(true);
  const [limitBulan, setLimitBulan] = useState(0);

  // Table items
  const [items, setItems] = useState<SOItem[]>([]);

  // Item form row
  const [prodQuery, setProdQuery] = useState('');
  const [selectedProd, setSelectedProd] = useState<Product | null>(null);
  const [qty, setQty] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');

  // Dropdown list & Popup
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [focusedProdIdx, setFocusedProdIdx] = useState(0);

  // Adjustments & Notes
  const [adjustmentDesc, setAdjustmentDesc] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentAmountInput, setAdjustmentAmountInput] = useState<string>('');
  const [senderNote, setSenderNote] = useState('');

  // Custom states for price history and step tracking
  const [productHistoryData, setProductHistoryData] = useState<any>(null);
  const [activeStep, setActiveStep] = useState<'customer' | 'delivery' | 'terms' | 'search' | 'qty' | 'price' | 'adjust' | 'table'>('customer');

  // Selected row in table
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);

  // Validation modals
  const [showStockAlert, setShowStockAlert] = useState(false);
  const [stockAlertMsg, setStockAlertMsg] = useState('');
  const [showZeroStockPopup, setShowZeroStockPopup] = useState(false);
  const [zeroStockProduct, setZeroStockProduct] = useState<Product | null>(null);
  const [showEmptyQtyAlert, setShowEmptyQtyAlert] = useState(false);
  const [showSoNotFoundPopup, setShowSoNotFoundPopup] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Print Dialog Modal
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [completedSoId, setCompletedSoId] = useState<string | null>(null);
  const [completedSo, setCompletedSo] = useState<any | null>(null);
  const [showConfirmPrintModal, setShowConfirmPrintModal] = useState(false);
  const [sortOption, setSortOption] = useState<'asli' | 'abjad' | 'qty' | 'harga'>('asli');

  // Cancellation & Draft confirmation modals
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showDraftConfirmModal, setShowDraftConfirmModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Focus Refs
  const soSearchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const deliverySelectRef = useRef<HTMLDivElement>(null);
  const termsSelectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const adjustmentDescRef = useRef<HTMLInputElement>(null);
  const adjustmentAmountRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const customerPopupRef = useRef<HTMLDivElement>(null);
  const productPopupRef = useRef<HTMLDivElement>(null);
  const customerItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const productItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (showCustomerPopup) {
      const target = customerItemRefs.current[focusedCustIdx];
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedCustIdx, showCustomerPopup]);

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

  const btnAsliRef = useRef<HTMLButtonElement>(null);
  const btnAbjadRef = useRef<HTMLButtonElement>(null);
  const btnQtyRef = useRef<HTMLButtonElement>(null);
  const btnHargaRef = useRef<HTMLButtonElement>(null);

  // Focus modal popups when shown
  useEffect(() => {
    if (showCustomerPopup) {
      customerPopupRef.current?.focus();
    }
  }, [showCustomerPopup]);

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

  // Load Draft SO details
  const loadDraftSO = async (queryStr: string) => {
    if (!queryStr) return;
    setIsLoading(true);
    try {
      const res = await api.get('/sales?status=draft');
      const drafts = res.data.data || [];
      const match = drafts.find((d: any) => d.no_order.toLowerCase() === queryStr.trim().toLowerCase());

      if (!match) {
        setShowSoNotFoundPopup(true);
        setIsLoading(false);
        return;
      }

      // Load specific SO details
      const detailRes = await api.get(`/sales/${match.id}`);
      const so = detailRes.data;

      setActiveSo(so);
      setDiantar(so.diantar);
      setLimitBulan(so.limit_bulan);
      setAdjustmentDesc(so.extra_charge_desc || '');
      setAdjustmentAmount(Number(so.extra_charge_amount) || 0);
      setAdjustmentAmountInput(formatRupiahInput(Number(so.extra_charge_amount) || 0));
      setSenderNote(so.sender_note || '');
      setItems(so.sale_items.map((i: any) => ({
        product_id: i.product_id,
        product_kode: i.product_kode,
        product_nama: i.product_nama,
        qty: Number(i.qty),
        unit_price: Number(i.unit_price),
        total: Number(i.total),
      })));

      // Set customer selection info
      setSelectedCustomer({
        id: so.customer_id,
        kode: so.customer.kode,
        nama: so.customer_nama,
        alamat: so.customer_alamat,
        no_telp: so.customer_telp,
        limit_kredit: Number(so.customer.limit_kredit) || 0,
        saldo_piutang: Number(so.customer.saldo_piutang) || 0
      });
      setCustomerQuery(so.customer_nama);

      setActiveStep('customer');
      setTimeout(() => customerInputRef.current?.focus(), 150);
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat detail Draft SO.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (noOrderParam) {
      loadDraftSO(noOrderParam);
    } else {
      setTimeout(() => soSearchInputRef.current?.focus(), 150);
    }
  }, [noOrderParam]);

  // Fetch customers
  useEffect(() => {
    if (!customerQuery || (selectedCustomer && selectedCustomer.nama === customerQuery)) {
      setCustomers([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.get(`/customers?q=${customerQuery}`);
        setCustomers(res.data.data || []);
        setFocusedCustIdx(0);
      } catch (err) {
        console.error(err);
      }
    }, 150);

    return () => clearTimeout(delay);
  }, [customerQuery, selectedCustomer]);

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

  const handleSoSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soQuery) return;
    await loadDraftSO(soQuery);
  };

  // Keyboard autocomplete controls
  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCustomer && customerQuery.trim().toLowerCase() === selectedCustomer.nama.toLowerCase()) {
        setActiveStep('delivery');
        setTimeout(() => deliverySelectRef.current?.focus(), 50);
      } else {
        setShowCustomerPopup(true);
        setFocusedCustIdx(0);
      }
    }
  };

  const handleCustomerPopupKeyDown = (e: React.KeyboardEvent) => {
    if (customers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedCustIdx((prev) => (prev + 1) % customers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedCustIdx((prev) => (prev - 1 + customers.length) % customers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectCustomer(customers[focusedCustIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowCustomerPopup(false);
      customerInputRef.current?.focus();
    }
  };

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.nama);
    setShowCustomerPopup(false);

    setActiveStep('delivery');
    setTimeout(() => deliverySelectRef.current?.focus(), 50);
  };

  const handleDeliveryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setDiantar((prev) => !prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setActiveStep('terms');
      setTimeout(() => termsSelectRef.current?.focus(), 50);
    }
  };

  const handleTermsKeyDown = (e: React.KeyboardEvent) => {
    const list = [0, 1, 2, 3];
    const currIdx = list.indexOf(limitBulan);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setLimitBulan(list[(currIdx + 1) % list.length]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setLimitBulan(list[(currIdx - 1 + list.length) % list.length]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setActiveStep('search');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
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

  const handleProductPopupKeyDown = (e: React.KeyboardEvent) => {
    if (products.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedProdIdx((prev) => (prev + 1) % products.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedProdIdx((prev) => (prev - 1 + products.length) % products.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectProduct(products[focusedProdIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowProductPopup(false);
      searchInputRef.current?.focus();
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
      const res = await api.get(`/customers/${selectedCustomer?.id}/product-history/${p.id}`);
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

    setTimeout(() => qtyInputRef.current?.focus(), 50);
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

  const addItemToTable = () => {
    if (!selectedProd) return;
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
    searchInputRef.current?.focus();
  };

  const deleteRow = (idx: number) => {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      if (updated.length === 0) {
        setSelectedRowIdx(null);
        setActiveStep('search');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        setSelectedRowIdx((prevIdx) => (prevIdx !== null && prevIdx >= updated.length) ? updated.length - 1 : prevIdx);
      }
      return updated;
    });
    showToast('Item berhasil dihapus dari daftar', 'success');
  };

  const handleUpdateSO = async (isFinal: boolean, toDraftPage?: boolean) => {
    if (!activeSo || !selectedCustomer || items.length === 0) return;

    setIsSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomer.id,
        customer_nama: selectedCustomer.nama,
        customer_alamat: selectedCustomer.alamat,
        customer_telp: selectedCustomer.no_telp,
        diantar,
        limit_bulan: limitBulan,
        extra_charge_desc: adjustmentDesc,
        extra_charge_amount: adjustmentAmount,
        sender_note: senderNote,
        items,
      };

      await api.put(`/sales/${activeSo.id}`, payload);

      if (isFinal) {
        await api.patch(`/sales/${activeSo.id}/complete`);
        const printRes = await api.patch(`/sales/${activeSo.id}/print`);
        setCompletedSo(printRes.data);
        setCompletedSoId(activeSo.id);
        showToast('Order SO berhasil disimpan', 'success');
        setShowConfirmPrintModal(false);
        setTimeout(() => {
          window.print();
          navigate('/penjualan');
        }, 300);
      } else {
        showToast('Draft SO berhasil disimpan', 'success');
        setShowDraftConfirmModal(false);
        if (toDraftPage) {
          navigate('/penjualan/draft');
        } else {
          navigate('/penjualan');
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || (isFinal ? 'Gagal menyimpan order SO' : 'Gagal menyimpan draft SO'), 'error');
    } finally {
      setIsSaving(false);
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
      handleUpdateSO(false);
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      handleUpdateSO(true);
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

  const handleCancelConfirmModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowCancelConfirmModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setShowCancelConfirmModal(false);
      navigate('/penjualan/draft');
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
      handleUpdateSO(false, true);
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
  // F1: Focus customer search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (activeSo) {
      setActiveStep('customer');
      customerInputRef.current?.focus();
      customerInputRef.current?.select();
    }
  }, { enableOnFormTags: true });

  // F2: Focus product search
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (activeSo) {
      setActiveStep('search');
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true });

  // F3: Focus Adjustment & Notes panel
  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (activeSo) {
      setActiveStep('adjust');
      adjustmentDescRef.current?.focus();
      adjustmentDescRef.current?.select();
    }
  }, { enableOnFormTags: true });

  // F4: Focus first row in table
  useHotkeys('f4', (e) => {
    e.preventDefault();
    if (activeSo && items.length > 0) {
      setActiveStep('table');
      setSelectedRowIdx(0);
    }
  }, { enableOnFormTags: true });

  // F10 or Ctrl+S: Show print dialog modal
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (activeSo && items.length > 0) {
      setShowConfirmPrintModal(true);
    }
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+s', (e) => {
    e.preventDefault();
    if (activeSo && items.length > 0) {
      setShowConfirmPrintModal(true);
    }
  }, { enableOnFormTags: true });

  // Delete row shortcut
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
    } else if (showSoNotFoundPopup) {
      setShowSoNotFoundPopup(false);
      setTimeout(() => soSearchInputRef.current?.focus(), 50);
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
    } else if (showCustomerPopup) {
      setShowCustomerPopup(false);
      customerInputRef.current?.focus();
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
      if (activeSo) {
        setShowCancelConfirmModal(true);
      } else {
        navigate('/penjualan');
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
    } else if (showSoNotFoundPopup) {
      e.preventDefault();
      setShowSoNotFoundPopup(false);
      setTimeout(() => {
        soSearchInputRef.current?.focus();
        soSearchInputRef.current?.select();
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

  const itemsSubtotal = items.reduce((sum, i) => sum + i.total, 0);
  const grandTotal = itemsSubtotal + adjustmentAmount;

  return (
    <div className="space-y-6" onKeyDown={handleGlobalKeyDown}>
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Edit Nota SO</h1>
            <p className="text-slate-400">Modifikasi isi order SO draft aktif</p>
          </div>
        </div>

        {!activeSo ? (
          /* Search Layout */
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6 mt-8">
            {/* Search Form Card */}
            <div className="md:col-span-3 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Search size={18} className="text-primary-600" />
                <span>Cari Draft Penjualan</span>
              </h3>
              <form onSubmit={handleSoSearchSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Nomor SO Draft</label>
                  <input
                    ref={soSearchInputRef}
                    type="text"
                    required
                    value={soQuery}
                    onChange={(e) => setSoQuery(e.target.value)}
                    placeholder="Contoh: 260001"
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
            <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 text-xs text-slate-605 flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider">Petunjuk Edit SO</h4>
                <ul className="space-y-2 list-decimal list-inside text-slate-500 leading-relaxed">
                  <li>Cari nomor order SO bertipe <strong>Draft</strong> untuk melakukan perubahan.</li>
                  <li>Masukkan nomor order lengkap atau cari di menu <strong>Draft Order</strong>.</li>
                  <li>Modul ini memungkinkan penambahan barang, koreksi qty, diskon, dan catatan pengiriman sebelum faktur dicetak.</li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-400 font-mono">
                Tekan <kbd className="shortcut-badge">Esc</kbd> untuk kembali ke menu Penjualan.
              </div>
            </div>
          </div>
        ) : (
          /* Edit Form */
          <div className="space-y-6 animate-fade-in">
            {/* Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side (Forms and Items Table) */}
              <div className="lg:col-span-2 space-y-6">

                {/* Customer, Delivery & Terms Section */}
                <div className="card p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SO Number (Read-Only) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Nomor SO (Read-Only)</label>
                      <input
                        type="text"
                        readOnly
                        value={activeSo.no_order}
                        className="input-field bg-surface-900 border-surface-700 text-slate-500 font-mono py-2 text-xs"
                      />
                    </div>

                    {/* Customer Selection */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Pelanggan (F1)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <User size={14} />
                        </span>
                        <input
                          ref={customerInputRef}
                          type="text"
                          value={customerQuery}
                          onChange={(e) => setCustomerQuery(e.target.value)}
                          onFocus={() => {
                            setActiveStep('customer');
                          }}
                          onKeyDown={handleCustomerKeyDown}
                          placeholder="Cari nama pelanggan..."
                          className={`input-field pl-9 py-2 text-xs w-full ${activeStep === 'customer' ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Delivery Method */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Metode Pengiriman</label>
                      <div
                        ref={deliverySelectRef}
                        tabIndex={0}
                        onKeyDown={handleDeliveryKeyDown}
                        onFocus={() => setActiveStep('delivery')}
                        className={`flex gap-3 outline-none rounded-lg p-1 transition-all ${activeStep === 'delivery' ? 'ring-2 ring-primary-500/30 border border-primary-500/40' : 'border border-transparent'
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setDiantar(true);
                            setActiveStep('delivery');
                          }}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md border flex items-center justify-center gap-2 transition-all ${diantar
                              ? 'bg-primary-600/10 border-primary-500 text-primary-400 shadow'
                              : 'bg-surface-900 border-surface-700/60 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          <Truck size={14} />
                          <span>Diantar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDiantar(false);
                            setActiveStep('delivery');
                          }}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md border flex items-center justify-center gap-2 transition-all ${!diantar
                              ? 'bg-primary-600/10 border-primary-500 text-primary-400 shadow'
                              : 'bg-surface-900 border-surface-700/60 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          <User size={14} />
                          <span>Diambil</span>
                        </button>
                      </div>
                    </div>

                    {/* Terms / Limit Bulan */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Termin Pembayaran</label>
                      <div
                        ref={termsSelectRef}
                        tabIndex={0}
                        onKeyDown={handleTermsKeyDown}
                        onFocus={() => setActiveStep('terms')}
                        className={`flex gap-2 p-1 bg-surface-900 border border-surface-700 rounded-lg outline-none transition-all ${activeStep === 'terms' ? 'ring-2 ring-primary-500/20' : ''
                          }`}
                      >
                        {[
                          { val: 0, label: 'Tunai' },
                          { val: 1, label: '1 Bulan' },
                          { val: 2, label: '2 Bulan' },
                          { val: 3, label: '3 Bulan' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => {
                              setLimitBulan(opt.val);
                              setActiveStep('terms');
                            }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${limitBulan === opt.val
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
                </div>

                {/* Product Autocomplete Row */}
                <div className="card p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Product Search */}
                    <div className="md:col-span-2 relative">
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Cari Produk (F2)</label>
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Ketik kode atau nama produk..."
                        value={prodQuery}
                        onChange={(e) => setProdQuery(e.target.value)}
                        onFocus={() => {
                          setActiveStep('search');
                        }}
                        onKeyDown={handleProductKeyDown}
                        className="input-field w-full py-2 text-xs"
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
                        onFocus={() => setActiveStep('qty')}
                        onBlur={() => {
                          if (selectedProd && qty && Number(qty) > Number(selectedProd.stok)) {
                            const maxStok = Number(selectedProd.stok);
                            setQty(maxStok);
                            setStockAlertMsg(`Stok ${selectedProd.nama} tidak mencukupi. Tersedia: ${maxStok}. Kuantitas otomatis disesuaikan menjadi ${maxStok}.`);
                            setShowStockAlert(true);
                          }
                        }}
                        onKeyDown={handleQtyKeyDown}
                        className="input-field w-full py-2 text-xs text-right font-mono"
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
                        onFocus={() => setActiveStep('price')}
                        onKeyDown={handlePriceKeyDown}
                        className="input-field w-full py-2 text-xs text-right font-mono"
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
                              ref={idx === selectedRowIdx ? activeRowRef : null}
                              onClick={() => {
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

                {/* Grand Totals */}
                <div className="flex justify-end mt-2 animate-fade-in pr-4">
                  <div className="flex flex-col text-right space-y-1.5 min-w-[280px]">
                    <div className="flex justify-between items-center text-xs gap-4">
                      <span className="text-slate-400 font-medium">Subtotal Belanja:</span>
                      <span className="font-semibold text-slate-200 currency">{formatCurrency(itemsSubtotal)}</span>
                    </div>
                    {adjustmentAmount !== 0 && (
                      <div className="flex justify-between items-center text-xs gap-4">
                        <span className="text-slate-400 font-medium">Penyesuaian ({adjustmentDesc || 'F3'}):</span>
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

              {/* Right Side Column (Guides, Adjustments, and History Card) */}
              <div className="space-y-6 lg:col-span-1">
                {/* Price History Card */}
                {activeStep === 'price' && productHistoryData && (
                  <div className="card card-hovered p-6 space-y-4 animate-scale-in">
                    <div className="border-b border-surface-700 pb-3">
                      <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <ShoppingCart size={16} className="text-primary-400" />
                        <span>Analisis Riwayat Harga</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{selectedProd?.nama}</p>
                    </div>

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
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F1</kbd> untuk cari pelanggan</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F2</kbd> untuk cari produk</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F3</kbd> untuk Penyesuaian (Adj)</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F4</kbd> untuk menuju baris pertama tabel</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">Ctrl+S</kbd> untuk simpan</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">F10</kbd> untuk simpan draft</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">Delete</kbd> untuk menghapus baris terpilih</li>
                      <li>Tekan <kbd className="shortcut-badge text-[9px]">Esc</kbd> untuk batal edit SO</li>
                    </ul>
                  </div>
                )}

                {/* Adjustment & Notes Panel */}
                <div className="card card-hovered p-6 space-y-6 border border-surface-700 animate-scale-in">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-surface-700">Adjustment & Notes</h3>

                  {/* Adjustments */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Penjelasan Penyesuaian (F3)</label>
                      <input
                        ref={adjustmentDescRef}
                        type="text"
                        placeholder="Diskon khusus / Ongkos kirim..."
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
                        placeholder="Gunakan minus untuk diskon"
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
                    <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Catatan Pengiriman</label>
                    <textarea
                      ref={noteInputRef}
                      rows={3}
                      placeholder="Instruksi untuk sopir, no handphone, dll..."
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
        )}
      </div>

      {/* Empty Qty warning popup */}
      {showEmptyQtyAlert && (
        <ModalPortal>
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
        </ModalPortal>
      )}

      {/* Draft SO Not Found warning popup */}
      {showSoNotFoundPopup && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
          <div className="bg-white rounded-xl max-w-sm w-full mx-auto shadow-2xl animate-scale-in text-slate-800 overflow-hidden">
            <div className="bg-danger-600 text-white px-6 py-4 flex flex-col items-center justify-center gap-2">
              <AlertTriangle size={24} className="shrink-0 text-white" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-center">Draft SO Tidak Ditemukan</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-xs text-slate-650 leading-relaxed mb-6 font-medium">
                Nomor draft SO yang dicari tidak ditemukan. Pastikan status SO masih berupa <strong>Draft</strong>.
              </p>
              <div className="flex justify-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowSoNotFoundPopup(false);
                    setTimeout(() => {
                      soSearchInputRef.current?.focus();
                      soSearchInputRef.current?.select();
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

      {/* Stock warning modal */}
      {showStockAlert && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in text-center text-slate-200">
            <AlertCircle size={40} className="text-danger-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Stok Tidak Mencukupi</h3>
            <p className="text-xs text-slate-400 mb-6">{stockAlertMsg}</p>
            <button
              onClick={() => {
                setShowStockAlert(false);
                setTimeout(() => {
                  qtyInputRef.current?.focus();
                  qtyInputRef.current?.select();
                }, 50);
              }}
              className="w-full btn-primary justify-center py-2 text-xs font-bold bg-danger-600 hover:bg-danger-550 !text-white"
            >
              Tutup (Enter)
            </button>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Zero stock warning popup */}
      {showZeroStockPopup && zeroStockProduct && (
        <ModalPortal>
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
        </ModalPortal>
      )}

      {/* Print Confirmation Modal */}
      {showConfirmPrintModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            tabIndex={0}
            onKeyDown={handleConfirmPrintModalKeyDown}
            className="bg-white rounded-xl p-6 max-w-3xl w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-800"
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

            {/* Preview items table */}
            <div className="rounded-lg mt-4 overflow-hidden max-h-48 overflow-y-auto bg-slate-50">
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

            {/* Footer buttons */}
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
                onClick={() => handleUpdateSO(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all"
              >
                Simpan Draft (Enter)
              </button>
              <button
                type="button"
                onClick={() => handleUpdateSO(true)}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-500 transition-all shadow-md shadow-primary-500/10"
              >
                Print (P)
              </button>
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
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col text-slate-200"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-danger-400 border-b border-surface-700 pb-3 mb-4 text-center">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold text-white">Batal Edit SO</h3>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed mb-6 font-medium text-center">
              Keluar dari pengeditan draft SO? Seluruh perubahan yang belum disimpan akan hilang sepenuhnya.
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
                  navigate('/penjualan/draft');
                }}
                className="btn-primary py-2 px-4 text-xs bg-danger-600 hover:bg-danger-500 font-bold"
              >
                Keluar (Enter)
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
                  handleUpdateSO(false, true);
                }}
                className="btn-primary py-2 px-4 text-xs bg-amber-500 hover:bg-amber-600 font-bold text-black"
              >
                Simpan & Ke Draft (Enter)
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}



      {/* Customer Selection Popup Modal */}
      {showCustomerPopup && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={customerPopupRef}
            tabIndex={0}
            onKeyDown={handleCustomerPopupKeyDown}
            className="bg-slate-100 border border-slate-200 rounded-xl max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            {/* Blue Header */}
            <div className="bg-primary-600 px-6 py-4 flex items-center justify-between text-white border-b border-primary-700/80 rounded-t-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={18} className="text-white" />
                <span>Pilih Pelanggan</span>
              </h3>
              <button onClick={() => setShowCustomerPopup(false)} className="text-white hover:text-white/80 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 p-6 bg-slate-50">
              {customers.length > 0 ? (
                customers.map((cust, idx) => (
                  <button
                    key={cust.id}
                    ref={(el) => {
                      customerItemRefs.current[idx] = el;
                    }}
                    onClick={() => selectCustomer(cust)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${idx === focusedCustIdx
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-semibold ring-2 ring-emerald-500/20 scale-[1.01]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-800 bg-white'
                      }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === focusedCustIdx ? 'text-emerald-900' : 'text-slate-900'}`}>{cust.nama}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{cust.kode}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Tidak ada pelanggan yang cocok dengan "{customerQuery}".
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex justify-between text-[11px] text-slate-500 rounded-b-xl">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> untuk konfirmasi, <kbd className="shortcut-badge">Esc</kbd> batal</span>
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
            className="bg-slate-100 border border-slate-200 rounded-xl max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            {/* Blue Header */}
            <div className="bg-primary-600 px-6 py-4 flex items-center justify-between text-white border-b border-primary-700/80 rounded-t-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={18} className="text-white" />
                <span>Pilih Produk</span>
              </h3>
              <button onClick={() => setShowProductPopup(false)} className="text-white hover:text-white/80 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 p-6 bg-slate-50">
              {products.length > 0 ? (
                products.map((p, idx) => (
                  <button
                    key={p.id}
                    ref={(el) => {
                      productItemRefs.current[idx] = el;
                    }}
                    onClick={() => selectProduct(p)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${idx === focusedProdIdx
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-semibold ring-2 ring-emerald-500/20 scale-[1.01]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-800 bg-white'
                      }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === focusedProdIdx ? 'text-emerald-900 font-bold' : 'text-slate-900'}`}>{p.nama}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{p.kode}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-bold">Stok: {p.stok} {p.satuan}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Tidak ada produk yang cocok dengan "{prodQuery}".
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex justify-between text-[11px] text-slate-500 rounded-b-xl">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> untuk konfirmasi, <kbd className="shortcut-badge">Esc</kbd> batal</span>
            </div>
          </div>
        </div>
        </ModalPortal>
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
                  <p>Subtotal: {formatCurrency(itemsSubtotal)}</p>
                  {Number(completedSo.extra_charge_amount) !== 0 && (
                    <p>Adj ({completedSo.extra_charge_desc}): {formatCurrency(Number(completedSo.extra_charge_amount))}</p>
                  )}
                  <p className="font-bold text-xs">Total: {formatCurrency(Number(completedSo.subtotal))}</p>
                </div>
                <div className="text-center text-[10px] mt-4 pt-2 border-t border-dashed border-black">
                  <p>Terima Kasih</p>
                  <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
                </div>
              </div>
            ) : (
              /* A4 Print Layout */
              <div className="w-[190mm] mx-auto p-4 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-black pb-4">
                  <div>
                    <h2 className="font-extrabold text-lg uppercase tracking-wide">Maju Mulia Bersama</h2>
                    <p className="text-xs text-slate-500 mt-1">Jl. Raya Industri Utama No. 88, Bekasi</p>
                    <p className="text-xs text-slate-500">Telp: 021-89876543 | Fax: 021-89876544</p>
                  </div>
                  <div className="text-right">
                    <h1 className="font-black text-2xl uppercase tracking-wider text-slate-800">Faktur Penjualan</h1>
                    <p className="font-mono text-sm font-bold text-slate-700 mt-1">No. Faktur: {completedSo.no_faktur || completedSo.no_order}</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-8 text-xs">
                  <div className="space-y-1">
                    <p className="font-bold uppercase text-slate-500">Kepada Yth:</p>
                    <p className="font-bold text-slate-900 text-sm">{completedSo.customer_nama}</p>
                    <p className="text-slate-600">Alamat: {completedSo.customer_alamat || '-'}</p>
                    <p className="text-slate-600">Telp: {completedSo.customer_telp || '-'}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="font-bold uppercase text-slate-500">Detail Transaksi:</p>
                    <p className="font-semibold">Tanggal Order: {formatDate(completedSo.order_date)}</p>
                    <p className="font-semibold">Jatuh Tempo: {completedSo.limit_bulan > 0 ? `${completedSo.limit_bulan} Bulan` : 'Tunai'}</p>
                    <p className="font-bold text-slate-800">Status Pembayaran: {completedSo.limit_bulan > 0 ? 'Kredit (Belum Lunas)' : 'Lunas (Cash)'}</p>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-y-2 border-black bg-slate-50 text-slate-800 uppercase font-bold text-[10px]">
                      <th className="p-2 w-12 text-center">No</th>
                      <th className="p-2">Kode Barang</th>
                      <th className="p-2">Nama Barang</th>
                      <th className="p-2 text-right w-20">Qty</th>
                      <th className="p-2 text-right w-32">Harga Satuan</th>
                      <th className="p-2 text-right w-32">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedPrintItems.map((item: any, idx: number) => (
                      <tr key={idx} className="text-slate-800">
                        <td className="p-2 text-center font-bold">{idx + 1}</td>
                        <td className="p-2 font-mono font-medium">{item.product_kode}</td>
                        <td className="p-2 font-bold text-slate-900">{item.product_nama}</td>
                        <td className="p-2 text-right font-medium">{Number(item.qty)}</td>
                        <td className="p-2 text-right font-mono font-medium">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="p-2 text-right font-mono font-bold">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary & Note footer */}
                <div className="grid grid-cols-12 gap-4 border-t-2 border-black pt-4">
                  <div className="col-span-7 text-xs space-y-3">
                    <div>
                      <p className="font-bold uppercase text-slate-500">Pengiriman & Catatan:</p>
                      <p className="font-semibold">{completedSo.diantar ? '🚚 DIANTAR SOPIR' : '🚶 DIAMBIL SENDIRI'}</p>
                      {completedSo.sender_note && <p className="italic mt-1">"{completedSo.sender_note}"</p>}
                    </div>
                  </div>
                  <div className="col-span-5 text-right">
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        <tr>
                          <td className="p-1.5 text-right font-bold text-slate-600 uppercase">Subtotal Belanja:</td>
                          <td className="p-1.5 text-right font-bold w-36">{formatCurrency(itemsSubtotal)}</td>
                        </tr>
                        {Number(completedSo.extra_charge_amount) !== 0 && (
                          <tr>
                            <td colSpan={1} className="p-1.5 text-right font-bold uppercase text-slate-650">
                              Penyesuaian ({completedSo.extra_charge_desc})
                            </td>
                            <td className="p-1.5 text-right font-bold text-emerald-600">
                              {formatCurrency(Number(completedSo.extra_charge_amount))}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t border-slate-300">
                          <td className="p-2 text-right font-black text-slate-800 uppercase text-sm">Grand Total:</td>
                          <td className="p-2 text-right font-black text-sm text-emerald-700">{formatCurrency(Number(completedSo.subtotal))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signature boxes */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs pt-12">
                  <div className="space-y-12">
                    <p>Penerima / Customer,</p>
                    <p className="font-bold border-b border-slate-400 w-36 mx-auto pb-1">( __________________ )</p>
                  </div>
                  <div className="space-y-12">
                    <p>Sopir / Pengirim,</p>
                    <p className="font-bold border-b border-slate-400 w-36 mx-auto pb-1">( __________________ )</p>
                  </div>
                  <div className="space-y-12">
                    <p>Hormat Kami,</p>
                    <p className="font-bold border-b border-slate-400 w-36 mx-auto pb-1">( __________________ )</p>
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
