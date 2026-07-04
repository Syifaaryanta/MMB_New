# 📊 Laporan Analisis Sistem & Shortcut Keyboard (MMB System)

Laporan ini disusun untuk memberikan dokumentasi teknis yang mendalam mengenai sistem **Maju Mulia Bersama (MMB)** saat ini (Vue 3 + Supabase/PostgreSQL) sebagai acuan untuk membangun ulang aplikasi menggunakan **React 18** dan **MySQL**.

---

## 🗂️ 1. Struktur Database (Postgres ➡️ MySQL)

Sistem saat ini menggunakan **Supabase (PostgreSQL + RLS)**. Untuk migrasi ke **MySQL**, Anda memerlukan backend server API (misalnya Node.js/Express) karena MySQL tidak memiliki sistem *Real-time API* dan *Row Level Security (RLS)* bawaan seperti Supabase.

Berikut relasi tabel utama yang diterjemahkan ke MySQL DDL:

```sql
-- 1. Profiles (User Management)
CREATE TABLE profiles (
    id VARCHAR(36) PRIMARY KEY, -- UUID v4 dari auth system
    email VARCHAR(255) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff_gudang', 'staff_kantor', 'sales') NOT NULL,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Products (Barang Gudang)
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    kode VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    stok DECIMAL(15,3) DEFAULT 0.000, -- Mendukung desimal sesuai schema 14
    satuan VARCHAR(20) DEFAULT 'pcs',
    aktif BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    foto_urls JSON, -- Menyimpan array link gambar produk (Cloudinary)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Suppliers (Pemasok)
CREATE TABLE suppliers (
    id VARCHAR(36) PRIMARY KEY,
    kode VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    alamat TEXT,
    no_telp VARCHAR(50),
    jatuh_tempo_bulan INT DEFAULT 1,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Customers (Pelanggan)
CREATE TABLE customers (
    id VARCHAR(36) PRIMARY KEY,
    kode VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    alamat TEXT,
    no_telp VARCHAR(50),
    jatuh_tempo_bulan INT DEFAULT 1,
    limit_kredit DECIMAL(15,2) DEFAULT 10000000.00,
    saldo_piutang DECIMAL(15,2) DEFAULT 0.00,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Product Prices (Harga Barang per Supplier)
CREATE TABLE product_prices (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    supplier_id VARCHAR(36) NOT NULL,
    stok DECIMAL(15,3) DEFAULT 0.000,
    harga_beli DECIMAL(15,2) DEFAULT 0.00,
    aktif BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    UNIQUE KEY uq_prod_supp (product_id, supplier_id)
);

-- 6. Purchases (Order Beli / Purchase Order)
CREATE TABLE purchases (
    id VARCHAR(36) PRIMARY KEY,
    no_order VARCHAR(50) UNIQUE NOT NULL,
    supplier_id VARCHAR(36) NOT NULL,
    order_date DATE NOT NULL,
    terms VARCHAR(20) DEFAULT 'tunai', -- 'tunai', '1', '2', '3' (bulan)
    subtotal DECIMAL(15,2) DEFAULT 0.00,
    status ENUM('draft', 'completed', 'received') DEFAULT 'draft',
    received_at TIMESTAMP NULL DEFAULT NULL,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- 7. Purchase Items (Detail Item PO)
CREATE TABLE purchase_items (
    id VARCHAR(36) PRIMARY KEY,
    purchase_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    qty DECIMAL(15,3) DEFAULT 0.000,
    harga_beli DECIMAL(15,2) DEFAULT 0.00,
    subtotal DECIMAL(15,2) DEFAULT 0.00,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 8. Sales (Order Jual / Sales Invoice)
CREATE TABLE sales (
    id VARCHAR(36) PRIMARY KEY,
    no_order VARCHAR(50) UNIQUE NOT NULL,
    no_faktur VARCHAR(50) UNIQUE, -- Nomor nota/print (YYNNN)
    order_date DATE NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    customer_nama VARCHAR(255) NOT NULL,
    customer_alamat TEXT,
    customer_telp VARCHAR(50),
    diantar BOOLEAN DEFAULT TRUE,
    limit_bulan INT DEFAULT 0, -- 0=1 bln, 1=2 bln, 2=3 bln
    due_date DATE, -- Hitung otomatis berdasarkan order_date + limit_bulan
    extra_charge_desc TEXT,
    extra_charge_amount DECIMAL(15,2) DEFAULT 0.00, -- Charge tambahan
    sender_note TEXT, -- Catatan pengiriman
    subtotal DECIMAL(15,2) DEFAULT 0.00,
    status ENUM('draft', 'completed') DEFAULT 'draft',
    nota_merah BOOLEAN NOT NULL DEFAULT FALSE,
    nota_putih BOOLEAN NOT NULL DEFAULT FALSE,
    nota_kuning BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 9. Sale Items (Detail Item Penjualan)
CREATE TABLE sale_items (
    id VARCHAR(36) PRIMARY KEY,
    sale_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    product_kode VARCHAR(50) NOT NULL,
    product_nama VARCHAR(255) NOT NULL,
    qty DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL, -- Harga jual
    total DECIMAL(15,2) NOT NULL, -- Subtotal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 10. Sales Payments (Catatan Pembayaran Penagihan)
CREATE TABLE sales_payments (
    id VARCHAR(36) PRIMARY KEY,
    sale_id VARCHAR(36) NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    note TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- 11. Stock Adjustments (Histori Penyesuaian Stok Gudang)
CREATE TABLE stock_adjustments (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) REFERENCES products(id) ON DELETE SET NULL,
    product_kode VARCHAR(50) NOT NULL DEFAULT '',
    product_nama VARCHAR(255) NOT NULL DEFAULT '',
    adjustment_date DATE NOT NULL,
    stock_before DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    stock_after DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    qty_delta DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    staff_nama VARCHAR(255) NOT NULL DEFAULT '',
    alasan TEXT NOT NULL,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```,StartLine:25,TargetContent:
