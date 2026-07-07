import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const historyRouter = Router();

historyRouter.get('/barang-inout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      no_order,
      customer,
      supplier,
      staff,
      code_item,
      from,
      to,
    } = req.query as {
      no_order?: string;
      customer?: string;
      supplier?: string;
      staff?: string;
      code_item?: string;
      from?: string;
      to?: string;
    };

    const hasCustomerFilter = !!customer;
    const hasSupplierFilter = !!supplier;

    // 1. Fetch Purchases (Incoming Goods)
    let purchaseItems: any[] = [];
    if (!hasCustomerFilter) {
      const purchaseWhere: any = {
        status: 'received',
      };

      if (from || to) {
        purchaseWhere.received_at = {};
        if (from) purchaseWhere.received_at.gte = new Date(from);
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          purchaseWhere.received_at.lte = toDate;
        }
      }

      if (no_order) {
        purchaseWhere.no_order = { contains: no_order };
      }

      if (supplier) {
        purchaseWhere.supplier = {
          nama: { contains: supplier },
        };
      }

      if (staff) {
        purchaseWhere.creator = {
          nama: { contains: staff },
        };
      }

      const itemWhere: any = {};
      if (code_item) {
        itemWhere.product = {
          OR: [
            { kode: { contains: code_item } },
            { nama: { contains: code_item } }
          ]
        };
      }

      const purchases = await prisma.purchase.findMany({
        where: purchaseWhere,
        include: {
          supplier: true,
          creator: true,
          purchase_items: {
            where: itemWhere,
            include: {
              product: true,
            },
          },
        },
      });

      purchases.forEach((p) => {
        p.purchase_items.forEach((item) => {
          purchaseItems.push({
            id: item.id,
            parent_id: p.id,
            type: 'incoming',
            no_order: p.no_order,
            no_faktur: '-',
            tanggal: p.received_at || p.order_date || p.created_at,
            supplier: p.supplier?.nama || '-',
            customer: '-',
            staff: '-',
            product_kode: item.product?.kode || '-',
            product_nama: item.product?.nama || '-',
            stok_berkurang: 0,
            stok_bertambah: Number(item.qty),
            alasan: '-',
          });
        });
      });
    }

    // 2. Fetch Sales (Outgoing Goods)
    let saleItems: any[] = [];
    if (!hasSupplierFilter) {
      const saleWhere: any = {
        status: 'completed',
      };

      if (from || to) {
        saleWhere.order_date = {};
        if (from) saleWhere.order_date.gte = new Date(from);
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          saleWhere.order_date.lte = toDate;
        }
      }

      if (no_order) {
        saleWhere.OR = [
          { no_order: { contains: no_order } },
          { no_faktur: { contains: no_order } }
        ];
      }

      if (customer) {
        saleWhere.customer_nama = { contains: customer };
      }

      if (staff) {
        saleWhere.creator = {
          nama: { contains: staff },
        };
      }

      const itemWhere: any = {};
      if (code_item) {
        itemWhere.OR = [
          { product_kode: { contains: code_item } },
          { product_nama: { contains: code_item } }
        ];
      }

      const sales = await prisma.sale.findMany({
        where: saleWhere,
        include: {
          creator: true,
          sale_items: {
            where: itemWhere,
          },
        },
      });

      sales.forEach((s) => {
        s.sale_items.forEach((item) => {
          saleItems.push({
            id: item.id,
            parent_id: s.id,
            type: 'outgoing',
            no_order: s.no_order,
            no_faktur: s.no_faktur || '-',
            tanggal: s.order_date,
            supplier: '-',
            customer: s.customer_nama,
            staff: '-',
            product_kode: item.product_kode,
            product_nama: item.product_nama,
            stok_berkurang: Number(item.qty),
            stok_bertambah: 0,
            alasan: '-',
          });
        });
      });
    }

    // 3. Fetch Stock Adjustments
    let adjustmentItems: any[] = [];
    if (!hasCustomerFilter && !hasSupplierFilter) {
      const adjWhere: any = {};

      if (from || to) {
        adjWhere.adjustment_date = {};
        if (from) adjWhere.adjustment_date.gte = new Date(from);
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          adjWhere.adjustment_date.lte = toDate;
        }
      }

      if (no_order) {
        const query = no_order.toLowerCase();
        if (!'adjustment'.includes(query) && !'adj'.includes(query)) {
          // If search is for a specific PO/SO, skip adjustments
          adjWhere.id = 'none';
        }
      }

      if (staff) {
        adjWhere.staff_nama = { contains: staff };
      }

      if (code_item) {
        adjWhere.OR = [
          { product_kode: { contains: code_item } },
          { product_nama: { contains: code_item } }
        ];
      }

      const adjustments = await prisma.stockAdjustment.findMany({
        where: adjWhere,
      });

      adjustments.forEach((adj) => {
        const qtyDelta = Number(adj.qty_delta);
        adjustmentItems.push({
          id: adj.id,
          parent_id: adj.id,
          type: 'adjustment',
          no_order: 'ADJUSTMENT',
          no_faktur: '-',
          tanggal: adj.adjustment_date,
          supplier: '-',
          customer: '-',
          staff: adj.staff_nama || '-',
          product_kode: adj.product_kode,
          product_nama: adj.product_nama,
          stok_berkurang: qtyDelta < 0 ? Math.abs(qtyDelta) : 0,
          stok_bertambah: qtyDelta > 0 ? qtyDelta : 0,
          alasan: adj.alasan || '-',
        });
      });
    }

    // Combine all
    const allMovements = [...purchaseItems, ...saleItems, ...adjustmentItems];

    // Sort by tanggal desc
    allMovements.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    res.json({
      data: allMovements,
      total: allMovements.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
