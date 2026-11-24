/**
 * PayNest static-asset service worker. It never handles /api requests, so no
 * API response (including signed public QR responses) is cached or replayed.
 * Bump CACHE_NAME whenever a deploy should replace cached static assets, and
 * also bump it when sw-routing.js changes because the worker byte-check does
 * not watch imported scripts.
 */
/* global importScripts, caches, clients */
importScripts('/sw-routing.js');

var CACHE_NAME = 'paynest-static-v1';
var SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(SHELL_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        var oldCaches = keys.filter(function (key) {
          return key.indexOf('paynest-static-') === 0 && key !== CACHE_NAME;
        });
        var wasUpdate = oldCaches.length > 0;
        return Promise.all(
          oldCaches.map(function (key) {
            return caches.delete(key);
          })
        ).then(function () {
          return wasUpdate;
        });
      })
      .then(function (wasUpdate) {
        return self.clients.claim().then(function () {
          if (!wasUpdate) return undefined;
          return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
            windows.forEach(function (client) {
              client.postMessage({ type: 'PAYNEST_SW_UPDATED' });
            });
          });
        });
      })
  );
});

self.addEventListener('fetch', function (event) {
  var plan = self.PayNestRouting.planFor(event.request);
  if (plan.action === 'network-only') return;

  if (plan.action === 'navigation') {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match('/offline.html').then(function (cached) {
          return (
            cached ||
            new Response(
              '<!doctype html><title>Offline — PayNest Restaurant</title><h1>You’re offline</h1><p>Live orders need a connection. Reconnect and try again.</p>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          );
        });
      })
    );
    return;
  }

  // Static shell and assets: network first so a missing /assets file stays a
  // real 404, with a cached copy only as an offline fallback.
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then(function (cache) {
              return cache.put(event.request, copy);
            })
            .catch(function () {
              /* A full or unavailable cache must not break the response. */
            });
        }
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || Response.error();
        });
      })
  );
});
