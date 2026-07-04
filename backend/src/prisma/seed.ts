import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Menghapus semua data lama...');

  // Hapus semua data dengan urutan yang benar (respecting foreign keys)
  await prisma.stockAdjustment.deleteMany({});
  await prisma.salesPayment.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.productPrice.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.profile.deleteMany({});

  console.log('✅ Data lama berhasil dihapus.');
  console.log('🌱 Seeding data baru untuk CV Maju Mulia Bersama (Sparepart AC Mobil)...\n');

  // ─────────────────────────────────────────
  // 1. USER ACCOUNTS
  // ─────────────────────────────────────────
  const adminId = uuidv4();
  const admin = await prisma.profile.create({
    data: {
      id: adminId,
      email: 'admin@mmb.com',
      password: await bcrypt.hash('admin123', 10),
      nama: 'Budi Santoso',
      role: 'admin',
      aktif: true,
    },
  });

  await prisma.profile.create({
    data: {
      id: uuidv4(),
      email: 'gudang@mmb.com',
      password: await bcrypt.hash('gudang123', 10),
      nama: 'Agus Prasetyo',
      role: 'staff_gudang',
      aktif: true,
    },
  });

  await prisma.profile.create({
    data: {
      id: uuidv4(),
      email: 'sales@mmb.com',
      password: await bcrypt.hash('sales123', 10),
      nama: 'Rina Wulandari',
      role: 'sales',
      aktif: true,
    },
  });

  await prisma.profile.create({
    data: {
      id: uuidv4(),
      email: 'kantor@mmb.com',
      password: await bcrypt.hash('kantor123', 10),
      nama: 'Dewi Kartika',
      role: 'staff_kantor',
      aktif: true,
    },
  });

  // ─────────────────────────────────────────
  // 2. SUPPLIERS (Pemasok Sparepart AC Mobil)
  // ─────────────────────────────────────────
  const supplier1 = await prisma.supplier.create({
    data: {
      id: uuidv4(),
      kode: 'SUP-001',
      nama: 'PT. Denso Indonesia',
      alamat: 'Jl. Perintis Kemerdekaan No. 15, Sunter, Jakarta Utara 14350',
      no_telp: '021-6509111',
      jatuh_tempo_bulan: 1,
      aktif: true,
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      id: uuidv4(),
      kode: 'SUP-002',
      nama: 'CV. Sinar Teknik Abadi',
      alamat: 'Jl. Raya Bekasi Km. 28 No. 7, Cikarang Barat, Bekasi 17520',
      no_telp: '021-8901234',
      jatuh_tempo_bulan: 2,
      aktif: true,
    },
  });

  // ─────────────────────────────────────────
  // 3. CUSTOMERS (Bengkel / Toko Sparepart)
  // ─────────────────────────────────────────
  const customer1 = await prisma.customer.create({
    data: {
      id: uuidv4(),
      kode: 'CUST-001',
      nama: 'Bengkel AC Rizky Motor',
      alamat: 'Jl. Kalimalang Blok D No. 12, Bekasi Timur, Jawa Barat 17113',
      no_telp: '0812-9876-5432',
      jatuh_tempo_bulan: 1,
      limit_kredit: 75000000,
      saldo_piutang: 0,
      aktif: true,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      id: uuidv4(),
      kode: 'CUST-002',
      nama: 'Toko Sparepart Sejahtera',
      alamat: 'Jl. Raya Cibitung No. 45, Tambun Selatan, Bekasi 17510',
      no_telp: '0857-1234-5678',
      jatuh_tempo_bulan: 2,
      limit_kredit: 150000000,
      saldo_piutang: 0,
      aktif: true,
    },
  });

  // ─────────────────────────────────────────
  // 4. PRODUCTS (5 Sparepart AC Mobil)
  // ─────────────────────────────────────────

  // Produk 1: Kompresor AC
  const product1 = await prisma.product.create({
    data: {
      id: uuidv4(),
      kode: 'AC-KMP-001',
      nama: 'Kompresor AC Denso 10S17C',
      deskripsi: 'Kompresor AC Denso tipe scroll 10S17C, cocok untuk Toyota Kijang Innova, Fortuner, Hilux. Kapasitas: 170cc, Voltase: 12V DC. Original Denso Japan.',
      stok: 0,
      satuan: 'pcs',
      aktif: true,
      is_archived: false,
    },
  });

  // Produk 2: Kondensor AC
  const product2 = await prisma.product.create({
    data: {
      id: uuidv4(),
      kode: 'AC-KND-001',
      nama: 'Kondensor AC Universal Aluminium 60x40cm',
      deskripsi: 'Kondensor AC mobil universal berbahan aluminium full, ukuran 60x40 cm, ketebalan 16mm. Kompatibel dengan berbagai jenis mobil MPV & SUV. Dilengkapi bracket besi.',
      stok: 0,
      satuan: 'pcs',
      aktif: true,
      is_archived: false,
    },
  });

  // Produk 3: Freon / Refrigerant
  const product3 = await prisma.product.create({
    data: {
      id: uuidv4(),
      kode: 'AC-FRN-134',
      nama: 'Freon AC R-134a Dupont 500gr',
      deskripsi: 'Refrigerant / Freon AC mobil tipe R-134a merk Dupont USA, kemasan kaleng 500 gram. Ramah lingkungan (non-CFC). Cocok untuk semua mobil AC standar tahun 1994 ke atas.',
      stok: 0,
      satuan: 'kaleng',
      aktif: true,
      is_archived: false,
    },
  });

  // Produk 4: Filter Dryer / Receiver Dryer
  const product4 = await prisma.product.create({
    data: {
      id: uuidv4(),
      kode: 'AC-FDR-001',
      nama: 'Filter Dryer / Receiver Drier Universal',
      deskripsi: 'Filter dryer / receiver drier AC mobil universal, diameter 35mm, panjang 220mm. Berfungsi menyaring kotoran dan menyerap kelembaban dalam sistem AC. Material: aluminium.',
      stok: 0,
      satuan: 'pcs',
      aktif: true,
      is_archived: false,
    },
  });

  // Produk 5: Evaporator AC
  const product5 = await prisma.product.create({
    data: {
      id: uuidv4(),
      kode: 'AC-EVP-AVZ',
      nama: 'Evaporator AC Toyota Avanza / Xenia',
      deskripsi: 'Evaporator AC khusus untuk Toyota Avanza generasi 1 (2004-2011) dan Daihatsu Xenia. Bahan aluminium fin copper tube. Dimensi: 22x20x5.5 cm. OEM quality.',
      stok: 0,
      satuan: 'unit',
      aktif: true,
      is_archived: false,
    },
  });

  // ─────────────────────────────────────────
  // 5. PRODUCT PRICES (Harga beli per supplier)
  // ─────────────────────────────────────────

  // Kompresor — dari supplier 1 (Denso) & 2
  await prisma.productPrice.create({
    data: {
      id: uuidv4(),
      product_id: product1.id,
      supplier_id: supplier1.id,
      stok: 0,
      harga_beli: 3250000, // Harga beli dari Denso
      aktif: true,
    },
  });
  await prisma.productPrice.create({
    data: {
      id: uuidv4(),
      product_id: product1.id,
      supplier_id: supplier2.id,
      stok: 0,
      harga_beli: 3150000, // Sedikit lebih murah dari distributor lain
      aktif: true,
    },
  });

  // Kondensor — dari kedua supplier
  await prisma.productPrice.create({
    data: {
      id: uuidv4(),
      product_id: product2.id,
      supplier_id: supplier1.id,
      stok: 0,
      harga_beli: 485000,
      aktif: true,
    },
  });
  await prisma.productPrice.create({
    data: {
      id: uuidv4(),
      product_id: product2.id,
      supplier_id: supplier2.id,
      stok: 0,
      harga_beli: 465000,
      aktif: true,
    },
  });

  // Freon — hanya dari supplier 2 (distributor kimia)
  await prisma.productPrice.create({
    data: {
      id: uuidv4(),
      product_id: product3.id,
      supplier_id: supplier2.id,
      stok: 0,
      harga_beli: 125000,
      aktif: true,
    },
  });

  // Filter Dryer — dari kedua supplier
  await prisma.productPrice.create({
    data: {
      id: uuidv4(),
      product_id: product4.id,
      supplier_id: supplier1.id,
      stok: 0,
      harga_beli: 95000,
      aktif: true,
    },
  });
  await prisma.productPrice.create({
    data: {
      id: uuidv4(),
      product_id: product4.id,
      supplier_id: supplier2.id,
      stok: 0,
      harga_beli: 88000,
      aktif: true,
    },
  });

  // Evaporator — dari supplier 1 (Denso lebih spesifik)
  await prisma.productPrice.create({
    data: {
      id: uuidv4(),
      product_id: product5.id,
      supplier_id: supplier1.id,
      stok: 0,
      harga_beli: 380000,
      aktif: true,
    },
  });

  // ─────────────────────────────────────────
  // 6. RINGKASAN
  // ─────────────────────────────────────────
  console.log('✅ Database seeding selesai!\n');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     CV MAJU MULIA BERSAMA — Initial Data       ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║  PRODUK (Sparepart AC Mobil):                  ║');
  console.log('║  1. Kompresor AC Denso 10S17C        AC-KMP-001║');
  console.log('║  2. Kondensor AC Aluminium 60x40     AC-KND-001║');
  console.log('║  3. Freon R-134a Dupont 500gr        AC-FRN-134║');
  console.log('║  4. Filter Dryer Universal           AC-FDR-001║');
  console.log('║  5. Evaporator Toyota Avanza/Xenia   AC-EVP-AVZ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║  SUPPLIER:                                     ║');
  console.log('║  SUP-001: PT. Denso Indonesia                  ║');
  console.log('║  SUP-002: CV. Sinar Teknik Abadi               ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║  CUSTOMER (Bengkel / Toko):                    ║');
  console.log('║  CUST-001: Bengkel AC Rizky Motor              ║');
  console.log('║  CUST-002: Toko Sparepart Sejahtera            ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║  AKUN LOGIN:                                   ║');
  console.log('║  admin@mmb.com        / admin123               ║');
  console.log('║  gudang@mmb.com       / gudang123              ║');
  console.log('║  sales@mmb.com        / sales123               ║');
  console.log('║  kantor@mmb.com       / kantor123              ║');
  console.log('╚════════════════════════════════════════════════╝');
}

main()
  .catch((e) => {
    console.error('❌ Seeding gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
