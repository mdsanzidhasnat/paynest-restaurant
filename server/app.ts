import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { getAllowedOrigins } from './config.ts';
import { HttpError } from './errors.ts';
import { errorHandler, requireAuth } from './middleware.ts';
import {
  dashboardRouter,
  invoiceSettingsRouter,
  reportsRouter,
  settingsRouter,
  usersRouter,
} from './routes/admin.ts';
import { authRouter } from './routes/auth.ts';
import { categoriesRouter, inventoryRouter, productsRouter } from './routes/catalog.ts';
import { purchasesRouter, salesRouter } from './routes/commerce.ts';
import { customersRouter, duesRouter, suppliersRouter } from './routes/parties.ts';

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  // CORS only governs cross-origin API access. Static files are served
  // same-origin and must never be blocked by the Origin allowlist.
  app.use(
    '/api',
    cors<Request>((req, callback) => {
      const origin = req.headers.origin;
      if (!origin) {
        callback(null, { credentials: true, origin: false });
        return;
      }
      // A browser may send an Origin header on same-origin requests (e.g. POSTs
      // and asset loads). The server's own origin is always safe to allow,
      // even when CORS_ORIGIN has not been set to the deployed URL.
      const ownOrigin = `${req.protocol}://${req.get('host')}`;
      if (origin === ownOrigin || allowedOrigins.includes(origin)) {
        callback(null, { credentials: true, origin });
        return;
      }
      callback(new HttpError(403, 'Origin not allowed by CORS policy.'));
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Health and login are the only /api endpoints without authentication.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);

  app.use('/api', requireAuth);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/invoice-settings', invoiceSettingsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/dues', duesRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });
  app.use(errorHandler);

  return app;
}
