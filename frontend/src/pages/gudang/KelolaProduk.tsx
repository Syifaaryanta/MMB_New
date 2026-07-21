import { ModalPortal } from '@/components/ui/ModalPortal';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import api from '@/lib/api';
import { formatCurrency, formatRupiahInput, parseRupiahInput } from '@/lib/utils';
import {
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Upload,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Archive,
  XCircle
} from 'lucide-react';

interface Supplier {
  id: string;
  kode: string;
  nama: string;
}

interface SupplierPrice {
  id: string;
  supplier: Supplier;
  supplier_id?: string;
  stok: number;
  harga_beli: number;
  aktif?: boolean;
}

interface Product {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string | null;
  stok: number;
  satuan: string;
  foto_urls: any; // string[] stored in JSON
  product_prices: SupplierPrice[];
}

export const KelolaProduk: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editTypeModalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);
  const activePopupItemRef = useRef<HTMLButtonElement | null>(null);
  const supplierPopupRef = useRef<HTMLDivElement>(null);
  const supplierPopupInputRef = useRef<HTMLInputElement>(null);
  const activeSupplierPopupItemRef = useRef<HTMLButtonElement | null>(null);

  // Supplier selection popup modal states
  const [showSupplierPopup, setShowSupplierPopup] = useState(false);
  const [supplierPopupSearch, setSupplierPopupSearch] = useState('');
  const [supplierPopupFocusedIdx, setSupplierPopupFocusedIdx] = useState(0);
  const [activeSupplierRowIdx, setActiveSupplierRowIdx] = useState<number | null>(null);

  // Modal selection state
  const [editModeSelectIdx, setEditModeSelectIdx] = useState(0);

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(() => {
    return Number(sessionStorage.getItem('mmb_kelola_produk_page')) || 1;
  });
  const [search, setSearch] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_search') || '';
  });
  const [isLoading, setIsLoading] = useState(true);

  // Search Popup States
  const [searchQuery, setSearchQuery] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_searchQuery') || '';
  });
  const [showSearchPopup, setShowSearchPopup] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_showSearchPopup') === 'true';
  });
  const [popupProducts, setPopupProducts] = useState<Product[]>([]);
  const [popupFocusedIndex, setPopupFocusedIndex] = useState(() => {
    return Number(sessionStorage.getItem('mmb_kelola_produk_popupFocusedIndex')) || 0;
  });
  const searchPopupRef = useRef<HTMLDivElement>(null);

  // Table Navigation
  const [selectedIdx, setSelectedIdx] = useState(() => {
    return Number(sessionStorage.getItem('mmb_kelola_produk_selectedIdx')) || 0;
  });

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditTypeModal, setShowEditTypeModal] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_showEditTypeModal') === 'true';
  });
  const [showFormModal, setShowFormModal] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_showFormModal') === 'true';
  });
  const [showGalleryModal, setShowGalleryModal] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_showGalleryModal') === 'true';
  });

  // Edit configurations
  const [editMode, setEditMode] = useState<'create' | 'full' | 'info' | 'prices'>(() => {
    return (sessionStorage.getItem('mmb_kelola_produk_editMode') as any) || 'create';
  });
  const [currentProduct, setCurrentProduct] = useState<Product | null>(() => {
    const saved = sessionStorage.getItem('mmb_kelola_produk_currentProduct');
    return saved ? JSON.parse(saved) : null;
  });

  // Form Fields
  const [kode, setKode] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_kode') || '';
  });
  const [nama, setNama] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_nama') || '';
  });
  const [deskripsi, setDeskripsi] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_deskripsi') || '';
  });
  const [satuan, setSatuan] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_satuan') || 'pcs';
  });
  const [fotoUrls, setFotoUrls] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('mmb_kelola_produk_fotoUrls');
    return saved ? JSON.parse(saved) : [];
  });
  const [priceRows, setPriceRows] = useState<Array<{ supplier_id: string; stok: number | ''; harga_beli: number | ''; aktif: boolean }>>(() => {
    const saved = sessionStorage.getItem('mmb_kelola_produk_priceRows');
    return saved ? JSON.parse(saved) : [];
  });

  // Form Validation and Refs
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [tanggalDiubah, setTanggalDiubah] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_tanggalDiubah') || '';
  });
  const [diubahOleh, setDiubahOleh] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_diubahOleh') || '';
  });
  const [alasanDiubah, setAlasanDiubah] = useState(() => {
    return sessionStorage.getItem('mmb_kelola_produk_alasanDiubah') || '';
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Archive confirm modal
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; nama: string } | null>(null);

  // Toast notifications
  interface Toast { id: number; type: 'success' | 'error'; message: string; }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = (type: Toast['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Fetch Suppliers for form mapping
  useEffect(() => {
    api.get('/suppliers?limit=100').then((res) => {
      setSuppliers(res.data.data || []);
    });
  }, []);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Auto scroll table row when selectedIdx changes
  useEffect(() => {
    if (activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIdx]);

  // Auto scroll popup item when popupFocusedIndex changes
  useEffect(() => {
    if (activePopupItemRef.current) {
      activePopupItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [popupFocusedIndex]);

  // Focus supplier search input inside the popup modal when it opens
  useEffect(() => {
    if (showSupplierPopup) {
      setTimeout(() => {
        supplierPopupInputRef.current?.focus();
      }, 50);
    }
  }, [showSupplierPopup]);

  // Auto scroll selected supplier popup item into view when focused index changes
  useEffect(() => {
    if (activeSupplierPopupItemRef.current) {
      activeSupplierPopupItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [supplierPopupFocusedIdx]);

  const selectSupplierForActiveRow = (sup: Supplier) => {
    if (activeSupplierRowIdx !== null) {
      const copy = [...priceRows];
      copy[activeSupplierRowIdx].supplier_id = sup.id;
      setPriceRows(copy);
      setShowSupplierPopup(false);

      // Auto-focus next field (stok input) in the active row
      setTimeout(() => {
        const rowEl = document.querySelectorAll('.supplier-row')[activeSupplierRowIdx];
        const stokInput = rowEl?.querySelector('input[type="number"]') as HTMLElement | null;
        stokInput?.focus();
      }, 50);
    }
  };

  const handleSupplierPopupKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    const filtered = suppliers.filter(s =>
      s.nama.toLowerCase().includes(supplierPopupSearch.toLowerCase()) ||
      s.kode.toLowerCase().includes(supplierPopupSearch.toLowerCase())
    );

    if (e.key === 'ArrowDown') {
      if (filtered.length === 0) return;
      e.preventDefault();
      setSupplierPopupFocusedIdx((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      if (filtered.length === 0) return;
      e.preventDefault();
      setSupplierPopupFocusedIdx((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      if (filtered.length === 0) return;
      e.preventDefault();
      selectSupplierForActiveRow(filtered[supplierPopupFocusedIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSupplierPopup(false);
      // Focus back to the row input trigger
      setTimeout(() => {
        if (activeSupplierRowIdx !== null) {
          const rowEl = document.querySelectorAll('.supplier-row')[activeSupplierRowIdx];
          const triggerInput = rowEl?.querySelector('input[type="text"]') as HTMLElement | null;
          triggerInput?.focus();
        }
      }, 50);
    }
  };

  // Sync state to sessionStorage for persistence on refresh
  useEffect(() => {
    sessionStorage.setItem('mmb_kelola_produk_page', String(page));
    sessionStorage.setItem('mmb_kelola_produk_search', search);
    sessionStorage.setItem('mmb_kelola_produk_searchQuery', searchQuery);
    sessionStorage.setItem('mmb_kelola_produk_showSearchPopup', String(showSearchPopup));
    sessionStorage.setItem('mmb_kelola_produk_popupFocusedIndex', String(popupFocusedIndex));
    sessionStorage.setItem('mmb_kelola_produk_selectedIdx', String(selectedIdx));
    sessionStorage.setItem('mmb_kelola_produk_showEditTypeModal', String(showEditTypeModal));
    sessionStorage.setItem('mmb_kelola_produk_showFormModal', String(showFormModal));
    sessionStorage.setItem('mmb_kelola_produk_showGalleryModal', String(showGalleryModal));
    sessionStorage.setItem('mmb_kelola_produk_editMode', editMode);
    sessionStorage.setItem('mmb_kelola_produk_currentProduct', currentProduct ? JSON.stringify(currentProduct) : '');
    sessionStorage.setItem('mmb_kelola_produk_kode', kode);
    sessionStorage.setItem('mmb_kelola_produk_nama', nama);
    sessionStorage.setItem('mmb_kelola_produk_deskripsi', deskripsi);
    sessionStorage.setItem('mmb_kelola_produk_satuan', satuan);
    sessionStorage.setItem('mmb_kelola_produk_fotoUrls', JSON.stringify(fotoUrls));
    sessionStorage.setItem('mmb_kelola_produk_priceRows', JSON.stringify(priceRows));
    sessionStorage.setItem('mmb_kelola_produk_tanggalDiubah', tanggalDiubah);
    sessionStorage.setItem('mmb_kelola_produk_diubahOleh', diubahOleh);
    sessionStorage.setItem('mmb_kelola_produk_alasanDiubah', alasanDiubah);
  }, [
    page, search, searchQuery, showSearchPopup, popupFocusedIndex, selectedIdx,
    showEditTypeModal, showFormModal, showGalleryModal, editMode, currentProduct,
    kode, nama, deskripsi, satuan, fotoUrls, priceRows, tanggalDiubah, diubahOleh, alasanDiubah
  ]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/products?q=${search}&page=${page}&limit=10`);
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
    fetchProducts();
  }, [page, search]);

  // Fetch product list for search popup (debounced) when searchQuery changes
  useEffect(() => {
    if (!searchQuery) {
      setPopupProducts([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/products?q=${searchQuery}`);
        setPopupProducts(res.data.data || []);
        setPopupFocusedIndex(0);
      } catch (err) {
        console.error(err);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Focus search popup when opened
  useEffect(() => {
    if (showSearchPopup) {
      setTimeout(() => {
        searchPopupRef.current?.focus();
      }, 100);
    }
  }, [showSearchPopup]);

  const selectProduct = (prod: Product) => {
    setSearch(prod.kode);
    setSearchQuery(prod.nama);
    setShowSearchPopup(false);
    setSelectedIdx(0);
  };

  const handleSearchPopupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShowSearchPopup(false);
      searchInputRef.current?.focus();
      return;
    }
    if (popupProducts.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setPopupFocusedIndex((prev) => (prev + 1) % popupProducts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setPopupFocusedIndex((prev) => (prev - 1 + popupProducts.length) % popupProducts.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      selectProduct(popupProducts[popupFocusedIndex]);
    }
  };

  // Image Upload & Compression (<150KB)
  const compressAndAddImage = async (file: File) => {
    if (fotoUrls.length >= 3) {
      alert('Maksimal 3 foto produk');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down to maintain small size limit
        if (width > 600) {
          height = Math.round((height * 600) / width);
          width = 600;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Quality compression to stay under 150KB
        const base64 = canvas.toDataURL('image/jpeg', 0.6);
        setFotoUrls((prev) => [...prev, base64]);
      };
    };
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const maxLimit = 2 * 1024 * 1024; // 2MB
      let hasTooLarge = false;
      Array.from(e.target.files).forEach((file) => {
        if (file.size > maxLimit) {
          hasTooLarge = true;
        } else {
          compressAndAddImage(file);
        }
      });
      if (hasTooLarge) {
        addToast('error', 'Ukuran foto produk tidak boleh lebih dari 2MB.');
      }
    }
  };

  // Description text area height adjustment
  const adjustDescHeight = () => {
    if (descRef.current) {
      descRef.current.style.height = 'auto';
      descRef.current.style.height = descRef.current.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    if (showFormModal && (editMode === 'create' || editMode === 'full' || editMode === 'info')) {
      setTimeout(adjustDescHeight, 150);
    }
  }, [showFormModal, editMode, deskripsi]);

  // CRUD Actions
  const handleOpenCreate = () => {
    setEditMode('create');
    setKode('');
    setNama('');
    setDeskripsi('');
    setSatuan('pcs');
    setFotoUrls([]);
    setPriceRows([]);
    setTanggalDiubah(new Date().toISOString().split('T')[0]);
    setDiubahOleh('');
    setAlasanDiubah('');
    setFormError(null);
    setShowFormModal(true);
  };

  const handleOpenEditSelect = () => {
    const activeProduct = products[selectedIdx];
    if (!activeProduct) return;
    setCurrentProduct(activeProduct);
    setShowEditTypeModal(true);
  };

  useEffect(() => {
    if (showEditTypeModal) {
      setEditModeSelectIdx(0);
      setTimeout(() => {
        editTypeModalRef.current?.focus();
      }, 50);
    }
  }, [showEditTypeModal]);

  const handleStartEdit = (mode: 'full' | 'info' | 'prices') => {
    if (!currentProduct) return;
    setEditMode(mode);
    setKode(currentProduct.kode);
    setNama(currentProduct.nama);
    setDeskripsi(currentProduct.deskripsi || '');
    setSatuan(currentProduct.satuan);
    setTanggalDiubah(new Date().toISOString().split('T')[0]);
    setDiubahOleh('');
    setAlasanDiubah('');

    // Normalize image urls JSON
    let imgs: string[] = [];
    try {
      imgs = typeof currentProduct.foto_urls === 'string'
        ? JSON.parse(currentProduct.foto_urls)
        : Array.isArray(currentProduct.foto_urls) ? currentProduct.foto_urls : [];
    } catch {
      imgs = [];
    }
    setFotoUrls(imgs);

    // Map supplier prices
    const rows: Array<{ supplier_id: string; stok: number | ''; harga_beli: number | ''; aktif: boolean }> = currentProduct.product_prices.map((p) => ({
      supplier_id: p.supplier.id,
      stok: (Number(p.stok) === 0 ? '' : Number(p.stok)) as number | '',
      harga_beli: (Number(p.harga_beli) === 0 ? '' : Number(p.harga_beli)) as number | '',
      aktif: p.aktif ?? true,
    }));
    setPriceRows(rows);

    setShowEditTypeModal(false);
    setFormError(null);
    setShowFormModal(true);
  };

  const handleArchive = () => {
    const activeProduct = products[selectedIdx];
    if (!activeProduct) return;
    setArchiveTarget({ id: activeProduct.id, nama: activeProduct.nama });
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    const { id, nama } = archiveTarget;
    setArchiveTarget(null);
    try {
      await api.patch(`/products/${id}/archive`);
      addToast('success', `Produk "${nama}" berhasil diarsipkan.`);
      fetchProducts();
    } catch (err) {
      console.error(err);
      addToast('error', `Gagal mengarsipkan produk "${nama}". Coba lagi.`);
    }
  };

  const addPriceRow = () => {
    // Select first supplier not in list
    const usedIds = priceRows.map((r) => r.supplier_id);
    const available = suppliers.find((s) => !usedIds.includes(s.id));
    if (!available) {
      addToast('error', 'Semua supplier terdaftar sudah dimasukkan.');
      return;
    }
    setPriceRows((prev) => [...prev, { supplier_id: available.id, stok: '', harga_beli: '', aktif: true }]);
  };

  const removePriceRow = (idx: number) => {
    setPriceRows((prev) => prev.filter((_, i) => i !== idx));
    if (idx - 1 >= 0) {
      setTimeout(() => {
        const rows = document.querySelectorAll('.supplier-row');
        const prevRow = rows[idx - 1];
        const triggerInput = prevRow?.querySelector('input[type="text"]') as HTMLElement | null;
        triggerInput?.focus();
      }, 50);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kode || !nama) {
      setFormError('Kode dan Nama Produk wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      kode,
      nama,
      deskripsi,
      satuan,
      foto_urls: fotoUrls,
      prices: priceRows.map(row => ({
        ...row,
        stok: row.stok === '' ? 0 : Number(row.stok),
        harga_beli: row.harga_beli === '' ? 0 : Number(row.harga_beli)
      })),
      validation: editMode === 'prices' ? {
        tanggal: tanggalDiubah,
        oleh: diubahOleh,
        alasan: alasanDiubah
      } : undefined
    };

    try {
      if (editMode === 'create') {
        await api.post('/products', payload);
      } else {
        await api.put(`/products/${currentProduct?.id}`, payload);
      }
      setShowFormModal(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Gagal menyimpan produk');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation inside add/edit form modal
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // Get all focusable elements inside the form (excluding disabled/readonly fields, except form-start-fields)
    const form = e.currentTarget;
    const focusables = Array.from(
      form.querySelectorAll('input:not([disabled]):not([readonly]), input.form-start-field:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[type="submit"], button.form-cancel-btn')
    ) as HTMLElement[];

    const active = document.activeElement as HTMLElement;
    const idx = focusables.indexOf(active);

    if (idx === -1) return;

    if (e.key === 'Enter') {
      // If active is a textarea or a submit button, allow default behavior
      if (active.tagName === 'TEXTAREA' || active.getAttribute('type') === 'submit') {
        return;
      }
      e.preventDefault();
      const nextIdx = (idx + 1) % focusables.length;
      focusables[nextIdx]?.focus();
    } else if (e.key === 'ArrowRight') {
      // For input elements, only move if cursor is at the end
      if (active.tagName === 'INPUT') {
        const input = active as HTMLInputElement;
        if (input.selectionStart !== input.value.length) return;
      }
      e.preventDefault();
      const nextIdx = (idx + 1) % focusables.length;
      focusables[nextIdx]?.focus();
    } else if (e.key === 'ArrowLeft') {
      // For input elements, only move if cursor is at the start
      if (active.tagName === 'INPUT') {
        const input = active as HTMLInputElement;
        if (input.selectionStart !== 0) return;
      }
      e.preventDefault();
      const prevIdx = (idx - 1 + focusables.length) % focusables.length;
      focusables[prevIdx]?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (idx + 1) % focusables.length;
      focusables[nextIdx]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (idx - 1 + focusables.length) % focusables.length;
      focusables[prevIdx]?.focus();
    }
  };

  // Focus first enabled/editable input when showFormModal opens
  useEffect(() => {
    if (showFormModal) {
      setTimeout(() => {
        const form = document.querySelector('#kelola-produk-form') as HTMLFormElement | null;
        if (form) {
          const firstInput = form.querySelector('input:not([disabled]):not([readonly]), input.form-start-field:not([disabled]), select:not([disabled]), textarea:not([disabled])') as HTMLElement | null;
          firstInput?.focus();
        }
      }, 150);
    }
  }, [showFormModal, editMode]);

  // F2 inside the form modal to add a new supplier row
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (showFormModal && (editMode === 'create' || editMode === 'full' || editMode === 'prices')) {
      addPriceRow();
    }
  }, { enableOnFormTags: true });

  // F1 inside the form modal to upload/select a photo
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (showFormModal && (editMode === 'create' || editMode === 'full' || editMode === 'info')) {
      fileInputRef.current?.click();
    }
  }, { enableOnFormTags: true });

  // Hotkeys Setup
  // F1: Focus Search Bar (hanya aktif saat tidak ada modal terbuka)
  useHotkeys('f1', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    searchInputRef.current?.focus();
  }, { enableOnFormTags: false });

  // F2: Open Gallery Lightbox (hanya aktif saat tidak ada modal terbuka)
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    const active = products[selectedIdx];
    if (active) {
      setCurrentProduct(active);
      setShowGalleryModal(true);
    }
  }, { enableOnFormTags: false });

  // F3: Form Tambah Barang (hanya aktif saat tidak ada modal terbuka)
  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    handleOpenCreate();
  }, { enableOnFormTags: false });

  // Enter/F4: Open edit selection popup (hanya aktif saat tidak ada modal terbuka)
  useHotkeys('f4, enter', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    if (products.length > 0) {
      handleOpenEditSelect();
    }
  }, { enableOnFormTags: false });

  // Delete: Archive product (hanya aktif saat tidak ada modal terbuka)
  useHotkeys('delete, del', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    handleArchive();
  }, { enableOnFormTags: false });

  // Y: Simpan/submit form modal yang aktif (sesuai spesifikasi dokumen)
  useHotkeys('y', (e) => {
    e.preventDefault();
    if (showFormModal) {
      // Trigger form submit programmatically
      const form = document.querySelector('#kelola-produk-form') as HTMLFormElement;
      if (form) form.requestSubmit();
    }
  }, { enableOnFormTags: false });

  // F10: Simpan/submit form modal yang aktif (dari keyboard mana pun, termasuk input)
  useHotkeys('f10', (e) => {
    e.preventDefault();
    if (showFormModal) {
      const form = document.querySelector('#kelola-produk-form') as HTMLFormElement;
      if (form) form.requestSubmit();
    }
  }, { enableOnFormTags: true });

  // Arrow Navigation (hanya aktif saat tidak ada modal terbuka)
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    setSelectedIdx((prev) => Math.max(0, prev - 1));
  }, { enableOnFormTags: false });

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    setSelectedIdx((prev) => Math.min(products.length - 1, prev + 1));
  }, { enableOnFormTags: false });

  // PageUp / PageDown (hanya aktif saat tidak ada modal terbuka)
  useHotkeys('pageup', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    setPage((prev) => Math.max(1, prev - 1));
  }, { enableOnFormTags: false });

  useHotkeys('pagedown', (e) => {
    e.preventDefault();
    if (showFormModal || showEditTypeModal || showGalleryModal) return;
    const maxPage = Math.ceil(totalProducts / 10);
    setPage((prev) => Math.min(maxPage, prev + 1));
  }, { enableOnFormTags: false });

  // Esc: Tutup modal aktif atau clear search / kembali ke gudang
  useHotkeys('esc', (e) => {
    e.preventDefault();
    if (showSupplierPopup) {
      setShowSupplierPopup(false);
    } else if (showGalleryModal) {
      setShowGalleryModal(false);
    } else if (showFormModal) {
      setShowFormModal(false);
    } else if (showEditTypeModal) {
      setShowEditTypeModal(false);
    } else if (archiveTarget) {
      setArchiveTarget(null);
    } else if (showSearchPopup) {
      setShowSearchPopup(false);
    } else if (searchQuery || search) {
      setSearchQuery('');
      setSearch('');
    } else {
      navigate('/gudang');
    }
  }, { enableOnFormTags: true });

  useHotkeys('y', (e) => {
    e.preventDefault();
    if (archiveTarget) confirmArchive();
  }, { enableOnFormTags: false });

  const getProductPhotos = (p: Product | null): string[] => {
    if (!p) return [];
    try {
      return typeof p.foto_urls === 'string'
        ? JSON.parse(p.foto_urls)
        : Array.isArray(p.foto_urls) ? p.foto_urls : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <ModalPortal>
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
      </ModalPortal>

      {/* Archive Confirm Modal */}
      {archiveTarget && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setArchiveTarget(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 bg-amber-500/10 border-b border-amber-500/20 px-5 py-4">
              <div className="p-2 bg-amber-500/20 rounded-lg"><Archive size={18} className="text-amber-400" /></div>
              <div>
                <h2 className="font-bold text-white text-sm">Arsipkan Produk</h2>
                <p className="text-xs text-amber-400/80 mt-0.5">Tindakan ini dapat dibatalkan melalui halaman arsip</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <p className="text-slate-300 text-sm leading-relaxed">Apakah Anda yakin ingin mengarsipkan produk <span className="font-bold text-white">"{archiveTarget.nama}"</span>?</p>
              <p className="text-xs text-slate-500 mt-2">Produk yang diarsipkan tidak akan muncul di daftar aktif, namun datanya tetap tersimpan.</p>
            </div>
            <div className="flex gap-2 px-5 pb-5 justify-end">
              <button onClick={() => setArchiveTarget(null)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 hover:text-white transition-colors border border-surface-600">
                <kbd className="text-[10px] bg-surface-700 border border-surface-600 rounded px-1 py-0.5 font-mono">Esc</kbd>
                Batal
              </button>
              <button onClick={confirmArchive} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 transition-colors shadow-lg shadow-amber-500/20">
                <kbd className="text-[10px] bg-amber-400/40 border border-amber-400/40 rounded px-1 py-0.5 font-mono">Y</kbd>
                Ya, Arsipkan
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Katalog Kelola Produk</h1>
          <p className="text-slate-400">Kelola master data barang gudang aktif dan daftar harga supplier</p>
        </div>

        <button onClick={handleOpenCreate} className="btn-primary">
          <Plus size={16} />
          <span>Tambah Barang (F3)</span>
        </button>
      </div>

      {/* Filter and Helpers */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
        <div className="relative flex-1 w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search size={16} />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setShowSearchPopup(true);
                setPopupFocusedIndex(0);
              }
            }}
            placeholder="Ketik Nama/Kode Barang + Tekan Enter..."
            className="input-field pl-9 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearch('');
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 bg-surface-800/40 px-4 py-2.5 rounded-xl border border-surface-700/50 shrink-0">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">F1</kbd>
            <span>Cari</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">F2</kbd>
            <span>Galeri</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">F3</kbd>
            <span>Tambah</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">Enter</kbd>
            <span>Edit</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">Del</kbd>
            <span>Arsip</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">PgUp/PgDn</kbd>
            <span>Hal</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-surface-900 border border-surface-700 rounded text-slate-200 shadow-sm">Esc</kbd>
            <span>Kembali</span>
          </span>
        </div>
      </div>

      {/* Main Grid/Table */}
      {search.trim() === '' ? (
        <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 border border-dashed border-surface-700 rounded-xl bg-surface-800/10 min-h-[250px]">
          <Search className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-400">Pencarian Katalog Produk</h3>
          <p className="text-sm max-w-sm mt-1">Tekan <kbd className="shortcut-badge ml-0.5">F1</kbd> lalu masukkan nama/kode barang untuk menampilkan data katalog.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 skeleton" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="card p-0 overflow-hidden border border-surface-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-800 border-b border-surface-700 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4">Kode</th>
                  <th className="p-4">Nama Produk</th>
                  <th className="p-4 text-center">Stok</th>
                  <th className="p-4">Supplier Utama</th>
                  <th className="p-4 text-right">Harga Beli Termurah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {products.map((p, idx) => {
                  const cheapestPrice = p.product_prices.length > 0
                    ? Math.min(...p.product_prices.map((sp) => Number(sp.harga_beli)))
                    : 0;
                  const primeSupplier = p.product_prices.length > 0 ? p.product_prices[0].supplier.nama : '-';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedIdx(idx)}
                      onDoubleClick={handleOpenEditSelect}
                      ref={idx === selectedIdx ? activeRowRef : null}
                      className={`hover:bg-surface-800/40 cursor-pointer transition-colors ${idx === selectedIdx ? 'table-row-selected' : ''
                        }`}
                    >
                      <td className="p-4 font-mono font-semibold text-slate-300">{p.kode}</td>
                      <td className="p-4 font-bold text-white">{p.nama}</td>
                      <td className="p-4 text-center font-semibold text-slate-200">{Number(p.stok)}</td>
                      <td className="p-4 text-slate-300 truncate max-w-xs">{primeSupplier}</td>
                      <td className="p-4 text-right text-emerald-400 font-semibold currency">
                        {cheapestPrice > 0 ? formatCurrency(cheapestPrice) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between p-4 bg-surface-800/50 border-t border-surface-700">
            <span className="text-xs text-slate-400">
              Menampilkan {products.length} dari {totalProducts} barang
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
                disabled={products.length < 10}
                className="btn-secondary p-1.5 rounded-lg disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 bg-surface-800/20 border border-dashed border-surface-700 rounded-xl">
          Tidak ada barang aktif ditemukan.
        </div>
      )}

      {/* Popup 1: Select Edit Mode Modal */}
      {showEditTypeModal && currentProduct && (() => {
        const editOptions: Array<{ mode: 'info' | 'prices'; label: string; icon: any; colorClass: string; activeColorClass: string }> = [
          {
            mode: 'info',
            label: 'Hanya Informasi & Foto Produk',
            icon: ImageIcon,
            colorClass: 'text-emerald-500',
            activeColorClass: 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
          },
          {
            mode: 'prices',
            label: 'Hanya Stok & Harga Supplier',
            icon: Plus,
            colorClass: 'text-amber-500',
            activeColorClass: 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
          }
        ];

        const handleEditTypeModalKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setEditModeSelectIdx((prev) => (prev + 1) % editOptions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setEditModeSelectIdx((prev) => (prev - 1 + editOptions.length) % editOptions.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            handleStartEdit(editOptions[editModeSelectIdx].mode);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowEditTypeModal(false);
          }
        };

        return (
          <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
            <div
              ref={editTypeModalRef}
              tabIndex={0}
              onKeyDown={handleEditTypeModalKeyDown}
              className="bg-surface-800 border border-surface-700 rounded-xl max-w-sm w-full mx-4 shadow-2xl animate-scale-in outline-none flex flex-col"
            >
              <div className="flex justify-between items-center w-full">
                <h3 className="text-lg font-bold text-white">Pilih Mode Pengeditan</h3>
                <button onClick={() => setShowEditTypeModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 mb-4">
                <p className="text-xs text-slate-400">Pilih aspek produk yang ingin Anda perbarui untuk mempercepat pengisian.</p>
              </div>
              <div className="flex flex-col gap-2.5 mb-4">
                {editOptions.map((opt, idx) => {
                  const Icon = opt.icon;
                  const isActive = idx === editModeSelectIdx;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => handleStartEdit(opt.mode)}
                      className={`w-full text-left px-4 py-3.5 flex items-center gap-3 text-sm transition-all border rounded-lg ${isActive
                        ? opt.activeColorClass + ' font-semibold scale-[1.01]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white'
                        }`}
                    >
                      <Icon size={16} className={isActive ? '' : opt.colorClass} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 border-t border-surface-700/50 pt-2.5">
                <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
                <span><kbd className="shortcut-badge">Enter</kbd> pilih, <kbd className="shortcut-badge">Esc</kbd> batal</span>
              </div>
            </div>
          </div>
        </ModalPortal>
        );
      })()}      {/* Popup 2: Form Modal (Add / Edit) */}
      {showFormModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay overflow-y-auto">
          <div
            style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)' }}
            className="border border-blue-200 rounded-xl max-w-2xl w-full my-4 mx-4 shadow-2xl animate-scale-in flex flex-col overflow-hidden"
          >
            <form id="kelola-produk-form" onSubmit={handleSave} onKeyDown={handleFormKeyDown} className="space-y-3">
              {/* Header inside form as first-child to match index.css */}
              <div className="flex justify-between items-center w-full px-5 py-3">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editMode === 'create'
                      ? 'Tambah Produk Baru'
                      : editMode === 'prices'
                        ? 'Edit Stok & Harga'
                        : `Edit Produk: ${nama}`}
                  </h3>
                  <p className="text-[10px] text-white/70 mt-0.5 capitalize">Mode Pengeditan: {editMode} Mode</p>
                </div>
                <button type="button" onClick={() => setShowFormModal(false)}>
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mx-6 p-3 rounded-lg bg-danger-600/10 border border-danger-500/30 text-danger-600 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Read-only fields for Edit Stok Mode at the top */}
              {editMode === 'prices' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mx-6 mt-6">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">Kode Barang</label>
                    <input
                      type="text"
                      value={kode}
                      onChange={(e) => setKode(e.target.value)}
                      className="input-field form-start-field w-full bg-white border-blue-200 text-slate-800 focus:border-blue-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">Nama Barang</label>
                    <input
                      type="text"
                      readOnly
                      value={nama}
                      className="input-field form-start-field w-full bg-slate-100/80 border-blue-100 text-slate-500 cursor-not-allowed font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Product Info Section (Visible in 'create', 'full', 'info') */}
              {(editMode === 'create' || editMode === 'full' || editMode === 'info') && (
                <div className="space-y-3 mx-4 p-3.5 rounded-lg border border-blue-100 bg-blue-50/10 shadow-xs mt-3">
                  <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">A. Informasi Barang</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-700 font-semibold mb-1">Kode Barang</label>
                      <input
                        type="text"
                        required
                        value={kode}
                        onChange={(e) => setKode(e.target.value)}
                        placeholder="Tambahkan Kode Barang"
                        className="input-field form-start-field w-full bg-white border-blue-200 text-slate-800 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-700 font-semibold mb-1">Nama Produk</label>
                      <input
                        type="text"
                        required
                        value={nama}
                        onChange={(e) => setNama(e.target.value)}
                        placeholder="Tambahkan Nama Produk"
                        className="input-field form-start-field w-full bg-white border-blue-200 text-slate-800 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-700 font-semibold mb-1">Keterangan/Deskripsi</label>
                    <textarea
                      ref={descRef}
                      value={deskripsi}
                      onChange={(e) => {
                        setDeskripsi(e.target.value);
                        adjustDescHeight();
                      }}
                      placeholder="Tambahkan detail produk..."
                      className="input-field min-h-[40px] resize-none w-full bg-white border-blue-200 text-slate-800 focus:border-blue-500 overflow-hidden"
                    />
                  </div>

                  {/* Images Upload Area */}
                  <div>
                    <label className="block text-xs text-slate-700 font-semibold mb-1">Foto Produk (Maks 3, {"<150KB"} per file)</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {fotoUrls.map((url, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-blue-200 bg-white group">
                          <img src={url} alt="preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setFotoUrls(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-danger-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}

                      {fotoUrls.length < 3 && (
                        <label className="w-16 h-16 border border-dashed border-blue-200 hover:border-blue-500 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 bg-white cursor-pointer transition-colors">
                          <Upload size={16} />
                          <span className="text-[9px] mt-0.5">Upload (F1)</span>
                          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" multiple />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Price / Supplier Section (Visible in 'create', 'full', 'prices') */}
              {(editMode === 'create' || editMode === 'full' || editMode === 'prices') && (
                <div className="space-y-3 mx-4 p-3.5 rounded-lg border border-blue-100 bg-blue-50/10 shadow-xs mt-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">B. Harga Beli & Stok per Supplier</h4>
                    <button type="button" onClick={addPriceRow} className="btn-secondary py-1 px-2.5 text-xs border-blue-200 hover:bg-blue-50 text-blue-700 bg-white">
                      <Plus size={12} />
                      <span>Tambah Supplier (F2)</span>
                    </button>
                  </div>

                  {priceRows.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {priceRows.map((row, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-center bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm supplier-row">
                          {/* Supplier Selector */}
                          <div className="w-full sm:flex-1 relative">
                            <input
                              type="text"
                              readOnly
                              autoFocus={idx === priceRows.length - 1}
                              value={suppliers.find((s) => s.id === row.supplier_id)?.nama || ''}
                              onClick={() => {
                                setActiveSupplierRowIdx(idx);
                                setSupplierPopupSearch('');
                                setSupplierPopupFocusedIdx(0);
                                setShowSupplierPopup(true);
                              }}
                              onFocus={() => {
                                setActiveSupplierRowIdx(idx);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setActiveSupplierRowIdx(idx);
                                  setSupplierPopupSearch('');
                                  setSupplierPopupFocusedIdx(0);
                                  setShowSupplierPopup(true);
                                } else if (e.key === 'Delete' || e.key === 'Del') {
                                  e.preventDefault();
                                  removePriceRow(idx);
                                }
                              }}
                              placeholder="Pilih Supplier..."
                              className="input-field py-2 pr-8 w-full font-semibold bg-white border-blue-200 text-slate-800 cursor-pointer"
                            />
                            <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 pointer-events-none">
                              <Search size={14} />
                            </span>
                          </div>

                          {/* Stok Input */}
                          <div className="w-full sm:w-28">
                            <input
                              type="number"
                              value={row.stok}
                              onChange={(e) => {
                                const copy = [...priceRows];
                                copy[idx].stok = e.target.value === '' ? '' : parseFloat(e.target.value);
                                setPriceRows(copy);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Delete' || e.key === 'Del') {
                                  e.preventDefault();
                                  removePriceRow(idx);
                                }
                              }}
                              placeholder="Stok"
                              className="input-field py-2 font-semibold w-full bg-white border-blue-200 text-slate-800"
                            />
                          </div>

                          {/* Harga Input */}
                          <div className="w-full sm:w-40">
                            <input
                              type="text"
                              value={formatRupiahInput(row.harga_beli)}
                              onChange={(e) => {
                                const copy = [...priceRows];
                                copy[idx].harga_beli = e.target.value === '' ? '' : parseRupiahInput(e.target.value);
                                setPriceRows(copy);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Delete' || e.key === 'Del') {
                                  e.preventDefault();
                                  removePriceRow(idx);
                                }
                              }}
                              placeholder="Harga Beli"
                              className="input-field py-2 text-emerald-600 w-full font-mono font-semibold bg-white border-blue-200"
                            />
                          </div>

                          {/* Delete Action */}
                          <button
                            type="button"
                            onClick={() => removePriceRow(idx)}
                            className="p-2 text-slate-400 hover:text-danger-500 rounded hover:bg-slate-50 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-white rounded border border-dashed border-blue-200 text-xs text-slate-500">
                      Belum ada supplier harga yang ditambahkan. Silakan klik Tambah Supplier di atas atau tekan F2.
                    </div>
                  )}
                </div>
              )}

              {/* Validation Section (Visible only in 'prices' mode) */}
              {editMode === 'prices' && (
                <div className="space-y-3 mx-4 p-3.5 rounded-lg border border-blue-100 bg-blue-50/10 shadow-xs mt-3">
                  <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-blue-600" />
                    <span>Validasi Perubahan Stok</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Tanggal Diubah</label>
                      <input
                        type="date"
                        required
                        value={tanggalDiubah}
                        onChange={(e) => setTanggalDiubah(e.target.value)}
                        className="input-field w-full bg-white border-blue-200 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Diubah Oleh</label>
                      <input
                        type="text"
                        required
                        value={diubahOleh}
                        onChange={(e) => setDiubahOleh(e.target.value)}
                        placeholder="Nama Staff"
                        className="input-field w-full bg-white border-blue-200 text-slate-800 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Alasan Diubah</label>
                    <textarea
                      required
                      value={alasanDiubah}
                      onChange={(e) => setAlasanDiubah(e.target.value)}
                      placeholder="Contoh: koreksi stok fisik setelah stock opname"
                      className="input-field h-16 resize-none w-full bg-white border-blue-200 text-slate-800 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 border-t border-blue-100 pt-3 px-4 pb-4 mt-3">
                <button type="button" onClick={() => setShowFormModal(false)} className="btn-secondary form-cancel-btn border-slate-200 hover:bg-slate-50 text-slate-700 bg-white">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Simpan (F10)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Popup 3: Lightbox Gallery Modal */}
      {showGalleryModal && currentProduct && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="relative max-w-lg w-full p-4 animate-scale-in">
            <button
              onClick={() => setShowGalleryModal(false)}
              className="absolute top-0 right-0 m-4 p-2 bg-black/60 rounded-full hover:bg-black text-white z-10 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="card p-4 flex flex-col items-center gap-4 bg-surface-850">
              <h3 className="text-lg font-bold text-white">{currentProduct.nama}</h3>
              <div className="w-full h-80 rounded-lg bg-surface-900 border border-surface-700 overflow-hidden flex items-center justify-center">
                {getProductPhotos(currentProduct).length > 0 ? (
                  <img
                    src={getProductPhotos(currentProduct)[0]}
                    alt="product"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-slate-500 text-sm">Tidak ada foto produk terupload</div>
                )}
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Product Selection Popup Modal */}
      {showSearchPopup && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            ref={searchPopupRef}
            tabIndex={0}
            onKeyDown={handleSearchPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col p-6"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>Pilih Barang</span>
              </h3>
              <button onClick={() => setShowSearchPopup(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {popupProducts.length > 0 ? (
                popupProducts.map((prod, idx) => (
                  <button
                    key={prod.id}
                    onClick={() => selectProduct(prod)}
                    ref={idx === popupFocusedIndex ? activePopupItemRef : null}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${idx === popupFocusedIndex
                      ? 'border-primary-500 bg-primary-50 text-primary-900 font-semibold ring-2 ring-primary-500/20 scale-[1.01]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white'
                      }`}
                  >
                    <div>
                      <p className={`font-semibold ${idx === popupFocusedIndex ? 'text-primary-900' : 'text-slate-900'}`}>{prod.nama}</p>
                      <p className="text-xs text-slate-500 font-mono">{prod.kode}</p>
                    </div>
                    <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                      Stok: {Number(prod.stok)} {prod.satuan}
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Tidak ada barang yang cocok dengan "{searchQuery}".
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-surface-700 flex justify-between text-[11px] text-slate-500">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> untuk konfirmasi, <kbd className="shortcut-badge">Esc</kbd> batal</span>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Supplier Selection Popup Modal */}
      {showSupplierPopup && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center modal-overlay">
          <div
            ref={supplierPopupRef}
            tabIndex={0}
            onKeyDown={handleSupplierPopupKeyDown}
            className="bg-surface-800 border border-surface-700 rounded-xl max-w-xl w-full mx-4 shadow-2xl animate-scale-in outline-none max-h-[80vh] flex flex-col p-6"
          >
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search size={18} />
                <span>Pilih Supplier</span>
              </h3>
              <button onClick={() => setShowSupplierPopup(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Search Input inside Popup */}
            <div className="relative mt-4 w-full">
              <Search size={16} className="absolute left-10  top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={supplierPopupInputRef}
                type="text"
                value={supplierPopupSearch}
                onKeyDown={handleSupplierPopupKeyDown}
                onChange={(e) => {
                  setSupplierPopupSearch(e.target.value);
                  setSupplierPopupFocusedIdx(0);
                }}
                placeholder="Cari Kode atau Nama Supplier..."
                className="input-field pl-10 w-full bg-white text-slate-800"
              />
            </div>

            {/* Supplier List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-4">
              {(() => {
                const filtered = suppliers.filter(s =>
                  s.nama.toLowerCase().includes(supplierPopupSearch.toLowerCase()) ||
                  s.kode.toLowerCase().includes(supplierPopupSearch.toLowerCase())
                );
                return filtered.length > 0 ? (
                  filtered.map((sup, idx) => (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => selectSupplierForActiveRow(sup)}
                      ref={idx === supplierPopupFocusedIdx ? activeSupplierPopupItemRef : null}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-all border rounded-lg ${idx === supplierPopupFocusedIdx
                        ? 'border-primary-500 bg-primary-50 text-primary-900 font-semibold ring-2 ring-primary-500/20 scale-[1.01]'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 bg-white'
                        }`}
                    >
                      <div>
                        <p className={`font-semibold ${idx === supplierPopupFocusedIdx ? 'text-primary-900' : 'text-slate-900'}`}>{sup.nama}</p>
                        <p className="text-xs text-slate-500 font-mono">{sup.kode}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Tidak ada supplier yang cocok dengan "{supplierPopupSearch}".
                  </div>
                );
              })()}
            </div>

            <div className="mt-4 pt-3 border-t border-surface-700 flex justify-between text-[11px] text-slate-500">
              <span>Gunakan <kbd className="shortcut-badge">↑</kbd> <kbd className="shortcut-badge">↓</kbd> untuk memilih</span>
              <span><kbd className="shortcut-badge">Enter</kbd> untuk konfirmasi, <kbd className="shortcut-badge">Esc</kbd> batal</span>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
