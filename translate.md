# Translation Audit Report

## Summary
Checking all pages for untranslated strings (ID only, not wrapped in `lang === 'en' ?`).

## Files with Issues

### 🔴 High Priority (user-facing toast/error messages)

| File | Line | Issue |
|------|------|-------|
| `ReturPenjualan.tsx` | 443 | `showToast('Transaksi barang ini sudah ditambahkan ke daftar retur.', 'error')` |
| `ReturPenjualan.tsx` | 474 | `showToast('Transaksi berhasil ditambahkan ke daftar retur.', 'success')` |
| `ReturPenjualan.tsx` | 546–547 | `setFormError(...)` + `showToast('Customer belum pernah membeli barang ini.', 'error')` |
| `ReturPenjualan.tsx` | 560 | `showToast('Gagal memuat riwayat penjualan customer.', 'error')` |
| `ReturPenjualan.tsx` | 654 | `showToast('Produk berhasil dihapus dari daftar retur.', 'success')` |
| `ReturPenjualan.tsx` | 679 | `showToast('Masukkan Qty Diretur terlebih dahulu.', 'error')` |
| `PelunasanSupplier.tsx` | 497 | `showToast('Gagal mengambil detail PO', 'error')` |
| `PelunasanSupplier.tsx` | 532 | `showToast('Gagal mengupdate biaya pengiriman', 'error')` |
| `PelunasanSupplier.tsx` | 550 | `showToast('Silakan masukkan nominal pelunasan yang valid.', 'error')` |
| `PelunasanSupplier.tsx` | 555 | `showToast('Nominal pelunasan melebihi total hutang aktif!', 'error')` |
| `PelunasanSupplier.tsx` | 565 | `showToast('Silakan isi nominal pembayaran minimal untuk satu PO.', 'error')` |
| `PelunasanSupplier.tsx` | 576 | `showToast('Pelunasan berhasil disimpan.', 'success')` |
| `PelunasanSupplier.tsx` | 578 | `showToast(err.response?.data?.error \|\| 'Gagal menyimpan pelunasan hutang', 'error')` |
| `PiutangAktif.tsx` | 487 | `showToast('Gagal mengambil detail invoice', 'error')` |
| `KelolaUser.tsx` | 76 | `showToast('error', 'Gagal memuat data pegawai')` |
| `KelolaUser.tsx` | 229 | `setFormError('Username wajib diisi')` |
| `KelolaUser.tsx` | 234 | `setFormError('Password wajib diisi untuk user baru')` |
| `KelolaUser.tsx` | 249 | `showToast('success', ...)` |
| `KelolaUser.tsx` | 258 | `showToast('success', ...)` |
| `KelolaUser.tsx` | 275 | `showToast('success', ...)` |
| `KelolaUser.tsx` | 279 | `showToast('error', ...)` |
| `KelolaProduk.tsx` | 588 | `setFormError('Kode dan Nama Produk wajib diisi')` |

### 🟡 Medium Priority (placeholders, static UI text)

| File | Line | Issue |
|------|------|-------|
| `ReturPembelian.tsx` | 1015 | `placeholder="Ketik nama supplier..."` (not translated) |
| `ReturPembelian.tsx` | 1222 | `placeholder="Alasan retur (opsional)..."` |
| `DraftPO.tsx` | 349 | `placeholder="Cari berdasarkan nama pemasok..."` |
| `MasterData.tsx` | 651 | `placeholder="Kode (misal: CUST-09 atau SUPP-11)"` |
| `MasterData.tsx` | 675 | `placeholder="Nama lengkap..."` |
| `MasterData.tsx` | 697 | `placeholder="No. Telp..."` |
| `MasterData.tsx` | 722 | `placeholder="Alamat lengkap..."` |
| `KelolaUser.tsx` | 393 | `placeholder="Cari berdasarkan username atau role..."` |
| `KelolaUser.tsx` | 615 | `placeholder="Masukkan username pegawai"` |

### 🟢 Low Priority / Won't Fix
- `Login.tsx` — login page is typically ID-only (branding page)
- `Profile.tsx` — role names (super_admin, admin, etc.) are system codes, OK as-is
- `KelolaUser.tsx` — admin-only page, lower priority

## Status
- [x] Audit complete
- [x] Fix ReturPenjualan.tsx
- [x] Fix PelunasanSupplier.tsx  
- [x] Fix PiutangAktif.tsx
- [x] Fix KelolaUser.tsx
- [x] Fix KelolaProduk.tsx
- [x] Fix placeholder texts (ReturPembelian, DraftPO, MasterData)
