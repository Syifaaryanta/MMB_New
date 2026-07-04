import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Package, Award, DollarSign, Activity, FileText, ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, X } from 'lucide-react';

interface SupplierPrice {
  id: string;
  supplier: {
    kode: string;
    nama: string;
    alamat: string | null;
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
  foto_urls: any;
  product_prices: SupplierPrice[];
}

export const DetailProduk: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!productId) {
      navigate('/gudang/cek-semua');
      return;
    }

    const fetchDetail = async () => {
      try {
        const res = await api.get(`/products/${productId}`);
        setProduct(res.data);
        const photos = getPhotosList(res.data);
        if (photos.length > 0) setActivePhoto(photos[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchPriceHistory = async () => {
      try {
        const res = await api.get(`/products/${productId}/price-history`);
        const sorted = (res.data || []).sort((a: any, b: any) => {
          const dateA = new Date(a.purchase?.order_date || 0).getTime();
          const dateB = new Date(b.purchase?.order_date || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          const createdA = new Date(a.purchase?.created_at || 0).getTime();
          const createdB = new Date(b.purchase?.created_at || 0).getTime();
          return createdB - createdA;
        });
        setPurchaseHistory(sorted);
      } catch (err) {
        console.error(err);
      }
    };

    fetchDetail();
    fetchPriceHistory();
  }, [productId]);

  const getPhotosList = (p: Product | null): string[] => {
    if (!p) return [];
    try {
      return typeof p.foto_urls === 'string'
        ? JSON.parse(p.foto_urls)
        : Array.isArray(p.foto_urls) ? p.foto_urls : [];
    } catch {
      return [];
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

  const photos = getPhotosList(product);
  const cheapestPrice = product && product.product_prices.length > 0
    ? Math.min(...product.product_prices.map((sp) => Number(sp.harga_beli)))
    : 0;

  // Keyboard Navigation
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (isZoomed) {
      setIsZoomed(false);
    } else {
      navigate('/dashboard');
    }
  }, { enableOnFormTags: true });

  // F2: Zoom image to fullscreen
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (photos.length > 0) {
      setIsZoomed(true);
    }
  }, { enableOnFormTags: true });

  // Left/Right arrow keys for image navigation when zoomed
  useHotkeys('left, arrowleft', (e) => {
    e.preventDefault();
    const currentIdx = photos.indexOf(activePhoto || '');
    if (currentIdx !== -1) {
      const prevIdx = (currentIdx - 1 + photos.length) % photos.length;
      setActivePhoto(photos[prevIdx]);
    }
  }, { enableOnFormTags: true, enabled: isZoomed && photos.length > 1 });

  useHotkeys('right, arrowright', (e) => {
    e.preventDefault();
    const currentIdx = photos.indexOf(activePhoto || '');
    if (currentIdx !== -1) {
      const nextIdx = (currentIdx + 1) % photos.length;
      setActivePhoto(photos[nextIdx]);
    }
  }, { enableOnFormTags: true, enabled: isZoomed && photos.length > 1 });

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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-10 skeleton w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 skeleton md:col-span-1" />
          <div className="h-64 skeleton md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="card text-center p-8 max-w-md mx-auto mt-10">
        <p className="text-slate-400">Produk tidak ditemukan</p>
        <button onClick={() => navigate(-1)} className="btn-primary mt-4">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header breadcrumbs */}
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">{product.nama}</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{product.kode}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Image Gallery & Lightbox */}
        <div className="card space-y-4 md:col-span-1 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Galeri Foto Produk</h3>
            <div className="relative aspect-square rounded-lg bg-surface-900 border border-surface-700 overflow-hidden flex items-center justify-center group">
              {activePhoto ? (
                <>
                  <img src={activePhoto} alt="Product image" className="max-w-full max-h-full object-contain" />
                  <button
                    onClick={() => setIsZoomed(true)}
                    className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Zoom Layar Penuh (F2)"
                  >
                    <Maximize2 size={14} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-600 gap-1">
                  <ImageIcon size={32} />
                  <span className="text-xs">Tidak ada foto</span>
                </div>
              )}
            </div>

            {/* Thumbnail Navigation */}
            {photos.length > 1 && (
              <div className="flex gap-2 justify-center">
                {photos.map((ph, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhoto(ph)}
                    className={`w-12 h-12 rounded border overflow-hidden bg-surface-900 transition-all ${activePhoto === ph ? 'border-primary-500 shadow' : 'border-surface-700 opacity-60 hover:opacity-100'
                      }`}
                  >
                    <img src={ph} alt="thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 border-t border-surface-700/50 pt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span>Tekan <kbd className="shortcut-badge text-[10px]">F2</kbd> untuk fullscreen</span>
            <span>Tekan <kbd className="shortcut-badge text-[10px]">Esc</kbd> untuk kembali</span>
          </div>
        </div>

        {/* Right Column: Spec Details & Suppliers Inventory */}
        <div className="md:col-span-2 space-y-6">
          {/* Spec Card */}
          <div className="card space-y-4 p-0 overflow-hidden border border-slate-200">
            <div className="bg-blue-50 border-b border-blue-100 p-3">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Spesifikasi Detail</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 pb-4">
              <div>
                <p className="text-xs text-slate-400">Total Stok Tersedia</p>
                <p className="text-base font-extrabold text-slate-800 mt-0.5">
                  {Number(product.stok)} {product.satuan}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Harga Beli Terendah</p>
                <p className="text-base font-extrabold text-emerald-600 mt-0.5 currency">
                  {cheapestPrice > 0 ? formatCurrency(cheapestPrice) : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Supplier inventory details */}
          <div className="card p-0 overflow-hidden border border-slate-200">
            <div className="bg-amber-50 border-b border-amber-100 p-3">
              <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Rincian Persediaan Per Supplier</h3>
            </div>
            <div className="p-4 pt-3">
              {product.product_prices.length > 0 ? (
                <div className="space-y-3">
                  {product.product_prices.map((p) => {
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
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${Number(p.stok) > 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                            : 'bg-slate-50 text-slate-400 border-slate-200/50'
                            }`}>
                            {Number(p.stok)} {product.satuan} tersedia
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
                <div className="text-center p-6 bg-surface-900 border border-dashed border-surface-700 rounded-lg text-slate-500 text-xs">
                  Tidak ada data stok terdaftar di supplier.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox zoom modal */}
      {isZoomed && activePhoto && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md" 
          onClick={() => setIsZoomed(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/10 z-50"
            title="Tutup (Esc)"
          >
            <X size={22} />
          </button>

          {/* Main content area with left/right chevrons */}
          <div className="relative max-w-4xl w-full flex items-center justify-center px-12 py-4" onClick={(e) => e.stopPropagation()}>
            {photos.length > 1 && (
              <button
                onClick={() => {
                  const currentIdx = photos.indexOf(activePhoto || '');
                  const prevIdx = (currentIdx - 1 + photos.length) % photos.length;
                  setActivePhoto(photos[prevIdx]);
                }}
                className="absolute left-4 p-3 bg-white/5 hover:bg-white/15 text-white rounded-full transition-all border border-white/5"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <img 
              src={activePhoto} 
              alt="Product full preview" 
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/5 animate-scale-in" 
            />

            {photos.length > 1 && (
              <button
                onClick={() => {
                  const currentIdx = photos.indexOf(activePhoto || '');
                  const nextIdx = (currentIdx + 1) % photos.length;
                  setActivePhoto(photos[nextIdx]);
                }}
                className="absolute right-4 p-3 bg-white/5 hover:bg-white/15 text-white rounded-full transition-all border border-white/5"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Footer controls & key help */}
          <div className="mt-4 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {photos.length > 1 && (
              <div className="flex gap-2">
                {photos.map((ph, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhoto(ph)}
                    className={`w-10 h-10 rounded-md border overflow-hidden transition-all ${
                      activePhoto === ph 
                        ? 'border-primary-500 scale-105 shadow-lg shadow-primary-500/20' 
                        : 'border-white/10 opacity-50 hover:opacity-100'
                    }`}
                  >
                    <img src={ph} alt="thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="text-[11px] text-slate-400 bg-white/5 border border-white/5 rounded-full px-3 py-1 font-medium">
              Gunakan <kbd className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-mono">←</kbd> / <kbd className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-mono">→</kbd> untuk navigasi, <kbd className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-mono">Esc</kbd> untuk kembali
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
