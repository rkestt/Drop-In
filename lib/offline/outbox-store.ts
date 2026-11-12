/**
 * Store modulo per l'outbox offline (issue #24).
 *
 * Fonte di verità: localStorage (`OUTBOX_STORAGE_KEY`). La memoria del modulo
 * è solo una copia di lavoro: ogni mutazione riscrive localStorage e notifica
 * gli iscritti. SSR-safe: sul server (niente `window`) `getSnapshot` torna
 * sempre una array vuota condivisa, quindi è usabile con
 * `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` senza
 * hydration mismatch — il primo render client coincide con il server (vuoto)
 * e i dati veri arrivano con `hydrateOutbox()` chiamato in un effect.
 */

import {
  OUTBOX_STORAGE_KEY,
  createOutboxItem,
  enqueueOutbox,
  parseOutbox,
  pruneOutbox,
  serializeOutbox,
  type OutboxItem,
  type OutboxKind,
} from "@/lib/offline/outbox";

const EMPTY: OutboxItem[] = [];

let queue: OutboxItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function persist(): void {
  const store = storage();
  if (!store) return;
  try {
    const serialized = serializeOutbox(queue);
    // Stringa vuota = serializzazione fallita (quota piena, private mode):
    // non scrivere, il vecchio valore resta su disco e la memoria resta la
    // fonte di verita' fino al prossimo flush.
    if (serialized) store.setItem(OUTBOX_STORAGE_KEY, serialized);
  } catch {
    // Quota piena o storage bloccato: la copia in memoria resta, il prossimo
    // flush la svuota comunque se la rete c'è.
  }
}

function notify(): void {
  for (const l of listeners) l();
}

/** Idempotente: ricarica da localStorage (con prune dei check-in scaduti). Chiamare in un effect al mount. */
export function hydrateOutbox(now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  const store = storage();
  const next = pruneOutbox(
    parseOutbox(store?.getItem(OUTBOX_STORAGE_KEY) ?? null),
    now,
  );
  queue = next;
  loaded = true;
  persist();
  notify();
}

function ensureLoaded(now: number = Date.now()): void {
  if (!loaded && typeof window !== "undefined") {
    const store = storage();
    queue = pruneOutbox(
      parseOutbox(store?.getItem(OUTBOX_STORAGE_KEY) ?? null),
      now,
    );
    loaded = true;
  }
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** SSR-safe: [] sul server e prima dell'hydration, la coda vera dopo. */
export function getOutboxSnapshot(): OutboxItem[] {
  if (typeof window === "undefined" || !loaded) return EMPTY;
  return queue;
}

export function getOutboxServerSnapshot(): OutboxItem[] {
  return EMPTY;
}

/** Accoda dal payload grezzo (l'id lo genera lo store). Torna l'item creato. */
export function enqueue(
  kind: OutboxKind,
  payload: Record<string, unknown>,
  now: number = Date.now(),
  idFactory?: () => string,
): OutboxItem {
  ensureLoaded(now);
  const item = createOutboxItem(kind, payload, now, idFactory);
  queue = enqueueOutbox(queue, item, now);
  persist();
  notify();
  return item;
}

/** Sostituisce la coda (usato dal runner dopo un flush). Persiste e notifica. */
export function updateQueue(
  fn: (q: OutboxItem[]) => OutboxItem[],
): OutboxItem[] {
  ensureLoaded();
  queue = fn(queue);
  persist();
  notify();
  return queue;
}
