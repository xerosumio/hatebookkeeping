import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import quotationRoutes from './routes/quotations.js';
import invoiceRoutes from './routes/invoices.js';
import receiptRoutes from './routes/receipts.js';
import transactionRoutes from './routes/transactions.js';
import payeeRoutes from './routes/payees.js';
import paymentRequestRoutes from './routes/paymentRequests.js';
import recurringRoutes from './routes/recurring.js';
import reimbursementRoutes from './routes/reimbursements.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/uploads.js';
import entityRoutes from './routes/entities.js';
import shareholderRoutes from './routes/shareholders.js';
import monthlyCloseRoutes from './routes/monthlyClose.js';
import { startScheduler } from './scheduler.js';

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use('/api/uploads', express.static(path.resolve(env.uploadDir)));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/payees', payeeRoutes);
app.use('/api/payment-requests', paymentRequestRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/reimbursements', reimbursementRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/shareholders', shareholderRoutes);
app.use('/api/monthly-close', monthlyCloseRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

async function start() {
  await connectDB();
  startScheduler();
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
}

start();
