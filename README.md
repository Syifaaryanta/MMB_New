# 📦 MMB Website — Sistem Manajemen Penjualan & Pembelian

Sistem manajemen bisnis berbasis web untuk **PT Maju Mulia Bersama** yang mencakup manajemen Penjualan (SO), Pembelian (PO), Inventory/Gudang, Penagihan/Piutang, Pelunasan Hutang Supplier, dan Laporan Keuangan secara real-time.

---

## 🏗️ Arsitektur Sistem

```
MMB_Website/
├── backend/          # REST API Node.js + Express + Prisma ORM
└── frontend/         # Single Page App React (Vite) + Tailwind CSS v4
```

Sistem ini menggunakan arsitektur **Client-Server** terpisah (decoupled):
- **Backend** menyajikan REST API via port `3001`
- **Frontend** dikonsumsi via port `5173` (development), dikonfigurasi dengan proxy ke `/api`
- Komunikasi dilindungi dengan **JWT Bearer Token** per request

---

## ✨ Fitur Utama

### 🛒 Penjualan (Sales Order / SO)
- Buat draft Sales Order dengan pencarian pelanggan dan produk real-time
- Input item SO dengan harga dan jumlah (mendukung satuan desimal)
- Konfirmasi & cetak faktur (nota merah, putih, kuning)
- Edit SO yang masih berstatus draft
- Daftar semua penjualan dengan filter status, tanggal, dan pelanggan
- Retur Penjualan dengan pilihan kompensasi: potong piutang / tunai

### 🏪 Pembelian (Purchase Order / PO)
- Buat draft PO dari supplier terdaftar
- Input item PO dengan harga beli per supplier
- Proses penerimaan barang (*Receiving*) yang otomatis menambah stok gudang
- Edit PO sebelum dikonfirmasi
- Retur Pembelian dengan pilihan kompensasi: potong hutang / tunai

### 🏭 Gudang (Inventory)
- Daftar inventori lengkap dengan stok real-time
- Kelola produk: tambah, edit, arsip/aktifkan
- Detail produk beserta histori harga per supplier
- Informasi Harga Beli per Supplier
- Arsip produk (soft-delete)
- Penyesuaian Stok (*Stock Adjustment*) dengan catatan alasan

### 💰 Penagihan & Piutang
- **Piutang Aktif**: daftar semua faktur yang belum lunas dengan aging & nilai sisa
- Proses pembayaran piutang: FIFO otomatis atau manual pilih faktur
- **Pelunasan Supplier**: bayar hutang ke supplier
- **Manajemen Nota**: cetak ulang dan tandai nota yang tercetak
- **Histori Pembayaran**: riwayat semua transaksi penagihan masuk
- **Histori Pelunasan**: riwayat semua pembayaran ke supplier

### 📊 Laporan
| Laporan | Keterangan |
|---|---|
| Ringkasan Dashboard | KPI utama: total penjualan, pembelian, piutang, stok |
| Laporan Penjualan | Detail transaksi SO per periode dengan filter |
| Laporan Pembelian | Detail transaksi PO per periode |
| Laporan Penagihan | Rekap pembayaran piutang masuk |
| Laporan Stok | Status stok produk saat ini |
| Laporan Hutang | Posisi hutang ke supplier |
| Laporan Arus Kas | Ringkasan kas masuk & keluar |
| Laporan Audit | Log aktivitas sistem |

### 🗂️ Master Data
- Kelola **Pelanggan**: tambah, edit, atur limit kredit & jatuh tempo
- Kelola **Supplier**: tambah, edit, atur jatuh tempo bayar
- Kelola **Produk** & harga beli per supplier

### 👑 Admin
- Manajemen pengguna (user): tambah, edit, nonaktifkan
- Pengaturan role akses

---

## 🔐 Sistem Role & Akses

| Role | Keterangan |
|---|---|
| `super_admin` | Akses penuh ke semua fitur dan pengaturan |
| `admin` | Kelola data master, laporan, dan user |
| `staff_kantor` | Penagihan, penjualan, laporan |
| `staff_gudang` | Kelola stok, input barang masuk |
| `sales` | Input SO, lihat daftar penjualan |

