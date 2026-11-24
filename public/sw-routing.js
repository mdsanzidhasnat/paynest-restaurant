/**
 * Pure fetch-routing rules for the PayNest service worker. Kept in a classic
 * script so the worker can import it without a bundler and tests can evaluate
 * the same file in a Node VM. It performs no caching itself.
 */
(function (scope) {
  'use strict';

  var SHELL_PATHS = ['/', '/index.html', '/offline.html', '/manifest.webmanifest'];
  var WORKER_PATHS = ['/sw.js', '/sw-routing.js'];

  function pathnameOf(request) {
    if (!request || typeof request.url !== 'string') return '';
    try {
      return new URL(request.url).pathname;
    } catch {
      return '';
    }
  }

  function isSameOrigin(request) {
    if (!request || typeof request.url !== 'string') return false;
    try {
      return new URL(request.url).origin === scope.location.origin;
    } catch {
      return false;
    }
  }

  function isApiRequest(request) {
    var pathname = pathnameOf(request);
    return pathname === '/api' || pathname.startsWith('/api/');
  }

  function isCacheableStatic(request) {
    if (!request || request.method !== 'GET' || !isSameOrigin(request)) return false;
    var pathname = pathnameOf(request);
    if (isApiRequest(request) || WORKER_PATHS.indexOf(pathname) !== -1) return false;
    return (
      SHELL_PATHS.indexOf(pathname) !== -1 ||
      pathname.startsWith('/assets/') ||
      pathname.startsWith('/images/') ||
      pathname.startsWith('/icons/')
    );
  }

  /**
   * Returns how the worker must handle a request. API requests are always
   * network-only: the worker neither caches them nor serves a cached response.
   */
  function planFor(request) {
    if (!isSameOrigin(request)) return { action: 'network-only', cache: false, reason: 'external' };
    var pathname = pathnameOf(request);
    if (isApiRequest(request)) return { action: 'network-only', cache: false, reason: 'api' };
    if (WORKER_PATHS.indexOf(pathname) !== -1) {
      return { action: 'network-only', cache: false, reason: 'worker' };
    }
    if (request.mode === 'navigate') return { action: 'navigation', cache: false, reason: 'navigation' };
    if (isCacheableStatic(request)) return { action: 'static', cache: true, reason: 'static' };
    return { action: 'network-only', cache: false, reason: 'other' };
  }

  scope.PayNestRouting = { isApiRequest: isApiRequest, isCacheableStatic: isCacheableStatic, planFor: planFor };
})(self);
