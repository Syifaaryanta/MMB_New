import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Menghapus semua data lama...');

  // Hapus semua data dengan urutan yang benar (respecting foreign keys)
  await prisma.billingAllocation.deleteMany({});
  await prisma.billingSession.deleteMany({});
  await prisma.supplierPayment.deleteMany({});
  await prisma.salesPayment.deleteMany({});
  await prisma.saleReturnItem.deleteMany({});
  await prisma.saleReturn.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.purchaseReturnItem.deleteMany({});
  await prisma.purchaseReturn.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.stockAdjustment.deleteMany({});
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
  await prisma.profile.create({
    data: {
      id: adminId,
      email: 'admin@mmb.com',
      username: 'admin',
      password: await bcrypt.hash('admin123', 10),
      nama: 'Budi Santoso',
      role: 'super_admin',
      aktif: true,
    },
  });

  await prisma.profile.create({
    data: {
      id: uuidv4(),
      email: 'gudang@mmb.com',
      username: 'gudang',
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
      username: 'sales',
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
      username: 'kantor',
      password: await bcrypt.hash('kantor123', 10),
      nama: 'Dewi Kartika',
      role: 'staff_kantor',
      aktif: true,
    },
  });

  // ─────────────────────────────────────────
  // 2. SUPPLIERS
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
  // 3. CUSTOMERS
  // ─────────────────────────────────────────
  await prisma.customer.create({
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

  await prisma.customer.create({
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
  // 4. PRODUCTS (10 Sparepart AC Mobil)
  // ─────────────────────────────────────────
  const productsData = [
    {
      kode: 'AC-KMP-001',
      nama: 'MC Terios std/Xenia New',
      deskripsi: 'Magnet Clutch AC Terios std / Xenia New 12V. Kompatibel untuk Terios std dan Xenia New.',
      satuan: 'pcs',
      harga_sup1: 3250000,
      harga_sup2: 3150000,
    },
    {
      kode: 'AC-KND-001',
      nama: 'MC Avanza 1.3/Xenia 1.3',
      deskripsi: 'Magnet Clutch AC Avanza 1.3 / Xenia 1.3 12V. Kompatibel untuk Avanza 1.3 dan Xenia 1.3.',
      satuan: 'pcs',
      harga_sup1: 485000,
      harga_sup2: 465000,
    },
    {
      kode: 'AC-FRN-134',
      nama: 'MC Innova Bensin/Fortuner Bensin',
      deskripsi: 'Magnet Clutch AC Innova Bensin / Fortuner Bensin. Kompatibel untuk Innova dan Fortuner Bensin.',
      satuan: 'kaleng',
      harga_sup1: 130000,
      harga_sup2: 125000,
    },
    {
      kode: 'AC-FDR-001',
      nama: 'MC Jazz RS/City GM2',
      deskripsi: 'Magnet Clutch AC Honda Jazz RS / City GM2. Kompatibel untuk Jazz RS dan City GM2.',
      satuan: 'pcs',
      harga_sup1: 95000,
      harga_sup2: 88000,
    },
    {
      kode: 'AC-EVP-AVZ',
      nama: 'MC Ertiga/Splash/Swift',
      deskripsi: 'Magnet Clutch AC Suzuki Ertiga / Splash / Swift. Kompatibel untuk Ertiga, Splash, dan Swift.',
      satuan: 'unit',
      harga_sup1: 380000,
      harga_sup2: 370000,
    },
    {
      kode: 'AC-MGC-006',
      nama: 'MC Yaris/Vios/New Altis',
      deskripsi: 'Magnet Clutch AC Toyota Yaris / Vios / New Altis 12V High Quality',
      satuan: 'pcs',
      harga_sup1: 350000,
      harga_sup2: 340000,
    },
    {
      kode: 'AC-EXP-001',
      nama: 'Expansi Avanza/Xenia/Rush/Terios',
      deskripsi: 'Expansion Valve AC Mobil Avanza / Xenia / Rush / Terios OEM Quality',
      satuan: 'pcs',
      harga_sup1: 175000,
      harga_sup2: 165000,
    },
    {
      kode: 'AC-EXT-002',
      nama: 'Ekstra Fan Denso Innova/Fortuner',
      deskripsi: 'Extra Fan Motor AC Denso Innova / Fortuner 12V Complete Assembly',
      satuan: 'pcs',
      harga_sup1: 450000,
      harga_sup2: 430000,
    },
    {
      kode: 'AC-OIL-ND8',
      nama: 'Oli Kompresor ND-8 Denso 250ml',
      deskripsi: 'Oli Kompresor AC Mobil R134a Denso ND-8 Original 250ml',
      satuan: 'botol',
      harga_sup1: 85000,
      harga_sup2: 80000,
    },
    {
      kode: 'AC-MGC-007',
      nama: 'MC Grand Livina/Latio/Evalia',
      deskripsi: 'Magnet Clutch AC Nissan Grand Livina / Latio / Evalia 12V',
      satuan: 'pcs',
      harga_sup1: 380000,
      harga_sup2: 365000,
    },
  ];

  for (const item of productsData) {
    const prod = await prisma.product.create({
      data: {
        id: uuidv4(),
        kode: item.kode,
        nama: item.nama,
        deskripsi: item.deskripsi,
        stok: 0,
        satuan: item.satuan,
        aktif: true,
        is_archived: false,
      },
    });

    await prisma.productPrice.create({
      data: {
        id: uuidv4(),
        product_id: prod.id,
        supplier_id: supplier1.id,
        stok: 0,
        harga_beli: item.harga_sup1,
        aktif: true,
      },
    });

    await prisma.productPrice.create({
      data: {
        id: uuidv4(),
        product_id: prod.id,
        supplier_id: supplier2.id,
        stok: 0,
        harga_beli: item.harga_sup2,
        aktif: true,
      },
    });
  }

  console.log('✅ Database seeding selesai!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
