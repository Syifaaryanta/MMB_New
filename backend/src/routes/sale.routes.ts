import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const saleRouter = Router();

async function generateSoNumber(): Promise<string> {
  const allSales = await prisma.sale.findMany({
    orderBy: { no_order: 'desc' },
    take: 100,
  });

  const numericOrders = allSales
    .map(s => parseInt(s.no_order))
    .filter(num => !isNaN(num) && num >= 260000 && num <= 999999);

  if (numericOrders.length > 0) {
    const highest = Math.max(...numericOrders);
    return String(highest + 1);
  }

  return '260001';
}

export async function generateFakturNumber(): Promise<string> {
  const [allSales, allReturns] = await Promise.all([
    prisma.sale.findMany({
      where: {
        no_faktur: { not: null }
      },
      orderBy: { no_faktur: 'desc' },
      take: 100,
    }),
    prisma.saleReturn.findMany({
      where: {
        no_faktur: { not: null }
      },
      orderBy: { no_faktur: 'desc' },
      take: 100,
    })
  ]);

  const numericFakturs = [
    ...allSales.map(s => s.no_faktur ? parseInt(s.no_faktur) : NaN),
    ...allReturns.map(r => r.no_faktur ? parseInt(r.no_faktur) : NaN)
  ].filter(num => !isNaN(num) && num >= 260000 && num <= 999999);

  if (numericFakturs.length > 0) {
    const highest = Math.max(...numericFakturs);
    return String(highest + 1);
  }

  return '260001';
}

// GET /api/sales
saleRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, customer_id, from, to, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (customer_id) where.customer_id = customer_id;
    if (from || to) {
      where.order_date = {};
      if (from) where.order_date.gte = new Date(from as string);
      if (to) where.order_date.lte = new Date(to as string);
    }
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [data, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, nama: true, kode: true } },
          sale_items: { include: { product: { select: { nama: true, kode: true, satuan: true } } } },
          sales_payments: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.sale.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/sales/generate-no
saleRouter.get('/generate-no', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const no_order = await generateSoNumber();
    res.json({ no_order });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/sales/:id
saleRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id as string },
      include: {
        customer: true,
        sale_items: { include: { product: true } },
        sales_payments: true,
        creator: { select: { nama: true } },
        sale_returns: {
          include: {
            items: true,
          },
        },
      },
    });
    if (!sale) { res.status(404).json({ error: 'SO tidak ditemukan' }); return; }
    res.json(sale);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/sales - Create draft SO
saleRouter.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.SALES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customer_id, order_date, diantar, limit_bulan, extra_charge_desc, extra_charge_amount, sender_note, items } = req.body;

    const customer = await prisma.customer.findUnique({ where: { id: customer_id } });
    if (!customer) { res.status(404).json({ error: 'Customer tidak ditemukan' }); return; }

    const itemsSubtotal = (items || []).reduce((sum: number, i: any) => sum + (i.qty * i.unit_price), 0);
    const subtotal = itemsSubtotal + (extra_charge_amount || 0);

    const no_order = await generateSoNumber();

    // Calculate due_date
    const orderDate = new Date(order_date);
    const dueDate = new Date(orderDate);
    if (limit_bulan && limit_bulan > 0) {
      dueDate.setMonth(dueDate.getMonth() + limit_bulan);
    }

    // Check stock availability
    for (const item of (items || [])) {
      const product = await prisma.product.findUnique({ where: { id: item.product_id } });
      if (product && Number(product.stok) < Number(item.qty)) {
        res.status(400).json({ error: `Stok ${product.nama} tidak mencukupi (stok: ${product.stok}, dibutuhkan: ${item.qty})` });
        return;
      }
    }

    // Decrement stock for each item
    for (const item of (items || [])) {
      await prisma.product.update({
        where: { id: item.product_id },
        data: { stok: { decrement: item.qty } },
      });
    }

    const sale = await prisma.sale.create({
      data: {
        id: uuidv4(),
        no_order,
        order_date: orderDate,
        customer_id,
        customer_nama: customer.nama,
        customer_alamat: customer.alamat || '',
        customer_telp: customer.no_telp || '',
        diantar: diantar ?? true,
        limit_bulan: limit_bulan || 0,
        due_date: dueDate,
        extra_charge_desc,
        extra_charge_amount: extra_charge_amount || 0,
        sender_note,
        subtotal,
        status: 'draft',
        created_by: req.user!.id,
        sale_items: {
          create: (items || []).map((item: any) => ({
            id: uuidv4(),
            product_id: item.product_id,
            product_kode: item.product_kode,
            product_nama: item.product_nama,
            qty: item.qty,
            unit_price: item.unit_price,
            total: item.qty * item.unit_price,
          })),
        },
      },
      include: { customer: true, sale_items: { include: { product: true } } },
    });
    res.status(201).json(sale);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/sales/:id - Update SO
