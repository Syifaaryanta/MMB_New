import React from 'react';

const PageBuilder = (title: string, desc: string) => {
  return () => (
    <div className="card p-8 text-center space-y-4 max-w-2xl mx-auto mt-10">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="text-slate-400">{desc}</p>
      <div className="text-xs text-slate-500 bg-surface-800 p-3 rounded font-mono border border-surface-700">
        Halaman ini sedang dikonstruksi dalam Phase berikutnya.
      </div>
    </div>
  );
};

// Penjualan Pages
export const PenjualanMenu = PageBuilder('Menu Penjualan', 'Pilihan menu penjualan beserta indikator statistik omzet/order.');
export const BuatOrderSO = PageBuilder('Buat Order SO (Step 1)', 'Setup SO dengan input pelanggan, limit kredit, dan pengiriman.');
export const InputItemSO = PageBuilder('Input Item SO (Step 2)', 'Input barang SO dengan pencarian cepat, stok check, dan invoice adjustment.');
export const EditPenjualan = PageBuilder('Edit Penjualan', 'Pencarian SO aktif untuk diedit data barang atau pengirimannya.');
export const DaftarPenjualan = PageBuilder('Daftar Penjualan', 'Tabel pencarian dan histori seluruh invoice penjualan selesai.');
export const DraftSO = PageBuilder('Order Penjualan Tertunda', 'Mengelola draf transaksi penjualan yang ditunda pembayarannya.');

// Penagihan Pages
export const PenagihanMenu = PageBuilder('Menu Penagihan', 'Menu utama penagihan piutang dan indikator nominal.');
export const PiutangAktif = PageBuilder('Piutang Aktif', 'Daftar piutang aktif customer dengan pengelompokan per nama customer.');
export const ManajemenNota = PageBuilder('Manajemen Nota', 'Kontrol fisik dokumen nota (Nota Merah, Nota Putih, Nota Kuning) per invoice.');
export const HistoryPembayaran = PageBuilder('History Pembayaran', 'Menampilkan log seluruh transaksi yang telah lunas.');
export const RiwayatPenagihan = PageBuilder('Riwayat Penagihan', 'Log riwayat angsuran/pembayaran cicilan piutang customer.');

// Laporan Pages
export const LaporanMenu = PageBuilder('Menu Laporan', 'Daftar lengkap modul pelaporan bisnis MMB.');
export const LaporanRingkasan = PageBuilder('Laporan Ringkasan Bisnis', 'Omzet penjualan, laba kotor, outstanding piutang & hutang.');
export const LaporanPenjualan = PageBuilder('Laporan Penjualan Detail', 'Margin laba kotor per barang, per customer, dan per tanggal.');
export const LaporanPembelian = PageBuilder('Laporan Pembelian Detail', 'Detail data barang masuk per supplier beserta histori harga beli.');
export const LaporanStok = PageBuilder('Laporan Stok Persediaan', 'Nilai aset stok saat ini dan analisa barang fast-moving vs slow-moving.');
export const LaporanPenagihan = PageBuilder('Laporan Penagihan Piutang', 'Aging report (analisa umur piutang 30, 60, 90+ hari).');
export const LaporanHutang = PageBuilder('Laporan Hutang', 'Rekap hutang ke supplier yang jatuh tempo berdasarkan PO.');
export const LaporanArusKas = PageBuilder('Laporan Arus Kas', 'Arus kas masuk vs Arus kas keluar.');
export const LaporanAudit = PageBuilder('Laporan Audit Aktivitas', 'Log logistik manual, rollback, hapus draf, login user.');

// Master Data Page
export const MasterData = PageBuilder('Master Data', 'Kelola database Master Pelanggan dan Master Pemasok (Supplier).');
