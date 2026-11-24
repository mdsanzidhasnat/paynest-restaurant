import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { getAllowedOrigins } from './config.ts';
import { HttpError } from './errors.ts';
import { requireJson } from './http.ts';
import { errorHandler, requireAuth } from './middleware.ts';
import { authRouter } from './routes/auth.ts';
import { billingRouter } from './routes/billing.ts';
import { inventoryRouter } from './routes/inventory.ts';
import { kitchenRouter } from './routes/kitchen.ts';
import { menuRouter } from './routes/menu.ts';
import { ordersRouter } from './routes/orders.ts';
import { publicRouter } from './routes/public.ts';
import { reportsRouter } from './routes/reports.ts';
import { settingsRouter } from './routes/settings.ts';
import { tablesRouter } from './routes/tables.ts';
import { usersRouter } from './routes/users.ts';

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
  app.use('/api', requireJson);

  // Health, login and the signed-token guest routes are the only
  // unauthenticated /api endpoints. CORS above still allows the site's origin.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);

  app.use('/api', requireAuth);
  app.use('/api/tables', tablesRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/kitchen', kitchenRouter);
  app.use('/api/bills', billingRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/settings', settingsRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });
  app.use(errorHandler);

  return app;
}
