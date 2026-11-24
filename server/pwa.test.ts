import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();
const readPublicFile = (relativePath: string) => fs.readFileSync(path.join(rootDir, 'public', relativePath), 'utf8');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngDimensions(relativePath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(path.join(rootDir, 'public', relativePath));
  expect(buffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(buffer.toString('ascii', 12, 16)).toBe('IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('web app manifest', () => {
  const manifest = JSON.parse(readPublicFile('manifest.webmanifest'));

  it('declares the required install metadata and brand colours', () => {
    expect(manifest.name).toContain('PayNest Restaurant');
    expect(manifest.short_name).toBe('PayNest');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('any');
    expect(manifest.background_color).toBe('#F6F8FB');
    expect(manifest.theme_color).toBe('#4F46E5');
  });

  it('ships local icons in all three required sizes and purposes', () => {
    expect(manifest.icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ]);
    expect(JSON.stringify(manifest)).not.toMatch(/https?:\/\//);
  });

  it('is linked with the matching theme colour from index.html', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#4F46E5" />');
  });
});

describe('locally generated icons', () => {
  it('contains valid PNG files at the declared sizes', () => {
    expect(pngDimensions('icons/icon-192.png')).toEqual({ width: 192, height: 192 });
    expect(pngDimensions('icons/icon-512.png')).toEqual({ width: 512, height: 512 });
    expect(pngDimensions('icons/icon-maskable-512.png')).toEqual({ width: 512, height: 512 });
  });
});

describe('service worker source', () => {
  const worker = readPublicFile('sw.js');
  const offlinePage = readPublicFile('offline.html');

  it('uses a versioned cache and the shared routing rules', () => {
    expect(worker).toContain("importScripts('/sw-routing.js')");
    expect(worker).toMatch(/CACHE_NAME = 'paynest-static-v\d+'/);
    expect(worker).toContain('caches.delete(key)');
    expect(worker).toContain("postMessage({ type: 'PAYNEST_SW_UPDATED' })");
  });

  it('never names an API path in its caching logic', () => {
    expect(worker).not.toMatch(/['"`]\/api/);
    expect(offlinePage).toContain('Live orders need a connection');
  });
});

describe('built PWA assets', () => {
  it('copies the manifest, worker and icons into dist', () => {
    const distDir = path.join(rootDir, 'dist');
    expect(fs.existsSync(path.join(distDir, 'index.html'))).toBe(true);
    for (const file of [
      'manifest.webmanifest',
      'offline.html',
      'sw.js',
      'sw-routing.js',
      'icons/icon-192.png',
      'icons/icon-512.png',
      'icons/icon-maskable-512.png',
    ]) {
      expect(fs.existsSync(path.join(distDir, file)), `dist/${file} is missing`).toBe(true);
    }
  });
});
