import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const customerRouter = Router();

customerRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, aktif = 'true', page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (aktif !== 'all') where.aktif = aktif === 'true';
    if (q) where.OR = [{ nama: { startsWith: q as string } }, { kode: { startsWith: q as string } }];

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [data, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { nama: 'asc' }, skip, take: parseInt(limit as string) }),
      prisma.customer.count({ where }),
    ]);
    res.json({ data, total });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

customerRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id as string } });
    if (!customer) { res.status(404).json({ error: 'Customer tidak ditemukan' }); return; }
    res.json(customer);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

customerRouter.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.SALES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customer = await prisma.customer.create({ data: { id: uuidv4(), ...req.body } });
    res.status(201).json(customer);
  } catch (e: any) {
    if (e.code === 'P2002') res.status(409).json({ error: 'Kode customer sudah ada' });
    else res.status(500).json({ error: 'Server error' });
  }
});

customerRouter.put('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.SALES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id as string }, data: req.body });
    res.json(customer);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

customerRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.customer.update({ where: { id: req.params.id as string }, data: { aktif: false } });
    res.json({ message: 'Customer dinonaktifkan' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/customers/:id/credit-check
customerRouter.get('/:id/credit-check', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id as string } });
    if (!customer) { res.status(404).json({ error: 'Customer tidak ditemukan' }); return; }
    const { amount } = req.query;
    const requestedAmount = parseFloat(amount as string) || 0;
    const availableCredit = Number(customer.limit_kredit) - Number(customer.saldo_piutang);
    const isOverLimit = requestedAmount > availableCredit;
    res.json({ customer, availableCredit, isOverLimit, requestedAmount });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/customers/:id/summary-stats
customerRouter.get('/:id/summary-stats', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customerId = req.params.id as string;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ error: 'Customer tidak ditemukan' });
      return;
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Transaksi bulan ini
    const salesThisMonth = await prisma.sale.findMany({
      where: {
        customer_id: customerId,
        order_date: {
          gte: firstDay,
          lte: lastDay,
        },
      },
      select: {
        subtotal: true,
      },
    });

    const totalCount = salesThisMonth.length;
    const totalAmount = salesThisMonth.reduce((sum, item) => sum + Number(item.subtotal), 0);

    // 2. Terakhir order
    const lastSale = await prisma.sale.findFirst({
      where: { customer_id: customerId },
      orderBy: { order_date: 'desc' },
      select: { order_date: true },
    });

    res.json({
      total_transaksi_bulan_ini: totalCount,
      nominal_transaksi_bulan_ini: totalAmount,
      piutang: Number(customer.saldo_piutang),
      terakhir_order: lastSale?.order_date || null,
      jatuh_tempo: customer.jatuh_tempo_bulan,
      alamat: customer.alamat,
      no_telp: customer.no_telp,
      kode: customer.kode,
      nama: customer.nama,
      limit_kredit: Number(customer.limit_kredit),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id/product-history/:productId - Get customer's last purchase of a product and product's purchase price history
customerRouter.get('/:id/product-history/:productId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const productId = req.params.productId as string;

    // 1. Get last sale item of this product for this customer
    const lastSaleItem = await prisma.saleItem.findFirst({
      where: {
        product_id: productId,
        sale: {
          customer_id: id,
          status: 'completed',
        },
      },
      include: {
        sale: {
          select: { no_order: true, order_date: true },
        },
      },
      orderBy: {
        sale: { order_date: 'desc' },
      },
    });

    // 2. Get purchase items (harga beli) for this product
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: {
        product_id: productId,
        purchase: { status: 'received' },
      },
      include: {
        purchase: {
          select: {
            no_order: true,
            order_date: true,
            supplier: { select: { id: true, nama: true, kode: true } },
          },
        },
      },
      orderBy: {
        purchase: { order_date: 'desc' },
      },
    });

    // Fetch product prices for stock information per supplier
    const productPrices = await prisma.productPrice.findMany({
      where: {
        product_id: productId,
      },
      select: {
        supplier_id: true,
        stok: true,
      },
    });

    const supplierStokMap: { [supplierId: string]: number } = {};
    for (const pp of productPrices) {
      supplierStokMap[pp.supplier_id] = Number(pp.stok);
    }

    // Group by supplier
    const supplierGroups: { [supplierId: string]: any[] } = {};
    for (const item of purchaseItems) {
      const sId = item.purchase.supplier.id;
      if (!supplierGroups[sId]) {
        supplierGroups[sId] = [];
      }
      supplierGroups[sId].push(item);
    }

    const groupedHistory = Object.values(supplierGroups).map((itemsList) => {
      const latest = itemsList[0];
      const previous = itemsList[1] || null;

      const latestPrice = Number(latest.harga_beli);
      const prevPrice = previous ? Number(previous.harga_beli) : null;
      const difference = prevPrice !== null ? (latestPrice - prevPrice) : null;
      const sId = latest.purchase.supplier.id;
      const stok = supplierStokMap[sId] !== undefined ? supplierStokMap[sId] : 0;

      return {
        supplier_id: sId,
        supplier_name: latest.purchase.supplier.nama,
        supplier_kode: latest.purchase.supplier.kode,
        latest_price: latestPrice,
        prev_price: prevPrice,
        difference: difference,
        stok: stok,
        order_date: latest.purchase.order_date,
        no_order: latest.purchase.no_order,
      };
    });

    let finalHistory = groupedHistory;
    if (finalHistory.length > 1) {
      finalHistory = finalHistory.filter(item => item.stok > 0);
    }

    res.json({
      last_sale: lastSaleItem ? {
        unit_price: Number(lastSaleItem.unit_price),
        order_date: lastSaleItem.sale.order_date,
        no_order: lastSaleItem.sale.no_order,
      } : null,
      purchase_history: finalHistory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
