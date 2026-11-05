import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: WorkerGlobalScope;

const isSupabase = (url: URL) =>
  url.hostname.endsWith(".supabase.co") ||
  (url.hostname === "localhost" && url.port === "54321");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => isSupabase(url),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && /^\/(profile|lobbies)/.test(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"),
      handler: new CacheFirst({
        cacheName: "map-tiles",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 1200,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            maxAgeFrom: "last-fetched",
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();