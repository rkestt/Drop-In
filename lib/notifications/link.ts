// Helpers puri per il centro notifiche (d22): da `data` JSONB a href sicuro
// e a tipo icona. Nessun tipo inventato: i titoli/corpi arrivano dal DB,
// qui si mappa solo `data.kind`/`data.type` (sorgenti: trigger 002) a un
// sottoinsieme chiuso di tipi icona; il "meteo campo" resta (d14/d22).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

function readData(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }
  return data as Record<string, unknown>;
}

/**
 * Da `data` JSONB a href interno sicuro, altrimenti `null`.
 * Il kind guida la scelta (prototipo d14):
 * - karma/ban → `/profile` ("Apri profilo"), anche se `data` porta altri id
 *   (es. `karma_loss` di 002 porta `lobby_id`: non deve aprire la lobby);
 * - tipi lobby (`lobby_starting_soon`, `participant_joined`, `lobby`):
 *   `court_id` valido → `/courts/<uuid>`, altrimenti `lobby_id` valido →
 *   `/lobbies/<uuid>` (dettaglio d20: funziona a freddo, 404 se assente);
 * - checkin/weather/neutral: `court_id` valido → `/courts/<uuid>`
 *   ("Apri campo"), altrimenti `null` (la riga resta e mostra il dettaglio).
 * UUID non validi o `data` malformato → `null`, senza eccezioni.
 */
export function notificationHref(data: unknown): string | null {
  const record = readData(data);
  if (!record) return null;
  const kind = notificationKind(data);

  if (kind === "karma" || kind === "ban") return "/profile";

  const courtId = cleanUuid(record.court_id);
  if (courtId) return `/courts/${courtId}`;

  if (kind === "lobby") {
    const lobbyId = cleanUuid(record.lobby_id);
    if (lobbyId) return `/lobbies/${lobbyId}`;
  }

  return null;
}

export type NotificationKind =
  | "lobby"
  | "karma"
  | "ban"
  | "checkin"
  | "weather"
  | "neutral";

/** Dal campo `data.kind` (o `data.type` dei trigger 002) al tipo icona. */
export function notificationKind(data: unknown): NotificationKind {
  const record = readData(data);
  const raw = record
    ? (record.kind ?? record.type)
    : null;
  const kind = typeof raw === "string" ? raw.trim().toLowerCase() : "";

  if (
    kind === "lobby" ||
    kind === "lobby_starting_soon" ||
    kind === "participant_joined"
  ) {
    return "lobby";
  }
  if (kind === "karma" || kind === "karma_loss") return "karma";
  if (kind === "ban" || kind === "ban_applied") return "ban";
  if (kind === "checkin" || kind === "check_in" || kind === "check-in") {
    return "checkin";
  }
  if (kind === "weather") return "weather";
  return "neutral";
}

/** Riga `push_notifications` come serve alla lista (sottoinsieme di Row). */
export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  data: unknown;
  sent_at: string | null;
  read_at: string | null;
}

/** "Adesso" sotto il minuto, poi "X min/ore/giorni fa", poi data breve. */
export function formatRelativeTime(
  sentAt: string | null,
  now: number = Date.now()
): string {
  if (!sentAt) return "";
  const then = new Date(sentAt).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = now - then;
  if (diffMs < 60_000) return "Adesso";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "giorno" : "giorni"} fa`;
  return new Date(then).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}
