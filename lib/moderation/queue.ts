/**
 * Mapping puro per il pannello di moderazione (#33): righe DB -> voci UI.
 *
 * Nessuna I/O qui dentro: le query stanno in `lib/moderation/queries.ts`,
 * così i mapper restano unit-testabili e il client/server usano le stesse
 * etichette (niente divergenze tra primo render e refetch).
 *
 * Regola sulle righe mascherate di `dedup_candidates`: `id`/`name`/`lat`/
 * `lng`/`distance_m` possono essere NULL per le proposte altrui ancora in
 * coda (migration 012 + 018). La riga resta visibile come "Proposta in
 * attesa", senza coordinate, distanza o azione: un id NULL non è un campo.
 */

import { dedupCandidateKey } from "@/lib/court/dedup-candidate";
import { sportDisplayLabel, surfaceTypeLabel } from "@/lib/courts/search";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { formatDistanceM } from "@/lib/lobbies/nearby";
import {
  activeReports,
  categoryLabel,
  formatReportExpiry,
} from "@/lib/reports/active";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_DAYS = 7;

/** Etichetta leggibile della superficie: un'unica verita' in `lib/courts/search`
 * (niente duplicati che divergono: gli sconosciuti passano invariati). */
export function surfaceLabel(
  surface: string | null | undefined
): string | null {
  return surfaceTypeLabel(surface);
}

/** Data estesa it-IT nel fuso dell'app ("12 nov 2026"), stabile SSR/client. */
export function queueDateLabel(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/**
 * Anzianità di una proposta in forma umana ("2 ore fa"); oltre una settimana
 * si passa alla data ("12 nov 2026"). `now` iniettabile per i test; un
 * timestamp futuro (clock skew) resta "adesso", mai numeri negativi.
 */
export function submittedAgoLabel(
  createdAt: string | Date,
  now: string | Date = new Date(),
): string {
  const created = new Date(createdAt).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(created) || Number.isNaN(current)) return "";
  const diff = current - created;

  if (diff < MINUTE_MS) return "adesso";
  if (diff < HOUR_MS) {
    const minutes = Math.floor(diff / MINUTE_MS);
    return minutes === 1 ? "1 minuto fa" : `${minutes} minuti fa`;
  }
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / HOUR_MS);
    return hours === 1 ? "1 ora fa" : `${hours} ore fa`;
  }
  const days = Math.floor(diff / DAY_MS);
  if (days < WEEK_DAYS) {
    return days === 1 ? "1 giorno fa" : `${days} giorni fa`;
  }
  return queueDateLabel(createdAt);
}

