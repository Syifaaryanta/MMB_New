import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate, todayString } from '@/lib/utils';
import {
  Search,
  X,
  Calendar,
  User,
  ShoppingBag,
  Info,
  ChevronRight,
  Printer,
  Trash2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  no_telp: string | null;
  saldo_piutang: number;
  limit_kredit: number;
}

interface Product {
  id: string;
  kode: string;
  nama: string;
  stok: number;
  satuan: string;
  harga_jual: number;
}

interface PurchaseHistoryItem {
  sale_id: string;
  no_order: string;
  no_faktur: string | null;
  order_date: string;
  limit_bulan: number;
  unit_price: number;
  qty_beli: number;
  qty_sudah_retur: number;
  qty_remaining: number;
  qty_retur: number;
  kondisi: 'bagus' | 'rusak';
  catatan?: string;
}

interface SelectedProduct {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  history: PurchaseHistoryItem[];
}

interface CompletedReturnSlip {
  no_retur: string;
  no_faktur: string | null;
  customer_nama: string;
  retur_date: string;
  total: number;
  catatan: string | null;
  items: {
    product_kode: string;
    product_nama: string;
    qty: number;
    unit_price: number;
    total: number;
    kondisi: string;
    satuan: string;
  }[];
}

export const ReturPenjualan: React.FC = () => {
  const navigate = useNavigate();

  // Basic Form States
  const [returMetaSaved] = useState(() => {
    const saved = sessionStorage.getItem('retur_so_meta');
    return saved ? JSON.parse(saved) : null;
  });

  const [noRetur, setNoRetur] = useState(returMetaSaved?.noRetur || '');
  const [returDate, setReturDate] = useState(returMetaSaved?.returDate || todayString());
  const [formError, setFormError] = useState<string | null>(null);

  // Focus Steps and Card Navigation State
  const [activeStep, setActiveStep] = useState<'customer' | 'product' | 'date' | 'catatan' | 'cards' | 'qty' | 'condition'>(
    returMetaSaved?.activeStep || 'customer'
  );
  const [focusedCardIdx, setFocusedCardIdx] = useState(returMetaSaved ? Number(returMetaSaved.focusedCardIdx) : 0);
  const [focusedCondition, setFocusedCondition] = useState<'bagus' | 'rusak'>('bagus');

  // Customer Autocomplete States
  const [customerQuery, setCustomerQuery] = useState(returMetaSaved?.customerQuery || '');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(returMetaSaved?.customer || null);
  const [focusedCustIdx, setFocusedCustIdx] = useState(0);

  // Product Autocomplete States
  const [productQuery, setProductQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [focusedProdIdx, setFocusedProdIdx] = useState(0);

  // Selected Products with history cards
  const [returnProducts, setReturnProducts] = useState<SelectedProduct[]>(() => {
    const saved = sessionStorage.getItem('retur_so_products');
    return saved ? JSON.parse(saved) : [];
  });

  // Print Modals and Completed Return state
  const [showConfirmPrintModal, setShowConfirmPrintModal] = useState(false);
  const [completedReturns, setCompletedReturns] = useState<CompletedReturnSlip[]>([]);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Refs for focusing
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const customerPopupRef = useRef<HTMLDivElement>(null);
  const productPopupRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const cardContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const qtyInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const bagusBtnRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const rusakBtnRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const catatanInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Generate return number
  const loadReturnNumber = async () => {
    try {
      const res = await api.get('/sale-returns/generate-no');
      setNoRetur(res.data.no_retur);
    } catch (err) {
      console.error(err);
      setNoRetur('RJ26XXXX');
    }
  };

  useEffect(() => {
    if (!noRetur) {
      loadReturnNumber();
    }
    setTimeout(() => {
      if (activeStep === 'customer') {
        customerSearchRef.current?.focus();
      } else if (activeStep === 'product') {
        productSearchRef.current?.focus();
      } else if (activeStep === 'date') {
        dateInputRef.current?.focus();
      } else if (flatHistoryCards.length > 0) {
        const card = flatHistoryCards[focusedCardIdx] || flatHistoryCards[0];
        if (card) {
          const cardKey = `${card.productId}-${card.sale_id}`;
          if (activeStep === 'cards') {
            cardContainerRefs.current[cardKey]?.focus();
          } else if (activeStep === 'qty') {
            qtyInputRefs.current[cardKey]?.focus();
            qtyInputRefs.current[cardKey]?.select();
          } else if (activeStep === 'condition') {
            const btn = focusedCondition === 'rusak' ? rusakBtnRefs.current[cardKey] : bagusBtnRefs.current[cardKey];
            btn?.focus();
          } else if (activeStep === 'catatan') {
            catatanInputRefs.current[cardKey]?.focus();
          }
        }
      } else {
        customerSearchRef.current?.focus();
      }
    }, 150);
  }, []);

  // Sync to sessionStorage on change
  useEffect(() => {
    const meta = {
      noRetur,
      returDate,
      customer: selectedCustomer,
      customerQuery,
      activeStep,
      focusedCardIdx,
    };
    sessionStorage.setItem('retur_so_meta', JSON.stringify(meta));
  }, [noRetur, returDate, selectedCustomer, customerQuery, activeStep, focusedCardIdx]);

  useEffect(() => {
    sessionStorage.setItem('retur_so_products', JSON.stringify(returnProducts));
  }, [returnProducts]);

  // Search Customers
  useEffect(() => {
    if (customerQuery.trim().length >= 2 && !selectedCustomer) {
      const delay = setTimeout(async () => {
        try {
          const res = await api.get(`/customers?q=${customerQuery}`);
          setCustomers(res.data.data || []);
          setFocusedCustIdx(0);
        } catch (err) {
          console.error(err);
        }
      }, 200);
      return () => clearTimeout(delay);
    } else {
      setCustomers([]);
    }
  }, [customerQuery, selectedCustomer]);

  // Search Products
  useEffect(() => {
    if (productQuery.trim().length >= 2) {
      const delay = setTimeout(async () => {
        try {
          const res = await api.get(`/products?q=${productQuery}`);
          setProducts(res.data.data || []);
          setFocusedProdIdx(0);
        } catch (err) {
          console.error(err);
        }
      }, 200);
      return () => clearTimeout(delay);
    } else {
      setProducts([]);
    }
  }, [productQuery]);

  // Focus autocomplete modals when shown
  useEffect(() => {
    if (showCustomerPopup) {
      setTimeout(() => {
        customerPopupRef.current?.focus();
      }, 50);
    }
  }, [showCustomerPopup]);

  useEffect(() => {
    if (showProductPopup) {
      setTimeout(() => {
        productPopupRef.current?.focus();
      }, 50);
    }
  }, [showProductPopup]);

  // Flat history list for navigation
  const flatHistoryCards = returnProducts.flatMap(p =>
    p.history.map(h => ({
      productId: p.id,
      productName: p.nama,
      productKode: p.kode,
      satuan: p.satuan,
      key: `${p.id}-${h.sale_id}`,
      ...h
    }))
  );

  // Hotkeys: Escape to close modal
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showConfirmPrintModal) {
      setShowConfirmPrintModal(false);
    }
  }, { enableOnFormTags: true }, [showConfirmPrintModal]);

  // Hotkeys for Customer Autocomplete input
  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCustomer && customerQuery.trim().toLowerCase() === selectedCustomer.nama.toLowerCase()) {
        setActiveStep('product');
        setTimeout(() => productSearchRef.current?.focus(), 50);
      } else {
        setShowCustomerPopup(true);
        setFocusedCustIdx(0);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      navigate('/penjualan');
    }
  };

  const handleCustomerPopupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowCustomerPopup(false);
      customerSearchRef.current?.focus();
      return;
    }
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
    }
  };

  // Hotkeys for Product Autocomplete input
  const handleProductKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setShowProductPopup(true);
      setFocusedProdIdx(0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      navigate('/penjualan');
    }
  };

  const handleProductPopupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowProductPopup(false);
      productSearchRef.current?.focus();
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
      selectProduct(products[focusedProdIdx]);
    }
  };

  const handleDateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (flatHistoryCards.length > 0) {
        setActiveStep('cards');
        setFocusedCardIdx(0);
        const firstCard = flatHistoryCards[0];
        const cardKey = `${firstCard.productId}-${firstCard.sale_id}`;
        setTimeout(() => cardContainerRefs.current[cardKey]?.focus(), 50);
      } else {
        dateInputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      navigate('/penjualan');
    }
  };

  // Keyboard Shortcuts for popup confirmation modal
  useHotkeys('p, P', (e) => {
    if (showConfirmPrintModal) {
      e.preventDefault();
      handleConfirmSaveAndPrint();
    }
  }, { enableOnFormTags: true }, [showConfirmPrintModal, returnProducts, returDate, selectedCustomer]);

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.nama);
    setShowCustomerPopup(false);
    setReturnProducts([]);
    setFormError(null);
    setActiveStep('product');
    setTimeout(() => {
      productSearchRef.current?.focus();
    }, 100);
  };

  const resetCustomer = () => {
    setSelectedCustomer(null);
    setReturnProducts([]);
    setFormError(null);
    setActiveStep('customer');
    setTimeout(() => {
      customerSearchRef.current?.focus();
      customerSearchRef.current?.select();
    }, 100);
  };

  const selectProduct = async (p: Product) => {
    if (!selectedCustomer) return;

    if (returnProducts.some(rp => rp.id === p.id)) {
      showToast('Barang sudah ditambahkan ke daftar retur.', 'error');
      setProductQuery('');
      setShowProductPopup(false);
      return;
    }

    try {
      const res = await api.get(
        `/sale-returns/customer-history?customer_id=${selectedCustomer.id}&product_id=${p.id}`
      );
      const historyList: PurchaseHistoryItem[] = res.data.map((item: any) => ({
        ...item,
        qty_retur: 0,
        kondisi: 'bagus' as const,
        catatan: ''
      }));

      if (historyList.length === 0) {
        setFormError(`Customer "${selectedCustomer.nama}" belum pernah membeli "${p.nama}" di sistem.`);
        showToast('Customer belum pernah membeli barang ini.', 'error');
      } else {
        setFormError(null);
        setReturnProducts(prev => [
          ...prev,
          {
            id: p.id,
            kode: p.kode,
            nama: p.nama,
            satuan: p.satuan,
            history: historyList
          }
        ]);

        setActiveStep('date');
        setTimeout(() => {
          dateInputRef.current?.focus();
        }, 100);
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat riwayat penjualan customer.', 'error');
    }

    setProductQuery('');
    setShowProductPopup(false);
  };

  const removeProduct = (prodId: string) => {
    setReturnProducts(prev => prev.filter(rp => rp.id !== prodId));
  };

  const handleQtyCardChange = (prodId: string, saleId: string, val: string) => {
    const qty = parseFloat(val) || 0;
    setReturnProducts(prev =>
      prev.map(p => {
        if (p.id === prodId) {
          const updatedHistory = p.history.map(h => {
            if (h.sale_id === saleId) {
              const cappedQty = Math.max(0, Math.min(qty, h.qty_remaining));
              return { ...h, qty_retur: cappedQty };
            }
            return h;
          });
          return { ...p, history: updatedHistory };
        }
        return p;
      })
    );
  };

  const handleKondisiCardChange = (prodId: string, saleId: string, kondisi: 'bagus' | 'rusak') => {
    setReturnProducts(prev =>
      prev.map(p => {
        if (p.id === prodId) {
          const updatedHistory = p.history.map(h => {
            if (h.sale_id === saleId) {
              return { ...h, kondisi };
            }
            return h;
          });
          return { ...p, history: updatedHistory };
        }
        return p;
      })
    );
  };

  const handleCatatanCardChange = (prodId: string, saleId: string, catatan: string) => {
    setReturnProducts(prev =>
      prev.map(p => {
        if (p.id === prodId) {
          const updatedHistory = p.history.map(h => {
            if (h.sale_id === saleId) {
              return { ...h, catatan };
            }
            return h;
          });
          return { ...p, history: updatedHistory };
        }
        return p;
      })
    );
  };

  // Card list and inner fields key handlers
  const handleCardContainerKeyDown = (e: React.KeyboardEvent, cardKey: string, idx: number) => {
    if (activeStep !== 'cards') return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = Math.min(idx + 1, flatHistoryCards.length - 1);
      setFocusedCardIdx(nextIdx);
      const nextCard = flatHistoryCards[nextIdx];
      const nextKey = `${nextCard.productId}-${nextCard.sale_id}`;
      setTimeout(() => cardContainerRefs.current[nextKey]?.focus(), 50);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx = Math.max(idx - 1, 0);
      setFocusedCardIdx(prevIdx);
      const prevCard = flatHistoryCards[prevIdx];
      const prevKey = `${prevCard.productId}-${prevCard.sale_id}`;
      setTimeout(() => cardContainerRefs.current[prevKey]?.focus(), 50);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setActiveStep('qty');
      setTimeout(() => {
        qtyInputRefs.current[cardKey]?.focus();
        qtyInputRefs.current[cardKey]?.select();
      }, 50);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const card = flatHistoryCards[idx];
      if (card) {
        removeProduct(card.productId);
        showToast('Produk berhasil dihapus dari daftar retur.', 'success');
        setActiveStep('product');
        setTimeout(() => {
          productSearchRef.current?.focus();
          productSearchRef.current?.select();
        }, 50);
      }
    }
  };

  const handleQtyInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, cardKey: string, productId: string, saleId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputEl = qtyInputRefs.current[cardKey];
      const val = inputEl ? parseFloat(inputEl.value) || 0 : 0;
      if (val > 0) {
        setActiveStep('condition');
        setFocusedCondition('bagus');
        setTimeout(() => {
          const btn = bagusBtnRefs.current[cardKey];
          if (btn) {
            btn.focus();
          }
        }, 50);
      } else {
        showToast('Masukkan Qty Diretur terlebih dahulu.', 'error');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveStep('cards');
      setTimeout(() => cardContainerRefs.current[cardKey]?.focus(), 50);
    }
  };

  const handleConditionKeyDown = (e: React.KeyboardEvent, cardKey: string, productId: string, saleId: string) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCond = focusedCondition === 'bagus' ? 'rusak' : 'bagus';
      setFocusedCondition(nextCond);
      if (nextCond === 'bagus') {
        bagusBtnRefs.current[cardKey]?.focus();
      } else {
        rusakBtnRefs.current[cardKey]?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleKondisiCardChange(productId, saleId, focusedCondition);
      setActiveStep('catatan');
      setTimeout(() => catatanInputRefs.current[cardKey]?.focus(), 50);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveStep('cards');
      setTimeout(() => cardContainerRefs.current[cardKey]?.focus(), 50);
    }
  };

  const handleCatatanCardKeyDown = (e: React.KeyboardEvent, cardKey: string, productId: string, saleId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setActiveStep('cards');
      setTimeout(() => cardContainerRefs.current[cardKey]?.focus(), 50);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveStep('cards');
      setTimeout(() => cardContainerRefs.current[cardKey]?.focus(), 50);
    }
  };

  // Global Keys Handler for F1, F2, F10
  const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F1') {
      e.preventDefault();
      resetCustomer();
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      setActiveStep('product');
      productSearchRef.current?.focus();
      productSearchRef.current?.select();
      return;
    }

    if (e.key === 'F10') {
      e.preventDefault();
      handlePrintTrigger();
      return;
    }

    if (e.key === 'PageDown') {
      e.preventDefault();
      window.scrollBy({ top: 400, behavior: 'smooth' });
      return;
    }

    if (e.key === 'PageUp') {
      e.preventDefault();
      window.scrollBy({ top: -400, behavior: 'smooth' });
      return;
    }

    if (e.key === 'Escape') {
      if (!showConfirmPrintModal && !showCustomerPopup && !showProductPopup) {
        if (activeStep === 'customer' || activeStep === 'product' || activeStep === 'date') {
          e.preventDefault();
          navigate('/penjualan');
        } else if (activeStep === 'cards' || activeStep === 'qty' || activeStep === 'condition' || activeStep === 'catatan') {
          e.preventDefault();
          setActiveStep('customer');
          customerSearchRef.current?.focus();
        }
      }
    }
  };

  const calculateTotalRefund = () => {
    let total = 0;
    for (const p of returnProducts) {
      for (const h of p.history) {
        total += h.qty_retur * h.unit_price;
      }
    }
    return total;
  };

  const calculateTotalItems = () => {
    let total = 0;
    for (const p of returnProducts) {
      for (const h of p.history) {
        total += h.qty_retur;
      }
    }
    return total;
  };

  const handlePrintTrigger = () => {
    setFormError(null);
    if (!selectedCustomer) {
      setFormError('Pilih customer terlebih dahulu.');
      return;
    }
    const totalItems = calculateTotalItems();
    if (totalItems <= 0) {
      setFormError('Masukkan jumlah retur minimal 1 barang di card riwayat penjualan.');
      return;
    }
    setShowConfirmPrintModal(true);
  };

  // Global Hotkeys for F1, F2, F10
  useHotkeys('f1', (e) => {
    e.preventDefault();
    resetCustomer();
  }, { enableOnFormTags: true }, [selectedCustomer]);

  useHotkeys('f2', (e) => {
    e.preventDefault();
    setActiveStep('product');
    productSearchRef.current?.focus();
    productSearchRef.current?.select();
  }, { enableOnFormTags: true });

  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (flatHistoryCards.length > 0) {
      setActiveStep('cards');
      setFocusedCardIdx(0);
      const firstCard = flatHistoryCards[0];
      const cardKey = `${firstCard.productId}-${firstCard.sale_id}`;
      setTimeout(() => cardContainerRefs.current[cardKey]?.focus(), 50);
    }
  }, { enableOnFormTags: true }, [flatHistoryCards]);

  useHotkeys('f10', (e) => {
    e.preventDefault();
    handlePrintTrigger();
  }, { enableOnFormTags: true }, [returnProducts, selectedCustomer]);

  const handleConfirmSaveAndPrint = async () => {
    if (!selectedCustomer) return;

    try {
      const itemsBySale = new Map<string, { product_id: string; product_kode: string; product_nama: string; qty: number; unit_price: number; kondisi: string }[]>();

      for (const p of returnProducts) {
        for (const h of p.history) {
          if (h.qty_retur > 0) {
            const list = itemsBySale.get(h.sale_id) || [];
            list.push({
              product_id: p.id,
              product_kode: p.kode,
              product_nama: p.nama,
              qty: h.qty_retur,
              unit_price: h.unit_price,
              kondisi: h.kondisi
            });
            itemsBySale.set(h.sale_id, list);
          }
        }
      }

      const createdSlips: CompletedReturnSlip[] = [];

      for (const [saleId, items] of Array.from(itemsBySale.entries())) {
        const saleCatatans = items.map((it: any) => {
          const prod = returnProducts.find(p => p.id === it.product_id);
          const hist = prod?.history.find(h => h.sale_id === saleId);
          return hist?.catatan;
        }).filter(Boolean);

        const payload = {
          sale_id: saleId,
          retur_date: returDate,
          metode_kompensasi: 'potong_piutang',
          catatan: saleCatatans.join(', ') || '',
          items
        };

        const saveRes = await api.post('/sale-returns', payload);
        const returnId = saveRes.data.id;

        const printRes = await api.patch(`/sale-returns/${returnId}/print`);
        const retData = printRes.data;

        createdSlips.push({
          no_retur: retData.no_retur,
          no_faktur: retData.no_faktur,
          customer_nama: retData.customer_nama,
          retur_date: retData.retur_date,
          total: Number(retData.total),
          catatan: retData.catatan,
          items: retData.items.map((it: any) => ({
            product_kode: it.product_kode,
            product_nama: it.product_nama,
            qty: Number(it.qty),
            unit_price: Number(it.unit_price),
            total: Number(it.total),
            kondisi: it.kondisi,
            satuan: it.product?.satuan || 'pcs'
          }))
        });
      }

      setCompletedReturns(createdSlips);
      showToast('Retur penjualan berhasil disimpan!', 'success');
      setShowConfirmPrintModal(false);

      setTimeout(() => {
        window.print();
        navigate('/history/retur');
      }, 300);

    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Gagal menyimpan retur penjualan.', 'error');
      setShowConfirmPrintModal(false);
    }
  };

  return (
    <div className="space-y-4" onKeyDown={handleGlobalKeyDown}>
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 print:hidden">
        <div>
          <div className="flex items-center gap-1.5 text-slate-550 text-xs">
            <span>Modul Penjualan</span>
            <ChevronRight size={12} />
            <span className="text-slate-900 font-medium">Retur Penjualan</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-950 mt-0.5 flex items-center gap-2">
            Retur Penjualan (Sales Return)
          </h1>
        </div>
      </div>

      {/* CREATE VIEW FORM */}
      <div className="card card-hovered p-4 bg-white border border-blue-100 shadow-md space-y-4 animate-fade-in print:hidden">
        <div className="flex items-center justify-between border-b border-blue-50 pb-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">Formulir Retur Penjualan Tanpa Nota</h2>
          </div>
          <button
            onClick={() => navigate('/penjualan')}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="text-xs font-semibold">{formError}</div>
          </div>
        )}

        {/* Compact Single-Row Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Search */}
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <User size={12} className="text-slate-400" />
              Customer (F1)
            </label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between border border-blue-100 bg-blue-50/20 rounded-lg py-1 px-2.5 h-8">
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 truncate">{selectedCustomer.nama}</p>
                </div>
                <button
                  type="button"
                  onClick={resetCustomer}
                  className="p-0.5 hover:bg-blue-100 rounded text-slate-500 hover:text-slate-700 transition-colors ml-1"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <input
                ref={customerSearchRef}
                type="text"
                placeholder="Ketik nama customer..."
                value={customerQuery}
                onFocus={() => setActiveStep('customer')}
                onChange={(e) => setCustomerQuery(e.target.value)}
                onKeyDown={handleCustomerKeyDown}
                className="input-field w-full py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white h-8"
                autoComplete="off"
              />
            )}
          </div>

          {/* Product Search */}
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <Search size={12} className="text-slate-400" />
              Cari & Tambah Barang (F2)
            </label>
            <input
              ref={productSearchRef}
              type="text"
              placeholder={selectedCustomer ? "Cari barang..." : "Pilih customer dulu..."}
              value={productQuery}
              onFocus={() => setActiveStep('product')}
              onChange={(e) => setProductQuery(e.target.value)}
              onKeyDown={handleProductKeyDown}
              disabled={!selectedCustomer}
              className="input-field w-full py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-slate-55 disabled:text-slate-400 h-8"
              autoComplete="off"
            />
          </div>

          {/* Return Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
              <Calendar size={12} className="text-slate-400" />
              Tanggal Retur
            </label>
            <input
              ref={dateInputRef}
              type="date"
              value={returDate}
              onFocus={() => setActiveStep('date')}
              onKeyDown={handleDateKeyDown}
              onChange={(e) => setReturDate(e.target.value)}
              className="input-field w-full py-1 px-3 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white h-8"
            />
          </div>
        </div>

        {/* LIST OF PRODUCTS AND THEIR PURCHASE CARDS */}
        <div className="space-y-3">
          <div className="bg-blue-50/40 px-4 py-2 border-t border-b border-blue-100/60 flex items-center gap-2">
            <ShoppingBag size={14} className="text-blue-500" />
            <span className="font-extrabold text-[10px] text-slate-700 uppercase tracking-wider">Kartu Riwayat Penjualan </span>
          </div>

          {returnProducts.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-blue-100/60 rounded-xl text-slate-400 text-xs bg-slate-55/20">
              <Info size={24} className="mx-auto text-slate-300 mb-1" />
              Daftar barang kosong. Cari dan tambah barang di atas untuk memuat riwayat.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {returnProducts.map((p) => (
                <div key={p.id} className="border border-blue-100 rounded-xl overflow-hidden bg-white shadow-xs p-3.5 space-y-3">
                  {/* Product Header */}
                  <div className="flex items-center justify-between border-b border-blue-50/50 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-blue-50 text-blue-600 font-mono font-bold px-1.5 py-0.5 rounded tracking-wide border border-blue-100 uppercase">
                        {p.kode}
                      </span>
                      <h3 className="text-xs font-bold text-slate-800">{p.nama}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(p.id)}
                      className="p-0.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-400 transition-colors"
                      title="Hapus Produk"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* History Cards Stack */}
                  <div className="grid grid-cols-1 gap-3.5">
                    {p.history.map((h) => {
                      const cardKey = `${p.id}-${h.sale_id}`;
                      const flatIdx = flatHistoryCards.findIndex(c => c.key === cardKey);
                      const isFocusedCard = activeStep === 'cards' && focusedCardIdx === flatIdx;

                      return (
                        <div
                          ref={el => { cardContainerRefs.current[cardKey] = el; }}
                          tabIndex={0}
                          onFocus={(e) => {
                            if (e.target === e.currentTarget) {
                              setActiveStep('cards');
                              setFocusedCardIdx(flatIdx);
                            }
                          }}
                          onKeyDown={(e) => handleCardContainerKeyDown(e, cardKey, flatIdx)}
                          key={h.sale_id}
                          style={{ outline: 'none' }}
                          className={`border rounded-xl p-3 space-y-2.5 transition-all relative ${isFocusedCard
                            ? 'border-l-4 border-blue-600 bg-blue-100 shadow-md text-blue-950 border-blue-300 scale-[1.01]'
                            : h.qty_retur > 0
                              ? 'border-slate-200 bg-blue-50/10 shadow-xs'
                              : 'border-slate-200 bg-slate-50/20 hover:border-blue-200'
                            }`}
                        >
                          {/* Order info badge */}
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider block">Nota Asal</span>
                              <p className="text-xs font-bold text-slate-800 font-mono leading-none mt-0.5">{h.no_faktur || h.no_order}</p>
                            </div>
                            <span className="text-[9px] text-slate-500 font-medium">
                              {formatDate(h.order_date)}
                            </span>
                          </div>

                          {/* Order terms & prices */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 border border-slate-100 rounded-lg p-2">
                            <div>
                              <span className="text-slate-400">Harga Jual:</span>
                              <p className="font-semibold text-slate-705">{formatCurrency(h.unit_price)}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Sisa Beli:</span>
                              <p className="font-bold text-slate-800">{h.qty_remaining} {p.satuan}</p>
                            </div>
                          </div>

                          {/* Input Return Qty and Condition selector in an elegant side-by-side row */}
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-150/50">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Qty Diretur</span>
                              <div className="flex items-center border border-slate-300 rounded px-2 py-0.5 bg-white h-7 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                                <input
                                  ref={el => { qtyInputRefs.current[cardKey] = el; }}
                                  type="number"
                                  min={0}
                                  max={h.qty_remaining}
                                  step="any"
                                  placeholder="0"
                                  value={h.qty_retur || ''}
                                  onFocus={() => {
                                    setActiveStep('qty');
                                    setFocusedCardIdx(flatIdx);
                                  }}
                                  onKeyDown={(e) => handleQtyInputKeyDown(e, cardKey, p.id, h.sale_id)}
                                  onChange={(e) => handleQtyCardChange(p.id, h.sale_id, e.target.value)}
                                  style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                                  className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                                />
                                <span className="text-[9px] text-slate-400 font-bold ml-1">{p.satuan}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Kondisi Barang</span>
                              <div className="flex rounded border border-slate-300 overflow-hidden text-[9px] font-bold h-7">
                                <button
                                  ref={el => { bagusBtnRefs.current[cardKey] = el; }}
                                  type="button"
                                  onFocus={() => {
                                    setActiveStep('condition');
                                    setFocusedCardIdx(flatIdx);
                                    setFocusedCondition('bagus');
                                  }}
                                  onKeyDown={(e) => handleConditionKeyDown(e, cardKey, p.id, h.sale_id)}
                                  onClick={() => handleKondisiCardChange(p.id, h.sale_id, 'bagus')}
                                  className={`flex-1 py-1 text-center transition-all focus:ring-2 focus:ring-blue-500 focus:ring-inset focus:outline-none ${h.kondisi === 'bagus'
                                    ? 'bg-success-600 text-white'
                                    : 'bg-white text-slate-55 hover:bg-slate-50 focus:bg-blue-50/50'
                                    } ${h.qty_retur <= 0 ? 'opacity-40' : ''}`}
                                >
                                  Bagus
                                </button>
                                <button
                                  ref={el => { rusakBtnRefs.current[cardKey] = el; }}
                                  type="button"
                                  onFocus={() => {
                                    setActiveStep('condition');
                                    setFocusedCardIdx(flatIdx);
                                    setFocusedCondition('rusak');
                                  }}
                                  onKeyDown={(e) => handleConditionKeyDown(e, cardKey, p.id, h.sale_id)}
                                  onClick={() => handleKondisiCardChange(p.id, h.sale_id, 'rusak')}
                                  className={`flex-1 py-1 text-center transition-all focus:ring-2 focus:ring-blue-500 focus:ring-inset focus:outline-none ${h.kondisi === 'rusak'
                                    ? 'bg-danger-600 text-white'
                                    : 'bg-white text-slate-55 hover:bg-slate-50 focus:bg-blue-50/50'
                                    } ${h.qty_retur <= 0 ? 'opacity-40' : ''}`}
                                >
                                  Rusak
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Catatan / Keterangan per card */}
                          <div className="space-y-1 pt-2 border-t border-slate-150/50">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Catatan / Alasan Retur</span>
                            <div className="flex items-center border border-slate-300 rounded px-2 py-0.5 bg-slate-50 h-7 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                              <input
                                ref={el => { catatanInputRefs.current[cardKey] = el; }}
                                type="text"
                                placeholder="Alasan retur (opsional)..."
                                value={h.catatan || ''}
                                onFocus={() => {
                                  setActiveStep('catatan');
                                  setFocusedCardIdx(flatIdx);
                                }}
                                onKeyDown={(e) => handleCatatanCardKeyDown(e, cardKey, p.id, h.sale_id)}
                                onChange={(e) => handleCatatanCardChange(p.id, h.sale_id, e.target.value)}
                                style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                                className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions / Totals */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-3">
          <div className="text-[10px] text-slate-400 font-medium">
            Navigasi: <kbd className="shortcut-badge">F1</kbd> Customer, <kbd className="shortcut-badge">F2</kbd> Tambah Barang, <kbd className="shortcut-badge">F3</kbd> Pilih Kartu, <kbd className="shortcut-badge">F10</kbd> Simpan & Cetak.
          </div>

          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Pengembalian Uang</p>
              <p className="text-base font-extrabold text-blue-600 leading-none mt-1">{formatCurrency(calculateTotalRefund())}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/penjualan')}
                className="px-3.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={handlePrintTrigger}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <Printer size={13} />
                Cetak Retur (F10)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOMER SEARCH POPUP MODAL */}
      {showCustomerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={customerPopupRef}
            tabIndex={0}
            onKeyDown={handleCustomerPopupKeyDown}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Search size={18} className="text-blue-500" />
                <span>Pilih Pelanggan (Customer)</span>
              </h3>
              <button onClick={() => setShowCustomerPopup(false)} className="text-slate-400 hover:text-slate-650">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {customers.length > 0 ? (
                customers.map((cust, idx) => (
                  <button
                    type="button"
                    key={cust.id}
                    onClick={() => selectCustomer(cust)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-xs transition-all border rounded-lg ${idx === focusedCustIdx
                      ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold ring-2 ring-blue-500/20 scale-[1.01]'
                      : 'border-slate-200 hover:bg-slate-55 text-slate-700 bg-white'
                      }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === focusedCustIdx ? 'text-blue-900' : 'text-slate-900'}`}>{cust.nama}</p>
                      <p className="text-[10px] text-slate-450 mt-0.5">Alamat: {cust.alamat || '-'}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">ID: {cust.kode}</span>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Tidak ada pelanggan yang cocok dengan "{customerQuery}".
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-[10px] text-slate-400">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> untuk konfirmasi, <kbd className="shortcut-badge">Esc</kbd> batal</span>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT SEARCH POPUP MODAL */}
      {showProductPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={productPopupRef}
            tabIndex={0}
            onKeyDown={handleProductPopupKeyDown}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Search size={18} className="text-blue-500" />
                <span>Pilih Produk</span>
              </h3>
              <button onClick={() => setShowProductPopup(false)} className="text-slate-400 hover:text-slate-650">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {products.length > 0 ? (
                products.map((prod, idx) => (
                  <button
                    type="button"
                    key={prod.id}
                    onClick={() => selectProduct(prod)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-xs transition-all border rounded-lg ${idx === focusedProdIdx
                      ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold ring-2 ring-blue-500/20 scale-[1.01]'
                      : 'border-slate-200 hover:bg-slate-55 text-slate-700 bg-white'
                      }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === focusedProdIdx ? 'text-blue-900' : 'text-slate-900'}`}>{prod.nama}</p>
                      <p className="text-[10px] text-slate-450 font-mono mt-0.5">{prod.kode}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-semibold">Stok: {Number(prod.stok)} {prod.satuan}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Tidak ada produk yang cocok dengan "{productQuery}".
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-[10px] text-slate-400">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> untuk konfirmasi, <kbd className="shortcut-badge">Esc</kbd> batal</span>
            </div>
          </div>
        </div>
      )}

      {/* PRINT CONFIRMATION MODAL */}
      {showConfirmPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowConfirmPrintModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-5 animate-scale-in z-10 space-y-3.5">
            <div className="flex items-center gap-2 text-blue-600 border-b pb-2">
              <Printer size={18} />
              <h3 className="font-extrabold text-slate-800 text-xs">Konfirmasi Simpan & Cetak</h3>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Apakah Anda yakin ingin memproses retur penjualan ini? Dokumen retur akan disimpan dan nota transaksi akan langsung dicetak.
            </p>

            <div className="bg-slate-50 border rounded-lg p-2.5 text-[10px] text-slate-500 grid grid-cols-2 gap-2">
              <div>
                <span>Total Barang:</span>
                <p className="font-bold text-slate-800">{calculateTotalItems()} item</p>
              </div>
              <div>
                <span>Total Ganti Rugi:</span>
                <p className="font-bold text-blue-600">{formatCurrency(calculateTotalRefund())}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1.5">
              <button
                type="button"
                onClick={() => setShowConfirmPrintModal(false)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-700 rounded hover:bg-slate-100 transition-all"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveAndPrint}
                className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded transition-all flex items-center gap-1"
              >
                Cetak Nota (P)
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[9px] text-slate-400 flex justify-between">
            </div>
          </div>
        </div>
      )}

      {/* PRINT LAYOUT WITH BLUE BORDERS */}
      {completedReturns.length > 0 && (
        <div className="hidden print:block text-black bg-white font-mono text-[11px] leading-relaxed p-4">
          {completedReturns.map((slip, slipIdx) => (
            <div key={slipIdx} className="space-y-6 max-w-[21cm] mx-auto p-4 border-b border-dashed border-blue-600 pb-8 page-break-after">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-blue-600 pb-4">
                <div>
                  <h1 className="text-base font-bold uppercase tracking-wider text-blue-650">Maju Mulia Bersama</h1>
                  <p className="text-[10px] text-slate-700">Distributor Bahan Bangunan & Logam</p>
                  <p className="text-[10px] text-slate-700">Jl. Raya Industri Utama No. 88, Cikarang, Bekasi</p>
                  <p className="text-[10px] text-slate-700">Telp: (021) 89876543</p>
                </div>
                <div className="text-right">
                  <h2 className="text-sm font-bold uppercase text-blue-650">Nota Retur Penjualan</h2>
                  <p className="text-[10px] font-semibold font-mono text-blue-600">{slip.no_retur}</p>
                  <p className="text-[10px] mt-1">No. Faktur Retur: {slip.no_faktur || '-'}</p>
                  <p className="text-[9px] mt-1 text-slate-650">Tanggal Retur: {formatDate(slip.retur_date)}</p>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-[9px]">
                <div>
                  <p className="font-bold text-blue-500 uppercase">Pelanggan:</p>
                  <p className="font-bold text-[10px] text-slate-800">{slip.customer_nama}</p>
                </div>
                <div>
                  <p className="font-bold text-blue-500 uppercase">Keterangan:</p>
                  <p className="italic text-slate-700">"{slip.catatan || 'Tidak ada catatan'}"</p>
                </div>
              </div>

              {/* Items Table with Blue Borders */}
              <table className="w-full text-left text-[9px] border-collapse border border-blue-600">
                <thead>
                  <tr className="bg-blue-50/40 border-b border-blue-600 font-bold uppercase text-[8px] text-blue-900">
                    <th className="p-1 border-r border-blue-600 w-6 text-center">No</th>
                    <th className="p-1 border-r border-blue-600">Kode Barang</th>
                    <th className="p-1 border-r border-blue-600">Nama Produk</th>
                    <th className="p-1 border-r border-blue-600 text-center w-16">Kuantitas</th>
                    <th className="p-1 border-r border-blue-600 text-center w-16">Kondisi</th>
                    <th className="p-1 border-r border-blue-600 text-right w-24">Harga</th>
                    <th className="p-1 text-right w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-600">
                  {slip.items.map((item, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="p-1 border-r border-blue-600 text-center">{idx + 1}</td>
                      <td className="p-1 border-r border-blue-600 font-mono text-slate-700">{item.product_kode}</td>
                      <td className="p-1 border-r border-blue-600 font-bold text-slate-800">{item.product_nama}</td>
                      <td className="p-1 border-r border-blue-600 text-center">{item.qty} {item.satuan}</td>
                      <td className="p-1 border-r border-blue-600 text-center uppercase font-bold text-slate-700">{item.kondisi}</td>
                      <td className="p-1 border-r border-blue-600 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="p-1 text-right text-slate-800">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/20 border-t border-blue-600">
                    <td colSpan={6} className="p-1 border-r border-blue-600 text-right font-bold uppercase text-blue-900">
                      Total Pengembalian
                    </td>
                    <td className="p-1 text-right font-black text-blue-800">
                      {formatCurrency(slip.total)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 text-center text-[9px] pt-8 text-slate-800">
                <div className="space-y-12">
                  <p>Customer / Pelanggan</p>
                  <p className="underline font-bold text-slate-900">( ____________________ )</p>
                </div>
                <div className="space-y-12">
                  <p>Hormat Kami, Kasir</p>
                  <p className="underline font-bold text-slate-900">( Maju Mulia Bersama )</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
