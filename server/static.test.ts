import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mountStaticFiles } from './static.ts';

let distDir: string;
let app: ReturnType<typeof express>;

beforeAll(() => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paynest-static-'));
  fs.mkdirSync(path.join(distDir, 'assets'));
  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html><body>PayNest</body></html>');
  fs.writeFileSync(path.join(distDir, 'assets', 'app.js'), 'console.log("built");');
  app = express();
  mountStaticFiles(app, distDir);
});

afterAll(() => {
  fs.rmSync(distDir, { recursive: true, force: true });
});

describe('built static files', () => {
  it('serves the SPA shell and existing bundled assets', async () => {
    const root = await request(app).get('/');
    expect(root.status).toBe(200);
    expect(root.headers['content-type']).toMatch(/text\/html/);
    expect(root.text).toContain('PayNest');

    const asset = await request(app).get('/assets/app.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['content-type']).toMatch(/javascript/);
  });

  it('returns a real 404 for a missing bundled asset', async () => {
    const missing = await request(app).get('/assets/does-not-exist.js');
    expect(missing.status).toBe(404);
    expect(missing.headers['content-type']).toMatch(/text\/plain/);
    expect(missing.text).not.toContain('<html');
  });
});
