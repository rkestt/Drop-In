/**
 * Thin client tipizzato delle Serie (#92).
 *
 * Nessuna "use server"/"use client": le funzioni prendono il client Supabase
 * già creato dal chiamante (Server Component o browser), come
 * `lib/moderation/queries.ts`. Le policy RLS (044) restano l'ultima difesa;
 * qui si validano gli input e si traducono gli errori in italiano.
 *
 * Mai Conferme implicite: nessuna funzione scrive in `lobby_participants`
 * né in `check_ins`. Unica chiamata al generatore: `materialize_series`
 * (047, addendum #92) dopo l'INSERT in `createSeries`, best-effort — se
 * fallisce, il cron notturno copre e la creazione resta valida.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { defaultDurationForSport } from "@/lib/sport/sports";
import {
  seriesSchema,
  updateSeriesSchema,
  type SeriesInput,
  type UpdateSeriesValues,
} from "@/lib/validation/schemas";
import {
  SERIES_DELETE_FORBIDDEN_MESSAGE,
  SERIES_FORBIDDEN_MESSAGE,
  mapSeriesError,
} from "./errors";
import { normalizeTimeOfDay } from "./next-occurrence";
import {
  toSeriesOccurrence,
  toSeriesWithNextOccurrence,
  type LobbyRow,
  type NextOccurrenceInfo,
  type SeriesOccurrence,
  type SeriesRow,
  type SeriesWithNextOccurrence,
} from "./types";

export type {
  NextOccurrenceInfo,
  SeriesOccurrence,
  SeriesRow,
  SeriesWithNextOccurrence,
} from "./types";

type SeriesClient = SupabaseClient<Database>;

export interface SeriesResult {
  /**
   * Addendum #92: la prossima occorrenza è letta dalle righe `lobbies`
   * reali (dopo `materialize_series`), mai calcolata a mano.
   */
  series: SeriesWithNextOccurrence | null;
  error: string | null;
}

export interface SeriesDeleteResult {
  error: string | null;
}

export interface SeriesListResult {
  items: SeriesWithNextOccurrence[];
  error: boolean;
}

export interface SeriesOccurrencesResult {
  items: SeriesOccurrence[];
  error: boolean;
}

