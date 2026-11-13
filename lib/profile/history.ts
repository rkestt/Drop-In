/**
 * Storico del profilo: check-in passati + eventi karma. Puro: nessun
 * DOM, nessun Supabase, nessuna data "adesso" implicita.
 *
 * Le righe karma arrivano da `push_notifications` con `data` =
 * `{ type: "karma_loss", lobby_id, points_lost: 3 }`, forma scritta dal
 * trigger 002 (`decrement_karma_on_missed_check_in`, titolo "Karma perso").
 */

import { APP_TIME_ZONE, appDateKey } from "@/lib/datetime";

export interface CheckInHistoryRow {
  id: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  status: string | null;
  courts: { name: string | null } | Array<{ name: string | null }> | null;
}

export interface PushNotificationHistoryRow {
  id: string;
  data: unknown;
  sent_at: string | null;
}

export type HistoryCheckInEntry = {
  kind: "checkin";
  id: string;
  courtName: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  status: "active" | "checked_out";
};

export type HistoryKarmaEntry = {
  kind: "karma";
  id: string;
  label: string;
  delta: number;
  at: string | null;
};

export type HistoryEntry = HistoryCheckInEntry | HistoryKarmaEntry;

export interface HistorySummary {
  total: number;
  checkIns: number;
  karmaEvents: number;
}

export const UNKNOWN_COURT_NAME = "Campo non disponibile";

/** Valore scritto dal trigger quando il no-show toglie 3 punti (002). */
const KARMA_LOSS_POINTS_FALLBACK = 3;

/** La join `courts(name)` puo' mancare o arrivare come array: mai crashare. */
function joinedCourtName(
  courts: CheckInHistoryRow["courts"]
): string {
  if (!courts) return UNKNOWN_COURT_NAME;
  const first = Array.isArray(courts) ? courts[0] : courts;
  const name = first?.name;
  return typeof name === "string" && name.length > 0
    ? name
    : UNKNOWN_COURT_NAME;
}

/**
 * Riga `check_ins` → voce di storico. `null` solo se la riga e'
 * inutilizzabile (id assente); `checked_out_at` e nome campo mancanti
 * sono tollerati, mai inventati.
 */
export function mapCheckInRow(
  row: CheckInHistoryRow | null | undefined
): HistoryCheckInEntry | null {
  if (!row || typeof row.id !== "string" || row.id === "") return null;
  return {
    kind: "checkin",
    id: row.id,
    courtName: joinedCourtName(row.courts),
    checkedInAt: row.checked_in_at ?? null,
    checkedOutAt: row.checked_out_at ?? null,
    status: row.status === "active" ? "active" : "checked_out",
  };
}

interface KarmaLossData {
  type?: unknown;
  points_lost?: unknown;
}

/**
 * Riga `push_notifications` → voce karma. Solo le righe karma (`data.type`
 * nota) diventano voci; le forme sconosciute danno `null` invece di
 * spazzatura a schermo. Etichetta in stile "−3 no-show": stesso delta
 * dei toast di `components/notifications/karma-events.ts`.
 */
export function mapKarmaRow(
  row: PushNotificationHistoryRow | null | undefined
): HistoryKarmaEntry | null {
  if (!row || typeof row.id !== "string" || row.id === "") return null;
  const data =
    row.data !== null && typeof row.data === "object"
      ? (row.data as KarmaLossData)
      : null;
  if (data === null || data.type !== "karma_loss") return null;
  const points =
    typeof data.points_lost === "number" &&
    Number.isFinite(data.points_lost) &&
    data.points_lost > 0
      ? Math.round(data.points_lost)
      : KARMA_LOSS_POINTS_FALLBACK;
  return {
    kind: "karma",
    id: row.id,
    label: `−${points} no-show`,
    delta: -points,
    at: row.sent_at ?? null,
  };
}

/** Istante di ordinamento: check-in all'ora di entrata, karma all'invio. */
function entryTime(entry: HistoryEntry): number {
  const iso = entry.kind === "checkin" ? entry.checkedInAt : entry.at;
  if (typeof iso !== "string") return Number.NEGATIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** Piu' recenti prima; a parita' di istante vince l'id (stabile). */
export function sortHistory(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => {
    const ta = entryTime(a);
    const tb = entryTime(b);
    if (ta !== tb) return tb - ta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Conteggi per l'intestazione della sezione. */
export function historySummary(entries: HistoryEntry[]): HistorySummary {
  let checkIns = 0;
  let karmaEvents = 0;
  for (const entry of entries) {
    if (entry.kind === "checkin") checkIns += 1;
    else karmaEvents += 1;
  }
  return { total: entries.length, checkIns, karmaEvents };
}

/**
 * Data corta it-IT ("12 nov 2026"), "Oggi"/"Ieri" per i giorni vicini.
 * Giorni calcolati nel fuso dell'app via `appDateKey` (#78: `getDate()`
 * locale e `toLocaleDateString` senza `timeZone` davano il giorno di UTC
 * su server/CI). `now` iniettabile per test deterministici; input non
 * data → "—" (stessa convenzione di StatsRow per "non disponibile").
 */
export function formatHistoryDate(
  iso: string | null | undefined,
  now: number | Date = Date.now()
): string {
  if (typeof iso !== "string" || iso === "") return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  const ref = now instanceof Date ? now : new Date(now);
  const renderDay = (d: Date): string =>
    d.toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: APP_TIME_ZONE,
    });
  if (!Number.isFinite(ref.getTime())) {
    return renderDay(date);
  }
  const key = appDateKey(date);
  if (key === appDateKey(ref)) return "Oggi";
  // Ieri = giorno civile precedente nel fuso dell'app (stessa aritmetica
  // su chiave di `formatAppDay` in lib/datetime.ts: immune al DST).
  const [y, m, d] = appDateKey(ref).split("-").map(Number);
  const yesterdayKey = appDateKey(
    Date.UTC(y, (m ?? 1) - 1, (d ?? 1)) - 24 * 60 * 60 * 1000,
    "UTC"
  );
  if (key === yesterdayKey) return "Ieri";
  return renderDay(date);
}
