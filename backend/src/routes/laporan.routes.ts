import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const laporanRouter = Router();

// GET /api/laporan/ringkasan-bisnis
laporanRouter.get('/ringkasan-bisnis', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_KANTOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    const [totalOmzet, totalPembelian, totalPiutang, totalProduk] = await Promise.all([
      prisma.sale.aggregate({ where: { status: 'completed', ...(Object.keys(dateFilter).length ? { order_date: dateFilter } : {}) }, _sum: { subtotal: true }, _count: true }),
      prisma.purchase.aggregate({ where: { status: { in: ['completed', 'received'] }, ...(Object.keys(dateFilter).length ? { order_date: dateFilter } : {}) }, _sum: { subtotal: true } }),
      prisma.customer.aggregate({ _sum: { saldo_piutang: true } }),
      prisma.product.count({ where: { aktif: true } }),
    ]);

    res.json({
      total_omzet: Number(totalOmzet._sum.subtotal) || 0,
      total_transaksi: totalOmzet._count,
      total_pembelian: Number(totalPembelian._sum.subtotal) || 0,
      total_piutang: Number(totalPiutang._sum.saldo_piutang) || 0,
      total_produk: totalProduk,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/laporan/penjualan-detail
laporanRouter.get('/penjualan-detail', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_KANTOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to, customer_id } = req.query;
    const where: any = { status: 'completed' };
    if (from || to) { where.order_date = {}; if (from) where.order_date.gte = new Date(from as string); if (to) where.order_date.lte = new Date(to as string); }
    if (customer_id) where.customer_id = customer_id;

    const sales = await prisma.sale.findMany({
      where, include: { customer: true, sale_items: { include: { product: true } }, sales_payments: true },
      orderBy: { order_date: 'desc' },
    });
    res.json(sales);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/laporan/pembelian-detail
laporanRouter.get('/pembelian-detail', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_KANTOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to, supplier_id } = req.query;
    const where: any = { status: { in: ['completed', 'received'] } };
    if (from || to) { where.order_date = {}; if (from) where.order_date.gte = new Date(from as string); if (to) where.order_date.lte = new Date(to as string); }
    if (supplier_id) where.supplier_id = supplier_id;

    const purchases = await prisma.purchase.findMany({
      where, include: { supplier: true, purchase_items: { include: { product: true } } },
      orderBy: { order_date: 'desc' },
    });
    res.json(purchases);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/laporan/stok-persediaan
laporanRouter.get('/stok-persediaan', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_KANTOR, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: { aktif: true, is_archived: false },
      include: { product_prices: { include: { supplier: true }, where: { aktif: true } } },
      orderBy: { stok: 'asc' },
    });
    res.json(products);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/laporan/penagihan-piutang
laporanRouter.get('/penagihan-piutang', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_KANTOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sales = await prisma.sale.findMany({
      where: { status: 'completed', limit_bulan: { gt: 0 } },
      include: { customer: true, sales_payments: true },
      orderBy: { due_date: 'asc' },
    });

    const now = new Date();
    const aging = sales.map((sale: any) => {
      const paid = sale.sales_payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const remaining = Number(sale.subtotal) - paid;
      const daysOverdue = sale.due_date ? Math.floor((now.getTime() - sale.due_date.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return { ...sale, paid_amount: paid, remaining, days_overdue: daysOverdue };
    }).filter((s: any) => s.remaining > 0);

    res.json(aging);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/laporan/hutang
laporanRouter.get('/hutang', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_KANTOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: { status: { in: ['completed', 'received'] }, terms: { not: 'tunai' } },
      include: { supplier: true, purchase_items: { include: { product: true } } },
      orderBy: { order_date: 'asc' },
    });
    res.json(purchases);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/laporan/arus-kas
laporanRouter.get('/arus-kas', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_KANTOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    const [masuk_tunai, masuk_piutang, keluar] = await Promise.all([
      prisma.sale.aggregate({ where: { status: 'completed', limit_bulan: 0, ...(Object.keys(dateFilter).length ? { order_date: dateFilter } : {}) }, _sum: { subtotal: true } }),
      prisma.salesPayment.aggregate({ where: Object.keys(dateFilter).length ? { payment_date: dateFilter } : {}, _sum: { amount: true } }),
      prisma.purchase.aggregate({ where: { status: 'received', ...(Object.keys(dateFilter).length ? { order_date: dateFilter } : {}) }, _sum: { subtotal: true } }),
    ]);

    res.json({
      masuk_tunai: Number(masuk_tunai._sum.subtotal) || 0,
      masuk_piutang: Number(masuk_piutang._sum.amount) || 0,
      keluar_pembelian: Number(keluar._sum.subtotal) || 0,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/laporan/audit-aktivitas
laporanRouter.get('/audit-aktivitas', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) {
      const toDate = new Date(to as string);
      toDate.setUTCHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }

    const adjustments = await prisma.stockAdjustment.findMany({
      where: Object.keys(dateFilter).length ? { created_at: dateFilter } : {},
      include: { creator: { select: { nama: true } }, product: { select: { nama: true, kode: true } } },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    res.json(adjustments);
  } catch { res.status(500).json({ error: 'Server error' }); }
});