```

---

## 🖥️ 2. Analisis Halaman & Fitur Lengkap

Sistem MMB memisahkan akses hak berdasarkan Role (*Role-Based Access Control*):
1. **admin**: Akses Penuh ke semua halaman (CRUD).
2. **staff_gudang**: Hanya akses Dashboard, Gudang, dan Master Data.
3. **sales**: Akses Dashboard, Pembelian, Penjualan, Penagihan, dan Master Data (Read-Only).
4. **staff_kantor**: Akses semua halaman secara **Read-Only** (tidak bisa mutasi data).

Berikut rincian seluruh modul dan halaman beserta fiturnya:

### 🔑 A. Modul Auth & Core Layout
*   **Halaman Login (`/login`)**:
    *   *Fitur*: Form autentikasi email & password, validasi input email, tombol toggle show/hide password, error handling login.
*   **Main Layout (Main Wrapper)**:
    *   *Fitur*: Sidebar navigasi kiri dinamis (menyembunyikan link menu berdasarkan role user), header atas berisi avatar profil pengguna dengan inisial nama, toggle menu kolaps (sidebar desktop/mobile drawer), global key listeners.
*   **Halaman Profil (`/profile`)**:
    *   *Fitur*: Menampilkan detail user yang sedang login (Nama Lengkap, Email, Role, User ID).

### 📦 B. Modul Gudang (Inventory)
*   **Menu Gudang (`/gudang`)**:
    *   *Fitur*: Akses cepat navigasi sub-fitur Gudang dan menampilkan dashboard mini statistik (Total SKU, Jumlah Stok Aman, Jumlah Stok Kritis/Perlu Restock, dan Total Rekan Supplier).
*   **Informasi Harga (`/gudang/cek-harga`)**:
    *   *Fitur*: Cek cepat harga jual, harga beli terakhir, qty penjualan terakhir, tanggal penjualan terakhir, dan kalkulasi estimasi cost per barang. Mendukung multi-search (Barang + opsional Pelanggan).
*   **Kelola Produk (`/gudang/katalog`)**:
    *   *Fitur*: Manajemen database produk aktif.
        *   Tambah/Edit produk: Kode barang, nama barang, deskripsi, satuan, multi-upload gambar ke Cloudinary (terkompresi maks 150KB, maks 3 foto).
        *   Tabel relasi Supplier-Price: edit stok dan harga beli per supplier secara dinamis.
        *   Detail Modal Edit Pilihan: Saat barang diedit, muncul pilihan apakah ingin mengedit Detail Penuh, Informasi Produk saja, atau Stok/Harga saja.
        *   Arsip Cepat (Soft-delete): Mengarsipkan barang aktif.
*   **Arsip Produk (`/gudang/archive`)**:
    *   *Fitur*: Menampilkan seluruh produk terarsip (`is_archived = true`). Pengguna dapat melakukan pencarian dan melakukan "Restore" (mengembalikan produk terarsip menjadi produk aktif kembali).
*   **Daftar Inventori (`/gudang/cek-semua`)**:
    *   *Fitur*: Tampilan tabel ringkas dari seluruh persediaan gudang secara real-time. Memungkinkan pencarian cepat dan link cepat untuk mengarsipkan barang atau melihat detail produk.
*   **Detail Produk (`/gudang/detail`)**:
    *   *Fitur*: Lembar detail tunggal produk berisi spesifikasi lengkap produk, total stok gabungan supplier, harga beli terendah, galeri foto produk (mendukung Zoom/Lightbox layar penuh), dan rincian data inventori per supplier (nama supplier, stok, harga beli).

### 🛒 C. Modul Pembelian (Purchase Orders)
*   **Menu Pembelian (`/pembelian`)**:
    *   *Fitur*: Navigasi sub-modul pembelian dan rekap data statistik (Total PO, Menunggu Terima, Sudah Diterima, dan Supplier Aktif).
*   **Buat Order PO (`/pembelian/order`)**:
    *   *Fitur*: Langkah awal pembuatan PO (Step 1). Otomatis generate nomor PO baru. Input tanggal order, memilih Supplier (auto-complete search modal), serta memilih jatuh tempo term pembayaran (Tunai, 1-3 Bulan). Menyimpan progress kerja di session storage.
*   **Input Item PO (`/pembelian/input`)**:
    *   *Fitur*: Langkah input barang PO (Step 2).
        *   Grid input item dinamis: Pencarian produk, penentuan qty pesanan, dan harga beli.
        *   Informasi historis (F4): Menampilkan riwayat harga beli barang tersebut dari supplier terkait sebelumnya.
        *   Simpan Draf: Menyimpan data PO dengan status `draft`.
        *   Finalisasi PO: Menyelesaikan PO dan mengirimkannya ke antrean *Receiving*.
*   **Order Tertunda/Draft (`/pembelian/draft`)**:
    *   *Fitur*: Melihat dan memproses kembali pesanan pembelian yang masih berstatus `draft`. Pengguna bisa menghapus draf atau melanjutkan pengisian draf.
*   **Edit Order PO (`/pembelian/edit-order`)**:
    *   *Fitur*: Mencari nomor PO aktif yang berstatus draf atau selesai untuk diedit isinya.
*   **Receiving Pembelian (`/pembelian/receiving`)**:
    *   *Fitur*: Pencatatan penerimaan barang fisik ke gudang.
        *   Menampilkan daftar PO berstatus `completed` (pending receiving).
        *   Lembar Checklist Penerimaan: Memeriksa item PO satu per satu melalui checklist interaktif.
        *   Finalisasi Terima: Meng-update stok riil barang di gudang (`products.stok` bertambah) dan mengubah status PO menjadi `received`.
*   **History Pembelian (`/pembelian/history-pembelian`)**:
    *   *Fitur*: Filter histori lengkap PO berdasarkan rentang tanggal. Menampilkan detail item pembelian per nota.
*   **History Transaksi (`/pembelian/history`)**:
    *   *Fitur*: Dua tab histori transaksi besar:
        1.  *Riwayat per Supplier/Customer*: Lacak keluar-masuk barang per nama instansi.
        2.  *Riwayat per Barang*: Audit log pergerakan keluar-masuk SKU produk (qty awal, qty mutasi, sisa stok, tipe transaksi [Jual/Beli], no nota, user pencatat, dan timestamp).

### 💰 D. Modul Penjualan (Point of Sale - POS)
*   **Menu Penjualan (`/penjualan`)**:
    *   *Fitur*: Pilihan menu penjualan beserta indikator statistik omzet/order (Hari ini, Minggu ini, Bulan ini, Total keseluruhan).
*   **Buat Order SO (`/penjualan/buat`)**:
    *   *Fitur*: Setup SO (Step 1). Input tanggal SO, pencarian customer (auto-complete search modal), penentuan metode pengiriman (Diantar/Diambil), jatuh tempo bayar, dan Salesman (A-E). Melakukan verifikasi limit kredit customer (apabila melebihi limit, admin harus melakukan override approval).
*   **Input Item SO (`/penjualan/input`)**:
    *   *Fitur*: Input barang SO (Step 2).
        *   Pencarian barang cepat, input qty, input harga jual, dan hitung subtotal otomatis.
        *   Mendukung *Invoice Adjustment*: Menambahkan baris penyesuaian biaya/diskon di luar harga barang.
        *   Pencegahan Stok Kosong: Memunculkan modal peringatan jika stok produk di gudang tidak mencukupi untuk dijual.
        *   Selesaikan SO: Mengunci invoice dan menampilkan popup pilihan cetak nota kasir.
*   **Edit Penjualan (`/penjualan/edit`)**:
    *   *Fitur*: Pencarian SO aktif untuk diedit data barang atau data pengirimannya.
*   **Daftar Penjualan (`/penjualan/list`)**:
    *   *Fitur*: Tabel pencarian dan histori seluruh invoice penjualan selesai. Pengguna dapat melihat detail item penjualan, mencetak ulang nota, atau membatalkan/menghapus transaksi penjualan.
*   **Order Penjualan Tertunda (`/penjualan/draft`)**:
    *   *Fitur*: Mengelola draf transaksi penjualan yang ditunda pembayarannya sebelum diselesaikan.

### 💳 E. Modul Penagihan (Accounts Receivable)
*   **Menu Penagihan (`/penagihan`)**:
    *   *Fitur*: Menu utama penagihan piutang dan indikator nominal (Total outstanding piutang, Jumlah piutang jatuh tempo/overdue, dll).
*   **Piutang Aktif (`/penagihan/piutang`)**:
    *   *Fitur*: Daftar piutang aktif customer dengan pengelompokan (grouping) per nama customer.
        *   Dapat diexpand untuk melihat rincian nota-nota piutang customer tersebut.
        *   Proses Pembayaran (F10): Menginput setoran pembayaran piutang customer (bisa cicilan/partial payment atau pelunasan langsung).
*   **Manajemen Nota (`/penagihan/nota`)**:
    *   *Fitur*: Kontrol fisik dokumen nota (Nota Merah, Nota Putih, Nota Kuning) per invoice. Berfungsi sebagai checklist bagi sales/kolektor untuk menandai nota fisik mana yang sudah diserahkan atau ditagih ke customer.
*   **History Pembayaran (`/penagihan/tunai`)**:
    *   *Fitur*: Menampilkan log seluruh transaksi yang telah lunas (baik penjualan tunai langsung maupun pelunasan piutang). Menyediakan fitur *Rollback* (pembatalan pelunasan) untuk mengembalikan status invoice menjadi belum lunas jika terjadi kesalahan input.
*   **Riwayat Penagihan (`/penagihan/riwayat`)**:
    *   *Fitur*: Log riwayat angsuran/pembayaran cicilan piutang customer.

### 📊 F. Modul Laporan (Reporting)
*   *Laporan Ringkasan Bisnis (`/laporan/ringkasan-bisnis`)*: Omzet penjualan, laba kotor, stok, outstanding piutang & hutang, serta tren grafik pergerakan bisnis.
*   *Laporan Penjualan Detail (`/laporan/penjualan-detail`)*: Margin laba kotor per barang, per customer, dan per tanggal penjualan.
*   *Laporan Pembelian Detail (`/laporan/pembelian-detail`)*: Detail data barang masuk per supplier beserta histori harga beli produk.
*   *Laporan Stok Persediaan (`/laporan/stok-persediaan`)*: Nilai aset stok saat ini dan analisa barang fast-moving vs slow-moving.
*   *Laporan Penagihan Piutang (`/laporan/penagihan-piutang`)*: Aging report (analisa umur piutang 30, 60, 90+ hari).
*   *Laporan Hutang (`/laporan/hutang`)*: Rekap hutang ke supplier yang jatuh tempo berdasarkan PO.
*   *Laporan Arus Kas (`/laporan/arus-kas`)*: Arus kas masuk (Tunai & Pelunasan Piutang) vs Arus kas keluar (Pembelian & Pelunasan Hutang).
*   *Laporan Audit Aktivitas (`/laporan/audit-aktivitas`)*: Log logistik (kapan user melakukan perubahan stok manual, rollback pembayaran, hapus draf, login user).

---

## ⌨️ 3. Daftar Lengkap Shortcut Keyboard

Aplikasi MMB dirancang agar dapat dioperasikan secara cepat oleh kasir dan staff gudang **hanya menggunakan keyboard (tanpa mouse)**.

Berikut adalah direktori shortcut keyboard lengkap berdasarkan halamannya:

### 🏠 A. Global & Layout Utama
Shortcuts ini berlaku di hampir semua halaman utama selama focus tidak berada di dalam bidang input teks (`INPUT`/`TEXTAREA`).

| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `Escape` | Membuka/Menutup Sidebar | Desktop: toggle kolaps. Mobile: toggle drawer menu. |
| `Ctrl + Shift + P` | Buka Profil Pengguna | Berpindah langsung ke halaman `/profile`. |
| `ArrowUp` | Pilih Navigasi Atas | Menggeser pilihan menu sidebar ke atas (hanya di Dashboard). |
| `ArrowDown` | Pilih Navigasi Bawah | Menggeser pilihan menu sidebar ke bawah (hanya di Dashboard). |
| `Enter` | Konfirmasi Navigasi | Mengakses halaman menu sidebar yang sedang terpilih (hanya di Dashboard). |

---

### 📊 B. Dashboard Operasional (`/dashboard`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Filter Rentang 30 Hari | Mengubah filter periode grafik/KPI menjadi 30 hari ke belakang. |
| `F2` | Filter Rentang 6 Bulan | Mengubah filter periode grafik/KPI menjadi 6 bulan ke belakang. |
| `F3` | Filter Rentang 1 Tahun | Mengubah filter periode grafik/KPI menjadi 12 bulan ke belakang. |
| `F5` | Refresh Data Dashboard | Mengambil ulang data KPI dan grafik dari database. |
| `Escape` | Reset Filter Periode | Mengembalikan filter ke pilihan bawaan (30 hari). |
| `1` s/d `6` | Navigasi Cepat Modul | `1`=Penjualan, `2`=Pembelian, `3`=Penagihan, `4`=Gudang, `5`=Master Data, `6`=History. |

---

### 📦 C. Modul Gudang & Inventori

#### 1. Informasi Harga (`/gudang/cek-harga`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Fokus Pencarian Barang | Mengarahkan kursor dan fokus ke input teks Nama/Kode Barang. |
| `F2` | Fokus Pencarian Pelanggan | Mengarahkan kursor ke input Nama Customer. |
| `F4` / `Enter` | Buka Detail Barang | Menampilkan lembar spesifikasi & stok supplier barang terpilih. |
| `ArrowUp` / `ArrowDown` | Navigasi Tabel Barang | Menggeser baris pilihan barang yang aktif di tabel hasil pencarian. |
| `PageUp` / `PageDown` | Navigasi Halaman Tabel | Berpindah halaman hasil pencarian barang (Pagination). |
| `Escape` | Batal / Kembali | Jika ada hasil pencarian: Reset tabel hasil & fokus ke input barang. Jika kosong: Kembali ke menu Gudang. |
| `Alt + N` | Tambah Barang Baru | Membuka modal form "Tambah Barang Baru". |

#### 2. Kelola Produk / Katalog (`/gudang/katalog`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Buka Galeri Gambar | Menampilkan lightbox foto produk yang sedang terpilih. |
| `F2` | Form Tambah Barang | Membuka modal formulir pembuatan barang baru. |
| `F4` / `Enter` | Buka Modal Tipe Edit | Membuka modal pilihan variasi edit (Edit Penuh, Info saja, Stok saja). |
| `Delete` | Arsipkan Barang | Membuka modal konfirmasi untuk menonaktifkan/mengarsipkan produk. |
| `ArrowUp` / `ArrowDown` | Navigasi Tabel Katalog | Menggeser baris produk yang terpilih di tabel katalog. |
| `PageUp` / `PageDown` | Pindah Halaman Katalog | Mengganti halaman pagination tabel katalog. |
| `Escape` | Batal / Kembali | Jika ada teks pencarian: Clear filter & fokus input. Jika kosong: Kembali ke menu Gudang. |

#### 3. Arsip Produk (`/gudang/archive`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Fokus Cari Arsip | Mengarahkan kursor ke input pencarian barang terarsip. |
| `F3` / `Enter` | Pulihkan (Unarchive) | Membuka konfirmasi modal untuk mengaktifkan kembali produk terpilih. |
| `ArrowUp` / `ArrowDown` | Navigasi Tabel Arsip | Menggeser baris pilihan di tabel arsip. |
| `PageUp` / `PageDown` | Pindah Halaman Arsip | Mengganti halaman pagination tabel arsip. |
| `Escape` | Batal / Kembali | Jika ada teks pencarian: Clear filter & fokus input. Jika kosong: Kembali ke menu Gudang. |

*Note untuk Lightbox Foto Gudang:*
*   `ArrowLeft` / `ArrowRight`: Geser foto sebelumnya / selanjutnya.
*   `Escape`: Tutup galeri foto layar penuh (lightbox).

*Note untuk Form Modal Tambah/Edit Produk:*
*   `Escape`: Tutup modal.
*   `Y` (ketika focus bukan di input teks): Simpan/submit data ke database.
*   `Delete` (ketika focus bukan di input teks): Menghapus baris harga supplier aktif yang dipilih.

---

### 🛒 D. Modul Pembelian (PO)

#### 1. Buat Order PO / Step 1 (`/pembelian/order`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `Escape` | Kembali ke Menu PO | Membatalkan pembuatan PO dan kembali ke menu utama pembelian. |
| `Enter` | Navigasi Kolom Input | Berpindah dari Tanggal ➡️ Input Supplier ➡️ Pilihan Term Pembayaran. |
| `Backspace` | Navigasi Mundur Input | Berpindah mundur dari Term Pembayaran ➡️ Supplier ➡️ Tanggal. |
| `ArrowLeft` / `ArrowRight` | Geser Pilihan Term | Menggeser opsi pembayaran terpilih (Tunai, 1 Bulan, 2 Bulan, 3 Bulan) saat focus di kolom terms. |
| `1` s/d `4` | Pilih Opsi Term | Pintasan cepat memilih term pembayaran (`1`=Tunai, `2`=1 Bulan, `3`=2 Bulan, `4`=3 Bulan). |

#### 2. Input Item PO / Step 2 (`/pembelian/input` & `/pembelian/edit-order`)
Shortcuts pada tabel dinamis pengisian barang PO:

| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F2` | Fokus Input Barang Baru | Langsung mengarahkan kursor ke kolom tambah barang baru di baris terbawah. |
| `F3` | Sembunyikan Detail PO | Toggle show/hide panel informasi supplier di bagian atas. |
| `F4` | Histori Harga Beli (di Kolom Harga) | Membuka modal popover berisi histori harga beli produk ini dari supplier terkait. |
| `F10` | Selesaikan/Simpan PO | Membuka modal konfirmasi untuk menyimpan PO ke database. |
| `Escape` | Batalkan Input PO | Membuka konfirmasi modal untuk keluar (menyimpan draf atau membuang perubahan). |
| `Delete` | Hapus Baris Barang | Menghapus baris barang aktif yang sedang dipilih di tabel PO. |
| `ArrowRight` | Geser Kanan | Memindahkan kursor focus dari kolom Qty ➡️ kolom Harga. |
| `ArrowLeft` | Geser Kiri | Memindahkan kursor dari kolom Harga ➡️ kolom Qty ➡️ Input barang baru. |
| `ArrowDown` | Pindah Baris Bawah | Memindahkan kursor ke baris barang di bawahnya. Jika di baris terakhir, pindah ke input baris baru. |
| `ArrowUp` | Pindah Baris Atas | Memindahkan kursor ke baris barang di atasnya. Jika di baris pertama, pindah ke input barang baru. |
| `Enter` | Lanjut/Konfirmasi | Di kolom Qty: Pindah focus ke Harga. Di kolom Harga: Simpan baris dan buat baris input barang baru di bawahnya. |

