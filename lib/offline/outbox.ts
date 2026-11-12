/**
 * Outbox offline per check-in e lobby join/leave (issue #24).
 *
 * Modulo puro: niente DOM, niente Supabase, niente Date.now implicito.
 * La coda vive in memoria e viene persistita su localStorage dallo store
 * (`lib/offline/outbox-store.ts`); qui ci sono solo le transizioni testabili.
 *
 * Idempotenza garantita dal DB, non dalla coda:
 * - `UNIQUE(lobby_id, user_id)` su `lobby_participants` (001): un join
 *   riprodotto due volte fallisce con `duplicate key value violates unique
 *   constraint` → classificato `duplicate`, non errore.
 * - Trigger `enforce_check_in_cooldown` (001): `Devi attendere 5 minuti
 *   prima di fare di nuovo check-in su questo campo` → `duplicate`
 *   ("già registrato", non un fallimento).
 * - Trigger `enforce_check_in_distance` (001): `Sei troppo lontano dal
 *   campo (N m). Avvicinati per fare check-in.` → `permanent`: le coordinate
 *   in coda sono congelate, riprovare non cambia mai l'esito.
 *
 * Regola join/leave (collapse): join e leave sulla stessa lobby si annullano
 * a vicenda. Vale in entrambe le direzioni perché la UI ottimistica rispecchia
 * già lo stato finale:
 * - join-then-leave: il server non ha mai visto il join, non c'è niente da
 *   inviare → si rimuove il join accodato e non si aggiunge il leave.
 * - leave-then-join: il server ha ancora la riga, lo stato finale è "dentro"
 *   come sul server → si rimuove il leave accodato e non si aggiunge il join.
 * In entrambi i casi il risultato è "niente da inviare".
 */

export type OutboxKind = "check_in" | "lobby_join" | "lobby_leave";

export type OutboxOutcome = "ok" | "duplicate" | "transient" | "permanent";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  /** Dedupe + collapse: `check_in:<court_id>`, `lobby_join:<lobby_id>`, `lobby_leave:<lobby_id>`. */
  key: string;
  payload: Record<string, unknown>;
  enqueuedAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export const OUTBOX_STORAGE_KEY = "dropin:outbox:v1";
export const OUTBOX_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_OUTBOX_ITEMS = 20;

/** Chiave di dedupe: il kind fa da namespace, così un check-in e un join sulla stessa corte non collidono mai. */
export function outboxKey(
  kind: OutboxKind,
  payload: Record<string, unknown>,
): string {
  if (kind === "check_in") return `check_in:${String(payload.court_id ?? "")}`;
  if (kind === "lobby_join") return `lobby_join:${String(payload.lobby_id ?? "")}`;
  return `lobby_leave:${String(payload.lobby_id ?? "")}`;
}

export function createOutboxItem(
  kind: OutboxKind,
  payload: Record<string, unknown>,
  now: number,
  idFactory: () => string = () => crypto.randomUUID(),
): OutboxItem {
  return {
    id: idFactory(),
    kind,
    key: outboxKey(kind, payload),
    payload,
    enqueuedAt: now,
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
  };
}

function lobbyIdOf(kind: OutboxKind, payload: Record<string, unknown>): string | null {
  if (kind !== "lobby_join" && kind !== "lobby_leave") return null;
  const v = payload.lobby_id;
  return typeof v === "string" && v !== "" ? v : null;
}

/**
 * Accoda un item. Ritorna sempre una nuova array.
 * - Dedupe per `key`: il payload nuovo sostituisce quello vecchio, ma
 *   `enqueuedAt` resta quello originale (il TTL scade dal primo tentativo) e
 *   `attempts` riparte da 0 con `nextAttemptAt = now` (subito dovuto).
 * - Collapse join/leave (vedi nota in testa al file): se arriva un
 *   `lobby_leave` mentre il `lobby_join` per la stessa lobby è ancora in coda
 *   (o viceversa), entrambi vengono scartati e la coda torna senza nessuno dei
 *   due — non c'è niente da inviare al server.
 * - Cap a `MAX_OUTBOX_ITEMS`: oltre il limite si scarta l'item più vecchio
 *   (per `enqueuedAt`, a parità il primo in coda).
 */
