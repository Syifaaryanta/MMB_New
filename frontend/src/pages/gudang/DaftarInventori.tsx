import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { Search, ChevronLeft, ChevronRight, X, AlertTriangle, Image as ImageIcon, Archive, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────── */
interface Product {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  foto_urls?: any;
  harga_beli_terbaru?: number | null;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

/* ─── Toast Component ────────────────────────────────────────── */
const ToastNotifications: React.FC<{ toasts: Toast[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-sm
          ${t.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-700/60 text-emerald-100'
            : 'bg-red-950/90 border-red-700/60 text-red-100'
          }`}
      >
        {t.type === 'success'
          ? <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-400" />
          : <XCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
        }
        <p className="text-sm font-medium flex-1">{t.message}</p>
        <button
          onClick={() => onDismiss(t.id)}
          className="shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      </div>
    ))}
  </div>
);

/* ─── Confirm Archive Modal ──────────────────────────────────── */
interface ConfirmArchiveModalProps {
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
}
const ConfirmArchiveModal: React.FC<ConfirmArchiveModalProps> = ({ productName, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onCancel}>
    <div
      className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Amber header */}
      <div className="flex items-center gap-3 bg-amber-500/10 border-b border-amber-500/20 px-5 py-4">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <Archive size={18} className="text-amber-400" />
        </div>
        <div>
          <h2 className="font-bold text-white text-sm">Arsipkan Produk</h2>
          <p className="text-xs text-amber-400/80 mt-0.5">Tindakan ini dapat dibatalkan melalui halaman arsip</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5">
        <p className="text-slate-300 text-sm leading-relaxed">
          Apakah Anda yakin ingin mengarsipkan produk{' '}
          <span className="font-bold text-white">"{productName}"</span>?
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Produk yang diarsipkan tidak akan muncul di daftar aktif, namun datanya tetap tersimpan.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-5 pb-5 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 hover:text-white transition-colors border border-surface-600"
        >
          <kbd className="text-[10px] bg-surface-700 border border-surface-600 rounded px-1 py-0.5 font-mono">Esc</kbd>
          Batal
        </button>
        <button
          onClick={onConfirm}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 transition-colors shadow-lg shadow-amber-500/20"
        >
          <kbd className="text-[10px] bg-amber-400/40 border border-amber-400/40 rounded px-1 py-0.5 font-mono">Y</kbd>
          Ya, Arsipkan
        </button>
      </div>
    </div>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────── */
export const DaftarInventori: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Confirm archive modal state
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; nama: string } | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Helpers ──────────────────────────────────── */
  const addToast = (type: Toast['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const getPhotosList = (p: Product): string[] => {
    if (!p) return [];
    try {
      return typeof p.foto_urls === 'string'
        ? JSON.parse(p.foto_urls)
        : Array.isArray(p.foto_urls) ? p.foto_urls : [];
    } catch {
      return [];
    }
  };

  /* ── Fetch ────────────────────────────────────── */
  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/products?q=${search}&page=${page}&limit=15`);
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
    fetchInventory();
  }, [page, search]);

  useEffect(() => {
    const params: any = {};
    if (search) params.q = search;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [search, page]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  /* ── Archive logic ────────────────────────────── */
  const handleArchive = (id: string, nama: string) => {
    setArchiveTarget({ id, nama });
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    const { id, nama } = archiveTarget;
    setArchiveTarget(null);
    try {
      await api.patch(`/products/${id}/archive`);
      addToast('success', `Produk "${nama}" berhasil diarsipkan.`);
      fetchInventory();
    } catch (err) {
      console.error(err);
      addToast('error', `Gagal mengarsipkan produk "${nama}". Coba lagi.`);
    }
  };

  /* ── Hotkeys ──────────────────────────────────── */
  useHotkeys('f1', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  }, { enableOnFormTags: true });

  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (products.length > 0) {
      const active = products[selectedIdx];
      if (active) {
        const photos = getPhotosList(active);
        if (photos.length > 0) setIsZoomed(true);
      }
    }
  }, { enableOnFormTags: true });

  useHotkeys('up', (e) => {
    e.preventDefault();
    setSelectedIdx((prev) => Math.max(0, prev - 1));
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    setSelectedIdx((prev) => Math.min(products.length - 1, prev + 1));
  }, { enableOnFormTags: false });

  useHotkeys('pageup', (e) => {
    e.preventDefault();
    setPage((p) => Math.max(1, p - 1));
  }, { enableOnFormTags: false });

  useHotkeys('pagedown', (e) => {
    e.preventDefault();
    const maxPage = Math.ceil(totalProducts / 15);
    setPage((p) => Math.min(maxPage, p + 1));
  }, { enableOnFormTags: false });

  useHotkeys('enter', (e) => {
    e.preventDefault();
    if (products.length > 0) {
      const active = products[selectedIdx];
      if (active) navigate(`/gudang/detail?id=${active.id}`);
    }
  }, { enableOnFormTags: false });

  useHotkeys('delete, del', (e) => {
    e.preventDefault();
    if (products.length > 0) {
      const active = products[selectedIdx];
      if (active) handleArchive(active.id, active.nama);
    }
  }, { enableOnFormTags: false });

  useHotkeys('y', (e) => {
    e.preventDefault();
    if (archiveTarget) confirmArchive();
  }, { enableOnFormTags: false });

  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (archiveTarget) {
      setArchiveTarget(null);
    } else if (isZoomed) {
      setIsZoomed(false);
    } else if (search) {
      setSearch('');
    } else {
      navigate('/dashboard');
    }
  }, { enableOnFormTags: true });

  /* ── Render ───────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Toasts */}
      <ToastNotifications toasts={toasts} onDismiss={dismissToast} />

      {/* Archive Confirm Modal */}
      {archiveTarget && (
        <ConfirmArchiveModal
          productName={archiveTarget.nama}
          onConfirm={confirmArchive}
          onCancel={() => setArchiveTarget(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Daftar Inventori Real-time</h1>
          <p className="text-slate-400">Ikhtisar persediaan fisik seluruh unit barang yang tersedia di gudang MMB</p>
        </div>
        <button onClick={() => navigate('/gudang')} className="btn-secondary text-xs">
          Kembali ke Gudang
        </button>
      </div>

      {/* Filters */}
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
            placeholder="Cari Kode atau Nama Barang... (F1)"
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

        <div className="flex flex-wrap gap-2 text-xs text-slate-400 shrink-0">
          <span className="bg-surface-800 px-2 py-1 rounded">F1: Cari</span>
          <span className="bg-surface-800 px-2 py-1 rounded">F2: Zoom Gambar</span>
          <span className="bg-surface-800 px-2 py-1 rounded">Enter: Detail</span>
          <span className="bg-surface-800 px-2 py-1 rounded">Del: Arsipkan</span>
          <span className="bg-surface-800 px-2 py-1 rounded">Esc: Kembali</span>
        </div>
      </div>

      {/* Inventory Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 skeleton" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="card p-0 overflow-hidden border border-surface-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4">Kode Barang</th>
                  <th className="p-4">Nama Barang</th>
                  <th className="p-4 text-right">Stok Fisik</th>
                  <th className="p-4 text-right">Harga Beli Terbaru</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {products.map((p, idx) => {
                  const isLow = Number(p.stok) <= 10;
                  const photos = getPhotosList(p);
                  const photoUrl = photos.length > 0 ? photos[0] : null;
                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        onClick={() => setSelectedIdx(idx)}
                        className={`hover:bg-surface-800/20 cursor-pointer transition-colors ${
                          idx === selectedIdx ? 'table-row-selected border-b-0' : ''
                        }`}
                        style={idx === selectedIdx ? { borderBottom: 'none' } : {}}
                      >
                        <td className="p-4 font-mono font-semibold text-slate-300">{p.kode}</td>
                        <td className="p-4 font-bold text-white">{p.nama}</td>
                        <td className="p-4 text-right font-bold text-slate-200">{Number(p.stok)}</td>
                        <td className="p-4 text-right font-bold text-emerald-400">
                          {p.harga_beli_terbaru !== null && p.harga_beli_terbaru !== undefined
                            ? formatCurrency(p.harga_beli_terbaru)
                            : '-'}
                        </td>
                        <td className="p-4 text-center">
                          {isLow ? (
                            <span className="badge badge-red inline-flex items-center gap-1">
                              <AlertTriangle size={12} />
                              <span>Kritis</span>
                            </span>
                          ) : (
                            <span className="badge badge-green">Aman</span>
                          )}
                        </td>
                      </tr>
                      {idx === selectedIdx && (
                        <tr className="bg-[rgba(59,130,246,0.08)] border-t-0" style={{ borderLeft: '3px solid #3b82f6', borderTop: 'none' }}>
                          <td colSpan={5} className="p-4 pt-1 pb-3 border-t-0">
                            <div className="flex items-center gap-4 bg-slate-900/10 p-3 rounded-lg border border-surface-700/30 w-fit">
                              <div className="relative w-20 h-20 rounded-lg bg-surface-800 border border-surface-700 overflow-hidden flex items-center justify-center group/img">
                                {photoUrl ? (
                                  <img src={photoUrl} alt={p.nama} className="max-w-full max-h-full object-contain" />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-slate-500 gap-1 text-[10px]">
                                    <ImageIcon size={20} />
                                    <span>No Photo</span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview Gambar</h4>
                                {photoUrl ? (
                                  <p className="text-xs text-slate-600">Tekan <kbd className="shortcut-badge text-[10px]">F2</kbd> untuk fullsize</p>
                                ) : (
                                  <p className="text-[11px] text-slate-500 italic">Tidak ada foto produk</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 bg-surface-800/50 border-t border-surface-700">
            <span className="text-xs text-slate-400">
              Menampilkan {products.length} dari {totalProducts} SKU terdaftar
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary p-1.5 rounded-lg disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs px-3 font-semibold">Halaman {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={products.length < 15}
                className="btn-secondary p-1.5 rounded-lg disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 bg-surface-800/20 border border-dashed border-surface-700 rounded-xl">
          Belum ada produk aktif terdaftar.
        </div>
      )}

      {/* Lightbox zoom modal */}
      {isZoomed && products[selectedIdx] && (
        (() => {
          const photos = getPhotosList(products[selectedIdx]);
          const photoUrl = photos.length > 0 ? photos[0] : null;
          return photoUrl ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setIsZoomed(false)}>
              <div className="relative max-w-3xl w-full max-h-screen p-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setIsZoomed(false)}
                  className="absolute top-2 right-2 p-2 bg-black/60 rounded-full hover:bg-black text-white z-10 transition-colors"
                >
                  <X size={20} />
                </button>
                <img src={photoUrl} alt="Product full preview" className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl" />
              </div>
            </div>
          ) : null;
        })()
      )}
    </div>
  );
};