---

### 💰 E. Modul Penjualan (POS)

#### 1. Buat Order SO / Step 1 (`/penjualan/buat`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F2` | Quick Add Customer | Membuka modal cepat untuk menambah pelanggan baru tanpa keluar dari halaman SO. |
| `F4` | Info Bantuan Kolom | Membuka modal popover info panduan pengisian sesuai kolom yang sedang aktif. |
| `Escape` | Tutup Modal / Kembali | Jika ada modal aktif: Tutup modal. Jika tidak ada modal: Kembali ke menu utama Penjualan. |
| `Y` / `y` | Lanjut ke Input Barang | Menyimpan data pelanggan & metadata penjualan, lalu melompat ke halaman Input Barang. |
| `1` s/d `3` | Pilihan Term / Pengiriman | Pintasan cepat mengubah radio button opsi pengiriman atau jatuh tempo termin kredit. |

#### 2. Input Item SO / Step 2 (`/penjualan/input` & `/penjualan/edit`)
Shortcuts pada tabel kasir input barang penjualan:

| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Mode Adjustment (Penyesuaian) | Berpindah ke kolom pengisian adjustment nota (biaya admin, diskon langsung, dsb). |
| `F2` | Mode Pencarian Produk | Berpindah ke kolom cari barang normal. |
| `F3` | Sembunyikan Info Nota | Toggle menampilkan/menyembunyikan panel data customer di header atas. |
| `F10` | Buka Kolom Catatan | Memindahkan focus kursor ke input teks catatan pengiriman di footer nota. |
| `Ctrl + S` | Selesaikan Transaksi | Menyimpan invoice dan membuka modal konfirmasi pembayaran & cetak nota. |
| `Escape` | Batalkan SO | Membuka modal konfirmasi untuk keluar halaman dan menyimpan draf. |
| `ArrowUp` / `ArrowDown` | Pindah Baris Item | Navigasi kursor naik/turun baris barang di dalam invoice penjualan. |
| `ArrowLeft` / `ArrowRight` | Geser Kolom Item | Navigasi kursor geser kiri/kanan antar kolom Qty dan Harga Jual. |
| `Delete` | Hapus Item SO | Menghapus baris barang aktif dari dalam daftar belanjaan invoice. |