/** L'utente deve essere loggato: la RLS INSERT pretende `creator_id = auth.uid()`. */
async function requireUserId(
  supabase: SeriesClient,
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function firstIssueMessage(error: { issues: { message?: string }[] }): string {
  return error.issues[0]?.message ?? "Controlla i dati inseriti.";
}

/** `now` robusto in ISO: con input malformato si usa l'istante corrente. */
function nowIso(now: Date | number | string): string {
  const ms = new Date(now).getTime();
  return new Date(Number.isFinite(ms) ? ms : Date.now()).toISOString();
}

/** Riga minima per la prossima occorrenza + conteggio conferme. */
interface NextOccurrenceRow {
  id: string;
  series_id: string | null;
  start_time: string;
  lobby_participants: { count: number }[];
}

/**
 * Prossima occorrenza per serie, dalle righe `lobbies` reali (addendum #92):
 * la più vicina `open` non ancora finita (`ends_at > now`, così un'occorrenza
 * in corso vale come "prossima"), con id e conferme. Una query sola per tutte
 * le serie, la prima riga per serie vince. Il conteggio passa dall'embed
 * `lobby_participants(count)` (stesso della pagina campo: la SELECT sui
 * partecipanti è aperta a tutti, 001). Best-effort: a map vuota la UI mostra
 * `null` / 0.
 */
async function fetchNextOccurrenceMap(
  supabase: SeriesClient,
  seriesIds: string[],
  atIso: string,
): Promise<Map<string, NextOccurrenceInfo>> {
  const map = new Map<string, NextOccurrenceInfo>();
  if (seriesIds.length === 0) return map;
  try {
    const { data, error } = await supabase
      .from("lobbies")
      .select("id, series_id, start_time, lobby_participants(count)")
      .in("series_id", seriesIds)
      .eq("status", "open")
      .gt("ends_at", atIso)
      .order("start_time", { ascending: true });
    if (error) return map;
    for (const row of (data ?? []) as unknown as NextOccurrenceRow[]) {
      if (row.series_id !== null && !map.has(row.series_id)) {
        map.set(row.series_id, {
          id: row.id,
          startTime: row.start_time,
          confirmedCount: row.lobby_participants?.[0]?.count ?? 0,
        });
      }
    }
  } catch {
    // Best-effort: nextOccurrence resta null, mai un throw in UI.
  }
  return map;
}

/**
 * Crea una Serie. `durationMinutes` assente → default di sport
 * (`defaultDurationForSport`); `active` assente → `true` (default DB).
 */
export async function createSeries(
  supabase: SeriesClient,
  input: SeriesInput,
): Promise<SeriesResult> {
  const parsed = seriesSchema.safeParse(input);
  if (!parsed.success) {
    return { series: null, error: firstIssueMessage(parsed.error) };
  }
  const userId = await requireUserId(supabase);
  if (!userId) {
    return {
      series: null,
      error: "Devi effettuare l'accesso per creare una serie.",
    };
  }
  const values = parsed.data;
  const timeOfDay = normalizeTimeOfDay(values.timeOfDay);
  if (timeOfDay === null) {
    return { series: null, error: "Usa il formato HH:MM (es. 20:00)." };
  }
  try {
    const { data, error } = await supabase
      .from("lobby_series")
      .insert({
        court_id: values.courtId,
        creator_id: userId,
        weekday: values.weekday,
        time_of_day: timeOfDay,
        sport: values.sport ?? null,
        duration_minutes:
          values.durationMinutes ??
          defaultDurationForSport(values.sport ?? null),
        max_players: values.maxPlayers,
        active: values.active ?? true,
      })
      .select()
      .single();
    if (error) {
      return {
        series: null,
        error: mapSeriesError({ code: error.code, message: error.message })
          .message,
      };
    }
    const inserted = data as SeriesRow;

    // Addendum #92: materializzazione immediata (047). Best-effort: se la RPC
    // fallisce (RLS, rete) la creazione resta valida — il cron notturno
    // genera le occorrenze.
    try {
      await supabase.rpc("materialize_series", { p_series_id: inserted.id });
    } catch {
      // Best-effort: coperto dal cron, mai un errore in UI.
    }

    // La prossima occorrenza si legge dalle righe reali appena generate
    // (o resta null finché il cron non passa): mai calcolata a mano.
    const next = await fetchNextOccurrenceMap(
      supabase,
      [inserted.id],
      nowIso(Date.now()),
    );
    return {
      series: toSeriesWithNextOccurrence(inserted, next.get(inserted.id)),
      error: null,
    };
  } catch (err) {
    return {
      series: null,
      error: mapSeriesError({
        message: err instanceof Error ? err.message : null,
      }).message,
    };
  }
}

/**
 * Modifica la regola (giorno, ora, campo, …). Il creatore cambia tutto; un
 * non-creatore può solo disattivare una Serie orfana (guard 044, il DB
 * rifiuta il resto con P0001). 0 righe = RLS negata.
 */
export async function updateSeries(
  supabase: SeriesClient,
  id: string,
  patch: UpdateSeriesValues,
): Promise<SeriesResult> {
  const parsed = updateSeriesSchema.safeParse(patch);
  if (!parsed.success) {
    return { series: null, error: firstIssueMessage(parsed.error) };
  }
  const values = parsed.data;
  const payload: Database["public"]["Tables"]["lobby_series"]["Update"] = {};
  if (values.courtId !== undefined) payload.court_id = values.courtId;
  if (values.weekday !== undefined) payload.weekday = values.weekday;
  if (values.timeOfDay !== undefined) {
    const timeOfDay = normalizeTimeOfDay(values.timeOfDay);
    if (timeOfDay === null) {
      return { series: null, error: "Usa il formato HH:MM (es. 20:00)." };
    }
    payload.time_of_day = timeOfDay;
  }
  if (values.sport !== undefined) payload.sport = values.sport;
  if (values.durationMinutes !== undefined) {
    payload.duration_minutes = values.durationMinutes;
  }
  if (values.maxPlayers !== undefined) payload.max_players = values.maxPlayers;
  if (values.active !== undefined) payload.active = values.active;

  try {
    const { data, error } = await supabase
      .from("lobby_series")
      .update(payload)
      .eq("id", id)
      .select();
    if (error) {
      return {
        series: null,
        error: mapSeriesError({ code: error.code, message: error.message })
          .message,
      };
    }
    const rows = (data ?? []) as SeriesRow[];
    if (rows.length === 0) {
      // Update RLS-negato: PostgREST torna 0 righe, non un errore (cfr 42501).
      return { series: null, error: SERIES_FORBIDDEN_MESSAGE };
    }
    // Come in createSeries: la prossima occorrenza si rilegge dalle righe
    // reali (un cambio di giorno/ora sposta le future, non le già generate).
    const next = await fetchNextOccurrenceMap(
      supabase,
      [rows[0].id],
      nowIso(Date.now()),
    );
    return {
      series: toSeriesWithNextOccurrence(rows[0], next.get(rows[0].id)),
      error: null,
    };
  } catch (err) {
    return {
      series: null,
      error: mapSeriesError({
        message: err instanceof Error ? err.message : null,
      }).message,
    };
  }
}

/**
 * Attiva/disattiva una Serie. È anche la via del kill-switch orfani (044):
 * un partecipante a un'Occorrenza recente può mettere `active = false` su
 * una Serie senza creatore; il guard rifiuta tutto il resto.
 */
export async function setSeriesActive(
  supabase: SeriesClient,
  id: string,
  active: boolean,
): Promise<SeriesResult> {
  return updateSeries(supabase, id, { active });
}

/** Cancella una Serie: le Occorrenze diventano lobby singole (`SET NULL`). */
export async function deleteSeries(
  supabase: SeriesClient,
  id: string,
): Promise<SeriesDeleteResult> {
  try {
    const { data, error } = await supabase
      .from("lobby_series")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      return {
        error: mapSeriesError({ code: error.code, message: error.message })
          .message,
      };
    }
    if ((data ?? []).length === 0) {
      return { error: SERIES_DELETE_FORBIDDEN_MESSAGE };
    }
    return { error: null };
  } catch (err) {
    return {
      error: mapSeriesError({
        message: err instanceof Error ? err.message : null,
      }).message,
    };
  }
}