saleRouter.put('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.SALES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customer_id, customer_nama, customer_alamat, customer_telp, diantar, limit_bulan, extra_charge_desc, extra_charge_amount, sender_note, items } = req.body;
    
    // Get existing sale with items
    const existingSale = await prisma.sale.findUnique({
      where: { id: req.params.id as string },
      include: { sale_items: true }
    });
    if (!existingSale) {
      res.status(404).json({ error: 'SO tidak ditemukan' });
      return;
    }
    if (existingSale.status === 'completed') {
      res.status(400).json({ error: 'Tidak dapat mengubah SO yang sudah selesai' });
      return;
    }

    // Step 1: Temporarily restore stock of existing items
    for (const item of existingSale.sale_items) {
      await prisma.product.update({
        where: { id: item.product_id },
        data: { stok: { increment: item.qty } }
      });
    }

    // Step 2: Validate new items against restored stock
    for (const item of (items || [])) {
      const product = await prisma.product.findUnique({ where: { id: item.product_id } });
      if (product && Number(product.stok) < Number(item.qty)) {
        // Rollback restored stock before returning error!
        for (const it of existingSale.sale_items) {
          await prisma.product.update({
            where: { id: it.product_id },
            data: { stok: { decrement: it.qty } }
          });
        }
        res.status(400).json({ error: `Stok ${product.nama} tidak mencukupi (stok: ${product.stok}, dibutuhkan: ${item.qty})` });
        return;
      }
    }

    // Step 3: Decrement stock for new items
    for (const item of (items || [])) {
      await prisma.product.update({
        where: { id: item.product_id },
        data: { stok: { decrement: item.qty } }
      });
    }

    const itemsSubtotal = (items || []).reduce((sum: number, i: any) => sum + (i.qty * i.unit_price), 0);
    const subtotal = itemsSubtotal + (extra_charge_amount || 0);

    // Delete old sale items
    await prisma.saleItem.deleteMany({ where: { sale_id: req.params.id as string } });

    const sale = await prisma.sale.update({
      where: { id: req.params.id as string },
      data: {
        customer_id,
        customer_nama,
        customer_alamat,
        customer_telp,
        diantar,
        limit_bulan,
        extra_charge_desc,
        extra_charge_amount,
        sender_note,
        subtotal,
        sale_items: {
          create: (items || []).map((item: any) => ({
            id: uuidv4(),
            product_id: item.product_id,
            product_kode: item.product_kode,
            product_nama: item.product_nama,
            qty: item.qty,
            unit_price: item.unit_price,
            total: item.qty * item.unit_price,
          })),
        },
      },
      include: { customer: true, sale_items: { include: { product: true } } },
    });
    res.json(sale);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/sales/:id/complete - Finalize SO (stock is already deducted, just complete and record receivable)
saleRouter.patch('/:id/complete', authenticate, authorize(ROLES.ADMIN, ROLES.SALES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sale = (await prisma.sale.findUnique({
      where: { id: req.params.id as string },
      include: { sale_items: true, customer: true },
    })) as any;
    if (!sale) { res.status(404).json({ error: 'SO tidak ditemukan' }); return; }

    if (sale.status === 'completed') {
      res.status(400).json({ error: 'SO sudah diselesaikan' });
      return;
    }

    // Update customer saldo_piutang if credit
    if (sale.limit_bulan > 0) {
      await prisma.customer.update({
        where: { id: sale.customer_id },
        data: { saldo_piutang: { increment: sale.subtotal } },
      });
    }

    const updated = await prisma.sale.update({
      where: { id: req.params.id as string },
      data: { status: 'completed' },
    });
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/sales/:id/print - Generate faktur number when printed
saleRouter.patch('/:id/print', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: req.params.id as string } });
    if (!sale) { res.status(404).json({ error: 'SO tidak ditemukan' }); return; }

    const no_faktur = await generateFakturNumber();
    await prisma.sale.update({
      where: { id: req.params.id as string },
      data: { no_faktur },
    });

    const updatedSale = await prisma.sale.findUnique({
      where: { id: req.params.id as string },
      include: {
        customer: true,
        sale_items: { include: { product: true } },
      },
    });

    res.json(updatedSale);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/sales/:id - Cancel sale (restore stock)
saleRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sale = (await prisma.sale.findUnique({
      where: { id: req.params.id as string },
      include: { sale_items: true },
    })) as any;
    if (!sale) { res.status(404).json({ error: 'SO tidak ditemukan' }); return; }

    // Always restore stock (since stock is decremented at draft stage)
    for (const item of sale.sale_items) {
      await prisma.product.update({ where: { id: item.product_id }, data: { stok: { increment: item.qty } } });
    }

    // Restore customer saldo_piutang only if completed
    if (sale.status === 'completed' && sale.limit_bulan > 0) {
      await prisma.customer.update({ where: { id: sale.customer_id }, data: { saldo_piutang: { decrement: sale.subtotal } } });
    }

    await prisma.sale.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Penjualan dibatalkan dan stok dikembalikan' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/sales/:id/nota - Update nota checklist
saleRouter.patch('/:id/nota', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { nota_merah, nota_putih, nota_kuning } = req.body;
    const sale = await prisma.sale.update({
      where: { id: req.params.id as string },
      data: { nota_merah, nota_putih, nota_kuning },
    });
    res.json(sale);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/sales/:id/ongkir - Update biaya pengiriman
saleRouter.patch('/:id/ongkir', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { biaya_pengiriman } = req.body;
    const sale = await prisma.sale.update({
      where: { id: req.params.id as string },
      data: { biaya_pengiriman: Number(biaya_pengiriman) },
    });
    res.json(sale);
  } catch { res.status(500).json({ error: 'Server error' }); }
});


// GET /api/sales/customer-product-history - Get sales history of a specific product for a customer
saleRouter.get('/customer-product-history/query', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customer_id, product_id } = req.query;
    if (!customer_id || !product_id) {
      res.status(400).json({ error: 'customer_id dan product_id wajib diisi' });
      return;
    }

    const history = await prisma.saleItem.findMany({
      where: {
        product_id: product_id as string,
        sale: {
          customer_id: customer_id as string,
          status: 'completed',
        },
      },
      include: {
        sale: {
          select: { no_order: true, no_faktur: true, order_date: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

