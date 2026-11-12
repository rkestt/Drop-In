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
import { notificationHref } from "@/lib/notifications/link";
import { pushPayloadFromNotification } from "@/lib/notifications/push-payload";

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
  // d24: navigazione offline → shell statica precached (stato 13).
  // Non tocca tile (map-tiles-*) né font: solo il fallback document.
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
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

// Push in arrivo: la function `send-push` manda `{ title, body, data,
// notificationId }`. Il corpo e' costruito da `pushPayloadFromNotification`
// (stessi fallback del centro notifiche); la rotta alla pressione arriva
// da `notificationHref(data)` — unica implementazione della regola href,
// mai calcolata lato server.
interface PushEventData {
  json(): unknown;
}

interface PushEventLike {
  readonly data: PushEventData | null;
  waitUntil(promise: Promise<unknown>): void;
}

interface NotificationClickEventLike {
  readonly notification: {
    readonly data: unknown;
    close(): void;
  };
  waitUntil(promise: Promise<unknown>): void;
}

interface WindowClientLike {
  readonly url: string;
  focus(): Promise<unknown>;
  navigate?(url: string): Promise<unknown>;
}

interface ServiceWorkerScope {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  readonly clients: {
    openWindow(url: string): Promise<unknown>;
    matchAll(options?: {
      type?: string;
      includeUncontrolled?: boolean;
    }): Promise<WindowClientLike[]>;
  };
  readonly registration: {
    showNotification(title: string, options: object): Promise<void>;
  };
}

const swScope = self as unknown as ServiceWorkerScope;
swScope.addEventListener("push", (event) => {
  const pushEvent = event as unknown as PushEventLike;
  let raw: unknown = null;
  try {
    raw = pushEvent.data?.json() ?? null;
  } catch {
    raw = null;
  }
  const record =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const payload = pushPayloadFromNotification({
    id:
      typeof record.notificationId === "string" ? record.notificationId : "push",
    title: record.title,
    body: record.body,
    data: record.data,
  });
  pushEvent.waitUntil(
    swScope.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: payload.tag,
    }),
  );
});

swScope.addEventListener("notificationclick", (event) => {
  const clickEvent = event as unknown as NotificationClickEventLike;
  clickEvent.notification.close();
  const url = notificationHref(clickEvent.notification.data) ?? "/";
  clickEvent.waitUntil(
    swScope.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        const open = wins.find((w) => {
          try {
            return new URL(w.url).pathname === url;
          } catch {
            return false;
          }
        });
        if (open) return open.focus();
        return swScope.clients.openWindow(url);
      }),
  );
});