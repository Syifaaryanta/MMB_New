import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CheckSquare, Search, Play, Check, AlertTriangle, X,
  Package, PackageCheck, AlertCircle, Info, Minus, Plus,
} from 'lucide-react';

interface Purchase {
  id: string;
  no_order: string;
  order_date: string;
  supplier: { id: string; kode: string; nama: string };
  subtotal: number;
  terms?: string;
}

interface PurchaseItem {
  id: string;
  qty: number;
  harga_beli: number;
  product: { id: string; kode: string; nama: string; satuan: string };
}

// Per-item receiving state
interface ItemReceiveState {
  qty_terima: number;
  qty_rusak: number;
  catatan: string;
}

type ModalState = 'none' | 'summary' | 'confirmed';

export const Receiving: React.FC = () => {
  const navigate = useNavigate();

  // PO List States
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTableFocused, setIsTableFocused] = useState(false);

  // Active PO Checklist States
  const [activePo, setActivePo] = useState<any | null>(() => {
    const saved = sessionStorage.getItem('receiving_activePo');
    return saved ? JSON.parse(saved) : null;
  });
  const [poItems, setPoItems] = useState<PurchaseItem[]>(() => {
    const saved = sessionStorage.getItem('receiving_poItems');
    return saved ? JSON.parse(saved) : [];
  });
  const [receiveStates, setReceiveStates] = useState<Record<string, ItemReceiveState>>(() => {
    const saved = sessionStorage.getItem('receiving_receiveStates');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeItemIdx, setActiveItemIdx] = useState(() => {
    const saved = sessionStorage.getItem('receiving_activeItemIdx');
    return saved ? Number(saved) : 0;
  });

  // Modal & UI States
  const [modalState, setModalState] = useState<ModalState>(() => {
    const saved = sessionStorage.getItem('receiving_modalState');
    return (saved as ModalState) || 'none';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Real-time Clock
  const [realtimeTime, setRealtimeTime] = useState('');

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch completed purchases
  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/purchases?status=completed&limit=1000');
      setPurchases(res.data.data || []);
      setSelectedIdx(0);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  // Clock & Initial Load
  useEffect(() => {
    fetchPurchases();
    const updateTime = () => {
      const now = new Date();
      const fmt = now.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }) + ' - ' + now.toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      setRealtimeTime(fmt);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 150);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (activePo) {
      sessionStorage.setItem('receiving_activePo', JSON.stringify(activePo));
    } else {
      sessionStorage.removeItem('receiving_activePo');
    }
  }, [activePo]);

  useEffect(() => {
    sessionStorage.setItem('receiving_poItems', JSON.stringify(poItems));
  }, [poItems]);

  useEffect(() => {
    sessionStorage.setItem('receiving_receiveStates', JSON.stringify(receiveStates));
  }, [receiveStates]);

  useEffect(() => {
    sessionStorage.setItem('receiving_activeItemIdx', String(activeItemIdx));
  }, [activeItemIdx]);

  useEffect(() => {
    sessionStorage.setItem('receiving_modalState', modalState);
  }, [modalState]);
  const filteredPurchases = purchases.filter((p) =>
    p.supplier?.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.no_order?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPurchases.length > 0) {
        setIsTableFocused(true);
        setSelectedIdx(0);
        searchInputRef.current?.blur();
      }
    }
  };

  const handleOpenChecklist = async (po: Purchase) => {
    try {
      const res = await api.get(`/purchases/${po.id}`);
      const items: PurchaseItem[] = res.data.purchase_items || [];
      setActivePo(res.data);
      setPoItems(items);
      // Initialize receive states: qty_terima = full PO qty, qty_rusak = 0
      const init: Record<string, ItemReceiveState> = {};
      items.forEach((it) => {
        init[it.id] = { qty_terima: Number(it.qty), qty_rusak: 0, catatan: '' };
      });
      setReceiveStates(init);
      setActiveItemIdx(0);
      setModalState('none');
    } catch (err) { console.error(err); }
  };

  // Compute summary stats
  const getSummary = () => {
    let totalPo = 0;
    let totalDatang = 0;
    let totalRusak = 0;
    let totalLayak = 0;
    let totalKurang = 0;
    let itemsWithIssue = 0;

    poItems.forEach((item) => {
      const state = receiveStates[item.id];
      if (!state) return;
      const qtyPo = Number(item.qty);
      const qtyDatang = state.qty_terima;
      const qtyRusak = state.qty_rusak;
      const qtyLayak = Math.max(0, qtyDatang - qtyRusak);
      const qtyKurang = Math.max(0, qtyPo - qtyDatang);
      totalPo += qtyPo;
      totalDatang += qtyDatang;
      totalRusak += qtyRusak;
      totalLayak += qtyLayak;
      totalKurang += qtyKurang;
      if (qtyDatang < qtyPo || qtyRusak > 0) itemsWithIssue++;
    });

    return { totalPo, totalDatang, totalRusak, totalLayak, totalKurang, itemsWithIssue };
  };

  const handleFinalizeClick = () => {
    setModalState('summary');
  };

  const executeFinalize = async () => {
    if (!activePo) return;
    setIsSubmitting(true);
    try {
      const items = poItems.map((item) => {
        const state = receiveStates[item.id] || { qty_terima: Number(item.qty), qty_rusak: 0, catatan: '' };
        return {
          purchase_item_id: item.id,
          qty_terima: state.qty_terima,
          qty_rusak: state.qty_rusak,
          catatan: state.catatan || undefined,
        };
      });

      await api.patch(`/purchases/${activePo.id}/receive`, { items });
      showToast('✅ Penerimaan PO diselesaikan! Stok gudang berhasil diperbarui.', 'success');
      setActivePo(null);
      setModalState('none');
      fetchPurchases();
      setIsTableFocused(false);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 150);
    } catch {
      showToast('Gagal menyelesaikan penerimaan PO', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateItemState = (itemId: string, field: keyof ItemReceiveState, value: number | string) => {
    setReceiveStates((prev) => {
      const cur = prev[itemId] || { qty_terima: 0, qty_rusak: 0, catatan: '' };
      const updated = { ...cur, [field]: value };
      return { ...prev, [itemId]: updated };
    });
  };

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────────

  // Enter: open checklist in list mode
  useHotkeys('enter', (e) => {
    if (!activePo && isTableFocused && filteredPurchases[selectedIdx] && modalState === 'none') {
      e.preventDefault();
      handleOpenChecklist(filteredPurchases[selectedIdx]);
    }
  }, { enableOnFormTags: false }, [isTableFocused, selectedIdx, activePo, filteredPurchases, modalState]);

  // F1: focus search
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (!activePo) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, { enableOnFormTags: true }, [activePo]);

  // F10: finalize
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (activePo && modalState === 'none') handleFinalizeClick();
  }, { enableOnFormTags: true }, [activePo, modalState]);

  // Arrow up/down navigation
  useHotkeys('up', (e) => {
    if (activePo && modalState === 'none') {
      e.preventDefault();
      setActiveItemIdx((p) => Math.max(0, p - 1));
    } else if (isTableFocused) {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(0, p - 1));
    }
  }, { enableOnFormTags: false }, [activePo, isTableFocused, modalState]);

  useHotkeys('down', (e) => {
    if (activePo && modalState === 'none') {
      e.preventDefault();
      setActiveItemIdx((p) => Math.min(poItems.length - 1, p + 1));
    } else if (isTableFocused) {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(filteredPurchases.length - 1, p + 1));
    }
  }, { enableOnFormTags: false }, [activePo, isTableFocused, modalState, poItems, filteredPurchases]);

  // Escape handlers
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (modalState !== 'none') {
      setModalState('none');
    } else if (activePo) {
      setActivePo(null);
    } else if (isTableFocused) {
      setIsTableFocused(false);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else {
      navigate('/pembelian');
    }
  }, { enableOnFormTags: true }, [modalState, activePo, isTableFocused]);

  // Enter on summary modal: confirm
  useHotkeys('enter', (e) => {
    if (modalState === 'summary') {
      e.preventDefault();
      executeFinalize();
    }
  }, { enableOnFormTags: true }, [modalState, activePo, poItems, receiveStates]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const getItemStatus = (item: PurchaseItem) => {
    const state = receiveStates[item.id];
    if (!state) return 'ok';
    const qtyPo = Number(item.qty);
    if (state.qty_rusak > 0) return 'rusak';
    if (state.qty_terima < qtyPo) return 'kurang';
    if (state.qty_terima > qtyPo) return 'lebih';
    return 'ok';
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const summary = getSummary();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Receiving Gudang</h1>
          <p className="text-slate-400 text-sm">Verifikasi fisik barang yang datang · input qty datang &amp; qty rusak per item</p>
        </div>
      </div>

      {!activePo ? (
        /* ── PO LIST MODE ── */
        <div className="space-y-4">
          {/* Search + Clock */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari nomor PO atau nama supplier (F1)..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsTableFocused(false); }}
                onKeyDown={handleSearchKeyDown}
                className="input-field pl-9 w-full py-2.5 text-xs text-slate-800 border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg bg-white shadow-sm"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
              <div className="bg-surface-800 border border-surface-700 px-4 py-2.5 rounded-lg text-slate-350 font-mono text-xs flex items-center justify-center shadow-sm min-w-[200px]">
                {realtimeTime}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 skeleton" />)}
            </div>
          ) : filteredPurchases.length > 0 ? (
            <div className="card p-0 overflow-hidden border border-surface-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">Nomor PO</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Tanggal Order</th>
                      <th className="p-4 text-right">Subtotal</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((p, idx) => {
                      const isFocused = idx === selectedIdx && isTableFocused;
                      const rowBg = isFocused ? 'bg-blue-100' : 'hover:bg-slate-50';
                      const getTdClass = (pos: 'first' | 'middle' | 'last') => {
                        let base = 'p-4 text-xs transition-all duration-150 border-b ';
                        if (isFocused) {
                          base += 'bg-blue-100 text-primary-950 font-bold border-blue-300 ';
                          if (pos === 'first') base += 'border-l-4 border-primary-600 ';
                        } else {
                          base += 'text-slate-800 border-slate-200 ';
                        }
                        return base;
                      };
                      return (
                        <tr key={p.id}
                          onClick={() => { setSelectedIdx(idx); setIsTableFocused(true); }}
                          onDoubleClick={() => handleOpenChecklist(p)}
                          className={`cursor-pointer ${rowBg}`}
                        >
                          <td className={getTdClass('first')}>
                            <span className="px-2 py-0.5 rounded bg-blue-50/80 text-primary-700 border border-blue-100 font-mono font-bold text-xs inline-block">
                              {p.no_order}
                            </span>
                          </td>
                          <td className={getTdClass('middle') + ' font-semibold'}>{p.supplier?.nama || '-'}</td>
                          <td className={getTdClass('middle')}>{formatDate(p.order_date)}</td>
                          <td className={getTdClass('middle') + ' text-right font-black text-slate-900'}>{formatCurrency(Number(p.subtotal))}</td>
                          <td className={getTdClass('last') + ' text-center'}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenChecklist(p); }}
                              className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-550 transition-colors inline-flex items-center gap-1 shadow-sm"
                            >
                              <Play size={12} className="!text-white" />
                              <span className="!text-white">Proses Terima</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/20">
              <CheckSquare className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-400">Tidak ada PO yang Siap Diterima</h3>
              <p className="text-sm mt-1">Belum ada pesanan selesai yang siap untuk diterima di gudang.</p>
            </div>
          )}
        </div>
      ) : (
        /* ── CHECKLIST / INPUT MODE ── */
        <div className="bg-white rounded-xl shadow-xl border border-blue-200 overflow-hidden animate-scale-in text-slate-800 flex flex-col">

          {/* Header Bar */}
          <div className="bg-primary-600 text-white px-6 py-4 flex justify-between items-center border-b border-primary-700">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/10 rounded-lg">
                <PackageCheck size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Proses Penerimaan Barang · {activePo.no_order}</h2>
                <p className="text-xs text-primary-200 mt-0.5">Input qty datang &amp; qty rusak untuk setiap item PO</p>
              </div>
            </div>
            <button onClick={() => setActivePo(null)} className="text-white/80 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 bg-slate-50/50 space-y-4">
            {/* PO Info Card */}
            <div className="border border-blue-200 bg-gradient-to-r from-blue-50/30 via-white to-blue-50/30 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-800 shadow-sm">
              <div>
                <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider block">Nomor PO</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">{activePo.no_order}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider block">Supplier</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{activePo.supplier?.nama}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider block">Tanggal Order</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{formatDate(activePo.order_date)}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider block">Termin</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block uppercase">{activePo.terms || '-'}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                <Info size={12} className="text-slate-400" />
                Keterangan status:
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                <Check size={10} /> Sesuai
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-semibold">
                <Minus size={10} /> Kurang
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-semibold">
                <AlertTriangle size={10} /> Ada Rusak
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-semibold">
                <Plus size={10} /> Lebih
              </span>
            </div>

            {/* Retur note banner */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                <strong>Catatan:</strong> Barang rusak/cacat yang diinput di kolom <em>Qty Rusak</em> tidak akan masuk ke stok aktif gudang.
                Pencatatan &amp; pembuatan <strong>nota retur ke supplier</strong> akan tersedia setelah modul Retur Pembelian dibuat.
              </span>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-2.5 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Daftar Verifikasi Barang</h3>
                <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
                  Klik baris atau gunakan <kbd className="shortcut-badge text-[9px] font-mono">↑↓</kbd> untuk navigasi
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-primary-600 text-white font-bold text-xs uppercase">
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3 w-32">Kode SKU</th>
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3 text-center w-16">Satuan</th>
                      <th className="p-3 text-right w-24">Qty PO</th>
                      <th className="p-3 text-center w-36">Qty Datang</th>
                      <th className="p-3 text-center w-36">Qty Rusak</th>
                      <th className="p-3 text-right w-24">Qty Layak</th>
                      <th className="p-3 w-8 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 bg-white">
                    {poItems.map((item, idx) => {
                      const state = receiveStates[item.id] || { qty_terima: Number(item.qty), qty_rusak: 0, catatan: '' };
                      const isActive = idx === activeItemIdx;
                      const qtyPo = Number(item.qty);
                      const qtyLayak = Math.max(0, state.qty_terima - state.qty_rusak);
                      const status = getItemStatus(item);

                      const statusBadge = {
                        ok:     <span className="flex items-center justify-center gap-1 text-emerald-700"><Check size={11} /></span>,
                        kurang: <span className="flex items-center justify-center gap-1 text-amber-600"><Minus size={11} /></span>,
                        lebih:  <span className="flex items-center justify-center gap-1 text-blue-600"><Plus size={11} /></span>,
                        rusak:  <span className="flex items-center justify-center gap-1 text-red-600"><AlertTriangle size={11} /></span>,
                      }[status];

                      const rowBg = isActive ? 'bg-blue-50/60' : 'hover:bg-slate-50/60';
                      const borderLeft = isActive ? 'border-l-2 border-primary-500' : '';

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setActiveItemIdx(idx)}
                          className={`cursor-pointer transition-colors ${rowBg}`}
                        >
                          <td className={`p-3 text-center text-slate-500 font-mono ${borderLeft}`}>{idx + 1}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-blue-50 text-primary-700 border border-blue-100">
                              {item.product?.kode || '-'}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-900">{item.product?.nama || '-'}</td>
                          <td className="p-3 text-center text-slate-500">{item.product?.satuan}</td>
                          <td className="p-3 text-right font-bold text-slate-700">{qtyPo}</td>

                          {/* Qty Datang input */}
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); updateItemState(item.id, 'qty_terima', Math.max(0, state.qty_terima - 1)); }}
                                className="w-6 h-6 rounded border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                              ><Minus size={10} /></button>
                              <input
                                type="number"
                                min={0}
                                value={state.qty_terima}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateItemState(item.id, 'qty_terima', Math.max(0, Number(e.target.value)))}
                                className="w-16 text-center text-xs font-bold border border-blue-200 rounded-lg px-2 py-1 bg-blue-50 text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                              />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); updateItemState(item.id, 'qty_terima', state.qty_terima + 1); }}
                                className="w-6 h-6 rounded border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                              ><Plus size={10} /></button>
                            </div>
                          </td>

                          {/* Qty Rusak input */}
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); updateItemState(item.id, 'qty_rusak', Math.max(0, state.qty_rusak - 1)); }}
                                className="w-6 h-6 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors"
                              ><Minus size={10} /></button>
                              <input
                                type="number"
                                min={0}
                                value={state.qty_rusak}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateItemState(item.id, 'qty_rusak', Math.max(0, Number(e.target.value)))}
                                className={`w-16 text-center text-xs font-bold border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 ${
                                  state.qty_rusak > 0
                                    ? 'border-red-300 bg-red-50 text-red-800 focus:ring-red-400 focus:border-red-400'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 focus:ring-slate-300'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); updateItemState(item.id, 'qty_rusak', Math.min(state.qty_terima, state.qty_rusak + 1)); }}
                                className="w-6 h-6 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors"
                              ><Plus size={10} /></button>
                            </div>
                          </td>

                          {/* Qty Layak (calculated) */}
                          <td className="p-3 text-right">
                            <span className={`font-bold ${qtyLayak < qtyPo ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {qtyLayak}
                            </span>
                          </td>

                          {/* Status badge */}
                          <td className="p-3 text-center">{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Actions */}
              <div className="bg-slate-50/50 border-t border-blue-200 p-3.5 flex flex-wrap justify-between items-center gap-3">
                {/* Quick stats */}
                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <span>{poItems.length} item</span>
                  {summary.itemsWithIssue > 0 && (
                    <span className="flex items-center gap-1 text-amber-700 font-semibold">
                      <AlertTriangle size={11} />
                      {summary.itemsWithIssue} item bermasalah
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setActivePo(null)}
                    className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all shadow-sm bg-white"
                  >
                    Batal <kbd className="text-[10px] text-slate-400 font-bold ml-1 font-mono uppercase bg-slate-50 border border-slate-200 px-1 py-0.5 rounded">Esc</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeClick}
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-550 transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
                  >
                    <Check size={14} className="!text-white" />
                    <span className="!text-white">Selesaikan Penerimaan</span>
                    <kbd className="text-[10px] text-emerald-200 font-bold font-mono uppercase bg-emerald-700 border border-emerald-500 px-1 py-0.5 rounded">F10</kbd>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUMMARY CONFIRMATION MODAL ── */}
      {modalState === 'summary' && activePo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
          <div className="bg-white rounded-2xl max-w-md w-full mx-auto shadow-2xl animate-scale-in text-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-primary-600 text-white px-6 py-5 flex flex-col items-center justify-center gap-2">
              <Package size={28} className="text-white" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-center text-white">Rangkuman Penerimaan</h3>
              <p className="text-xs text-primary-200 font-mono">{activePo.no_order}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Qty PO</p>
                  <p className="text-xl font-extrabold text-slate-800 mt-0.5">{summary.totalPo}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Qty Layak → Stok</p>
                  <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{summary.totalLayak}</p>
                </div>
                {summary.totalKurang > 0 && (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Kurang Kirim</p>
                    <p className="text-xl font-extrabold text-amber-700 mt-0.5">{summary.totalKurang}</p>
                  </div>
                )}
                {summary.totalRusak > 0 && (
                  <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                    <p className="text-[10px] text-red-600 font-semibold uppercase tracking-wider">Qty Rusak</p>
                    <p className="text-xl font-extrabold text-red-700 mt-0.5">{summary.totalRusak}</p>
                  </div>
                )}
              </div>

              {/* Retur note */}
              {summary.totalRusak > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                  <span><strong>{summary.totalRusak}</strong> item rusak tidak akan masuk stok. <strong>Modul Retur Pembelian belum tersedia</strong> — pencatatan retur ke supplier dapat dilakukan secara manual sementara ini.</span>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                Konfirmasi akan menambahkan <strong className="text-emerald-700">{summary.totalLayak} unit</strong> ke stok gudang dan menutup PO <strong>{activePo.no_order}</strong>.
              </p>

              <div className="flex justify-center gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalState('none')}
                  className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Batal (Esc)
                </button>
                <button
                  type="button"
                  onClick={executeFinalize}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 !text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-md disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Memproses...' : (
                    <><Check size={13} className="!text-white" /> Ya, Selesaikan (Enter)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
          <div className={`px-4 py-3 rounded-lg shadow-lg text-white font-bold text-xs flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}>
            <span className="!text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
