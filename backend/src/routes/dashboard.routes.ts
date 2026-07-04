import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const dashboardRouter = Router();

dashboardRouter.get('/kpi', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const from = new Date();
    from.setDate(from.getDate() - days);

    // Today's date is based on the latest completed sales transaction to align with active business day
    const latestSaleForKpi = await prisma.sale.findFirst({
      where: { status: 'completed' },
      orderBy: { order_date: 'desc' },
    });
    const todayStart = latestSaleForKpi ? new Date(latestSaleForKpi.order_date) : new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalSalesResult,
      totalPurchasesResult,
      totalProducts,
      totalActiveCustomers,
      totalActiveSuppliers,
      pendingReceiving,
      totalPiutang,
      criticalStock,
      todaySales,
      todayItems,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { status: 'completed', order_date: { gte: from } },
        _sum: { subtotal: true },
        _count: { id: true },
      }),
      prisma.purchase.aggregate({
        where: { status: { in: ['completed', 'received'] }, order_date: { gte: from } },
        _sum: { subtotal: true },
      }),
      prisma.product.count({ where: { aktif: true, is_archived: false } }),
      prisma.customer.count({ where: { aktif: true } }),
      prisma.supplier.count({ where: { aktif: true } }),
      prisma.purchase.count({ where: { status: 'completed' } }),
      prisma.customer.aggregate({ _sum: { saldo_piutang: true } }),
      prisma.product.count({ where: { aktif: true, is_archived: false, stok: { lte: 10 } } }),
      // Today's completed sales
      prisma.sale.aggregate({
        where: { status: 'completed', order_date: { gte: todayStart, lte: todayEnd } },
        _sum: { subtotal: true },
        _count: { id: true },
      }),
      // Today's total items out (sum of qty from saleItems via completed sales)
      prisma.saleItem.aggregate({
        where: {
          sale: { status: 'completed', order_date: { gte: todayStart, lte: todayEnd } },
        },
        _sum: { qty: true },
      }),
    ]);

    // Sales trend data
    const salesTrend = await prisma.$queryRaw<Array<{ date: any; sales_total: number; sales_count: number }>>`
      SELECT 
        DATE(order_date) as date,
        SUM(subtotal) as sales_total,
        COUNT(id) as sales_count
      FROM sales
      WHERE status = 'completed' AND order_date >= ${from}
      GROUP BY DATE(order_date)
      ORDER BY date ASC
    `;

    // Purchases trend data
    const purchaseTrend = await prisma.$queryRaw<Array<{ date: any; purchase_total: number }>>`
      SELECT 
        DATE(order_date) as date,
        SUM(subtotal) as purchase_total
      FROM purchases
      WHERE status IN ('completed', 'received') AND order_date >= ${from}
      GROUP BY DATE(order_date)
      ORDER BY date ASC
    `;

    // Combine trends by date
    const trendMap: Record<string, { date: string; omzet: number; pembelian: number; penjualan: number }> = {};

    const formatDateKey = (dVal: any): string => {
      if (!dVal) return '';
      if (typeof dVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dVal)) {
        return dVal;
      }
      try {
        const d = new Date(dVal);
        return d.toISOString().slice(0, 10);
      } catch {
        return String(dVal);
      }
    };

    // Populate default dates to prevent gaps in charts
    const tempDate = new Date(from);
    const today = new Date();
    while (tempDate <= today) {
      const k = formatDateKey(tempDate);
      trendMap[k] = { date: k, omzet: 0, pembelian: 0, penjualan: 0 };
      tempDate.setDate(tempDate.getDate() + 1);
    }

    // Populate sales data
    salesTrend.forEach((item) => {
      const k = formatDateKey(item.date);
      if (trendMap[k]) {
        trendMap[k].omzet = Number(item.sales_total) || 0;
        trendMap[k].penjualan = Number(item.sales_count) || 0;
      } else {
        trendMap[k] = {
          date: k,
          omzet: Number(item.sales_total) || 0,
          pembelian: 0,
          penjualan: Number(item.sales_count) || 0
        };
      }
    });

    // Populate purchases data
    purchaseTrend.forEach((item) => {
      const k = formatDateKey(item.date);
      if (trendMap[k]) {
        trendMap[k].pembelian = Number(item.purchase_total) || 0;
      } else {
        trendMap[k] = {
          date: k,
          omzet: 0,
          pembelian: Number(item.purchase_total) || 0,
          penjualan: 0
        };
      }
    });

    const combinedTrend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      kpi: {
        total_omzet: Number(totalSalesResult._sum.subtotal) || 0,
        total_transaksi: totalSalesResult._count.id || 0,
        total_pembelian: Number(totalPurchasesResult._sum.subtotal) || 0,
        total_produk: totalProducts,
        total_customer: totalActiveCustomers,
        total_supplier: totalActiveSuppliers,
        pending_receiving: pendingReceiving,
        total_piutang: Number(totalPiutang._sum.saldo_piutang) || 0,
        stok_kritis: criticalStock,
        today_omzet: Number(todaySales._sum.subtotal) || 0,
        today_transaksi: todaySales._count.id || 0,
        today_barang_keluar: Number(todayItems._sum.qty) || 0,
      },
      trend: combinedTrend,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

