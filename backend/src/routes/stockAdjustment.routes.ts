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
    const { product_id, adjustment_date, stock_after, alasan, staff_nama } = req.body;
    const product = await prisma.product.findUnique({ where: { id: product_id } });
    if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return; }

    const stock_before = Number(product.stok);
    const qty_delta = stock_after - stock_before;

    await prisma.product.update({ where: { id: product_id }, data: { stok: stock_after } });

    // Sync product prices to match the new adjusted stock
    const activePrices = await prisma.productPrice.findMany({
      where: { product_id, aktif: true },
      orderBy: { updated_at: 'desc' },
    });

    if (activePrices.length > 0) {
      // Set the first/most recent active supplier price record to stock_after, and all others to 0
      await prisma.productPrice.update({
        where: { id: activePrices[0].id },
        data: { stok: Math.max(0, stock_after) }
      });

      if (activePrices.length > 1) {
        const remainingIds = activePrices.slice(1).map(ap => ap.id);
        await prisma.productPrice.updateMany({
          where: { id: { in: remainingIds } },
          data: { stok: 0 }
        });
      }
    }

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
        staff_nama: staff_nama || req.user!.nama,
        alasan,
        created_by: req.user!.id,
      },
    });
    res.status(201).json(adjustment);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

stockAdjustmentRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adj = await prisma.stockAdjustment.findUnique({
      where: { id: req.params.id as string }
    });
    if (!adj) { res.status(404).json({ error: 'Data penyesuaian tidak ditemukan' }); return; }

    // Revert product stock delta
    if (adj.product_id) {
      const product = await prisma.product.findUnique({ where: { id: adj.product_id } });
      if (product) {
        const revertedStock = Number(product.stok) - Number(adj.qty_delta);
        await prisma.product.update({
          where: { id: adj.product_id },
          data: { stok: revertedStock }
        });

        // Sync product prices to match the reverted stock
        const activePricesDel = await prisma.productPrice.findMany({
          where: { product_id: adj.product_id, aktif: true },
          orderBy: { updated_at: 'desc' },
        });

        if (activePricesDel.length > 0) {
          await prisma.productPrice.update({
            where: { id: activePricesDel[0].id },
            data: { stok: Math.max(0, revertedStock) }
          });

          if (activePricesDel.length > 1) {
            const remainingIdsDel = activePricesDel.slice(1).map(ap => ap.id);
            await prisma.productPrice.updateMany({
              where: { id: { in: remainingIdsDel } },
              data: { stok: 0 }
            });
          }
        }
      }
    }

    // Delete the adjustment record
    await prisma.stockAdjustment.delete({
      where: { id: req.params.id as string }
    });

    res.json({ message: 'Penyesuaian stok berhasil dihapus dan stok dikembalikan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

