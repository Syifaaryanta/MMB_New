import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const productRouter = Router();

// GET /api/products - All authenticated
productRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, archived, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {
      is_archived: archived === 'true',
    };
    if (archived !== 'true') where.aktif = true;
    if (q) {
      where.OR = [
        { nama: { contains: q as string } },
        { kode: { contains: q as string } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          product_prices: {
            include: { supplier: { select: { id: true, nama: true, kode: true } } },
            where: { aktif: true },
          },
          purchase_items: {
            where: { purchase: { status: 'received' } },
            orderBy: { purchase: { order_date: 'desc' } },
            take: 1,
          },
        },
        orderBy: { nama: 'asc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.product.count({ where }),
    ]);

    const formattedProducts = products.map((p: any) => {
      const latestPurchase = p.purchase_items?.[0];
      const latestPrice = latestPurchase ? Number(latestPurchase.harga_beli) : null;
      return {
        ...p,
        harga_beli_terbaru: latestPrice,
      };
    });

    res.json({ data: formattedProducts, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/:id
productRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id as string },
      include: {
        product_prices: {
          include: { supplier: true },
        },
      },
    });
    if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return; }
    res.json(product);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/products - Admin, staff_gudang
productRouter.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { kode, nama, deskripsi, satuan, foto_urls, prices } = req.body;

    const product = await prisma.product.create({
      data: {
        id: uuidv4(),
        kode,
        nama,
        deskripsi,
        satuan: satuan || 'pcs',
        foto_urls: foto_urls || [],
        stok: 0,
      },
    });

    // Create product prices if provided
    if (prices && Array.isArray(prices)) {
      for (const p of prices) {
        await prisma.productPrice.create({
          data: {
            id: uuidv4(),
            product_id: product.id,
            supplier_id: p.supplier_id,
            stok: p.stok || 0,
            harga_beli: p.harga_beli || 0,
          },
        });
      }

      // Recalculate total product stock
      const allPrices = await prisma.productPrice.findMany({
        where: { product_id: product.id, aktif: true }
      });
      const totalStock = allPrices.reduce((sum, p) => sum + Number(p.stok), 0);

      // Update product total stock
      await prisma.product.update({
        where: { id: product.id },
        data: { stok: totalStock }
      });

      // Automatically log initial stock to StockAdjustment if greater than 0
      if (totalStock > 0) {
        let staffNama = 'Admin';
        if (req.user && req.user.id) {
          const profile = await prisma.profile.findUnique({ where: { id: req.user.id } });
          if (profile) staffNama = profile.nama;
        }

        await prisma.stockAdjustment.create({
          data: {
            id: uuidv4(),
            product_id: product.id,
            product_kode: product.kode,
            product_nama: product.nama,
            adjustment_date: new Date(),
            stock_before: 0,
            stock_after: totalStock,
            qty_delta: totalStock,
            staff_nama: staffNama,
            alasan: 'Stok Awal Barang Baru',
            created_by: req.user?.id || null,
          }
        });
      }
    }

    const created = await prisma.product.findUnique({
      where: { id: product.id },
      include: { product_prices: { include: { supplier: true } } },
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === 'P2002') res.status(409).json({ error: 'Kode produk sudah ada' });
    else { console.error(e); res.status(500).json({ error: 'Server error' }); }
  }
});

// PUT /api/products/:id
productRouter.put('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { kode, nama, deskripsi, satuan, foto_urls, aktif, prices, validation } = req.body;

    const oldProduct = await prisma.product.findUnique({
      where: { id: req.params.id as string }
    });
    if (!oldProduct) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return; }

    const stockBefore = Number(oldProduct.stok);

    await prisma.product.update({
      where: { id: req.params.id as string },
      data: { kode, nama, deskripsi, satuan, foto_urls, aktif },
    });

    // Update product prices
    if (prices && Array.isArray(prices)) {
      for (const p of prices) {
        await prisma.productPrice.upsert({
          where: {
            product_id_supplier_id: {
              product_id: req.params.id as string,
              supplier_id: p.supplier_id,
            },
          },
          update: { stok: p.stok, harga_beli: p.harga_beli, aktif: p.aktif ?? true },
          create: {
            id: uuidv4(),
            product_id: req.params.id as string,
            supplier_id: p.supplier_id,
            stok: p.stok || 0,
            harga_beli: p.harga_beli || 0,
          },
        });
      }
    }

    // Recalculate total product stock from active supplier prices
    const allPrices = await prisma.productPrice.findMany({
      where: { product_id: req.params.id as string, aktif: true }
    });
    const totalStock = allPrices.reduce((sum, p) => sum + Number(p.stok), 0);

    // Update product total stock
    await prisma.product.update({
      where: { id: req.params.id as string },
      data: { stok: totalStock }
    });

    // If validation details are provided, log a StockAdjustment record
    if (validation) {
      const qtyDelta = totalStock - stockBefore;
      await prisma.stockAdjustment.create({
        data: {
          id: uuidv4(),
          product_id: req.params.id as string,
          product_kode: kode || oldProduct.kode,
          product_nama: nama || oldProduct.nama,
          adjustment_date: validation.tanggal ? new Date(validation.tanggal) : new Date(),
          stock_before: stockBefore,
          stock_after: totalStock,
          qty_delta: qtyDelta,
          staff_nama: validation.oleh || req.user!.nama,
          alasan: validation.alasan || 'Koreksi Stok',
          created_by: req.user!.id,
        }
      });
    }

    const updated = await prisma.product.findUnique({
      where: { id: req.params.id as string },
      include: { product_prices: { include: { supplier: true } } },
    });
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/products/:id/archive - Archive product
productRouter.patch('/:id/archive', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id as string },
      data: { is_archived: true, aktif: false },
    });
    res.json(product);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/products/:id/restore - Restore archived product
productRouter.patch('/:id/restore', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_GUDANG), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id as string },
      data: { is_archived: false, aktif: true },
    });
    res.json(product);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/products/:id/price-history - Get price history for a product from a supplier
productRouter.get('/:id/price-history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supplier_id } = req.query;
    const history = await prisma.purchaseItem.findMany({
      where: {
        product_id: req.params.id as string,
        purchase: supplier_id ? { supplier_id: supplier_id as string, status: 'received' } : { status: 'received' },
      },
      include: {
        purchase: {
          select: { no_order: true, order_date: true, created_at: true, supplier: { select: { nama: true } } },
        },
      },
      orderBy: { purchase: { order_date: 'desc' } },
      take: 10,
    });
    res.json(history);
  } catch { res.status(500).json({ error: 'Server error' }); }
});
