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

const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER === "osm" ? "osm" : "openfreemap";

const tileMatchers: Record<string, { host: string; entries: number }> = {
  openfreemap: { host: "tiles.openfreemap.org", entries: 600 },
  osm: { host: "tile.openstreetmap.org", entries: 1200 },
};

const { host, entries } = tileMatchers[provider];

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
      matcher: ({ url }) => url.hostname.endsWith(host),
      handler: new CacheFirst({
        cacheName: `map-tiles-${provider}-v1`,
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: entries,
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

// Pulizia cache legacy "map-tiles" all'activate
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).addEventListener("activate", (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k === "map-tiles" || k.startsWith("map-tiles-") && k !== `map-tiles-${provider}-v1`)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
});

serwist.addEventListeners();