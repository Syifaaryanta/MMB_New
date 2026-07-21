import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './lib/prisma';
import { authRouter } from './routes/auth.routes';
import { profileRouter } from './routes/profile.routes';
import { productRouter } from './routes/product.routes';
import { supplierRouter } from './routes/supplier.routes';
import { customerRouter } from './routes/customer.routes';
import { purchaseRouter } from './routes/purchase.routes';
import { saleRouter } from './routes/sale.routes';
import { paymentRouter } from './routes/payment.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { laporanRouter } from './routes/laporan.routes';
import { stockAdjustmentRouter } from './routes/stockAdjustment.routes';
import { saleReturnRouter } from './routes/saleReturn.routes';
import { purchaseReturnRouter } from './routes/purchaseReturn.routes';
import { historyRouter } from './routes/history.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MMB Backend API is running', 
    timestamp: new Date().toISOString() 
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/profiles', profileRouter);
app.use('/api/products', productRouter);
app.use('/api/suppliers', supplierRouter);
app.use('/api/customers', customerRouter);
app.use('/api/purchases', purchaseRouter);
app.use('/api/sales', saleRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/laporan', laporanRouter);
app.use('/api/stock-adjustments', stockAdjustmentRouter);
app.use('/api/sale-returns', saleReturnRouter);
app.use('/api/purchase-returns', purchaseReturnRouter);
app.use('/api/history', historyRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// One-time startup database sync to align supplier stock & upgrade all profiles to super_admin
async function syncDatabaseStockDiscrepancies() {
  try {
    // Upgrade all user profiles to super_admin as requested
    await prisma.profile.updateMany({
      data: { role: 'super_admin' as any }
    });

    const products = await prisma.product.findMany({
      include: {
        product_prices: {
          where: { aktif: true }
        }
      }
    });

    for (const p of products) {
      // If a product has only one active supplier price record
      if (p.product_prices.length === 1) {
        const pp = p.product_prices[0];
        if (Number(pp.stok) !== Number(p.stok)) {
          console.log(`[Sync] Aligning stock for product "${p.nama}": Supplier "${pp.id}" stock was ${pp.stok}, changed to match warehouse stock: ${p.stok}`);
          await prisma.productPrice.update({
            where: { id: pp.id },
            data: { stok: p.stok }
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to run startup stock sync:', err);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 MMB Backend API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  syncDatabaseStockDiscrepancies();
});

export default app;