/**
 * Serie dell'utente loggato, con la prossima Occorrenza letta dalle righe
 * `lobbies` reali (addendum #92) e ordinate per data (le senza occorrenza
 * in fondo). Sloggato → lista vuota senza errore (la pagina redirige al
 * login da sé).
 */
export async function listMySeries(
  supabase: SeriesClient,
  now: Date | number | string = Date.now(),
): Promise<SeriesListResult> {
  const userId = await requireUserId(supabase);
  if (!userId) return { items: [], error: false };
  try {
    const { data, error } = await supabase
      .from("lobby_series")
      .select("*")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false });
    if (error) return { items: [], error: true };
    const rows = (data ?? []) as SeriesRow[];
    const atIso = nowIso(now);
    const next = await fetchNextOccurrenceMap(
      supabase,
      rows.map((row) => row.id),
      atIso,
    );
    const items: SeriesWithNextOccurrence[] = rows.map((row) =>
      toSeriesWithNextOccurrence(row, next.get(row.id)),
    );
    items.sort((a, b) => {
      if (a.nextOccurrence === null) return 1;
      if (b.nextOccurrence === null) return -1;
      return a.nextOccurrence < b.nextOccurrence ? -1 : 1;
    });
    return { items, error: false };
  } catch {
    return { items: [], error: true };
  }
}

/**
 * Finestra del kill-switch orfani (044): solo chi ha una Conferma in
 * un'occorrenza con `start_time` dentro gli ultimi 28 giorni può spegnere
 * una Serie senza creatore. Stesso numero della policy/guard, un unico posto.
 */
export const ORPHAN_PARTICIPATION_WINDOW_DAYS = 28;

/** Inizio finestra orfani in ISO (`now` robusto come `nowIso`). */
export function orphanParticipationCutoffIso(
  now: Date | number | string = Date.now(),
): string {
  const ms = new Date(now).getTime();
  const at = Number.isFinite(ms) ? ms : Date.now();
  return new Date(
    at - ORPHAN_PARTICIPATION_WINDOW_DAYS * 86_400_000,
  ).toISOString();
}

