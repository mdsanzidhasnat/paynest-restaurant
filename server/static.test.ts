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
  fs.mkdirSync(path.join(distDir, 'icons'));
  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html><body>PayNest</body></html>');
  fs.writeFileSync(path.join(distDir, 'assets', 'app.js'), 'export const built = true;');
  fs.writeFileSync(path.join(distDir, 'sw.js'), "importScripts('/sw-routing.js');");
  fs.writeFileSync(path.join(distDir, 'sw-routing.js'), 'self.PayNestRouting = {};');
  fs.writeFileSync(path.join(distDir, 'manifest.webmanifest'), '{"short_name":"PayNest"}');
  fs.writeFileSync(path.join(distDir, 'icons', 'icon-192.png'), 'png');
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

  it('serves the worker with no-cache JavaScript headers and the manifest as JSON', async () => {
    const worker = await request(app).get('/sw.js');
    expect(worker.status).toBe(200);
    expect(worker.headers['content-type']).toMatch(/javascript/);
    expect(worker.headers['cache-control']).toBe('no-cache');
    expect(worker.headers['access-control-allow-origin']).toBeUndefined();

    const routing = await request(app).get('/sw-routing.js');
    expect(routing.status).toBe(200);
    expect(routing.headers['content-type']).toMatch(/javascript/);
    expect(routing.headers['cache-control']).toBe('no-cache');

    const manifest = await request(app).get('/manifest.webmanifest');
    expect(manifest.status).toBe(200);
    expect(manifest.headers['content-type']).toMatch(/json/);

    const icon = await request(app).get('/icons/icon-192.png');
    expect(icon.status).toBe(200);
    expect(icon.headers['content-type']).toMatch(/image\/png/);
  });

  it('returns a real 404 for a missing bundled asset', async () => {
    const missing = await request(app).get('/assets/does-not-exist.js');
    expect(missing.status).toBe(404);
    expect(missing.headers['content-type']).toMatch(/text\/plain/);
    expect(missing.text).not.toContain('<html');
  });
});