---

### 💳 F. Modul Penagihan & Piutang

#### 1. Piutang Aktif (`/penagihan/piutang`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Fokus Cari Customer | Mengarahkan kursor ke kolom input pencarian nama customer yang memiliki piutang. |
| `F2` | Fokus Filter Tanggal | Mengarahkan kursor ke kolom input tanggal awal tagihan. |
| `F3` | Filter Status Piutang | Membuka modal status filter (Lancar, Jatuh Tempo, Kurang Bayar). |
| `F4` | Detail Transaksi Nota | Membuka rincian invoice asli terpilih dalam modal detail. |
| `F10` | Bayar / Setor Tagihan | Membuka modal transaksi penerimaan uang angsuran/pelunasan piutang customer terpilih. |
| `ArrowUp` / `ArrowDown` | Navigasi Baris Piutang | Menggeser baris terpilih pada tabel piutang customer. |
| `Enter` | Expand/Collapse Piutang | Membuka/menutup rincian daftar nota piutang di bawah baris customer terpilih. |
| `Escape` | Kembali / Reset | Jika sedang dalam detail expand: Tutup expand. Jika normal: Kembali ke menu utama Penagihan. |

#### 2. Manajemen Nota (`/penagihan/nota`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `Enter` | Masuk Mode Edit Checklist | Mengaktifkan kursor checklist Nota Merah, Putih, dan Kuning pada baris yang dipilih. |
| `ArrowLeft` / `ArrowRight` | Pindah Kolom Nota | Menggeser kursor edit aktif antara kolom Nota Merah ➡️ Nota Putih ➡️ Nota Kuning. |
| `Space` / `Enter` (Mode Edit) | Toggle Checklist Nota | Mencentang / menghilangkan centang status serah terima nota fisik. |
| `F4` | Sinkronisasi Nota Otomatis | Mengisi checklist nota otomatis berdasarkan status pembayaran invoice di database. |
| `Escape` | Keluar Mode Edit / Kembali | Jika dalam mode edit: Simpan status & keluar mode edit. Jika tidak: Kembali ke menu Penagihan. |
| `ArrowUp` / `ArrowDown` | Navigasi Baris Nota | Menggeser baris pilihan nota customer di tabel. |

#### 3. History Pembayaran & Pembatalan (`/penagihan/tunai`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Fokus Pencarian Pembayaran | Mengarahkan kursor ke input pencarian data pembayaran lunas. |
| `F4` | Normalisasi Kas | Menjalankan fungsi normalisasi log pencatatan kas dari transaksi. |
| `Enter` | Rincian Kwitansi | Membuka modal kwitansi pembayaran detail dari baris yang dipilih. |
| `Delete` | Rollback (Batalkan Pelunasan) | Membuka modal konfirmasi untuk membatalkan status lunas (invoice menjadi piutang kembali). |
| `Escape` | Kembali ke Menu | Menutup modal detail atau kembali ke menu utama Penagihan. |

---

### 📊 G. Modul Laporan
Shortcuts ini seragam dan berlaku di **semua 8 halaman rincian laporan detail** (`LaporanRingkasanBisnisPage`, `LaporanPenjualanDetailPage`, `LaporanPembelianDetailPage`, `LaporanStokPersediaanPage`, `LaporanPenagihanPiutangPage`, `LaporanHutangPage`, `LaporanArusKasPage`, `LaporanAuditAktivitasPage`).

| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Buka Panel Filter Tanggal | Membuka modal/panel input untuk menyaring rentang data laporan. |
| `F2` | Ekspor ke MS Excel | Mengunduh file laporan dalam format Excel (`.xlsx`) secara otomatis. |
| `Escape` | Kembali ke Menu Laporan | Keluar dari halaman rincian laporan dan kembali ke menu daftar laporan utama. |

---