Autentikasi menggunakan **JWT (JSON Web Token)** dengan masa berlaku yang dapat dikonfigurasi via `JWT_EXPIRES_IN`.

---

## 🗄️ Database Schema (MySQL via Prisma ORM)

Database menggunakan **MySQL** yang diakses dengan **Prisma ORM**. Berikut entitas utama:

| Model | Tabel | Keterangan |
|---|---|---|
| `Profile` | `profiles` | User/akun sistem dengan role |
| `Product` | `products` | Produk gudang dengan stok desimal |
| `ProductPrice` | `product_prices` | Harga beli produk per supplier |
| `Supplier` | `suppliers` | Data pemasok |
| `Customer` | `customers` | Data pelanggan dengan limit kredit & saldo piutang |
| `Purchase` | `purchases` | Header Purchase Order |
| `PurchaseItem` | `purchase_items` | Detail item PO |
| `Sale` | `sales` | Header Sales Order / Faktur |
| `SaleItem` | `sale_items` | Detail item SO |
| `SalesPayment` | `sales_payments` | Pembayaran piutang masuk |
| `SupplierPayment` | `supplier_payments` | Pembayaran hutang keluar |
| `BillingSession` | `billing_sessions` | Sesi pelunasan (customer/supplier) |
| `BillingAllocation` | `billing_allocations` | Alokasi pembayaran ke faktur |
| `SaleReturn` | `sale_returns` | Header retur penjualan |
| `SaleReturnItem` | `sale_return_items` | Detail item retur jual |
| `PurchaseReturn` | `purchase_returns` | Header retur pembelian |
| `PurchaseReturnItem` | `purchase_return_items` | Detail item retur beli |
| `StockAdjustment` | `stock_adjustments` | Histori penyesuaian stok manual |

---

## 🚀 Cara Menjalankan (Development)

### Prasyarat
- **Node.js** v18 atau lebih baru
- **MySQL** v8.0 atau lebih baru (aktif berjalan)
- **npm** v9+

### 1. Clone & Setup Database

```bash
git clone <repo-url>
cd MMB_Website
```

Buat database MySQL:
```sql
CREATE DATABASE mmb_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
```

