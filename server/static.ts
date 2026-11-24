import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';

/**
 * Mounts the built SPA after the API. Static responses never pass through the
 * /api CORS, JSON or authentication middleware. Missing bundled assets must
 * not fall through to index.html, which would return HTML with a 200 status.
 */
export function mountStaticFiles(app: Express, distDir: string): void {
  if (!fs.existsSync(distDir)) return;

  app.use(express.static(distDir));
  app.use('/assets', (_req, res) => {
    res.status(404).type('text/plain').send('Asset not found.');
  });
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}