export function enqueueOutbox(
  queue: OutboxItem[],
  item: OutboxItem,
  now: number,
): OutboxItem[] {
  const lobbyId = lobbyIdOf(item.kind, item.payload);
  if (lobbyId !== null) {
    const opposite: OutboxKind =
      item.kind === "lobby_join" ? "lobby_leave" : "lobby_join";
    const oppositeKey =
      opposite === "lobby_join" ? `lobby_join:${lobbyId}` : `lobby_leave:${lobbyId}`;
    if (queue.some((q) => q.key === oppositeKey)) {
      return queue.filter((q) => q.key !== oppositeKey);
    }
  }

  const prev = queue.find((q) => q.key === item.key);
  const rest = queue.filter((q) => q.key !== item.key);
  const merged: OutboxItem =
    prev !== undefined
      ? { ...item, enqueuedAt: prev.enqueuedAt, attempts: 0, nextAttemptAt: now, lastError: null }
      : item;
  const capped =
    rest.length >= MAX_OUTBOX_ITEMS
      ? [...rest].sort((a, b) => a.enqueuedAt - b.enqueuedAt).slice(1)
      : rest;
  return [...capped, merged];
}

/**
 * Scade i check-in più vecchi di `OUTBOX_TTL_MS` (2 h): il pg_cron fa
 * l'auto-checkout dopo 2 h, quindi riprodurre un check-in più vecchio
 * scriverebbe una riga già morta. `lobby_join`/`lobby_leave` non scadono mai:
 * una riga partecipante resta valida finché la lobby esiste.
 * Scaduto esattamente a 2 h = scartato (`now - enqueuedAt >= TTL`).
 */
export function pruneOutbox(queue: OutboxItem[], now: number): OutboxItem[] {
  return queue.filter(
    (q) => q.kind !== "check_in" || now - q.enqueuedAt < OUTBOX_TTL_MS,
  );
}

/** Sottoinsieme dovuto adesso (`nextAttemptAt <= now`). Non scade niente da solo: usare `pruneOutbox` prima. */
export function dueOutbox(queue: OutboxItem[], now: number): OutboxItem[] {
  return queue.filter((q) => q.nextAttemptAt <= now);
}

/**
 * Classifica un errore di replay. Case-insensitive. I chiamanti passano
 * `"${code} ${message}"` così i codici PostgREST (42501, 23505, P0001)
 * restano visibili alla classifica.
 *
 * - `duplicate`: il server ha già l'effetto, niente da fare.
 *   - `duplicate key value violates unique constraint "lobby_participants_…"`
 *     (UNIQUE(lobby_id,user_id), codice 23505) e `UNIQUE` in generale.
 *   - `already`: `already exists` di PostgREST.
 *   - `già`: `Hai già un check-in attivo su questo campo`,
 *     `Sei già dentro questa lobby.`
 *   - `cooldown` / `attendere`: `Devi attendere 5 minuti prima di fare di
 *     nuovo check-in su questo campo` (il cooldown implica un check-in
 *     recente già registrato).
 *   - `troppo vicino` / `recent`: famiglia degli errori di prossimità/duplicato
 *     di altri backend (tenuti per tolleranza).
 * - `permanent`: riprovare non serve, serve un'azione dell'utente o è un dato
 *   congelato sbagliato. Rimosso senza retry.
 *   - `42501`: RLS/policy negate (`new row violates row-level security
 *     policy`, `Non autorizzato a modificare il profilo`, guard 028). Include anche `Non autorizzato` in chiaro (026: `Non autorizzato.`).
 *   - `P0001`: validazione dei trigger SQL (`Karma troppo basso (%). Non puoi
 *     partecipare.`, `Sei bannato fino a …`, `Inserisci un nome o una foto.`).
 *     Include anche le forme in chiaro: `non valido`, `limite`,
 *     `non puoi partecipare`, `bannat…`, `karma`.
 *   - Distanza: `Sei troppo lontano dal campo (N m). Avvicinati per fare
 *     check-in.` — le coordinate in coda sono congelate, un replay non può
 *     mai passare (`lontano`, `fuori raggio`, `avvicinati`).
 *   - Sessione: `accesso`, `login`, `sessione` (senza login il replay fallisce
 *     sempre con 42501: serve che l'utente rientri, non un retry).
 * - `transient`: tutto il resto, incluso null/undefined (rete giù, timeout,
 *   `Failed to fetch`, `NetworkError`, 5xx, `connection reset`). Solo questo
 *   bucket viene ritentato con backoff.
 */
