/** Fired on the window when an updated service worker has taken over. */
export const SW_UPDATE_EVENT = 'paynest:sw-update';

/**
 * Registers the worker only in production builds. During `npm run dev` the
 * browser uses the network directly; the worker itself never handles /api.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if (event.data && event.data.type === 'PAYNEST_SW_UPDATED') {
      window.dispatchEvent(new Event(SW_UPDATE_EVENT));
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app still works online when registration is unavailable, for
      // example on a browser without a secure context.
    });
  });
}
