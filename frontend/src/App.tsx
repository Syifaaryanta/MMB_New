import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';

// Pages
import { Login } from '@/pages/auth/Login';
import { Profile } from '@/pages/auth/Profile';
import { KelolaUser } from '@/pages/admin/KelolaUser';
import { Dashboard } from '@/pages/dashboard/Dashboard';

// Real Gudang Pages
import { GudangMenu } from '@/pages/gudang/GudangMenu';
import { InformasiHarga } from '@/pages/gudang/InformasiHarga';
import { KelolaProduk } from '@/pages/gudang/KelolaProduk';
import { ArsipProduk } from '@/pages/gudang/ArsipProduk';
import { DaftarInventori } from '@/pages/gudang/DaftarInventori';
import { DetailProduk } from '@/pages/gudang/DetailProduk';

// Real Pembelian Pages
import { PembelianMenu } from '@/pages/pembelian/PembelianMenu';
import { BuatOrderPO } from '@/pages/pembelian/BuatOrderPO';
import { InputItemPO } from '@/pages/pembelian/InputItemPO';
import { DraftPO } from '@/pages/pembelian/DraftPO';
import { EditOrderPO } from '@/pages/pembelian/EditOrderPO';
import { Receiving } from '@/pages/pembelian/Receiving';
import { HistoryPembelian } from '@/pages/pembelian/HistoryPembelian';

import { ReturPenjualan } from '@/pages/penjualan/ReturPenjualan';
import { ReturPembelian } from '@/pages/pembelian/ReturPembelian';

// History Pages
import { HistoryMenu } from '@/pages/history/HistoryMenu';
import { HistoryBarangMasuk } from '@/pages/history/HistoryBarangMasuk';
import { HistoryBarangKeluar } from '@/pages/history/HistoryBarangKeluar';
import { HistoryBarangInOut } from '@/pages/history/HistoryBarangInOut';
import { HistoryReturn } from '@/pages/history/HistoryReturn';

// Real Penjualan Pages
import { PenjualanMenu } from '@/pages/penjualan/PenjualanMenu';
import { BuatOrderSO } from '@/pages/penjualan/BuatOrderSO';
import { InputItemSO } from '@/pages/penjualan/InputItemSO';
import { EditPenjualan } from '@/pages/penjualan/EditPenjualan';
import { DaftarPenjualan } from '@/pages/penjualan/DaftarPenjualan';
import { DraftSO } from '@/pages/penjualan/DraftSO';

import { PenagihanMenu } from '@/pages/penagihan/PenagihanMenu';
import { PiutangAktif } from '@/pages/penagihan/PiutangAktif';
import { ManajemenNota } from '@/pages/penagihan/ManajemenNota';
import { PelangganLunas } from '@/pages/penagihan/PelangganLunas';
import { HistoryPembayaran } from '@/pages/penagihan/HistoryPembayaran';
import { HistoryPelunasan } from '@/pages/penagihan/HistoryPelunasan';
import { PelunasanSupplier } from '@/pages/penagihan/PelunasanSupplier';

// Real Laporan Pages
import { LaporanMenu } from '@/pages/laporan/LaporanMenu';
import { LaporanRingkasan } from '@/pages/laporan/LaporanRingkasan';
import { LaporanPenjualan } from '@/pages/laporan/LaporanPenjualan';
import { LaporanPembelian } from '@/pages/laporan/LaporanPembelian';
import { LaporanStok } from '@/pages/laporan/LaporanStok';
import { LaporanPenagihan } from '@/pages/laporan/LaporanPenagihan';
import { LaporanHutang } from '@/pages/laporan/LaporanHutang';
import { LaporanArusKas } from '@/pages/laporan/LaporanArusKas';
import { LaporanAudit } from '@/pages/laporan/LaporanAudit';

// Real Master Data Page
import { MasterData } from '@/pages/master-data/MasterData';
import { MasterDataMenu } from '@/pages/master-data/MasterDataMenu';

