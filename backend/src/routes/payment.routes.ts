import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const paymentRouter = Router();

// GET /api/payments - list all payments (individual payments)
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
      orderBy: { order_date: 'asc' }, // FIFO: oldest invoices first
    });

    const grouped: Record<string, any> = {};
    for (const sale of sales) {
      const paidAmount = sale.sales_payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const remaining = Number(sale.subtotal) + Number(sale.biaya_pengiriman || 0) - paidAmount;
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

// POST /api/payments - Record a simple payment (keeps backward compatibility)
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

// DELETE /api/payments/:id - Rollback simple payment (keeps backward compatibility)
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

// POST /api/payments/session - Record a billing session (customer AR)
paymentRouter.post('/session', authenticate, authorize(ROLES.ADMIN, ROLES.SALES, ROLES.STAFF_KANTOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customer_id, payment_date, total_amount, payment_method, mode, catatan, allocations } = req.body;

    const customer = await prisma.customer.findUnique({ where: { id: customer_id } });
    if (!customer) { res.status(404).json({ error: 'Customer tidak ditemukan' }); return; }

    // Create the session
    const sessionId = uuidv4();
    const billingSession = await prisma.billingSession.create({
      data: {
        id: sessionId,
        session_date: new Date(payment_date),
        tipe: 'customer',
        target_id: customer_id,
        target_nama: customer.nama,
        total_amount,
        payment_method: payment_method || 'cash',
        mode: mode || 'fifo',
        catatan,
        created_by: req.user!.id,
      }
    });

    let finalAllocations: Array<{ sale_id: string; amount: number; is_full_payment: boolean; remaining_after: number }> = [];

    if (mode === 'fifo') {
      const sales = await prisma.sale.findMany({
        where: {
          customer_id,
          status: 'completed',
          limit_bulan: { gt: 0 },
        },
        include: { sales_payments: true },
        orderBy: { order_date: 'asc' },
      });

      let remainingUang = Number(total_amount);
      for (const sale of sales) {
        if (remainingUang <= 0) break;

        const totalPaid = sale.sales_payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const grandTotal = Number(sale.subtotal) + Number(sale.biaya_pengiriman || 0);
        const sisaTagihan = grandTotal - totalPaid;

        if (sisaTagihan <= 0) continue;

        const allocate = Math.min(remainingUang, sisaTagihan);
        remainingUang -= allocate;

        finalAllocations.push({
          sale_id: sale.id,
          amount: allocate,
          is_full_payment: allocate >= sisaTagihan,
          remaining_after: sisaTagihan - allocate,
        });
      }
    } else {
      // Manual mode allocations
      for (const alloc of (allocations || [])) {
        const sale = await prisma.sale.findUnique({
          where: { id: alloc.sale_id },
          include: { sales_payments: true },
        });

        if (sale && sale.customer_id === customer_id) {
          const totalPaid = sale.sales_payments.reduce((sum, p) => sum + Number(p.amount), 0);
          const grandTotal = Number(sale.subtotal) + Number(sale.biaya_pengiriman || 0);
          const sisaTagihan = grandTotal - totalPaid;

          finalAllocations.push({
            sale_id: sale.id,
            amount: alloc.amount,
            is_full_payment: alloc.amount >= sisaTagihan,
            remaining_after: sisaTagihan - alloc.amount,
          });
        }
      }
    }

    // Write allocations and payments
    for (const alloc of finalAllocations) {
      await prisma.billingAllocation.create({
        data: {
          id: uuidv4(),
          billing_session_id: sessionId,
          sale_id: alloc.sale_id,
          allocated_amount: alloc.amount,
          is_full_payment: alloc.is_full_payment,
          remaining_after: alloc.remaining_after,
        }
      });

      // Create individual payment record for compatibility & logs (include Session ID in note)
      await prisma.salesPayment.create({
        data: {
          id: uuidv4(),
          sale_id: alloc.sale_id,
          payment_date: new Date(payment_date),
          amount: alloc.amount,
          payment_method: payment_method || 'cash',
          note: `Sesi Penagihan: ${catatan || ''} [Session ID: ${sessionId}]`,
          created_by: req.user!.id,
        }
      });
    }

    // Update customer total piutang
    const allocatedSum = finalAllocations.reduce((sum, a) => sum + a.amount, 0);
    await prisma.customer.update({
      where: { id: customer_id },
      data: { saldo_piutang: { decrement: allocatedSum } }
    });

    res.status(201).json({ billingSession, allocations: finalAllocations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/sessions - list billing sessions (logs)
paymentRouter.get('/sessions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tipe, from, to } = req.query;
    const where: any = {};
    if (tipe) where.tipe = tipe as string;
    if (from || to) {
      where.session_date = {};
      if (from) where.session_date.gte = new Date(from as string);
      if (to) where.session_date.lte = new Date(to as string);
    }

    const sessions = await prisma.billingSession.findMany({
      where,
      include: {
        creator: { select: { nama: true } },
        allocations: {
          include: {
            sale: { select: { no_faktur: true, no_order: true } },
            purchase: { select: { no_order: true } },
          }
        }
      },
      orderBy: { session_date: 'desc' }
    });
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/sessions/:id - detail for receipt print
paymentRouter.get('/sessions/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.billingSession.findUnique({
      where: { id: req.params.id as string },
      include: {
        creator: { select: { nama: true } },
        allocations: {
          include: {
            sale: { include: { customer: true } },
            purchase: { include: { supplier: true } },
          }
        }
      }
    });
    if (!session) { res.status(404).json({ error: 'Sesi penagihan tidak ditemukan' }); return; }
    res.json(session);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/payments/sessions/:id - Rollback billing session
paymentRouter.delete('/sessions/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = (await prisma.billingSession.findUnique({
      where: { id: req.params.id as string },
      include: { allocations: true },
    })) as any;
    if (!session) { res.status(404).json({ error: 'Sesi penagihan tidak ditemukan' }); return; }

    const allocatedSum = (session.allocations as any[]).reduce((sum: number, a: any) => sum + Number(a.allocated_amount), 0);

    if (session.tipe === 'customer') {
      // Restore customer saldo_piutang
      await prisma.customer.update({
        where: { id: session.target_id },
        data: { saldo_piutang: { increment: allocatedSum } }
      });

      // Remove the generated individual SalesPayments by matching Session ID in note
      for (const alloc of session.allocations) {
        if (alloc.sale_id) {
          const sps = await prisma.salesPayment.findMany({
            where: {
              sale_id: alloc.sale_id,
              note: { contains: session.id }
            }
          });
          for (const sp of sps) {
            await prisma.salesPayment.delete({ where: { id: sp.id } });
          }
        }
      }
    } else {
      // For supplier, remove the generated individual SupplierPayments by matching Session ID in note
      for (const alloc of session.allocations) {
        if (alloc.purchase_id) {
          const sps = await prisma.supplierPayment.findMany({
            where: {
              purchase_id: alloc.purchase_id,
              note: { contains: session.id }
            }
          });
          for (const sp of sps) {
            await prisma.supplierPayment.delete({ where: { id: sp.id } });
          }
        }
      }
    }

    // Delete the session (allocations will cascade delete due to schema)
    await prisma.billingSession.delete({ where: { id: session.id } });

    res.json({ message: 'Sesi penagihan berhasil di-rollback' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/supplier/debt - Active accounts payable (AP) grouped by supplier
paymentRouter.get('/supplier/debt', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    const where: any = {
      status: { in: ['completed', 'received'] },
      terms: { not: 'tunai' },
      supplier: { aktif: true },
    };
    if (q) where.supplier = { ...where.supplier, nama: { contains: q as string } };

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        supplier_payments: { orderBy: { payment_date: 'desc' } },
      },
      orderBy: { order_date: 'asc' }, // FIFO
    });

    const grouped: Record<string, any> = {};
    for (const purchase of purchases) {
      const paidAmount = purchase.supplier_payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const remaining = Number(purchase.subtotal) + Number(purchase.biaya_pengiriman || 0) - paidAmount;
      if (remaining <= 0) continue; // fully paid

      const supplierId = purchase.supplier_id;
      if (!grouped[supplierId]) {
        grouped[supplierId] = {
          supplier: purchase.supplier,
          total_hutang: 0,
          purchases: [],
        };
      }
      grouped[supplierId].total_hutang += remaining;
      grouped[supplierId].purchases.push({
        ...purchase,
        paid_amount: paidAmount,
        remaining,
      });
    }

    res.json(Object.values(grouped));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/payments/supplier/session - Record supplier payment session (AP)
paymentRouter.post('/supplier/session', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF_KANTOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supplier_id, payment_date, total_amount, payment_method, mode, catatan, allocations } = req.body;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplier_id } });
    if (!supplier) { res.status(404).json({ error: 'Supplier tidak ditemukan' }); return; }

    const sessionId = uuidv4();
    const billingSession = await prisma.billingSession.create({
      data: {
        id: sessionId,
        session_date: new Date(payment_date),
        tipe: 'supplier',
        target_id: supplier_id,
        target_nama: supplier.nama,
        total_amount,
        payment_method: payment_method || 'cash',
        mode: mode || 'fifo',
        catatan,
        created_by: req.user!.id,
      }
    });

    let finalAllocations: Array<{ purchase_id: string; amount: number; is_full_payment: boolean; remaining_after: number }> = [];

    if (mode === 'fifo') {
      const purchases = await prisma.purchase.findMany({
        where: {
          supplier_id,
          status: { in: ['completed', 'received'] },
          terms: { not: 'tunai' },
        },
        include: { supplier_payments: true },
        orderBy: { order_date: 'asc' },
      });

      let remainingUang = Number(total_amount);
      for (const pur of purchases) {
        if (remainingUang <= 0) break;

        const totalPaid = pur.supplier_payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const grandTotal = Number(pur.subtotal) + Number(pur.biaya_pengiriman || 0);
        const sisaHutang = grandTotal - totalPaid;

        if (sisaHutang <= 0) continue;

        const allocate = Math.min(remainingUang, sisaHutang);
        remainingUang -= allocate;

        finalAllocations.push({
          purchase_id: pur.id,
          amount: allocate,
          is_full_payment: allocate >= sisaHutang,
          remaining_after: sisaHutang - allocate,
        });
      }
    } else {
      // Manual mode allocations
      for (const alloc of (allocations || [])) {
        const pur = await prisma.purchase.findUnique({
          where: { id: alloc.purchase_id },
          include: { supplier_payments: true },
        });

        if (pur && pur.supplier_id === supplier_id) {
          const totalPaid = pur.supplier_payments.reduce((sum, p) => sum + Number(p.amount), 0);
          const grandTotal = Number(pur.subtotal) + Number(pur.biaya_pengiriman || 0);
          const sisaHutang = grandTotal - totalPaid;

          finalAllocations.push({
            purchase_id: pur.id,
            amount: alloc.amount,
            is_full_payment: alloc.amount >= sisaHutang,
            remaining_after: sisaHutang - alloc.amount,
          });
        }
      }
    }

    // Write allocations and payments
    for (const alloc of finalAllocations) {
      await prisma.billingAllocation.create({
        data: {
          id: uuidv4(),
          billing_session_id: sessionId,
          purchase_id: alloc.purchase_id,
          allocated_amount: alloc.amount,
          is_full_payment: alloc.is_full_payment,
          remaining_after: alloc.remaining_after,
        }
      });

      // Create individual SupplierPayment record (include Session ID in note)
      await prisma.supplierPayment.create({
        data: {
          id: uuidv4(),
          purchase_id: alloc.purchase_id,
          payment_date: new Date(payment_date),
          amount: alloc.amount,
          payment_method: payment_method || 'cash',
          note: `Sesi Pembayaran AP: ${catatan || ''} [Session ID: ${sessionId}]`,
          created_by: req.user!.id,
        }
      });
    }

    res.status(201).json({ billingSession, allocations: finalAllocations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
