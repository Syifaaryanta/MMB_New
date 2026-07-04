import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const stockAdjustmentRouter = Router();

stockAdjustmentRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { product_id, from, to, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (product_id) where.product_id = product_id;
    if (from || to) {
      where.adjustment_date = {};
      if (from) where.adjustment_date.gte = new Date(from as string);
      if (to) where.adjustment_date.lte = new Date(to as string);
    }
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [data, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        include: { product: { select: { nama: true, kode: true } }, creator: { select: { nama: true } } },
        orderBy: { created_at: 'desc' },
        skip, take: parseInt(limit as string),
      }),
      prisma.stockAdjustment.count({ where }),
    ]);
    res.json({ data, total });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

stockAdjustmentRouter.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { product_id, adjustment_date, stock_after, alasan } = req.body;
    const product = await prisma.product.findUnique({ where: { id: product_id } });
    if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return; }

    const stock_before = Number(product.stok);
    const qty_delta = stock_after - stock_before;

    await prisma.product.update({ where: { id: product_id }, data: { stok: stock_after } });

    const adjustment = await prisma.stockAdjustment.create({
      data: {
        id: uuidv4(),
        product_id,
        product_kode: product.kode,
        product_nama: product.nama,
        adjustment_date: new Date(adjustment_date),
        stock_before,
        stock_after,
        qty_delta,
        staff_nama: req.user!.nama,
        alasan,
        created_by: req.user!.id,
      },
    });
    res.status(201).json(adjustment);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
