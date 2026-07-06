import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 MMB Backend API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
