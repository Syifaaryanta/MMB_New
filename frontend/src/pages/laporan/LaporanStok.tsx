import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [stockStatus, setStockStatus] = useState<'all' | 'critical' | 'safe'>('all');

  // Selection & expand
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  // Summary Metrics
  const [totalAsetVal, setTotalAsetVal] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

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
      const isCritical = Number(p.stok) <= 10;

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

  // Shortcuts
  // F1: Focus Search Input
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: true });

  // F2: Export Excel
  useHotkeys('f2', (e) => {
    e.preventDefault();
    exportToExcel();
  }, { enableOnFormTags: false });

  // Escape: Return to menu
  useHotkeys('esc', (e) => {
    e.preventDefault();
    navigate('/laporan');
  }, { enableOnFormTags: true });

  const exportToExcel = () => {
    if (products.length === 0) return;
    const excelRows = filteredProducts.map((p) => {
      const prices = p.product_prices || [];
      const lowestPrice = prices.length > 0 ? Math.min(...prices.map(pr => Number(pr.harga_beli))) : 0;
      const assetVal = Number(p.stok) * lowestPrice;

      return {
        'Kode Barang': p.kode,
        'Nama Barang': p.nama,
        'Deskripsi': p.deskripsi || '-',
        'Stok Akhir': Number(p.stok),
        'Satuan': p.satuan,
        'Estimasi Harga Beli Terendah': lowestPrice,
        'Estimasi Nilai Aset': assetVal,
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stok Persediaan');
    XLSX.writeFile(wb, `Laporan_Stok_Persediaan_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate('/laporan')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={12} /> Kembali ke Menu (Esc)
          </button>
          <h1 className="text-2xl font-extrabold text-white">Laporan Stok Persediaan</h1>
          <p className="text-slate-400 text-sm">Monitoring kuantitas inventori gudang, stok kritis, dan total estimasi aset.</p>
        </div>

        <div className="flex gap-2 text-xs text-slate-300">
          <button 
            onClick={exportToExcel}
            disabled={filteredProducts.length === 0}
            className="card bg-surface-800 hover:bg-surface-750 px-3.5 py-2 text-slate-350 font-bold border border-surface-700/60 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} />
            <span>Ekspor Excel (F2)</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimasi Nilai Aset</span>
            <span className="text-xl font-black text-emerald-400 block mt-0.5">{formatCurrency(totalAsetVal)}</span>
          </div>
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stok Kritis (&le; 10)</span>
            <span className="text-xl font-black text-rose-400 block mt-0.5">{criticalCount} SKU</span>
          </div>
          <div className="p-3 bg-rose-950 text-rose-400 rounded-xl">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card p-4 flex items-center justify-between border border-surface-700 bg-surface-800/80">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total SKU Terdaftar</span>
            <span className="text-xl font-black text-white block mt-0.5">{products.length} Barang</span>
          </div>
          <div className="p-3 bg-indigo-950 text-indigo-400 rounded-xl">
            <Layers size={20} />
          </div>
        </div>
      </div>

      {/* Control Board */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Cari Barang / Kode SKU (F1)</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Ketik nama atau SKU produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Filter Stock */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">Filter Status Stok</label>
          <div className="flex gap-1.5 p-1 bg-surface-900 border border-surface-750 rounded-lg text-xs">
            <button
              onClick={() => setStockStatus('all')}
              className={`flex-1 py-1.5 rounded font-bold transition-all ${stockStatus === 'all' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Semua
            </button>
            <button
              onClick={() => setStockStatus('critical')}
              className={`flex-1 py-1.5 rounded font-bold transition-all ${stockStatus === 'critical' ? 'bg-danger-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Kritis
            </button>
            <button
              onClick={() => setStockStatus('safe')}
              className={`flex-1 py-1.5 rounded font-bold transition-all ${stockStatus === 'safe' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Aman
            </button>
          </div>
        </div>

        {/* Hints */}
        <div className="text-right flex flex-col justify-end text-[10px] text-slate-500">
          <p>Estimasi aset didasarkan pada harga beli terendah dari supplier.</p>
          <p className="mt-1">Pintasan: <kbd className="shortcut-badge">F1</kbd> cari produk, <kbd className="shortcut-badge">F2</kbd> ekspor Excel.</p>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="card p-0 overflow-hidden border border-surface-700/65 shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-4 w-12 text-center">Detail</th>
              <th className="p-4 w-44">Kode SKU</th>
              <th className="p-4">Nama Produk</th>
              <th className="p-4">Keterangan / Deskripsi</th>
              <th className="p-4 text-center">Satuan</th>
              <th className="p-4 text-right">Kuantitas Stok</th>
              <th className="p-4 text-right">Nilai Aset Estimasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-750">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                  Sedang menghitung persediaan barang...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                  Tidak ada barang persediaan terdeteksi untuk filter ini.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const isExpanded = !!expandedProductIds[p.id];
                const prices = p.product_prices || [];
                const lowestPrice = prices.length > 0 ? Math.min(...prices.map(pr => Number(pr.harga_beli))) : 0;
                const assetVal = Number(p.stok) * lowestPrice;
                const isCritical = Number(p.stok) <= 10;

                return (
                  <React.Fragment key={p.id}>
                    {/* Header row */}
                    <tr 
                      onClick={() => setExpandedProductIds(prev => ({ ...prev, [p.id]: !isExpanded }))}
                      className="hover:bg-surface-750/30 cursor-pointer text-slate-350"
                    >
                      <td className="p-4 text-center text-slate-500">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-200">{p.kode}</td>
                      <td className="p-4 font-bold text-slate-200 flex items-center gap-1.5">
                        <span>{p.nama}</span>
                        {isCritical && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-danger-950 text-danger-400 border border-danger-700/30 inline-flex items-center gap-0.5">
                            <AlertTriangle size={8} /> Restock
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-400 truncate max-w-xs">{p.deskripsi || '-'}</td>
                      <td className="p-4 text-center font-semibold text-slate-400 uppercase">{p.satuan}</td>
                      <td className={`p-4 text-right font-black font-mono text-sm ${isCritical ? 'text-rose-450' : 'text-white'}`}>
                        {Number(p.stok)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(assetVal)}
                      </td>
                    </tr>

                    {/* Collapsible supplier-stock breakdown */}
                    {isExpanded && (
                      <tr className="bg-surface-850/40">
                        <td colSpan={7} className="p-4 border-t border-b border-surface-700/60">
                          <div className="space-y-3 pl-8">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                              <Package size={12} className="text-primary-400" />
                              <span>Distribusi Stok Dan Harga Per Supplier</span>
                            </div>

                            {prices.length > 0 ? (
                              <div className="border border-surface-750 rounded-lg overflow-hidden max-w-3xl">
                                <table className="w-full text-left text-[11px] border-collapse">
                                  <thead>
                                    <tr className="bg-surface-800 text-slate-400 font-semibold border-b border-surface-750">
                                      <th className="p-2 w-8 text-center">No</th>
                                      <th className="p-2">Kode Supplier</th>
                                      <th className="p-2">Nama Supplier</th>
                                      <th className="p-2 text-right w-24">Stok Fisik</th>
                                      <th className="p-2 text-right w-36">Harga Beli Supplier</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-surface-750">
                                    {prices.map((pr, idx) => (
                                      <tr key={pr.id} className="text-slate-350">
                                        <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                                        <td className="p-2 font-mono text-slate-400">{pr.supplier?.kode}</td>
                                        <td className="p-2 font-bold text-slate-200">{pr.supplier?.nama}</td>
                                        <td className="p-2 text-right font-semibold text-white">{Number(pr.stok)}</td>
                                        <td className="p-2 text-right font-mono text-emerald-400">{formatCurrency(Number(pr.harga_beli))}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic">Belum ada relasi harga supplier terdaftar untuk produk ini.</p>
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
    </div>
  );
};
