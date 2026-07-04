import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { Search, Save, CheckSquare, Plus, Trash2, X, AlertCircle } from 'lucide-react';

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

export const EditOrderPO: React.FC = () => {
  const navigate = useNavigate();

  // Search PO
  const [poQuery, setPoQuery] = useState('');
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

  // Dropdown list for products
  const [products, setProducts] = useState<Product[]>([]);
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [focusedProdIdx, setFocusedProdIdx] = useState(0);

  // Supplier dropdown (if editing supplier)
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [focusedSuppIdx, setFocusedSuppIdx] = useState(0);

  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Focus Refs
  const poSearchInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    poSearchInputRef.current?.focus();
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

  // Fetch PO by no_order / exact search
  const handlePoSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poQuery) return;

    setIsLoading(true);
    try {
      const res = await api.get(`/purchases?status=draft`);
      const allDrafts = res.data.data || [];
      const match = allDrafts.find((d: any) => d.no_order.toLowerCase() === poQuery.trim().toLowerCase());

      if (!match) {
        alert('Draft PO tidak ditemukan dengan nomor tersebut. (Pastikan PO berstatus Draft)');
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

      setTimeout(() => searchInputRef.current?.focus(), 150);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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

  const handleSupplierKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && suppliers.length > 0) {
      e.preventDefault();
      setFocusedSuppIdx((p) => (p + 1) % suppliers.length);
    } else if (e.key === 'ArrowUp' && suppliers.length > 0) {
      e.preventDefault();
      setFocusedSuppIdx((p) => (p - 1 + suppliers.length) % suppliers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suppliers.length > 0) {
        selectSupplier(suppliers[focusedSuppIdx]);
      }
    }
  };

  const selectSupplier = (s: Supplier) => {
    setSelectedSupplier(s);
    setSupplierQuery(s.nama);
    setShowSupplierDropdown(false);
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
    setProdQuery('');
    setSelectedProd(null);
    setQty('');
    setPrice('');
    searchInputRef.current?.focus();
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

      navigate('/pembelian');
    } catch (err) {
      alert('Gagal memperbarui Purchase Order');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard Shortcuts
  // F2: Focus item search
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (activePo) searchInputRef.current?.focus();
  }, { enableOnFormTags: true });

  // F10: Save Draft/Complete PO
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (activePo && items.length > 0) {
      if (confirm('Selesaikan perbaikan Purchase Order ini?')) {
        handleUpdatePO(true);
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

  // Esc: Cancel / Go Back
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/pembelian');
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
        <button onClick={() => navigate('/pembelian')} className="btn-secondary text-xs">
          Kembali ke PO
        </button>
      </div>

      {!activePo ? (
        /* PO Search Mode */
        <div className="card max-w-md mx-auto p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cari Draft PO</h3>
          <form onSubmit={handlePoSearchSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Nomor PO (Ketik lengkap)</label>
              <input
                ref={poSearchInputRef}
                type="text"
                required
                value={poQuery}
                onChange={(e) => setPoQuery(e.target.value)}
                placeholder="Contoh: PO-20260702-001"
                className="input-field font-mono uppercase"
              />
            </div>
            <button type="submit" disabled={isLoading} className="w-full btn-primary justify-center py-2.5">
              {isLoading ? 'Memuat...' : 'Cari & Edit'}
            </button>
          </form>
        </div>
      ) : (
        /* PO Inline Editor Mode */
        <div className="space-y-6 animate-fade-in">
          {/* Metadata Controls */}
          <div className="card p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
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
              <label className="block text-[11px] text-slate-400 mb-1">Supplier</label>
              <input
                ref={supplierInputRef}
                type="text"
                value={supplierQuery}
                onChange={(e) => {
                  setSupplierQuery(e.target.value);
                  setShowSupplierDropdown(true);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
                onKeyDown={handleSupplierKeyDown}
                className="input-field py-2 text-xs"
              />
              {showSupplierDropdown && suppliers.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 glass rounded-lg shadow-2xl border border-surface-700 max-h-40 overflow-y-auto z-30">
                  {suppliers.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => selectSupplier(s)}
                      className={`w-full text-left px-3 py-1.5 text-xs border-b border-surface-700/30 ${
                        i === focusedSuppIdx ? 'bg-primary-600/30 text-white font-semibold' : 'hover:bg-surface-800 text-slate-300'
                      }`}
                    >
                      {s.nama} ({s.kode})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Termin</label>
              <select
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="input-field py-2 text-xs"
              >
                <option value="tunai">Tunai</option>
                <option value="1">1 Bulan</option>
                <option value="2">2 Bulan</option>
                <option value="3">3 Bulan</option>
              </select>
            </div>
          </div>

          {/* Quick Row Inputs */}
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="relative sm:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Cari Produk (F2)</label>
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
                placeholder="Ketik nama produk..."
                className="input-field py-2 text-xs"
              />
              {showProdDropdown && products.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 glass rounded-lg shadow-2xl border border-surface-700 max-h-40 overflow-y-auto z-30">
                  {products.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p)}
                      className={`w-full text-left px-3 py-1.5 text-xs border-b border-surface-700/30 ${
                        idx === focusedProdIdx ? 'bg-primary-600/30 text-white font-semibold' : 'hover:bg-surface-800 text-slate-300'
                      }`}
                    >
                      {p.nama} ({p.kode})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Kuantitas</label>
              <input
                ref={qtyInputRef}
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && priceInputRef.current?.focus()}
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
                onKeyDown={(e) => e.key === 'Enter' && addItemToTable()}
                placeholder="Rp 0"
                className="input-field py-2 text-xs text-emerald-400 font-bold"
              />
            </div>
          </div>

          {/* Items List Table */}
          <div className="card p-0 overflow-hidden border border-surface-700">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="p-4 w-12 text-center">No</th>
                    <th className="p-4">Kode Barang</th>
                    <th className="p-4">Nama Barang</th>
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

            {/* Total Footer */}
            <div className="flex justify-between items-center p-4 bg-surface-800/50 border-t border-surface-700">
              <div className="text-xs text-slate-500">
                {items.length} items. Tekan <kbd className="shortcut-badge text-[10px]">F10</kbd> untuk menyelesaikan, <kbd className="shortcut-badge text-[10px]">Esc</kbd> untuk keluar.
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase tracking-wider block">Grand Total PO</span>
                <span className="text-xl font-black text-emerald-400 currency">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-end gap-2">
            <button onClick={() => setActivePo(null)} className="btn-secondary">
              Batal Edit PO
            </button>
            <button onClick={() => handleUpdatePO(false)} className="btn-secondary">
              Perbarui Draf
            </button>
            <button onClick={() => handleUpdatePO(true)} className="btn-primary" disabled={isSaving || items.length === 0}>
              Perbarui & Selesaikan (F10)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
