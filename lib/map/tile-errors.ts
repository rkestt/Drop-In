/**
 * Aggregatore degli errori tile successivi al primo load (#39).
 *
 * Dopo il `load` MapLibre emette un `error` per ogni tile che fallisce: uno
 * per uno sono rumore (un 404 di bordo mappa durante un pan, un tile
 * transitorio), ma se le tile smettono di arrivare la mappa resta vuota senza
 * feedback. Qui vive la macchina a stati, senza DOM e senza MapLibre:
 *
 * - classifica l'errore (trasporto, 5xx, blocco, 404);
 * - tiene una finestra scorrevole e conta solo errori "veri";
 * - un singolo 404 non conta: servono almeno `notFoundThreshold` 404 nella
 *   finestra, altrimenti viene ignorato;
 * - superata la soglia il banner compare; il primo tile caricato lo chiude;
 * - il banner e' dismissibile: una volta chiuso non riappare finche' non
 *   arrivano di nuovo tile validi (reset) o si ricrea la mappa.
 */

export type TileErrorKind =
  | "transport"
  | "server"
  | "blocked"
  | "not-found"
  | "ignore";

export type CountedTileErrorKind = Exclude<TileErrorKind, "ignore">;

export interface TileErrorPolicy {
  /** Finestra scorrevole in ms. */
  windowMs: number;
  /** Errori "veri" (non 404) che fanno comparire il banner. */
  threshold: number;
  /** Sotto questo numero di 404 nella finestra, i 404 non contano. */
  notFoundThreshold: number;
}

export const DEFAULT_TILE_ERROR_POLICY: TileErrorPolicy = {
  windowMs: 10_000,
  threshold: 5,
  notFoundThreshold: 3,
};

export interface TileErrorSample {
  at: number;
  kind: CountedTileErrorKind;
}

export interface TileErrorState {
  samples: TileErrorSample[];
  lastErrorAt: number | null;
  lastLoadAt: number | null;
  /** Chiuso dall'utente: resta chiuso finche' non arriva un tile valido. */
  dismissed: boolean;
  bannerVisible: boolean;
}

export function createTileErrorState(): TileErrorState {
  return {
    samples: [],
    lastErrorAt: null,
    lastLoadAt: null,
    dismissed: false,
    bannerVisible: false,
  };
}

/**
 * Forma minima di un errore MapLibre. Gli errori di rete arrivano come
 * `AJAXError` (con `status`/`url`), quelli di trasporto come `TypeError`
 * con message "Failed to fetch" / "Load failed".
 */
interface MapErrorLike {
  status?: unknown;
  url?: unknown;
  message?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const TRANSPORT_MESSAGE =
  /failed to fetch|network ?error|network request failed|load failed|timed? ?out|econn|enotfound|err_internet|err_network|fetch failed/i;

function urlMatchesHosts(url: string, hosts: readonly string[]): boolean {
  return hosts.some((host) => url.includes(host));
}

/**
 * Classifica un errore MapLibre. `ignore` per tutto cio' che non e' una tile:
 * immagini mancanti, warning di filtro, errori dello stile.
 */
export function classifyTileError(
  error: unknown,
  tileHosts: readonly string[]
): TileErrorKind {
  if (error == null) return "ignore";
  const like: MapErrorLike =
    typeof error === "object" ? (error as MapErrorLike) : { message: error };
  const message = asString(like.message) ?? "";
  const url = asString(like.url);
  const status = asStatus(like.status);

  // Host noto: un errore su un altro host non e' una tile (es. Supabase).
  if (url && tileHosts.length > 0 && !urlMatchesHosts(url, tileHosts)) {
    return "ignore";
  }

  if (status != null) {
    if (status === 404) return "not-found";
    if (status === 408) return "transport";
    if (status === 401 || status === 403 || status === 429) return "blocked";
    if (status >= 500) return "server";
    // 400/402/405… non sono recuperabili e non indicano un tile mancante.
    if (status >= 400) return "ignore";
  }

  if (TRANSPORT_MESSAGE.test(message)) return "transport";

  // AJAXError senza status (fetch fallita prima della risposta).
  if (/ajaxerror|request failed/i.test(message)) return "transport";

  return "ignore";
}

function effectiveErrorCount(
  samples: readonly TileErrorSample[],
  policy: TileErrorPolicy
): number {
  let retryable = 0;
  let notFound = 0;
  for (const sample of samples) {
    if (sample.kind === "not-found") notFound += 1;
    else retryable += 1;
  }
  return retryable + (notFound >= policy.notFoundThreshold ? notFound : 0);
}

/**
 * Registra un errore e ritorna il nuovo stato (mai muta l'input).
 * `kind: "ignore"` ritorna lo stato identico.
 */
export function recordTileError(
  state: TileErrorState,
  kind: TileErrorKind,
  now: number,
  policy: TileErrorPolicy = DEFAULT_TILE_ERROR_POLICY
): TileErrorState {
  if (kind === "ignore") return state;
  const samples = [
    ...state.samples.filter((sample) => now - sample.at <= policy.windowMs),
    { at: now, kind },
  ];
  const bannerVisible =
    !state.dismissed && effectiveErrorCount(samples, policy) >= policy.threshold;
  return {
    ...state,
    samples,
    lastErrorAt: now,
    bannerVisible,
  };
}

/**
 * Un tile e' arrivato davvero (non `idle`: MapLibre va in idle anche quando i
 * tile sono tutti in errore, quindi non e' un segnale di recupero).
 * Azzera la finestra e riapre la possibilita' del banner.
 */
export function recordTileLoad(
  state: TileErrorState,
  now: number
): TileErrorState {
  const clean =
    state.samples.length === 0 &&
    state.lastErrorAt == null &&
    !state.bannerVisible &&
    !state.dismissed;
  if (clean) return state;
  return {
    samples: [],
    lastErrorAt: null,
    lastLoadAt: now,
    dismissed: false,
    bannerVisible: false,
  };
}

/** Chiusura manuale del banner: non riappare finche' non arrivano tile validi. */
export function dismissTileError(state: TileErrorState): TileErrorState {
  if (!state.bannerVisible) return state;
  return { ...state, dismissed: true, bannerVisible: false };
}
