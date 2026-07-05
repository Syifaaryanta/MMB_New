import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Tags, User, AlertCircle, ShoppingBag, History, FileText, X } from 'lucide-react';

interface SupplierPrice {
  id: string;
  supplier: {
    id: string;
    kode: string;
    nama: string;
  };
  stok: number;
  harga_beli: number;
}

interface Product {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string | null;
  stok: number;
  satuan: string;
  product_prices: SupplierPrice[];
}

interface Customer {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
}

interface SaleHistoryItem {
  id: string;
  qty: number;
  unit_price: number;
  total: number;
  created_at: string;
  sale: {
    no_order: string;
    no_faktur: string | null;
    order_date: string;
  };
}

export const InformasiHarga: React.FC = () => {
  const navigate = useNavigate();

  // Search Queries
  const [productQuery, setProductQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');

  // Results & Selection
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Popup Modals instead of Dropdowns
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Detail Info / Purchase History
  const [customerHistory, setCustomerHistory] = useState<SaleHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);

  // Refs
  const productInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const productPopupRef = useRef<HTMLDivElement>(null);
  const customerPopupRef = useRef<HTMLDivElement>(null);

  // Focus Search Product on mount
  useEffect(() => {
    productInputRef.current?.focus();
  }, []);

  // Keyboard Shortcuts via react-hotkeys-hook
  // F1: Focus Product Search Input
  useHotkeys('f1', (e) => {
    e.preventDefault();
    setShowCustomerPopup(false);
    setShowProductPopup(false);
    productInputRef.current?.focus();
    productInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F2: Focus Customer Search Input
  useHotkeys('f2', (e) => {
    e.preventDefault();
    setShowProductPopup(false);
    setShowCustomerPopup(false);
    customerInputRef.current?.focus();
    customerInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F4: Navigate to Product Detail (Katalog Detail)
  useHotkeys('f4', (e) => {
    e.preventDefault();
    if (selectedProduct) {
      navigate(`/gudang/detail?id=${selectedProduct.id}`);
    }
  }, { enableOnFormTags: true });

  // Alt + N: New Product
  useHotkeys('alt+n', (e) => {
    e.preventDefault();
    navigate('/gudang/katalog');
  }, { enableOnFormTags: false });

  // Esc Handler: Back 1 page or reset
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showProductPopup) {
      setShowProductPopup(false);
      productInputRef.current?.focus();
    } else if (showCustomerPopup) {
      setShowCustomerPopup(false);
      customerInputRef.current?.focus();
    } else if (selectedProduct || selectedCustomer) {
      resetAll();
    } else {
      navigate('/dashboard');
    }
  }, { enableOnFormTags: true });

  // Native PageDown & PageUp Scrolling Handler
  useEffect(() => {
    const handleScrollKeys = (e: KeyboardEvent) => {
      if (e.key === 'PageDown') {
        const modalScroll = document.querySelector('.modal-overlay .overflow-y-auto') as HTMLElement | null;
        if (modalScroll && modalScroll.scrollHeight > modalScroll.clientHeight) {
          e.preventDefault();
          modalScroll.scrollBy({ top: 200, behavior: 'smooth' });
        } else {
          e.preventDefault();
          window.scrollBy({ top: 400, behavior: 'smooth' });
        }
      } else if (e.key === 'PageUp') {
        const modalScroll = document.querySelector('.modal-overlay .overflow-y-auto') as HTMLElement | null;
        if (modalScroll && modalScroll.scrollHeight > modalScroll.clientHeight) {
          e.preventDefault();
          modalScroll.scrollBy({ top: -200, behavior: 'smooth' });
        } else {
          e.preventDefault();
          window.scrollBy({ top: -400, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleScrollKeys, { capture: true });
    return () => window.removeEventListener('keydown', handleScrollKeys, { capture: true });
  }, []);

  // Fetch product list when query changes (Debounced)
  useEffect(() => {
    if (!productQuery) {
      setProducts([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/products?q=${productQuery}`);
        setProducts(res.data.data || []);
        setFocusedIndex(0);
      } catch (err) {
        console.error(err);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [productQuery]);

  // Fetch customer list when query changes (Debounced)
  useEffect(() => {
    if (!customerQuery) {
      setCustomers([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/customers?q=${customerQuery}`);
        setCustomers(res.data.data || []);
        setFocusedIndex(0);
      } catch (err) {
        console.error(err);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [customerQuery]);

  // Fetch Customer-Product Sale History
  useEffect(() => {
    if (selectedProduct && selectedCustomer) {
      const fetchHistory = async () => {
        setIsHistoryLoading(true);
        try {
          const res = await api.get(`/sales/customer-product-history/query?customer_id=${selectedCustomer.id}&product_id=${selectedProduct.id}`);
          setCustomerHistory(res.data || []);
        } catch (err) {
          console.error(err);
        } finally {
          setIsHistoryLoading(false);
        }
      };
      fetchHistory();
    } else {
      setCustomerHistory([]);
    }
  }, [selectedProduct, selectedCustomer]);

  // Fetch Product Purchase Cost History (for last costs)
  useEffect(() => {
    if (selectedProduct) {
      api.get(`/products/${selectedProduct.id}/price-history`)
        .then((res) => {
          const sorted = (res.data || []).sort((a: any, b: any) => {
            const dateA = new Date(a.purchase?.order_date || 0).getTime();
            const dateB = new Date(b.purchase?.order_date || 0).getTime();
            if (dateB !== dateA) return dateB - dateA;
            const createdA = new Date(a.purchase?.created_at || 0).getTime();
            const createdB = new Date(b.purchase?.created_at || 0).getTime();
            return createdB - createdA;
          });
          setPurchaseHistory(sorted);
        })
        .catch((err) => {
          console.error(err);
        });
    } else {
      setPurchaseHistory([]);
    }
  }, [selectedProduct]);


  // Focus modal popups when shown
  useEffect(() => {
    if (showProductPopup) {
      productPopupRef.current?.focus();
    }
  }, [showProductPopup]);

  useEffect(() => {
    if (showCustomerPopup) {
      customerPopupRef.current?.focus();
    }
  }, [showCustomerPopup]);

  const selectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setProductQuery(prod.nama);
    setShowProductPopup(false);
  };

  const selectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerQuery(cust.nama);
    setShowCustomerPopup(false);
  };

  const resetAll = () => {
    setProductQuery('');
    setCustomerQuery('');
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setProducts([]);
    setCustomers([]);
    setShowProductPopup(false);
    setShowCustomerPopup(false);
    productInputRef.current?.focus();
  };

  // Keyboard Navigation inside Modals
  const handleProductPopupKeyDown = (e: React.KeyboardEvent) => {
    if (products.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % products.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + products.length) % products.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectProduct(products[focusedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowProductPopup(false);
      productInputRef.current?.focus();
    }
  };

  const handleCustomerPopupKeyDown = (e: React.KeyboardEvent) => {
    if (customers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % customers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + customers.length) % customers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectCustomer(customers[focusedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowCustomerPopup(false);
      customerInputRef.current?.focus();
    }
  };

  const getPreviousPriceForSupplier = (supplierName: string) => {
    const supplierHistory = purchaseHistory.filter(
      (h) => h.purchase?.supplier?.nama === supplierName
    );
    if (supplierHistory.length > 1) {
      return Number(supplierHistory[1].harga_beli);
    }
    return null;
  };

  const getLatestPurchaseDateForSupplier = (supplierName: string) => {
    const supplierHistory = purchaseHistory.filter(
      (h) => h.purchase?.supplier?.nama === supplierName
    );
    if (supplierHistory.length > 0) {
      return supplierHistory[0].purchase.order_date;
    }
    return null;
  };

  const getPreviousPurchaseDateForSupplier = (supplierName: string) => {
    const supplierHistory = purchaseHistory.filter(
      (h) => h.purchase?.supplier?.nama === supplierName
    );
    if (supplierHistory.length > 1) {
      return supplierHistory[1].purchase.order_date;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Informasi Harga</h1>
          <p className="text-slate-400">Pencarian cepat detail harga produk dan riwayat penjualan pelanggan</p>
        </div>
        <button
          onClick={() => navigate('/gudang/katalog')}
          className="btn-secondary text-xs"
        >
          <span>Katalog Produk (Alt+N)</span>
        </button>
      </div>

      {/* Search Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Search Box */}
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Pencarian Barang <span className="shortcut-badge text-[9px] ml-1">F1</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={16} />
            </span>
            <input
              ref={productInputRef}
              type="text"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setShowProductPopup(true);
                  setFocusedIndex(0);
                }
              }}
              placeholder="Ketik Nama/Kode Barang + Tekan Enter..."
              className="input-field pl-9"
            />
            {productQuery && (
              <button
                onClick={() => {
                  setProductQuery('');
                  setSelectedProduct(null);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Customer Search Box */}
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Pencarian Pelanggan (Opsional) <span className="shortcut-badge text-[9px] ml-1">F2</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <User size={16} />
            </span>
            <input
              ref={customerInputRef}
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setShowCustomerPopup(true);
                  setFocusedIndex(0);
                }
              }}
              placeholder="Ketik Nama Pelanggan + Tekan Enter..."
              className="input-field pl-9"
            />
            {customerQuery && (
              <button
                onClick={() => {
                  setCustomerQuery('');
                  setSelectedCustomer(null);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Split Details */}
      {selectedProduct ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Detail Panel */}
          <div className="card space-y-6 border border-surface-700/60 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-700 pb-3">
              <div className="flex items-center gap-3">
                <Tags className="text-primary-500 w-5 h-5" />
                <h3 className="text-lg font-bold text-white">Detail Spesifikasi & Stok</h3>
              </div>
              <button
                onClick={() => navigate(`/gudang/detail?id=${selectedProduct.id}`)}
                className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded"
                title="Lihat Detail Katalog Lengkap (F4)"
              >
                <span>Lihat Detail (F4)</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Nama Barang</p>
                <p className="text-lg font-bold text-white mt-0.5">{selectedProduct.nama}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Kode Produk</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5 font-mono">{selectedProduct.kode}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase">Total Persediaan</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">
                    {Number(selectedProduct.stok)} {selectedProduct.satuan}
                  </p>
                </div>
              </div>

              <div className="border-t border-surface-700/50 pt-4">
                <p className="text-xs text-slate-400 uppercase font-semibold mb-3">Daftar Stok & Harga Beli Supplier</p>
                {selectedProduct.product_prices && selectedProduct.product_prices.length > 0 ? (
                  <div className="space-y-3">
                    {selectedProduct.product_prices.map((p) => {
                      const prevPrice = getPreviousPriceForSupplier(p.supplier.nama);
                      const latestDate = getLatestPurchaseDateForSupplier(p.supplier.nama);
                      const prevDate = getPreviousPurchaseDateForSupplier(p.supplier.nama);
                      return (
                        <div key={p.id} className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                          {/* Supplier Header */}
                          <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">{p.supplier.nama}</h4>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{p.supplier.kode}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              Number(p.stok) > 0 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                                : 'bg-slate-50 text-slate-400 border-slate-200/50'
                            }`}>
                              {Number(p.stok)} {selectedProduct.satuan} tersedia
                            </span>
                          </div>

                          {/* Price Comparison Grid */}
                          <div className="grid grid-cols-2 gap-4 pt-1">
                            {/* Latest Modal Price */}
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Harga Beli Terkini</span>
                              <strong className="text-base font-extrabold text-emerald-600 block">{formatCurrency(Number(p.harga_beli))}</strong>
                              {latestDate ? (
                                <span className="text-[10px] text-slate-400 block font-mono">Beli: {formatDate(latestDate)}</span>
                              ) : (
                                <span className="text-[10px] text-slate-400 block">Belum ada transaksi</span>
                              )}
                            </div>

                            {/* Previous Modal Price */}
                            <div className="space-y-0.5 border-l border-slate-100 pl-4">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Harga Beli Sebelumnya</span>
                              {prevPrice !== null ? (
                                <>
                                  <strong className="text-base font-bold text-slate-600 block">{formatCurrency(prevPrice)}</strong>
                                  {prevDate && (
                                    <span className="text-[10px] text-slate-400 block font-mono">Beli: {formatDate(prevDate)}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400 text-xs italic block mt-1">Tidak ada data</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-4 bg-surface-800 rounded border border-dashed border-surface-700 text-xs text-slate-500">
                    Tidak ada supplier terkait dengan harga beli terdaftar.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer History Panel */}
          <div className="card space-y-6 border border-surface-700/60 shadow-xl">
            <div className="flex items-center gap-3 border-b border-surface-700 pb-3">
              <History className="text-emerald-500 w-5 h-5" />
              <h3 className="text-lg font-bold text-white">Riwayat Pembelian Pelanggan</h3>
            </div>

            {selectedCustomer ? (
              isHistoryLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 skeleton" />
                  ))}
                </div>
              ) : customerHistory.length > 0 ? (
                <div className="space-y-4">
                  {/* Highlighted Box of Last Sale to Customer (Requirement 3) */}
                  <div className="p-4 bg-primary-950/20 border border-primary-500/35 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-primary-400 uppercase tracking-wider">Transaksi Terakhir Pelanggan</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-surface-900 rounded border border-surface-700/50">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Harga Satuan Terakhir</span>
                        <strong className="text-emerald-400 text-sm font-mono">{formatCurrency(Number(customerHistory[0].unit_price))}</strong>
                      </div>
                      <div className="p-2 bg-surface-900 rounded border border-surface-700/50">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Jumlah Terakhir</span>
                        <strong className="text-white text-sm">{Number(customerHistory[0].qty)} {selectedProduct.satuan}</strong>
                      </div>
                      <div className="p-2 bg-surface-900 rounded border border-surface-700/50">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Tanggal Terakhir</span>
                        <strong className="text-slate-200 text-sm block truncate" title={formatDate(customerHistory[0].sale.order_date)}>
                          {formatDate(customerHistory[0].sale.order_date)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {customerHistory.slice(0, 1).map((item) => (
                      <div key={item.id} className="p-3 bg-surface-800 rounded border border-surface-700/50 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-white font-mono">
                              {item.sale.no_faktur || item.sale.no_order}
                            </p>
                            <p className="text-xs text-slate-400">{formatDate(item.sale.order_date)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary-400 currency">{formatCurrency(Number(item.unit_price))}</p>
                            <p className="text-xs text-slate-400">{Number(item.qty)} {selectedProduct.satuan}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-surface-800 rounded border border-dashed border-surface-700 text-sm text-slate-500">
                  Customer {selectedCustomer.nama} belum pernah melakukan pembelian produk ini.
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 text-slate-500 h-[250px] border border-dashed border-surface-700 rounded-lg bg-surface-800/30">
                <AlertCircle className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                <p className="text-sm">Silakan pilih pelanggan (F2) untuk melihat riwayat harga jual khusus pelanggan tersebut.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/20 min-h-[300px]">
          <ShoppingBag className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-400">Pilih Barang Terlebih Dahulu</h3>
          <p className="text-sm max-w-sm mt-1">Tekan <kbd className="shortcut-badge ml-0.5">F1</kbd> untuk mulai mengetik nama/kode barang dan mencari harganya.</p>
        </div>
      )}

      {/* Product Selection Popup Modal */}
      {showProductPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={productPopupRef}
            tabIndex={0}
            onKeyDown={handleProductPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>Pilih Barang</span>
              </h3>
              <button onClick={() => setShowProductPopup(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {products.length > 0 ? (
                products.map((prod, idx) => (
                  <button
                    key={prod.id}
                    onClick={() => selectProduct(prod)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${
                      idx === focusedIndex
                        ? 'border-primary-500 bg-primary-50 text-primary-900 font-semibold ring-2 ring-primary-500/20 scale-[1.01]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white'
                    }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === focusedIndex ? 'text-primary-900' : 'text-slate-900'}`}>{prod.nama}</p>
                      <p className="text-xs text-slate-500 font-mono">{prod.kode}</p>
                    </div>
                    <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                      Stok: {Number(prod.stok)} {prod.satuan}
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Tidak ada barang yang cocok dengan "{productQuery}".
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

      {/* Customer Selection Popup Modal */}
      {showCustomerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={customerPopupRef}
            tabIndex={0}
            onKeyDown={handleCustomerPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>Pilih Pelanggan</span>
              </h3>
              <button onClick={() => setShowCustomerPopup(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {customers.length > 0 ? (
                customers.map((cust, idx) => (
                  <button
                    key={cust.id}
                    onClick={() => selectCustomer(cust)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${
                      idx === focusedIndex
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-2 ring-emerald-500/20 scale-[1.01]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white'
                    }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === focusedIndex ? 'text-emerald-900' : 'text-slate-900'}`}>{cust.nama}</p>
                      <p className="text-xs text-slate-500 font-mono">{cust.kode}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Tidak ada pelanggan yang cocok dengan "{customerQuery}".
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
    </div>
  );
};
