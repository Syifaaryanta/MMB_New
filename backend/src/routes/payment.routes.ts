import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const paymentRouter = Router();

// GET /api/payments - list all payments (penagihan)
paymentRouter.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sale_id, from, to, customer_id, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (sale_id) where.sale_id = sale_id;
    if (from || to) {
      where.payment_date = {};
      if (from) where.payment_date.gte = new Date(from as string);
      if (to) where.payment_date.lte = new Date(to as string);
    }
    if (customer_id) where.sale = { customer_id };

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [data, total] = await Promise.all([
      prisma.salesPayment.findMany({
        where,
        include: { sale: { include: { customer: { select: { nama: true, kode: true } } } } },
        orderBy: { payment_date: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.salesPayment.count({ where }),
    ]);
    res.json({ data, total });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/payments/piutang - active receivables grouped by customer
paymentRouter.get('/piutang', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    const where: any = {
      status: 'completed',
      limit_bulan: { gt: 0 },
      customer: { aktif: true },
    };
    if (q) where.customer = { ...where.customer, nama: { contains: q as string } };

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: true,
        sale_items: true,
        sales_payments: { orderBy: { payment_date: 'desc' } },
      },
      orderBy: { due_date: 'asc' },
    });

    // Group by customer and compute totals
    const grouped: Record<string, any> = {};
    for (const sale of sales) {
      const paidAmount = sale.sales_payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const remaining = Number(sale.subtotal) - paidAmount;
      if (remaining <= 0) continue; // skip fully paid

      const customerId = sale.customer_id;
      if (!grouped[customerId]) {
        grouped[customerId] = {
          customer: sale.customer,
          total_piutang: 0,
          invoices: [],
        };
      }
      grouped[customerId].total_piutang += remaining;
      grouped[customerId].invoices.push({
        ...sale,
        paid_amount: paidAmount,
        remaining,
        is_overdue: sale.due_date ? new Date() > sale.due_date : false,
      });
    }

    res.json(Object.values(grouped));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/payments - Record a payment
paymentRouter.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.SALES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sale_id, payment_date, amount, payment_method, note } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id: sale_id },
      include: { sales_payments: true, customer: true },
    });
    if (!sale) { res.status(404).json({ error: 'SO tidak ditemukan' }); return; }

    const payment = await prisma.salesPayment.create({
      data: {
        id: uuidv4(),
        sale_id,
        payment_date: new Date(payment_date),
        amount,
        payment_method: payment_method || 'cash',
        note,
        created_by: req.user!.id,
      },
      include: { sale: { include: { customer: true } } },
    });

    // Update customer saldo_piutang
    await prisma.customer.update({
      where: { id: sale.customer_id },
      data: { saldo_piutang: { decrement: amount } },
    });

    res.status(201).json(payment);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/payments/:id - Rollback payment
paymentRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = (await prisma.salesPayment.findUnique({
      where: { id: req.params.id as string },
      include: { sale: { include: { customer: true } } },
    })) as any;
    if (!payment) { res.status(404).json({ error: 'Pembayaran tidak ditemukan' }); return; }

    // Restore saldo_piutang
    await prisma.customer.update({
      where: { id: payment.sale.customer_id },
      data: { saldo_piutang: { increment: payment.amount } },
    });

    await prisma.salesPayment.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Pembayaran berhasil di-rollback' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});
