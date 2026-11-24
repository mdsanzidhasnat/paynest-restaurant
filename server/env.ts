import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { logStage } from './log.ts';
import { PROJECT_ROOT } from './paths.ts';

const envPath = path.join(PROJECT_ROOT, '.env');

// The host environment wins; a .env file is only a local convenience.
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  logStage(`Environment loaded from ${envPath}`);
} else {
  logStage('Environment loaded from process environment (no .env file found)');
}

// The compiled server is production-first. Development scripts set this explicitly.
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}