function RouteStateCleaner() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;

    // 1. Sales Order
    if (path !== '/penjualan/buat' && path !== '/penjualan/input') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('so_')) {
          sessionStorage.removeItem(key);
        }
      });
    }

    // 2. Purchase Order
    if (path !== '/pembelian/order' && path !== '/pembelian/input') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('po_')) {
          sessionStorage.removeItem(key);
        }
      });
    }

    // 3. Receiving
    if (path !== '/pembelian/receiving') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('receiving_')) {
          sessionStorage.removeItem(key);
        }
      });
    }

    // 4. Sales Return
    if (path !== '/penjualan/retur') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('retur_so_')) {
          sessionStorage.removeItem(key);
        }
      });
    }

    // 5. Purchase Return
    if (path !== '/pembelian/retur') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('retur_po_')) {
          sessionStorage.removeItem(key);
        }
      });
    }

    // 6. Manage Product
    if (path !== '/gudang/katalog') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('manage_product_')) {
          sessionStorage.removeItem(key);
        }
      });
    }

    // 7. Edit Price
    if (path !== '/gudang/cek-harga') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('edit_price_')) {
          sessionStorage.removeItem(key);
        }
      });
    }

    // 8. Penagihan Piutang
    if (path !== '/penagihan/piutang') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('penagihan_piutang_')) {
          sessionStorage.removeItem(key);
        }
      });
    }

    // 9. Penagihan Nota
    if (path !== '/penagihan/nota') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('penagihan_nota_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, [location.pathname]);

  return null;
}

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <RouteStateCleaner />
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/*"
            element={
              <MainLayout>
                <Routes>
                  {/* Dashboard */}
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="profile" element={<Profile />} />

                  {/* Gudang */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'staff_gudang']} />}>
                    <Route path="gudang" element={<GudangMenu />} />
                    <Route path="gudang/cek-harga" element={<InformasiHarga />} />
                    <Route path="gudang/katalog" element={<KelolaProduk />} />
                    <Route path="gudang/archive" element={<ArsipProduk />} />
                    <Route path="gudang/cek-semua" element={<DaftarInventori />} />
                    <Route path="gudang/detail" element={<DetailProduk />} />
                  </Route>

                  {/* Pembelian */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'staff_gudang', 'sales']} />}>
                    <Route path="pembelian" element={<PembelianMenu />} />
                    <Route path="pembelian/order" element={<BuatOrderPO />} />
                    <Route path="pembelian/input" element={<InputItemPO />} />
                    <Route path="pembelian/draft" element={<DraftPO />} />
                    <Route path="pembelian/edit-order" element={<EditOrderPO />} />
                    <Route path="pembelian/receiving" element={<Receiving />} />
                    <Route path="pembelian/history-pembelian" element={<HistoryPembelian />} />
                    <Route path="pembelian/retur" element={<ReturPembelian />} />
                  </Route>

                  {/* Penjualan */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'sales']} />}>
                    <Route path="penjualan" element={<PenjualanMenu />} />
                    <Route path="penjualan/buat" element={<BuatOrderSO />} />
                    <Route path="penjualan/input" element={<InputItemSO />} />
                    <Route path="penjualan/edit" element={<EditPenjualan />} />
                    <Route path="penjualan/list" element={<DaftarPenjualan />} />
                    <Route path="penjualan/draft" element={<DraftSO />} />
                    <Route path="penjualan/retur" element={<ReturPenjualan />} />
                  </Route>

                  {/* Penagihan */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'sales']} />}>
                    <Route path="penagihan" element={<PenagihanMenu />} />
                    <Route path="penagihan/piutang" element={<PiutangAktif />} />
                    <Route path="penagihan/supplier" element={<PelunasanSupplier />} />
                    <Route path="penagihan/nota" element={<ManajemenNota />} />
                    <Route path="penagihan/lunas" element={<PelangganLunas />} />
                    <Route path="penagihan/history-pembayaran" element={<HistoryPembayaran />} />
                    <Route path="penagihan/history-pelunasan" element={<HistoryPelunasan />} />
                  </Route>

                  {/* History */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'sales', 'staff_kantor']} />}>
                    <Route path="history" element={<HistoryMenu />} />
                    <Route path="history/barang-masuk" element={<HistoryBarangMasuk />} />
                    <Route path="history/barang-keluar" element={<HistoryBarangKeluar />} />
                    <Route path="history/barang-inout" element={<HistoryBarangInOut />} />
                    <Route path="history/retur" element={<HistoryReturn />} />
                  </Route>

                  {/* Laporan */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'staff_kantor']} />}>
                    <Route path="laporan" element={<LaporanMenu />} />
                    <Route path="laporan/ringkasan-bisnis" element={<LaporanRingkasan />} />
                    <Route path="laporan/penjualan-detail" element={<LaporanPenjualan />} />
                    <Route path="laporan/pembelian-detail" element={<LaporanPembelian />} />
                    <Route path="laporan/stok-persediaan" element={<LaporanStok />} />
                    <Route path="laporan/penagihan-piutang" element={<LaporanPenagihan />} />
                    <Route path="laporan/hutang" element={<LaporanHutang />} />
                    <Route path="laporan/arus-kas" element={<LaporanArusKas />} />
                    <Route path="laporan/audit-aktivitas" element={<LaporanAudit />} />
                  </Route>

                  {/* Master Data */}
                  <Route path="master-data" element={<MasterDataMenu />} />
                  <Route path="master-data/customer" element={<MasterData type="customer" />} />
                  <Route path="master-data/supplier" element={<MasterData type="supplier" />} />

                  {/* Kelola User (Super Admin only) */}
                  <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
                    <Route path="kelola-user" element={<KelolaUser />} />
                  </Route>

                  {/* Catch-all to Dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </MainLayout>
            }
          />
        </Route>

        {/* Redirect public root to login or dashboard */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Catch-all for main routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
