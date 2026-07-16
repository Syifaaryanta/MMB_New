import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { todayString, formatCurrency, formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import { Search, UserPlus, ShieldAlert, AlertCircle, X, ChevronRight, Calendar, User, Truck, CreditCard, AlertTriangle } from 'lucide-react';

interface Customer {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  no_telp: string | null;
  limit_kredit: number;
  saldo_piutang: number;
  jatuh_tempo_bulan: number;
}

interface CustomerStats {
  total_transaksi_bulan_ini: number;
  nominal_transaksi_bulan_ini: number;
  piutang: number;
  terakhir_order: string | null;
  jatuh_tempo: number;
  alamat: string | null;
  no_telp: string | null;
  kode: string;
  nama: string;
  limit_kredit: number;
}

export const BuatOrderSO: React.FC = () => {
  const navigate = useNavigate();

  const [soMetaSaved] = useState(() => {
    const saved = sessionStorage.getItem('so_step1');
    return saved ? JSON.parse(saved) : null;
  });

  const [noOrder, setNoOrder] = useState(soMetaSaved?.noOrder || '');
  const [orderDate, setOrderDate] = useState(soMetaSaved?.orderDate || todayString());
  const [customerQuery, setCustomerQuery] = useState(soMetaSaved?.customer?.nama || '');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(soMetaSaved?.customer || null);
  const [diantar, setDiantar] = useState<boolean>(soMetaSaved ? soMetaSaved.diantar : true);
  const [limitBulan, setLimitBulan] = useState<number>(soMetaSaved ? soMetaSaved.limitBulan : 0);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Autocomplete & Popup
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [focusedCustIdx, setFocusedCustIdx] = useState(0);

  // Quick Add Customer Modal (F2)
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustNama, setNewCustNama] = useState('');
  const [newCustAlamat, setNewCustAlamat] = useState('');
  const [newCustTelp, setNewCustTelp] = useState('');
  const [newCustLimit, setNewCustLimit] = useState(10000000);

  // Credit limit override states
  const [creditLimitExceeded, setCreditLimitExceeded] = useState(false);
  const [showLimitConfirmation, setShowLimitConfirmation] = useState(false);

  // Focus tracking for Enter navigation
  const [activeStep, setActiveStep] = useState<'date' | 'customer' | 'delivery' | 'terms'>('date');

  // Refs
  const customerInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const deliverySelectRef = useRef<HTMLDivElement>(null);
  const termsSelectRef = useRef<HTMLDivElement>(null);
  const addCustNameRef = useRef<HTMLInputElement>(null);
  const customerPopupRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (showCustomerPopup) {
      const target = itemRefs.current[focusedCustIdx];
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedCustIdx, showCustomerPopup]);

  // Focus modal popups when shown
  useEffect(() => {
    if (showCustomerPopup) {
      customerPopupRef.current?.focus();
    }
  }, [showCustomerPopup]);

  useEffect(() => {
    if (!noOrder) {
      api.get('/sales/generate-no').then((res) => {
        setNoOrder(res.data.no_order);
      });
    }
    dateInputRef.current?.focus();
  }, []);

  // Fetch stats if preselected on refresh
  useEffect(() => {
    if (selectedCustomer && !customerStats) {
      api.get(`/customers/${selectedCustomer.id}/summary-stats`).then((res) => {
        setCustomerStats(res.data);
      }).catch(err => {
        console.error('Gagal mengambil statistik customer', err);
      });
    }
  }, [selectedCustomer, customerStats]);

  // Sync to sessionStorage on change
  useEffect(() => {
    const soMeta = {
      noOrder,
      orderDate,
      customer: selectedCustomer,
      diantar,
      limitBulan,
    };
    sessionStorage.setItem('so_step1', JSON.stringify(soMeta));
  }, [noOrder, orderDate, selectedCustomer, diantar, limitBulan]);

  // Fetch customers
  useEffect(() => {
    if (!customerQuery) {
      setCustomers([]);
      return;
    }
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
  }, [customerQuery]);

  // Check Credit Limit
  useEffect(() => {
    if (selectedCustomer) {
      const debt = Number(selectedCustomer.saldo_piutang);
      const limit = Number(selectedCustomer.limit_kredit);

      if (debt >= limit) {
        setCreditLimitExceeded(true);
      } else {
        setCreditLimitExceeded(false);
      }
    }
  }, [selectedCustomer]);

  const handleDateEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setActiveStep('customer');
      customerInputRef.current?.focus();
    }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCustomer && customerQuery.trim().toLowerCase() === selectedCustomer.nama.toLowerCase()) {
        setActiveStep('delivery');
        setTimeout(() => deliverySelectRef.current?.focus(), 50);
      } else {
        setShowCustomerPopup(true);
        setFocusedCustIdx(0);
      }
    }
  };

  const selectCustomer = async (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.nama);
    setShowCustomerPopup(false);
    setFormError(null);

    const calculatedLimit = typeof c.jatuh_tempo_bulan === 'number' ? c.jatuh_tempo_bulan : 0;
    setLimitBulan(Math.max(0, Math.min(calculatedLimit, 3)));

    try {
      const res = await api.get(`/customers/${c.id}/summary-stats`);
      setCustomerStats(res.data);
    } catch (err) {
      console.error('Gagal mengambil statistik customer', err);
    }

    customerInputRef.current?.focus();
  };

  const handleCustomerPopupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowCustomerPopup(false);
      customerInputRef.current?.focus();
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

  const handleDeliveryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setDiantar((prev: boolean) => !prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setActiveStep('terms');
      setTimeout(() => termsSelectRef.current?.focus(), 50);
    }
  };

  const handleTermsKeyDown = (e: React.KeyboardEvent) => {
    const list = [0, 1, 2, 3];
    const currIdx = list.indexOf(limitBulan);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setLimitBulan(list[(currIdx + 1) % list.length]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setLimitBulan(list[(currIdx - 1 + list.length) % list.length]);
    } else if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      handleProceed();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      navigate('/penjualan');
    }
  };

  const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !customerQuery && activeStep === 'customer') {
      setActiveStep('date');
      dateInputRef.current?.focus();
    } else if (e.key === 'Backspace' && activeStep === 'delivery') {
      setActiveStep('customer');
      customerInputRef.current?.focus();
    } else if (e.key === 'Backspace' && activeStep === 'terms') {
      setActiveStep('delivery');
      setTimeout(() => deliverySelectRef.current?.focus(), 50);
    }
  };

  // Quick Add Customer Submission
  const handleQuickAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustNama) return;

    try {
      const codeRes = await api.get('/customers?limit=1');
      const nextCode = `CUST-${String((codeRes.data.total || 0) + 1).padStart(3, '0')}`;

      const payload = {
        kode: nextCode,
        nama: newCustNama,
        alamat: newCustAlamat,
        no_telp: newCustTelp,
        limit_kredit: newCustLimit,
        aktif: true,
      };

      const res = await api.post('/customers', payload);
      selectCustomer(res.data);
      setShowAddCustomerModal(false);

      // reset fields
      setNewCustNama('');
      setNewCustAlamat('');
      setNewCustTelp('');
      setNewCustLimit(10000000);
    } catch (err) {
      alert('Gagal menambah pelanggan baru.');
    }
  };

  const confirmAndProceed = () => {
    setShowLimitConfirmation(false);
    const soMeta = {
      noOrder,
      orderDate,
      customer: selectedCustomer,
      diantar,
      limitBulan,
    };
    sessionStorage.setItem('so_step1', JSON.stringify(soMeta));
    navigate('/penjualan/input');
  };

  const handleProceed = () => {
    if (!selectedCustomer || !customerQuery.trim() || selectedCustomer.nama.toLowerCase() !== customerQuery.trim().toLowerCase()) {
      setFormError('Nama Pelanggan (Customer) tidak boleh kosong dan harus dipilih dari daftar autocomplete.');
      return;
    }
    setFormError(null);

    // jika customer sudah diatas limit dan terms adalah Kredit (limitBulan > 0)
    // muncul popup konfirmasi
    if (limitBulan > 0 && creditLimitExceeded) {
      setShowLimitConfirmation(true);
      return;
    }

    const soMeta = {
      noOrder,
      orderDate,
      customer: selectedCustomer,
      diantar,
      limitBulan,
    };
    sessionStorage.setItem('so_step1', JSON.stringify(soMeta));
    navigate('/penjualan/input');
  };

  // Keyboard Shortcuts
  // F2: Open Quick Customer Modal
  useHotkeys('f2', (e) => {
    e.preventDefault();
    setShowAddCustomerModal(true);
    setTimeout(() => addCustNameRef.current?.focus(), 150);
  }, { enableOnFormTags: false });

  // Escape to close active modal or go back
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showAddCustomerModal) {
      setShowAddCustomerModal(false);
    } else if (showCustomerPopup) {
      setShowCustomerPopup(false);
      customerInputRef.current?.focus();
    } else if (showLimitConfirmation) {
      setShowLimitConfirmation(false);
    } else {
      navigate('/penjualan');
    }
  }, { enableOnFormTags: true });

  // Y key to proceed when focused is not on text input or limit confirmation is active
  useHotkeys('y, Y', (e) => {
    if (showLimitConfirmation) {
      e.preventDefault();
      confirmAndProceed();
    } else {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (!isInputFocused && !showAddCustomerModal && !showCustomerPopup) {
        e.preventDefault();
        handleProceed();
      }
    }
  }, { enableOnFormTags: true });

  // Context-aware shortcuts for delivery (1-2) and terms (1-4)
  useHotkeys('1', (e) => {
    if (showAddCustomerModal || showLimitConfirmation) return;
    if (activeStep === 'delivery') {
      e.preventDefault();
      setDiantar(true); // Diantar Sopir
    } else if (activeStep === 'terms') {
      e.preventDefault();
      setLimitBulan(0); // Tunai
    }
  }, { enableOnFormTags: true });

  useHotkeys('2', (e) => {
    if (showAddCustomerModal || showLimitConfirmation) return;
    if (activeStep === 'delivery') {
      e.preventDefault();
      setDiantar(false); // Diambil Sendiri
    } else if (activeStep === 'terms') {
      e.preventDefault();
      setLimitBulan(1); // 1 Bulan jatuh tempo
    }
  }, { enableOnFormTags: true });

  useHotkeys('3', (e) => {
    if (showAddCustomerModal || showLimitConfirmation) return;
    if (activeStep === 'terms') {
      e.preventDefault();
      setLimitBulan(2); // 2 Bulan jatuh tempo
    }
  }, { enableOnFormTags: true });

  useHotkeys('4', (e) => {
    if (showAddCustomerModal || showLimitConfirmation) return;
    if (activeStep === 'terms') {
      e.preventDefault();
      setLimitBulan(3); // 3 Bulan jatuh tempo
    }
  }, { enableOnFormTags: true });

  return (
    <div className="w-full space-y-6" onKeyDown={handleGlobalKeyDown}>
      <div>
        <h1 className="text-2xl font-extrabold text-white">Buat Sales Order (Step 1)</h1>
        <p className="text-slate-400">Pilih pelanggan, tentukan limit kredit, termin kredit, dan pengantaran</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Left Column: Form Card (Takes 1 col in 50:50 split) */}
        <div className="lg:col-span-1 space-y-4">
          {formError && (
            <div className="p-4 rounded-lg bg-danger-600/15 border border-danger-500/30 text-danger-400 text-sm flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-danger-400" />
              <div className="flex-1">
                <p className="font-bold">Kesalahan Validasi</p>
                <p className="text-xs opacity-90 mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {creditLimitExceeded && (
            <div className="p-4 rounded-lg bg-danger-600/15 border border-danger-500/30 text-danger-400 text-sm flex items-start gap-3 animate-fade-in">
              <ShieldAlert className="w-6 h-6 shrink-0 text-danger-400" />
              <div className="flex-1">
                <p className="font-bold">Limit Kredit Terlampaui!</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Pelanggan memiliki outstanding piutang {formatCurrency(Number(selectedCustomer?.saldo_piutang))} melebihi limit kredit {formatCurrency(Number(selectedCustomer?.limit_kredit))}.
                </p>
              </div>
            </div>
          )}

          <div className="card card-hovered p-6 space-y-5">
            {/* SO Number & Sales Date side-by-side */}
            <div className="grid grid-cols-2 gap-4">
              {/* SO Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Nomor SO (Otomatis)
                </label>
                <input
                  type="text"
                  readOnly
                  value={noOrder || 'Generating...'}
                  className="input-field bg-surface-900 border-surface-700 text-slate-500 font-mono"
                />
              </div>

              {/* Order Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Tanggal Penjualan <span className="shortcut-badge text-[9px] ml-1">Enter</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Calendar size={16} />
                  </span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    onKeyDown={handleDateEnter}
                    className={`input-field pl-9 ${activeStep === 'date' ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Customer Select */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Pelanggan (Customer)
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <User size={16} />
                </span>
                <input
                  ref={customerInputRef}
                  type="text"
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                  }}
                  onFocus={() => {
                    setActiveStep('customer');
                  }}
                  onKeyDown={handleCustomerKeyDown}
                  placeholder="Cari nama pelanggan..."
                  className={`input-field pl-9 ${activeStep === 'customer' ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}`}
                />
              </div>
            </div>

            {/* Delivery Option */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Metode Pengiriman
              </label>
              <div
                ref={deliverySelectRef}
                tabIndex={0}
                onKeyDown={handleDeliveryKeyDown}
                onFocus={() => setActiveStep('delivery')}
                className={`flex gap-3 outline-none rounded-lg p-1.5 transition-all ${activeStep === 'delivery' ? 'ring-2 ring-primary-500/30 border border-primary-500/40' : 'border border-transparent'
                  }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setDiantar(true);
                    setActiveStep('delivery');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-md border flex items-center justify-center gap-2 transition-all ${diantar
                    ? 'bg-primary-600/10 border-primary-500 text-primary-400 shadow'
                    : 'bg-surface-900 border-surface-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <Truck size={14} />
                  <span>Diantar</span>
                  <kbd className="shortcut-badge text-[10px]">1</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiantar(false);
                    setActiveStep('delivery');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-md border flex items-center justify-center gap-2 transition-all ${!diantar
                    ? 'bg-primary-600/10 border-primary-500 text-primary-400 shadow'
                    : 'bg-surface-900 border-surface-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <User size={14} />
                  <span>Diambil</span>
                  <kbd className="shortcut-badge text-[10px]">2</kbd>
                </button>
              </div>
            </div>

            {/* Credit limit / Terms */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Termin Jatuh Tempo Piutang
              </label>
              <div
                ref={termsSelectRef}
                tabIndex={0}
                onKeyDown={handleTermsKeyDown}
                onFocus={() => setActiveStep('terms')}
                className={`flex gap-2 p-1.5 bg-surface-900 border border-blue-500 rounded-lg outline-none transition-all ${activeStep === 'terms' ? 'ring-2 ring-primary-500/20' : ''
                  }`}
              >
                {[
                  { val: 0, label: 'Tunai', key: '1' },
                  { val: 1, label: '1 Bulan', key: '2' },
                  { val: 2, label: '2 Bulan', key: '3' },
                  { val: 3, label: '3 Bulan', key: '4' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      setLimitBulan(opt.val);
                      setActiveStep('terms');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${limitBulan === opt.val
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {opt.label}
                    <kbd className={`shortcut-badge text-[10px] ${limitBulan === opt.val ? 'bg-primary-500/40 border-primary-400/40 text-primary-200' : ''}`}>{opt.key}</kbd>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Row */}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => navigate('/penjualan')} className="btn-secondary">
                Batal
              </button>
              <button onClick={handleProceed} className="btn-primary">
                <span>Lanjut Input Barang</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Detail Info (Takes 1 col in 50:50 split) */}
        <div className="lg:col-span-1">
          <div className="card card-hovered p-0 flex flex-col justify-between h-full overflow-hidden">
            <div>
              <div className="bg-blue-600 px-6 py-4 flex items-center gap-3 text-white border-b border-blue-700/80 rounded-t-xl">
                <User className="text-white" size={18} />
                <h3 className="text-base font-extrabold text-white">Informasi Pelanggan</h3>
              </div>

              <div className="p-6">
                {customerStats ? (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nama Pelanggan</p>
                      <h4 className="text-base font-extrabold text-white mt-0.5">{customerStats.nama}</h4>
                      <span className="inline-block mt-1 text-[10px] bg-blue-500/10 text-blue-400 font-mono px-1.5 py-0.5 rounded border border-blue-500/20">
                        {customerStats.kode}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t border-surface-700/40 pt-3">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">No. Telepon</p>
                        <p className="text-xs text-slate-300 font-semibold mt-0.5">{customerStats.no_telp || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Default Termin</p>
                        <p className="text-xs text-slate-300 font-semibold mt-0.5">
                          {customerStats.jatuh_tempo ? `${customerStats.jatuh_tempo} Bulan` : 'Tunai'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Limit Kredit</p>
                        <p className="text-xs text-slate-300 font-semibold mt-0.5">
                          {formatCurrency(customerStats.limit_kredit)}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-surface-700/40 pt-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Alamat</p>
                      <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{customerStats.alamat || '-'}</p>
                    </div>

                    <div className="border-t border-surface-700/40 pt-3 space-y-2.5">
                      <h5 className="text-xs font-bold text-slate-400">Ringkasan Aktivitas</h5>

                      {/* Transaksi Bulan Ini */}
                      <div className="p-3 bg-surface-900 border border-blue-500/40 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">Transaksi Bulan Ini</p>
                          <p className="text-xs font-bold text-white mt-0.5">{customerStats.total_transaksi_bulan_ini} Invoice</p>
                        </div>
                        <span className="text-xs font-bold text-primary-400">{formatCurrency(customerStats.nominal_transaksi_bulan_ini)}</span>
                      </div>

                      {/* Piutang Dagang (Utang customer ke kita) */}
                      <div className="p-3 bg-surface-900 border border-blue-500/40 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">Outstanding Piutang</p>
                          <p className="text-xs text-slate-400 mt-0.5">Sisa tagihan belum dibayar</p>
                        </div>
                        <span className="text-xs font-bold text-danger-400">{formatCurrency(customerStats.piutang)}</span>
                      </div>



                      {/* Terakhir Order */}
                      <div className="p-3 bg-surface-900 border border-blue-500/40 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">Terakhir Order</p>
                        </div>
                        <span className="text-xs font-bold text-slate-300">
                          {customerStats.terakhir_order
                            ? new Date(customerStats.terakhir_order).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                    <User size={32} className="text-slate-600 animate-pulse" />
                    <p className="text-xs text-slate-500 max-w-[200px]">
                      Silakan cari dan pilih pelanggan untuk melihat detail data customer.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 pt-0">
              <div className="text-[9px] text-slate-500 border-t border-surface-700/40 pt-3">
                * Data diambil real-time dari database customer.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Customer Modal (F2) */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 mb-4">
              <h3 className="text-lg font-bold text-white">Tambah Pelanggan Cepat</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nama Lengkap</label>
                <input
                  ref={addCustNameRef}
                  type="text"
                  required
                  value={newCustNama}
                  onChange={(e) => setNewCustNama(e.target.value)}
                  placeholder="Contoh: Toko Berkah Baru"
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Alamat Lengkap</label>
                <input
                  type="text"
                  value={newCustAlamat}
                  onChange={(e) => setNewCustAlamat(e.target.value)}
                  placeholder="Jl. Raya Timur No. 12"
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">No Telepon</label>
                <input
                  type="text"
                  value={newCustTelp}
                  onChange={(e) => setNewCustTelp(e.target.value)}
                  placeholder="0812..."
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Limit Kredit Default (Rp)</label>
                <input
                  type="text"
                  value={formatRupiahInput(newCustLimit)}
                  onChange={(e) => setNewCustLimit(parseRupiahInput(e.target.value))}
                  className="input-field py-2 text-xs text-emerald-400 font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-700">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Customer Selection Popup Modal (Sama persis dengan modul inventory/InformasiHarga) */}
      {showCustomerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={customerPopupRef}
            tabIndex={0}
            onKeyDown={handleCustomerPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>Pilih Pelanggan</span>
              </h3>
              <button onClick={() => setShowCustomerPopup(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {customers.length > 0 ? (
                customers.map((cust, idx) => (
                  <button
                    key={cust.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onClick={() => selectCustomer(cust)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${idx === focusedCustIdx
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-2 ring-emerald-500/20 scale-[1.01]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-750 bg-white'
                      }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === focusedCustIdx ? 'text-emerald-900' : 'text-slate-900'}`}>{cust.nama}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{cust.kode}</p>
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
      {showLimitConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="bg-surface-800 border border-danger-500/40 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-surface-700 pb-3 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5 text-danger-400">
                <AlertTriangle size={18} />
                <span>Limit Kredit Terlampaui</span>
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Saldo piutang pelanggan <strong>{selectedCustomer?.nama}</strong> ({formatCurrency(Number(selectedCustomer?.saldo_piutang))}) sudah melebihi limit kredit ({formatCurrency(Number(selectedCustomer?.limit_kredit))}).
              Apakah Anda yakin ingin tetap melanjutkan transaksi ini?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-700">
              <button
                type="button"
                onClick={() => setShowLimitConfirmation(false)}
                className="btn-secondary text-xs"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={confirmAndProceed}
                className="btn-primary bg-danger-600 hover:bg-danger-500 text-white font-bold text-xs"
              >
                Lanjutkan (Y)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
