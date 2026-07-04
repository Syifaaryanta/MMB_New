import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { Search, Save, CheckSquare, Plus, Trash2, Eye, EyeOff, AlertCircle, X } from 'lucide-react';

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

  // Dropdown list for products
  const [products, setProducts] = useState<Product[]>([]);
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [focusedProdIdx, setFocusedProdIdx] = useState(0);

  // History Popover (F4)
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Highlighted Row Index in Table
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);

  // Focus Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

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

  // Load price history (F4)
  const loadPriceHistory = async () => {
    if (!selectedProd || !poMeta) return;
    try {
      const res = await api.get(`/products/${selectedProd.id}/price-history?supplier_id=${poMeta.supplier.id}`);
      setPriceHistory(res.data || []);
      setShowHistory(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProductKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && products.length > 0) {
      e.preventDefault();
      setFocusedProdIdx((p) => (p + 1) % products.length);
    } else if (e.key === 'ArrowUp' && products.length > 0) {
      e.preventDefault();
      setFocusedProdIdx((p) => (p - 1 + products.length) % products.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (products.length > 0) {
        selectProduct(products[focusedProdIdx]);
      }
    }
  };

  const selectProduct = (p: Product) => {
    setSelectedProd(p);
    setProdQuery(p.nama);
    setShowProdDropdown(false);
    qtyInputRef.current?.focus();
  };

  // Navigations inside the row inputs
  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      priceInputRef.current?.focus();
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
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
  }, { enableOnFormTags: true });

  // F3: Toggle show/hide supplier info panel
  useHotkeys('f3', (e) => {
    e.preventDefault();
    setShowMetaInfo((prev) => !prev);
  }, { enableOnFormTags: true });

  // F4: Cost history
  useHotkeys('f4', (e) => {
    e.preventDefault();
    if (selectedProd) loadPriceHistory();
  }, { enableOnFormTags: true });

  // F10: Save Draft/Complete PO
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (items.length > 0) {
      if (confirm('Selesaikan Purchase Order ini?')) {
        submitPO(true);
      }
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

  // Esc: Cancel / Save draft
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (confirm('Keluar dari pembuatan PO? Progres saat ini akan hilang.')) {
      sessionStorage.removeItem('po_step1');
      navigate('/pembelian');
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
          <button onClick={() => submitPO(false)} className="btn-secondary">
            <Save size={16} />
            <span>Simpan Draf</span>
          </button>
          <button onClick={() => submitPO(true)} className="btn-primary" disabled={items.length === 0}>
            <CheckSquare size={16} />
            <span>Selesaikan PO (F10)</span>
          </button>
        </div>
      </div>

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
                  setShowProdDropdown(true);
                }}
                onFocus={() => setShowProdDropdown(true)}
                onKeyDown={handleProductKeyDown}
                placeholder="Ketik Nama/Kode..."
                className="input-field pl-9 py-2 text-xs"
              />
            </div>

            {showProdDropdown && products.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 glass rounded-lg shadow-2xl border border-surface-700 max-h-40 overflow-y-auto z-30">
                {products.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors border-b border-surface-700/30 ${
                      idx === focusedProdIdx ? 'bg-primary-600/30 text-white font-semibold' : 'hover:bg-surface-800 text-slate-300'
                    }`}
                  >
                    {p.nama} ({p.kode})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Qty */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Kuantitas</label>
            <input
              ref={qtyInputRef}
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
              onKeyDown={handleQtyKeyDown}
              placeholder="0.00"
              className="input-field py-2 text-xs font-semibold"
            />
          </div>

          {/* Price & History trigger */}
          <div className="relative">
            <label className="block text-[11px] text-slate-400 mb-1">
              Harga Beli (F4 Histori)
            </label>
            <input
              ref={priceInputRef}
              type="text"
              value={formatRupiahInput(price)}
              onChange={(e) => setPrice(e.target.value === '' ? '' : parseRupiahInput(e.target.value))}
              onKeyDown={handlePriceKeyDown}
              placeholder="Rp 0"
              className="input-field py-2 text-xs text-emerald-400 font-bold"
            />

            {/* Price History Popover */}
            {showHistory && (
              <div className="absolute right-0 top-full mt-2 w-72 glass p-4 rounded-lg shadow-2xl border border-surface-700 z-30 animate-scale-in">
                <div className="flex justify-between items-center border-b border-surface-700 pb-2 mb-2">
                  <h4 className="text-xs font-bold text-white">Histori Harga Beli</h4>
                  <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
                {priceHistory.length > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {priceHistory.map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPrice(h.harga_beli);
                          setShowHistory(false);
                          priceInputRef.current?.focus();
                        }}
                        className="w-full text-left p-1.5 hover:bg-surface-800 rounded flex justify-between text-[11px] transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-slate-300 font-mono">{h.purchase.no_order}</p>
                          <p className="text-[10px] text-slate-500">{new Date(h.purchase.order_date).toLocaleDateString('id-ID')}</p>
                        </div>
                        <span className="font-bold text-emerald-400">{formatCurrency(h.harga_beli)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center text-xs">Belum ada riwayat harga beli.</p>
                )}
              </div>
            )}
          </div>
        </div>
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
                <th className="p-4">Satuan</th>
                <th className="p-4 text-right">Kuantitas</th>
                <th className="p-4 text-right">Harga Satuan</th>
                <th className="p-4 text-right">Subtotal</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {items.map((item, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedRowIdx(idx)}
                  className={`hover:bg-surface-800/10 transition-colors ${
                    idx === selectedRowIdx ? 'table-row-selected' : ''
                  }`}
                >
                  <td className="p-4 text-center text-slate-500">{idx + 1}</td>
                  <td className="p-4 font-mono font-semibold text-slate-300">{item.product_kode}</td>
                  <td className="p-4 font-bold text-white">{item.product_nama}</td>
                  <td className="p-4 text-slate-400">{item.satuan}</td>
                  <td className="p-4 text-right font-semibold text-slate-200">{item.qty}</td>
                  <td className="p-4 text-right text-emerald-400 font-semibold currency">
                    {formatCurrency(item.harga_beli)}
                  </td>
                  <td className="p-4 text-right text-white font-bold currency">
                    {formatCurrency(item.qty * item.harga_beli)}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => deleteRow(idx)}
                      className="p-1 hover:text-danger-500 rounded transition-colors"
                      title="Hapus Baris (Del)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
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
  );
};