/** Coordinate in testo, 5 decimali (~1 m); niente mappa in questa schermata. */
export function coordinatesLabel(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return "Posizione non disponibile";
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Riga grezza di `courts` per la coda pending (sola lettura, RLS moderatore). */
export interface PendingCourtRow {
  id: string;
  name: string;
  sport: string | null;
  surface_type: string | null;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  created_at: string | null;
}

/** Riga pronta per la lista: etichette e testi già composti. */
export interface ModerationQueueItem {
  id: string;
  name: string;
  sportLabel: string;
  surfaceLabel: string | null;
  address: string | null;
  photoPath: string | null;
  lat: number | null;
  lng: number | null;
  /** Anzianità relativa ("2 ore fa"). */
  submittedAgo: string;
  /** Data dell'invio ("12 nov 2026"). */
  submittedOn: string;
  /** Testo coordinate per il dettaglio ("41.90278, 12.49637"). */
  coordinates: string;
}

/** Riga `courts` -> voce della coda. Non inventa valori: i null restano null. */
export function mapPendingCourt(
  row: PendingCourtRow,
  now: string | Date = new Date(),
): ModerationQueueItem {
  const lat = typeof row.lat === "number" ? row.lat : null;
  const lng = typeof row.lng === "number" ? row.lng : null;
  return {
    id: row.id,
    name: row.name,
    sportLabel: sportDisplayLabel(row.sport),
    surfaceLabel: surfaceLabel(row.surface_type),
    address: row.address?.trim() ? row.address.trim() : null,
    photoPath: row.photo_path ?? null,
    lat,
    lng,
    submittedAgo: submittedAgoLabel(row.created_at ?? "", now),
    submittedOn: queueDateLabel(row.created_at ?? ""),
    coordinates: coordinatesLabel(lat, lng),
  };
}

/** Riga grezza di `dedup_candidates`; nullable per le righe mascherate. */
export interface DedupCandidateRow {
  id: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  moderation_status: string | null;
  source: string | null;
}

/** Candidato dedup pronto per la UI; `selectable` = id reale e corte approvata. */
export interface DedupCandidateItem {
  key: string;
  id: string | null;
  name: string;
  distanceLabel: string | null;
  selectable: boolean;
}

/**
 * Riga `dedup_candidates` -> voce UI. Le righe mascherate non hanno id né
 * distanza: restano "Proposta in attesa" e non producono azioni. Anche una
 * riga con id reale ma non `approved` (proposta propria) non è selezionabile:
 * `mark_duplicate` accetta solo corti approvate.
 */
export function mapDedupCandidate(
  row: DedupCandidateRow,
  index: number,
): DedupCandidateItem {
  const id =
    typeof row.id === "string" && row.id.length > 0 ? row.id : null;
  const rawName = row.name?.trim();
  // `mark_duplicate` accetta solo una corte APPROVATA: un id reale ma
  // `pending`/`rejected` (proposta propria non mascherata) non è un target
  // valido e non deve produrre un'azione destinata a fallire.
  const approved = row.moderation_status === "approved";
  return {
    key: dedupCandidateKey({ id }, index),
    id,
    name:
      rawName && rawName.length > 0
        ? rawName
        : id
          ? "Campo senza nome"
          : "Proposta in attesa",
    distanceLabel:
      typeof row.distance_m === "number" && Number.isFinite(row.distance_m)
        ? formatDistanceM(row.distance_m)
        : null,
    selectable: id !== null && approved,
  };
}

/** Riga grezza di `court_reports` con il nome del campo (join `courts`). */
export interface ReportCourtRow {
  id: string;
  court_id: string;
  category: string;
  expires_at: string | null;
  created_at: string | null;
  courts?: { name: string | null } | Array<{ name: string | null }> | null;
}

/** Gruppo di segnalazioni attive per campo, più recenti prima. */
export interface ReportCourtGroup {
  courtId: string;
  courtName: string;
  /** Link al dettaglio solo se il campo ha un nome leggibile. */
  courtHref: string | null;
  count: number;
  /** Etichette di categoria distinte, nell'ordine della segnalazione più nuova. */
  categories: string[];
  /** Scadenza più lontana del gruppo ("16 nov, 19:40"), "" se ignota. */
  latestExpiryLabel: string;
  /** Timestamp della segnalazione più recente (per l'ordinamento). */
  newestAt: number;
}

function reportCourtName(row: ReportCourtRow): string | null {
  const joined = row.courts;
  const value = Array.isArray(joined) ? joined[0]?.name : joined?.name;
  return value?.trim() ? value.trim() : null;
}

function timestamp(value: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Segnalazioni -> gruppi per campo. Filtra le scadute con `activeReports`
 * (stessa verità della pagina campo) e ordina i gruppi per segnalazione più
 * recente; dentro il gruppo conta, elenca le categorie distinte e mostra la
 * scadenza più lontana (quando il gruppo si svuota del tutto).
 */
export function toReportCourtGroups(
  rows: ReportCourtRow[],
  now: string | Date = new Date(),
): ReportCourtGroup[] {
  const active = activeReports(rows, now);
  const groups = new Map<
    string,
    {
      courtName: string | null;
      count: number;
      categories: string[];
      latestExpiresAt: number;
      newestAt: number;
    }
  >();

  for (const row of active) {
    const name = reportCourtName(row);
    const label = categoryLabel(row.category);
    const createdAt = timestamp(row.created_at);
    const expiresAt = timestamp(row.expires_at);
    const group = groups.get(row.court_id);
    if (!group) {
      groups.set(row.court_id, {
        courtName: name,
        count: 1,
        categories: [label],
        latestExpiresAt: expiresAt,
        newestAt: createdAt,
      });
      continue;
    }
    group.count += 1;
    if (!group.categories.includes(label)) group.categories.push(label);
    if (expiresAt > group.latestExpiresAt) group.latestExpiresAt = expiresAt;
    if (createdAt > group.newestAt) group.newestAt = createdAt;
    if (!group.courtName && name) group.courtName = name;
  }

  return [...groups.entries()]
    .map(([courtId, group]) => ({
      courtId,
      courtName: group.courtName ?? "Campo non disponibile",
      courtHref: group.courtName ? `/courts/${courtId}` : null,
      count: group.count,
      categories: group.categories,
      latestExpiryLabel:
        group.latestExpiresAt > 0
          ? formatReportExpiry(new Date(group.latestExpiresAt))
          : "",
      newestAt: group.newestAt,
    }))
    .sort((a, b) => b.newestAt - a.newestAt);
}
