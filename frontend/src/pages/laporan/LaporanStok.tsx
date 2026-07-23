import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { exportStyledExcel } from '@/lib/excelHelper';
import { 
  Package, 
  Search, 
  Download, 
  ArrowLeft, 
  ChevronRight,
  ChevronDown,
  DollarSign,
  AlertTriangle,
  Layers
} from 'lucide-react';

interface ProductPrice {
  id: string;
  stok: number;
  harga_beli: number;
  supplier: {
    kode: string;
    nama: string;
  };
}

interface Product {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string | null;
  stok: number;
  satuan: string;
  product_prices: ProductPrice[];
}

export const LaporanStok: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [stockStatus, setStockStatus] = useState<'all' | 'critical' | 'safe'>('all');

  // Selection & expand
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  // Keyboard navigation & table focus
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTableFocused, setIsTableFocused] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Summary Metrics
  const [totalAsetVal, setTotalAsetVal] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const statusFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus search bar on initial mount
    searchInputRef.current?.focus();
  }, []);

  const fetchStockData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/laporan/stok-persediaan');
      const data = res.data || [];
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    
    // Calculate total aset values based on purchase prices
    let calculatedAset = 0;
    let criticals = 0;

    const filtered = products.filter((p) => {
      const matchesSearch = p.nama.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q);
      const isCritical = Number(p.stok) < 2;

      if (isCritical) criticals++;

      // calculate asset value: use lowest price from suppliers, or 0 if none
      const prices = p.product_prices || [];
      const lowestBuyPrice = prices.length > 0 
        ? Math.min(...prices.map(pr => Number(pr.harga_beli))) 
        : 0;
      calculatedAset += Number(p.stok) * lowestBuyPrice;

      if (stockStatus === 'critical') return matchesSearch && isCritical;
      if (stockStatus === 'safe') return matchesSearch && !isCritical;
      return matchesSearch;
    });

    setFilteredProducts(filtered);
    setTotalAsetVal(calculatedAset);
    setCriticalCount(criticals);
  }, [products, searchQuery, stockStatus]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [filteredProducts]);

  // Shortcuts
  // F1: Focus Search Input
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
    setIsTableFocused(false);
  }, { enableOnFormTags: true });

  // F2: Focus Status Filter
  useHotkeys('f2', (e) => {
    e.preventDefault();
    statusFilterRef.current?.focus();
    setIsTableFocused(false);
  }, { enableOnFormTags: true });

  // F10: Export Excel
  useHotkeys('f10', (e) => {
    e.preventDefault();
    exportToExcel();
  }, { enableOnFormTags: false });

  // Escape: Return to menu
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/laporan');
  }, { enableOnFormTags: true });

  // Keyboard Table Navigation
  useHotkeys('down', (e) => {
    if (!isTableFocused || filteredProducts.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(prev + 1, filteredProducts.length - 1));
  }, { enableOnFormTags: false }, [isTableFocused, filteredProducts]);

  useHotkeys('up', (e) => {
    if (!isTableFocused || filteredProducts.length === 0) return;
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(prev - 1, 0));
  }, { enableOnFormTags: false }, [isTableFocused, filteredProducts]);

  useHotkeys('enter', (e) => {
    if (!isTableFocused || filteredProducts.length === 0) return;
    e.preventDefault();
    const activeProd = filteredProducts[selectedIdx];
    if (activeProd) {
      setExpandedProductIds(prev => (prev[activeProd.id] ? {} : { [activeProd.id]: true }));
    }
  }, { enableOnFormTags: false }, [isTableFocused, filteredProducts, selectedIdx]);

  // Scroll focused row into view
  useEffect(() => {
    const target = rowRefs.current[selectedIdx];
    if (target && isTableFocused) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIdx, isTableFocused]);

  const exportToExcel = () => {
    if (products.length === 0) return;
    const excelRows = filteredProducts.map((p) => {
      const prices = p.product_prices || [];
      const lowestPrice = prices.length > 0 ? Math.min(...prices.map(pr => Number(pr.harga_beli))) : 0;
      const assetVal = Number(p.stok) * lowestPrice;

      return {
        [lang === 'en' ? 'SKU Code' : 'Kode Barang']: p.kode,
        [lang === 'en' ? 'Product Name' : 'Nama Barang']: p.nama,
        [lang === 'en' ? 'Description' : 'Deskripsi']: p.deskripsi || '-',
        [lang === 'en' ? 'Final Stock' : 'Stok Akhir']: Number(p.stok),
        [lang === 'en' ? 'Est Lowest Purchase Price' : 'Estimasi Harga Beli Terendah']: lowestPrice,
        [lang === 'en' ? 'Est Asset Value' : 'Estimasi Nilai Aset']: assetVal,
      };
    });

    exportStyledExcel(
      excelRows,
      `Laporan_Stok_Persediaan_${new Date().toISOString().slice(0, 10)}.xlsx`,
      lang === 'en' ? 'Stock Inventory Report' : 'Laporan Stok Persediaan',
      [lang === 'en' ? 'Final Stock' : 'Stok Akhir'],
      [lang === 'en' ? 'SKU Code' : 'Kode Barang'],
      [
        lang === 'en' ? 'Est Lowest Purchase Price' : 'Estimasi Harga Beli Terendah',
        lang === 'en' ? 'Est Asset Value' : 'Estimasi Nilai Aset'
      ]
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/laporan')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 transition-colors font-semibold focus:outline-none"
          >
            <ArrowLeft size={12} /> {lang === 'en' ? 'Back to Menu (Esc)' : 'Kembali ke Menu (Esc)'}
          </button>
          <h1 className="text-2xl font-extrabold text-slate-950">
            {lang === 'en' ? 'Stock Inventory Report' : 'Laporan Stok Persediaan'}
          </h1>
          <p className="text-slate-555 text-xs mt-1">
            {lang === 'en'
              ? 'Monitoring warehouse inventory quantity, critical stock, and total estimated assets.'
              : 'Monitoring kuantitas inventori gudang, stok kritis, dan total estimasi aset.'}
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <button 
            onClick={exportToExcel}
            disabled={filteredProducts.length === 0}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>{lang === 'en' ? 'Export Excel (F10)' : 'Ekspor Excel (F10)'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">
              {lang === 'en' ? 'Est Asset Value' : 'Estimasi Nilai Aset'}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">{formatCurrency(totalAsetVal)}</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">
              {lang === 'en' ? 'Critical Stock (< 2)' : 'Stok Kritis (< 2)'}
            </span>
            <span className="text-xl font-extrabold text-rose-600 block mt-0.5 font-mono">
              {criticalCount} SKU
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-indigo-500">
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">
              {lang === 'en' ? 'Total Registered SKUs' : 'Total SKU Terdaftar'}
            </span>
            <span className="text-xl font-extrabold text-slate-900 block mt-0.5 font-mono">
              {products.length} {lang === 'en' ? 'Items' : 'Barang'}
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
            <Layers size={20} />
          </div>
        </div>
      </div>

      {/* Control Board */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div>
          <label className="block text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Search Item / SKU Code (F1)' : 'Cari Barang / Kode SKU (F1)'}
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={lang === 'en' ? 'Type product name or SKU...' : 'Ketik nama atau SKU produk...'}
              value={searchQuery}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), statusFilterRef.current?.focus())}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Filter Stock */}
        <div>
          <label className="block text-[10px] text-slate-505 mb-1.5 font-bold uppercase tracking-wider">
            {lang === 'en' ? 'Filter Stock Status (F2)' : 'Filter Status Stok (F2)'}
          </label>
          <div
            ref={statusFilterRef}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredProducts.length > 0) {
                  setIsTableFocused(true);
                  setSelectedIdx(0);
                  statusFilterRef.current?.blur();
                }
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setStockStatus((prev) => (prev === 'all' ? 'safe' : prev === 'critical' ? 'all' : 'critical'));
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setStockStatus((prev) => (prev === 'all' ? 'critical' : prev === 'critical' ? 'safe' : 'all'));
              }
            }}
            className="flex gap-1.5 p-1 bg-slate-50 border border-slate-205 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer select-none"
          >
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setStockStatus('all')}
              className={`flex-1 py-1 rounded font-bold transition-all ${
                stockStatus === 'all' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {lang === 'en' ? 'All' : 'Semua'}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setStockStatus('critical')}
              className={`flex-1 py-1 rounded font-bold transition-all ${
                stockStatus === 'critical' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-855'
              }`}
            >
              {lang === 'en' ? 'Critical' : 'Kritis'}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setStockStatus('safe')}
              className={`flex-1 py-1 rounded font-bold transition-all ${
                stockStatus === 'safe' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-855'
              }`}
            >
              {lang === 'en' ? 'Safe' : 'Aman'}
            </button>
          </div>
        </div>

        {/* Hints */}
        <div className="text-left md:text-right flex flex-col justify-end text-[10px] text-slate-550 leading-relaxed font-semibold">
          <p>
            {lang === 'en'
              ? 'Asset estimation is based on the lowest purchase price from suppliers.'
              : 'Estimasi aset didasarkan pada harga beli terendah dari supplier.'}
          </p>
          <p className="mt-0.5 font-semibold text-slate-400">
            {lang === 'en'
              ? 'Shortcuts: F1 search product, F2 filter status, F10 export Excel.'
              : 'Pintasan: F1 cari produk, F2 filter status, F10 ekspor Excel.'}
          </p>
        </div>
      </div>

      {/* Main Stock Table */}
      <div 
        className={`bg-white rounded-xl border shadow-xs overflow-hidden transition-all ${
          isTableFocused ? 'ring-2 ring-primary-500/20 border-primary-300' : 'border-slate-200'
        }`}
        onClick={() => setIsTableFocused(true)}
      >
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-3 w-12 text-center">{lang === 'en' ? 'Detail' : 'Detail'}</th>
              <th className="p-3 w-44">{lang === 'en' ? 'SKU Code' : 'Kode SKU'}</th>
              <th className="p-3">{lang === 'en' ? 'Product Name' : 'Nama Produk'}</th>
              <th className="p-3">{lang === 'en' ? 'Description' : 'Keterangan / Deskripsi'}</th>
              <th className="p-3 text-right">{lang === 'en' ? 'Stock Quantity' : 'Kuantitas Stok'}</th>
              <th className="p-3 text-right">{lang === 'en' ? 'Est Asset Value' : 'Nilai Aset Estimasi'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                  {lang === 'en' ? 'Calculating inventory items...' : 'Sedang menghitung persediaan barang...'}
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                  {lang === 'en' ? 'No inventory items detected for this filter.' : 'Tidak ada barang persediaan terdeteksi untuk filter ini.'}
                </td>
              </tr>
            ) : (
              filteredProducts.map((p, idx) => {
                const isExpanded = !!expandedProductIds[p.id];
                const prices = p.product_prices || [];
                const lowestPrice = prices.length > 0 ? Math.min(...prices.map(pr => Number(pr.harga_beli))) : 0;
                const assetVal = Number(p.stok) * lowestPrice;
                const isCritical = Number(p.stok) < 2;
                const isSelected = isTableFocused && selectedIdx === idx;

                const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                  let base = 'p-3 text-xs align-middle transition-colors ';
                  if (isSelected) {
                    base += 'bg-blue-100 text-primary-950 font-bold ';
                    if (pos === 'first') {
                      base += 'border-l-4 border-primary-600 ';
                    }
                  } else {
                    base += 'text-slate-700 border-b border-slate-100 ';
                  }
                  return base;
                };

                return (
                  <React.Fragment key={p.id}>
                    {/* Header row */}
                    <tr 
                      ref={(el) => { rowRefs.current[idx] = el; }}
                      onClick={() => {
                        setIsTableFocused(true);
                        setSelectedIdx(idx);
                        setExpandedProductIds(prev => (prev[p.id] ? {} : { [p.id]: true }));
                      }}
                      className="hover:bg-slate-50/50 cursor-pointer"
                    >
                      <td className={getTdClass('first') + " text-center text-slate-400"}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className={getTdClass('middle') + " font-mono font-bold text-slate-700"}>{p.kode}</td>
                      <td className={getTdClass('middle') + " font-bold"}>
                        <div className="flex items-center gap-1.5">
                          <span>{p.nama}</span>
                          {isCritical && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-0.5">
                              <AlertTriangle size={8} /> RESTOCK
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={getTdClass('middle') + " text-slate-550 truncate max-w-xs"}>{p.deskripsi || '-'}</td>
                      <td className={getTdClass('middle') + ` text-right font-black font-mono text-sm ${isCritical ? 'text-rose-600' : 'text-slate-800'}`}>
                        {Number(p.stok)}
                      </td>
                      <td className={getTdClass('last') + " text-right font-mono font-bold text-emerald-600"}>
                        {formatCurrency(assetVal)}
                      </td>
                    </tr>

                    {/* Collapsible supplier-stock breakdown */}
                    {isExpanded && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={6} className="py-3 px-3 border-t border-b border-slate-200">
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                              <Package size={12} className="text-primary-600" />
                              <span>{lang === 'en' ? 'Stock Distribution and Price Per Supplier' : 'Distribusi Stok Dan Harga Per Supplier'}</span>
                            </div>

                            {prices.length > 0 ? (
                              <div className="border border-slate-200 rounded-lg overflow-hidden max-w-3xl bg-white shadow-xs">
                                <table className="w-full text-left text-[11px] border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[9px]">
                                      <th className="p-2 w-8 text-center">No</th>
                                      <th className="p-2">{lang === 'en' ? 'Supplier Code' : 'Kode Supplier'}</th>
                                      <th className="p-2">{lang === 'en' ? 'Supplier Name' : 'Nama Supplier'}</th>
                                      <th className="p-2 text-right w-24">{lang === 'en' ? 'Physical Stock' : 'Stok Fisik'}</th>
                                      <th className="p-2 text-right w-36">{lang === 'en' ? 'Supplier Buy Price' : 'Harga Beli Supplier'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {prices.map((pr, priceIdx) => (
                                      <tr key={pr.id} className="hover:bg-slate-50/40">
                                        <td className="p-2 text-center text-slate-400">{priceIdx + 1}</td>
                                        <td className="p-2 font-mono text-slate-555">{pr.supplier?.kode}</td>
                                        <td className="p-2 font-bold text-slate-900">{pr.supplier?.nama}</td>
                                        <td className="p-2 text-right font-semibold text-slate-800">{Number(pr.stok)}</td>
                                        <td className="p-2 text-right font-mono text-emerald-655 font-bold">{formatCurrency(Number(pr.harga_beli))}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic">
                                {lang === 'en' ? 'No supplier price relations registered for this product yet.' : 'Belum ada relasi harga supplier terdaftar untuk produk ini.'}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end text-[10px] text-slate-400 mt-2">
        <span>
          {lang === 'en'
            ? 'Use cursor or click table to focus, ↑ ↓ keys to select, Enter for item details.'
            : 'Gunakan kursor atau klik tabel untuk fokus, tombol ↑ ↓ untuk memilih, Enter detail item.'}
        </span>
      </div>
    </div>
  );
};
