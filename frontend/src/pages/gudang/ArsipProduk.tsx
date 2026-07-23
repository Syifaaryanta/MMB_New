import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Search, RotateCcw, ChevronLeft, ChevronRight, X, CheckCircle, XCircle, AlertCircle, Archive } from 'lucide-react';

interface Product {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
}

export const ArsipProduk: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(() => {
    return Number(sessionStorage.getItem('mmb_arsip_produk_page')) || 1;
  });
  const [search, setSearch] = useState(() => {
    return sessionStorage.getItem('mmb_arsip_produk_search') || '';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(() => {
    return Number(sessionStorage.getItem('mmb_arsip_produk_selectedIdx')) || 0;
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);

  // Restore confirm modal state
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; nama: string } | null>(null);

  // Toast state
  interface Toast { id: number; type: 'success' | 'error'; message: string; }
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: Toast['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const fetchArchivedProducts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/products?q=${search}&archived=true&page=${page}&limit=10`);
      setProducts(res.data.data || []);
      setTotalProducts(res.data.total || 0);
      setSelectedIdx(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedProducts();
  }, [page, search]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Auto scroll selected table row into view
  useEffect(() => {
    if (activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIdx]);

  // Sync state to sessionStorage for persistence on refresh
  useEffect(() => {
    sessionStorage.setItem('mmb_arsip_produk_page', String(page));
    sessionStorage.setItem('mmb_arsip_produk_search', search);
    sessionStorage.setItem('mmb_arsip_produk_selectedIdx', String(selectedIdx));
  }, [page, search, selectedIdx]);

  const handleRestore = () => {
    const active = products[selectedIdx];
    if (!active) return;
    setRestoreTarget({ id: active.id, nama: active.nama });
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    const { id, nama } = restoreTarget;
    setRestoreTarget(null);
    try {
      await api.patch(`/products/${id}/restore`);
      addToast('success', lang === 'en' ? `Product "${nama}" successfully restored.` : `Produk "${nama}" berhasil dipulihkan.`);
      fetchArchivedProducts();
    } catch (err) {
      console.error(err);
      addToast('error', lang === 'en' ? `Failed to restore product "${nama}". Try again.` : `Gagal memulihkan produk "${nama}". Coba lagi.`);
    }
  };

  // Keyboard Shortcuts
  // F1: Focus Search Input
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  }, { enableOnFormTags: true });

  // F3: Restore
  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (products.length > 0) {
      handleRestore();
    }
  }, { enableOnFormTags: true });

  // Enter: Restore (when not typing)
  useHotkeys('enter', (e) => {
    e.preventDefault();
    if (products.length > 0) {
      handleRestore();
    }
  }, { enableOnFormTags: false });

  // Arrow Keys Navigation
  useHotkeys('up', (e) => {
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(0, prev - 1));
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(products.length - 1, prev + 1));
  }, { enableOnFormTags: false });

  // PageUp / PageDown Pagination
  useHotkeys('pageup', (e) => {
    e.preventDefault();
    setPage((p) => Math.max(1, p - 1));
  }, { enableOnFormTags: false });

  useHotkeys('pagedown', (e) => {
    e.preventDefault();
    const maxPage = Math.ceil(totalProducts / 10);
    setPage((p) => Math.min(maxPage, p + 1));
  }, { enableOnFormTags: false });

  // Esc Handler
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (restoreTarget) {
      setRestoreTarget(null);
    } else if (search) {
      setSearch('');
    } else {
      navigate('/gudang');
    }
  }, { enableOnFormTags: true });

  useHotkeys('y', (e) => {
    e.preventDefault();
    if (restoreTarget) confirmRestore();
  }, { enableOnFormTags: false });

  // Helper variables to bypass TS checking if form modals don't exist
  const showFormModal = false;
  const showEditTypeModal = false;
  const showGalleryModal = false;

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-sm ${t.type === 'success' ? 'bg-emerald-950/90 border-emerald-700/60 text-emerald-100' : 'bg-red-950/90 border-red-700/60 text-red-100'
            }`}>
            {t.type === 'success' ? <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-red-400" />}
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button onClick={() => dismissToast(t.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button>
          </div>
        ))}
      </div>

      {/* Restore Confirm Modal */}
      {restoreTarget && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setRestoreTarget(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-2 bg-blue-50 border-b border-blue-100 px-5 py-4">
              <div className="p-2 bg-blue-100 rounded-full"><RotateCcw size={20} className="text-blue-600" /></div>
              <div>
                <h2 className="font-bold text-slate-800 text-sm">{lang === 'en' ? 'Restore Product' : 'Pulihkan Produk'}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{lang === 'en' ? 'Product will be active again and can be used in transactions' : 'Produk akan aktif kembali dan dapat digunakan dalam transaksi'}</p>
              </div>
            </div>
            <div className="px-5 py-5 text-center">
              <p className="text-slate-700 text-sm leading-relaxed">
                {lang === 'en' ? 'Are you sure you want to restore product' : 'Apakah Anda yakin ingin memulihkan produk'}{' '}
                <span className="font-bold text-slate-900">"{restoreTarget.nama}"</span>?
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {lang === 'en' ? 'The product will reappear in the active list and can be used in purchases or sales.' : 'Produk akan kembali muncul di daftar aktif dan bisa digunakan dalam transaksi pembelian maupun penjualan.'}
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5 justify-center">
              <button onClick={() => setRestoreTarget(null)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors border border-slate-200">
                <kbd className="text-[10px] bg-slate-200 border border-slate-300 rounded px-1 py-0.5 font-mono">Esc</kbd>
                {lang === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button onClick={confirmRestore} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-md shadow-blue-600/10">
                <kbd className="text-[10px] bg-blue-500 border border-blue-400 rounded px-1 py-0.5 font-mono">Y</kbd>
                {lang === 'en' ? 'Yes, Restore' : 'Ya, Pulihkan'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            {lang === 'en' ? 'Archived Products' : 'Arsip Produk'}
          </h1>
          <p className="text-slate-400">
            {lang === 'en'
              ? 'Restore items that have been archived to be used again in transactions'
              : 'Pulihkan barang yang telah diarsipkan untuk digunakan kembali dalam transaksi'}
          </p>
        </div>
        <button onClick={() => navigate('/gudang')} className="btn-secondary text-xs">
          {lang === 'en' ? 'Back to Inventory' : 'Kembali ke Gudang'}
        </button>
      </div>

      {/* Search Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
        <div className="relative flex-1 w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search size={16} />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.blur();
                setSelectedIdx(0);
              }
            }}
            placeholder={lang === 'en' ? 'Search Archived Products... (F1)' : 'Cari Produk Terarsip... (F1)'}
            className="input-field pl-9 w-full"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 bg-surface-800/40 px-4 py-2.5 rounded-xl border border-surface-700/50 shrink-0">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">F1</kbd>
            <span>{lang === 'en' ? 'Search' : 'Cari'}</span>
          </span>

          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">F3 / Enter</kbd>
            <span>{lang === 'en' ? 'Restore' : 'Pulihkan'}</span>
          </span>

          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">Esc</kbd>
            <span>{lang === 'en' ? 'Back' : 'Kembali'}</span>
          </span>
        </div>
      </div>

      {/* Table Section */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 skeleton" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="card p-0 overflow-hidden border border-surface-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4">{lang === 'en' ? 'Code' : 'Kode'}</th>
                  <th className="p-4">{lang === 'en' ? 'Product Name' : 'Nama Produk'}</th>
                  <th className="p-4 text-right">{lang === 'en' ? 'Stock' : 'Stok'}</th>
                  <th className="p-4 text-center">{lang === 'en' ? 'Action' : 'Aksi'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {products.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedIdx(idx)}
                    ref={idx === selectedIdx ? activeRowRef : null}
                    className={`hover:bg-surface-800/40 cursor-pointer transition-colors ${idx === selectedIdx ? 'table-row-selected' : ''
                      }`}
                  >
                    <td className="p-4 font-mono text-slate-300 font-semibold">{p.kode}</td>
                    <td className="p-4 font-bold text-white">{p.nama}</td>
                    <td className="p-4 text-right font-semibold text-slate-200">{Number(p.stok)}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={handleRestore}
                        className="btn-secondary py-1 px-2.5 text-xs text-primary-400 hover:text-white"
                      >
                        <RotateCcw size={12} />
                        <span>{lang === 'en' ? 'Restore' : 'Pulihkan'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between p-4 bg-surface-800/50 border-t border-surface-700">
            <span className="text-xs text-slate-400">
              {lang === 'en'
                ? `Showing ${products.length} of ${totalProducts} archived items`
                : `Menampilkan ${products.length} dari ${totalProducts} barang terarsip`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary p-1.5 rounded-lg disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs px-3 font-semibold">
                {lang === 'en' ? `Page ${page}` : `Halaman ${page}`}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={products.length < 10}
                className="btn-secondary p-1.5 rounded-lg disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : search.trim() !== '' ? (
        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/10 min-h-[250px]">
          <AlertCircle className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-400">
            {lang === 'en' ? 'Archived Product Not Found' : 'Produk Terarsip Tidak Ditemukan'}
          </h3>
          <p className="text-sm mt-1 max-w-xs">
            {lang === 'en'
              ? `No archived products match the search "${search}".`
              : `Tidak ada produk terarsip yang cocok dengan pencarian "${search}".`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/10 min-h-[250px]">
          <Archive className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-400">
            {lang === 'en' ? 'Archive is Empty' : 'Arsip Kosong'}
          </h3>
          <p className="text-sm mt-1 max-w-xs">
            {lang === 'en' ? 'No archived products currently.' : 'Tidak ada produk terarsip saat ini.'}
          </p>
        </div>
      )}
    </div>
  );
};
