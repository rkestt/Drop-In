import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
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

const TILE_CACHE = `map-tiles-${provider}-v1`;
const STYLE_CACHE = `map-style-${provider}-v1`;

// Gli stili stanno sullo stesso host delle tile: vanno separati, altrimenti un
// CacheFirst di 7 giorni serve stili vecchi al cambio tema e nasconde gli update.
const isStyleRequest = ({ url }: { url: URL }) =>
  url.hostname.endsWith(host) && url.pathname.startsWith("/styles/");

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
      matcher: isStyleRequest,
      handler: new NetworkFirst({
        cacheName: STYLE_CACHE,
        networkTimeoutSeconds: 4,
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
    {
      matcher: ({ url }) => url.hostname.endsWith(host) && !isStyleRequest({ url }),
      handler: new CacheFirst({
        cacheName: TILE_CACHE,
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

// Pulizia cache legacy e versioni vecchie all'activate
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).addEventListener("activate", (event: any) => {
  const current = [TILE_CACHE, STYLE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (k) =>
              (k === "map-tiles" || k.startsWith("map-tiles-") || k.startsWith("map-style-")) &&
              !current.includes(k),
          )
          .map((k) => caches.delete(k)),
      ),
    ),
  );
});

serwist.addEventListeners();