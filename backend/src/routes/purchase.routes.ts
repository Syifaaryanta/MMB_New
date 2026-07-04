import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const purchaseRouter = Router();

// Generate PO Number: PO-YYYYMMDD-NNN
async function generatePoNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `PO-${dateStr}-`;
  const last = await prisma.purchase.findFirst({
    where: { no_order: { startsWith: prefix } },
    orderBy: { no_order: 'desc' },
  });
  const seq = last ? parseInt(last.no_order.slice(-3)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// GET /api/purchases
purchaseRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, supplier_id, from, to, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (supplier_id) where.supplier_id = supplier_id;
    if (from || to) {
      where.order_date = {};
      if (from) where.order_date.gte = new Date(from as string);
      if (to) where.order_date.lte = new Date(to as string);
    }
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [data, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, nama: true, kode: true } },
          purchase_items: { include: { product: { select: { id: true, nama: true, kode: true, satuan: true } } } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.purchase.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/purchases/generate-no
purchaseRouter.get('/generate-no', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const no_order = await generatePoNumber();
    res.json({ no_order });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/purchases/:id
purchaseRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: req.params.id as string },
      include: {
        supplier: true,
        purchase_items: { include: { product: true } },
        creator: { select: { nama: true } },
      },
    });
    if (!purchase) { res.status(404).json({ error: 'PO tidak ditemukan' }); return; }
    res.json(purchase);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/purchases - Create draft PO
purchaseRouter.post('/', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supplier_id, order_date, terms, items } = req.body;
    const no_order = await generatePoNumber();

    const subtotal = (items || []).reduce((sum: number, i: any) => sum + (i.qty * i.harga_beli), 0);

    const purchase = await prisma.purchase.create({
      data: {
        id: uuidv4(),
        no_order,
        supplier_id,
        order_date: new Date(order_date),
        terms: terms || 'tunai',
        subtotal,
        status: 'draft',
        created_by: req.user!.id,
        purchase_items: {
          create: (items || []).map((item: any) => ({
            id: uuidv4(),
            product_id: item.product_id,
            qty: item.qty,
            harga_beli: item.harga_beli,
            subtotal: item.qty * item.harga_beli,
          })),
        },
      },
      include: { supplier: true, purchase_items: { include: { product: true } } },
    });

    res.status(201).json(purchase);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/purchases/:id - Update PO
purchaseRouter.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supplier_id, order_date, terms, items } = req.body;
    const subtotal = (items || []).reduce((sum: number, i: any) => sum + (i.qty * i.harga_beli), 0);

    // Delete old items and recreate
    await prisma.purchaseItem.deleteMany({ where: { purchase_id: req.params.id as string } });

    const purchase = await prisma.purchase.update({
      where: { id: req.params.id as string },
      data: {
        supplier_id,
        order_date: new Date(order_date),
        terms,
        subtotal,
        purchase_items: {
          create: (items || []).map((item: any) => ({
            id: uuidv4(),
            product_id: item.product_id,
            qty: item.qty,
            harga_beli: item.harga_beli,
            subtotal: item.qty * item.harga_beli,
          })),
        },
      },
      include: { supplier: true, purchase_items: { include: { product: true } } },
    });

    res.json(purchase);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/purchases/:id/complete - Finalize PO (draft -> completed)
purchaseRouter.patch('/:id/complete', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchase = await prisma.purchase.update({
      where: { id: req.params.id as string },
      data: { status: 'completed' },
    });
    res.json(purchase);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/purchases/:id/receive - Receive PO (completed -> received) & update stock
purchaseRouter.patch('/:id/receive', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchase = (await prisma.purchase.findUnique({
      where: { id: req.params.id as string },
      include: { purchase_items: true },
    })) as any;
    if (!purchase) { res.status(404).json({ error: 'PO tidak ditemukan' }); return; }
    if (purchase.status !== 'completed') { res.status(400).json({ error: 'PO harus berstatus completed untuk dapat diterima' }); return; }

    // Update stock for each item
    for (const item of purchase.purchase_items) {
      await prisma.product.update({
        where: { id: item.product_id },
        data: { stok: { increment: item.qty } },
      });
      // Update product price stock per supplier
      await prisma.productPrice.updateMany({
        where: { product_id: item.product_id, supplier_id: purchase.supplier_id },
        data: { stok: { increment: item.qty }, harga_beli: item.harga_beli },
      });
    }

    const updated = await prisma.purchase.update({
      where: { id: req.params.id as string },
      data: { status: 'received', received_at: new Date() },
    });
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/purchases/:id - Delete draft PO only
purchaseRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id as string } });
    if (!purchase) { res.status(404).json({ error: 'PO tidak ditemukan' }); return; }
    if (purchase.status !== 'draft') { res.status(400).json({ error: 'Hanya draft PO yang dapat dihapus' }); return; }
    await prisma.purchase.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Draft PO dihapus' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});