export function classifyOutboxError(
  message: string | null | undefined,
): "duplicate" | "permanent" | "transient" {
  if (message === null || message === undefined) return "transient";
  if (
    /duplicate|already|già|UNIQUE|cooldown|attendere|troppo vicino|recent/i.test(
      message,
    )
  ) {
    return "duplicate";
  }
  if (
    /42501|P0001|non autorizzat[oi]|non valido|limite|non puoi partecipare|bannat|karma|troppo lontano|fuori raggio|avvicinati|accesso|login|sessione|scadut/i.test(
      message,
    )
  ) {
    return "permanent";
  }
  return "transient";
}

/** Scala di attesa fra retry: 5 s, 15 s, 60 s, poi tetto a 5 min. */
export function backoffMs(attempts: number): number {
  if (attempts <= 1) return 5_000;
  if (attempts === 2) return 15_000;
  if (attempts === 3) return 60_000;
  return 300_000;
}

/**
 * Applica l'esito di un replay a un item. `ok`/`duplicate`/`permanent`
 * rimuovono l'item (il duplicate è già sul server, il permanent non passerà
 * mai); `transient` incrementa `attempts`, riprogramma con `backoffMs` e
 * salva `lastError`. `removed` dice al chiamante se l'item è uscito di coda
 * (per toast/refresh); l'esito resta noto al chiamante che l'ha passato.
 */
export function applyOutboxResult(
  queue: OutboxItem[],
  id: string,
  outcome: OutboxOutcome,
  now: number,
  errorMessage: string | null = null,
): { queue: OutboxItem[]; removed: boolean } {
  const item = queue.find((q) => q.id === id);
  if (!item) return { queue, removed: false };
  if (outcome === "ok" || outcome === "duplicate" || outcome === "permanent") {
    return { queue: queue.filter((q) => q.id !== id), removed: true };
  }
  const attempts = item.attempts + 1;
  return {
    queue: queue.map((q) =>
      q.id === id
        ? {
            ...q,
            attempts,
            nextAttemptAt: now + backoffMs(attempts),
            lastError: errorMessage,
          }
        : q,
    ),
    removed: false,
  };
}

/** Serializza per localStorage. Non lancia mai (quota piena → stringa vuota). */
export function serializeOutbox(queue: OutboxItem[]): string {
  try {
    return JSON.stringify({ v: 1, items: queue });
  } catch {
    return "";
  }
}

const KNOWN_KINDS: ReadonlySet<string> = new Set([
  "check_in",
  "lobby_join",
  "lobby_leave",
]);

function isValidItem(v: unknown): v is OutboxItem {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id === "") return false;
  if (typeof o.kind !== "string" || !KNOWN_KINDS.has(o.kind)) return false;
  if (typeof o.key !== "string" || o.key === "") return false;
  if (typeof o.payload !== "object" || o.payload === null || Array.isArray(o.payload)) return false;
  if (
    typeof o.enqueuedAt !== "number" ||
    !Number.isFinite(o.enqueuedAt) ||
    typeof o.attempts !== "number" ||
    !Number.isFinite(o.attempts) ||
    typeof o.nextAttemptAt !== "number" ||
    !Number.isFinite(o.nextAttemptAt)
  ) {
    return false;
  }
  if (o.lastError !== null && typeof o.lastError !== "string") return false;
  return true;
}

/**
 * Legge da localStorage. Tollerante alla versione: spazzatura, forma errata,
 * `kind` sconosciuto o numeri non finiti scartano il singolo item, mai
 * un'eccezione, mai una coda resuscitata rotta. Taglia a `MAX_OUTBOX_ITEMS`:
 * un valore manomesso o sovradimensionato non deve caricare e inviare piu'
 * del limite (stesso tetto di `enqueueOutbox`).
 */
export function parseOutbox(raw: string | null): OutboxItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const items = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          Array.isArray((parsed as Record<string, unknown>).items)
        ? (parsed as Record<string, unknown>).items
        : null;
    if (!Array.isArray(items)) return [];
    return (items as unknown[]).filter(isValidItem).slice(0, MAX_OUTBOX_ITEMS);
  } catch {
    return [];
  }
}