Edit file `.env` sesuai konfigurasi lokal Anda (lihat bagian [Environment Variables](#-environment-variables) di bawah).

```bash
npm install
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema ke database
npm run db:seed        # (Opsional) Isi data awal
npm run dev            # Jalankan server development
```

Server backend akan berjalan di: `http://localhost:3001`

### 3. Setup Frontend

```bash
cd ../frontend
npm install
npm run dev
```

Aplikasi frontend akan berjalan di: `http://localhost:5173`

> **Catatan:** Vite sudah dikonfigurasi dengan proxy sehingga semua request ke `/api/*` secara otomatis diteruskan ke backend di port `3001`.

---

## ⚙️ Environment Variables

Buat file `.env` di dalam folder `backend/` berdasarkan `.env.example`:

```env
# Server
PORT=3001
NODE_ENV=development

# Database MySQL
DATABASE_URL="mysql://root:password@localhost:3306/mmb_db"

# JWT Authentication
JWT_SECRET=mmb_super_secret_key_2026_change_in_production
JWT_EXPIRES_IN=7d

# Cloudinary (Upload foto produk)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL (untuk CORS)
FRONTEND_URL=http://localhost:5173
```

> ⚠️ **Jangan commit file `.env`** ke repository. File ini sudah ada dalam `.gitignore`.

---

## 📡 API Endpoints

Base URL: `http://localhost:3001/api`

| Prefix | Router | Keterangan |
|---|---|---|
| `GET /api/health` | — | Health check |
| `/api/auth` | `auth.routes.ts` | Login, register, refresh token |
| `/api/profiles` | `profile.routes.ts` | CRUD user & profil |
| `/api/products` | `product.routes.ts` | CRUD produk & harga |
| `/api/suppliers` | `supplier.routes.ts` | CRUD supplier |
| `/api/customers` | `customer.routes.ts` | CRUD pelanggan |
| `/api/purchases` | `purchase.routes.ts` | CRUD Purchase Order |
| `/api/sales` | `sale.routes.ts` | CRUD Sales Order |
| `/api/payments` | `payment.routes.ts` | Pembayaran piutang & hutang |
| `/api/dashboard` | `dashboard.routes.ts` | KPI & statistik dashboard |
| `/api/laporan` | `laporan.routes.ts` | Export & data laporan |
| `/api/stock-adjustments` | `stockAdjustment.routes.ts` | Penyesuaian stok |
| `/api/sale-returns` | `saleReturn.routes.ts` | Retur penjualan |
| `/api/purchase-returns` | `purchaseReturn.routes.ts` | Retur pembelian |
| `/api/history` | `history.routes.ts` | Histori transaksi |

Semua endpoint (kecuali `/api/auth/login`) memerlukan header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 🗂️ Struktur Folder Lengkap

```
MMB_Website/
│
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Entry point, server setup, route registration
│   │   ├── lib/
│   │   │   └── prisma.ts             # Prisma client singleton
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts    # JWT authenticate & authorize middleware
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema (MySQL)
│   │   │   └── seed.ts               # Data seed awal
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── customer.routes.ts
│   │       ├── dashboard.routes.ts
│   │       ├── history.routes.ts
│   │       ├── laporan.routes.ts
│   │       ├── payment.routes.ts
│   │       ├── product.routes.ts
│   │       ├── profile.routes.ts
│   │       ├── purchase.routes.ts
│   │       ├── purchaseReturn.routes.ts
│   │       ├── sale.routes.ts
│   │       ├── saleReturn.routes.ts
│   │       ├── stockAdjustment.routes.ts
│   │       └── supplier.routes.ts
│   ├── .env                          # (tidak di-commit) Konfigurasi lokal
│   ├── .env.example                  # Template environment variables
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # Root component & routing
│   │   ├── main.tsx                  # React entry point
│   │   ├── index.css                 # Global styles & Tailwind v4 theme
│   │   ├── assets/                   # Static assets
│   │   ├── components/
│   │   │   ├── layout/               # Sidebar, Topbar, Layout wrapper
│   │   │   └── ui/                   # Komponen UI reusable
│   │   ├── lib/
│   │   │   └── utils.ts              # Helper functions (cn, format, dll)
│   │   ├── pages/
│   │   │   ├── auth/                 # Login page
│   │   │   ├── dashboard/            # Dashboard utama
│   │   │   ├── penjualan/            # SO: Buat, Edit, Daftar, Retur
│   │   │   ├── pembelian/            # PO: Buat, Edit, Receiving, Retur
│   │   │   ├── gudang/               # Inventori, Produk, Harga, Arsip
│   │   │   ├── penagihan/            # Piutang, Pelunasan, Nota, Histori
│   │   │   ├── laporan/              # Semua modul laporan
│   │   │   ├── master-data/          # Pelanggan & Supplier
│   │   │   ├── admin/                # Manajemen user
│   │   │   └── history/              # Histori transaksi
│   │   └── stores/
│   │       ├── authStore.ts          # Zustand store: autentikasi & user
│   │       └── useSettingsStore.ts   # Zustand store: pengaturan UI (dark mode, dll)
│   ├── .vscode/
│   │   └── settings.json             # Suppress Tailwind v4 CSS lint warnings
│   ├── vite.config.ts                # Vite + Tailwind plugin + API proxy config
│   ├── index.html
│   ├── package.json
│   └── tsconfig.json
│
├── .vscode/
│   └── settings.json                 # Workspace-level VS Code settings
├── MMB_Website.code-workspace        # VS Code multi-root workspace
└── README.md
```

---

## 🛠️ Tech Stack

### Backend
| Teknologi | Versi | Kegunaan |
|---|---|---|
| Node.js | v18+ | Runtime JavaScript server-side |
| Express.js | ^4.21 | Web framework REST API |
| TypeScript | ^5.8 | Type safety |
| Prisma ORM | ^5.22 | Database access & schema migrations |
| MySQL | 8.0+ | Database utama |
| JSON Web Token | ^9.0 | Autentikasi stateless |
| bcryptjs | ^2.4 | Hashing password |
| Cloudinary | ^2.5 | Upload & hosting foto produk |
| Multer | ^1.4 | Middleware upload file |
| XLSX | ^0.18 | Export laporan ke Excel |
| ts-node-dev | ^2.0 | Hot-reload saat development |

### Frontend
| Teknologi | Versi | Kegunaan |
|---|---|---|
| React | ^19.2 | UI library |
| TypeScript | ~6.0 | Type safety |
| Vite | ^8.1 | Build tool & dev server |
| Tailwind CSS | ^4.3 | Utility-first CSS framework |
| Zustand | ^5.0 | State management global |
| React Router DOM | ^7.18 | Client-side routing |
| Axios | ^1.18 | HTTP client untuk API calls |
| Lucide React | ^1.23 | Icon library |
| Recharts | ^3.9 | Chart & grafik |
| React Hook Form | ^7.80 | Form management |
| Zod | ^4.4 | Schema validation |
| Radix UI | berbagai | Komponen UI headless (Dialog, Select, dll) |
| date-fns | ^4.4 | Manipulasi tanggal |
| XLSX | ^0.18 | Export laporan ke Excel |

---

## 📋 NPM Scripts

### Backend (`cd backend`)
| Command | Keterangan |
|---|---|
| `npm run dev` | Jalankan server development dengan hot-reload |
| `npm run build` | Compile TypeScript ke JavaScript (`dist/`) |
| `npm run start` | Jalankan server dari hasil build |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Sync schema ke database (tanpa migrasi) |
| `npm run db:migrate` | Buat dan jalankan migrasi Prisma |
| `npm run db:seed` | Isi database dengan data awal |
| `npm run db:studio` | Buka Prisma Studio (GUI database) |

### Frontend (`cd frontend`)
| Command | Keterangan |
|---|---|
| `npm run dev` | Jalankan Vite dev server di port 5173 |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview hasil build production |
| `npm run lint` | Jalankan OxLint untuk code linting |

---

## 🔧 Konfigurasi Tambahan

### VS Code
Proyek ini menyertakan konfigurasi VS Code di `.vscode/settings.json` dan `MMB_Website.code-workspace` untuk:
- Menekan peringatan CSS lint `Unknown at rule` yang muncul dari direktif Tailwind CSS v4 (`@theme`, `@custom-variant`, dll.)
- Mengatur `typescript.tsdk` ke `node_modules/typescript/lib`

Buka proyek menggunakan file workspace agar semua pengaturan aktif:
```
File > Open Workspace from File... > MMB_Website.code-workspace
```

### Tailwind CSS v4
Frontend menggunakan **Tailwind CSS v4** yang dikonfigurasi via plugin Vite (`@tailwindcss/vite`). Token desain (warna brand, font) didefinisikan langsung dalam `src/index.css` menggunakan direktif `@theme`.

### Proxy API (Vite)
`vite.config.ts` telah dikonfigurasi agar semua request ke `/api/*` dari frontend diteruskan ke backend:
```ts
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
},
```

---

## 🐛 Troubleshooting

**Q: Error `Cannot connect to database`**
> Pastikan MySQL berjalan dan `DATABASE_URL` di `.env` sudah benar.

**Q: Error `Prisma Client not generated`**
> Jalankan `npm run db:generate` di folder `backend/`.

**Q: Frontend tidak bisa reach API**
> Pastikan backend berjalan di port `3001` dan Vite dev server aktif di port `5173`.

**Q: VS Code menampilkan `Unknown at rule @theme`**
> Buka proyek via `MMB_Website.code-workspace`. Setting `"css.lint.unknownAtRules": "ignore"` sudah terkonfigurasi di workspace dan di `.vscode/settings.json`.

---

## 📄 Lisensi

Sistem ini dikembangkan secara internal untuk PT Maju Mulia Bersama. Hak cipta dilindungi.
