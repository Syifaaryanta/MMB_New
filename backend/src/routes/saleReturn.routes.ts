import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';
import { generateFakturNumber } from './sale.routes';

export const saleReturnRouter = Router();

// Helper to generate RJ26xxxx return number
async function generateReturnNumber(): Promise<string> {
  const currentYear = new Date().getFullYear().toString().slice(-2); // e.g., "26"
  const prefix = `RJ${currentYear}`;

  const lastReturn = await prisma.saleReturn.findFirst({
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

// GET /api/sale-returns - Get list of sales returns with search
saleReturnRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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
        { no_faktur: { contains: searchStr } },
        { customer_nama: { contains: searchStr } },
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
      prisma.saleReturn.findMany({
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
      prisma.saleReturn.count({ where }),
    ]);

    res.json({ data, total });
  } catch (err) {
    console.error('Error fetching sales returns:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sale-returns/generate-no - Get auto-generated RJ number
saleReturnRouter.get('/generate-no', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const no_retur = await generateReturnNumber();
    res.json({ no_retur });
  } catch (err) {
    console.error('Error generating return number:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sale-returns - Create a new sales return
saleReturnRouter.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.SALES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sale_id, retur_date, metode_kompensasi, catatan, items } = req.body;

    if (!sale_id || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Data retur tidak lengkap' });
      return;
    }

    // Fetch the original sale and its items
    const sale = await prisma.sale.findUnique({
      where: { id: sale_id },
      include: {
        sale_items: true,
        sale_returns: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!sale) {
      res.status(404).json({ error: 'Nota Penjualan asal tidak ditemukan' });
      return;
    }

    // Calculate previously returned quantities for each product
    const previouslyReturnedQty = new Map<string, number>();
    for (const ret of sale.sale_returns) {
      for (const item of ret.items) {
        const cur = previouslyReturnedQty.get(item.product_id) || 0;
        previouslyReturnedQty.set(item.product_id, cur + Number(item.qty));
      }
    }

    // Validate if the new return quantities exceed purchased quantities
    for (const item of items) {
      const originalItem = sale.sale_items.find(si => si.product_id === item.product_id);
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

    // Process Return in Transaction
    const no_retur = await generateReturnNumber();
    const returTotal = items.reduce((sum: number, it: any) => sum + (Number(it.qty) * Number(it.unit_price)), 0);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create SaleReturn and SaleReturnItems
      const createdReturn = await tx.saleReturn.create({
        data: {
          id: uuidv4(),
          no_retur,
          sale_id: sale.id,
          no_order: sale.no_order,
          no_faktur: sale.no_faktur,
          customer_id: sale.customer_id,
          customer_nama: sale.customer_nama,
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

      // 2. Adjust Stock for items in 'bagus' condition
      for (const item of items) {
        if (item.kondisi === 'bagus') {
          const product = await tx.product.findUnique({
            where: { id: item.product_id },
          });

          if (product) {
            const stockBefore = Number(product.stok);
            const qtyDelta = Number(item.qty);
            const stockAfter = stockBefore + qtyDelta;

            await tx.product.update({
              where: { id: item.product_id },
              data: {
                stok: {
                  increment: qtyDelta,
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
                qty_delta: qtyDelta,
                staff_nama: req.user?.nama || 'System',
                alasan: `Retur Penjualan (${no_retur})`,
                created_by: req.user?.id || null,
              },
            });
          }
        }
      }

      // 3. Update Customer Receivable (Piutang) if metode_kompensasi is 'potong_piutang' and it was a credit sale
      if (metode_kompensasi === 'potong_piutang' && Number(sale.limit_bulan) > 0) {
        await tx.customer.update({
          where: { id: sale.customer_id },
          data: {
            saldo_piutang: {
              decrement: returTotal,
            },
          },
        });
      }

      return createdReturn;
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating sales return:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sale-returns/customer-history - Get purchase history for a customer and product
saleReturnRouter.get('/customer-history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customer_id, product_id } = req.query;
    if (!customer_id || !product_id) {
      res.status(400).json({ error: 'customer_id dan product_id harus disertakan' });
      return;
    }

    // Find all completed sales for this customer that contain the product
    const sales = await prisma.sale.findMany({
      where: {
        customer_id: customer_id as string,
        status: 'completed',
        sale_items: {
          some: {
            product_id: product_id as string,
          },
        },
      },
      include: {
        sale_items: {
          where: {
            product_id: product_id as string,
          },
        },
        sale_returns: {
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

    // Map each sale to purchase details with calculated returnable quantity
    const history = sales.map((sale) => {
      const item = sale.sale_items[0];
      const qtyPurchased = Number(item.qty);

      // Sum all previously returned quantities for this product in this sale
      const qtyReturned = sale.sale_returns.reduce((sum, ret) => {
        const retItemQty = ret.items.reduce((s, it) => s + Number(it.qty), 0);
        return sum + retItemQty;
      }, 0);

      const qtyRemaining = qtyPurchased - qtyReturned;

      return {
        sale_id: sale.id,
        no_order: sale.no_order,
        no_faktur: sale.no_faktur,
        order_date: sale.order_date,
        limit_bulan: sale.limit_bulan,
        unit_price: Number(item.unit_price),
        qty_beli: qtyPurchased,
        qty_sudah_retur: qtyReturned,
        qty_remaining: qtyRemaining,
      };
    }).filter(h => h.qty_remaining > 0);

    res.json(history);
  } catch (err) {
    console.error('Error fetching customer purchase history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/sale-returns/:id/print - Generate faktur number when printed
saleReturnRouter.patch('/:id/print', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const saleReturn = await prisma.saleReturn.findUnique({ where: { id: req.params.id as string } });
    if (!saleReturn) { res.status(404).json({ error: 'Retur tidak ditemukan' }); return; }

    let no_faktur = saleReturn.no_faktur;
    if (!no_faktur) {
      no_faktur = await generateFakturNumber();
      await prisma.saleReturn.update({
        where: { id: req.params.id as string },
        data: { no_faktur },
      });
    }

    const updatedReturn = await prisma.saleReturn.findUnique({
      where: { id: req.params.id as string },
      include: {
        sale: true,
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

    res.json(updatedReturn);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/sale-returns/:id - Cancel/Delete a sales return
saleReturnRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const saleReturn = await prisma.saleReturn.findUnique({
      where: { id },
      include: { 
        items: true,
        sale: true
      },
    });

    if (!saleReturn) {
      res.status(404).json({ error: 'Retur tidak ditemukan' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Decrement stock back if item condition was 'bagus'
      for (const item of saleReturn.items) {
        if (item.kondisi === 'bagus') {
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
                alasan: `Pembatalan Retur Penjualan (${saleReturn.no_retur})`,
                created_by: req.user?.id || null,
              },
            });
          }
        }
      }

      // 2. Increment Customer Receivable (Piutang) if metode_kompensasi was 'potong_piutang' and it was a credit sale
      if (saleReturn.metode_kompensasi === 'potong_piutang' && Number(saleReturn.sale.limit_bulan) > 0) {
        await tx.customer.update({
          where: { id: saleReturn.sale.customer_id },
          data: {
            saldo_piutang: {
              increment: Number(saleReturn.total),
            },
          },
        });
      }

      // 3. Delete the sales return (cascades to items)
      await tx.saleReturn.delete({
        where: { id },
      });
    });

    res.json({ message: 'Retur penjualan berhasil dibatalkan' });
  } catch (err) {
    console.error('Error deleting sales return:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