dashboardRouter.get('/recent-barang-keluar', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const latestSaleForItems = await prisma.sale.findFirst({
      where: { status: 'completed' },
      orderBy: { order_date: 'desc' },
    });
    const todayStart = latestSaleForItems ? new Date(latestSaleForItems.order_date) : new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const recentSales = await prisma.sale.findMany({
      where: {
        status: 'completed',
        order_date: { gte: todayStart, lte: todayEnd },
      },
      include: {
        customer: { select: { nama: true } },
        sale_items: true,
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    const result = recentSales.map((sale) => {
      const totalQty = sale.sale_items.reduce((sum, item) => sum + Number(item.qty), 0);
      return {
        id: sale.id,
        no_order: sale.no_order,
        customer: sale.customer?.nama ?? sale.customer_nama ?? '-',
        total: Number(sale.subtotal),
        itemCount: sale.sale_items.length,
        totalQty: totalQty,
        waktu: sale.created_at,
      };
    });

    res.json({ items: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

dashboardRouter.get('/stats/gudang', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalSku, amanStok, kritisStok, totalSupplier] = await Promise.all([
      prisma.product.count({ where: { aktif: true, is_archived: false } }),
      prisma.product.count({ where: { aktif: true, is_archived: false, stok: { gt: 10 } } }),
      prisma.product.count({ where: { aktif: true, is_archived: false, stok: { lte: 10 } } }),
      prisma.supplier.count({ where: { aktif: true } }),
    ]);
    res.json({ totalSku, amanStok, kritisStok, totalSupplier });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

dashboardRouter.get('/stats/pembelian', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalPO, menungguTerima, sudahDiterima, supplierAktif] = await Promise.all([
      prisma.purchase.count(),
      prisma.purchase.count({ where: { status: 'completed' } }),
      prisma.purchase.count({ where: { status: 'received' } }),
      prisma.supplier.count({ where: { aktif: true } }),
    ]);
    res.json({ totalPO, menungguTerima, sudahDiterima, supplierAktif });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

dashboardRouter.get('/stats/penjualan', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [hariIni, mingguIni, bulanIni, total] = await Promise.all([
      prisma.sale.aggregate({ where: { status: 'completed', order_date: { gte: startOfDay } }, _sum: { subtotal: true } }),
      prisma.sale.aggregate({ where: { status: 'completed', order_date: { gte: startOfWeek } }, _sum: { subtotal: true } }),
      prisma.sale.aggregate({ where: { status: 'completed', order_date: { gte: startOfMonth } }, _sum: { subtotal: true } }),
      prisma.sale.aggregate({ where: { status: 'completed' }, _sum: { subtotal: true } }),
    ]);

    res.json({
      hariIni: Number(hariIni._sum.subtotal) || 0,
      mingguIni: Number(mingguIni._sum.subtotal) || 0,
      bulanIni: Number(bulanIni._sum.subtotal) || 0,
      total: Number(total._sum.subtotal) || 0,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

dashboardRouter.get('/stats/penagihan', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalPiutang = await prisma.customer.aggregate({ _sum: { saldo_piutang: true } });
    const overdueCount = await prisma.sale.count({
      where: { status: 'completed', limit_bulan: { gt: 0 }, due_date: { lt: new Date() } },
    });
    res.json({
      totalPiutang: Number(totalPiutang._sum.saldo_piutang) || 0,
      overdueCount,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});