### 🗄️ H. Modul Master Data (`/master-data`)
| Tombol Shortcut | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `F1` | Fokus Cari Data | Mengarahkan kursor kearah input teks pencarian data master. |
| `F2` | Tambah Data Baru | Membuka modal pilihan picker: "Tambah Pelanggan Baru" atau "Tambah Supplier Baru". |
| `F3` / `F4` | Edit Data Terpilih | Membuka modal form edit data pelanggan atau supplier dari baris tabel yang aktif. |
| `Delete` | Hapus Data Master | Menghapus (soft-delete/non-aktifkan) data pelanggan/supplier terpilih dari database. |
| `ArrowLeft` / `ArrowRight` | Pindah Tab / Pilihan | Bergeser fokus antara Tab Pelanggan ➡️ Tab Supplier ➡️ Tombol Tambah Baru. |
| `ArrowUp` / `ArrowDown` | Navigasi Baris Data | Menggeser baris terpilih pada tabel pelanggan/supplier. |
| `PageUp` / `PageDown` | Pindah Halaman Data | Berpindah halaman pagination data master aktif. |

---

## ⌨️ 4. Alur Workflow dari Login Hingga Keluar dari Aplikasi

Sistem MMB dirancang dengan alur kerja yang saling terintegrasi erat antar modul, didukung penuh oleh pengoperasian cepat berbasis keyboard (tanpa mouse). Berikut adalah panduan operasional langkah-demi-langkah, tombol-demi-tombol, serta perilaku popup/modal untuk setiap menu dan sub-menu dalam sistem:

### 🔑 A. Modul Login (`/login`) ➡️ Pintu Masuk
*   **Alur Operasional**:
    1. Pengguna membuka aplikasi di browser. Kursor otomatis diarahkan ke kolom input **Email**.
    2. Pengguna mengetik alamat email (misal: `admin@mmb.com`) -> tekan `Enter`.
    3. Fokus kursor otomatis berpindah ke kolom input **Password**.
    4. Pengguna mengetik password -> tekan `Enter` (atau klik tombol **Login**).
    5. **Validasi & Error Handling**:
        *   Jika data salah: Sistem memunculkan notifikasi merah di bagian atas form login: *"Email atau Password Salah"*. Fokus kursor otomatis dikembalikan ke kolom Password, dan teks password sebelumnya langsung diseleksi agar siap ditimpa.
        *   Jika data benar: State global autentikasi diaktifkan, token JWT disimpan ke browser storage, dan pengguna langsung dialihkan ke halaman **Dashboard** (`/dashboard`).

---

### 🛒 B. Modul Pembelian (`/pembelian`) ➡️ Pengadaan Barang (Restock)

#### 1. Buat Order PO / Step 1 (`/pembelian/order`)
*   **Alur Operasional**:
    1. Dari Dashboard, pengguna menekan tombol shortcut `2` (atau klik menu sidebar) untuk masuk ke Modul Pembelian, lalu pilih sub-menu **Buat Order PO**.
    2. Sistem otomatis generate **Nomor PO** baru (misal: `PO-20260702-001`) dan mengunci kolom tersebut (read-only).
    3. Fokus kursor default langsung berada pada kolom **Tanggal Order** (terisi default tanggal hari ini).
    4. Pengguna menekan `Enter` untuk konfirmasi tanggal. Fokus kursor berpindah ke kolom **Supplier**.
    5. Pengguna mengetik nama/kode supplier (misal: *"Maju Jaya"*) -> tekan `Enter`.
    6. **Perilaku Popup**: Muncul modal dialog pencarian supplier.
        *   Gunakan tombol `ArrowUp` / `ArrowDown` untuk memilih supplier yang sesuai dari tabel hasil pencarian.
        *   Tekan `Enter` untuk mengonfirmasi pilihan. Modal otomatis tertutup, dan data Supplier terisi lengkap.
    7. Fokus kursor berpindah ke kolom **Terms** (Termin Jatuh Tempo).
    8. Pengguna menekan `ArrowLeft` / `ArrowRight` (atau pintasan angka `1`=Tunai, `2`=1 Bulan, `3`=2 Bulan, `4`=3 Bulan) untuk memilih jenis termin pembayaran -> tekan `Enter` untuk konfirmasi.
    9. Sistem memproses data awal dan mengalihkan layar ke halaman **Input Item PO** (`/pembelian/input`).

#### 2. Input Item PO / Step 2 (`/pembelian/input` & `/pembelian/edit-order`)
*   **Alur Operasional**:
    1. Di bagian atas layar menampilkan informasi ringkas Supplier (dapat disembunyikan/ditampilkan dengan menekan `F3`).
    2. Pengguna menekan `F2` -> kursor fokus langsung melompat ke baris input barang baru di bagian paling bawah tabel PO.
    3. Pengguna mengetik nama/kode barang (misal: *"Besi Beton"*) -> tekan `Enter`.
    4. **Perilaku Popup**: Muncul modal popup daftar barang hasil pencarian yang aktif.
        *   Gunakan tombol `ArrowUp` / `ArrowDown` untuk menyorot barang yang ingin dipilih.
        *   Tekan `Enter` untuk mengonfirmasi. Data barang, satuan, dan kode produk langsung terisi ke baris input.
    5. Kursor otomatis berpindah ke kolom **Qty** (Kuantitas). Pengguna menginput nominal jumlah pesanan -> tekan `Enter`.
    6. Kursor berpindah ke kolom **Harga Beli**.
        *   *Pintasan Histori*: Sebelum mengisi harga, pengguna dapat menekan `F4` untuk membuka popover riwayat harga beli barang tersebut dari supplier terkait pada transaksi-transaksi sebelumnya. Tekan `Escape` untuk menutup popover riwayat harga beli tersebut.
    7. Pengguna mengetik harga beli -> tekan `Enter`.
    8. **Konfirmasi Baris**: Sistem secara otomatis memasukkan item tersebut ke dalam tabel PO di atasnya. Nilai Subtotal item dan Grand Total PO diperbarui secara real-time.
    9. Sistem otomatis membuat baris kosong baru di bagian paling bawah tabel PO, dan mengembalikan fokus kursor ke input nama barang baru agar pengguna dapat langsung mengetik barang berikutnya.
    10. **Penghapusan Item**: Jika ada salah input barang, pengguna menekan tombol `ArrowUp` / `ArrowDown` untuk menyorot baris barang yang salah di dalam tabel -> tekan tombol `Delete` -> muncul dialog konfirmasi -> tekan `Enter` untuk menghapus item. Nilai total PO otomatis ter-kalkulasi ulang.
    11. **Finalisasi PO**: Pengguna menekan `F10` untuk memproses penyimpanan. Muncul modal konfirmasi: *"Apakah Anda yakin ingin menyelesaikan PO ini?"*.
        *   Tekan `Y` -> Sistem menyimpan data PO dengan status `completed` ke database dan kembali ke menu utama pembelian.
        *   Tekan `Escape` -> Menutup modal konfirmasi dan kembali ke lembar edit input item.

#### 3. Order Tertunda/Draft PO (`/pembelian/draft`)
*   **Alur Operasional**:
    1. Pengguna membuka sub-menu **Draft PO**. Tampil daftar seluruh transaksi pembelian yang statusnya masih `draft`.
    2. Gunakan `ArrowUp` / `ArrowDown` untuk menelusuri daftar draf PO -> tekan `Enter` pada baris draf terpilih untuk membukanya kembali ke halaman pengisian `/pembelian/input`.
    3. Atau tekan tombol `Delete` pada baris terpilih untuk menghapus draf PO tersebut secara permanen dari sistem.