/**
 * Serie orfane che l'utente può fermare: `creator_id IS NULL`, solo quelle
 * ancora attive, e solo se l'utente ha una Conferma in una loro occorrenza
 * degli ultimi 28 giorni già iniziata (stessa finestra della policy 044:
 * `cutoff < start_time <= now`).
 *
 * Tre query, nessun N+1 (insiemi limitati ai dati dell'utente): mie
 * partecipazioni → occorrenze di serie recenti → serie orfane. La SELECT su
 * `lobby_series` è aperta a tutti (044 "viewable by everyone"), nessun
 * privilege aggiuntivo; lo spegnimento resta al guard (`setSeriesActive`
 * con `active: false`). Sloggato → lista vuota senza errore.
 */
export async function listOrphanSeries(
  supabase: SeriesClient,
  now: Date | number | string = Date.now(),
): Promise<SeriesListResult> {
  const userId = await requireUserId(supabase);
  if (!userId) return { items: [], error: false };
  try {
    // 1. Le mie partecipazioni (stessa query della pagina /lobbies: solo mie).
    const { data: parts, error: partsError } = await supabase
      .from("lobby_participants")
      .select("lobby_id")
      .eq("user_id", userId);
    if (partsError) return { items: [], error: true };
    const lobbyIds = [...new Set((parts ?? []).map((p) => p.lobby_id))];
    if (lobbyIds.length === 0) return { items: [], error: false };

    // 2. Quali sono occorrenze di serie nella finestra kill-switch
    // (come la policy 044: iniziate negli ultimi 28 giorni, mai future).
    const atIso = nowIso(now);
    const cutoffIso = orphanParticipationCutoffIso(now);
    const { data: occs, error: occsError } = await supabase
      .from("lobbies")
      .select("series_id")
      .in("id", lobbyIds)
      .not("series_id", "is", null)
      .gt("start_time", cutoffIso)
      .lte("start_time", atIso);
    if (occsError) return { items: [], error: true };
    const seriesIds = [
      ...new Set(
        (occs ?? [])
          .map((o) => o.series_id)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (seriesIds.length === 0) return { items: [], error: false };

    // 3. Solo le orfane ancora attive: le uniche su cui "Ferma la serie"
    // ha senso (il guard rifiuta tutto il resto).
    const { data, error } = await supabase
      .from("lobby_series")
      .select("*")
      .in("id", seriesIds)
      .is("creator_id", null)
      .eq("active", true);
    if (error) return { items: [], error: true };
    const rows = (data ?? []) as SeriesRow[];
    const next = await fetchNextOccurrenceMap(
      supabase,
      rows.map((row) => row.id),
      atIso,
    );
    const items: SeriesWithNextOccurrence[] = rows.map((row) =>
      toSeriesWithNextOccurrence(row, next.get(row.id)),
    );
    items.sort((a, b) => {
      if (a.nextOccurrence === null) return 1;
      if (b.nextOccurrence === null) return -1;
      return a.nextOccurrence < b.nextOccurrence ? -1 : 1;
    });
    return { items, error: false };
  } catch {
    return { items: [], error: true };
  }
}

/**
 * Occorrenze `open` di una Serie, dalla più vicina (orizzonte 14 giorni dal
 * generatore 046: il tetto è solo di sicurezza, non un filtro temporale).
 */
export async function listSeriesOccurrences(
  supabase: SeriesClient,
  seriesId: string,
  limit = 30,
): Promise<SeriesOccurrencesResult> {
  try {
    const { data, error } = await supabase
      .from("lobbies")
      .select(
        "id, series_id, court_id, start_time, ends_at, status, max_players, sport, duration_minutes",
      )
      .eq("series_id", seriesId)
      .eq("status", "open")
      .order("start_time", { ascending: true })
      .limit(limit);
    if (error) return { items: [], error: true };
    return {
      items: ((data ?? []) as unknown as LobbyRow[]).map(toSeriesOccurrence),
      error: false,
    };
  } catch {
    return { items: [], error: true };
  }
}
