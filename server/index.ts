import './env.ts';

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from './app.ts';
import { getJwtSecret, getPort } from './config.ts';
import { closeDb, initDb } from './db.ts';
import { logError, logStage } from './log.ts';
import { getDistDir } from './paths.ts';

function main(): void {
  try {
    getJwtSecret(); // Refuse to start in production without a strong JWT secret.
    initDb();

    const app = createApp();
    const distDir = getDistDir();

    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
          next();
          return;
        }
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }

    logStage('Routes mounted');

    const port = getPort();
    const server = app.listen(port, '0.0.0.0', () => {
      logStage(`Listening on PORT ${port} (0.0.0.0)`);
    });
    server.on('error', (error) => {
      logError(`Unable to listen on PORT ${port}`, error);
      process.exit(1);
    });

    function shutdown(): void {
      server.close(() => {
        closeDb();
        process.exit(0);
      });
    }

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logError('Startup failed', error);
    process.exit(1);
  }
}

main();