#### 4. Receiving Pembelian (`/pembelian/receiving`)
*   **Alur Operasional**:
    1. Pengguna (Staff Gudang) masuk ke menu **Receiving Pembelian**.
    2. **Perilaku Popup Filter**: Sistem tidak langsung menampilkan daftar PO. Secara otomatis muncul modal popup **Filter Penerimaan Barang** untuk mencari pesanan pembelian yang siap diterima.
        *   Kursor otomatis fokus pada input **Tanggal Awal**. Pengguna mengetik tanggal awal pencarian -> tekan `Enter`.
        *   Fokus kursor berpindah ke input **Tanggal Akhir**. Pengguna mengetik tanggal akhir pencarian -> tekan `Enter`.
        *   Fokus kursor berpindah ke input **Nama Supplier (Opsional)**.
            *   *Jika memfilter per supplier*: Pengguna mengetik nama supplier -> tekan `Enter` -> muncul popup daftar supplier -> gunakan `ArrowUp` / `ArrowDown` -> tekan `Enter` untuk memilih.
            *   *Jika dari semua supplier*: Biarkan kosong -> tekan `Enter` untuk melewati.
        *   Fokus kursor berpindah ke tombol **Cari / Proses**. Pengguna menekan `Enter` (atau klik tombol tersebut).
    3. Setelah dikonfirmasi, modal filter tertutup dan sistem menampilkan daftar seluruh PO berstatus `completed` (siap diterima) yang cocok dengan filter di tabel utama.
    4. Pengguna menekan `ArrowUp` / `ArrowDown` untuk menyorot nomor PO yang sesuai -> tekan `Enter` untuk membuka lembar checklist penerimaan barang.
    5. Pada tabel item barang PO: Gunakan `ArrowUp` / `ArrowDown` untuk memilih baris produk.
    6. Tekan tombol `Space` atau `Enter` pada checkbox untuk menandai barang tersebut telah diterima secara fisik di gudang.
    7. Setelah semua item dipastikan ter-checklist lengkap sesuai fisik, klik tombol **Finalisasi Terima** (atau tekan `F10`).
    8. Sistem memproses database: Stok fisik barang di gudang bertambah secara real-time, dan status PO diubah dari `completed` menjadi `received`.

#### 5. History Pembelian (`/pembelian/history-pembelian`)
*   **Alur Operasional**:
    1. Pengguna membuka menu **History Pembelian**.
    2. **Perilaku Popup Filter**: Sistem langsung memunculkan modal popup **Filter Histori Pembelian** sebelum menampilkan data.
        *   Kursor fokus pada input **Tanggal Awal** -> ketik tanggal -> tekan `Enter`.
        *   Kursor fokus pada input **Tanggal Akhir** -> ketik tanggal -> tekan `Enter`.
        *   Kursor fokus pada input **Nama Supplier (Opsional)** -> ketik nama supplier -> tekan `Enter` -> pilih dari popup supplier menggunakan `ArrowUp` / `ArrowDown` dan `Enter` (atau biarkan kosong dan langsung tekan `Enter`).
        *   Fokus berpindah ke tombol **Tampilkan**. Tekan `Enter` untuk memproses.
    3. Tabel utama menampilkan seluruh daftar nota PO hasil filter yang statusnya sudah selesai/diterima (`received`).
    4. Pengguna menggunakan `ArrowUp` / `ArrowDown` untuk menyorot nota PO -> tekan `Enter` untuk memunculkan modal popup berisi detail item barang dan harga riil yang dibeli pada nota tersebut.

---

### 💰 C. Modul Penjualan (`/penjualan`) ➡️ Penjualan Barang (POS / Kasir)

#### 1. Buat Order SO / Step 1 (`/penjualan/buat`)
*   **Alur Operasional**:
    1. Dari Dashboard, pengguna menekan shortcut `1` (atau klik menu sidebar) untuk masuk ke Modul Penjualan, lalu pilih **Buat Order SO**.
    2. Sistem otomatis generate **Nomor SO** baru (misal: `SO-20260702-005`) dan mengunci kolom tersebut.
    3. Kursor default langsung berada pada kolom **Tanggal SO**. Tekan `Enter` untuk konfirmasi tanggal.
    4. Kursor berpindah ke kolom **Customer**. Pengguna mengetik nama/kode pelanggan (misal: *"Budi"*) -> tekan `Enter`.
    5. **Perilaku Popup**: Muncul modal dialog pencarian customer.
        *   Gunakan tombol `ArrowUp` / `ArrowDown` untuk menyorot nama customer -> tekan `Enter` untuk memilih.
        *   *Tambah Customer Cepat (F2)*: Jika nama customer tidak ditemukan, pengguna menekan `F2` untuk membuka modal cepat "Tambah Customer Baru". Isi form singkat (Nama, Alamat, No Telp, Limit Kredit) -> klik Simpan -> nama customer otomatis terisi di form SO.
    6. **Validasi Limit Kredit**: Sistem mendeteksi total saldo piutang aktif customer. Jika nominal piutang mereka ditambah transaksi saat ini melampaui batas kredit (Limit Kredit), sistem memunculkan modal peringatan berwarna merah: *"Limit Kredit Terlampaui!"*. Transaksi tertahan dan membutuhkan persetujuan/override password administrator untuk dapat dilanjutkan.
    7. Kursor berpindah ke opsi **Pengiriman** (Diantar / Diambil). Gunakan tombol `ArrowLeft` / `ArrowRight` untuk memilih.
    8. Kursor berpindah ke opsi **Jatuh Tempo** (Termin Kredit / Tunai) -> tekan `Enter` untuk konfirmasi.
    9. Pengguna menekan `Y` -> sistem memvalidasi data dan mengalihkan halaman ke **Input Item SO** (`/penjualan/input`).

#### 2. Input Item SO / Step 2 (`/penjualan/input` & `/penjualan/edit`)
*   **Alur Operasional**:
    1. Pengguna menekan `F2` -> kursor fokus langsung melompat ke kolom cari barang di baris terbawah tabel transaksi.
    2. Pengguna mengetik nama/kode barang -> tekan `Enter`.
    3. **Perilaku Popup**: Muncul modal daftar barang aktif lengkap dengan informasi sisa stok gudang.
        *   Gunakan tombol `ArrowUp` / `ArrowDown` untuk memilih barang -> tekan `Enter` untuk konfirmasi.
    4. Kursor berpindah ke kolom **Qty**. Masukkan jumlah barang yang ingin dijual -> tekan `Enter`.
        *   **Validasi Stok Gudang**: Jika Qty yang diinput melebihi stok fisik barang di database, muncul popup peringatan: *"Stok Tidak Mencukupi!"*. Kursor dikembalikan ke kolom Qty agar pengguna memasukkan jumlah yang valid.
    5. Kursor berpindah ke kolom **Harga Jual** (harga default terisi otomatis berdasarkan daftar harga barang). Pengguna dapat mengubah harga jual jika disetujui -> tekan `Enter`.
    6. **Konfirmasi Baris**: Item masuk ke tabel utama belanjaan. Subtotal dan total nota terhitung otomatis. Kursor dikembalikan ke baris tambah barang baru.
    7. **Penyesuaian Nota (F1)**: Jika ingin menambahkan biaya kirim atau diskon khusus, pengguna menekan `F1`. Kursor fokus berpindah ke kolom *Adjustment* di footer -> ketik keterangan (misal: *"Potongan Diskon"*) -> tekan `Enter` -> ketik nominalnya (gunakan tanda minus `-` untuk diskon, atau plus `+` untuk biaya tambahan) -> tekan `Enter`.
    8. **Catatan Pengiriman (F10)**: Pengguna menekan `F10` untuk langsung fokus ke input *Catatan* -> ketik rincian pengiriman (misal: *"Kirim ke toko belakang"*) -> tekan `Enter`.
    9. **Finalisasi Transaksi**: Pengguna menekan `Ctrl + S`. Muncul modal konfirmasi pembayaran: *"Apakah Anda yakin ingin menyelesaikan transaksi ini?"*.
        *   Tekan `Enter` untuk konfirmasi: Transaksi disimpan, status SO berubah menjadi `completed`, stok gudang berkurang otomatis.
        *   Sistem memunculkan modal dialog **Cetak Nota** (Pilihan format Nota Kasir Thermal / Kertas A4). Gunakan `ArrowLeft` / `ArrowRight` untuk memilih -> tekan `Enter` untuk print. Tekan `Escape` jika tidak ingin mencetak nota fisik.

