import fs from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface RequestLike {
  url: string;
  method?: string;
  mode?: string;
}

interface RoutingPlan {
  action: string;
  cache: boolean;
  reason: string;
}

interface Routing {
  isApiRequest: (request: RequestLike) => boolean;
  isCacheableStatic: (request: RequestLike) => boolean;
  planFor: (request: RequestLike) => RoutingPlan;
}

const origin = 'https://restaurant.test';
const sandbox: {
  self: { location: { origin: string; href: string }; PayNestRouting?: Routing };
  URL: typeof URL;
} = {
  self: { location: { origin, href: `${origin}/sw.js` } },
  URL,
};
runInNewContext(
  fs.readFileSync(path.join(process.cwd(), 'public', 'sw-routing.js'), 'utf8'),
  sandbox
);
const routing = sandbox.self.PayNestRouting!;

const request = (pathname: string, method = 'GET', mode?: string): RequestLike => ({
  url: `${origin}${pathname}`,
  method,
  mode,
});

describe('service worker fetch routing', () => {
  it.each([
    '/api/health',
    '/api/auth/login',
    '/api/public/menu?token=signed',
    '/api/public/orders',
    '/api/public/orders/order-1',
    '/api/tables/1/qr',
    '/api',
  ])('never caches or intercepts %s', (pathname) => {
    const candidate = request(pathname);
    expect(routing.isApiRequest(candidate)).toBe(true);
    expect(routing.isCacheableStatic(candidate)).toBe(false);
    expect(routing.planFor(candidate)).toEqual({
      action: 'network-only',
      cache: false,
      reason: 'api',
    });
  });

  it('never caches API writes, even with a static-looking query string', () => {
    const candidate = request('/api/public/orders?asset=/images/dish.png', 'POST');
    expect(routing.isCacheableStatic(candidate)).toBe(false);
    expect(routing.planFor(candidate).cache).toBe(false);
  });

  it.each([
    '/assets/index-abc123.js',
    '/assets/index-abc123.css',
    '/images/dish_biryani.svg',
    '/icons/icon-192.png',
    '/manifest.webmanifest',
    '/offline.html',
    '/index.html',
    '/',
  ])('caches the static asset %s', (pathname) => {
    const candidate = request(pathname);
    expect(routing.isCacheableStatic(candidate)).toBe(true);
    expect(routing.planFor(candidate)).toEqual({ action: 'static', cache: true, reason: 'static' });
  });

  it('leaves missing assets to the network so the server can return a real 404', () => {
    const candidate = request('/assets/does-not-exist.js');
    expect(routing.planFor(candidate).cache).toBe(true);
    expect(routing.isApiRequest(candidate)).toBe(false);
  });

  it('uses the offline page for failed navigations without caching them', () => {
    const navigation = request('/m/signed-token', 'GET', 'navigate');
    expect(routing.planFor(navigation)).toEqual({
      action: 'navigation',
      cache: false,
      reason: 'navigation',
    });
  });

  it('bypasses worker scripts and cross-origin URLs entirely', () => {
    expect(routing.planFor(request('/sw.js')).cache).toBe(false);
    expect(routing.planFor(request('/sw-routing.js')).cache).toBe(false);
    const external = { url: 'https://other.test/images/dish.png', method: 'GET' };
    expect(routing.isCacheableStatic(external)).toBe(false);
    expect(routing.planFor(external).cache).toBe(false);
  });
});
