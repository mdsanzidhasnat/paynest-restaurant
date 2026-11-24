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

  // The worker and its routing script must be rechecked on every navigation:
  // a long-lived static cache could otherwise keep an old worker installed.
  for (const workerFile of ['sw.js', 'sw-routing.js']) {
    app.get(`/${workerFile}`, (_req, res) => {
      const filePath = path.join(distDir, workerFile);
      if (!fs.existsSync(filePath)) {
        res.status(404).type('text/plain').send('Worker not found.');
        return;
      }
      res.set('Cache-Control', 'no-cache').type('application/javascript').sendFile(filePath);
    });
  }

  app.get('/manifest.webmanifest', (_req, res) => {
    const filePath = path.join(distDir, 'manifest.webmanifest');
    if (!fs.existsSync(filePath)) {
      res.status(404).type('text/plain').send('Manifest not found.');
      return;
    }
    res.type('application/manifest+json').sendFile(filePath);
  });

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