#### 3. Edit Penjualan (`/penjualan/edit`)
*   **Alur Operasional**:
    1. Pengguna masuk ke menu **Edit Penjualan**. Ketik nomor nota SO yang ingin diedit -> tekan `Enter`.
    2. Data SO dimuat kembali ke lembar input. Pengguna dapat mengubah kuantitas barang, menghapus baris item (`Delete`), menambah barang baru (`F2`), atau mengubah informasi pengiriman.
    3. Tekan `Ctrl + S` untuk menyimpan hasil pengeditan nota. Stok gudang akan disesuaikan otomatis dengan selisih kuantitas baru.

#### 4. Daftar Penjualan (`/penjualan/list`)
*   **Alur Operasional**:
    1. Pengguna masuk ke menu **Daftar Penjualan**.
    2. **Perilaku Popup Filter**: Sistem otomatis memunculkan modal popup **Filter Daftar Penjualan**.
        *   Kursor fokus ke kolom **Tanggal Awal** -> input tanggal -> tekan `Enter`.
        *   Kursor fokus ke kolom **Tanggal Akhir** -> input tanggal -> tekan `Enter`.
        *   Kursor fokus ke kolom **Nama Customer (Opsional)** -> ketik nama -> tekan `Enter` -> pilih dari popup customer menggunakan `ArrowUp` / `ArrowDown` dan `Enter` (atau biarkan kosong dan langsung tekan `Enter` untuk memuat semua customer).
        *   Tekan `Enter` pada tombol **Cari**.
    3. Tabel menampilkan daftar seluruh transaksi penjualan yang telah selesai sesuai filter.
    4. Gunakan `ArrowUp` / `ArrowDown` untuk menyorot nota -> tekan `Enter` untuk membuka modal popover berisi detail rincian barang nota tersebut.
    5. Pengguna dapat memilih opsi cetak ulang nota, atau menekan tombol `Delete` untuk melakukan pembatalan transaksi (stok barang yang terjual akan otomatis dikembalikan ke gudang setelah konfirmasi).

---

### 💳 D. Modul Penagihan (Accounts Receivable) ➡️ Piutang & Setoran

#### 1. Piutang Aktif (`/penagihan/piutang`)
*   **Alur Operasional**:
    1. Dari Dashboard, pengguna menekan shortcut `3` (atau klik menu sidebar) untuk membuka modul Penagihan, lalu pilih **Piutang Aktif**.
    2. Tampil daftar nama-nama customer yang memiliki tagihan belum lunas.
    3. Pengguna menekan `F1` -> kursor fokus ke input pencarian. Ketik nama customer -> tekan `Enter`.
    4. Gunakan `ArrowUp` / `ArrowDown` untuk memilih nama customer -> tekan `Enter`.
    5. **Perilaku Expand**: Daftar nota penjualan kredit milik customer tersebut akan terbuka (*expand*) tepat di bawah baris nama mereka.
    6. Pilih nota yang ingin dibayar -> tekan `F4` untuk mengintip isi barang nota tersebut jika diperlukan.
    7. Tekan `F10` untuk memproses setoran uang tagihan.
    8. **Perilaku Popup**: Muncul modal dialog **Setoran Pembayaran Piutang**.
        *   Kursor fokus langsung pada kolom **Jumlah Bayar**. Ketik nominal uang setoran (misal: *"3000000"*) -> tekan `Enter`.
        *   Kursor berpindah ke kolom **Catatan**. Ketik keterangan pembayaran (misal: *"Bayar angsuran ke-2 via transfer Mandiri"*) -> tekan `Enter`.
        *   Tekan/klik tombol **Simpan**.
    9. Sistem menyimpan data pembayaran: Nominal piutang customer berkurang seketika. Jika pembayaran melunasi seluruh sisa tagihan nota, status nota tersebut otomatis berubah menjadi Lunas.

#### 2. Manajemen Nota (`/penagihan/nota`)
*   **Alur Operasional**:
    1. Pengguna membuka menu **Manajemen Nota** untuk mengontrol fisik invoice (Nota Merah, Putih, Kuning).
    2. Gunakan `ArrowUp` / `ArrowDown` untuk memilih baris nomor nota penjualan.
    3. Tekan `Enter` untuk mengaktifkan **Mode Edit Checklist**.
    4. Gunakan tombol `ArrowLeft` / `ArrowRight` untuk menggeser kursor pilihan aktif antara kolom **Nota Merah** ➡️ **Nota Putih** ➡️ **Nota Kuning**.
    5. Tekan tombol `Space` atau `Enter` untuk memberi tanda centang (sudah diserahkan/kembali) atau menghilangkan centang pada dokumen nota fisik tersebut.
    6. Tekan tombol `Escape` untuk mengunci/menyimpan status checklist dan keluar dari mode edit nota.
    7. *Sinkronisasi*: Tekan `F4` untuk memperbarui status checklist dokumen fisik secara otomatis berdasarkan status pembayaran invoice di database.

#### 3. History Pembayaran & Pembatalan (`/penagihan/tunai`)
*   **Alur Operasional**:
    1. Pengguna membuka menu **History Pembayaran**.
    2. **Perilaku Popup Filter**: Sistem otomatis memunculkan modal popup **Filter Histori Kas & Penagihan**.
        *   Input **Tanggal Awal** -> tekan `Enter`.
        *   Input **Tanggal Akhir** -> tekan `Enter`.
        *   Input **Nama Customer (Opsional)** -> ketik nama -> tekan `Enter` -> pilih customer dari popup (atau biarkan kosong dan tekan `Enter`).
        *   Tekan `Enter` pada tombol **Tampilkan**.
    3. Tabel menampilkan daftar riwayat setoran pelunasan piutang maupun penjualan tunai langsung sesuai filter tanggal dan nama.
    4. Sorot baris transaksi -> tekan `Enter` untuk membuka cetak ulang kwitansi bukti pembayaran.
    5. **Pembatalan Setoran (Rollback)**: Jika terjadi kesalahan input nominal setoran, sorot baris setoran -> tekan tombol `Delete`.
    6. Muncul modal konfirmasi pembatalan. Klik "Ya" -> Sistem menghapus log setoran tersebut, nominal piutang customer akan bertambah kembali secara otomatis, dan status invoice dikembalikan menjadi belum lunas.

---

### 📦 E. Modul Gudang (Inventory) ➡️ Stok & Informasi Harga

#### 1. Informasi Harga (`/gudang/cek-harga`)
*   **Alur Operasional**:
    1. Dari Dashboard, pengguna menekan shortcut `4` (atau klik menu sidebar) untuk masuk ke Modul Gudang, lalu pilih **Informasi Harga**.
    2. Tekan `F1` -> kursor fokus ke input **Nama/Kode Barang** -> ketik nama barang (misal: *"Semen"*) -> tekan `Enter`.
    3. **Perilaku Popup**: Muncul modal pencarian produk.
        *   Gunakan `ArrowUp` / `ArrowDown` untuk memilih barang -> tekan `Enter`.
        *   Sistem memuat data barang: Deskripsi, sisa stok gudang, harga jual standar, dan harga beli terakhir langsung tampil di panel kiri.
    4. Tekan `F2` -> kursor fokus ke input **Nama Pelanggan** -> ketik nama customer (misal: *"Toko Berkah"*) -> tekan `Enter`.
    5. **Perilaku Popup**: Muncul modal pencarian customer.
        *   Gunakan `ArrowUp` / `ArrowDown` untuk memilih customer -> tekan `Enter`.
        *   Sistem secara otomatis memproses database dan menampilkan histori penjualan barang tersebut khusus untuk customer terpilih di panel kanan (termasuk tanggal transaksi terakhir, jumlah qty yang pernah dibeli, dan harga jual terakhir yang diberikan).
    6. Tekan `Escape` untuk membersihkan pencarian dan fokus kembali ke input barang.

