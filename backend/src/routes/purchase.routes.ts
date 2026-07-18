import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const purchaseRouter = Router();

// Generate PO Number: POyyurutan (e.g., PO260001)
async function generatePoNumber(): Promise<string> {
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const prefix = `PO${yy}`;
  const last = await prisma.purchase.findFirst({
    where: { no_order: { startsWith: prefix } },
    orderBy: { no_order: 'desc' },
  });
  const seq = last ? parseInt(last.no_order.slice(-4)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
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
        purchase_returns: {
          include: {
            items: true,
          },
        },
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
    const { supplier_id, order_date, terms, items, status } = req.body;
    const subtotal = (items || []).reduce((sum: number, i: any) => sum + (i.qty * i.harga_beli), 0);

    const current = await prisma.purchase.findUnique({ where: { id: req.params.id as string } });
    if (!current) { res.status(404).json({ error: 'PO tidak ditemukan' }); return; }
    if (current.status === 'received') {
      res.status(400).json({ error: 'PO yang sudah divalidasi/diterima tidak dapat diedit' });
      return;
    }

    // Delete old items and recreate
    await prisma.purchaseItem.deleteMany({ where: { purchase_id: req.params.id as string } });

    const purchase = await prisma.purchase.update({
      where: { id: req.params.id as string },
      data: {
        supplier_id,
        order_date: new Date(order_date),
        terms,
        subtotal,
        status: status || 'draft',
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
// Body: { items: [{ purchase_item_id, qty_terima, qty_rusak, catatan? }] }
// If no body.items, falls back to receiving full PO qty (backward compat)
purchaseRouter.patch('/:id/receive', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchase = (await prisma.purchase.findUnique({
      where: { id: req.params.id as string },
      include: { purchase_items: true },
    })) as any;
    if (!purchase) { res.status(404).json({ error: 'PO tidak ditemukan' }); return; }
    if (purchase.status !== 'completed') { res.status(400).json({ error: 'PO harus berstatus completed untuk dapat diterima' }); return; }

    // Build a map of overrides from body
    const itemOverrides: Record<string, { qty_terima: number; qty_rusak: number; catatan?: string }> = {};
    if (req.body?.items && Array.isArray(req.body.items)) {
      for (const override of req.body.items) {
        itemOverrides[override.purchase_item_id] = {
          qty_terima: Number(override.qty_terima ?? 0),
          qty_rusak:  Number(override.qty_rusak  ?? 0),
          catatan:    override.catatan,
        };
      }
    }

    // Update stock for each item
    const receiveLog: string[] = [];
    for (const item of purchase.purchase_items) {
      const override = itemOverrides[item.id];
      // qty masuk stok = qty_terima - qty_rusak  (if override provided, else full PO qty)
      const qtyTerima  = override ? override.qty_terima : Number(item.qty);
      const qtyRusak   = override ? override.qty_rusak  : 0;
      const qtyLayak   = Math.max(0, qtyTerima - qtyRusak);

      if (qtyLayak > 0) {
        await prisma.product.update({
          where: { id: item.product_id },
          data: { stok: { increment: qtyLayak } },
        });
        await prisma.productPrice.updateMany({
          where: { product_id: item.product_id, supplier_id: purchase.supplier_id },
          data: { stok: { increment: qtyLayak }, harga_beli: item.harga_beli },
        });
      }

      if (qtyRusak > 0) {
        receiveLog.push(`${item.product_id}: ${qtyRusak} rusak (menu retur belum dibuat)`);
      }
      if (override?.catatan) {
        receiveLog.push(`${item.product_id}: ${override.catatan}`);
      }
    }

    const updated = await prisma.purchase.update({
      where: { id: req.params.id as string },
      data: {
        status: 'received',
        received_at: new Date(),
        // Store receiving notes in terms field suffix if any damaged items exist
        // (Full retur module is not yet built - noted for future implementation)
      },
    });
    res.json({ ...updated, receive_log: receiveLog });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/purchases/:id/ongkir - Update biaya pengiriman
purchaseRouter.patch('/:id/ongkir', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { biaya_pengiriman } = req.body;
    const purchase = await prisma.purchase.update({
      where: { id: req.params.id as string },
      data: { biaya_pengiriman: Number(biaya_pengiriman) },
    });
    res.json(purchase);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/purchases/:id - Delete PO
purchaseRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: req.params.id as string },
      include: {
        purchase_items: true,
        supplier_payments: true,
        billing_allocations: true,
        purchase_returns: true,
      }
    });
    if (!purchase) { res.status(404).json({ error: 'PO tidak ditemukan' }); return; }

    const hasPayments = purchase.supplier_payments.length > 0 || purchase.billing_allocations.length > 0;
    const hasReturns = purchase.purchase_returns.length > 0;
    if (hasPayments || hasReturns) {
      res.status(400).json({ error: 'Transaksi tidak dapat dihapus karena sudah memiliki pembayaran atau retur' });
      return;
    }

    if (purchase.status === 'received') {
      for (const item of purchase.purchase_items) {
        await prisma.product.update({
          where: { id: item.product_id },
          data: { stok: { decrement: item.qty } }
        });
      }
    }

    await prisma.purchase.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'PO berhasil dihapus dan stok dikembalikan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

