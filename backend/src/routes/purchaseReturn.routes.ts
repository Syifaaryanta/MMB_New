import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const purchaseReturnRouter = Router();

// Helper to generate RB26xxxx return number
async function generateReturnNumber(): Promise<string> {
  const currentYear = new Date().getFullYear().toString().slice(-2); // e.g., "26"
  const prefix = `RB${currentYear}`;

  const lastReturn = await prisma.purchaseReturn.findFirst({
    where: {
      no_retur: {
        startsWith: prefix,
      },
    },
    orderBy: {
      no_retur: 'desc',
    },
  });

  if (lastReturn) {
    const lastNumStr = lastReturn.no_retur.substring(4); // gets "xxxx"
    const lastNum = parseInt(lastNumStr, 10);
    if (!isNaN(lastNum)) {
      const nextNum = lastNum + 1;
      return `${prefix}${String(nextNum).padStart(4, '0')}`;
    }
  }

  return `${prefix}0001`;
}

// GET /api/purchase-returns - Get list of purchase returns with search
purchaseReturnRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, from, to, page = '1', limit = '50' } = req.query;
    const where: any = {};

    if (from || to) {
      where.retur_date = {};
      if (from) where.retur_date.gte = new Date(from as string);
      if (to) where.retur_date.lte = new Date(to as string);
    }

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { no_retur: { contains: searchStr } },
        { no_order: { contains: searchStr } },
        { supplier_nama: { contains: searchStr } },
        {
          items: {
            some: {
              OR: [
                { product_nama: { contains: searchStr } },
                { product_kode: { contains: searchStr } },
              ],
            },
          },
        },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [data, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  satuan: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.purchaseReturn.count({ where }),
    ]);

    res.json({ data, total });
  } catch (err) {
    console.error('Error fetching purchase returns:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/purchase-returns/generate-no - Get auto-generated RB number
purchaseReturnRouter.get('/generate-no', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const no_retur = await generateReturnNumber();
    res.json({ no_retur });
  } catch (err) {
    console.error('Error generating return number:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/purchase-returns - Create a new purchase return
purchaseReturnRouter.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.SALES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { purchase_id, retur_date, metode_kompensasi, catatan, items } = req.body;

    if (!purchase_id || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Data retur tidak lengkap' });
      return;
    }

    // Fetch the original purchase and its items
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchase_id },
      include: {
        purchase_items: true,
        purchase_returns: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!purchase) {
      res.status(404).json({ error: 'Nota Pembelian asal tidak ditemukan' });
      return;
    }

    // Get supplier name
    const supplier = await prisma.supplier.findUnique({
      where: { id: purchase.supplier_id },
    });
    const supplier_nama = supplier ? supplier.nama : 'Unknown';

    // Calculate previously returned quantities for each product
    const previouslyReturnedQty = new Map<string, number>();
    for (const ret of purchase.purchase_returns) {
      for (const item of ret.items) {
        const cur = previouslyReturnedQty.get(item.product_id) || 0;
        previouslyReturnedQty.set(item.product_id, cur + Number(item.qty));
      }
    }

    // Validate if the new return quantities exceed purchased quantities
    for (const item of items) {
      const originalItem = purchase.purchase_items.find(pi => pi.product_id === item.product_id);
      if (!originalItem) {
        res.status(400).json({ error: `Produk ${item.product_nama} tidak ada dalam transaksi asal` });
        return;
      }
      const prevQty = previouslyReturnedQty.get(item.product_id) || 0;
      const totalAllowed = Number(originalItem.qty) - prevQty;

      if (Number(item.qty) > totalAllowed) {
        res.status(400).json({
          error: `Jumlah retur untuk ${item.product_nama} melebihi batas (maksimum: ${totalAllowed}, diinput: ${item.qty})`
        });
        return;
      }
    }

    // Validate stock is enough to be returned
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.product_id },
      });
      if (!product || Number(product.stok) < Number(item.qty)) {
        res.status(400).json({
          error: `Stok ${item.product_nama} di gudang tidak mencukupi untuk diretur (stok saat ini: ${product ? product.stok : 0}, diretur: ${item.qty})`
        });
        return;
      }
    }

    // Process Return in Transaction
    const no_retur = await generateReturnNumber();
    const returTotal = items.reduce((sum: number, it: any) => sum + (Number(it.qty) * Number(it.unit_price)), 0);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create PurchaseReturn and PurchaseReturnItems
      const createdReturn = await tx.purchaseReturn.create({
        data: {
          id: uuidv4(),
          no_retur,
          purchase_id: purchase.id,
          no_order: purchase.no_order,
          supplier_id: purchase.supplier_id,
          supplier_nama,
          retur_date: new Date(retur_date),
          total: returTotal,
          metode_kompensasi,
          catatan,
          created_by: req.user?.id || null,
          items: {
            create: items.map((item: any) => ({
              id: uuidv4(),
              product_id: item.product_id,
              product_kode: item.product_kode,
              product_nama: item.product_nama,
              qty: item.qty,
              unit_price: item.unit_price,
              total: Number(item.qty) * Number(item.unit_price),
              kondisi: item.kondisi || 'bagus',
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // 2. Decrement Stock for all returned items (since they are sent out to supplier)
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.product_id },
        });

        if (product) {
          const stockBefore = Number(product.stok);
          const qtyDelta = Number(item.qty);
          const stockAfter = stockBefore - qtyDelta;

          await tx.product.update({
            where: { id: item.product_id },
            data: {
              stok: {
                decrement: qtyDelta,
              },
            },
          });

          // Create StockAdjustment record
          await tx.stockAdjustment.create({
            data: {
              id: uuidv4(),
              product_id: product.id,
              product_kode: product.kode,
              product_nama: product.nama,
              adjustment_date: new Date(),
              stock_before: stockBefore,
              stock_after: stockAfter,
              qty_delta: -qtyDelta, // negative delta
              staff_nama: req.user?.nama || 'System',
              alasan: `Retur Pembelian (${no_retur})`,
              created_by: req.user?.id || null,
            },
          });
        }
      }

      return createdReturn;
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating purchase return:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/purchase-returns/supplier-history - Get purchase history for a supplier and product
purchaseReturnRouter.get('/supplier-history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supplier_id, product_id } = req.query;
    if (!supplier_id || !product_id) {
      res.status(400).json({ error: 'supplier_id dan product_id harus disertakan' });
      return;
    }

    // Find all completed/received purchases from this supplier that contain the product
    const purchases = await prisma.purchase.findMany({
      where: {
        supplier_id: supplier_id as string,
        status: { in: ['completed', 'received'] },
        purchase_items: {
          some: {
            product_id: product_id as string,
          },
        },
      },
      include: {
        purchase_items: {
          where: {
            product_id: product_id as string,
          },
        },
        purchase_returns: {
          include: {
            items: {
              where: {
                product_id: product_id as string,
              },
            },
          },
        },
      },
      orderBy: {
        order_date: 'desc',
      },
    });

    // Map each purchase to details with calculated returnable quantity
    const history = purchases.map((pur) => {
      const item = pur.purchase_items[0];
      const qtyPurchased = Number(item.qty);

      // Sum all previously returned quantities for this product in this purchase
      const qtyReturned = pur.purchase_returns.reduce((sum, ret) => {
        const retItemQty = ret.items.reduce((s, it) => s + Number(it.qty), 0);
        return sum + retItemQty;
      }, 0);

      const qtyRemaining = qtyPurchased - qtyReturned;

      return {
        purchase_id: pur.id,
        no_order: pur.no_order,
        order_date: pur.order_date,
        terms: pur.terms,
        unit_price: Number(item.harga_beli),
        qty_beli: qtyPurchased,
        qty_sudah_retur: qtyReturned,
        qty_remaining: qtyRemaining,
      };
    }).filter(h => h.qty_remaining > 0);

    res.json(history);
  } catch (err) {
    console.error('Error fetching supplier purchase history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/purchase-returns/:id/print - Get details for printing
purchaseReturnRouter.patch('/:id/print', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchaseReturn = await prisma.purchaseReturn.findUnique({
      where: { id: req.params.id as string },
      include: {
        purchase: true,
        items: {
          include: {
            product: {
              select: {
                satuan: true,
              },
            },
          },
        },
      },
    });
    if (!purchaseReturn) { res.status(404).json({ error: 'Retur tidak ditemukan' }); return; }

    res.json(purchaseReturn);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