#### 2. Kelola Produk / Katalog (`/gudang/katalog`)
*   **Alur Operasional**:
    1. Menampilkan daftar katalog produk aktif.
    2. **Tambah Barang Baru**: Tekan `F2` -> membuka modal form tambah produk. Isi Kode, Nama, Satuan, Deskripsi, serta unggah file gambar produk (maksimal 3 foto) -> klik Simpan.
    3. **Edit Produk**: Gunakan `ArrowUp` / `ArrowDown` untuk memilih produk pada tabel -> tekan `F4` atau `Enter`.
    4. **Perilaku Popup**: Muncul modal pilihan tipe pengeditan:
        *   *Edit Penuh*: Membuka formulir lengkap spesifikasi barang beserta detail stok & harga beli per supplier.
        *   *Informasi Produk*: Membuka formulir untuk mengubah nama, deskripsi, satuan, atau galeri gambar produk saja.
        *   *Stok/Harga Saja*: Membuka tabel relasi supplier untuk memperbarui jumlah stok dan harga beli per supplier secara dinamis.
    5. Pilih opsi edit -> lakukan perubahan -> tekan `Y` (bila kursor sedang tidak berada di input teks) atau klik tombol Simpan untuk mengirim data ke database.
    6. **Arsip Produk**: Sorot produk -> tekan tombol `Delete` -> muncul konfirmasi arsipkan -> klik Ya. Status produk dinonaktifkan (`is_archived = true`).

#### 3. Arsip Produk (`/gudang/archive`)
*   **Alur Operasional**:
    1. Menampilkan produk yang terarsip. Gunakan `ArrowUp` / `ArrowDown` untuk menyorot barang.
    2. Tekan `F3` atau `Enter` -> muncul dialog konfirmasi restore barang -> klik Ya. Barang kembali aktif di katalog produk.

---

### 🗄️ F. Modul Master Data (`/master-data`) ➡️ Manajemen Entitas

*   **Alur Operasional**:
    1. Dari Dashboard, pengguna menekan shortcut `5` (atau klik menu sidebar) untuk membuka modul Master Data.
    2. Sistem menampilkan dua tab utama: **Pelanggan** (default aktif) dan **Supplier**.
    3. Pengguna menekan tombol `ArrowLeft` / `ArrowRight` untuk berpindah antar tab tersebut.
    4. Tekan `F1` -> kursor fokus ke input pencarian data master -> ketik nama -> data di tabel ter-filter otomatis.
    5. **Tambah Data**: Tekan `F2` -> membuka modal form tambah data sesuai tab yang aktif (Isi Kode, Nama, Alamat, No Telp, Limit Kredit/Term Pembayaran) -> klik Simpan.
    6. **Edit Data**: Pilih baris data dengan `ArrowUp` / `ArrowDown` -> tekan `F3` atau `F4` -> membuka modal form edit -> lakukan perubahan -> klik Simpan.
    7. **Hapus Data**: Pilih baris data -> tekan tombol `Delete` -> konfirmasi hapus -> klik Ya. Data dinonaktifkan dari pilihan transaksi.

---

### 🔄 G. Modul History (`/pembelian/history`) ➡️ Audit Log Stok

*   **Alur Operasional**:
    1. Dari Dashboard, pengguna menekan shortcut `6` (atau klik menu sidebar) untuk masuk ke Modul History.
    2. Terdapat dua tab utama: **Riwayat Per Instansi** dan **Riwayat Per Barang**. Tekan `ArrowLeft` / `ArrowRight` untuk berpindah tab.
    3. **Tab Riwayat Per Barang (Audit Log)**:
        *   Ketik nama/kode produk pada input pencarian -> tekan `Enter`.
        *   Tabel menampilkan log detail mutasi stok barang tersebut secara kronologis (dari awal input hingga transaksi terbaru).
        *   Setiap baris log mencantumkan: Tanggal/Waktu, Tipe Transaksi (SO/PO/Adjustment Stok Manual), Nomor Nota referensi, Operator pencatat, Qty Awal, Qty Mutasi, dan Qty Akhir setelah transaksi. Ini digunakan untuk melacak selisih stok fisik.

---

### 📊 H. Modul Laporan (`/laporan`) ➡️ Rekapitulasi & Ekspor

*   **Alur Operasional**:
    1. Pengguna mengklik menu sidebar Laporan, lalu memilih salah satu sub-menu laporan (misal: `/laporan/penjualan-detail` atau `/laporan/penagihan-piutang`).
    2. **Perilaku Popup Filter**: Saat halaman rincian laporan terbuka, sistem secara otomatis langsung memunculkan modal popup **Filter Rentang Laporan**.
        *   Kursor fokus ke kolom **Tanggal Awal** -> isi tanggal -> tekan `Enter`.
        *   Kursor fokus ke kolom **Tanggal Akhir** -> isi tanggal -> tekan `Enter`.
        *   *(Tergantung jenis laporan)* Fokus berpindah ke opsi filter tambahan (misal: Nama Supplier, Nama Customer, atau Kategori Barang) -> isi/pilih filter tersebut -> tekan `Enter`.
        *   Fokus kursor berpindah ke tombol **Tampilkan Laporan** -> tekan `Enter`.
    3. Modal tertutup, dan data rekapitulasi laporan langsung dikalkulasi dan disajikan di tabel utama.
    4. **Mengubah Filter Tanggal Kembali (F1)**: Jika ingin mengubah filter setelah laporan muncul, pengguna dapat menekan `F1` untuk membuka kembali modal popup filter tersebut tanpa memuat ulang halaman.
    5. **Ekspor Data (F2)**: Pengguna menekan `F2` -> sistem otomatis meng-generate dan mengunduh data laporan tersebut ke dalam format file spreadsheet Excel (`.xlsx`) secara instan.
    6. Tekan `Escape` -> keluar dari halaman laporan detail dan kembali ke daftar menu laporan utama.

---

### 🖥️ I. Modul Dashboard (`/dashboard`) ➡️ Pusat Pemantauan

*   **Alur Operasional**:
    1. Setelah transaksi, pengguna kembali ke halaman utama `/dashboard`.
    2. Dashboard menyajikan rangkuman KPI keuangan real-time (Total Omzet, Total Laba Kotor, Nilai Aset Stok Gudang, Total Piutang Aktif) dan grafik garis tren penjualan.
    3. **Filter Periode Grafik Instan (Shortcut Keyboard)**:
        *   Tekan `F1` -> Mengubah filter grafik tren menjadi periode **30 Hari Terakhir**.
        *   Tekan `F2` -> Mengubah filter grafik tren menjadi periode **6 Bulan Terakhir**.
        *   Tekan `F3` -> Mengubah filter grafik tren menjadi periode **1 Tahun Terakhir**.
        *   Tekan `F5` -> Memaksa sistem melakukan refresh / penarikan ulang data KPI dan grafik langsung dari database.
        *   Tekan `Escape` -> Mereset filter periode kembali ke setelan bawaan (30 Hari Terakhir).

---

### 🚪 J. Keluar dari Aplikasi (Logout)

*   **Alur Operasional**:
    1. Pengguna mengklik tombol **Keluar** (dengan ikon pintu keluar `pi-sign-out`) di bagian bawah sidebar navigasi kiri (`MainLayout.vue`).
    2. Sistem menghapus token JWT dan session autentikasi di browser local/session storage melalui store Pinia (`authStore.logout()`).
    3. Setelah data dibersihkan, pengguna dialihkan otomatis ke halaman **Login** (`/login`).
    4. Jika pengguna menekan tombol *Back* di browser, Navigation Guard (`router.beforeEach`) mendeteksi ketiadaan session aktif dan langsung mengalihkan kembali ke halaman `/login`, mencegah akses tidak sah.

---

