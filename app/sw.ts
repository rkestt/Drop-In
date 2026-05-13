import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ request }) => {
        const url = new URL(request.url);
        return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname.endsWith('.supabase.co');
      },
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request }) => {
        const url = new URL(request.url);
        return url.pathname.startsWith('/api/courts');
      },
      handler: new CacheFirst({
        cacheName: "courts-api",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*$/,
      handler: new CacheFirst({
        cacheName: "map-tiles",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();