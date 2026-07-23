import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const supplierRouter = Router();

supplierRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, aktif = 'true', page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (aktif !== 'all') where.aktif = aktif === 'true';
    if (q) where.OR = [{ nama: { startsWith: q as string } }, { kode: { startsWith: q as string } }];

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy: { nama: 'asc' }, skip, take: parseInt(limit as string) }),
      prisma.supplier.count({ where }),
    ]);
    res.json({ data, total });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

supplierRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id as string }, include: { product_prices: { include: { product: true } } } });
    if (!supplier) { res.status(404).json({ error: 'Supplier tidak ditemukan' }); return; }
    res.json(supplier);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

supplierRouter.post('/', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.create({ data: { id: uuidv4(), ...req.body } });
    res.status(201).json(supplier);
  } catch (e: any) {
    if (e.code === 'P2002') res.status(409).json({ error: 'Kode supplier sudah ada' });
    else res.status(500).json({ error: 'Server error' });
  }
});

supplierRouter.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.update({ where: { id: req.params.id as string }, data: req.body });
    res.json(supplier);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

supplierRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.supplier.update({ where: { id: req.params.id as string }, data: { aktif: false } });
    res.json({ message: 'Supplier dinonaktifkan' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/suppliers/:id/summary-stats
supplierRouter.get('/:id/summary-stats', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supplierId = req.params.id as string;
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier tidak ditemukan' });
      return;
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Transaksi bulan ini
    const purchasesThisMonth = await prisma.purchase.findMany({
      where: {
        supplier_id: supplierId,
        order_date: {
          gte: firstDay,
          lte: lastDay,
        },
      },
      select: {
        subtotal: true,
      },
    });

    const totalCount = purchasesThisMonth.length;
    const totalAmount = purchasesThisMonth.reduce((sum, item) => sum + Number(item.subtotal), 0);

    // 2. Piutang Dagang (Utang kumulatif kita ke supplier)
    const unpaidPurchases = await prisma.purchase.findMany({
      where: {
        supplier_id: supplierId,
        status: { in: ['completed', 'received'] },
      },
      select: {
        subtotal: true,
      },
    });
    const totalPiutang = unpaidPurchases.reduce((sum, item) => sum + Number(item.subtotal), 0);

    // 3. Terakhir order
    const lastPurchase = await prisma.purchase.findFirst({
      where: { supplier_id: supplierId },
      orderBy: { order_date: 'desc' },
      select: { order_date: true },
    });

    res.json({
      total_transaksi_bulan_ini: totalCount,
      nominal_transaksi_bulan_ini: totalAmount,
      piutang: totalPiutang,
      terakhir_order: lastPurchase?.order_date || null,
      jatuh_tempo: supplier.jatuh_tempo_bulan,
      alamat: supplier.alamat,
      no_telp: supplier.no_telp,
      kode: supplier.kode,
      nama: supplier.nama,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
